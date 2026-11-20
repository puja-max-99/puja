import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { authTokens, users } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export const SESSION_COOKIE_NAME = 'pj_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthenticatedUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  googleId: string | null;
  hasPassword: boolean;
  avatarUrl: string | null;
  phone: string | null;
  role: string;
  status: string;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function serializeUser(u: typeof users.$inferSelect): AuthenticatedUser {
  return {
    id: u.id,
    uid: u.uid,
    name: u.name,
    email: u.email,
    emailVerifiedAt: u.emailVerifiedAt,
    googleId: u.googleId,
    hasPassword: Boolean(u.passwordHash),
    avatarUrl: u.avatarUrl,
    phone: u.phone,
    role: u.role,
    status: u.status,
  };
}

function isSecureRequest(req?: Request): boolean {
  if (!req) return process.env.NODE_ENV === 'production';
  const fwdProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  return Boolean(
    req.secure ||
      fwdProto.includes('https') ||
      origin.startsWith('https://') ||
      process.env.NODE_ENV === 'production'
  );
}

function getSessionTokenFromRequest(req: Request): string | null {
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim().length >= 32) {
    return headerToken.trim();
  }
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim().length >= 32) {
    return cookieToken.trim();
  }
  return null;
}

export async function createUserSession(
  userId: number,
  res: Response,
  remember = true,
  req?: Request
): Promise<string> {
  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const maxAgeMs = remember ? SESSION_DURATION_MS : 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAgeMs);

  await db.insert(authTokens).values({
    userId,
    type: 'session',
    tokenHash,
    expiresAt,
  });

  const isHttps = isSecureRequest(req);
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: maxAgeMs,
    path: '/',
  });

  return rawToken;
}

export async function clearUserSession(req: Request, res: Response): Promise<void> {
  const tokensToDelete = new Set<string>();
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim()) tokensToDelete.add(cookieToken.trim());
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) tokensToDelete.add(headerToken.trim());

  for (const rawToken of tokensToDelete) {
    const tokenHash = hashToken(rawToken);
    try {
      await db.delete(authTokens).where(eq(authTokens.tokenHash, tokenHash));
    } catch (err) {
      console.error('Error clearing session token:', err);
    }
  }

  const isHttps = isSecureRequest(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

export async function upsertGoogleUser(decoded: {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}): Promise<typeof users.$inferSelect> {
  const email = (decoded.email || '').toLowerCase().trim();
  if (!email) {
    throw new Error('Google account has no verified email.');
  }

  const bootstrapAdminEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'bksahani999@gmail.com').toLowerCase();
  const isBootstrapAdmin = email === bootstrapAdminEmail;

  // 1. Check by googleId or uid
  const byGoogle = await db
    .select()
    .from(users)
    .where(eq(users.googleId, decoded.uid))
    .limit(1);

  if (byGoogle.length > 0) {
    const existing = byGoogle[0];
    const [updated] = await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        avatarUrl: existing.avatarUrl || decoded.picture || null,
        role: isBootstrapAdmin ? 'super_admin' : existing.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  // 2. Check by verified email (link Google to existing account)
  const byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (byEmail.length > 0) {
    const existing = byEmail[0];
    const [linked] = await db
      .update(users)
      .set({
        googleId: decoded.uid,
        emailVerifiedAt: existing.emailVerifiedAt || new Date(),
        avatarUrl: existing.avatarUrl || decoded.picture || null,
        role: isBootstrapAdmin ? 'super_admin' : existing.role,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return linked;
  }

  // 3. Upsert new Google user safely
  const [created] = await db
    .insert(users)
    .values({
      uid: decoded.uid,
      googleId: decoded.uid,
      email,
      name: decoded.name || email.split('@')[0],
      avatarUrl: decoded.picture || null,
      emailVerifiedAt: new Date(),
      role: isBootstrapAdmin ? 'super_admin' : 'customer',
      status: 'active',
      lastLoginAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return created;
}

async function resolveAuthUser(req: Request): Promise<AuthenticatedUser | null> {
  // 1. Check DB-backed session token (X-Session-Token header or HttpOnly cookie)
  const rawSession = getSessionTokenFromRequest(req);
  if (rawSession) {
    const tokenHash = hashToken(rawSession);
    try {
      const rows = await db
        .select({ user: users })
        .from(authTokens)
        .innerJoin(users, eq(authTokens.userId, users.id))
        .where(
          and(
            eq(authTokens.tokenHash, tokenHash),
            eq(authTokens.type, 'session'),
            isNull(authTokens.usedAt),
            gt(authTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      if (rows.length > 0 && rows[0].user.status !== 'blocked') {
        return serializeUser(rows[0].user);
      }
    } catch (err) {
      console.error('Session lookup failed:', err);
    }
  }

  // 2. Check Firebase Bearer ID token (Google Sign-In)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const dbUser = await upsertGoogleUser({
          uid: decoded.uid,
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
          email_verified: decoded.email_verified,
        });
        if (dbUser.status === 'blocked') return null;
        return serializeUser(dbUser);
      } catch (err) {
        console.error('Firebase token verification failed:', err);
      }
    }
  }

  return null;
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const user = await resolveAuthUser(req);
    if (user) req.authUser = user;
  } catch (err) {
    console.error('optionalAuth error:', err);
  }
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'कृपया आगे बढ़ने के लिए लॉगिन करें।' });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, error: 'आपका खाता अस्थायी रूप से ब्लॉक है।' });
    }
    req.authUser = user;
    next();
  } catch (err) {
    console.error('requireAuth error:', err);
    return res.status(401).json({ success: false, error: 'सत्र समाप्त हो गया है, कृपया पुनः लॉगिन करें।' });
  }
};

export function isSuperAdminRole(role?: string | null): boolean {
  return role === 'super_admin' || role === 'admin';
}

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ success: false, error: 'लॉगिन आवश्यक है।' });
    }
    const userRole = req.authUser.role;
    const isAdmin = isSuperAdminRole(userRole);
    const adminAllowed = allowedRoles.includes('super_admin') || allowedRoles.includes('admin');
    if (!allowedRoles.includes(userRole) && !(isAdmin && (adminAllowed || allowedRoles.length > 0))) {
      return res.status(403).json({ success: false, error: 'इस अनुभाग के लिए आपके पास अनुमति नहीं है।' });
    }
    next();
  };
};
