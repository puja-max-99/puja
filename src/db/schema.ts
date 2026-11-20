import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Users (supports Google OAuth via Firebase Auth AND Email+Password)
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerifiedAt: timestamp('email_verified_at'),
    passwordHash: text('password_hash'),
    googleId: text('google_id').unique(),
    avatarUrl: text('avatar_url'),
    phone: text('phone'),
    role: text('role').notNull().default('customer'), // 'customer' | 'vendor' | 'pandit' | 'super_admin' | 'admin'
    status: text('status').notNull().default('active'), // 'active' | 'blocked'
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('users_role_idx').on(table.role)]
);

// 2. Auth Tokens (sessions, email verification, password reset)
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(), // 'session' | 'verify_email' | 'reset_password'
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('auth_tokens_user_type_idx').on(table.userId, table.type)]
);

// 3. Login Attempts (rate limiting)
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    ip: text('ip').notNull(),
    email: text('email').notNull(),
    success: boolean('success').notNull().default(false),
    attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
  },
  (table) => [index('login_attempts_ip_email_idx').on(table.ip, table.email)]
);

// 4. Addresses
export const addresses = pgTable(
  'addresses',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    label: text('label').notNull().default('घर'),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    addressLine: text('address_line').notNull(),
    city: text('city').notNull().default(''),
    pincode: text('pincode').notNull().default(''),
    state: text('state').notNull().default(''),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('addresses_user_idx').on(table.userId)]
);

// 5. Vendors (WooCommerce-grade Store Settings)
export const vendors = pgTable(
  'vendors',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    shopName: text('shop_name').notNull(),
    location: text('location').notNull(),
    phone: text('phone').notNull().default(''),
    description: text('description').notNull().default(''),
    storeBannerUrl: text('store_banner_url').notNull().default(''),
    gstNumber: text('gst_number').notNull().default(''),
    upiId: text('upi_id').notNull().default(''),
    bankAccount: text('bank_account').notNull().default(''),
    shippingFee: integer('shipping_fee').notNull().default(0),
    freeShippingAbove: integer('free_shipping_above').notNull().default(499),
    codEnabled: boolean('cod_enabled').notNull().default(true),
    commissionRate: integer('commission_rate').notNull().default(8),
    isVerified: boolean('is_verified').notNull().default(false),
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'suspended'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('vendors_status_idx').on(table.status)]
);

// 5b. Pandit Ji Profiles (Full Listing-Profile for Vedic Pandits)
export const panditProfiles = pgTable(
  'pandit_profiles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    fullName: text('full_name').notNull(),
    title: text('title').notNull().default('वैदिक आचार्य एवं कर्मकांड विशेषज्ञ'),
    phone: text('phone').notNull().default(''),
    city: text('city').notNull().default('Sakchi, Jamshedpur'),
    serviceAreasJson: jsonb('service_areas_json').$type<string[]>().notNull().default([]),
    experienceYears: integer('experience_years').notNull().default(10),
    education: text('education').notNull().default('काशी वैदिक पाठशाला (आचार्य)'),
    languagesJson: jsonb('languages_json').$type<string[]>().notNull().default(['हिंदी', 'संस्कृत']),
    specializationsJson: jsonb('specializations_json').$type<string[]>().notNull().default([]),
    bio: text('bio').notNull().default(''),
    photoUrl: text('photo_url').notNull().default(''),
    baseDakshina: integer('base_dakshina').notNull().default(1100),
    onlinePujaAvailable: boolean('online_puja_available').notNull().default(true),
    travelAvailable: boolean('travel_available').notNull().default(true),
    availabilityStatus: text('availability_status').notNull().default('available'), // 'available' | 'busy' | 'on_leave'
    availableDaysJson: jsonb('available_days_json')
      .$type<string[]>()
      .notNull()
      .default(['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि']),
    blockedDatesJson: jsonb('blocked_dates_json').$type<string[]>().notNull().default([]),
    upiId: text('upi_id').notNull().default(''),
    isVerified: boolean('is_verified').notNull().default(false),
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
    ratingAvg: real('rating_avg').notNull().default(4.9),
    completedPujas: integer('completed_pujas').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('pandit_profiles_status_idx').on(table.status)]
);

// 6. Master Categories (17 Hindu Puja Categories)
export const masterCategories = pgTable('master_categories', {
  id: text('id').primaryKey(), // 'cat01' .. 'cat17'
  code: text('code').notNull(),
  deity: text('deity').notNull(),
  hinglish: text('hinglish').notNull().default(''),
  itemsJson: jsonb('items_json').$type<string[]>().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

// 7. Listings (Pooja Kits, Pandits, Murtis, Photo Frames — with WooCommerce inventory fields)
export const listings = pgTable(
  'listings',
  {
    id: serial('id').primaryKey(),
    vendorId: integer('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
    panditProfileId: integer('pandit_profile_id').references(() => panditProfiles.id, { onDelete: 'set null' }),
    vendorName: text('vendor_name').notNull(),
    category: text('category').notNull(), // 'pooja_box' | 'pandit' | 'murti' | 'photo'
    poojaTag: text('pooja_tag').notNull().default('satyanarayan'),
    slug: text('slug').notNull().unique(),
    sku: text('sku').notNull().default(''),
    title: text('title').notNull(),
    image: text('image').notNull(),
    location: text('location').notNull().default('Sakchi, Jamshedpur'),
    ratingAvg: real('rating_avg').notNull().default(4.8),
    ratingCount: integer('rating_count').notNull().default(0),
    deliveryTime: text('delivery_time').notNull().default('30-40 मि.'),
    isGlobal: boolean('is_global').notNull().default(true),
    description: text('description').notNull().default(''),
    basePrice: integer('base_price').notNull().default(0),
    salePrice: integer('sale_price'),
    stockQty: integer('stock_qty').notNull().default(50),
    stockStatus: text('stock_status').notNull().default('instock'), // 'instock' | 'low_stock' | 'outofstock'
    subscriptionCycle: text('subscription_cycle').notNull().default('मासिक (हर पूर्णिमा)'),
    masterCategoriesJson: jsonb('master_categories_json').$type<string[]>().notNull().default([]),
    tagsJson: jsonb('tags_json').$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('active'), // 'active' | 'paused' | 'pending'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('listings_category_idx').on(table.category),
    index('listings_pooja_tag_idx').on(table.poojaTag),
    index('listings_status_idx').on(table.status),
  ]
);

// 8. Listing Items (Kit Samagri items)
export const listingItems = pgTable(
  'listing_items',
  {
    id: serial('id').primaryKey(),
    listingId: integer('listing_id')
      .references(() => listings.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    unit: text('unit').notNull().default('1 पैक'),
    price: integer('price').notNull().default(50),
    defaultQty: integer('default_qty').notNull().default(1),
    isDefaultChecked: boolean('is_default_checked').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('listing_items_listing_idx').on(table.listingId)]
);

// 9. Listing Variants (Pandit puja types / Murti & Photo sizes)
export const listingVariants = pgTable(
  'listing_variants',
  {
    id: serial('id').primaryKey(),
    listingId: integer('listing_id')
      .references(() => listings.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(), // 'pooja_type' | 'size'
    label: text('label').notNull(),
    price: integer('price').notNull().default(500),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('listing_variants_listing_idx').on(table.listingId)]
);

// 10. Search Aliases (Hindi/English bilingual search)
export const searchAliases = pgTable(
  'search_aliases',
  {
    id: serial('id').primaryKey(),
    groupKey: text('group_key').notNull(),
    term: text('term').notNull(),
  },
  (table) => [index('search_aliases_group_idx').on(table.groupKey)]
);

// 11. Recent Searches
export const recentSearches = pgTable(
  'recent_searches',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('recent_searches_user_idx').on(table.userId)]
);

// 12. Cart Items (Server-side persistent cart for logged-in users)
export const cartItems = pgTable(
  'cart_items',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    listingId: integer('listing_id').references(() => listings.id, { onDelete: 'set null' }),
    itemType: text('item_type').notNull().default('pooja_box'), // 'pooja_box' | 'pandit' | 'murti' | 'photo' | 'custom_list'
    title: text('title').notNull(),
    vendorName: text('vendor_name').notNull(),
    details: text('details').notNull(),
    selectedItemsJson: jsonb('selected_items_json').$type<Array<{ id?: number; name: string; qty: number; price: number }>>(),
    variantId: integer('variant_id'),
    variantLabel: text('variant_label'),
    pujaDate: text('puja_date'),
    pujaLocation: text('puja_location'),
    subscriptionEnabled: boolean('subscription_enabled').notNull().default(false),
    subscriptionCycle: text('subscription_cycle'),
    unitPrice: integer('unit_price').notNull(),
    qty: integer('qty').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('cart_items_user_idx').on(table.userId)]
);

// 13. Orders
export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(), // e.g. 'PJ-4012'
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    orderType: text('order_type').notNull().default('पूजा किट'),
    subtotal: integer('subtotal').notNull(),
    discount: integer('discount').notNull().default(0),
    total: integer('total').notNull(),
    promoCode: text('promo_code'),
    paymentMethod: text('payment_method').notNull().default('UPI'),
    paymentStatus: text('payment_status').notNull().default('pending'),
    statusStep: integer('status_step').notNull().default(0), // 0..3
    customerName: text('customer_name').notNull(),
    phone: text('phone').notNull(),
    addressLine: text('address_line').notNull(),
    pincode: text('pincode').notNull().default(''),
    notes: text('notes').notNull().default(''),
    cancelledAt: timestamp('cancelled_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('orders_user_idx').on(table.userId),
    index('orders_created_idx').on(table.createdAt),
  ]
);

// 14. Order Items
export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: text('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    listingId: integer('listing_id').references(() => listings.id, { onDelete: 'set null' }),
    vendorId: integer('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
    vendorName: text('vendor_name').notNull(),
    titleSnapshot: text('title_snapshot').notNull(),
    detailsSnapshot: text('details_snapshot').notNull(),
    price: integer('price').notNull(),
    qty: integer('qty').notNull().default(1),
  },
  (table) => [
    index('order_items_order_idx').on(table.orderId),
    index('order_items_vendor_idx').on(table.vendorId),
  ]
);

// 15. Order Status History
export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: serial('id').primaryKey(),
    orderId: text('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    step: integer('step').notNull(),
    note: text('note').notNull().default(''),
    changedByUserId: integer('changed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('order_status_history_order_idx').on(table.orderId)]
);

// 16. Pandit Bookings
export const panditBookings = pgTable(
  'pandit_bookings',
  {
    id: serial('id').primaryKey(),
    orderId: text('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    listingId: integer('listing_id').references(() => listings.id, { onDelete: 'set null' }),
    panditProfileId: integer('pandit_profile_id').references(() => panditProfiles.id, {
      onDelete: 'set null',
    }),
    pujaDate: text('puja_date').notNull(),
    muhurat: text('muhurat').notNull().default('अभिजीत मुहूर्त'),
    location: text('location').notNull(),
    pujaType: text('puja_type').notNull(),
    dakshinaAmount: integer('dakshina_amount').notNull().default(1100),
    customerName: text('customer_name').notNull().default(''),
    customerPhone: text('customer_phone').notNull().default(''),
    panditNotes: text('pandit_notes').notNull().default(''),
    status: text('status').notNull().default('confirmed'), // 'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('pandit_bookings_order_idx').on(table.orderId),
    index('pandit_bookings_pandit_idx').on(table.panditProfileId),
  ]
);

// 17. Subscriptions
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    listingId: integer('listing_id')
      .references(() => listings.id, { onDelete: 'cascade' })
      .notNull(),
    cycle: text('cycle').notNull(),
    nextDeliveryDate: text('next_delivery_date').notNull(),
    price: integer('price').notNull().default(0),
    status: text('status').notNull().default('active'), // 'active' | 'paused' | 'cancelled'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('subscriptions_user_idx').on(table.userId)]
);

// 18. Custom Puja Lists
export const customPujaLists = pgTable(
  'custom_puja_lists',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    pujaName: text('puja_name').notNull(),
    filePath: text('file_path'),
    fileName: text('file_name'),
    manualItemsJson: jsonb('manual_items_json').$type<Array<{ name: string; qty: string }>>().notNull().default([]),
    needPandit: boolean('need_pandit').notNull().default(false),
    pujaDate: text('puja_date'),
    customerName: text('customer_name').notNull(),
    phone: text('phone').notNull(),
    address: text('address').notNull(),
    status: text('status').notNull().default('submitted'), // 'submitted' | 'quoted' | 'converted'
    quotedPrice: integer('quoted_price'),
    orderId: text('order_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('custom_puja_lists_user_idx').on(table.userId)]
);

// 19. Reviews
export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    listingId: integer('listing_id')
      .references(() => listings.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    vendorReply: text('vendor_reply'),
    status: text('status').notNull().default('published'), // 'published' | 'hidden'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('reviews_listing_idx').on(table.listingId)]
);

// 20. Promo Codes (Global Super Admin + Vendor Store Coupons)
export const promoCodes = pgTable('promo_codes', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').references(() => vendors.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  type: text('type').notNull(), // 'percent' | 'flat'
  value: integer('value').notNull(),
  minOrder: integer('min_order').notNull().default(0),
  maxDiscount: integer('max_discount'),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 20b. Payout & Settlement Requests (Vendor & Pandit withdrawals managed by Super Admin)
export const payoutRequests = pgTable(
  'payout_requests',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    roleType: text('role_type').notNull(), // 'vendor' | 'pandit'
    vendorId: integer('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
    panditProfileId: integer('pandit_profile_id').references(() => panditProfiles.id, {
      onDelete: 'set null',
    }),
    amount: integer('amount').notNull(),
    upiOrBank: text('upi_or_bank').notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'paid' | 'rejected'
    adminNote: text('admin_note').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('payout_requests_user_idx').on(table.userId),
    index('payout_requests_status_idx').on(table.status),
  ]
);

// 21. Donations (Seva Dakshina)
export const donations = pgTable(
  'donations',
  {
    id: text('id').primaryKey(), // e.g. 'PJ-8492'
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    donorName: text('donor_name').notNull(),
    donorCity: text('donor_city').notNull().default(''),
    cause: text('cause').notNull(),
    amount: integer('amount').notNull(),
    upiTxnRef: text('upi_txn_ref'),
    status: text('status').notNull().default('recorded'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('donations_user_idx').on(table.userId)]
);

// 22. Wishlist
export const wishlist = pgTable(
  'wishlist',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    listingId: integer('listing_id')
      .references(() => listings.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('wishlist_user_listing_uniq').on(table.userId, table.listingId)]
);

// 23. Notifications
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

// 24. Site Settings
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 25. Admin Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    adminUserId: integer('admin_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    metaJson: jsonb('meta_json').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)]
);

// Drizzle Relations
export const listingsRelations = relations(listings, ({ many, one }) => ({
  vendor: one(vendors, {
    fields: [listings.vendorId],
    references: [vendors.id],
  }),
  items: many(listingItems),
  variants: many(listingVariants),
  reviews: many(reviews),
}));

export const listingItemsRelations = relations(listingItems, ({ one }) => ({
  listing: one(listings, {
    fields: [listingItems.listingId],
    references: [listings.id],
  }),
}));

export const listingVariantsRelations = relations(listingVariants, ({ one }) => ({
  listing: one(listings, {
    fields: [listingVariants.listingId],
    references: [listings.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  listing: one(listings, {
    fields: [reviews.listingId],
    references: [listings.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
  panditBookings: many(panditBookings),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatusHistory.orderId],
    references: [orders.id],
  }),
}));

export const panditBookingsRelations = relations(panditBookings, ({ one }) => ({
  order: one(orders, {
    fields: [panditBookings.orderId],
    references: [orders.id],
  }),
}));
