import { Router } from 'express';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  auditLogs,
  customPujaLists,
  donations,
  listingItems,
  listings,
  listingVariants,
  notifications,
  orderItems,
  orders,
  orderStatusHistory,
  panditBookings,
  panditProfiles,
  payoutRequests,
  promoCodes,
  reviews,
  settings,
  users,
  vendors,
} from '../db/schema.ts';
import { AuthRequest, isSuperAdminRole, requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();

const STEP_LABELS = ['ऑर्डर प्राप्त', 'सामग्री पैकिंग / संकल्प', 'डिस्पैच / मार्ग में', 'पूर्ण / डिलीवर्ड'];

async function syncPanditListing(profile: typeof panditProfiles.$inferSelect) {
  const existing = await db
    .select()
    .from(listings)
    .where(eq(listings.panditProfileId, profile.id))
    .limit(1);

  const specs = Array.isArray(profile.specializationsJson) ? profile.specializationsJson : [];
  const langs = Array.isArray(profile.languagesJson) ? profile.languagesJson : [];
  const listingStatus = profile.status === 'approved' ? 'active' : 'paused';
  const tags = Array.from(
    new Set(['पंडित', 'वैदिक', profile.city, ...specs.slice(0, 4), ...langs.slice(0, 2)].filter(Boolean))
  );

  if (existing.length > 0) {
    const [updated] = await db
      .update(listings)
      .set({
        title: `${profile.fullName}${profile.title ? ` (${profile.title})` : ''}`,
        vendorName: `${profile.education || 'वैदिक विद्वान'} • ${profile.experienceYears} वर्ष अनुभव`,
        image:
          profile.photoUrl ||
          `https://placehold.co/320x240/fff3e0/dc3545?text=${encodeURIComponent(profile.fullName.slice(0, 14))}`,
        location: profile.city || 'Jamshedpur',
        description: profile.bio || `${profile.fullName} द्वारा वैदिक विधि-विधान से पूजन एवं अनुष्ठान।`,
        basePrice: profile.baseDakshina || 1100,
        isGlobal: Boolean(profile.onlinePujaAvailable),
        tagsJson: tags,
        status: listingStatus,
      })
      .where(eq(listings.id, existing[0].id))
      .returning();
    return updated;
  }

  const slug = `pandit-${profile.id}-${Date.now()}`;
  const [created] = await db
    .insert(listings)
    .values({
      panditProfileId: profile.id,
      vendorName: `${profile.education || 'वैदिक विद्वान'} • ${profile.experienceYears} वर्ष अनुभव`,
      category: 'pandit',
      poojaTag: 'satyanarayan',
      slug,
      title: `${profile.fullName}${profile.title ? ` (${profile.title})` : ''}`,
      image:
        profile.photoUrl ||
        `https://placehold.co/320x240/fff3e0/dc3545?text=${encodeURIComponent(profile.fullName.slice(0, 14))}`,
      location: profile.city || 'Jamshedpur',
      ratingAvg: profile.ratingAvg || 4.9,
      ratingCount: 0,
      deliveryTime: profile.onlinePujaAvailable ? 'घर पर / ऑनलाइन वीडियो पूजा' : 'निर्धारित मुहूर्त पर',
      isGlobal: Boolean(profile.onlinePujaAvailable),
      description: profile.bio || `${profile.fullName} द्वारा वैदिक विधि-विधान से पूजन एवं अनुष्ठान।`,
      basePrice: profile.baseDakshina || 1100,
      masterCategoriesJson: ['cat01', 'cat02', 'cat06', 'cat09'],
      tagsJson: tags,
      status: listingStatus,
    })
    .returning();

  const defaultServices =
    specs.length > 0
      ? specs.slice(0, 3).map((s, idx) => ({
          listingId: created.id,
          type: 'pooja_type',
          label: `${s} (₹${(profile.baseDakshina || 1100) + idx * 500})`,
          price: (profile.baseDakshina || 1100) + idx * 500,
          sortOrder: idx + 1,
        }))
      : [
          {
            listingId: created.id,
            type: 'pooja_type',
            label: `सत्यनारायण कथा (₹${profile.baseDakshina || 1100})`,
            price: profile.baseDakshina || 1100,
            sortOrder: 1,
          },
          {
            listingId: created.id,
            type: 'pooja_type',
            label: `गृह प्रवेश / हवन (₹${(profile.baseDakshina || 1100) + 1000})`,
            price: (profile.baseDakshina || 1100) + 1000,
            sortOrder: 2,
          },
        ];

  await db.insert(listingVariants).values(defaultServices);
  return created;
}

async function logAdminAction(
  adminUserId: number,
  action: string,
  targetType: string,
  targetId: string,
  metaJson?: Record<string, unknown>
) {
  try {
    await db.insert(auditLogs).values({
      adminUserId,
      action,
      targetType,
      targetId,
      metaJson: metaJson || {},
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}

// =========================================================================
// 1. VENDOR PANEL (WOOCOMMERCE-STYLE FULL STORE MANAGEMENT)
// =========================================================================

// Customer applies to become a vendor
router.post('/vendor/apply', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const shopName = String(req.body.shopName || '').trim();
    const location = String(req.body.location || 'Sakchi, Jamshedpur').trim();
    const phone = String(req.body.phone || user.phone || '').trim();
    const description = String(req.body.description || '').trim();
    const gstNumber = String(req.body.gstNumber || '').trim();
    const upiId = String(req.body.upiId || '').trim();

    if (shopName.length < 2 || !phone) {
      return res.status(400).json({ success: false, error: 'दुकान/संस्था का नाम और मोबाइल नंबर आवश्यक है।' });
    }

    const existing = await db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);
    if (existing.length > 0) {
      return res.json({ success: true, data: existing[0] });
    }

    const autoApprove = isSuperAdminRole(user.role) || user.role === 'vendor';
    const [created] = await db
      .insert(vendors)
      .values({
        userId: user.id,
        shopName,
        location,
        phone,
        description,
        gstNumber: gstNumber || '',
        upiId: upiId || '',
        isVerified: autoApprove,
        status: autoApprove ? 'approved' : 'pending',
      })
      .returning();

    await db.insert(notifications).values({
      userId: user.id,
      title: '🏪 वेंडर आवेदन प्राप्त हुआ',
      body: autoApprove
        ? `"${shopName}" को वेंडर के रूप में स्वीकृत किया गया है।`
        : `"${shopName}" का आवेदन सुपर एडमिन अनुमोदन हेतु भेज दिया गया है।`,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Vendor apply failed:', error);
    res.status(500).json({ success: false, error: 'वेंडर आवेदन सबमिट नहीं हो सका।' });
  }
});

// GET /api/vendor/dashboard
router.get('/vendor/dashboard', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const isAdmin = isSuperAdminRole(user.role);

    let [vendorProfile] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendorProfile && isAdmin) {
      [vendorProfile] = await db.select().from(vendors).orderBy(asc(vendors.id)).limit(1);
    }

    let vendorListings: Array<typeof listings.$inferSelect> = [];
    let relevantOrderIds: string[] = [];

    if (isAdmin) {
      vendorListings = await db.select().from(listings).orderBy(desc(listings.createdAt)).limit(100);
      const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(80);
      relevantOrderIds = recentOrders.map((o) => o.id);
    } else if (vendorProfile) {
      vendorListings = await db
        .select()
        .from(listings)
        .where(eq(listings.vendorId, vendorProfile.id))
        .orderBy(desc(listings.createdAt));

      const matchedItems = await db
        .select({ orderId: orderItems.orderId })
        .from(orderItems)
        .where(eq(orderItems.vendorId, vendorProfile.id));
      relevantOrderIds = Array.from(new Set(matchedItems.map((m) => m.orderId)));
    }

    const listingIds = vendorListings.map((l) => l.id);

    const [
      allSubItems,
      allVariants,
      vendorOrders,
      allOrderItems,
      customLists,
      vendorCoupons,
      vendorReviews,
      vendorPayouts,
    ] = await Promise.all([
      listingIds.length > 0
        ? db
            .select()
            .from(listingItems)
            .where(inArray(listingItems.listingId, listingIds))
            .orderBy(asc(listingItems.sortOrder))
        : Promise.resolve([]),
      listingIds.length > 0
        ? db
            .select()
            .from(listingVariants)
            .where(inArray(listingVariants.listingId, listingIds))
            .orderBy(asc(listingVariants.sortOrder))
        : Promise.resolve([]),
      relevantOrderIds.length > 0
        ? db
            .select()
            .from(orders)
            .where(inArray(orders.id, relevantOrderIds))
            .orderBy(desc(orders.createdAt))
        : Promise.resolve([]),
      relevantOrderIds.length > 0
        ? db.select().from(orderItems).where(inArray(orderItems.orderId, relevantOrderIds))
        : Promise.resolve([]),
      db.select().from(customPujaLists).orderBy(desc(customPujaLists.createdAt)).limit(30),
      vendorProfile
        ? isAdmin
          ? db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt)).limit(40)
          : db
              .select()
              .from(promoCodes)
              .where(eq(promoCodes.vendorId, vendorProfile.id))
              .orderBy(desc(promoCodes.createdAt))
        : Promise.resolve([]),
      listingIds.length > 0
        ? db
            .select()
            .from(reviews)
            .where(inArray(reviews.listingId, listingIds))
            .orderBy(desc(reviews.createdAt))
            .limit(40)
        : Promise.resolve([]),
      vendorProfile
        ? db
            .select()
            .from(payoutRequests)
            .where(
              isAdmin
                ? eq(payoutRequests.roleType, 'vendor')
                : eq(payoutRequests.vendorId, vendorProfile.id)
            )
            .orderBy(desc(payoutRequests.createdAt))
        : Promise.resolve([]),
    ]);

    const commissionPct = vendorProfile?.commissionRate ?? 8;
    const grossEarnings = vendorOrders
      .filter((o) => !o.cancelledAt)
      .reduce((acc, o) => acc + o.total, 0);
    const commission = Math.round((grossEarnings * commissionPct) / 100);
    const netEarnings = grossEarnings - commission;
    const paidOut = vendorPayouts
      .filter((p) => p.status === 'paid')
      .reduce((acc, p) => acc + p.amount, 0);
    const pendingPayouts = vendorPayouts
      .filter((p) => p.status === 'pending' || p.status === 'approved')
      .reduce((acc, p) => acc + p.amount, 0);

    const lowStockCount = vendorListings.filter(
      (l) => l.stockStatus === 'outofstock' || l.stockStatus === 'low_stock' || l.stockQty <= 5
    ).length;

    const listingTitleMap = new Map(vendorListings.map((l) => [l.id, l.title]));

    res.json({
      success: true,
      data: {
        vendorProfile: vendorProfile || null,
        stats: {
          totalOrders: vendorOrders.length,
          pendingOrders: vendorOrders.filter((o) => !o.cancelledAt && o.statusStep < 3).length,
          activeListings: vendorListings.filter((l) => l.status === 'active').length,
          totalListings: vendorListings.length,
          lowStockCount,
          pendingQuotes: customLists.filter((c) => c.status === 'submitted').length,
          grossEarnings,
          commissionRate: commissionPct,
          commission,
          netEarnings,
          paidOut,
          availableBalance: Math.max(0, netEarnings - paidOut - pendingPayouts),
        },
        listings: vendorListings.map((l) => ({
          ...l,
          items: allSubItems.filter((i) => i.listingId === l.id),
          variants: allVariants.filter((v) => v.listingId === l.id),
        })),
        orders: vendorOrders.map((o) => ({
          ...o,
          items: allOrderItems.filter((i) => i.orderId === o.id),
        })),
        customLists,
        coupons: vendorCoupons,
        reviews: vendorReviews.map((r) => ({
          ...r,
          listingTitle: listingTitleMap.get(r.listingId) || 'पूजा उत्पाद',
        })),
        payouts: vendorPayouts,
      },
    });
  } catch (error) {
    console.error('Vendor dashboard failed:', error);
    res.status(500).json({ success: false, error: 'वेंडर डैशबोर्ड लोड नहीं हो सका।' });
  }
});

// POST /api/vendor/listings (WooCommerce Full Product Create)
router.post('/vendor/listings', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const {
      category,
      shopName,
      location,
      price,
      salePrice,
      sku,
      stockQty,
      stockStatus,
      deliveryTime,
      title,
      imageUrl,
      isGlobal,
      boxItemsText,
      items,
      variants,
      description,
      poojaTag,
      masterCategories,
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ success: false, error: 'उत्पाद का शीर्षक और मूल्य आवश्यक है।' });
    }

    const [existingVendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    let vendorId = existingVendor?.id || null;
    const resolvedShopName = String(shopName || existingVendor?.shopName || `${user.name} पूजा भंडार`).trim();
    const resolvedLocation = String(location || existingVendor?.location || 'Sakchi, Jamshedpur').trim();

    if (!vendorId) {
      const [createdVendor] = await db
        .insert(vendors)
        .values({
          userId: user.id,
          shopName: resolvedShopName,
          location: resolvedLocation,
          phone: user.phone || '9876543210',
          isVerified: true,
          status: 'approved',
        })
        .returning({ id: vendors.id });
      vendorId = createdVendor.id;
    }

    const numPrice = Math.max(20, parseInt(String(price), 10) || 350);
    const numSalePrice = salePrice ? Math.max(10, parseInt(String(salePrice), 10)) : null;
    const numStock = Math.max(0, parseInt(String(stockQty ?? 50), 10) || 0);
    const computedStockStatus =
      stockStatus && ['instock', 'low_stock', 'outofstock'].includes(stockStatus)
        ? stockStatus
        : numStock === 0
        ? 'outofstock'
        : numStock <= 5
        ? 'low_stock'
        : 'instock';

    const cat = ['pooja_box', 'pandit', 'murti', 'photo'].includes(category) ? category : 'pooja_box';
    const slug = `listing-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const generatedSku =
      String(sku || '').trim().toUpperCase() ||
      `PJ-${cat.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [created] = await db
      .insert(listings)
      .values({
        vendorId,
        vendorName: resolvedShopName,
        category: cat,
        poojaTag: String(poojaTag || 'satyanarayan'),
        slug,
        sku: generatedSku,
        title: String(title).trim(),
        image:
          String(imageUrl || '').trim() ||
          'https://placehold.co/320x240/fff3e0/dc3545?text=Puja+Samagri',
        location: resolvedLocation,
        ratingAvg: 4.9,
        ratingCount: 0,
        deliveryTime:
          String(deliveryTime || '').trim() || (cat === 'pandit' ? 'निर्धारित तिथि पर' : '30-40 मि.'),
        isGlobal: Boolean(isGlobal),
        description:
          String(description || '').trim() || `${resolvedShopName} द्वारा प्रमाणित और शुद्ध सामग्री।`,
        basePrice: numPrice,
        salePrice: numSalePrice,
        stockQty: numStock,
        stockStatus: computedStockStatus,
        subscriptionCycle: 'मासिक (हर पूर्णिमा)',
        masterCategoriesJson:
          Array.isArray(masterCategories) && masterCategories.length > 0
            ? masterCategories
            : ['cat01', 'cat08', 'cat11'],
        tagsJson: ['नया', cat, resolvedLocation],
        status: 'active',
      })
      .returning();

    if (cat === 'pooja_box') {
      if (Array.isArray(items) && items.length > 0) {
        await db.insert(listingItems).values(
          items
            .filter((it: { name?: string }) => it && String(it.name || '').trim())
            .map((it: { name: string; unit?: string; price?: number; qty?: number }, idx: number) => ({
              listingId: created.id,
              name: String(it.name).trim(),
              unit: String(it.unit || '1 पैक').trim(),
              price: Math.max(10, parseInt(String(it.price || 50), 10) || 50),
              defaultQty: Math.max(1, parseInt(String(it.qty || 1), 10) || 1),
              isDefaultChecked: true,
              sortOrder: idx + 1,
            }))
        );
      } else {
        const rawItems = String(boxItemsText || 'रोली व चंदन, शुद्ध घी, कपूर व धूपबत्ती, कलावा')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const perItem = Math.max(20, Math.round(numPrice / Math.max(1, rawItems.length)));
        await db.insert(listingItems).values(
          rawItems.map((name, idx) => ({
            listingId: created.id,
            name,
            unit: '1 सेट',
            price: perItem,
            defaultQty: 1,
            isDefaultChecked: true,
            sortOrder: idx + 1,
          }))
        );
      }
    } else if (Array.isArray(variants) && variants.length > 0) {
      await db.insert(listingVariants).values(
        variants
          .filter((v: { label?: string }) => v && String(v.label || '').trim())
          .map((v: { label: string; price?: number }, idx: number) => ({
            listingId: created.id,
            type: cat === 'pandit' ? 'pooja_type' : 'size',
            label: String(v.label).trim(),
            price: Math.max(50, parseInt(String(v.price || numPrice), 10) || numPrice),
            sortOrder: idx + 1,
          }))
      );
    } else if (cat === 'pandit') {
      await db.insert(listingVariants).values([
        { listingId: created.id, type: 'pooja_type', label: `संपूर्ण वैदिक पूजा (₹${numPrice})`, price: numPrice, sortOrder: 1 },
        { listingId: created.id, type: 'pooja_type', label: `विशेष अनुष्ठान (₹${numPrice + 500})`, price: numPrice + 500, sortOrder: 2 },
      ]);
    } else {
      await db.insert(listingVariants).values([
        { listingId: created.id, type: 'size', label: `स्टैंडर्ड साइज (₹${numPrice})`, price: numPrice, sortOrder: 1 },
        { listingId: created.id, type: 'size', label: `बड़ा साइज (₹${numPrice + 300})`, price: numPrice + 300, sortOrder: 2 },
      ]);
    }

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Create vendor listing failed:', error);
    res.status(500).json({ success: false, error: 'उत्पाद लाइव करने में समस्या आई।' });
  }
});

// PATCH /api/vendor/listings/:id (Full WooCommerce Edit + Stock/Status toggle)
router.patch('/vendor/listings/:id', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = req.authUser!;
    const [existing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!existing) return res.status(404).json({ success: false, error: 'उत्पाद नहीं मिला।' });

    if (!isSuperAdminRole(user.role)) {
      const [vp] = await db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);
      if (!vp || existing.vendorId !== vp.id) {
        return res.status(403).json({ success: false, error: 'आप केवल अपने स्टोर के उत्पाद संपादित कर सकते हैं।' });
      }
    }

    const updatePayload: Partial<typeof listings.$inferInsert> = {};
    if (req.body.status && ['active', 'paused'].includes(req.body.status)) {
      updatePayload.status = req.body.status;
    }
    if (req.body.title !== undefined) updatePayload.title = String(req.body.title).trim();
    if (req.body.description !== undefined) updatePayload.description = String(req.body.description).trim();
    if (req.body.image !== undefined) updatePayload.image = String(req.body.image).trim();
    if (req.body.sku !== undefined) updatePayload.sku = String(req.body.sku).trim().toUpperCase();
    if (req.body.deliveryTime !== undefined) updatePayload.deliveryTime = String(req.body.deliveryTime).trim();
    if (req.body.isGlobal !== undefined) updatePayload.isGlobal = Boolean(req.body.isGlobal);
    if (req.body.basePrice !== undefined) {
      updatePayload.basePrice = Math.max(20, parseInt(String(req.body.basePrice), 10) || existing.basePrice);
    }
    if (req.body.salePrice !== undefined) {
      updatePayload.salePrice = req.body.salePrice ? Math.max(10, parseInt(String(req.body.salePrice), 10)) : null;
    }
    if (req.body.stockQty !== undefined) {
      const sq = Math.max(0, parseInt(String(req.body.stockQty), 10) || 0);
      updatePayload.stockQty = sq;
      if (!req.body.stockStatus) {
        updatePayload.stockStatus = sq === 0 ? 'outofstock' : sq <= 5 ? 'low_stock' : 'instock';
      }
    }
    if (req.body.stockStatus && ['instock', 'low_stock', 'outofstock'].includes(req.body.stockStatus)) {
      updatePayload.stockStatus = req.body.stockStatus;
    }

    const [updated] = await db
      .update(listings)
      .set(updatePayload)
      .where(eq(listings.id, id))
      .returning();

    if (Array.isArray(req.body.items) && existing.category === 'pooja_box') {
      await db.delete(listingItems).where(eq(listingItems.listingId, id));
      const cleanItems = req.body.items.filter((it: { name?: string }) => it && String(it.name || '').trim());
      if (cleanItems.length > 0) {
        await db.insert(listingItems).values(
          cleanItems.map((it: { name: string; unit?: string; price?: number; qty?: number }, idx: number) => ({
            listingId: id,
            name: String(it.name).trim(),
            unit: String(it.unit || '1 पैक').trim(),
            price: Math.max(10, parseInt(String(it.price || 50), 10) || 50),
            defaultQty: Math.max(1, parseInt(String(it.qty || 1), 10) || 1),
            isDefaultChecked: true,
            sortOrder: idx + 1,
          }))
        );
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update vendor listing failed:', error);
    res.status(500).json({ success: false, error: 'उत्पाद अपडेट नहीं हो सका।' });
  }
});

// DELETE /api/vendor/listings/:id
router.delete('/vendor/listings/:id', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = req.authUser!;
    const [existing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!existing) return res.status(404).json({ success: false, error: 'उत्पाद नहीं मिला।' });

    if (!isSuperAdminRole(user.role)) {
      const [vp] = await db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);
      if (!vp || existing.vendorId !== vp.id) {
        return res.status(403).json({ success: false, error: 'आप केवल अपने स्टोर के उत्पाद हटा सकते हैं।' });
      }
    }

    await db.delete(listings).where(eq(listings.id, id));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Delete vendor listing failed:', error);
    res.status(500).json({ success: false, error: 'उत्पाद हटाने में समस्या आई।' });
  }
});

// PATCH /api/vendor/orders/:id/step
router.patch('/vendor/orders/:id/step', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const orderId = req.params.id;
    const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!ord) return res.status(404).json({ success: false, error: 'ऑर्डर नहीं मिला।' });

    const nextStep =
      req.body.step !== undefined
        ? Math.min(3, Math.max(0, parseInt(String(req.body.step), 10)))
        : Math.min(3, ord.statusStep + 1);

    const updateFields: Partial<typeof orders.$inferInsert> = {
      statusStep: nextStep,
      updatedAt: new Date(),
    };
    if (req.body.paymentStatus && ['pending', 'cod_pending', 'confirmed', 'paid', 'quote_pending'].includes(req.body.paymentStatus)) {
      updateFields.paymentStatus = req.body.paymentStatus;
    }

    const [updated] = await db
      .update(orders)
      .set(updateFields)
      .where(eq(orders.id, orderId))
      .returning();

    const stepLabel = STEP_LABELS[nextStep] || 'अपडेट';
    await db.insert(orderStatusHistory).values({
      orderId,
      step: nextStep,
      note: `स्टेटस अपडेट: ${stepLabel}`,
      changedByUserId: req.authUser!.id,
    });

    if (ord.userId) {
      await db.insert(notifications).values({
        userId: ord.userId,
        title: `📦 ऑर्डर #${orderId} अपडेट`,
        body: `आपका ऑर्डर अब "${stepLabel}" चरण में है।`,
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Advance order step failed:', error);
    res.status(500).json({ success: false, error: 'ऑर्डर स्टेटस अपडेट विफल।' });
  }
});

// PATCH /api/vendor/custom-lists/:id/quote
router.patch('/vendor/custom-lists/:id/quote', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const quotedPrice = Math.max(100, parseInt(String(req.body.quotedPrice || '299'), 10));

    const [updated] = await db
      .update(customPujaLists)
      .set({ quotedPrice, status: 'quoted' })
      .where(eq(customPujaLists.id, id))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: 'कस्टम लिस्ट नहीं मिली।' });

    if (updated.orderId) {
      await db
        .update(orders)
        .set({ subtotal: quotedPrice, total: quotedPrice, updatedAt: new Date() })
        .where(eq(orders.id, updated.orderId));
    }

    if (updated.userId) {
      await db.insert(notifications).values({
        userId: updated.userId,
        title: `💰 कस्टम पूजा लिस्ट कोटेशन`,
        body: `"${updated.pujaName}" के लिए वेंडर ने ₹${quotedPrice} का अंतिम मूल्य भेजा है।`,
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Quote custom list failed:', error);
    res.status(500).json({ success: false, error: 'कोटेशन अपडेट विफल।' });
  }
});

// Vendor Store Coupons CRUD
router.post('/vendor/coupons', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const [vp] = await db.select().from(vendors).where(eq(vendors.userId, req.authUser!.id)).limit(1);
    const code = String(req.body.code || '').trim().toUpperCase();
    const type = req.body.type === 'percent' ? 'percent' : 'flat';
    const value = Math.max(1, parseInt(String(req.body.value || '10'), 10));
    const minOrder = Math.max(0, parseInt(String(req.body.minOrder || '0'), 10));
    const maxDiscount = req.body.maxDiscount ? parseInt(String(req.body.maxDiscount), 10) : null;

    if (code.length < 3) {
      return res.status(400).json({ success: false, error: 'कूपन कोड कम से कम 3 अक्षरों का होना चाहिए।' });
    }

    const [created] = await db
      .insert(promoCodes)
      .values({
        vendorId: vp?.id || null,
        code,
        type,
        value,
        minOrder,
        maxDiscount,
        isActive: true,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Vendor create coupon failed:', error);
    res.status(400).json({ success: false, error: 'कूपन बनाने में त्रुटि (संभवतः कोड पहले से मौजूद है)।' });
  }
});

router.patch('/vendor/coupons/:id', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [updated] = await db
      .update(promoCodes)
      .set({ isActive: Boolean(req.body.isActive) })
      .where(eq(promoCodes.id, id))
      .returning();
    if (!updated) return res.status(404).json({ success: false, error: 'कूपन नहीं मिला।' });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Vendor toggle coupon failed:', error);
    res.status(500).json({ success: false, error: 'कूपन अपडेट विफल।' });
  }
});

router.delete('/vendor/coupons/:id', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(promoCodes).where(eq(promoCodes.id, id));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Vendor delete coupon failed:', error);
    res.status(500).json({ success: false, error: 'कूपन हटाने में समस्या आई।' });
  }
});

// Vendor Review Reply
router.patch('/vendor/reviews/:id/reply', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reply = String(req.body.reply || '').trim();
    if (reply.length < 2) {
      return res.status(400).json({ success: false, error: 'कृपया उत्तर लिखें।' });
    }
    const [updated] = await db
      .update(reviews)
      .set({ vendorReply: reply })
      .where(eq(reviews.id, id))
      .returning();
    if (!updated) return res.status(404).json({ success: false, error: 'समीक्षा नहीं मिली।' });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Vendor review reply failed:', error);
    res.status(500).json({ success: false, error: 'उत्तर सेव नहीं हो सका।' });
  }
});

// Vendor WooCommerce Store Settings
router.patch('/vendor/settings', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    let [vp] = await db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);

    const payload = {
      shopName: String(req.body.shopName || vp?.shopName || `${user.name} पूजा भंडार`).trim(),
      location: String(req.body.location || vp?.location || 'Sakchi, Jamshedpur').trim(),
      phone: String(req.body.phone || vp?.phone || user.phone || '9876543210').trim(),
      description: String(req.body.description ?? vp?.description ?? '').trim(),
      gstNumber: req.body.gstNumber ? String(req.body.gstNumber).trim().toUpperCase() : '',
      upiId: req.body.upiId ? String(req.body.upiId).trim() : '',
      bankAccount: req.body.bankAccount ? String(req.body.bankAccount).trim() : '',
      shippingFee: Math.max(0, parseInt(String(req.body.shippingFee ?? vp?.shippingFee ?? 0), 10) || 0),
      freeShippingAbove: Math.max(0, parseInt(String(req.body.freeShippingAbove ?? vp?.freeShippingAbove ?? 499), 10) || 499),
      codEnabled: req.body.codEnabled !== undefined ? Boolean(req.body.codEnabled) : (vp?.codEnabled ?? true),
    };

    if (!vp) {
      const [created] = await db
        .insert(vendors)
        .values({
          userId: user.id,
          ...payload,
          isVerified: isSuperAdminRole(user.role),
          status: isSuperAdminRole(user.role) ? 'approved' : 'pending',
        })
        .returning();
      vp = created;
    } else {
      const [updated] = await db
        .update(vendors)
        .set(payload)
        .where(eq(vendors.id, vp.id))
        .returning();
      vp = updated;

      // Sync vendorName across their listings
      await db
        .update(listings)
        .set({ vendorName: vp.shopName, location: vp.location })
        .where(eq(listings.vendorId, vp.id));
    }

    res.json({ success: true, data: vp });
  } catch (error) {
    console.error('Vendor settings update failed:', error);
    res.status(500).json({ success: false, error: 'स्टोर सेटिंग्स सेव नहीं हो सकीं।' });
  }
});

// Vendor Payout Request
router.post('/vendor/payouts', requireAuth, requireRole('vendor', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const [vp] = await db.select().from(vendors).where(eq(vendors.userId, req.authUser!.id)).limit(1);
    const amount = Math.max(100, parseInt(String(req.body.amount || '0'), 10) || 0);
    const upiOrBank = String(req.body.upiOrBank || vp?.upiId || vp?.bankAccount || '').trim();

    if (amount < 100 || !upiOrBank) {
      return res.status(400).json({ success: false, error: 'न्यूनतम ₹100 राशि और UPI/बैंक विवरण आवश्यक है।' });
    }

    const [created] = await db
      .insert(payoutRequests)
      .values({
        userId: req.authUser!.id,
        roleType: 'vendor',
        vendorId: vp?.id || null,
        amount,
        upiOrBank,
        status: 'pending',
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Vendor payout request failed:', error);
    res.status(500).json({ success: false, error: 'पेआउट अनुरोध सबमिट नहीं हो सका।' });
  }
});

// =========================================================================
// 2. PANDIT JI PANEL (LISTING PROFILE + SERVICES + YAJMAN BOOKINGS)
// =========================================================================

// Any user can apply to become a Pandit Ji
router.post('/pandit/apply', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const existing = await db.select().from(panditProfiles).where(eq(panditProfiles.userId, user.id)).limit(1);
    if (existing.length > 0) {
      return res.json({ success: true, data: existing[0] });
    }

    const fullName = String(req.body.fullName || user.name).trim();
    const city = String(req.body.city || 'Jamshedpur').trim();
    const phone = String(req.body.phone || user.phone || '').trim();
    const education = String(req.body.education || 'शास्त्री / वैदिक कर्मकांड आचार्य').trim();
    const experienceYears = Math.max(1, parseInt(String(req.body.experienceYears || '5'), 10) || 5);
    const autoApprove = isSuperAdminRole(user.role) || user.role === 'pandit';

    const [created] = await db
      .insert(panditProfiles)
      .values({
        userId: user.id,
        fullName,
        title: String(req.body.title || 'वैदिक कर्मकांड विद्वान').trim(),
        phone,
        city,
        serviceAreasJson: [city],
        experienceYears,
        education,
        languagesJson: ['हिन्दी', 'संस्कृत'],
        specializationsJson: ['सत्यनारायण कथा', 'गृह प्रवेश', 'रुद्राभिषेक'],
        bio: String(req.body.bio || `${fullName} — वैदिक मंत्रोच्चार के साथ संपूर्ण पूजन सेवा।`).trim(),
        photoUrl: `https://placehold.co/320x240/fff3e0/dc3545?text=${encodeURIComponent(fullName.slice(0, 14))}`,
        baseDakshina: Math.max(500, parseInt(String(req.body.baseDakshina || '1100'), 10) || 1100),
        isVerified: autoApprove,
        status: autoApprove ? 'approved' : 'pending',
      })
      .returning();

    if (autoApprove) {
      await syncPanditListing(created);
    }

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Pandit apply failed:', error);
    res.status(500).json({ success: false, error: 'पंडित पंजीकरण विफल रहा।' });
  }
});

// GET /api/pandit/dashboard
router.get('/pandit/dashboard', requireAuth, requireRole('pandit', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const isAdmin = isSuperAdminRole(user.role);

    let [profile] = await db
      .select()
      .from(panditProfiles)
      .where(eq(panditProfiles.userId, user.id))
      .limit(1);

    if (!profile && isAdmin) {
      [profile] = await db.select().from(panditProfiles).orderBy(asc(panditProfiles.id)).limit(1);
    }

    if (!profile) {
      // Auto-bootstrap profile for a user with pandit role
      const [created] = await db
        .insert(panditProfiles)
        .values({
          userId: user.id,
          fullName: user.name,
          title: 'वैदिक कर्मकांड विद्वान',
          phone: user.phone || '9876543210',
          city: 'Jamshedpur',
          serviceAreasJson: ['Sakchi', 'Bistupur', 'Kadma'],
          experienceYears: 5,
          education: 'काशी विश्वनाथ वैदिक परंपरा',
          languagesJson: ['हिन्दी', 'संस्कृत'],
          specializationsJson: ['सत्यनारायण कथा', 'गृह प्रवेश', 'रुद्राभिषेक'],
          bio: `${user.name} — शुद्ध वैदिक विधि से गृह प्रवेश, सत्यनारायण कथा एवं अनुष्ठान।`,
          photoUrl: `https://placehold.co/320x240/fff3e0/dc3545?text=${encodeURIComponent(user.name.slice(0, 14))}`,
          baseDakshina: 1100,
          isVerified: true,
          status: 'approved',
        })
        .returning();
      profile = created;
      await syncPanditListing(profile);
    }

    const [linkedListing] = await db
      .select()
      .from(listings)
      .where(eq(listings.panditProfileId, profile.id))
      .limit(1);

    const services = linkedListing
      ? await db
          .select()
          .from(listingVariants)
          .where(eq(listingVariants.listingId, linkedListing.id))
          .orderBy(asc(listingVariants.sortOrder))
      : [];

    const bookingFilter = linkedListing
      ? or(eq(panditBookings.panditProfileId, profile.id), eq(panditBookings.listingId, linkedListing.id))
      : eq(panditBookings.panditProfileId, profile.id);

    const [bookings, panditReviews, payouts] = await Promise.all([
      isAdmin
        ? db.select().from(panditBookings).orderBy(desc(panditBookings.createdAt)).limit(60)
        : db.select().from(panditBookings).where(bookingFilter).orderBy(desc(panditBookings.createdAt)),
      linkedListing
        ? db
            .select()
            .from(reviews)
            .where(eq(reviews.listingId, linkedListing.id))
            .orderBy(desc(reviews.createdAt))
        : Promise.resolve([]),
      db
        .select()
        .from(payoutRequests)
        .where(
          isAdmin
            ? eq(payoutRequests.roleType, 'pandit')
            : eq(payoutRequests.panditProfileId, profile.id)
        )
        .orderBy(desc(payoutRequests.createdAt)),
    ]);

    const grossDakshina = bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((acc, b) => acc + (b.dakshinaAmount || profile.baseDakshina || 1100), 0);
    const platformFee = Math.round(grossDakshina * 0.05);
    const netDakshina = grossDakshina - platformFee;
    const paidOut = payouts.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount, 0);
    const pendingOut = payouts
      .filter((p) => p.status === 'pending' || p.status === 'approved')
      .reduce((a, p) => a + p.amount, 0);

    res.json({
      success: true,
      data: {
        profile,
        linkedListing: linkedListing || null,
        services,
        bookings,
        reviews: panditReviews,
        payouts,
        stats: {
          totalBookings: bookings.length,
          upcomingBookings: bookings.filter((b) => b.status === 'confirmed' || b.status === 'rescheduled').length,
          completedBookings: bookings.filter((b) => b.status === 'completed').length,
          totalCompletedPujas: profile.completedPujas,
          servicesCount: services.length,
          grossDakshina,
          netDakshina,
          availableBalance: Math.max(0, netDakshina - paidOut - pendingOut),
          ratingAvg: profile.ratingAvg,
        },
      },
    });
  } catch (error) {
    console.error('Pandit dashboard failed:', error);
    res.status(500).json({ success: false, error: 'पंडित जी पैनल लोड नहीं हो सका।' });
  }
});

// PATCH /api/pandit/profile (Full Listing Profile Editor + auto-syncs storefront listing!)
router.patch('/pandit/profile', requireAuth, requireRole('pandit', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    let [profile] = await db
      .select()
      .from(panditProfiles)
      .where(eq(panditProfiles.userId, user.id))
      .limit(1);

    if (!profile && isSuperAdminRole(user.role) && req.body.profileId) {
      [profile] = await db
        .select()
        .from(panditProfiles)
        .where(eq(panditProfiles.id, parseInt(String(req.body.profileId), 10)))
        .limit(1);
    }

    if (!profile) {
      return res.status(404).json({ success: false, error: 'पंडित प्रोफ़ाइल नहीं मिला।' });
    }

    const toArray = (v: unknown, fallback: string[]) => {
      if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
      if (typeof v === 'string') {
        return v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return fallback;
    };

    const updatePayload: Partial<typeof panditProfiles.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (req.body.fullName !== undefined) updatePayload.fullName = String(req.body.fullName).trim();
    if (req.body.title !== undefined) updatePayload.title = String(req.body.title).trim();
    if (req.body.phone !== undefined) updatePayload.phone = String(req.body.phone).trim();
    if (req.body.city !== undefined) updatePayload.city = String(req.body.city).trim();
    if (req.body.education !== undefined) updatePayload.education = String(req.body.education).trim();
    if (req.body.bio !== undefined) updatePayload.bio = String(req.body.bio).trim();
    if (req.body.photoUrl !== undefined) updatePayload.photoUrl = String(req.body.photoUrl).trim();
    if (req.body.upiId !== undefined) updatePayload.upiId = String(req.body.upiId).trim();
    if (req.body.experienceYears !== undefined) {
      updatePayload.experienceYears = Math.max(0, Math.min(70, parseInt(String(req.body.experienceYears), 10) || 1));
    }
    if (req.body.baseDakshina !== undefined) {
      updatePayload.baseDakshina = Math.max(251, parseInt(String(req.body.baseDakshina), 10) || 1100);
    }
    if (req.body.onlinePujaAvailable !== undefined) {
      updatePayload.onlinePujaAvailable = Boolean(req.body.onlinePujaAvailable);
    }
    if (req.body.travelAvailable !== undefined) {
      updatePayload.travelAvailable = Boolean(req.body.travelAvailable);
    }
    if (req.body.availabilityStatus && ['available', 'busy', 'on_leave'].includes(req.body.availabilityStatus)) {
      updatePayload.availabilityStatus = req.body.availabilityStatus;
    }
    if (req.body.serviceAreasJson !== undefined) {
      updatePayload.serviceAreasJson = toArray(req.body.serviceAreasJson, profile.serviceAreasJson || []);
    }
    if (req.body.languagesJson !== undefined) {
      updatePayload.languagesJson = toArray(req.body.languagesJson, profile.languagesJson || []);
    }
    if (req.body.specializationsJson !== undefined) {
      updatePayload.specializationsJson = toArray(req.body.specializationsJson, profile.specializationsJson || []);
    }
    if (req.body.availableDaysJson !== undefined) {
      updatePayload.availableDaysJson = toArray(req.body.availableDaysJson, profile.availableDaysJson || []);
    }
    if (req.body.blockedDatesJson !== undefined) {
      updatePayload.blockedDatesJson = toArray(req.body.blockedDatesJson, profile.blockedDatesJson || []);
    }

    const [updated] = await db
      .update(panditProfiles)
      .set(updatePayload)
      .where(eq(panditProfiles.id, profile.id))
      .returning();

    const syncedListing = await syncPanditListing(updated);

    res.json({ success: true, data: { profile: updated, linkedListing: syncedListing } });
  } catch (error) {
    console.error('Pandit profile update failed:', error);
    res.status(500).json({ success: false, error: 'पंडित प्रोफ़ाइल अपडेट नहीं हो सका।' });
  }
});

// Pandit Puja Services & Dakshina Packages CRUD (listing_variants)
router.post('/pandit/services', requireAuth, requireRole('pandit', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const [profile] = await db
      .select()
      .from(panditProfiles)
      .where(eq(panditProfiles.userId, user.id))
      .limit(1);
    const targetProfile =
      profile ||
      (isSuperAdminRole(user.role)
        ? (await db.select().from(panditProfiles).orderBy(asc(panditProfiles.id)).limit(1))[0]
        : null);

    if (!targetProfile) {
      return res.status(404).json({ success: false, error: 'पंडित प्रोफ़ाइल नहीं मिला।' });
    }

    const listing = await syncPanditListing(targetProfile);
    const name = String(req.body.label || '').trim();
    const price = Math.max(251, parseInt(String(req.body.price || '1100'), 10) || 1100);
    if (name.length < 2) {
      return res.status(400).json({ success: false, error: 'कृपया पूजा सेवा का नाम लिखें।' });
    }

    const label = name.includes('₹') ? name : `${name} (₹${price})`;
    const [created] = await db
      .insert(listingVariants)
      .values({
        listingId: listing.id,
        type: 'pooja_type',
        label,
        price,
        sortOrder: 10,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Pandit add service failed:', error);
    res.status(500).json({ success: false, error: 'पूजा सेवा जोड़ने में समस्या आई।' });
  }
});

router.delete('/pandit/services/:variantId', requireAuth, requireRole('pandit', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const variantId = parseInt(req.params.variantId, 10);
    await db.delete(listingVariants).where(eq(listingVariants.id, variantId));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Pandit delete service failed:', error);
    res.status(500).json({ success: false, error: 'पूजा सेवा हटाई नहीं जा सकी।' });
  }
});

// PATCH /api/pandit/bookings/:id (Accept/Complete/Reschedule/Cancel + Sankalp Notes)
router.patch('/pandit/bookings/:id', requireAuth, requireRole('pandit', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [booking] = await db.select().from(panditBookings).where(eq(panditBookings.id, id)).limit(1);
    if (!booking) return res.status(404).json({ success: false, error: 'बुकिंग नहीं मिली।' });

    const payload: Partial<typeof panditBookings.$inferInsert> = {};
    if (req.body.status && ['confirmed', 'completed', 'rescheduled', 'cancelled'].includes(req.body.status)) {
      payload.status = req.body.status;
    }
    if (req.body.pujaDate !== undefined) payload.pujaDate = String(req.body.pujaDate).trim();
    if (req.body.muhurat !== undefined) payload.muhurat = String(req.body.muhurat).trim();
    if (req.body.panditNotes !== undefined) payload.panditNotes = String(req.body.panditNotes).trim();

    const [updated] = await db
      .update(panditBookings)
      .set(payload)
      .where(eq(panditBookings.id, id))
      .returning();

    // If marked completed, update completedPujas counter + advance parent order to step 3
    if (payload.status === 'completed' && booking.status !== 'completed') {
      if (booking.panditProfileId) {
        const [p] = await db
          .select()
          .from(panditProfiles)
          .where(eq(panditProfiles.id, booking.panditProfileId))
          .limit(1);
        if (p) {
          await db
            .update(panditProfiles)
            .set({ completedPujas: p.completedPujas + 1 })
            .where(eq(panditProfiles.id, p.id));
        }
      }
      await db
        .update(orders)
        .set({ statusStep: 3, updatedAt: new Date() })
        .where(eq(orders.id, booking.orderId));
    }

    // Notify Yajman customer
    const [parentOrder] = await db.select().from(orders).where(eq(orders.id, booking.orderId)).limit(1);
    if (parentOrder?.userId) {
      const statusText =
        payload.status === 'completed'
          ? 'संपन्न हो गई है 🙏'
          : payload.status === 'rescheduled'
          ? `नई तिथि ${updated.pujaDate} (${updated.muhurat}) हेतु पुनर्निर्धारित की गई है`
          : payload.status === 'cancelled'
          ? 'रद्द कर दी गई है'
          : 'कन्फर्म कर दी गई है';
      await db.insert(notifications).values({
        userId: parentOrder.userId,
        title: `🙏 पंडित बुकिंग #${booking.orderId} अपडेट`,
        body: `आपकी ${booking.pujaType} बुकिंग ${statusText}${updated.panditNotes ? ` | संदेश: ${updated.panditNotes}` : ''}`,
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update pandit booking failed:', error);
    res.status(500).json({ success: false, error: 'बुकिंग अपडेट विफल रहा।' });
  }
});

// Pandit Dakshina Payout Request
router.post('/pandit/payouts', requireAuth, requireRole('pandit', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const [profile] = await db
      .select()
      .from(panditProfiles)
      .where(eq(panditProfiles.userId, req.authUser!.id))
      .limit(1);
    const amount = Math.max(100, parseInt(String(req.body.amount || '0'), 10) || 0);
    const upiOrBank = String(req.body.upiOrBank || profile?.upiId || '').trim();

    if (amount < 100 || !upiOrBank) {
      return res.status(400).json({ success: false, error: 'न्यूनतम ₹100 राशि और UPI/बैंक विवरण आवश्यक है।' });
    }

    const [created] = await db
      .insert(payoutRequests)
      .values({
        userId: req.authUser!.id,
        roleType: 'pandit',
        panditProfileId: profile?.id || null,
        amount,
        upiOrBank,
        status: 'pending',
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Pandit payout request failed:', error);
    res.status(500).json({ success: false, error: 'दक्षिणा निकासी अनुरोध विफल रहा।' });
  }
});

// =========================================================================
// 3. SUPER ADMIN MASTER CONTROL PANEL (MANAGE EVERYTHING)
// =========================================================================

router.get('/admin/dashboard', requireAuth, requireRole('super_admin'), async (_req: AuthRequest, res) => {
  try {
    const [
      allUsers,
      allVendors,
      allPandits,
      allListings,
      allOrders,
      allOrderItems,
      allBookings,
      allPromos,
      allPayouts,
      allSettings,
      allDonations,
      allCustomLists,
      recentAudits,
    ] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)).limit(200),
      db.select().from(vendors).orderBy(desc(vendors.createdAt)).limit(200),
      db.select().from(panditProfiles).orderBy(desc(panditProfiles.createdAt)).limit(200),
      db.select().from(listings).orderBy(desc(listings.createdAt)).limit(200),
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(200),
      db.select().from(orderItems),
      db.select().from(panditBookings).orderBy(desc(panditBookings.createdAt)).limit(100),
      db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt)),
      db.select().from(payoutRequests).orderBy(desc(payoutRequests.createdAt)).limit(100),
      db.select().from(settings),
      db.select().from(donations).orderBy(desc(donations.createdAt)).limit(100),
      db.select().from(customPujaLists).orderBy(desc(customPujaLists.createdAt)).limit(80),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(60),
    ]);

    const totalRevenue = allOrders
      .filter((o) => !o.cancelledAt)
      .reduce((acc, o) => acc + o.total, 0);
    const estCommission = Math.round(totalRevenue * 0.08);
    const totalDonationsAmt = allDonations.reduce((acc, d) => acc + d.amount, 0);

    const settingsObj: Record<string, string> = {};
    for (const s of allSettings) settingsObj[s.key] = s.value;

    const userMap = new Map(allUsers.map((u) => [u.id, { name: u.name, email: u.email }]));

    res.json({
      success: true,
      data: {
        stats: {
          usersCount: allUsers.length,
          customersCount: allUsers.filter((u) => u.role === 'customer').length,
          vendorsCount: allVendors.length,
          pendingVendors: allVendors.filter((v) => v.status === 'pending').length,
          panditsCount: allPandits.length,
          pendingPandits: allPandits.filter((p) => p.status === 'pending').length,
          listingsCount: allListings.length,
          activeListings: allListings.filter((l) => l.status === 'active').length,
          ordersCount: allOrders.length,
          bookingsCount: allBookings.length,
          pendingPayoutsCount: allPayouts.filter((p) => p.status === 'pending').length,
          pendingPayoutsAmt: allPayouts
            .filter((p) => p.status === 'pending')
            .reduce((acc, p) => acc + p.amount, 0),
          totalRevenue,
          estCommission,
          donationsCount: allDonations.length,
          totalDonationsAmt,
        },
        users: allUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status,
          emailVerifiedAt: u.emailVerifiedAt,
          createdAt: u.createdAt,
        })),
        vendors: allVendors,
        pandits: allPandits,
        listings: allListings,
        orders: allOrders.map((o) => ({
          ...o,
          items: allOrderItems.filter((i) => i.orderId === o.id),
        })),
        bookings: allBookings,
        promos: allPromos,
        payouts: allPayouts.map((p) => ({
          ...p,
          userName: userMap.get(p.userId)?.name || 'सदस्य',
          userEmail: userMap.get(p.userId)?.email || '',
        })),
        settings: settingsObj,
        donations: allDonations,
        customLists: allCustomLists,
        auditLogs: recentAudits,
      },
    });
  } catch (error) {
    console.error('Super Admin dashboard failed:', error);
    res.status(500).json({ success: false, error: 'सुपर एडमिन डैशबोर्ड लोड नहीं हो सका।' });
  }
});

// Super Admin: Update user role or status
router.patch('/admin/users/:id', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const payload: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (req.body.role && ['customer', 'vendor', 'pandit', 'super_admin', 'admin'].includes(req.body.role)) {
      payload.role = req.body.role === 'admin' ? 'super_admin' : req.body.role;
    }
    if (req.body.status && ['active', 'blocked'].includes(req.body.status)) {
      payload.status = req.body.status;
    }

    const [updated] = await db.update(users).set(payload).where(eq(users.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'उपयोगकर्ता नहीं मिला।' });

    await logAdminAction(req.authUser!.id, 'update_user', 'user', String(id), payload);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin update user failed:', error);
    res.status(500).json({ success: false, error: 'उपयोगकर्ता अपडेट विफल।' });
  }
});

// Super Admin: Approve / Reject / Update Commission for Vendor
router.patch('/admin/vendors/:id', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updateFields: Partial<typeof vendors.$inferInsert> = {};

    if (req.body.status) {
      const status = String(req.body.status);
      if (!['approved', 'rejected', 'pending', 'suspended'].includes(status)) {
        return res.status(400).json({ success: false, error: 'अमान्य स्थिति।' });
      }
      updateFields.status = status;
      updateFields.isVerified = status === 'approved';
    }
    if (req.body.commissionRate !== undefined) {
      updateFields.commissionRate = Math.max(0, Math.min(40, parseInt(String(req.body.commissionRate), 10) || 8));
    }

    const [updated] = await db
      .update(vendors)
      .set(updateFields)
      .where(eq(vendors.id, id))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: 'वेंडर नहीं मिला।' });

    if (updateFields.status === 'approved' && updated.userId) {
      await db
        .update(users)
        .set({ role: 'vendor', updatedAt: new Date() })
        .where(eq(users.id, updated.userId));

      await db.insert(notifications).values({
        userId: updated.userId,
        title: '🎉 वेंडर स्टोर स्वीकृत हुआ!',
        body: `बधाई हो! आपका "${updated.shopName}" वेंडर पैनल अब पूरी तरह सक्रिय है।`,
      });
    }

    await logAdminAction(req.authUser!.id, 'update_vendor', 'vendor', String(id), updateFields);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin update vendor failed:', error);
    res.status(500).json({ success: false, error: 'वेंडर अपडेट विफल।' });
  }
});

// Super Admin: Approve / Reject / Verify Pandit Profile + auto-publish live listing
router.patch('/admin/pandits/:id', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const status = String(req.body.status || 'approved');
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'अमान्य स्थिति।' });
    }

    const [updated] = await db
      .update(panditProfiles)
      .set({
        status,
        isVerified: status === 'approved',
        updatedAt: new Date(),
      })
      .where(eq(panditProfiles.id, id))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: 'पंडित प्रोफ़ाइल नहीं मिला।' });

    await syncPanditListing(updated);

    if (status === 'approved' && updated.userId) {
      await db
        .update(users)
        .set({ role: 'pandit', updatedAt: new Date() })
        .where(eq(users.id, updated.userId));

      await db.insert(notifications).values({
        userId: updated.userId,
        title: '🙏 पंडित जी प्रोफ़ाइल वेरिफाई व लाइव हो गया!',
        body: `बधाई हो ${updated.fullName}! आपकी लिस्टिंग प्रोफ़ाइल अब PujaJunction.com पर लाइव है।`,
      });
    }

    await logAdminAction(req.authUser!.id, 'update_pandit', 'pandit', String(id), { status });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin update pandit failed:', error);
    res.status(500).json({ success: false, error: 'पंडित प्रोफ़ाइल अपडेट विफल।' });
  }
});

// Super Admin: Moderate any listing
router.patch('/admin/listings/:id', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updateFields: Partial<typeof listings.$inferInsert> = {};
    if (req.body.status && ['active', 'paused', 'pending'].includes(req.body.status)) {
      updateFields.status = req.body.status;
    }
    if (req.body.basePrice !== undefined) {
      updateFields.basePrice = Math.max(20, parseInt(String(req.body.basePrice), 10) || 100);
    }
    if (req.body.isGlobal !== undefined) {
      updateFields.isGlobal = Boolean(req.body.isGlobal);
    }

    const [updated] = await db
      .update(listings)
      .set(updateFields)
      .where(eq(listings.id, id))
      .returning();
    if (!updated) return res.status(404).json({ success: false, error: 'लिस्टिंग नहीं मिली।' });

    await logAdminAction(req.authUser!.id, 'moderate_listing', 'listing', String(id), updateFields);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin listing update failed:', error);
    res.status(500).json({ success: false, error: 'लिस्टिंग अपडेट विफल।' });
  }
});

router.delete('/admin/listings/:id', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(listings).where(eq(listings.id, id));
    await logAdminAction(req.authUser!.id, 'delete_listing', 'listing', String(id));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Admin delete listing failed:', error);
    res.status(500).json({ success: false, error: 'लिस्टिंग हटाई नहीं जा सकी।' });
  }
});

// Super Admin: Manage Payout Requests
router.patch('/admin/payouts/:id', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const status = String(req.body.status || 'paid');
    const adminNote = String(req.body.adminNote || '').trim();
    if (!['pending', 'approved', 'paid', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'अमान्य पेआउट स्थिति।' });
    }

    const [updated] = await db
      .update(payoutRequests)
      .set({ status, adminNote, updatedAt: new Date() })
      .where(eq(payoutRequests.id, id))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: 'पेआउट अनुरोध नहीं मिला।' });

    await db.insert(notifications).values({
      userId: updated.userId,
      title: status === 'paid' ? `💸 ₹${updated.amount} पेआउट भेजा गया!` : `पेआउट अनुरोध अपडेट (${status})`,
      body:
        status === 'paid'
          ? `आपकी ₹${updated.amount} की राशि (${updated.upiOrBank}) सफलतापूर्वक सेटल कर दी गई है।${adminNote ? ` नोट: ${adminNote}` : ''}`
          : `आपके ₹${updated.amount} पेआउट अनुरोध की स्थिति "${status}" हो गई है।${adminNote ? ` नोट: ${adminNote}` : ''}`,
    });

    await logAdminAction(req.authUser!.id, 'settle_payout', 'payout', String(id), { status, adminNote });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin payout update failed:', error);
    res.status(500).json({ success: false, error: 'पेआउट अपडेट विफल।' });
  }
});

// Super Admin: Promo Codes CRUD
router.post('/admin/promos', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const type = req.body.type === 'percent' ? 'percent' : 'flat';
    const value = Math.max(1, parseInt(String(req.body.value || '10'), 10));
    const minOrder = Math.max(0, parseInt(String(req.body.minOrder || '0'), 10));
    const maxDiscount = req.body.maxDiscount ? parseInt(String(req.body.maxDiscount), 10) : null;

    if (!code || code.length < 3) {
      return res.status(400).json({ success: false, error: 'प्रोमो कोड कम से कम 3 अक्षरों का होना चाहिए।' });
    }

    const [created] = await db
      .insert(promoCodes)
      .values({ code, type, value, minOrder, maxDiscount, isActive: true })
      .returning();

    await logAdminAction(req.authUser!.id, 'create_promo', 'promo', code, { type, value });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Admin create promo failed:', error);
    res.status(400).json({ success: false, error: 'प्रोमो कोड बनाने में त्रुटि (संभवतः कोड पहले से मौजूद है)।' });
  }
});

router.patch('/admin/promos/:id', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [updated] = await db
      .update(promoCodes)
      .set({ isActive: Boolean(req.body.isActive) })
      .where(eq(promoCodes.id, id))
      .returning();
    if (!updated) return res.status(404).json({ success: false, error: 'प्रोमो नहीं मिला।' });
    await logAdminAction(req.authUser!.id, 'toggle_promo', 'promo', updated.code, {
      isActive: updated.isActive,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin toggle promo failed:', error);
    res.status(500).json({ success: false, error: 'प्रोमो अपडेट विफल।' });
  }
});

router.delete('/admin/promos/:id', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(promoCodes).where(eq(promoCodes.id, id));
    await logAdminAction(req.authUser!.id, 'delete_promo', 'promo', String(id));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Admin delete promo failed:', error);
    res.status(500).json({ success: false, error: 'प्रोमो हटाने में समस्या आई।' });
  }
});

// Super Admin: Site Settings & Live Panchang
router.patch('/admin/settings', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const entries = Object.entries(req.body || {});
    const allowedKeys = new Set([
      'whatsappNumber',
      'upiId',
      'payeeName',
      'siteName',
      'panchangTithi',
      'panchangNakshatra',
      'panchangAbhijit',
      'panchangRahukaal',
    ]);

    for (const [key, val] of entries) {
      if (!allowedKeys.has(key)) continue;
      await db
        .insert(settings)
        .values({ key, value: String(val).trim(), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: String(val).trim(), updatedAt: new Date() },
        });
    }

    await logAdminAction(req.authUser!.id, 'update_settings', 'settings', 'global', req.body);
    res.json({ success: true, data: { updated: true } });
  } catch (error) {
    console.error('Admin update settings failed:', error);
    res.status(500).json({ success: false, error: 'सेटिंग्स अपडेट विफल।' });
  }
});

// Super Admin: CSV Export (orders, users, donations, vendors, pandits)
router.get('/admin/export/:type', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const exportType = req.params.type;
    const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    let csv = '';
    if (exportType === 'orders') {
      const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
      csv =
        'OrderID,Type,Customer,Phone,Address,Subtotal,Discount,Total,Promo,Payment,StatusStep,CreatedAt\n' +
        rows
          .map((r) =>
            [
              r.id,
              r.orderType,
              r.customerName,
              r.phone,
              r.addressLine,
              r.subtotal,
              r.discount,
              r.total,
              r.promoCode || '',
              r.paymentMethod,
              r.statusStep,
              r.createdAt.toISOString(),
            ]
              .map(csvEscape)
              .join(',')
          )
          .join('\n');
    } else if (exportType === 'users') {
      const rows = await db.select().from(users).orderBy(desc(users.createdAt));
      csv =
        'ID,Name,Email,Phone,Role,Status,Verified,CreatedAt\n' +
        rows
          .map((r) =>
            [
              r.id,
              r.name,
              r.email,
              r.phone || '',
              r.role,
              r.status,
              r.emailVerifiedAt ? 'Yes' : 'No',
              r.createdAt.toISOString(),
            ]
              .map(csvEscape)
              .join(',')
          )
          .join('\n');
    } else if (exportType === 'donations') {
      const rows = await db.select().from(donations).orderBy(desc(donations.createdAt));
      csv =
        'ReceiptID,DonorName,City,Cause,Amount,Status,CreatedAt\n' +
        rows
          .map((r) =>
            [r.id, r.donorName, r.donorCity, r.cause, r.amount, r.status, r.createdAt.toISOString()]
              .map(csvEscape)
              .join(',')
          )
          .join('\n');
    } else if (exportType === 'vendors') {
      const rows = await db.select().from(vendors).orderBy(desc(vendors.createdAt));
      csv =
        'ID,ShopName,Location,Phone,GST,CommissionPct,Verified,Status,CreatedAt\n' +
        rows
          .map((r) =>
            [
              r.id,
              r.shopName,
              r.location,
              r.phone,
              r.gstNumber || '',
              r.commissionRate,
              r.isVerified ? 'Yes' : 'No',
              r.status,
              r.createdAt.toISOString(),
            ]
              .map(csvEscape)
              .join(',')
          )
          .join('\n');
    } else if (exportType === 'pandits') {
      const rows = await db.select().from(panditProfiles).orderBy(desc(panditProfiles.createdAt));
      csv =
        'ID,FullName,Title,City,Phone,ExperienceYears,BaseDakshina,CompletedPujas,Status,CreatedAt\n' +
        rows
          .map((r) =>
            [
              r.id,
              r.fullName,
              r.title,
              r.city,
              r.phone,
              r.experienceYears,
              r.baseDakshina,
              r.completedPujas,
              r.status,
              r.createdAt.toISOString(),
            ]
              .map(csvEscape)
              .join(',')
          )
          .join('\n');
    } else {
      return res.status(400).json({ success: false, error: 'अमान्य एक्सपोर्ट प्रकार।' });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pujajunction-${exportType}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Admin CSV export failed:', error);
    res.status(500).json({ success: false, error: 'CSV एक्सपोर्ट विफल रहा।' });
  }
});

export default router;
