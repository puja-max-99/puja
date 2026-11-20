import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  cartItems,
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
  promoCodes,
  subscriptions,
} from '../db/schema.ts';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth.ts';

const router = Router();

// File upload configuration for Custom Puja Lists (validated MIME + extension, max 5MB)
const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
      cb(null, `list_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('केवल JPG, PNG, WebP या PDF फाइल अपलोड की जा सकती है।'));
    }
  },
});

function generateOrderId(prefix = 'PJ'): string {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}${crypto.randomInt(10, 99)}`;
}

// Helper: Server-side authoritative price calculation for a cart/direct item
async function calculateAuthoritativeItem(input: {
  listingId?: number | null;
  itemType?: string;
  selectedItems?: Array<{ id?: number; name: string; qty: number; price?: number }>;
  variantId?: number | null;
  variantLabel?: string | null;
  pujaDate?: string | null;
  pujaLocation?: string | null;
  subscriptionEnabled?: boolean;
  subscriptionCycle?: string | null;
  qty?: number;
  customTitle?: string;
  customDetails?: string;
  customPrice?: number;
}) {
  const qty = Math.min(25, Math.max(1, Number(input.qty) || 1));

  if (!input.listingId) {
    // Custom puja list item
    const safePrice = Math.max(299, Math.min(25000, Math.round(Number(input.customPrice) || 299)));
    return {
      listingId: null as number | null,
      vendorId: null as number | null,
      panditProfileId: null as number | null,
      itemType: 'custom_list',
      title: String(input.customTitle || 'कस्टम पूजा लिस्ट').slice(0, 180),
      vendorName: 'PujaJunction.com भंडार',
      details: String(input.customDetails || 'कस्टम पूजा सामग्री').slice(0, 500),
      unitPrice: safePrice,
      qty: 1,
      selectedItemsJson: input.selectedItems
        ? input.selectedItems.map((item) => ({
            id: item.id,
            name: String(item.name || ''),
            qty: Number(item.qty) || 1,
            price: Number(item.price) || 0,
          }))
        : null,
      variantId: null as number | null,
      variantLabel: null as string | null,
      pujaDate: input.pujaDate || null,
      pujaLocation: input.pujaLocation || null,
      subscriptionEnabled: false,
      subscriptionCycle: null as string | null,
    };
  }

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, Number(input.listingId)))
    .limit(1);

  if (!listing) {
    throw new Error('चयनित पूजा किट / सेवा उपलब्ध नहीं है।');
  }

  if (listing.category === 'pooja_box') {
    const dbSubItems = await db
      .select()
      .from(listingItems)
      .where(eq(listingItems.listingId, listing.id));

    const requested = Array.isArray(input.selectedItems) ? input.selectedItems : [];
    const normalizedItems: Array<{ id?: number; name: string; qty: number; price: number }> = [];
    let sum = 0;

    if (requested.length > 0) {
      for (const reqItem of requested) {
        const match = dbSubItems.find(
          (d) => (reqItem.id && d.id === reqItem.id) || d.name === reqItem.name
        );
        if (match) {
          const safeQ = Math.min(50, Math.max(1, Number(reqItem.qty) || 1));
          sum += match.price * safeQ;
          normalizedItems.push({ id: match.id, name: match.name, qty: safeQ, price: match.price });
        }
      }
    }

    if (normalizedItems.length === 0) {
      for (const d of dbSubItems) {
        if (d.isDefaultChecked) {
          sum += d.price * d.defaultQty;
          normalizedItems.push({ id: d.id, name: d.name, qty: d.defaultQty, price: d.price });
        }
      }
    }

    const subEnabled = Boolean(input.subscriptionEnabled);
    const subCycle = input.subscriptionCycle || listing.subscriptionCycle || 'मासिक (हर पूर्णिमा)';
    const finalUnitPrice = subEnabled ? Math.round(sum * 0.9) : sum;
    const detailText =
      normalizedItems.map((i) => `${i.name} (x${i.qty})`).join(', ') +
      (subEnabled ? ` | 🔄 ${subCycle} (10% छूट)` : '');

    return {
      listingId: listing.id,
      vendorId: listing.vendorId,
      panditProfileId: listing.panditProfileId || null,
      itemType: 'pooja_box',
      title: listing.title,
      vendorName: listing.vendorName,
      details: detailText,
      unitPrice: finalUnitPrice,
      qty: 1,
      selectedItemsJson: normalizedItems,
      variantId: null,
      variantLabel: null,
      pujaDate: input.pujaDate || null,
      pujaLocation: null,
      subscriptionEnabled: subEnabled,
      subscriptionCycle: subEnabled ? subCycle : null,
    };
  }

  // Pandit / Murti / Photo with variants
  const dbVariants = await db
    .select()
    .from(listingVariants)
    .where(eq(listingVariants.listingId, listing.id));

  let matchedVariant = dbVariants.find(
    (v) =>
      (input.variantId && v.id === Number(input.variantId)) ||
      (input.variantLabel && v.label === input.variantLabel)
  );
  if (!matchedVariant && dbVariants.length > 0) {
    matchedVariant = dbVariants[0];
  }

  const unitPrice = matchedVariant ? matchedVariant.price : listing.basePrice;
  const variantLabel = matchedVariant ? matchedVariant.label : input.variantLabel || 'स्टैंडर्ड';

  if (listing.category === 'pandit') {
    const loc = String(input.pujaLocation || listing.location || 'Sakchi, Jamshedpur').trim();
    const dt = String(input.pujaDate || new Date().toISOString().split('T')[0]);
    return {
      listingId: listing.id,
      vendorId: listing.vendorId,
      panditProfileId: listing.panditProfileId || null,
      itemType: 'pandit',
      title: listing.title,
      vendorName: listing.vendorName,
      details: `पूजा: ${variantLabel} | 📍 स्थान: ${loc} | तिथि: ${dt}`,
      unitPrice,
      qty: 1,
      selectedItemsJson: null,
      variantId: matchedVariant?.id || null,
      variantLabel,
      pujaDate: dt,
      pujaLocation: loc,
      subscriptionEnabled: false,
      subscriptionCycle: null,
    };
  }

  return {
    listingId: listing.id,
    vendorId: listing.vendorId,
    panditProfileId: listing.panditProfileId || null,
    itemType: listing.category,
    title: listing.title,
    vendorName: listing.vendorName,
    details: `वेरिएंट: ${variantLabel} | मात्रा: ${qty} पीस`,
    unitPrice,
    qty,
    selectedItemsJson: null,
    variantId: matchedVariant?.id || null,
    variantLabel,
    pujaDate: null,
    pujaLocation: null,
    subscriptionEnabled: false,
    subscriptionCycle: null,
  };
}

async function computePromoDiscount(subtotal: number, rawCode?: string | null) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code || subtotal <= 0) return null;

  const [promo] = await db
    .select()
    .from(promoCodes)
    .where(and(eq(promoCodes.code, code), eq(promoCodes.isActive, true)))
    .limit(1);

  if (!promo) return null;
  if (promo.minOrder && subtotal < promo.minOrder) return null;
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return null;

  let discountAmount = 0;
  if (promo.type === 'percent') {
    discountAmount = Math.round((subtotal * promo.value) / 100);
    if (promo.maxDiscount) discountAmount = Math.min(discountAmount, promo.maxDiscount);
  } else {
    discountAmount = Math.min(promo.value, subtotal);
  }

  return {
    id: promo.id,
    code: promo.code,
    discountAmount,
    label: promo.type === 'percent' ? `${promo.value}% छूट` : `₹${promo.value} छूट`,
  };
}

// ==================== CART ROUTES ====================

router.get('/cart', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, req.authUser!.id))
      .orderBy(desc(cartItems.createdAt));

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get cart failed:', error);
    res.status(500).json({ success: false, error: 'कार्ट लोड करने में समस्या आई।' });
  }
});

router.post('/cart', requireAuth, async (req: AuthRequest, res) => {
  try {
    const computed = await calculateAuthoritativeItem(req.body);
    const [inserted] = await db
      .insert(cartItems)
      .values({
        userId: req.authUser!.id,
        listingId: computed.listingId,
        itemType: computed.itemType,
        title: computed.title,
        vendorName: computed.vendorName,
        details: computed.details,
        selectedItemsJson: computed.selectedItemsJson,
        variantId: computed.variantId,
        variantLabel: computed.variantLabel,
        pujaDate: computed.pujaDate,
        pujaLocation: computed.pujaLocation,
        subscriptionEnabled: computed.subscriptionEnabled,
        subscriptionCycle: computed.subscriptionCycle,
        unitPrice: computed.unitPrice,
        qty: computed.qty,
      })
      .returning();

    res.status(201).json({ success: true, data: inserted });
  } catch (error: unknown) {
    console.error('Add to cart failed:', error);
    const msg = error instanceof Error ? error.message : 'कार्ट में जोड़ने में त्रुटि।';
    res.status(400).json({ success: false, error: msg });
  }
});

// Merge guest localStorage cart into DB on login
router.post('/cart/merge', requireAuth, async (req: AuthRequest, res) => {
  try {
    const guestItems = Array.isArray(req.body.items) ? req.body.items : [];
    for (const gi of guestItems.slice(0, 20)) {
      try {
        const computed = await calculateAuthoritativeItem(gi);
        await db.insert(cartItems).values({
          userId: req.authUser!.id,
          listingId: computed.listingId,
          itemType: computed.itemType,
          title: computed.title,
          vendorName: computed.vendorName,
          details: computed.details,
          selectedItemsJson: computed.selectedItemsJson,
          variantId: computed.variantId,
          variantLabel: computed.variantLabel,
          pujaDate: computed.pujaDate,
          pujaLocation: computed.pujaLocation,
          subscriptionEnabled: computed.subscriptionEnabled,
          subscriptionCycle: computed.subscriptionCycle,
          unitPrice: computed.unitPrice,
          qty: computed.qty,
        });
      } catch {
        // skip invalid guest items
      }
    }

    const merged = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, req.authUser!.id))
      .orderBy(desc(cartItems.createdAt));

    res.json({ success: true, data: merged });
  } catch (error) {
    console.error('Cart merge failed:', error);
    res.status(500).json({ success: false, error: 'कार्ट मर्ज विफल रहा।' });
  }
});

router.patch('/cart/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const qty = Math.min(25, Math.max(1, parseInt(String(req.body.qty || '1'), 10)));
    const [updated] = await db
      .update(cartItems)
      .set({ qty })
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, req.authUser!.id)))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: 'आइटम नहीं मिला।' });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update cart failed:', error);
    res.status(500).json({ success: false, error: 'कार्ट अपडेट विफल।' });
  }
});

router.delete('/cart/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, req.authUser!.id)));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Delete cart failed:', error);
    res.status(500).json({ success: false, error: 'आइटम हटाया नहीं जा सका।' });
  }
});

// ==================== PROMO VALIDATION ====================

router.post('/promo/validate', async (req, res) => {
  try {
    const subtotal = Math.max(0, Number(req.body.subtotal) || 0);
    const code = String(req.body.code || '').trim();
    const result = await computePromoDiscount(subtotal, code);
    if (!result) {
      return res.status(400).json({
        success: false,
        error: 'अमान्य कोड या न्यूनतम ऑर्डर शर्त पूरी नहीं हुई — GANESH10 या PUJA51 आज़माएं।',
      });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Promo validate failed:', error);
    res.status(500).json({ success: false, error: 'कूपन सत्यापन विफल।' });
  }
});

// ==================== ORDERS & CHECKOUT ====================

router.post('/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const mode = req.body.mode === 'direct' ? 'direct' : 'cart';
    const customerName = String(req.body.customerName || user.name).trim();
    const phone = String(req.body.phone || user.phone || '').trim();
    const addressLine = String(req.body.addressLine || '').trim();
    const pincode = String(req.body.pincode || '').trim();
    const notes = String(req.body.notes || '').trim();
    const paymentMethod = String(req.body.paymentMethod || 'UPI').trim();
    const promoCodeInput = req.body.promoCode ? String(req.body.promoCode).trim() : null;

    if (!customerName || !phone || !addressLine) {
      return res.status(400).json({
        success: false,
        error: 'कृपया नाम, मोबाइल नंबर और पूरा डिलीवरी पता दर्ज करें।',
      });
    }

    const itemsToOrder: Array<Awaited<ReturnType<typeof calculateAuthoritativeItem>>> = [];

    if (mode === 'direct') {
      const computed = await calculateAuthoritativeItem(req.body.directItem || {});
      itemsToOrder.push(computed);
    } else {
      const dbCart = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.userId, user.id));

      if (dbCart.length === 0) {
        return res.status(400).json({ success: false, error: 'आपका कार्ट खाली है।' });
      }

      for (const ci of dbCart) {
        const computed = await calculateAuthoritativeItem({
          listingId: ci.listingId,
          itemType: ci.itemType,
          selectedItems: ci.selectedItemsJson || undefined,
          variantId: ci.variantId,
          variantLabel: ci.variantLabel,
          pujaDate: ci.pujaDate,
          pujaLocation: ci.pujaLocation,
          subscriptionEnabled: ci.subscriptionEnabled,
          subscriptionCycle: ci.subscriptionCycle,
          qty: ci.qty,
          customTitle: ci.title,
          customDetails: ci.details,
          customPrice: ci.unitPrice,
        });
        itemsToOrder.push(computed);
      }
    }

    const subtotal = itemsToOrder.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);
    const promo = await computePromoDiscount(subtotal, promoCodeInput);
    const discount = promo ? promo.discountAmount : 0;
    const total = Math.max(0, subtotal - discount);

    const hasPandit = itemsToOrder.some((i) => i.itemType === 'pandit');
    const orderType =
      mode === 'direct'
        ? 'तुरंत किट ऑर्डर'
        : hasPandit && itemsToOrder.length === 1
        ? 'पंडित बुकिंग'
        : 'पूजा ऑर्डर';

    const orderId = generateOrderId('PJ');

    const createdOrder = await db.transaction(async (tx) => {
      const [ord] = await tx
        .insert(orders)
        .values({
          id: orderId,
          userId: user.id,
          orderType,
          subtotal,
          discount,
          total,
          promoCode: promo?.code || null,
          paymentMethod,
          paymentStatus: paymentMethod === 'COD' ? 'cod_pending' : 'confirmed',
          statusStep: 0,
          customerName,
          phone,
          addressLine,
          pincode,
          notes,
        })
        .returning();

      for (const it of itemsToOrder) {
        await tx.insert(orderItems).values({
          orderId,
          listingId: it.listingId,
          vendorId: it.vendorId,
          vendorName: it.vendorName,
          titleSnapshot: it.title,
          detailsSnapshot: it.details,
          price: it.unitPrice * it.qty,
          qty: it.qty,
        });

        if (it.itemType === 'pandit') {
          await tx.insert(panditBookings).values({
            orderId,
            listingId: it.listingId,
            panditProfileId: it.panditProfileId,
            pujaDate: it.pujaDate || new Date().toISOString().split('T')[0],
            muhurat: 'अभिजीत मुहूर्त (11:45 AM – 12:28 PM)',
            location: it.pujaLocation || addressLine,
            pujaType: it.variantLabel || 'वैदिक पूजा',
            dakshinaAmount: it.unitPrice * it.qty,
            customerName,
            customerPhone: phone,
            status: 'confirmed',
          });

          if (it.panditProfileId) {
            const [pProf] = await tx
              .select({ userId: panditProfiles.userId })
              .from(panditProfiles)
              .where(eq(panditProfiles.id, it.panditProfileId))
              .limit(1);
            if (pProf?.userId) {
              await tx.insert(notifications).values({
                userId: pProf.userId,
                title: `🙏 नई यजमान बुकिंग #${orderId}`,
                body: `${customerName} ने ${it.variantLabel || 'वैदिक पूजा'} (${it.pujaDate || 'शीघ्र'}) बुक की है — दक्षिणा ₹${it.unitPrice * it.qty}।`,
              });
            }
          }
        }

        if (it.subscriptionEnabled && it.listingId) {
          const nextDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          await tx.insert(subscriptions).values({
            userId: user.id,
            listingId: it.listingId,
            cycle: it.subscriptionCycle || 'मासिक (हर पूर्णिमा)',
            nextDeliveryDate: nextDate,
            price: it.unitPrice,
            status: 'active',
          });
        }
      }

      await tx.insert(orderStatusHistory).values({
        orderId,
        step: 0,
        note: 'ऑर्डर सफलतापूर्वक प्राप्त हुआ',
        changedByUserId: user.id,
      });

      if (promo) {
        await tx
          .update(promoCodes)
          .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
          .where(eq(promoCodes.id, promo.id));
      }

      if (mode === 'cart') {
        await tx.delete(cartItems).where(eq(cartItems.userId, user.id));
      }

      await tx.insert(notifications).values({
        userId: user.id,
        title: `✅ ऑर्डर #${orderId} कन्फर्म हो गया`,
        body: `आपका ₹${total} का ${orderType} सफलतापूर्वक दर्ज हो गया है।`,
      });

      return ord;
    });

    res.status(201).json({
      success: true,
      data: {
        order: createdOrder,
        items: itemsToOrder,
      },
    });
  } catch (error: unknown) {
    console.error('Create order failed:', error);
    const msg = error instanceof Error ? error.message : 'ऑर्डर बनाने में समस्या आई।';
    res.status(400).json({ success: false, error: msg });
  }
});

router.get('/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.authUser!.id))
      .orderBy(desc(orders.createdAt));

    const orderIds = userOrders.map((o) => o.id);
    const allItems =
      orderIds.length > 0
        ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
        : [];
    const allHistory =
      orderIds.length > 0
        ? await db
            .select()
            .from(orderStatusHistory)
            .where(inArray(orderStatusHistory.orderId, orderIds))
            .orderBy(desc(orderStatusHistory.createdAt))
        : [];

    const hydrated = userOrders.map((o) => ({
      ...o,
      items: allItems.filter((i) => i.orderId === o.id),
      history: allHistory.filter((h) => h.orderId === o.id),
    }));

    res.json({ success: true, data: hydrated });
  } catch (error) {
    console.error('Fetch orders failed:', error);
    res.status(500).json({ success: false, error: 'ऑर्डर इतिहास लोड नहीं हो सका।' });
  }
});

router.post('/orders/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = req.params.id;
    const [ord] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, req.authUser!.id)))
      .limit(1);

    if (!ord) return res.status(404).json({ success: false, error: 'ऑर्डर नहीं मिला।' });
    if (ord.cancelledAt) {
      return res.status(400).json({ success: false, error: 'यह ऑर्डर पहले से रद्द है।' });
    }
    if (ord.statusStep >= 2) {
      return res.status(400).json({
        success: false,
        error: 'डिस्पैच हो चुके ऑर्डर को रद्द नहीं किया जा सकता।',
      });
    }

    const [updated] = await db
      .update(orders)
      .set({ cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    await db.insert(orderStatusHistory).values({
      orderId,
      step: ord.statusStep,
      note: 'ग्राहक द्वारा ऑर्डर रद्द किया गया',
      changedByUserId: req.authUser!.id,
    });

    await db.insert(notifications).values({
      userId: req.authUser!.id,
      title: `ऑर्डर #${orderId} रद्द किया गया`,
      body: 'आपका ऑर्डर सफलतापूर्वक रद्द कर दिया गया है।',
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Cancel order failed:', error);
    res.status(500).json({ success: false, error: 'ऑर्डर रद्द करने में त्रुटि।' });
  }
});

// ==================== SUBSCRIPTIONS ====================

router.get('/subscriptions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        subscription: subscriptions,
        listingTitle: listings.title,
        vendorName: listings.vendorName,
      })
      .from(subscriptions)
      .leftJoin(listings, eq(subscriptions.listingId, listings.id))
      .where(eq(subscriptions.userId, req.authUser!.id))
      .orderBy(desc(subscriptions.createdAt));

    res.json({
      success: true,
      data: rows.map((r) => ({
        ...r.subscription,
        listingTitle: r.listingTitle || 'पूजा किट',
        vendorName: r.vendorName || 'PujaJunction.com',
      })),
    });
  } catch (error) {
    console.error('Get subscriptions failed:', error);
    res.status(500).json({ success: false, error: 'सब्सक्रिप्शन लोड नहीं हो सके।' });
  }
});

router.patch('/subscriptions/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const status = String(req.body.status || '');
    if (!['active', 'paused', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'अमान्य स्थिति।' });
    }

    const [updated] = await db
      .update(subscriptions)
      .set({ status })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, req.authUser!.id)))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: 'सब्सक्रिप्शन नहीं मिला।' });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update subscription failed:', error);
    res.status(500).json({ success: false, error: 'सब्सक्रिप्शन अपडेट विफल।' });
  }
});

// ==================== CUSTOM PUJA LISTS ====================

router.post('/custom-lists', optionalAuth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const pujaName = String(req.body.pujaName || '').trim();
    const customerName = String(req.body.customerName || req.authUser?.name || '').trim();
    const phone = String(req.body.phone || req.authUser?.phone || '').trim();
    const address = String(req.body.address || '').trim();
    const needPandit = req.body.needPandit === 'true' || req.body.needPandit === true;
    const pujaDate = String(req.body.pujaDate || '').trim();

    let manualItems: Array<{ name: string; qty: string }> = [];
    if (req.body.manualItems) {
      try {
        const parsed =
          typeof req.body.manualItems === 'string'
            ? JSON.parse(req.body.manualItems)
            : req.body.manualItems;
        if (Array.isArray(parsed)) {
          manualItems = parsed
            .filter((it) => it && String(it.name || '').trim())
            .map((it) => ({
              name: String(it.name).trim().slice(0, 120),
              qty: String(it.qty || '').trim().slice(0, 40),
            }));
        }
      } catch {
        manualItems = [];
      }
    }

    if (!pujaName || !customerName || !phone || !address) {
      return res.status(400).json({
        success: false,
        error: 'कृपया पूजा का नाम, आपका नाम, मोबाइल और पता भरें।',
      });
    }

    if (!req.file && manualItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'कृपया पर्ची की फोटो/PDF अपलोड करें या कम से कम एक सामग्री लिखें।',
      });
    }

    const estPrice = Math.max(299, manualItems.length * 65 + (needPandit ? 1100 : 0));
    const orderId = generateOrderId('PJ-CL');
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const [createdList] = await db
      .insert(customPujaLists)
      .values({
        userId: req.authUser?.id || null,
        pujaName,
        filePath: fileUrl,
        fileName: req.file?.originalname || null,
        manualItemsJson: manualItems,
        needPandit,
        pujaDate: pujaDate || null,
        customerName,
        phone,
        address,
        status: 'submitted',
        quotedPrice: estPrice,
        orderId,
      })
      .returning();

    // Also create a trackable order entry immediately
    const detailParts = [
      req.file ? `अपलोड पर्ची: ${req.file.originalname}` : '',
      manualItems.length > 0
        ? `सामग्री: ${manualItems.map((m) => (m.qty ? `${m.name} (${m.qty})` : m.name)).join(', ')}`
        : '',
      needPandit ? `पंडित जी सहित (${pujaDate || 'तिथि शीघ्र'})` : '',
    ]
      .filter(Boolean)
      .join(' • ');

    await db.insert(orders).values({
      id: orderId,
      userId: req.authUser?.id || null,
      orderType: 'कस्टम पूजा लिस्ट',
      subtotal: estPrice,
      discount: 0,
      total: estPrice,
      paymentMethod: 'COD',
      paymentStatus: 'quote_pending',
      statusStep: 0,
      customerName,
      phone,
      addressLine: address,
      notes: detailParts,
    });

    await db.insert(orderItems).values({
      orderId,
      vendorName: 'PujaJunction.com भंडार',
      titleSnapshot: `कस्टम पूजा लिस्ट: ${pujaName}`,
      detailsSnapshot: detailParts,
      price: estPrice,
      qty: 1,
    });

    await db.insert(orderStatusHistory).values({
      orderId,
      step: 0,
      note: 'कस्टम पूजा लिस्ट प्राप्त हुई',
      changedByUserId: req.authUser?.id || null,
    });

    if (req.authUser) {
      await db.insert(notifications).values({
        userId: req.authUser.id,
        title: `📝 कस्टम लिस्ट #${orderId} दर्ज हुई`,
        body: `"${pujaName}" के लिए अनुमानित राशि ₹${estPrice}। हमारा पूजा भंडार शीघ्र संपर्क करेगा।`,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        customList: createdList,
        orderId,
        estimatedPrice: estPrice,
      },
    });
  } catch (error: unknown) {
    console.error('Custom puja list upload failed:', error);
    const msg = error instanceof Error ? error.message : 'कस्टम लिस्ट सबमिट करने में समस्या आई।';
    res.status(400).json({ success: false, error: msg });
  }
});

// ==================== SEVA DAKSHINA / DONATIONS ====================

router.post('/donations', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Math.max(1, Math.min(1000000, parseInt(String(req.body.amount || '51'), 10) || 51));
    const donorName = String(req.body.donorName || req.authUser?.name || 'श्रद्धालु भक्त').trim();
    const donorCity = String(req.body.donorCity || '').trim();
    const cause = String(req.body.cause || '🐄 गौ सेवा (चारा व गुड़)').trim();
    const upiTxnRef = req.body.upiTxnRef ? String(req.body.upiTxnRef).trim() : null;
    const receiptId = generateOrderId('PJ');

    const [created] = await db
      .insert(donations)
      .values({
        id: receiptId,
        userId: req.authUser?.id || null,
        donorName,
        donorCity,
        cause,
        amount,
        upiTxnRef,
        status: 'recorded',
      })
      .returning();

    if (req.authUser) {
      await db.insert(notifications).values({
        userId: req.authUser.id,
        title: `🙏 सेवा दक्षिणा रसीद #${receiptId}`,
        body: `${cause} हेतु ₹${amount} अर्पण करने के लिए हृदय से धन्यवाद!`,
      });
    }

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Create donation failed:', error);
    res.status(500).json({ success: false, error: 'दक्षिणा रसीद बनाने में समस्या आई।' });
  }
});

router.get('/donations/recent', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: donations.id,
        donorName: donations.donorName,
        cause: donations.cause,
        amount: donations.amount,
        createdAt: donations.createdAt,
      })
      .from(donations)
      .orderBy(desc(donations.createdAt))
      .limit(10);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Fetch recent donations failed:', error);
    res.status(500).json({ success: false, error: 'हाल की सेवा दक्षिणा लोड नहीं हो सकी।' });
  }
});

export default router;
