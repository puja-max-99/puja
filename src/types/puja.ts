export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  googleId: string | null;
  hasPassword: boolean;
  avatarUrl: string | null;
  phone: string | null;
  role: 'customer' | 'vendor' | 'pandit' | 'super_admin' | 'admin' | string;
  status: string;
}

export interface UserAddress {
  id: number;
  userId: number;
  label: string;
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  pincode: string;
  state: string;
  isDefault: boolean;
}

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface VendorProfile {
  id: number;
  userId: number | null;
  shopName: string;
  location: string;
  phone: string;
  description: string;
  storeBannerUrl?: string;
  gstNumber?: string;
  upiId?: string;
  bankAccount?: string;
  shippingFee?: number;
  freeShippingAbove?: number;
  codEnabled?: boolean;
  commissionRate?: number;
  isVerified: boolean;
  status: string;
  createdAt?: string;
}

export interface PanditProfile {
  id: number;
  userId: number | null;
  fullName: string;
  title: string;
  phone: string;
  city: string;
  serviceAreasJson: string[];
  experienceYears: number;
  education: string;
  languagesJson: string[];
  specializationsJson: string[];
  bio: string;
  photoUrl: string;
  baseDakshina: number;
  onlinePujaAvailable: boolean;
  travelAvailable: boolean;
  availabilityStatus: 'available' | 'busy' | 'on_leave' | string;
  availableDaysJson: string[];
  blockedDatesJson: string[];
  upiId: string;
  isVerified: boolean;
  status: 'pending' | 'approved' | 'rejected' | string;
  ratingAvg: number;
  completedPujas: number;
  createdAt?: string;
}

export interface PanditBookingRecord {
  id: number;
  orderId: string;
  listingId: number | null;
  panditProfileId: number | null;
  pujaDate: string;
  muhurat: string;
  location: string;
  pujaType: string;
  dakshinaAmount: number;
  customerName: string;
  customerPhone: string;
  panditNotes: string;
  status: 'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed' | string;
  createdAt: string;
  listingTitle?: string;
  panditName?: string;
  panditPhone?: string | null;
}

export interface PayoutRequest {
  id: number;
  userId: number;
  roleType: 'vendor' | 'pandit' | string;
  vendorId: number | null;
  panditProfileId: number | null;
  amount: number;
  upiOrBank: string;
  status: 'pending' | 'paid' | 'rejected' | string;
  adminNote: string;
  createdAt: string;
  userName?: string;
  userEmail?: string;
}

export interface PromoCodeRecord {
  id: number;
  vendorId?: number | null;
  code: string;
  type: 'percent' | 'flat' | string;
  value: number;
  minOrder: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  isActive: boolean;
}

export interface ListingSubItem {
  id: number;
  name: string;
  unit: string;
  price: number;
  qty: number;
  checked: boolean;
}

export interface ListingVariant {
  id: number;
  label: string;
  price: number;
}

export interface ListingReview {
  id: number;
  userId: number | null;
  author: string;
  rating: number;
  comment: string;
  vendorReply?: string | null;
  createdAt?: string;
}

export interface Listing {
  id: number;
  vendorId: number | null;
  panditProfileId?: number | null;
  category: 'pooja_box' | 'pandit' | 'murti' | 'photo' | string;
  poojaTag: string;
  slug: string;
  sku?: string;
  masterCategories: string[];
  tags: string[];
  title: string;
  image: string;
  vendor: string;
  location: string;
  rating: number;
  ratingCount: number;
  deliveryTime: string;
  isGlobal: boolean;
  description: string;
  basePrice: number;
  salePrice?: number | null;
  stockQty?: number;
  stockStatus?: 'instock' | 'low_stock' | 'outofstock' | string;
  subscriptionCycle: string;
  status: string;
  items: ListingSubItem[];
  pujaTypes: ListingVariant[];
  sizes: ListingVariant[];
  reviews: ListingReview[];
  // UI-only client state
  expanded?: boolean;
  subscriptionEnabled?: boolean;
  simpleQty?: number;
}

export interface MasterCategory {
  id: string;
  code: string;
  deity: string;
  hinglish: string;
  items: string[];
}

export interface CartItem {
  id: number;
  listingId?: number | null;
  itemType: string;
  title: string;
  vendorName: string;
  details: string;
  selectedItemsJson?: Array<{ id?: number; name: string; qty: number; price: number }> | null;
  variantId?: number | null;
  variantLabel?: string | null;
  pujaDate?: string | null;
  pujaLocation?: string | null;
  subscriptionEnabled?: boolean;
  subscriptionCycle?: string | null;
  unitPrice: number;
  qty: number;
}

export interface OrderItem {
  id: number;
  orderId: string;
  listingId: number | null;
  vendorId: number | null;
  vendorName: string;
  titleSnapshot: string;
  detailsSnapshot: string;
  price: number;
  qty: number;
}

export interface OrderRecord {
  id: string;
  userId: number | null;
  orderType: string;
  subtotal: number;
  discount: number;
  total: number;
  promoCode: string | null;
  paymentMethod: string;
  paymentStatus: string;
  statusStep: number;
  customerName: string;
  phone: string;
  addressLine: string;
  pincode: string;
  notes: string;
  cancelledAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface SubscriptionRecord {
  id: number;
  listingId: number;
  listingTitle?: string;
  vendorName?: string;
  cycle: string;
  nextDeliveryDate: string;
  price: number;
  status: 'active' | 'paused' | 'cancelled' | string;
  createdAt: string;
}

export interface DonationRecord {
  id: string;
  donorName: string;
  donorCity: string;
  cause: string;
  amount: number;
  upiTxnRef?: string | null;
  status: string;
  createdAt: string;
}

export interface SiteSettings {
  whatsappNumber: string;
  upiId: string;
  payeeName: string;
  siteName: string;
  panchangTithi: string;
  panchangNakshatra: string;
  panchangAbhijit: string;
  panchangRahukaal: string;
}
