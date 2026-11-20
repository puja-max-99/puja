import { Router } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  listingItems,
  listings,
  listingVariants,
  masterCategories,
  recentSearches,
  reviews,
  searchAliases,
  settings,
} from '../db/schema.ts';
import { ensureSeeded } from '../db/seed.ts';
import { AuthRequest, isSuperAdminRole, optionalAuth, requireAuth } from '../middleware/auth.ts';

const router = Router();

function expandTokens(rawQuery: string, aliasGroups: Record<string, string[]>): string[] {
  const q = (rawQuery || '').toLowerCase().trim();
  if (!q) return [];
  const tokens = new Set<string>([q]);
  q.split(/\s+/).forEach((w) => {
    if (w.length > 1) tokens.add(w);
  });
  Object.values(aliasGroups).forEach((group) => {
    if (group.some((alias) => q.includes(alias) || alias.includes(q))) {
      group.forEach((alias) => tokens.add(alias));
    }
  });
  return Array.from(tokens);
}

function matchesTokens(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const lower = haystack.toLowerCase();
  return tokens.some((tok) => lower.includes(tok));
}

async function getAliasMap(): Promise<Record<string, string[]>> {
  const rows = await db.select().from(searchAliases);
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    if (!map[r.groupKey]) map[r.groupKey] = [];
    map[r.groupKey].push(r.term);
  }
  return map;
}

async function hydrateListings(listingRows: Array<typeof listings.$inferSelect>) {
  if (listingRows.length === 0) return [];
  const allItems = await db.select().from(listingItems).orderBy(asc(listingItems.sortOrder));
  const allVariants = await db.select().from(listingVariants).orderBy(asc(listingVariants.sortOrder));
  const allReviews = await db
    .select()
    .from(reviews)
    .where(eq(reviews.status, 'published'))
    .orderBy(desc(reviews.createdAt));

  const itemsMap = new Map<number, typeof allItems>();
  for (const it of allItems) {
    const arr = itemsMap.get(it.listingId) || [];
    arr.push(it);
    itemsMap.set(it.listingId, arr);
  }

  const variantsMap = new Map<number, typeof allVariants>();
  for (const v of allVariants) {
    const arr = variantsMap.get(v.listingId) || [];
    arr.push(v);
    variantsMap.set(v.listingId, arr);
  }

  const reviewsMap = new Map<number, typeof allReviews>();
  for (const r of allReviews) {
    const arr = reviewsMap.get(r.listingId) || [];
    arr.push(r);
    reviewsMap.set(r.listingId, arr);
  }

  return listingRows.map((l) => {
    const subItems = (itemsMap.get(l.id) || []).map((it) => ({
      id: it.id,
      name: it.name,
      unit: it.unit,
      price: it.price,
      qty: it.defaultQty,
      checked: it.isDefaultChecked,
    }));
    const vars = variantsMap.get(l.id) || [];
    const pujaTypes = vars.filter((v) => v.type === 'pooja_type').map((v) => ({
      id: v.id,
      label: v.label,
      price: v.price,
    }));
    const sizes = vars.filter((v) => v.type === 'size').map((v) => ({
      id: v.id,
      label: v.label,
      price: v.price,
    }));
    const revs = (reviewsMap.get(l.id) || []).map((r) => ({
      id: r.id,
      userId: r.userId,
      author: r.authorName,
      rating: r.rating,
      comment: r.comment,
      vendorReply: r.vendorReply,
      createdAt: r.createdAt,
    }));

    return {
      id: l.id,
      vendorId: l.vendorId,
      panditProfileId: l.panditProfileId,
      category: l.category,
      poojaTag: l.poojaTag,
      slug: l.slug,
      sku: l.sku,
      masterCategories: l.masterCategoriesJson || [],
      tags: l.tagsJson || [],
      title: l.title,
      image: l.image,
      vendor: l.vendorName,
      location: l.location,
      rating: Number(l.ratingAvg || 4.8),
      ratingCount: revs.length,
      deliveryTime: l.deliveryTime,
      isGlobal: l.isGlobal,
      description: l.description,
      basePrice: l.basePrice,
      salePrice: l.salePrice,
      stockQty: l.stockQty,
      stockStatus: l.stockStatus,
      subscriptionCycle: l.subscriptionCycle,
      status: l.status,
      items: subItems,
      pujaTypes,
      sizes,
      reviews: revs,
    };
  });
}

// GET /api/bootstrap
router.get('/bootstrap', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();

    const [settingRows, catRows, aliasMap] = await Promise.all([
      db.select().from(settings),
      db.select().from(masterCategories).orderBy(asc(masterCategories.sortOrder)),
      getAliasMap(),
    ]);

    const settingsObj: Record<string, string> = {};
    for (const s of settingRows) settingsObj[s.key] = s.value;

    let recent: string[] = [];
    if (req.authUser) {
      const rsRows = await db
        .select()
        .from(recentSearches)
        .where(eq(recentSearches.userId, req.authUser.id))
        .orderBy(desc(recentSearches.createdAt))
        .limit(8);
      recent = Array.from(new Set(rsRows.map((r) => r.query))).slice(0, 5);
    }

    res.json({
      success: true,
      data: {
        settings: settingsObj,
        categories: catRows.map((c) => ({
          id: c.id,
          code: c.code,
          deity: c.deity,
          hinglish: c.hinglish,
          items: c.itemsJson || [],
        })),
        aliases: aliasMap,
        recentSearches: recent,
      },
    });
  } catch (error) {
    console.error('Bootstrap failed:', error);
    res.status(500).json({ success: false, error: 'डेटा लोड करने में समस्या आई।' });
  }
});

// GET /api/categories
router.get('/categories', async (_req, res) => {
  try {
    await ensureSeeded();
    const catRows = await db.select().from(masterCategories).orderBy(asc(masterCategories.sortOrder));
    res.json({
      success: true,
      data: catRows.map((c) => ({
        id: c.id,
        code: c.code,
        deity: c.deity,
        hinglish: c.hinglish,
        items: c.itemsJson || [],
      })),
    });
  } catch (error) {
    console.error('Fetch categories failed:', error);
    res.status(500).json({ success: false, error: 'श्रेणियां लोड नहीं हो सकीं।' });
  }
});

// GET /api/listings
router.get('/listings', async (req, res) => {
  try {
    await ensureSeeded();

    const category = String(req.query.category || 'ALL');
    const masterCat = String(req.query.masterCat || 'ALL');
    const poojaTag = String(req.query.poojaTag || 'ALL');
    const q = String(req.query.q || '').trim();
    const globalOnly = req.query.globalOnly === 'true';
    const topRated = req.query.topRated === 'true';
    const maxPrice = parseInt(String(req.query.maxPrice || '10000'), 10) || 10000;
    const sort = String(req.query.sort || 'recommended');
    const limit = Math.min(100, parseInt(String(req.query.limit || '100'), 10) || 100);
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);

    const [activeRows, aliasMap] = await Promise.all([
      db.select().from(listings).where(eq(listings.status, 'active')).orderBy(asc(listings.id)),
      getAliasMap(),
    ]);

    const hydrated = await hydrateListings(activeRows);
    const tokens = poojaTag !== 'ALL' ? [] : expandTokens(q, aliasMap);

    let filtered = hydrated.filter((item) => {
      const catMatch = category === 'ALL' || item.category === category;
      const masterMatch = masterCat === 'ALL' || item.masterCategories.includes(masterCat);
      const tagMatch = poojaTag === 'ALL' || item.poojaTag === poojaTag;
      const subNames = item.items.map((s) => s.name).join(' ');
      const tagNames = item.tags.join(' ');
      const haystack = `${item.title} ${item.vendor} ${item.description} ${item.poojaTag} ${subNames} ${tagNames}`;
      const keyMatch = poojaTag !== 'ALL' ? true : matchesTokens(haystack, tokens);
      const globalCheck = !globalOnly || item.isGlobal;
      const ratingCheck = !topRated || item.rating >= 4.8;
      const effectivePrice =
        item.category === 'pooja_box'
          ? item.items.reduce((acc, it) => acc + (it.checked ? it.price * it.qty : 0), 0)
          : item.basePrice;
      const priceCheck = effectivePrice <= maxPrice;

      return catMatch && masterMatch && tagMatch && keyMatch && globalCheck && ratingCheck && priceCheck;
    });

    const getEffPrice = (item: (typeof hydrated)[number]) =>
      item.category === 'pooja_box'
        ? item.items.reduce((acc, it) => acc + (it.checked ? it.price * it.qty : 0), 0)
        : item.basePrice;

    if (sort === 'price_low') {
      filtered.sort((a, b) => getEffPrice(a) - getEffPrice(b));
    } else if (sort === 'price_high') {
      filtered.sort((a, b) => getEffPrice(b) - getEffPrice(a));
    } else if (sort === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    }

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    res.json({
      success: true,
      data: {
        items: paged,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Fetch listings failed:', error);
    res.status(500).json({ success: false, error: 'पूजा किट लोड करने में त्रुटि आई।' });
  }
});

// GET /api/listings/:id
router.get('/listings/:id', async (req, res) => {
  try {
    await ensureSeeded();
    const id = parseInt(req.params.id, 10);
    const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'लिस्टिंग नहीं मिली।' });
    }
    const [hydrated] = await hydrateListings(rows);
    res.json({ success: true, data: hydrated });
  } catch (error) {
    console.error('Get listing failed:', error);
    res.status(500).json({ success: false, error: 'विवरण लोड नहीं हो सका।' });
  }
});

// GET/POST /api/recent-searches
router.get('/recent-searches', optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.authUser) {
      return res.json({ success: true, data: [] });
    }
    const rows = await db
      .select()
      .from(recentSearches)
      .where(eq(recentSearches.userId, req.authUser.id))
      .orderBy(desc(recentSearches.createdAt))
      .limit(10);
    res.json({ success: true, data: Array.from(new Set(rows.map((r) => r.query))).slice(0, 5) });
  } catch (error) {
    console.error('Get recent searches failed:', error);
    res.status(500).json({ success: false, error: 'हाल की खोज लोड नहीं हो सकी।' });
  }
});

router.post('/recent-searches', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const query = String(req.body.query || '').trim();
    if (!query || query.length < 2) {
      return res.json({ success: true, data: { saved: false } });
    }
    if (req.authUser) {
      await db.insert(recentSearches).values({
        userId: req.authUser.id,
        query: query.slice(0, 120),
      });
    }
    res.json({ success: true, data: { saved: true } });
  } catch (error) {
    console.error('Save recent search failed:', error);
    res.status(500).json({ success: false, error: 'खोज सेव नहीं हो सकी।' });
  }
});

// Reviews CRUD for a listing
async function recalculateListingRating(listingId: number) {
  const pubReviews = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.listingId, listingId), eq(reviews.status, 'published')));
  if (pubReviews.length === 0) {
    await db
      .update(listings)
      .set({ ratingAvg: 4.8, ratingCount: 0 })
      .where(eq(listings.id, listingId));
    return { ratingAvg: 4.8, ratingCount: 0 };
  }
  const avg = Number(
    (pubReviews.reduce((acc, r) => acc + r.rating, 0) / pubReviews.length).toFixed(1)
  );
  await db
    .update(listings)
    .set({ ratingAvg: avg, ratingCount: pubReviews.length })
    .where(eq(listings.id, listingId));
  return { ratingAvg: avg, ratingCount: pubReviews.length };
}

router.get('/listings/:id/reviews', async (req, res) => {
  try {
    const listingId = parseInt(req.params.id, 10);
    const rows = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.listingId, listingId), eq(reviews.status, 'published')))
      .orderBy(desc(reviews.createdAt));

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        author: r.authorName,
        rating: r.rating,
        comment: r.comment,
        vendorReply: r.vendorReply,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get reviews failed:', error);
    res.status(500).json({ success: false, error: 'समीक्षाएं लोड नहीं हो सकीं।' });
  }
});

router.post('/listings/:id/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listingId = parseInt(req.params.id, 10);
    const rating = Math.min(5, Math.max(1, parseInt(String(req.body.rating || '5'), 10)));
    const comment = String(req.body.comment || '').trim();
    const authorName = String(req.body.authorName || req.authUser!.name).trim();

    if (comment.length < 3) {
      return res.status(400).json({ success: false, error: 'कृपया कम से कम 3 अक्षरों की समीक्षा लिखें।' });
    }

    // One review per user per listing — upsert behavior
    const existing = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.listingId, listingId), eq(reviews.userId, req.authUser!.id)))
      .limit(1);

    let savedReview;
    if (existing.length > 0) {
      const [updated] = await db
        .update(reviews)
        .set({ rating, comment, authorName })
        .where(eq(reviews.id, existing[0].id))
        .returning();
      savedReview = updated;
    } else {
      const [inserted] = await db
        .insert(reviews)
        .values({
          listingId,
          userId: req.authUser!.id,
          authorName,
          rating,
          comment,
          status: 'published',
        })
        .returning();
      savedReview = inserted;
    }

    const stats = await recalculateListingRating(listingId);

    res.status(201).json({
      success: true,
      data: {
        review: {
          id: savedReview.id,
          userId: savedReview.userId,
          author: savedReview.authorName,
          rating: savedReview.rating,
          comment: savedReview.comment,
          vendorReply: savedReview.vendorReply,
          createdAt: savedReview.createdAt,
        },
        ...stats,
      },
    });
  } catch (error) {
    console.error('Post review failed:', error);
    res.status(500).json({ success: false, error: 'समीक्षा सबमिट नहीं हो सकी।' });
  }
});

router.delete('/listings/:id/reviews/:reviewId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listingId = parseInt(req.params.id, 10);
    const reviewId = parseInt(req.params.reviewId, 10);

    const existing = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'समीक्षा नहीं मिली।' });
    }
    if (existing[0].userId !== req.authUser!.id && !isSuperAdminRole(req.authUser!.role)) {
      return res.status(403).json({ success: false, error: 'आप केवल अपनी समीक्षा हटा सकते हैं।' });
    }

    await db.delete(reviews).where(eq(reviews.id, reviewId));
    const stats = await recalculateListingRating(listingId);

    res.json({ success: true, data: { deleted: true, ...stats } });
  } catch (error) {
    console.error('Delete review failed:', error);
    res.status(500).json({ success: false, error: 'समीक्षा हटाने में समस्या आई।' });
  }
});

export default router;
