import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  addresses,
  authTokens,
  customPujaLists,
  donations,
  listings,
  loginAttempts,
  notifications,
  orderItems,
  orders,
  orderStatusHistory,
  panditBookings,
  panditProfiles,
  subscriptions,
  users,
  vendors,
  wishlist,
} from '../db/schema.ts';
import { ensureSeeded } from '../db/seed.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  AuthRequest,
  clearUserSession,
  createUserSession,
  generateToken,
  hashToken,
  optionalAuth,
  requireAuth,
  serializeUser,
  upsertGoogleUser,
} from '../middleware/auth.ts';

const router = Router();

function getClientIp(req: AuthRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.ip || 'unknown';
}

function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 8) return 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return 'पासवर्ड में कम से कम 1 अक्षर (letter) और 1 अंक (number) होना आवश्यक है।';
  }
  return null;
}

// POST /api/auth/register
router.post('/auth/register', async (req: AuthRequest, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').toLowerCase().trim();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');

    if (name.length < 2) {
      return res.status(400).json({ success: false, error: 'कृपया अपना पूरा नाम लिखें।' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'कृपया सही ईमेल पता दर्ज करें।' });
    }
    const pwErr = validatePassword(password);
    if (pwErr) {
      return res.status(400).json({ success: false, error: pwErr });
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'यह ईमेल पहले से पंजीकृत है। कृपया लॉगिन करें या Google से साइन इन करें।',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const bootstrapAdminEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'bksahani999@gmail.com').toLowerCase();
    const rawAccountType = String(req.body.accountType || 'customer').toLowerCase();
    const requestedRole = ['customer', 'vendor', 'pandit'].includes(rawAccountType)
      ? rawAccountType
      : 'customer';
    const role = email === bootstrapAdminEmail ? 'super_admin' : requestedRole;

    const [created] = await db
      .insert(users)
      .values({
        uid: `local_${generateToken(12)}`,
        name,
        email,
        phone: phone || null,
        passwordHash,
        role,
        status: 'active',
        lastLoginAt: new Date(),
      })
      .returning();

    let vendorProfile = null;
    let panditProfile = null;

    if (role === 'vendor') {
      const shopName = String(req.body.shopName || `${name} पूजा भंडार`).trim();
      const city = String(req.body.city || 'Sakchi, Jamshedpur').trim();
      const [v] = await db
        .insert(vendors)
        .values({
          userId: created.id,
          shopName,
          location: city,
          phone: phone || '9876543210',
          description: `${shopName} — शुद्ध पूजा सामग्री एवं किट विक्रेता।`,
          isVerified: false,
          status: 'pending',
        })
        .returning();
      vendorProfile = v;
    } else if (role === 'pandit') {
      const city = String(req.body.city || 'Jamshedpur').trim();
      const exp = Math.max(1, Math.min(60, parseInt(String(req.body.experienceYears || '5'), 10) || 5));
      const education = String(req.body.education || 'शास्त्री / वैदिक कर्मकांड आचार्य').trim();
      const [p] = await db
        .insert(panditProfiles)
        .values({
          userId: created.id,
          fullName: name,
          title: 'वैदिक कर्मकांड विद्वान',
          phone: phone || '9876543210',
          city,
          serviceAreasJson: [city],
          experienceYears: exp,
          education,
          languagesJson: ['हिन्दी', 'संस्कृत'],
          specializationsJson: ['सत्यनारायण कथा', 'गृह प्रवेश', 'रुद्राभिषेक'],
          bio: `${name} — ${exp}+ वर्षों के अनुभव के साथ वैदिक विधि-विधान से पूजन एवं अनुष्ठान।`,
          photoUrl: `https://placehold.co/320x240/fff3e0/dc3545?text=${encodeURIComponent(name.slice(0, 14))}`,
          baseDakshina: 1100,
          isVerified: false,
          status: 'pending',
        })
        .returning();
      panditProfile = p;
    }

    // Generate email verification token (24h expiry)
    const verifyRaw = generateToken(24);
    await db.insert(authTokens).values({
      userId: created.id,
      type: 'verify_email',
      tokenHash: hashToken(verifyRaw),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await db.insert(notifications).values({
      userId: created.id,
      title: '🙏 PujaJunction.com में आपका स्वागत है!',
      body:
        role === 'vendor'
          ? 'आपका वेंडर खाता बन गया है। आप अभी अपने स्टोर की सेटिंग्स व प्रोडक्ट्स तैयार कर सकते हैं (सुपर एडमिन वेरिफिकेशन प्रतीक्षारत)।'
          : role === 'pandit'
          ? 'आपका पंडित जी प्रोफ़ाइल बन गया है। अपनी पूजा सेवाएं व दक्षिणा सेट करें — वेरिफिकेशन के बाद यह लाइव होगा।'
          : 'आपका खाता सफलतापूर्वक बन गया है। कृपया अपना ईमेल सत्यापित करें।',
    });

    const sessionToken = await createUserSession(created.id, res, true, req);

    res.status(201).json({
      success: true,
      data: {
        user: serializeUser(created),
        vendorProfile,
        panditProfile,
        verificationToken: verifyRaw,
        sessionToken,
      },
    });
  } catch (error) {
    console.error('Register failed:', error);
    res.status(500).json({ success: false, error: 'खाता बनाने में समस्या आई। कृपया पुनः प्रयास करें।' });
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    const remember = req.body.remember !== false;
    const ip = getClientIp(req);

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'कृपया ईमेल और पासवर्ड दोनों दर्ज करें।' });
    }

    // Rate limiting: max 5 failed logins per 15 min per IP + email
    const windowStart = new Date(Date.now() - 15 * 60 * 1000);
    const recentFailures = await db
      .select()
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ip, ip),
          eq(loginAttempts.email, email),
          eq(loginAttempts.success, false),
          gt(loginAttempts.attemptedAt, windowStart)
        )
      );

    if (recentFailures.length >= 5) {
      return res.status(429).json({
        success: false,
        error: 'बहुत अधिक असफल प्रयास। कृपया 15 मिनट बाद पुनः प्रयास करें।',
      });
    }

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = found[0];

    if (!user || !user.passwordHash) {
      await db.insert(loginAttempts).values({ ip, email, success: false });
      return res.status(401).json({ success: false, error: 'Email या password गलत है।' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, error: 'आपका खाता अस्थायी रूप से ब्लॉक है।' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      await db.insert(loginAttempts).values({ ip, email, success: false });
      return res.status(401).json({ success: false, error: 'Email या password गलत है।' });
    }

    await db.insert(loginAttempts).values({ ip, email, success: true });
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const sessionToken = await createUserSession(user.id, res, remember, req);

    res.json({
      success: true,
      data: { user: serializeUser(user), sessionToken },
    });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ success: false, error: 'लॉगिन में समस्या आई।' });
  }
});

// POST /api/auth/google
router.post('/auth/google', async (req: AuthRequest, res) => {
  try {
    const authHeader = req.headers.authorization;
    const idToken =
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '') ||
      String(req.body.idToken || '').trim();

    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Google टोकन प्राप्त नहीं हुआ।' });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const dbUser = await upsertGoogleUser({
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      email_verified: decoded.email_verified,
    });

    if (dbUser.status === 'blocked') {
      return res.status(403).json({ success: false, error: 'आपका खाता ब्लॉक है।' });
    }

    const sessionToken = await createUserSession(dbUser.id, res, true, req);

    res.json({
      success: true,
      data: { user: serializeUser(dbUser), sessionToken },
    });
  } catch (error) {
    console.error('Google auth failed:', error);
    res.status(401).json({ success: false, error: 'Google सत्यापन विफल रहा। कृपया पुनः प्रयास करें।' });
  }
});

// POST /api/auth/verify-email
router.post('/auth/verify-email', async (req: AuthRequest, res) => {
  try {
    const token = String(req.body.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, error: 'सत्यापन टोकन आवश्यक है।' });
    }

    const tokenHash = hashToken(token);
    const rows = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, 'verify_email'),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'सत्यापन लिंक अमान्य या समाप्त हो चुका है।' });
    }

    const record = rows[0];
    await db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(eq(authTokens.id, record.id));

    const [updatedUser] = await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, record.userId))
      .returning();

    res.json({
      success: true,
      data: { user: serializeUser(updatedUser) },
    });
  } catch (error) {
    console.error('Verify email failed:', error);
    res.status(500).json({ success: false, error: 'ईमेल सत्यापन विफल रहा।' });
  }
});

// POST /api/auth/resend-verification
router.post('/auth/resend-verification', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    if (user.emailVerifiedAt) {
      return res.json({ success: true, data: { alreadyVerified: true } });
    }
    const verifyRaw = generateToken(24);
    await db.insert(authTokens).values({
      userId: user.id,
      type: 'verify_email',
      tokenHash: hashToken(verifyRaw),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    res.json({
      success: true,
      data: { verificationToken: verifyRaw },
    });
  } catch (error) {
    console.error('Resend verification failed:', error);
    res.status(500).json({ success: false, error: 'सत्यापन टोकन भेजने में त्रुटि।' });
  }
});

// POST /api/auth/forgot-password
router.post('/auth/forgot-password', async (req: AuthRequest, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ success: false, error: 'कृपया अपना ईमेल दर्ज करें।' });
    }

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let resetToken: string | null = null;
    if (found.length > 0) {
      resetToken = generateToken(24);
      await db.insert(authTokens).values({
        userId: found[0].id,
        type: 'reset_password',
        tokenHash: hashToken(resetToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      });
    }

    res.json({
      success: true,
      data: {
        message: 'यदि यह ईमेल पंजीकृत है, तो रीसेट कोड तैयार हो गया है (1 घंटे के लिए वैध)।',
        resetToken, // Returned so user can test full password reset flow without external SMTP
      },
    });
  } catch (error) {
    console.error('Forgot password failed:', error);
    res.status(500).json({ success: false, error: 'पासवर्ड रीसेट अनुरोध विफल रहा।' });
  }
});

// POST /api/auth/reset-password
router.post('/auth/reset-password', async (req: AuthRequest, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');

    const pwErr = validatePassword(newPassword);
    if (pwErr) return res.status(400).json({ success: false, error: pwErr });

    const tokenHash = hashToken(token);
    const rows = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, 'reset_password'),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'रीसेट कोड अमान्य या समाप्त हो गया है।' });
    }

    const record = rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, record.id));
    // Invalidate all existing sessions for security
    await db
      .delete(authTokens)
      .where(and(eq(authTokens.userId, record.userId), eq(authTokens.type, 'session')));

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, record.userId));

    res.json({
      success: true,
      data: { message: 'पासवर्ड सफलतापूर्वक बदल दिया गया है। अब नए पासवर्ड से लॉगिन करें।' },
    });
  } catch (error) {
    console.error('Reset password failed:', error);
    res.status(500).json({ success: false, error: 'पासवर्ड रीसेट करने में समस्या आई।' });
  }
});

// POST /api/auth/change-password
router.post('/auth/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const pwErr = validatePassword(newPassword);
    if (pwErr) return res.status(400).json({ success: false, error: pwErr });

    const [dbUser] = await db.select().from(users).where(eq(users.id, req.authUser!.id)).limit(1);
    if (!dbUser) return res.status(404).json({ success: false, error: 'उपयोगकर्ता नहीं मिला।' });

    if (dbUser.passwordHash) {
      const ok = await bcrypt.compare(currentPassword, dbUser.passwordHash);
      if (!ok) {
        return res.status(400).json({ success: false, error: 'वर्तमान पासवर्ड गलत है।' });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    const [updated] = await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, dbUser.id))
      .returning();

    res.json({ success: true, data: { user: serializeUser(updated) } });
  } catch (error) {
    console.error('Change password failed:', error);
    res.status(500).json({ success: false, error: 'पासवर्ड अपडेट विफल रहा।' });
  }
});

// POST /api/auth/logout
router.post('/auth/logout', async (req: AuthRequest, res) => {
  await clearUserSession(req, res);
  res.json({ success: true, data: { loggedOut: true } });
});

// POST /api/auth/logout-all
router.post('/auth/logout-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .delete(authTokens)
      .where(and(eq(authTokens.userId, req.authUser!.id), eq(authTokens.type, 'session')));
    res.clearCookie('pj_session', { path: '/' });
    res.json({ success: true, data: { loggedOutAll: true } });
  } catch (error) {
    console.error('Logout all failed:', error);
    res.status(500).json({ success: false, error: 'लॉगआउट विफल रहा।' });
  }
});

// GET /api/auth/me
router.get('/auth/me', optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.authUser) {
      return res.json({ success: true, data: { user: null } });
    }

    const uid = req.authUser.id;
    const [
      userAddresses,
      userWishlist,
      userNotifications,
      userVendor,
      userPandit,
      userDonations,
      userSubs,
    ] = await Promise.all([
      db.select().from(addresses).where(eq(addresses.userId, uid)).orderBy(desc(addresses.isDefault)),
      db.select().from(wishlist).where(eq(wishlist.userId, uid)),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, uid))
        .orderBy(desc(notifications.createdAt))
        .limit(30),
      db.select().from(vendors).where(eq(vendors.userId, uid)).limit(1),
      db.select().from(panditProfiles).where(eq(panditProfiles.userId, uid)).limit(1),
      db
        .select()
        .from(donations)
        .where(eq(donations.userId, uid))
        .orderBy(desc(donations.createdAt))
        .limit(20),
      db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, uid))
        .orderBy(desc(subscriptions.createdAt)),
    ]);

    res.json({
      success: true,
      data: {
        user: req.authUser,
        addresses: userAddresses,
        wishlistIds: userWishlist.map((w) => w.listingId),
        notifications: userNotifications,
        vendorProfile: userVendor[0] || null,
        panditProfile: userPandit[0] || null,
        donations: userDonations,
        subscriptions: userSubs,
      },
    });
  } catch (error) {
    console.error('Get me failed:', error);
    res.status(500).json({ success: false, error: 'प्रोफ़ाइल लोड करने में समस्या आई।' });
  }
});

// GET /api/user/dashboard (Complete User Panel payload)
router.get('/user/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.authUser!.id;
    const [
      userOrders,
      userSubs,
      userLists,
      userDonations,
      userAddresses,
      userWishlist,
      userNotifs,
    ] = await Promise.all([
      db.select().from(orders).where(eq(orders.userId, uid)).orderBy(desc(orders.createdAt)),
      db
        .select({
          subscription: subscriptions,
          listingTitle: listings.title,
          vendorName: listings.vendorName,
        })
        .from(subscriptions)
        .leftJoin(listings, eq(subscriptions.listingId, listings.id))
        .where(eq(subscriptions.userId, uid))
        .orderBy(desc(subscriptions.createdAt)),
      db
        .select()
        .from(customPujaLists)
        .where(eq(customPujaLists.userId, uid))
        .orderBy(desc(customPujaLists.createdAt)),
      db.select().from(donations).where(eq(donations.userId, uid)).orderBy(desc(donations.createdAt)),
      db
        .select()
        .from(addresses)
        .where(eq(addresses.userId, uid))
        .orderBy(desc(addresses.isDefault), desc(addresses.createdAt)),
      db.select().from(wishlist).where(eq(wishlist.userId, uid)),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, uid))
        .orderBy(desc(notifications.createdAt))
        .limit(40),
    ]);

    const orderIds = userOrders.map((o) => o.id);
    const [allOrderItems, allOrderHistory, userPanditBookings] = await Promise.all([
      orderIds.length > 0
        ? db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
        : Promise.resolve([]),
      orderIds.length > 0
        ? db
            .select()
            .from(orderStatusHistory)
            .where(inArray(orderStatusHistory.orderId, orderIds))
            .orderBy(desc(orderStatusHistory.createdAt))
        : Promise.resolve([]),
      orderIds.length > 0
        ? db
            .select({
              booking: panditBookings,
              listingTitle: listings.title,
              panditName: panditProfiles.fullName,
              panditPhone: panditProfiles.phone,
            })
            .from(panditBookings)
            .leftJoin(listings, eq(panditBookings.listingId, listings.id))
            .leftJoin(panditProfiles, eq(panditBookings.panditProfileId, panditProfiles.id))
            .where(inArray(panditBookings.orderId, orderIds))
            .orderBy(desc(panditBookings.createdAt))
        : Promise.resolve([]),
    ]);

    const wishlistListingIds = userWishlist.map((w) => w.listingId);
    const wishlistListings =
      wishlistListingIds.length > 0
        ? await db.select().from(listings).where(inArray(listings.id, wishlistListingIds))
        : [];

    const totalSpent = userOrders
      .filter((o) => !o.cancelledAt)
      .reduce((acc, o) => acc + o.total, 0);
    const totalDonated = userDonations.reduce((acc, d) => acc + d.amount, 0);

    res.json({
      success: true,
      data: {
        stats: {
          ordersCount: userOrders.length,
          activeOrders: userOrders.filter((o) => !o.cancelledAt && o.statusStep < 3).length,
          panditBookingsCount: userPanditBookings.length,
          activeSubscriptions: userSubs.filter((s) => s.subscription.status === 'active').length,
          totalSpent,
          totalDonated,
          wishlistCount: wishlistListings.length,
          unreadNotifications: userNotifs.filter((n) => !n.isRead).length,
        },
        orders: userOrders.map((o) => ({
          ...o,
          items: allOrderItems.filter((i) => i.orderId === o.id),
          history: allOrderHistory.filter((h) => h.orderId === o.id),
        })),
        panditBookings: userPanditBookings.map((r) => ({
          ...r.booking,
          listingTitle: r.listingTitle || 'पंडित जी बुकिंग',
          panditName: r.panditName || r.listingTitle || 'वैदिक पंडित जी',
          panditPhone: r.panditPhone || null,
        })),
        subscriptions: userSubs.map((r) => ({
          ...r.subscription,
          listingTitle: r.listingTitle || 'पूजा किट',
          vendorName: r.vendorName || 'PujaJunction.com',
        })),
        customLists: userLists,
        donations: userDonations,
        addresses: userAddresses,
        wishlistListings,
        notifications: userNotifs,
      },
    });
  } catch (error) {
    console.error('User dashboard failed:', error);
    res.status(500).json({ success: false, error: 'यूज़र पैनल लोड नहीं हो सका।' });
  }
});

// PATCH /api/me
router.patch('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    if (name.length < 2) {
      return res.status(400).json({ success: false, error: 'नाम कम से कम 2 अक्षरों का होना चाहिए।' });
    }

    const [updated] = await db
      .update(users)
      .set({ name, phone: phone || null, updatedAt: new Date() })
      .where(eq(users.id, req.authUser!.id))
      .returning();

    res.json({ success: true, data: { user: serializeUser(updated) } });
  } catch (error) {
    console.error('Update profile failed:', error);
    res.status(500).json({ success: false, error: 'प्रोफ़ाइल अपडेट विफल रहा।' });
  }
});

// DELETE /api/me
router.delete('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(users).where(eq(users.id, req.authUser!.id));
    res.clearCookie('pj_session', { path: '/' });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Delete account failed:', error);
    res.status(500).json({ success: false, error: 'खाता हटाने में समस्या आई।' });
  }
});

// Addresses CRUD
router.get('/addresses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, req.authUser!.id))
      .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Fetch addresses failed:', error);
    res.status(500).json({ success: false, error: 'पते लोड नहीं हो सके।' });
  }
});

router.post('/addresses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { label, name, phone, addressLine, city, pincode, state, isDefault } = req.body;
    if (!name || !phone || !addressLine) {
      return res.status(400).json({ success: false, error: 'नाम, मोबाइल और पता आवश्यक है।' });
    }

    if (isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, req.authUser!.id));
    }

    const [created] = await db
      .insert(addresses)
      .values({
        userId: req.authUser!.id,
        label: String(label || 'घर').trim(),
        name: String(name).trim(),
        phone: String(phone).trim(),
        addressLine: String(addressLine).trim(),
        city: String(city || '').trim(),
        pincode: String(pincode || '').trim(),
        state: String(state || '').trim(),
        isDefault: Boolean(isDefault),
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Create address failed:', error);
    res.status(500).json({ success: false, error: 'पता सेव नहीं हो सका।' });
  }
});

router.patch('/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { isDefault, label, name, phone, addressLine, city, pincode, state } = req.body;

    if (isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, req.authUser!.id));
    }

    const updatePayload: Partial<typeof addresses.$inferInsert> = {};
    if (label !== undefined) updatePayload.label = String(label).trim();
    if (name !== undefined) updatePayload.name = String(name).trim();
    if (phone !== undefined) updatePayload.phone = String(phone).trim();
    if (addressLine !== undefined) updatePayload.addressLine = String(addressLine).trim();
    if (city !== undefined) updatePayload.city = String(city).trim();
    if (pincode !== undefined) updatePayload.pincode = String(pincode).trim();
    if (state !== undefined) updatePayload.state = String(state).trim();
    if (isDefault !== undefined) updatePayload.isDefault = Boolean(isDefault);

    const [updated] = await db
      .update(addresses)
      .set(updatePayload)
      .where(and(eq(addresses.id, id), eq(addresses.userId, req.authUser!.id)))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: 'पता नहीं मिला।' });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update address failed:', error);
    res.status(500).json({ success: false, error: 'पता अपडेट नहीं हो सका।' });
  }
});

router.delete('/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db
      .delete(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, req.authUser!.id)));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Delete address failed:', error);
    res.status(500).json({ success: false, error: 'पता हटाया नहीं जा सका।' });
  }
});

// Wishlist toggle
router.post('/wishlist/:listingId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listingId = parseInt(req.params.listingId, 10);
    const existing = await db
      .select()
      .from(wishlist)
      .where(and(eq(wishlist.userId, req.authUser!.id), eq(wishlist.listingId, listingId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(wishlist).where(eq(wishlist.id, existing[0].id));
      return res.json({ success: true, data: { saved: false, listingId } });
    }

    await db.insert(wishlist).values({ userId: req.authUser!.id, listingId });
    res.json({ success: true, data: { saved: true, listingId } });
  } catch (error) {
    console.error('Wishlist toggle failed:', error);
    res.status(500).json({ success: false, error: 'विशलिस्ट अपडेट विफल।' });
  }
});

// Notifications mark read
router.post('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.authUser!.id));
    res.json({ success: true, data: { readAll: true } });
  } catch (error) {
    console.error('Notifications mark read failed:', error);
    res.status(500).json({ success: false, error: 'नोटिफिकेशन अपडेट विफल।' });
  }
});

export default router;
