import bcrypt from 'bcryptjs';
import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  listingItems,
  listings,
  listingVariants,
  masterCategories,
  panditProfiles,
  promoCodes,
  reviews,
  searchAliases,
  settings,
  users,
  vendors,
} from './schema.ts';
import {
  SEED_BILINGUAL_ALIASES,
  SEED_LISTINGS,
  SEED_MASTER_CATEGORIES,
  SEED_PROMO_CODES,
  SEED_SETTINGS,
} from './seedData.ts';

let seedPromise: Promise<void> | null = null;
let seededDone = false;

function extractOptionPrice(label: string, fallback: number): number {
  const match = label.match(/₹(\d+)/);
  return match ? parseInt(match[1], 10) : fallback;
}

async function ensureRoleAccountsAndProfiles(): Promise<void> {
  // 1. Super Admin
  const adminEmail = 'admin@pujajunction.com';
  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash('Admin@1234', 10);
    await db
      .insert(users)
      .values({
        uid: 'local_admin_pujajunction',
        name: 'PujaJunction Super Admin',
        email: adminEmail,
        emailVerifiedAt: new Date(),
        passwordHash,
        phone: '9876500001',
        role: 'super_admin',
        status: 'active',
      })
      .onConflictDoNothing();
  } else if (existingAdmin[0].role === 'admin') {
    await db
      .update(users)
      .set({ role: 'super_admin', updatedAt: new Date() })
      .where(eq(users.id, existingAdmin[0].id));
  }

  // 2. Vendor Account (WooCommerce Store Owner)
  const vendorEmail = 'vendor@pujajunction.com';
  let vendorUserId: number | null = null;
  const existingVendorUser = await db.select().from(users).where(eq(users.email, vendorEmail)).limit(1);
  if (existingVendorUser.length === 0) {
    const passwordHash = await bcrypt.hash('Vendor@1234', 10);
    const [created] = await db
      .insert(users)
      .values({
        uid: 'local_vendor_pujajunction',
        name: 'श्री काशी पूजा भंडार (Vendor)',
        email: vendorEmail,
        emailVerifiedAt: new Date(),
        passwordHash,
        phone: '9876500002',
        role: 'vendor',
        status: 'active',
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    vendorUserId = created?.id || null;
  } else {
    vendorUserId = existingVendorUser[0].id;
  }

  if (vendorUserId) {
    const linkedVendors = await db.select().from(vendors).where(eq(vendors.userId, vendorUserId)).limit(1);
    if (linkedVendors.length === 0) {
      const firstVendor = await db.select().from(vendors).limit(1);
      if (firstVendor.length > 0 && !firstVendor[0].userId) {
        await db
          .update(vendors)
          .set({
            userId: vendorUserId,
            upiId: 'kashipujabhandar@upi',
            gstNumber: '20AAACP1234A1Z5',
            shippingFee: 40,
            freeShippingAbove: 499,
            codEnabled: true,
            commissionRate: 8,
            isVerified: true,
            status: 'approved',
          })
          .where(eq(vendors.id, firstVendor[0].id));
      } else {
        await db.insert(vendors).values({
          userId: vendorUserId,
          shopName: 'श्री काशी विश्वनाथ पूजा भंडार',
          location: 'Sakchi, Jamshedpur',
          phone: '9876500002',
          description: '100% शुद्ध वैदिक पूजा सामग्री, हवन किट, मूर्तियाँ और पूजन थाली का विश्वसनीय केंद्र।',
          upiId: 'kashipujabhandar@upi',
          gstNumber: '20AAACP1234A1Z5',
          shippingFee: 40,
          freeShippingAbove: 499,
          codEnabled: true,
          commissionRate: 8,
          isVerified: true,
          status: 'approved',
        });
      }
    }
  }

  // 3. Pandit Ji Account + Full Listing Profile
  const panditEmail = 'pandit@pujajunction.com';
  let panditUserId: number | null = null;
  const existingPanditUser = await db.select().from(users).where(eq(users.email, panditEmail)).limit(1);
  if (existingPanditUser.length === 0) {
    const passwordHash = await bcrypt.hash('Pandit@1234', 10);
    const [created] = await db
      .insert(users)
      .values({
        uid: 'local_pandit_pujajunction',
        name: 'आचार्य पं. देवेंद्र शास्त्री',
        email: panditEmail,
        emailVerifiedAt: new Date(),
        passwordHash,
        phone: '9876500003',
        role: 'pandit',
        status: 'active',
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    panditUserId = created?.id || null;
  } else {
    panditUserId = existingPanditUser[0].id;
  }

  if (panditUserId) {
    const existingProfile = await db
      .select()
      .from(panditProfiles)
      .where(eq(panditProfiles.userId, panditUserId))
      .limit(1);

    let panditProfileId: number;
    if (existingProfile.length === 0) {
      const [createdProfile] = await db
        .insert(panditProfiles)
        .values({
          userId: panditUserId,
          fullName: 'आचार्य पं. देवेंद्र शास्त्री',
          title: 'काशी विद्वत परिषद प्रमाणित वैदिक आचार्य',
          phone: '9876500003',
          city: 'Sakchi, Jamshedpur',
          serviceAreasJson: ['Sakchi, Jamshedpur', 'Bistupur, Jamshedpur', 'Bagbera, Jamshedpur', 'Ranchi'],
          experienceYears: 15,
          education: 'काशी हिन्दू विश्वविद्यालय (ज्योतिष एवं कर्मकांड आचार्य)',
          languagesJson: ['हिंदी', 'संस्कृत', 'भोजपुरी', 'बंगाली'],
          specializationsJson: ['सत्यनारायण कथा', 'गृह प्रवेश एवं वास्तु शांति', 'रुद्राभिषेक', 'महामृत्युंजय जाप', 'विवाह संस्कार'],
          bio: '15+ वर्षों के वैदिक अनुष्ठान अनुभव के साथ शुद्ध संस्कृत मंत्रोच्चार द्वारा गृह प्रवेश, सत्यनारायण कथा, रुद्राभिषेक, नवग्रह शांति एवं समस्त सोलह संस्कार संपन्न कराते हैं।',
          photoUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=400&q=80',
          baseDakshina: 1100,
          onlinePujaAvailable: true,
          travelAvailable: true,
          availabilityStatus: 'available',
          availableDaysJson: ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'],
          blockedDatesJson: [],
          upiId: 'acharyadevendra@upi',
          isVerified: true,
          status: 'approved',
          ratingAvg: 4.9,
          completedPujas: 340,
        })
        .returning({ id: panditProfiles.id });
      panditProfileId = createdProfile.id;
    } else {
      panditProfileId = existingProfile[0].id;
    }

    // Link existing pandit listing if none linked yet
    const linkedPanditListing = await db
      .select()
      .from(listings)
      .where(eq(listings.panditProfileId, panditProfileId))
      .limit(1);
    if (linkedPanditListing.length === 0) {
      const firstPanditListing = await db
        .select()
        .from(listings)
        .where(eq(listings.category, 'pandit'))
        .limit(1);
      if (firstPanditListing.length > 0 && !firstPanditListing[0].panditProfileId) {
        await db
          .update(listings)
          .set({ panditProfileId })
          .where(eq(listings.id, firstPanditListing[0].id));
      }
    }
  }

  // 4. Customer / User Account
  const customerEmail = 'user@pujajunction.com';
  const existingCustomer = await db.select().from(users).where(eq(users.email, customerEmail)).limit(1);
  if (existingCustomer.length === 0) {
    const passwordHash = await bcrypt.hash('User@1234', 10);
    await db
      .insert(users)
      .values({
        uid: 'local_user_pujajunction',
        name: 'राजेश शर्मा (श्रद्धालु)',
        email: customerEmail,
        emailVerifiedAt: new Date(),
        passwordHash,
        phone: '9876500004',
        role: 'customer',
        status: 'active',
      })
      .onConflictDoNothing();
  }
}

export async function ensureSeeded(): Promise<void> {
  if (seededDone) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const [{ value: listingCount }] = await db.select({ value: count() }).from(listings);
      const [{ value: catCount }] = await db.select({ value: count() }).from(masterCategories);

      if (catCount === 0) {
        for (let i = 0; i < SEED_MASTER_CATEGORIES.length; i++) {
          const cat = SEED_MASTER_CATEGORIES[i];
          await db
            .insert(masterCategories)
            .values({
              id: cat.id,
              code: cat.code,
              deity: cat.deity,
              hinglish: cat.hinglish,
              itemsJson: cat.items,
              sortOrder: i + 1,
            })
            .onConflictDoNothing();
        }
      }

      const [{ value: settingsCount }] = await db.select({ value: count() }).from(settings);
      if (settingsCount === 0) {
        for (const s of SEED_SETTINGS) {
          await db.insert(settings).values(s).onConflictDoNothing();
        }
      }

      const [{ value: promoCount }] = await db.select({ value: count() }).from(promoCodes);
      if (promoCount === 0) {
        for (const p of SEED_PROMO_CODES) {
          await db.insert(promoCodes).values(p).onConflictDoNothing();
        }
      }

      const [{ value: aliasCount }] = await db.select({ value: count() }).from(searchAliases);
      if (aliasCount === 0) {
        const aliasRows: Array<{ groupKey: string; term: string }> = [];
        for (const [groupKey, terms] of Object.entries(SEED_BILINGUAL_ALIASES)) {
          for (const term of terms) {
            aliasRows.push({ groupKey, term });
          }
        }
        if (aliasRows.length > 0) {
          await db.insert(searchAliases).values(aliasRows);
        }
      }

      if (listingCount === 0) {
        const vendorMap = new Map<string, number>();

        for (const item of SEED_LISTINGS) {
          let vendorId = vendorMap.get(item.vendor);
          if (!vendorId) {
            const existingVendor = await db
              .select()
              .from(vendors)
              .where(eq(vendors.shopName, item.vendor))
              .limit(1);
            if (existingVendor.length > 0) {
              vendorId = existingVendor[0].id;
            } else {
              const [insertedVendor] = await db
                .insert(vendors)
                .values({
                  shopName: item.vendor,
                  location: item.location,
                  phone: '9876543210',
                  description: `${item.vendor} — प्रमाणित वैदिक पूजा सामग्री एवं सेवा केंद्र`,
                  isVerified: true,
                  status: 'approved',
                })
                .returning({ id: vendors.id });
              vendorId = insertedVendor.id;
            }
            vendorMap.set(item.vendor, vendorId);
          }

          const computedBasePrice =
            item.category === 'pooja_box'
              ? (item.items || []).reduce((acc, it) => acc + it.price * it.qty, 0)
              : item.basePrice || 500;

          const [insertedListing] = await db
            .insert(listings)
            .values({
              vendorId,
              vendorName: item.vendor,
              category: item.category,
              poojaTag: item.poojaTag,
              slug: item.slug,
              title: item.title,
              image: item.image,
              location: item.location,
              ratingAvg: item.rating,
              ratingCount: item.reviews.length,
              deliveryTime: item.deliveryTime,
              isGlobal: item.isGlobal,
              description: item.description,
              basePrice: computedBasePrice,
              subscriptionCycle: item.subscriptionCycle || 'मासिक (हर पूर्णिमा)',
              masterCategoriesJson: item.masterCategories,
              tagsJson: item.tags,
              status: 'active',
            })
            .onConflictDoNothing()
            .returning({ id: listings.id });

          if (!insertedListing) continue;
          const listingId = insertedListing.id;

          if (item.items && item.items.length > 0) {
            await db.insert(listingItems).values(
              item.items.map((sub, idx) => ({
                listingId,
                name: sub.name,
                unit: sub.unit,
                price: sub.price,
                defaultQty: sub.qty,
                isDefaultChecked: sub.checked,
                sortOrder: idx + 1,
              }))
            );
          }

          if (item.pujaTypes && item.pujaTypes.length > 0) {
            await db.insert(listingVariants).values(
              item.pujaTypes.map((label, idx) => ({
                listingId,
                type: 'pooja_type',
                label,
                price: extractOptionPrice(label, computedBasePrice),
                sortOrder: idx + 1,
              }))
            );
          }

          if (item.sizes && item.sizes.length > 0) {
            await db.insert(listingVariants).values(
              item.sizes.map((label, idx) => ({
                listingId,
                type: 'size',
                label,
                price: extractOptionPrice(label, computedBasePrice),
                sortOrder: idx + 1,
              }))
            );
          }

          if (item.reviews && item.reviews.length > 0) {
            await db.insert(reviews).values(
              item.reviews.map((rev) => ({
                listingId,
                authorName: rev.author,
                rating: rev.rating,
                comment: rev.comment,
                status: 'published',
              }))
            );
          }
        }
      }

      await ensureRoleAccountsAndProfiles();
      seededDone = true;
    } catch (error) {
      seedPromise = null;
      console.error('Database seed failed:', error);
      throw new Error('Failed to initialize catalog data.', { cause: error });
    }
  })();

  return seedPromise;
}
