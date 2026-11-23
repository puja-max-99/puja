import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { apiFetch, setInMemoryAuthToken, setSessionToken } from './lib/api';
import { AuthModal, type PortalContext } from './components/AuthModal';
import { AccountModal } from './components/AccountModal';
import { ListingCard, getBoxCalculatedPrice } from './components/ListingCard';
import {
  CartDrawer,
  DirectOrderModal,
  OrderSuccessModal,
} from './components/CartAndCheckoutModals';
import {
  CustomListModal,
  PujaDetailInfo,
  PujaDetailModal,
  ReceiptModal,
  ReviewsModal,
  TrackingModal,
  VoiceSearchModal,
} from './components/UserModals';
import { SevaDakshinaSection } from './components/SevaDakshinaSection';
import { MasterDirectorySection } from './components/MasterDirectorySection';
import { AdminPanelModal, VendorDashboardModal } from './components/VendorAndAdminModals';
import { HeroOfferSlider } from './components/HeroOfferSlider';
import { UserPanelPage } from './components/panels/UserPanelPage';
import { VendorPanelPage } from './components/panels/VendorPanelPage';
import { PanditPanelPage } from './components/panels/PanditPanelPage';
import { SuperAdminPanelPage } from './components/panels/SuperAdminPanelPage';
import type {
  CartItem,
  DonationRecord,
  Listing,
  ListingReview,
  MasterCategory,
  NotificationItem,
  OrderRecord,
  PanditProfile,
  SiteSettings,
  SubscriptionRecord,
  UserAddress,
  UserProfile,
  VendorProfile,
} from './types/puja';

const DEFAULT_SETTINGS: SiteSettings = {
  whatsappNumber: '919876543210',
  upiId: 'wahanilet@ptyes',
  payeeName: 'PujaJunction.com',
  siteName: 'PujaJunction.com',
  panchangTithi: 'शुक्ल पक्ष चतुर्दशी / पूर्णिमा',
  panchangNakshatra: 'कृतिका / रोहिणी',
  panchangAbhijit: '11:45 AM – 12:28 PM',
  panchangRahukaal: '01:25 PM – 02:45 PM',
};

const GUEST_CART_KEY = 'pj_guest_cart_v1';
const GUEST_RECENT_KEY = 'pj_guest_recent_v1';

const POPULAR_SEARCHES = [
  { label: 'सत्यनारायण व्रत कथा किट (Satyanarayan)', tag: 'satyanarayan', type: 'पूजा किट' },
  { label: 'गृह प्रवेश एवं वास्तु शांति (Griha Pravesh)', tag: 'grihapravesh', type: 'पूजा किट' },
  { label: 'रुद्राभिषेक एवं महाशिवरात्रि (Rudrabhishek)', tag: 'rudrabhishek', type: 'पूजा किट' },
  { label: 'छठ महापर्व संपूर्ण अर्घ्य (Chhath Puja)', tag: 'chhath', type: 'महापर्व' },
  { label: 'दीपावली महालक्ष्मी-गणेश पूजन (Diwali)', tag: 'diwali', type: 'महापर्व' },
  { label: 'विवाह एवं तिलक संस्कार (Vivah & Tilak)', tag: 'vivah', type: 'संस्कार' },
  { label: 'आचार्य पं. श्यामाकांत शास्त्री (Pandit Ji)', keyword: 'पंडित', type: 'पंडित बुकिंग' },
];

const QUICK_TAGS = [
  { tag: 'ALL', label: 'सभी पूजा (19+)' },
  { tag: 'satyanarayan', label: 'सत्यनारायण कथा' },
  { tag: 'grihapravesh', label: 'गृह प्रवेश व वास्तु' },
  { tag: 'rudrabhishek', label: 'रुद्राभिषेक' },
  { tag: 'diwali', label: 'दीपावली लक्ष्मी पूजन' },
  { tag: 'chhath', label: 'छठ महापर्व' },
  { tag: 'navratri', label: 'नवरात्रि कलश' },
  { tag: 'vivah', label: 'विवाह व तिलक' },
  { tag: 'sanskar', label: 'मुंडन व अन्नप्राशन' },
  { tag: 'shradh', label: 'पितृपक्ष श्राद्ध' },
];

const RIBBON_SHORT_LABELS: Array<{ id: string; label: string }> = [
  { id: 'cat01', label: '01 महापर्व पूजा' },
  { id: 'cat02', label: '02 प्रमुख पर्व' },
  { id: 'cat03', label: '03 दैनिक पूजा' },
  { id: 'cat04', label: '04 साप्ताहिक पूजा' },
  { id: 'cat05', label: '05 मासिक पूजा' },
  { id: 'cat06', label: '06 व्रत एवं उपवास' },
  { id: 'cat07', label: '07 नवरात्रि व देवी पूजा' },
  { id: 'cat08', label: '08 देवी-देवता पूजा' },
  { id: 'cat09', label: '09 नवग्रह व ज्योतिष' },
  { id: 'cat10', label: '10 अनुष्ठान व हवन' },
  { id: 'cat11', label: '11 गृह एवं परिवार पूजा' },
  { id: 'cat12', label: '12 षोडश संस्कार' },
  { id: 'cat13', label: '13 पितृ एवं श्राद्ध' },
  { id: 'cat14', label: '14 मंदिर व उत्सव' },
  { id: 'cat15', label: '15 तिथि व नक्षत्र' },
  { id: 'cat16', label: '16 क्षेत्रीय व राज्यवार' },
  { id: 'cat17', label: '17 पूजा की विधियां' },
];

function getTodayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function loadGuestCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadGuestRecent(): string[] {
  try {
    const raw = localStorage.getItem(GUEST_RECENT_KEY);
    if (!raw) return ['सत्यनारायण कथा', 'गृह प्रवेश', 'रुद्राभिषेक'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : ['सत्यनारायण कथा', 'गृह प्रवेश', 'रुद्राभिषेक'];
  } catch {
    return ['सत्यनारायण कथा', 'गृह प्रवेश', 'रुद्राभिषेक'];
  }
}

export default function App() {
  // Core Data State (DB-backed)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
  const [aliases, setAliases] = useState<Record<string, string[]>>({});
  const [listings, setListings] = useState<Listing[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // User & Account State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [panditProfile, setPanditProfile] = useState<PanditProfile | null>(null);
  const [userDonations, setUserDonations] = useState<DonationRecord[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [cart, setCart] = useState<CartItem[]>(loadGuestCart);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadGuestRecent);

  // Active Page Routing State (maps each header menu item & 4 role panels to dedicated pages)
  type ActivePage =
    | 'home'
    | 'pooja_box'
    | 'pandit'
    | 'murti'
    | 'seva_dakshina'
    | 'puja_list'
    | 'user_panel'
    | 'vendor_panel'
    | 'pandit_panel'
    | 'super_admin';

  const getInitialPageFromHash = (): ActivePage => {
    const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    if (hash === 'puja-kit') return 'pooja_box';
    if (hash === 'pandit-booking') return 'pandit';
    if (hash === 'murti-photo') return 'murti';
    if (hash === 'seva-dakshina' || hash === 'seva-dakshina-section') return 'seva_dakshina';
    if (hash === 'sabhi-puja-list' || hash === 'masterdirectorysection') return 'puja_list';
    if (hash === 'user-panel') return 'user_panel';
    if (hash === 'vendor-panel') return 'vendor_panel';
    if (hash === 'pandit-panel') return 'pandit_panel';
    if (hash === 'super-admin') return 'super_admin';
    return 'home';
  };

  const pageToCategory = (page: ActivePage): string => {
    if (page === 'pooja_box') return 'pooja_box';
    if (page === 'pandit') return 'pandit';
    if (page === 'murti') return 'murti_all';
    return 'ALL';
  };

  const [activePage, setActivePage] = useState<ActivePage>(getInitialPageFromHash);
  const isPanelPage =
    activePage === 'user_panel' ||
    activePage === 'vendor_panel' ||
    activePage === 'pandit_panel' ||
    activePage === 'super_admin';

  // Filters & Search State
  const [currentCategory, setCurrentCategory] = useState<string>(() =>
    pageToCategory(getInitialPageFromHash())
  );
  const [currentMasterCat, setCurrentMasterCat] = useState<string>('ALL');
  const [activePoojaTag, setActivePoojaTag] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [directorySearch, setDirectorySearch] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1);
  const [globalOnly, setGlobalOnly] = useState<boolean>(false);
  const [topRatedOnly, setTopRatedOnly] = useState<boolean>(false);
  const [maxPrice, setMaxPrice] = useState<number>(3000);
  const [sortBy, setSortBy] = useState<string>('recommended');
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);
  const [bookingDate, setBookingDate] = useState<string>(getTodayIso(0));
  const [quickDateMode, setQuickDateMode] = useState<0 | 1>(0);
  const [activeDirectoryCatId, setActiveDirectoryCatId] = useState<string | null>(null);

  // Modals & UI State
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register' | 'forgot' | 'verify'>('login');
  const [authPortalContext, setAuthPortalContext] = useState<PortalContext>('user');
  const [pendingVerifyToken, setPendingVerifyToken] = useState<string | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountInitialTab, setAccountInitialTab] = useState<
    'profile' | 'addresses' | 'wishlist' | 'subscriptions' | 'donations' | 'notifications'
  >('profile');
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [directOrderProduct, setDirectOrderProduct] = useState<Listing | null>(null);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [customListModalOpen, setCustomListModalOpen] = useState(false);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [reviewsProduct, setReviewsProduct] = useState<Listing | null>(null);
  const [pujaDetail, setPujaDetail] = useState<PujaDetailInfo | null>(null);
  const [receiptDonation, setReceiptDonation] = useState<DonationRecord | null>(null);
  const [successOrder, setSuccessOrder] = useState<{ id: string; msg: string } | null>(null);

  // Voice Search State
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState(
    'Hindi या Hinglish में बोलें: "Satyanarayan", "गृह प्रवेश", "Rudrabhishek" या "Chhath"'
  );
  const [voiceTranscript, setVoiceTranscript] = useState('...');
  const recognitionRef = useRef<{ abort: () => void; stop: () => void } | null>(null);

  // Toast State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Floating Bottom-Right Search State
  const [floatingSearchOpen, setFloatingSearchOpen] = useState(false);

  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const floatingSearchRef = useRef<HTMLDivElement>(null);
  const floatingSearchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  // Load Bootstrap + Listings
  const loadCatalogAndBootstrap = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const [boot, listData] = await Promise.all([
        apiFetch<{
          settings: Partial<SiteSettings>;
          categories: MasterCategory[];
          aliases: Record<string, string[]>;
          recentSearches: string[];
        }>('/api/bootstrap'),
        apiFetch<{ items: Listing[]; total: number }>('/api/listings?limit=100'),
      ]);

      setSettings((prev) => ({ ...prev, ...(boot.settings || {}) }));
      setMasterCategories(boot.categories || []);
      setAliases(boot.aliases || {});
      if (boot.recentSearches && boot.recentSearches.length > 0) {
        setRecentSearches(boot.recentSearches);
      }

      setListings(
        (listData.items || []).map((item, idx) => ({
          ...item,
          expanded: idx === 0 && item.category === 'pooja_box',
          subscriptionEnabled: false,
          simpleQty: 1,
        }))
      );
    } catch (err: unknown) {
      setCatalogError(err instanceof Error ? err.message : 'कैटलॉग लोड करने में समस्या आई।');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  // Load Authenticated User Profile, Orders, Cart, Subscriptions
  const refreshAccount = useCallback(async () => {
    try {
      const me = await apiFetch<{
        user: UserProfile | null;
        addresses?: UserAddress[];
        wishlistIds?: number[];
        notifications?: NotificationItem[];
        vendorProfile?: VendorProfile | null;
        panditProfile?: PanditProfile | null;
        donations?: DonationRecord[];
        subscriptions?: SubscriptionRecord[];
      }>('/api/auth/me');

      if (!me.user) {
        setSessionToken(null);
        setUser(null);
        setAddresses([]);
        setWishlistIds([]);
        setNotifications([]);
        setVendorProfile(null);
        setPanditProfile(null);
        setUserDonations([]);
        setUserSubscriptions([]);
        setOrders([]);
        setCart(loadGuestCart());
        return;
      }

      setUser(me.user);
      setAddresses(me.addresses || []);
      setWishlistIds(me.wishlistIds || []);
      setNotifications(me.notifications || []);
      setVendorProfile(me.vendorProfile || null);
      setPanditProfile(me.panditProfile || null);
      setUserDonations(me.donations || []);

      const [ordersList, cartList, subsList] = await Promise.all([
        apiFetch<OrderRecord[]>('/api/orders').catch(() => []),
        apiFetch<CartItem[]>('/api/cart').catch(() => []),
        apiFetch<SubscriptionRecord[]>('/api/subscriptions').catch(() => []),
      ]);
      setOrders(ordersList);
      setCart(cartList);
      setUserSubscriptions(subsList);
    } catch {
      // keep guest mode gracefully
    }
  }, []);

  // Initial Load & Firebase Auth Listener
  useEffect(() => {
    void loadCatalogAndBootstrap();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const token = await fbUser.getIdToken();
          setInMemoryAuthToken(token);
        } catch {
          setInMemoryAuthToken(null);
        }
      } else {
        setInMemoryAuthToken(null);
      }
      await refreshAccount();
    });

    return () => unsubscribe();
  }, [loadCatalogAndBootstrap, refreshAccount]);

  // Close search dropdown & user menu on outside click / ESC
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setHighlightedIdx(-1);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (floatingSearchRef.current && !floatingSearchRef.current.contains(e.target as Node)) {
        setFloatingSearchOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setUserMenuOpen(false);
        setFloatingSearchOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Auto-focus floating search input when opened
  useEffect(() => {
    if (floatingSearchOpen) {
      window.setTimeout(() => {
        floatingSearchInputRef.current?.focus();
      }, 60);
    }
  }, [floatingSearchOpen]);

  // Persist guest cart to localStorage when logged out
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
      } catch {
        // ignore storage quota
      }
    }
  }, [cart, user]);

  // Handle post-auth: merge guest cart + resume pending action!
  const handleAuthSuccess = async (loggedUser: UserProfile, verificationToken?: string | null) => {
    setUser(loggedUser);
    if (verificationToken) setPendingVerifyToken(verificationToken);

    // Merge guest cart into DB if present
    const guestItems = loadGuestCart();
    if (guestItems.length > 0) {
      try {
        const merged = await apiFetch<CartItem[]>('/api/cart/merge', {
          method: 'POST',
          body: JSON.stringify({
            items: guestItems.map((gi) => ({
              listingId: gi.listingId,
              itemType: gi.itemType,
              selectedItems: gi.selectedItemsJson,
              variantId: gi.variantId,
              variantLabel: gi.variantLabel,
              pujaDate: gi.pujaDate,
              pujaLocation: gi.pujaLocation,
              subscriptionEnabled: gi.subscriptionEnabled,
              subscriptionCycle: gi.subscriptionCycle,
              qty: gi.qty,
              customTitle: gi.title,
              customDetails: gi.details,
              customPrice: gi.unitPrice,
            })),
          }),
        });
        localStorage.removeItem(GUEST_CART_KEY);
        setCart(merged);
        showToast('आपका गेस्ट कार्ट आपके खाते में मर्ज हो गया है!');
      } catch {
        // fallback to refreshAccount
      }
    }

    await refreshAccount();
    if (pendingActionRef.current) {
      const fn = pendingActionRef.current;
      pendingActionRef.current = null;
      fn();
    } else {
      // Auto-route to the user's primary role panel when logging in from a portal or with elevated role
      if (loggedUser.role === 'super_admin' || loggedUser.role === 'admin') {
        navigateToPage('super_admin');
      } else if (loggedUser.role === 'vendor') {
        navigateToPage('vendor_panel');
      } else if (loggedUser.role === 'pandit') {
        navigateToPage('pandit_panel');
      }
    }
  };

  const openAuthGate = (
    tab: 'login' | 'register' | 'forgot' | 'verify' = 'login',
    pendingAction?: () => void,
    portalContext: PortalContext = 'user'
  ) => {
    pendingActionRef.current = pendingAction || null;
    setAuthPortalContext(portalContext);
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const handleLogout = async (allDevices = false) => {
    try {
      await apiFetch(allDevices ? '/api/auth/logout-all' : '/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setInMemoryAuthToken(null);
    setSessionToken(null);
    setUser(null);
    setAddresses([]);
    setWishlistIds([]);
    setNotifications([]);
    setVendorProfile(null);
    setPanditProfile(null);
    setOrders([]);
    setCart([]);
    setUserMenuOpen(false);
    if (isPanelPage) {
      setActivePage('home');
      window.history.pushState(null, '', '#home');
    }
    showToast('आप सफलतापूर्वक लॉगआउट हो गए हैं।');
  };

  const handleResendVerification = async () => {
    try {
      const data = await apiFetch<{ verificationToken?: string; alreadyVerified?: boolean }>(
        '/api/auth/resend-verification',
        { method: 'POST' }
      );
      if (data.alreadyVerified) {
        await refreshAccount();
        showToast('आपका ईमेल पहले से सत्यापित है!');
      } else if (data.verificationToken) {
        setPendingVerifyToken(data.verificationToken);
        setAuthModalTab('verify');
        setAuthModalOpen(true);
      }
    } catch {
      showToast('सत्यापन कोड भेजने में समस्या आई।');
    }
  };

  // Bilingual search matching helpers
  const expandBilingualTerms = useCallback(
    (rawQuery: string): string[] => {
      const q = (rawQuery || '').toLowerCase().trim();
      if (!q) return [];
      const tokens = new Set<string>([q]);
      q.split(/\s+/).forEach((w) => {
        if (w.length > 1) tokens.add(w);
      });
      Object.values(aliases).forEach((group) => {
        if (group.some((alias) => q.includes(alias) || alias.includes(q))) {
          group.forEach((alias) => tokens.add(alias));
        }
      });
      return Array.from(tokens);
    },
    [aliases]
  );

  const matchesBilingual = useCallback((haystack: string, tokens: string[]) => {
    if (tokens.length === 0) return true;
    const lower = haystack.toLowerCase();
    return tokens.some((tok) => lower.includes(tok));
  }, []);

  const saveRecentSearch = useCallback(
    (term: string) => {
      const clean = term.trim();
      if (clean.length < 2) return;
      setRecentSearches((prev) => {
        const next = [clean, ...prev.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(
          0,
          4
        );
        try {
          localStorage.setItem(GUEST_RECENT_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      if (user) {
        apiFetch('/api/recent-searches', {
          method: 'POST',
          body: JSON.stringify({ query: clean }),
        }).catch(() => {});
      }
    },
    [user]
  );

  // Filtered & sorted listings
  const isDedicatedCatalogPage =
    activePage === 'pooja_box' || activePage === 'pandit' || activePage === 'murti';

  const isFilteredView =
    isDedicatedCatalogPage ||
    currentCategory !== 'ALL' ||
    currentMasterCat !== 'ALL' ||
    activePoojaTag !== 'ALL' ||
    globalOnly ||
    topRatedOnly ||
    maxPrice < 3000 ||
    searchQuery.trim() !== '';

  const filteredListings = useMemo(() => {
    const tokens = activePoojaTag !== 'ALL' ? [] : expandBilingualTerms(searchQuery);

    const list = listings.filter((item) => {
      const catMatch =
        currentCategory === 'ALL'
          ? true
          : currentCategory === 'murti_all'
            ? item.category === 'murti' || item.category === 'photo'
            : item.category === currentCategory;
      const masterMatch =
        currentMasterCat === 'ALL' || (item.masterCategories || []).includes(currentMasterCat);
      const tagMatch = activePoojaTag === 'ALL' || item.poojaTag === activePoojaTag;

      const subNames = (item.items || []).map((s) => s.name).join(' ');
      const tagNames = (item.tags || []).join(' ');
      const haystack = `${item.title} ${item.vendor} ${item.description} ${item.poojaTag} ${subNames} ${tagNames}`;
      const keyMatch = activePoojaTag !== 'ALL' ? true : matchesBilingual(haystack, tokens);

      const globalCheck = !globalOnly || item.isGlobal;
      const ratingCheck = !topRatedOnly || item.rating >= 4.8;
      const effPrice =
        item.category === 'pooja_box' ? getBoxCalculatedPrice(item) : item.basePrice;
      const priceCheck = effPrice <= maxPrice;

      return catMatch && masterMatch && tagMatch && keyMatch && globalCheck && ratingCheck && priceCheck;
    });

    const getEff = (it: Listing) =>
      it.category === 'pooja_box' ? getBoxCalculatedPrice(it) : it.basePrice;

    if (sortBy === 'price_low') {
      return [...list].sort((a, b) => getEff(a) - getEff(b));
    }
    if (sortBy === 'price_high') {
      return [...list].sort((a, b) => getEff(b) - getEff(a));
    }
    if (sortBy === 'rating') {
      return [...list].sort((a, b) => b.rating - a.rating);
    }
    return list;
  }, [
    listings,
    currentCategory,
    currentMasterCat,
    activePoojaTag,
    searchQuery,
    globalOnly,
    topRatedOnly,
    maxPrice,
    sortBy,
    expandBilingualTerms,
    matchesBilingual,
  ]);

  const paginatedListings = filteredListings.slice(0, visibleCount);

  // Search Dropdown matches
  const dropdownMatches = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return { products: [], categories: [], dirPujas: [] };
    const tokens = expandBilingualTerms(q);

    const products = listings
      .filter((item) => {
        const subNames = (item.items || []).map((s) => s.name).join(' ');
        const tagNames = (item.tags || []).join(' ');
        return matchesBilingual(`${item.title} ${item.vendor} ${subNames} ${tagNames}`, tokens);
      })
      .slice(0, 6);

    const categories = masterCategories
      .filter((cat) => matchesBilingual(`${cat.code} ${cat.deity} ${cat.hinglish}`, tokens))
      .slice(0, 4);

    const dirPujas: Array<{ pujaName: string; catCode: string; deity: string }> = [];
    for (const cat of masterCategories) {
      for (const pujaName of cat.items) {
        if (dirPujas.length < 8 && matchesBilingual(`${pujaName} ${cat.code}`, tokens)) {
          dirPujas.push({ pujaName, catCode: cat.code, deity: cat.deity });
        }
      }
    }

    return { products, categories, dirPujas };
  }, [searchQuery, listings, masterCategories, expandBilingualTerms, matchesBilingual]);

  // Listing interactive mutations (checkboxes, qty, subscription, accordion)
  const toggleBoxAccordion = (id: number) => {
    setListings((prev) => prev.map((p) => (p.id === id ? { ...p, expanded: !p.expanded } : p)));
  };

  const toggleBoxItem = (id: number, idx: number) => {
    setListings((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const nextItems = p.items.map((it, i) =>
          i === idx ? { ...it, checked: !it.checked } : it
        );
        return { ...p, items: nextItems };
      })
    );
  };

  const updateBoxItemQty = (id: number, idx: number, delta: number) => {
    setListings((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const nextItems = p.items.map((it, i) => {
          if (i !== idx || !it.checked) return it;
          const nextQ = Math.min(50, Math.max(1, it.qty + delta));
          return { ...it, qty: nextQ };
        });
        return { ...p, items: nextItems };
      })
    );
  };

  const toggleBoxSubscription = (id: number) => {
    setListings((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const nextEnabled = !p.subscriptionEnabled;
        showToast(
          nextEnabled
            ? `🔄 ${p.subscriptionCycle} रिमाइंडर व 10% छूट सक्रिय!`
            : 'एक बार का ऑर्डर (One-time) चुना गया'
        );
        return { ...p, subscriptionEnabled: nextEnabled };
      })
    );
  };

  const changeBoxSubscriptionCycle = (id: number, cycle: string) => {
    setListings((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.subscriptionEnabled) showToast(`रिमाइंडर अवधि बदली गई: ${cycle}`);
        return { ...p, subscriptionCycle: cycle };
      })
    );
  };

  // Cart Operations (server-backed when logged in, localStorage for guests)
  const addItemToCart = async (
    guestFallback: Omit<CartItem, 'id'>,
    apiPayload: Record<string, unknown>,
    toastMessage: string
  ) => {
    if (user) {
      try {
        const added = await apiFetch<CartItem>('/api/cart', {
          method: 'POST',
          body: JSON.stringify(apiPayload),
        });
        setCart((prev) => [added, ...prev]);
        showToast(toastMessage);
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'कार्ट में जोड़ने में त्रुटि।');
      }
    } else {
      setCart((prev) => [{ ...guestFallback, id: Date.now() }, ...prev]);
      showToast(toastMessage);
    }
  };

  const handleAddBoxToCart = (product: Listing) => {
    const selected = product.items.filter((i) => i.checked);
    if (selected.length === 0) return;
    const price = getBoxCalculatedPrice(product);
    const details =
      selected.map((i) => `${i.name} (x${i.qty})`).join(', ') +
      (product.subscriptionEnabled ? ` | 🔄 ${product.subscriptionCycle} (10% छूट)` : '');

    void addItemToCart(
      {
        listingId: product.id,
        itemType: 'pooja_box',
        title: product.title,
        vendorName: product.vendor,
        details,
        selectedItemsJson: selected.map((s) => ({
          id: s.id,
          name: s.name,
          qty: s.qty,
          price: s.price,
        })),
        subscriptionEnabled: Boolean(product.subscriptionEnabled),
        subscriptionCycle: product.subscriptionCycle,
        unitPrice: price,
        qty: 1,
      },
      {
        listingId: product.id,
        itemType: 'pooja_box',
        selectedItems: selected.map((s) => ({ id: s.id, name: s.name, qty: s.qty })),
        subscriptionEnabled: Boolean(product.subscriptionEnabled),
        subscriptionCycle: product.subscriptionCycle,
      },
      `"${product.title}" कार्ट में जोड़ा गया!`
    );
  };

  const handleAddPanditToCart = (
    product: Listing,
    variantId: number | null,
    variantLabel: string,
    price: number,
    location: string,
    date: string
  ) => {
    const details = `पूजा: ${variantLabel} | 📍 स्थान: ${location} | तिथि: ${date}`;
    void addItemToCart(
      {
        listingId: product.id,
        itemType: 'pandit',
        title: product.title,
        vendorName: product.vendor,
        details,
        variantId,
        variantLabel,
        pujaDate: date,
        pujaLocation: location,
        unitPrice: price,
        qty: 1,
      },
      {
        listingId: product.id,
        itemType: 'pandit',
        variantId,
        variantLabel,
        pujaLocation: location,
        pujaDate: date,
      },
      `पंडित जी (${location}) की बुकिंग कार्ट में जोड़ी गई!`
    );
  };

  const handleAddVariantToCart = (
    product: Listing,
    variantId: number | null,
    variantLabel: string,
    unitPrice: number,
    qty: number
  ) => {
    const details = `वेरिएंट: ${variantLabel} | मात्रा: ${qty} पीस`;
    void addItemToCart(
      {
        listingId: product.id,
        itemType: product.category,
        title: product.title,
        vendorName: product.vendor,
        details,
        variantId,
        variantLabel,
        unitPrice,
        qty,
      },
      {
        listingId: product.id,
        itemType: product.category,
        variantId,
        variantLabel,
        qty,
      },
      `"${product.title}" कार्ट में जोड़ा गया!`
    );
  };

  const handleRemoveCartItem = async (id: number) => {
    if (user) {
      try {
        await apiFetch(`/api/cart/${id}`, { method: 'DELETE' });
      } catch {
        // ignore
      }
    }
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const handleToggleWishlist = async (listingId: number) => {
    if (!user) {
      openAuthGate('login', () => {
        void handleToggleWishlist(listingId);
      });
      return;
    }
    try {
      const res = await apiFetch<{ saved: boolean }>(`/api/wishlist/${listingId}`, {
        method: 'POST',
      });
      setWishlistIds((prev) =>
        res.saved ? Array.from(new Set([...prev, listingId])) : prev.filter((id) => id !== listingId)
      );
      showToast(res.saved ? '❤️ विशलिस्ट में सेव किया गया!' : 'विशलिस्ट से हटाया गया');
    } catch {
      showToast('विशलिस्ट अपडेट विफल।');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      showToast(`ऑर्डर #${orderId} रद्द कर दिया गया।`);
      await refreshAccount();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'ऑर्डर रद्द नहीं हो सका।');
    }
  };

  // Voice Search (Web Speech API, hi-IN)
  const startVoiceSearch = () => {
    setVoiceModalOpen(true);
    setVoiceTranscript('सुन रहा हूँ... बोलिए');
    setVoiceStatus('Hindi या Hinglish में बोलें: "Satyanarayan", "गृह प्रवेश", "Rudrabhishek" या "Chhath"');

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus('आपके ब्राउज़र में सीधा माइक सपोर्ट उपलब्ध नहीं है — नीचे दिए गए विकल्प चुनें:');
      setVoiceTranscript('नीचे से पूजा चुनें 👇');
      return;
    }

    try {
      if (recognitionRef.current) recognitionRef.current.abort();
      const rec = new SpeechRecognition() as {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
        onerror: () => void;
        start: () => void;
        stop: () => void;
        abort: () => void;
      };
      recognitionRef.current = rec;
      rec.lang = 'hi-IN';
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        const spoken = event.results[0][0].transcript;
        setVoiceTranscript(`"${spoken}"`);
        if (event.results[0].isFinal) {
          setTimeout(() => {
            stopVoiceSearch();
            applyVoiceQuery(spoken);
          }, 450);
        }
      };

      rec.onerror = () => {
        setVoiceStatus('आवाज़ स्पष्ट नहीं मिली — नीचे दिए गए बटन से तुरंत खोजें:');
      };

      rec.start();
    } catch {
      setVoiceStatus('माइक अनुमति नहीं मिली — नीचे से पूजा चुनें:');
    }
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setVoiceModalOpen(false);
  };

  const applyVoiceQuery = (spokenText: string) => {
    stopVoiceSearch();
    const clean = spokenText.replace(/[।.,!?]/g, '').trim();
    setSearchQuery(clean);
    setActivePoojaTag('ALL');
    setVisibleCount(10);
    saveRecentSearch(clean);
    setDropdownOpen(true);
    showToast(`🎙️ आपने बोला: "${clean}"`);
  };

  const PAGE_HASH_MAP: Record<ActivePage, string> = {
    home: '#home',
    pooja_box: '#puja-kit',
    pandit: '#pandit-booking',
    murti: '#murti-photo',
    seva_dakshina: '#seva-dakshina',
    puja_list: '#sabhi-puja-list',
    user_panel: '#user-panel',
    vendor_panel: '#vendor-panel',
    pandit_panel: '#pandit-panel',
    super_admin: '#super-admin',
  };

  const navigateToPage = useCallback(
    (
      page: ActivePage,
      opts?: { masterCat?: string; keepSearch?: boolean; subCategory?: string }
    ) => {
      setActivePage(page);
      setDropdownOpen(false);
      setMobileFilterOpen(false);
      setActivePoojaTag('ALL');
      if (!opts?.keepSearch) {
        setSearchQuery('');
      }
      if (opts?.masterCat) {
        setCurrentMasterCat(opts.masterCat);
      } else {
        setCurrentMasterCat('ALL');
      }
      if (opts?.subCategory) {
        setCurrentCategory(opts.subCategory);
      } else {
        setCurrentCategory(pageToCategory(page));
      }
      setVisibleCount(page === 'home' ? 10 : 24);

      const targetHash = PAGE_HASH_MAP[page];
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  // Sync browser back/forward buttons with activePage
  useEffect(() => {
    const onHashChange = () => {
      const nextPage = getInitialPageFromHash();
      setActivePage(nextPage);
      setCurrentCategory(pageToCategory(nextPage));
      setVisibleCount(nextPage === 'home' ? 10 : 24);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const resetFilters = () => {
    setActivePoojaTag('ALL');
    setSearchQuery('');
    setDirectorySearch('');
    setDropdownOpen(false);
    setGlobalOnly(false);
    setTopRatedOnly(false);
    setMaxPrice(3000);
    setSortBy('recommended');
    setCurrentMasterCat('ALL');
    setCurrentCategory('ALL');
    setActivePage('home');
    setVisibleCount(10);
    if (window.location.hash !== '#home') {
      window.history.pushState(null, '', '#home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookInShubhMuhurat = () => {
    setBookingDate(getTodayIso(0));
    setQuickDateMode(0);
    navigateToPage('pandit');
    showToast(`🌞 आज के अभिजीत मुहूर्त (${settings.panchangAbhijit}) के लिए पंडित जी दिखाए जा रहे हैं`);
  };

  const scrollToMasterDirectory = () => {
    navigateToPage('puja_list');
  };

  const focusMasterSearch = () => {
    navigateToPage('home');
    setTimeout(() => {
      searchInputRef.current?.focus();
      setDropdownOpen(true);
    }, 250);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const dd = searchWrapperRef.current?.querySelectorAll<HTMLButtonElement>('[data-dropdown-item]');
    const count = dd ? dd.length : 0;
    if (e.key === 'ArrowDown' && count > 0) {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % count);
    } else if (e.key === 'ArrowUp' && count > 0) {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev - 1 + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIdx >= 0 && dd && dd[highlightedIdx]) {
        dd[highlightedIdx].click();
      } else {
        if (searchQuery.trim()) saveRecentSearch(searchQuery);
        setDropdownOpen(false);
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  const todayHindiDate = useMemo(
    () =>
      new Date().toLocaleDateString('hi-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const wishlistListings = listings.filter((l) => wishlistIds.includes(l.id));

  return (
    <div className="min-h-screen flex flex-col">
      {/* ==================== EMAIL VERIFICATION BANNER ==================== */}
      {user && !user.emailVerifiedAt && (
        <div className="bg-amber-900 text-amber-50 text-xs py-2 px-4 text-center flex flex-wrap items-center justify-center gap-3 no-print">
          <span>
            <i className="fa-solid fa-envelope-circle-check mr-1.5" />
            आपका ईमेल ({user.email}) अभी सत्यापित नहीं हुआ है।
          </span>
          <button
            type="button"
            onClick={handleResendVerification}
            className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-extrabold px-3 py-0.5 rounded-lg cursor-pointer"
          >
            अभी सत्यापित करें
          </button>
        </div>
      )}

      {/* ==================== TOP NAVBAR ==================== */}
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200 shadow-2xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[70px] gap-2">
            {/* Brand Logo */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                resetFilters();
              }}
              className="flex items-center gap-2.5 shrink-0"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-abhiRed to-saffron flex items-center justify-center text-white text-xl font-extrabold shadow-sm">
                ॐ
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-extrabold tracking-tight text-abhiRed leading-none">
                  Puja<span className="text-saffron">Junction</span>
                  <span className="text-sm sm:text-base font-extrabold text-gray-700">.com</span>
                </div>
              </div>
            </a>

            {/* Navigation Menu */}
            <nav className="hidden lg:flex items-center h-full space-x-4 xl:space-x-5 text-xs xl:text-sm font-semibold">
              {(
                [
                  ['home', 'सभी सेवाएं'],
                  ['pooja_box', 'पूजा किट'],
                  ['pandit', 'पंडित बुकिंग'],
                  ['murti', 'मूर्ति व फोटो'],
                  ['seva_dakshina', 'सेवा दक्षिणा'],
                  ['puja_list', 'सभी पूजा लिस्ट'],
                ] as const
              ).map(([pageKey, label]) => (
                <button
                  key={pageKey}
                  type="button"
                  onClick={() => navigateToPage(pageKey)}
                  className={`h-full flex items-center px-1 transition cursor-pointer ${
                    activePage === pageKey
                      ? 'nav-tab-active'
                      : 'text-gray-600 hover:text-abhiRed'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    if (user.role === 'super_admin' || user.role === 'admin') navigateToPage('super_admin');
                    else if (user.role === 'vendor') navigateToPage('vendor_panel');
                    else if (user.role === 'pandit') navigateToPage('pandit_panel');
                    else navigateToPage('user_panel');
                  }}
                  className="bg-orange-50 hover:bg-orange-100 text-abhiRed border border-orange-200 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                  title="मेरा रोल पैनल खोलें"
                >
                  <i
                    className={`fa-solid ${
                      user.role === 'super_admin' || user.role === 'admin'
                        ? 'fa-shield-halved'
                        : user.role === 'vendor'
                        ? 'fa-store'
                        : user.role === 'pandit'
                        ? 'fa-hands-praying'
                        : 'fa-gauge'
                    }`}
                  />
                  <span className="hidden xl:inline">
                    {user.role === 'super_admin' || user.role === 'admin'
                      ? 'सुपर एडमिन'
                      : user.role === 'vendor'
                      ? 'वेंडर पैनल'
                      : user.role === 'pandit'
                      ? 'पंडित पैनल'
                      : 'मेरा पैनल'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCartDrawerOpen(true)}
                className="relative bg-abhiRed hover:bg-abhiRedDark text-white px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-bag-shopping" />
                <span className="hidden sm:inline">कार्ट</span>
                <span className="bg-white text-abhiRed px-1.5 py-0.2 rounded-full text-xs font-extrabold">
                  {cart.length}
                </span>
              </button>

              {/* Auth Button / User Dropdown */}
              {!user ? (
                <button
                  type="button"
                  onClick={() => openAuthGate('login')}
                  className="bg-gray-900 hover:bg-black text-white px-3 py-2 rounded-xl text-xs font-extrabold shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <i className="fa-solid fa-right-to-bracket" />
                  <span className="hidden sm:inline">लॉगिन / साइन अप</span>
                  <span className="sm:hidden">लॉगिन</span>
                </button>
              ) : (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 pl-1.5 pr-2.5 py-1 rounded-xl transition cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-abhiRed to-saffron text-white font-extrabold text-xs flex items-center justify-center overflow-hidden relative">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user.name.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <span className="hidden md:inline text-xs font-extrabold text-gray-800 max-w-[90px] truncate">
                      {user.name.split(' ')[0]}
                    </span>
                    {unreadNotifCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-abhiRed" />
                    )}
                    <i className="fa-solid fa-chevron-down text-[10px] text-gray-500" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 z-50 text-xs font-bold">
                      <div className="px-3.5 py-2 border-b border-gray-100">
                        <div className="font-extrabold text-gray-900 truncate">{user.name}</div>
                        <div className="text-[11px] text-gray-500 truncate">{user.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigateToPage('user_panel');
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-orange-50 text-gray-800 flex items-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-user text-saffron w-4" /> यूज़र पैनल (मेरा डैशबोर्ड)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setTrackingModalOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-orange-50 text-gray-800 flex items-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-box-open text-blue-600 w-4" /> मेरी बुकिंग्स ({orders.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigateToPage('vendor_panel');
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-orange-50 text-saffron flex items-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-store w-4" /> वेंडर पैनल (WooCommerce)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigateToPage('pandit_panel');
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-amber-50 text-amber-800 flex items-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-hands-praying w-4" /> पंडित जी पैनल
                      </button>
                      {(user.role === 'super_admin' || user.role === 'admin') && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            navigateToPage('super_admin');
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-abhiRed flex items-center gap-2 cursor-pointer"
                        >
                          <i className="fa-solid fa-shield-halved w-4" /> सुपर एडमिन पैनल
                        </button>
                      )}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          type="button"
                          onClick={() => void handleLogout(false)}
                          className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-700 flex items-center gap-2 cursor-pointer"
                        >
                          <i className="fa-solid fa-right-from-bracket w-4" /> लॉगआउट
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Horizontal Sub-Navigation */}
          <div className="flex lg:hidden items-center gap-4 overflow-x-auto no-scrollbar border-t border-gray-100 py-2 text-xs font-bold text-gray-600">
            {(
              [
                ['home', 'सभी सेवाएं'],
                ['pooja_box', 'पूजा किट'],
                ['pandit', 'पंडित बुकिंग'],
                ['murti', 'मूर्ति व फोटो'],
                ['seva_dakshina', '🙏 सेवा दक्षिणा'],
                ['puja_list', 'सभी पूजा लिस्ट'],
              ] as const
            ).map(([pageKey, label]) => (
              <button
                key={pageKey}
                type="button"
                onClick={() => navigateToPage(pageKey)}
                className={`shrink-0 pb-0.5 transition cursor-pointer ${
                  activePage === pageKey
                    ? 'text-abhiRed font-extrabold border-b-2 border-abhiRed'
                    : 'hover:text-abhiRed'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ==================== DEDICATED PAGE HEADER BANNER (FOR NON-HOME STOREFRONT PAGES) ==================== */}
      {activePage !== 'home' && !isPanelPage && (
        <section className="bg-gradient-to-r from-abhiRed via-[#c92a2a] to-saffron text-white py-6 px-4 sm:px-6 lg:px-8 shadow-sm no-print">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <button
                type="button"
                onClick={() => navigateToPage('home')}
                className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/25 transition cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left" />
                <span>होमपेज (सभी सेवाएं)</span>
              </button>
              <span className="text-xs font-bold text-amber-200">
                📅 {todayHindiDate} • अभिजीत मुहूर्त: {settings.panchangAbhijit}
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
                  {activePage === 'pooja_box' && (
                    <>
                      <i className="fa-solid fa-box-open text-amber-200" />
                      <span>संपूर्ण वैदिक पूजा सामग्री किट</span>
                    </>
                  )}
                  {activePage === 'pandit' && (
                    <>
                      <i className="fa-solid fa-hands-praying text-amber-200" />
                      <span>सत्यापित वैदिक पंडित एवं आचार्य बुकिंग</span>
                    </>
                  )}
                  {activePage === 'murti' && (
                    <>
                      <i className="fa-solid fa-gopuram text-amber-200" />
                      <span>दिव्य मूर्तियां, शिवलिंग व पूजन फोटो फ्रेम</span>
                    </>
                  )}
                  {activePage === 'seva_dakshina' && (
                    <>
                      <i className="fa-solid fa-hand-holding-heart text-amber-200" />
                      <span>धार्मिक सेवा एवं श्रद्धा दक्षिणा</span>
                    </>
                  )}
                  {activePage === 'puja_list' && (
                    <>
                      <i className="fa-solid fa-book-open text-amber-200" />
                      <span>सभी पूजा लिस्ट (17 मुख्य श्रेणियां • 350+ पूजाएं)</span>
                    </>
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-orange-100 mt-1">
                  {activePage === 'pooja_box' &&
                    'अपनी पूजा के अनुसार सामग्री कम/ज्यादा करें, मासिक सब्सक्रिप्शन पर 10% छूट पाएं और घर बैठे मंगाएं।'}
                  {activePage === 'pandit' &&
                    'शुभ मुहूर्त व तिथि के अनुसार अनुभवी वैदिक आचार्य बुक करें — गृह प्रवेश, सत्यनारायण कथा, रुद्राभिषेक व विवाह।'}
                  {activePage === 'murti' &&
                    'इको-फ्रेंडली मिट्टी मूर्तियां, नर्मदेश्वर शिवलिंग, पीतल लड्डू गोपाल व प्रीमियम फ्रेम्ड भगवान फोटो।'}
                  {activePage === 'seva_dakshina' &&
                    'गौ सेवा, अन्नदान, मंदिर जीर्णोद्धार व संत सेवा हेतु सीधा UPI QR अर्पण करें और तुरंत डिजिटल रसीद पाएं।'}
                  {activePage === 'puja_list' &&
                    'किसी भी पूजा पर क्लिक कर शुभ मुहूर्त, संपूर्ण सामग्री सूची, पूजा विधि व मंत्र पढ़ें और सीधे किट बुक करें।'}
                </p>
              </div>

              {/* Page-specific inline search / controls */}
              {isDedicatedCatalogPage && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-72">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setActivePoojaTag('ALL');
                      }}
                      placeholder={
                        activePage === 'pooja_box'
                          ? 'किट खोजें (सत्यनारायण, दीपावली...)'
                          : activePage === 'pandit'
                            ? 'पंडित जी या पूजा खोजें...'
                            : 'मूर्ति, शिवलिंग या फोटो खोजें...'
                      }
                      className="w-full bg-white text-gray-900 rounded-xl pl-9 pr-8 py-2.5 text-xs font-bold shadow-sm focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-abhiRed cursor-pointer"
                      >
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
                    )}
                  </div>

                  {activePage === 'pandit' && (
                    <div className="flex items-center gap-1.5 bg-white/15 border border-white/25 rounded-xl px-2.5 py-1.5">
                      <i className="fa-regular fa-calendar-check text-amber-200 text-xs" />
                      <input
                        type="date"
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="bg-transparent text-white text-xs font-extrabold focus:outline-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {activePage === 'puja_list' && (
                <div className="relative w-full md:w-80">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    type="text"
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    placeholder="350+ पूजा लिस्ट में खोजें (जैसे एकादशी, रुद्राभिषेक...)"
                    className="w-full bg-white text-gray-900 rounded-xl pl-9 pr-8 py-2.5 text-xs font-bold shadow-sm focus:outline-none"
                  />
                  {directorySearch && (
                    <button
                      type="button"
                      onClick={() => setDirectorySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-abhiRed cursor-pointer"
                    >
                      <i className="fa-solid fa-xmark text-xs" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Murti & Photo sub-tabs */}
            {activePage === 'murti' && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {(
                  [
                    ['murti_all', 'सभी मूर्ति व फोटो'],
                    ['murti', 'दिव्य मूर्तियां एवं शिवलिंग'],
                    ['photo', 'भगवान फोटो व फ्रेम'],
                  ] as const
                ).map(([subKey, subLabel]) => (
                  <button
                    key={subKey}
                    type="button"
                    onClick={() => setCurrentCategory(subKey)}
                    className={
                      currentCategory === subKey
                        ? 'px-3.5 py-1.5 rounded-xl bg-white text-abhiRed text-xs font-extrabold shadow-xs cursor-pointer'
                        : 'px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 cursor-pointer'
                    }
                  >
                    {subLabel}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================== HERO SECTION — CLEAN FULL-BLEED OFFER SLIDER (HOME PAGE ONLY) ==================== */}
      {activePage === 'home' && (
      <section className="relative z-20 overflow-hidden text-white bg-gradient-to-br from-[#3b0a0a] via-[#5c1414] to-[#7c2d12] no-print">
        <HeroOfferSlider
          paused={dropdownOpen || searchQuery.trim().length > 0}
          onNavigatePage={(targetPage, keyword) => {
            if (keyword) {
              navigateToPage(targetPage, { keepSearch: true });
              setSearchQuery(keyword);
            } else {
              navigateToPage(targetPage);
            }
          }}
          onCopyPromo={(code) => {
            try {
              navigator.clipboard?.writeText(code);
            } catch {
              // ignore clipboard restrictions
            }
            showToast(`🎉 प्रोमो कोड "${code}" कॉपी हो गया — चेकआउट में लागू करें!`);
          }}
        />
      </section>
      )}

      {/* ==================== BHAGWA SEARCH CONSOLE (FLUSH BELOW HERO SECTION) ==================== */}
      {activePage === 'home' && (
      <div className="w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] max-w-6xl mx-auto -mt-7 sm:-mt-9 lg:-mt-10 mb-2.5 sm:mb-3 bg-gradient-to-r from-[#e84f00] via-[#ff5f00] to-[#e84f00] p-1.5 sm:p-2 rounded-2xl relative z-30 overflow-visible shadow-xl no-print">
        {/* Search Console with Layered Predictive Dropdown */}
        <div className="w-full relative z-40">
          <div
            ref={searchWrapperRef}
            className="relative z-40 bg-white rounded-xl sm:rounded-[14px] shadow-sm p-1.5 sm:p-2 text-gray-900"
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Master Predictive Search Input */}
              <div className="flex-1 min-w-0 flex items-center px-2 sm:px-3.5 py-1.5 sm:py-2 hover:bg-orange-50/40 rounded-lg sm:rounded-xl transition">
                <div className="hidden sm:flex w-9 h-9 rounded-xl bg-orange-50 text-saffron items-center justify-center mr-3 shrink-0">
                  <i className="fa-solid fa-magnifying-glass text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor="masterSearchInput"
                    className="hidden sm:block text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                  >
                    क्या खोज रहे हैं? (Hindi / Hinglish)
                  </label>
                  <div className="flex items-center gap-1 sm:mt-0.5">
                    <input
                      ref={searchInputRef}
                      id="masterSearchInput"
                      type="text"
                      autoComplete="off"
                      aria-label="पूजा, सामग्री किट या पंडित खोजें"
                      value={searchQuery}
                      onFocus={() => setDropdownOpen(true)}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setActivePoojaTag('ALL');
                        setVisibleCount(10);
                        setHighlightedIdx(-1);
                        setDropdownOpen(true);
                      }}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="सत्यनारायण, Griha Pravesh, पंडित..."
                      className="w-full bg-transparent text-sm font-bold sm:font-extrabold text-gray-900 placeholder:font-medium sm:placeholder:font-semibold placeholder:text-gray-400 focus:outline-none truncate"
                    />
                    {searchQuery.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setActivePoojaTag('ALL');
                          setVisibleCount(10);
                          searchInputRef.current?.focus();
                        }}
                        title="साफ़ करें"
                        className="text-gray-400 hover:text-abhiRed p-1 text-sm shrink-0 cursor-pointer"
                      >
                        <i className="fa-solid fa-circle-xmark" />
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startVoiceSearch}
                  title="बोलकर खोजें"
                  className="ml-1.5 sm:ml-2 w-9 h-9 sm:w-auto sm:px-2.5 rounded-lg sm:rounded-xl bg-red-50 hover:bg-abhiRed text-abhiRed hover:text-white border border-red-200/80 flex items-center justify-center gap-1.5 shrink-0 transition cursor-pointer"
                >
                  <i className="fa-solid fa-microphone text-xs" />
                  <span className="text-[11px] font-extrabold hidden sm:inline">बोलें</span>
                </button>
              </div>

              {/* Search Submit */}
              <button
                type="button"
                onClick={() => {
                  if (searchQuery.trim()) {
                    saveRecentSearch(searchQuery);
                    setDropdownOpen(false);
                  } else {
                    searchInputRef.current?.focus();
                    setDropdownOpen(true);
                  }
                }}
                className="shrink-0 h-10 sm:h-12 px-3.5 sm:px-6 lg:px-8 bg-gradient-to-r from-abhiRed to-saffron hover:from-abhiRedDark hover:to-orange-600 text-white font-extrabold text-xs sm:text-sm lg:text-base rounded-lg sm:rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-magnifying-glass text-xs sm:text-sm" />
                <span>खोजें</span>
              </button>
            </div>

            {/* Empty-Focus Dropdown (Recent Searches + Popular) — Full Width on Mobile & Desktop */}
            {dropdownOpen && !searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 z-[9999] max-h-80 sm:max-h-96 overflow-y-auto box-scroll text-left">
                {recentSearches.length > 0 && (
                  <div className="px-3 sm:px-3.5 py-2.5 bg-gray-50/90 border-b border-gray-100">
                    <div className="text-[11px] font-bold text-gray-400 mb-1.5 flex items-center gap-1.5">
                      <i className="fa-solid fa-clock-rotate-left" /> हाल की खोज (Recent)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.map((rs) => (
                        <button
                          key={rs}
                          type="button"
                          data-dropdown-item="true"
                          onClick={() => {
                            setSearchQuery(rs);
                            setActivePoojaTag('ALL');
                            saveRecentSearch(rs);
                            setDropdownOpen(false);
                          }}
                          className="px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-abhiRed text-xs font-bold text-gray-700 hover:text-abhiRed transition cursor-pointer"
                        >
                          {rs}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="px-3 sm:px-3.5 py-2 bg-cream border-b border-orange-100 text-[11px] font-extrabold text-saffron flex items-center justify-between gap-2">
                  <span>🔥 लोकप्रिय पूजा, किट और पंडित</span>
                  <span className="hidden sm:inline text-gray-400 font-semibold">↑↓ चुनें • Enter</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {POPULAR_SEARCHES.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      data-dropdown-item="true"
                      onClick={() => {
                        const clean = item.tag
                          ? item.label.split('(')[0].trim()
                          : item.keyword || item.label;
                        setSearchQuery(clean);
                        setActivePoojaTag(item.tag || 'ALL');
                        saveRecentSearch(clean);
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 sm:px-3.5 py-2.5 hover:bg-orange-50 flex items-center justify-between gap-2 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <i className="fa-solid fa-arrow-trend-up text-gray-400 text-xs shrink-0" />
                        <span className="text-xs sm:text-sm font-bold text-gray-800 truncate">
                          {item.label}
                        </span>
                      </span>
                      <span className="text-[10px] font-extrabold bg-red-50 text-abhiRed px-2 py-0.5 rounded-full shrink-0">
                        {item.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

            {/* ==================== INLINE USER-FRIENDLY SEARCH RESULTS PANEL (DIRECTLY BELOW SEARCH BOX) ==================== */}
            {(searchQuery.trim().length > 0 || activePoojaTag !== 'ALL') && (
              <div className="mt-3 bg-white rounded-2xl shadow-xl border border-orange-200 text-gray-900 overflow-hidden text-left animate-fadeIn">
                {/* Results Header Bar */}
                <div className="px-4 py-3 bg-orange-50/75 border-b border-orange-100 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="fa-solid fa-magnifying-glass text-abhiRed text-xs shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold text-gray-900 truncate">
                      {searchQuery.trim()
                        ? `"${searchQuery.trim()}" के लिए ${filteredListings.length} परिणाम मिले`
                        : `${filteredListings.length} संबंधित परिणाम मिले`}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                    {(
                      [
                        ['ALL', 'सभी'],
                        ['pooja_box', 'पूजा किट'],
                        ['pandit', 'पंडित जी'],
                        ['murti_all', 'मूर्ति व फोटो'],
                      ] as const
                    ).map(([catKey, catLbl]) => (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setCurrentCategory(catKey)}
                        className={
                          currentCategory === catKey
                            ? 'px-2.5 py-1 rounded-lg bg-abhiRed text-white cursor-pointer'
                            : 'px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-700 hover:border-abhiRed hover:text-abhiRed cursor-pointer'
                        }
                      >
                        {catLbl}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActivePoojaTag('ALL');
                        setCurrentCategory('ALL');
                        setDropdownOpen(false);
                      }}
                      className="ml-1 px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-black text-white cursor-pointer flex items-center gap-1"
                    >
                      <i className="fa-solid fa-xmark" /> बंद करें
                    </button>
                  </div>
                </div>

                {/* Matching Products Grid */}
                <div className="p-3.5 sm:p-4 max-h-[460px] overflow-y-auto box-scroll">
                  {filteredListings.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredListings.slice(0, 6).map((p) => {
                          const effPrice =
                            p.category === 'pooja_box' ? getBoxCalculatedPrice(p) : p.basePrice;
                          const badgeLabel =
                            p.category === 'pooja_box'
                              ? 'पूजा किट'
                              : p.category === 'pandit'
                                ? 'पंडित जी'
                                : p.category === 'murti'
                                  ? 'मूर्ति'
                                  : 'फोटो फ्रेम';
                          return (
                            <div
                              key={p.id}
                              className="flex gap-3 p-3 rounded-xl border border-gray-200 hover:border-saffron hover:shadow-sm bg-white transition"
                            >
                              <img
                                src={p.image}
                                alt={p.title}
                                className="w-20 h-20 rounded-xl object-cover border border-orange-100 shrink-0"
                              />
                              <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-extrabold text-saffron tracking-wide">
                                      {badgeLabel}
                                    </span>
                                    <span className="text-[11px] font-extrabold text-green-700 flex items-center gap-0.5 shrink-0 tabular-nums">
                                      ★ {p.rating.toFixed(1)}
                                    </span>
                                  </div>
                                  <h4 className="text-xs sm:text-sm font-extrabold text-gray-900 line-clamp-1 mt-0.5">
                                    {p.title}
                                  </h4>
                                  <p className="text-[11px] text-gray-500 truncate">
                                    {p.vendor} · {p.deliveryTime}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
                                  <span className="text-sm font-extrabold text-abhiRed tabular-nums">
                                    ₹{effPrice}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPujaDetail({
                                          pujaName: p.title,
                                          categoryTitle: badgeLabel,
                                          deityName: p.vendor,
                                          customSamagri: (p.items || [])
                                            .map((i) => `${i.name} (${i.unit})`)
                                            .join(', '),
                                          product: p,
                                        })
                                      }
                                      className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold cursor-pointer"
                                    >
                                      विवरण
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDirectOrderProduct(p)}
                                      className="px-2.5 py-1 rounded-lg bg-abhiRed hover:bg-abhiRedDark text-white text-[11px] font-extrabold shadow-2xs cursor-pointer"
                                    >
                                      तुरंत बुक करें
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {filteredListings.length > 6 && (
                        <div className="mt-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const mainEl = document.querySelector('main');
                              if (mainEl) mainEl.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-abhiRed hover:underline cursor-pointer"
                          >
                            <span>सभी {filteredListings.length} परिणाम नीचे देखें</span>
                            <i className="fa-solid fa-arrow-down" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-5 text-center">
                      <div className="text-3xl mb-1.5">🪔</div>
                      <p className="text-sm font-extrabold text-gray-800">
                        "{searchQuery}" के लिए कोई सीधा किट या पंडित नहीं मिला
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        आप अपनी कस्टम पूजा लिस्ट अपलोड कर सकते हैं या नीचे से लोकप्रिय पूजा चुनें:
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => setCustomListModalOpen(true)}
                          className="bg-saffron hover:bg-orange-600 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                        >
                          + कस्टम पूजा लिस्ट अपलोड करें
                        </button>
                        {['सत्यनारायण', 'गृह प्रवेश', 'रुद्राभिषेक', 'दीपावली'].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => {
                              setSearchQuery(q);
                              setCurrentCategory('ALL');
                            }}
                            className="bg-orange-50 hover:bg-orange-100 text-saffron border border-orange-200 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Puja Vidhi & Categories (Directly Clickable) */}
                  {(dropdownMatches.categories.length > 0 || dropdownMatches.dirPujas.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                      {dropdownMatches.dirPujas.length > 0 && (
                        <div>
                          <div className="text-[11px] font-extrabold text-gray-500 mb-1.5">
                            🕉️ संबंधित पूजा विधि, सामग्री व मंत्र (क्लिक कर पढ़ें):
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {dropdownMatches.dirPujas.slice(0, 6).map((dp, i) => (
                              <button
                                key={`${dp.pujaName}-${i}`}
                                type="button"
                                onClick={() =>
                                  setPujaDetail({
                                    pujaName: dp.pujaName,
                                    categoryTitle: dp.catCode,
                                    deityName: dp.deity,
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                              >
                                <span>{dp.pujaName}</span>
                                <span className="text-[10px] font-extrabold text-abhiRed">
                                  विधि →
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {dropdownMatches.categories.length > 0 && (
                        <div>
                          <div className="text-[11px] font-extrabold text-gray-500 mb-1.5">
                            🗂️ संबंधित पूजा श्रेणियां:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {dropdownMatches.categories.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setActiveDirectoryCatId(c.id);
                                  navigateToPage('puja_list');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-orange-50 text-gray-800 hover:text-saffron border border-gray-200 text-xs font-extrabold transition cursor-pointer"
                              >
                                {c.code} ({c.items.length}) →
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
      </div>
      )}

      {/* ==================== LIVE PANCHANG & MUHURAT STRIP (HOME PAGE ONLY) ==================== */}
      {activePage === 'home' && (
      <section className="bg-amber-50/85 border-b border-amber-200/80 relative z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-3.5 sm:gap-y-1.5 text-xs text-gray-700 w-full lg:w-auto">
              {/* Mobile Top Header Row (Inline on Tablet/Desktop) */}
              <div className="flex items-center justify-between sm:justify-start gap-2 pb-1.5 sm:pb-0 border-b border-amber-200/70 sm:border-0">
                <span className="font-extrabold text-abhiRed inline-flex items-center gap-1.5 shrink-0">
                  <i className="fa-solid fa-om text-saffron" /> आज का पंचांग
                </span>
                <span className="text-amber-300 hidden sm:inline">|</span>
                <span className="font-bold text-gray-900 text-[11px] sm:text-xs truncate">
                  {todayHindiDate}
                </span>
              </div>

              {/* Mobile 2x2 Compact Grid -> Inline Strip on Tablet/Desktop */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-1.5 sm:gap-x-3.5 sm:gap-y-1">
                <span className="hidden sm:inline text-amber-300">·</span>
                <span className="bg-white/80 sm:bg-transparent border border-amber-200/70 sm:border-0 rounded-lg sm:rounded-none px-2.5 py-1.5 sm:p-0 min-w-0">
                  <span className="block sm:inline text-[10px] sm:text-xs text-gray-500 sm:text-gray-700">तिथि: </span>
                  <strong className="text-gray-900 text-[11px] sm:text-xs truncate block sm:inline">
                    {settings.panchangTithi}
                  </strong>
                </span>

                <span className="hidden sm:inline text-amber-300">·</span>
                <span className="bg-white/80 sm:bg-transparent border border-amber-200/70 sm:border-0 rounded-lg sm:rounded-none px-2.5 py-1.5 sm:p-0 min-w-0">
                  <span className="block sm:inline text-[10px] sm:text-xs text-gray-500 sm:text-gray-700">नक्षत्र: </span>
                  <strong className="text-gray-900 text-[11px] sm:text-xs truncate block sm:inline">
                    {settings.panchangNakshatra}
                  </strong>
                </span>

                <span className="hidden sm:inline text-amber-300">·</span>
                <span className="bg-green-50/80 sm:bg-transparent border border-green-200/70 sm:border-0 rounded-lg sm:rounded-none px-2.5 py-1.5 sm:p-0 text-green-800 min-w-0">
                  <span className="block sm:inline text-[10px] sm:text-xs">अभिजीत मुहूर्त: </span>
                  <strong className="tabular-nums text-[11px] sm:text-xs block sm:inline">
                    {settings.panchangAbhijit}
                  </strong>
                </span>

                <span className="hidden sm:inline text-amber-300">·</span>
                <span className="bg-red-50/75 sm:bg-transparent border border-red-200/70 sm:border-0 rounded-lg sm:rounded-none px-2.5 py-1.5 sm:p-0 text-abhiRed min-w-0">
                  <span className="block sm:inline text-[10px] sm:text-xs">राहुकाल: </span>
                  <strong className="tabular-nums text-[11px] sm:text-xs block sm:inline">
                    {settings.panchangRahukaal}
                  </strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBookInShubhMuhurat}
              className="w-full sm:w-auto shrink-0 bg-abhiRed hover:bg-abhiRedDark text-white text-xs font-extrabold px-4 py-2.5 sm:py-2 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>शुभ मुहूर्त में पूजा बुक करें</span>
              <i className="fa-solid fa-arrow-right text-[10px]" />
            </button>
          </div>
        </div>
      </section>
      )}

      {/* ==================== 17 MASTER CATEGORIES RIBBON (HOME & POOJA KIT PAGES) ==================== */}
      {(activePage === 'home' || activePage === 'pooja_box') && (
      <section className="bg-white border-b border-gray-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="hidden md:flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-gray-700 tracking-wide">
              <i className="fa-solid fa-layer-group text-saffron mr-1.5" />
              17 मुख्य हिंदू पूजा श्रेणियां
            </span>
            <button
              type="button"
              onClick={scrollToMasterDirectory}
              className="text-xs font-extrabold text-abhiRed hover:underline cursor-pointer"
            >
              पूरी डायरेक्टरी देखें (350+ पूजाएं) →
            </button>
          </div>
          <div className="ticker-ltr-wrap relative overflow-hidden pb-1 text-xs">
            <div className="ticker-ltr-track">
              {[0, 1].map((dupIdx) => (
                <div
                  key={dupIdx}
                  aria-hidden={dupIdx === 1}
                  className="flex items-center gap-2 pr-2 shrink-0"
                >
                  {RIBBON_SHORT_LABELS.map((cat) => (
                    <button
                      key={`${dupIdx}-${cat.id}`}
                      type="button"
                      tabIndex={dupIdx === 1 ? -1 : 0}
                      onClick={() => {
                        setCurrentMasterCat((prev) => (prev === cat.id ? 'ALL' : cat.id));
                        setVisibleCount(10);
                      }}
                      className={
                        currentMasterCat === cat.id
                          ? 'px-3.5 py-2 rounded-xl bg-abhiRed text-white font-extrabold shrink-0 border border-abhiRed transition cursor-pointer'
                          : 'px-3.5 py-2 rounded-xl bg-orange-50/50 hover:bg-orange-50 text-gray-800 hover:text-saffron font-bold shrink-0 border border-orange-200/80 transition cursor-pointer'
                      }
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ==================== DEDICATED 4-ROLE PANELS ==================== */}
      {activePage === 'user_panel' && (
        <div className="flex-1 w-full bg-[#f8fafc] no-print">
          <UserPanelPage
            user={user}
            onRequireLogin={() => openAuthGate('login', () => navigateToPage('user_panel'), 'user')}
            onRefreshAccount={refreshAccount}
            onCancelOrder={handleCancelOrder}
            onToggleWishlist={(id) => void handleToggleWishlist(id)}
            onOpenReceipt={(don) => setReceiptDonation(don)}
            onLogout={handleLogout}
            onOpenStorefront={() => navigateToPage('home')}
            onSwitchPanel={(panel) => navigateToPage(panel)}
            showToast={showToast}
          />
        </div>
      )}

      {activePage === 'vendor_panel' && (
        <div className="flex-1 w-full bg-[#f8fafc] no-print">
          <VendorPanelPage
            user={user}
            vendorProfile={vendorProfile}
            onRequireLogin={() => openAuthGate('login', () => navigateToPage('vendor_panel'), 'vendor')}
            onCatalogUpdated={loadCatalogAndBootstrap}
            onAccountUpdated={refreshAccount}
            onOpenStorefront={() => navigateToPage('home')}
            showToast={showToast}
          />
        </div>
      )}

      {activePage === 'pandit_panel' && (
        <div className="flex-1 w-full bg-[#f8fafc] no-print">
          <PanditPanelPage
            user={user}
            panditProfile={panditProfile}
            onRequireLogin={() => openAuthGate('login', () => navigateToPage('pandit_panel'), 'pandit')}
            onCatalogUpdated={loadCatalogAndBootstrap}
            onAccountUpdated={refreshAccount}
            onOpenStorefront={() => navigateToPage('home')}
            showToast={showToast}
          />
        </div>
      )}

      {activePage === 'super_admin' && (
        <div className="flex-1 w-full bg-[#f8fafc] no-print">
          <SuperAdminPanelPage
            user={user}
            onRequireLogin={() => openAuthGate('login', () => navigateToPage('super_admin'), 'super_admin')}
            onGlobalDataChanged={loadCatalogAndBootstrap}
            onOpenStorefront={() => navigateToPage('home')}
            onSwitchPanel={(panel) => navigateToPage(panel)}
            showToast={showToast}
          />
        </div>
      )}

      {/* ==================== MAIN MARKETPLACE SECTION ==================== */}
      {!isPanelPage && (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full no-print">
        {/* Custom Puja List Upload Banner (Home & Pooja Kit pages) */}
        {(activePage === 'home' || activePage === 'pooja_box') && (
        <div className="bg-gradient-to-r from-orange-50/85 via-white to-amber-50/85 border border-orange-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 mb-4 sm:mb-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-saffron to-abhiRed text-white flex items-center justify-center text-base sm:text-lg shrink-0 shadow-xs">
              <i className="fa-solid fa-file-pen" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] sm:text-[11px] font-extrabold tracking-wide text-saffron mb-0.5">
                कस्टम पूजा लिस्ट · मासिक रिमाइंडर
              </div>
              <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-gray-900 leading-snug">
                पंडित जी की लिखी पूजा लिस्ट है? फोटो अपलोड करें या लिस्ट लिखकर बुक करें
              </h2>
              <p className="text-[11px] sm:text-xs md:text-sm text-gray-600 mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                अपनी हाथ से लिखी पर्ची की <strong className="text-gray-900">फोटो / PDF अपलोड करें</strong> या कस्टम सामग्री लिस्ट लिखें — आपका नज़दीकी पूजा भंडार पूरी लिस्ट पैक करके घर पहुंचाएगा।
              </p>
            </div>
          </div>
          <div className="flex w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setCustomListModalOpen(true)}
              className="w-full md:w-auto bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl shadow-xs transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-file-arrow-up" />
              <span>पर्ची अपलोड करें</span>
            </button>
          </div>
        </div>
        )}

        {/* Catalog Listings View (Home, Pooja Kit, Pandit Booking, Murti & Photo) */}
        {(activePage === 'home' || isDedicatedCatalogPage) && (
        <>
        {/* Mobile Filter Toggle Bar */}
        {isFilteredView && (
          <div className="flex lg:hidden items-center justify-between gap-2 mb-4">
            <span className="text-xs font-extrabold text-gray-700">फिल्टर विकल्प:</span>
            <button
              type="button"
              onClick={() => setMobileFilterOpen((v) => !v)}
              className="bg-white border border-gray-300 px-3.5 py-2 rounded-xl text-xs font-extrabold text-gray-800 flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
            >
              <i className="fa-solid fa-filter text-abhiRed" /> फिल्टर खोलें
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* LEFT SIDEBAR (visible when filtered, matching original UX) */}
          {isFilteredView && (
            <aside
              className={`${
                mobileFilterOpen ? 'block' : 'hidden lg:block'
              } w-full lg:w-72 shrink-0 bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 lg:sticky lg:top-20 space-y-5`}
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                  <i className="fa-solid fa-sliders text-abhiRed" /> फिल्टर (FILTERS)
                </h3>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-bold text-abhiRed hover:underline cursor-pointer"
                >
                  होमपेज पर जाएं
                </button>
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-700 mb-2">
                  सेवा श्रेणी (Service Type)
                </div>
                <div className="space-y-2 text-xs font-semibold text-gray-700">
                  {(
                    [
                      ['ALL', 'सभी सेवाएं (All Listings)', 'home'],
                      ['pooja_box', 'पूजा सामग्री बॉक्स (Custom Kit)', 'pooja_box'],
                      ['pandit', 'पंडित बुकिंग (Pandit Ji)', 'pandit'],
                      ['murti', 'मूर्तियां (Eco & Shivling)', 'murti'],
                      ['photo', 'भगवान फोटो व फ्रेम', 'murti'],
                    ] as const
                  ).map(([val, lbl, targetPage]) => (
                    <label key={val} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sideCat"
                        value={val}
                        checked={
                          currentCategory === val ||
                          (val === 'murti' && currentCategory === 'murti_all')
                        }
                        onChange={() => {
                          navigateToPage(targetPage, {
                            subCategory: val,
                            keepSearch: true,
                          });
                        }}
                        className="accent-abhiRed w-4 h-4"
                      />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-extrabold text-gray-700 mb-1.5">
                  17 मास्टर पूजा श्रेणी चुनें
                </label>
                <select
                  value={currentMasterCat}
                  onChange={(e) => {
                    setCurrentMasterCat(e.target.value);
                    setVisibleCount(10);
                  }}
                  className="w-full border border-gray-300 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-800 bg-gray-50 focus:outline-none focus:border-abhiRed"
                >
                  <option value="ALL">सभी 17 मास्टर श्रेणियां</option>
                  {masterCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs font-extrabold text-gray-700 mb-2">डिलीवरी और रेटिंग</div>
                <div className="space-y-2 text-xs font-semibold text-gray-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={globalOnly}
                      onChange={(e) => setGlobalOnly(e.target.checked)}
                      className="accent-abhiRed w-4 h-4 rounded"
                    />
                    <span>🌍 केवल ग्लोबल शिपिंग उपलब्ध</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={topRatedOnly}
                      onChange={(e) => setTopRatedOnly(e.target.checked)}
                      className="accent-abhiRed w-4 h-4 rounded"
                    />
                    <span>⭐ टॉप रेटेड (4.8+ रेटिंग)</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex justify-between text-xs font-extrabold text-gray-700 mb-1">
                  <span>अधिकतम बजट (Max Price)</span>
                  <span className="text-abhiRed">₹{maxPrice}</span>
                </div>
                <input
                  type="range"
                  min={200}
                  max={3000}
                  step={100}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-abhiRed cursor-pointer"
                />
              </div>
            </aside>
          )}

          {/* RIGHT MAIN COLUMN */}
          <div className="flex-1 min-w-0 w-full">
            {/* Result Count & Sort Strip */}
            <div className="bg-white rounded-xl border border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shadow-2xs">
              <div className="flex items-start sm:items-center gap-2 min-w-0">
                <i className="fa-solid fa-layer-group text-saffron text-xs mt-0.5 sm:mt-0 shrink-0" />
                <span className="text-xs sm:text-sm font-extrabold text-gray-800 leading-snug tabular-nums">
                  {catalogLoading
                    ? 'पूजा किट व पंडित लोड हो रहे हैं...'
                    : `${filteredListings.length} पूजा किट, वेंडर और पंडित उपलब्ध हैं (दिखाए जा रहे हैं: ${paginatedListings.length})`}
                </span>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 text-xs w-full sm:w-auto pt-2 sm:pt-0 border-t border-gray-100 sm:border-0">
                <span className="text-gray-500 font-bold shrink-0">क्रमबद्ध करें:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 sm:flex-initial border border-gray-200 rounded-lg px-2.5 py-2 sm:py-1.5 font-bold text-gray-700 bg-gray-50 focus:outline-none focus:border-abhiRed min-w-0"
                >
                  <option value="recommended">लोकप्रियता (Recommended)</option>
                  <option value="price_low">कीमत: कम से ज्यादा</option>
                  <option value="price_high">कीमत: ज्यादा से कम</option>
                  <option value="rating">सर्वश्रेष्ठ रेटिंग</option>
                </select>
              </div>
            </div>

            {/* Quick Pooja Filter Chips */}
            <div className="flex items-center gap-2 pb-3 mb-3 overflow-x-auto no-scrollbar text-xs">
              {QUICK_TAGS.map((qt) => (
                <button
                  key={qt.tag}
                  type="button"
                  onClick={() => {
                    setActivePoojaTag(qt.tag);
                    setVisibleCount(10);
                    if (qt.tag === 'ALL') setSearchQuery('');
                  }}
                  className={
                    activePoojaTag === qt.tag
                      ? 'px-3.5 py-1.5 rounded-xl bg-abhiRed text-white font-bold shrink-0 cursor-pointer'
                      : 'px-3.5 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-saffron text-gray-700 hover:text-saffron font-semibold shrink-0 cursor-pointer'
                  }
                >
                  {qt.label}
                </button>
              ))}
            </div>

            {/* Error State */}
            {catalogError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center mb-4">
                <p className="text-sm font-extrabold text-red-800">{catalogError}</p>
                <button
                  type="button"
                  onClick={() => void loadCatalogAndBootstrap()}
                  className="mt-2 bg-abhiRed text-white px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  पुनः प्रयास करें
                </button>
              </div>
            )}

            {/* Loading Skeletons */}
            {catalogLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse flex gap-4"
                  >
                    <div className="w-36 h-32 bg-gray-200 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-5 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 bg-gray-200 rounded w-full" />
                      <div className="h-8 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : paginatedListings.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-2xs">
                <div className="text-5xl mb-3">🪔</div>
                <h3 className="text-lg font-extrabold text-gray-800">
                  इस फिल्टर के लिए कोई पूजा किट या वेंडर नहीं मिला
                </h3>
                <p className="text-xs text-gray-500 mt-1 mb-4">
                  आप अपनी कस्टम पूजा लिस्ट भी अपलोड कर सकते हैं या सभी फिल्टर रीसेट करें।
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="bg-abhiRed text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow cursor-pointer"
                  >
                    सभी पूजा किट दिखाएं
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomListModalOpen(true)}
                    className="bg-saffron text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow cursor-pointer"
                  >
                    + कस्टम लिस्ट अपलोड करें
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedListings.map((product) => (
                    <ListingCard
                      key={product.id}
                      product={product}
                      bookingDate={bookingDate}
                      isWishlisted={wishlistIds.includes(product.id)}
                      onToggleWishlist={(id) => void handleToggleWishlist(id)}
                      onToggleAccordion={toggleBoxAccordion}
                      onToggleBoxItem={toggleBoxItem}
                      onUpdateBoxItemQty={updateBoxItemQty}
                      onToggleSubscription={toggleBoxSubscription}
                      onChangeSubscriptionCycle={changeBoxSubscriptionCycle}
                      onOpenDirectOrder={(p) => setDirectOrderProduct(p)}
                      onAddBoxToCart={handleAddBoxToCart}
                      onAddPanditToCart={handleAddPanditToCart}
                      onAddVariantToCart={handleAddVariantToCart}
                      onOpenReviews={(p) => setReviewsProduct(p)}
                      onOpenPujaDetail={(p) =>
                        setPujaDetail({
                          pujaName: p.title,
                          categoryTitle: 'चयनित वैदिक पूजा किट',
                          deityName: p.vendor,
                          customSamagri: (p.items || [])
                            .map((i) => `${i.name} (${i.unit})`)
                            .join(', '),
                          product: p,
                        })
                      }
                    />
                  ))}
                </div>

                {filteredListings.length > visibleCount && (
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((v) => v + 10)}
                      className="bg-white hover:bg-orange-50 text-abhiRed border border-abhiRed/40 font-extrabold px-6 py-3 rounded-xl text-xs sm:text-sm shadow-2xs transition cursor-pointer"
                    >
                      <i className="fa-solid fa-angles-down mr-1.5" /> और लोड करें (Load More Kits)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        </>
        )}

        {/* ==================== SEVA DAKSHINA SECTION (HOME & DEDICATED SEVA PAGE) ==================== */}
        {(activePage === 'home' || activePage === 'seva_dakshina') && (
          <div className={activePage === 'seva_dakshina' ? '[&>section]:mt-0' : ''}>
            <SevaDakshinaSection
              settings={settings}
              user={user}
              onReceiptGenerated={(don) => {
                setReceiptDonation(don);
                setUserDonations((prev) => [don, ...prev]);
              }}
              showToast={showToast}
            />
          </div>
        )}

        {/* ==================== 17-CATEGORY MASTER DIRECTORY (HOME & DEDICATED PUJA LIST PAGE) ==================== */}
        {(activePage === 'home' || activePage === 'puja_list') && (
          <div className={activePage === 'puja_list' ? '[&>section]:mt-0' : ''}>
            <MasterDirectorySection
              categories={
                activePage === 'puja_list' && directorySearch.trim()
                  ? masterCategories
                      .map((c) => {
                        const tokens = expandBilingualTerms(directorySearch);
                        const catMatches = matchesBilingual(
                          `${c.code} ${c.deity} ${c.hinglish}`,
                          tokens
                        );
                        if (catMatches) return c;
                        const matchedItems = c.items.filter((it) =>
                          matchesBilingual(`${it} ${c.code}`, tokens)
                        );
                        return matchedItems.length > 0 ? { ...c, items: matchedItems } : null;
                      })
                      .filter((c): c is MasterCategory => c !== null)
                  : masterCategories
              }
              activeDirCatId={activeDirectoryCatId}
              onSelectDirCat={setActiveDirectoryCatId}
              onFilterByMasterCat={(catId) => {
                navigateToPage('pooja_box', { masterCat: catId });
              }}
              onOpenPujaDetail={(pujaName, catCode, deity) =>
                setPujaDetail({ pujaName, categoryTitle: catCode, deityName: deity })
              }
              onFocusSearch={focusMasterSearch}
            />
          </div>
        )}
      </main>
      )}

      {/* ==================== PROFESSIONAL FOOTER ==================== */}
      <footer className="bg-gray-900 text-gray-300 border-t-4 border-saffron mt-14 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 pb-10 border-b border-gray-800">
            {/* Column 1: Brand & Heritage */}
            <div className="space-y-4">
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault();
                  resetFilters();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2.5"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-abhiRed to-saffron flex items-center justify-center text-white text-xl font-extrabold shadow-md">
                  ॐ
                </div>
                <div>
                  <div className="text-xl font-extrabold tracking-tight text-white leading-none">
                    Puja<span className="text-saffron">Junction</span>
                    <span className="text-sm font-extrabold text-gray-400">.com</span>
                  </div>
                  <div className="text-[11px] font-semibold text-amber-300/90 mt-0.5">
                    वैदिक किट, पंडित, मूर्ति व सेवा दक्षिणा
                  </div>
                </div>
              </a>
              <p className="text-xs text-gray-400 leading-relaxed">
                भारत का विश्वसनीय वैदिक पूजा सामग्री एवं अनुष्ठान केंद्र। 100% शुद्ध हवन-पूजन किट्स,
                सत्यापित वैदिक आचार्य बुकिंग, 17-श्रेणी पूजा पंचांग और पारदर्शी सेवा दक्षिणा — सीधे आपके
                द्वार तक।
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-bold text-gray-300">
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved text-green-400" />
                  <span>100% शुद्ध सामग्री</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-user-check text-amber-400" />
                  <span>प्रमाणित पंडित जी</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-truck-fast text-orange-400" />
                  <span>त्वरित होम डिलीवरी</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-lock text-sky-400" />
                  <span>सुरक्षित UPI व COD</span>
                </div>
              </div>
            </div>

            {/* Column 2: Quick Services */}
            <div>
              <h4 className="text-sm font-extrabold text-white tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-saffron rounded-full inline-block" />
                प्रमुख पूजा सेवाएं
              </h4>
              <ul className="space-y-2.5 text-xs font-semibold">
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToPage('home')}
                    className="text-gray-400 hover:text-amber-300 transition flex items-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-angle-right text-saffron text-[10px]" />
                    सभी पूजा सेवाएं एवं किट्स
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToPage('pooja_box')}
                    className="text-gray-400 hover:text-amber-300 transition flex items-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-angle-right text-saffron text-[10px]" />
                    संपूर्ण वैदिक पूजा सामग्री किट
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToPage('pandit')}
                    className="text-gray-400 hover:text-amber-300 transition flex items-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-angle-right text-saffron text-[10px]" />
                    ऑनलाइन पंडित / आचार्य बुकिंग
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToPage('murti')}
                    className="text-gray-400 hover:text-amber-300 transition flex items-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-angle-right text-saffron text-[10px]" />
                    दिव्य मूर्ति व पूजन फोटो फ्रेम
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToPage('seva_dakshina')}
                    className="text-gray-400 hover:text-amber-300 transition flex items-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-angle-right text-saffron text-[10px]" />
                    सेवा दक्षिणा एवं मंदिर दान
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToPage('puja_list')}
                    className="text-gray-400 hover:text-amber-300 transition flex items-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-angle-right text-saffron text-[10px]" />
                    सभी पूजा लिस्ट (17 श्रेणियां)
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: 4-Role Portals & Account Center */}
            <div>
              <h4 className="text-sm font-extrabold text-white tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-abhiRed rounded-full inline-block" />
                सभी पोर्टल एवं लॉगिन केंद्र
              </h4>
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (user) navigateToPage('vendor_panel');
                    else openAuthGate('login', () => navigateToPage('vendor_panel'), 'vendor');
                  }}
                  className="w-full text-left bg-gradient-to-r from-saffron/20 to-abhiRed/20 hover:from-saffron/30 hover:to-abhiRed/30 border border-saffron/40 rounded-xl p-2.5 transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-300 flex items-center gap-2">
                      <i className="fa-solid fa-store text-saffron" />
                      वेंडर पैनल (WooCommerce)
                    </span>
                    <i className="fa-solid fa-arrow-right text-[11px] text-amber-300 group-hover:translate-x-0.5 transition" />
                  </div>
                  <p className="text-[11px] text-gray-300 mt-0.5">
                    उत्पाद, स्टॉक, ऑर्डर, कूपन व पेआउट मैनेज करें।
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (user) navigateToPage('pandit_panel');
                    else openAuthGate('login', () => navigateToPage('pandit_panel'), 'pandit');
                  }}
                  className="w-full text-left bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 rounded-xl p-2.5 transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-200 flex items-center gap-2">
                      <i className="fa-solid fa-hands-praying text-amber-400" />
                      पंडित जी पैनल (Listing Profile)
                    </span>
                    <i className="fa-solid fa-arrow-right text-[11px] text-amber-200 group-hover:translate-x-0.5 transition" />
                  </div>
                  <p className="text-[11px] text-gray-300 mt-0.5">
                    प्रोफ़ाइल, पूजा सेवाएं, दक्षिणा व यजमान बुकिंग।
                  </p>
                </button>

                <ul className="space-y-2 text-xs font-semibold pt-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        if (user) navigateToPage('user_panel');
                        else openAuthGate('login', () => navigateToPage('user_panel'), 'user');
                      }}
                      className="text-gray-300 hover:text-amber-300 transition flex items-center gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-user-circle text-sky-400 w-3.5" />
                      यूज़र पैनल (ऑर्डर, बुकिंग व रसीदें)
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        if (user && (user.role === 'super_admin' || user.role === 'admin')) {
                          navigateToPage('super_admin');
                        } else {
                          openAuthGate('login', () => navigateToPage('super_admin'), 'super_admin');
                        }
                      }}
                      className="text-amber-300 hover:text-white transition flex items-center gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-user-shield text-abhiRed w-3.5" />
                      सुपर एडमिन कंट्रोल पैनल
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setCustomListModalOpen(true)}
                      className="text-gray-400 hover:text-amber-300 transition flex items-center gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-file-arrow-up text-saffron w-3.5" />
                      कस्टम पूजा लिस्ट अपलोड करें
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            {/* Column 4: Contact & Support */}
            <div>
              <h4 className="text-sm font-extrabold text-white tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-amber-400 rounded-full inline-block" />
                संपर्क एवं सहायता
              </h4>
              <div className="space-y-3 text-xs">
                <a
                  href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                    'नमस्ते PujaJunction.com, मुझे पूजा सामग्री / पंडित बुकिंग के बारे में जानकारी चाहिए।'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 text-green-300 px-3.5 py-2.5 rounded-xl font-extrabold transition"
                >
                  <i className="fa-brands fa-whatsapp text-lg text-green-400" />
                  <div>
                    <div className="leading-tight">WhatsApp सहायता केंद्र</div>
                    <div className="text-[11px] font-semibold text-green-200/80">
                      +{settings.whatsappNumber.replace(/^\+/, '')}
                    </div>
                  </div>
                </a>

                <div className="space-y-2 text-gray-400 pt-1">
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-clock text-saffron mt-0.5 w-3.5" />
                    <span>सेवा समय: प्रतिदिन प्रातः 6:00 – रात्रि 10:00 बजे</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-location-dot text-abhiRed mt-0.5 w-3.5" />
                    <span>साकची, जमशेदपुर (झारखंड) • संपूर्ण भारत व ग्लोबल डिलीवरी</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-sun text-amber-400 mt-0.5 w-3.5" />
                    <span>आज का अभिजीत मुहूर्त: {settings.panchangAbhijit}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    स्वीकृत भुगतान माध्यम
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-extrabold text-gray-300">
                    <span className="bg-gray-900 border border-gray-800 px-2 py-1 rounded-md">
                      UPI / QR
                    </span>
                    <span className="bg-gray-900 border border-gray-800 px-2 py-1 rounded-md">
                      PhonePe
                    </span>
                    <span className="bg-gray-900 border border-gray-800 px-2 py-1 rounded-md">
                      GPay
                    </span>
                    <span className="bg-gray-900 border border-gray-800 px-2 py-1 rounded-md">
                      Cash on Delivery
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-500">
            <div>
              © {new Date().getFullYear()}{' '}
              <span className="text-gray-300 font-bold">PujaJunction.com</span> — सर्वाधिकार
              सुरक्षित।
            </div>
            <div className="flex flex-wrap items-center gap-3 font-semibold text-gray-400">
              <span>शुद्ध वैदिक परंपरा</span>
              <span className="text-gray-700">•</span>
              <span>सत्यापित पूजा भंडार</span>
              <span className="text-gray-700">•</span>
              <span className="text-amber-300/90">भारत में निर्मित</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ==================== ALL MODALS & DRAWERS ==================== */}
      <AuthModal
        isOpen={authModalOpen}
        initialTab={authModalTab}
        portalContext={authPortalContext}
        pendingVerifyToken={pendingVerifyToken}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(u, vt) => void handleAuthSuccess(u, vt)}
        showToast={showToast}
      />

      <AccountModal
        isOpen={accountModalOpen}
        initialTab={accountInitialTab}
        user={user}
        addresses={addresses}
        wishlistListings={wishlistListings}
        subscriptions={userSubscriptions}
        donations={userDonations}
        notifications={notifications}
        onClose={() => setAccountModalOpen(false)}
        onRefreshAccount={refreshAccount}
        onLogout={handleLogout}
        onToggleWishlist={(id) => void handleToggleWishlist(id)}
        onOpenReceipt={(don) => {
          setAccountModalOpen(false);
          setReceiptDonation(don);
        }}
        showToast={showToast}
      />

      <CartDrawer
        isOpen={cartDrawerOpen}
        cart={cart}
        user={user}
        addresses={addresses}
        settings={settings}
        onClose={() => setCartDrawerOpen(false)}
        onRemoveItem={(id) => void handleRemoveCartItem(id)}
        onRequireAuth={(pending) => openAuthGate('login', pending)}
        onOrderCreated={(id, msg) => {
          setSuccessOrder({ id, msg });
          void refreshAccount();
        }}
        showToast={showToast}
      />

      <DirectOrderModal
        product={directOrderProduct}
        user={user}
        addresses={addresses}
        settings={settings}
        onClose={() => setDirectOrderProduct(null)}
        onRequireAuth={(pending) => openAuthGate('login', pending)}
        onOrderCreated={(id, msg) => {
          setSuccessOrder({ id, msg });
          void refreshAccount();
        }}
        showToast={showToast}
      />

      <OrderSuccessModal
        orderId={successOrder?.id || null}
        message={successOrder?.msg || ''}
        onClose={() => setSuccessOrder(null)}
        onTrack={() => setTrackingModalOpen(true)}
      />

      <TrackingModal
        isOpen={trackingModalOpen}
        orders={orders}
        donations={userDonations}
        user={user}
        onClose={() => setTrackingModalOpen(false)}
        onRequireAuth={() => openAuthGate('login')}
        onCancelOrder={handleCancelOrder}
        onOpenReceipt={(don) => {
          setTrackingModalOpen(false);
          setReceiptDonation(don);
        }}
      />

      <CustomListModal
        isOpen={customListModalOpen}
        defaultDate={bookingDate}
        user={user}
        addresses={addresses}
        onClose={() => setCustomListModalOpen(false)}
        onAddCustomToCart={(payload) => {
          void addItemToCart(
            {
              listingId: null,
              itemType: 'custom_list',
              title: payload.title,
              vendorName: 'PujaJunction.com भंडार',
              details: payload.details,
              pujaDate: payload.pujaDate,
              unitPrice: payload.price,
              qty: 1,
            },
            {
              listingId: null,
              itemType: 'custom_list',
              customTitle: payload.title,
              customDetails: payload.details,
              customPrice: payload.price,
              pujaDate: payload.pujaDate,
            },
            'आपकी कस्टम पूजा लिस्ट कार्ट में जोड़ दी गई है!'
          );
        }}
        onSubmitted={(orderId, msg) => {
          setSuccessOrder({ id: orderId, msg });
          void refreshAccount();
        }}
        showToast={showToast}
      />

      <ReviewsModal
        product={reviewsProduct}
        user={user}
        onClose={() => setReviewsProduct(null)}
        onRequireAuth={() => openAuthGate('login')}
        onReviewUpdated={(listingId, ratingAvg, nextReviews: ListingReview[]) => {
          setListings((prev) =>
            prev.map((l) =>
              l.id === listingId
                ? { ...l, rating: ratingAvg, ratingCount: nextReviews.length, reviews: nextReviews }
                : l
            )
          );
          setReviewsProduct((prev) =>
            prev && prev.id === listingId
              ? { ...prev, rating: ratingAvg, ratingCount: nextReviews.length, reviews: nextReviews }
              : prev
          );
        }}
        showToast={showToast}
      />

      <PujaDetailModal
        detail={pujaDetail}
        onClose={() => setPujaDetail(null)}
        onBookKit={(d) => {
          if (d.product) {
            setDirectOrderProduct(d.product);
          } else {
            const firstWord = d.pujaName.split(' ')[0];
            navigateToPage('home', { keepSearch: true });
            setSearchQuery(firstWord);
            showToast(`"${d.pujaName}" के लिए उपलब्ध किट व पंडित दिखाए जा रहे हैं`);
          }
        }}
        onOpenCustomList={() => setCustomListModalOpen(true)}
      />

      <VoiceSearchModal
        isOpen={voiceModalOpen}
        statusText={voiceStatus}
        transcript={voiceTranscript}
        onStop={stopVoiceSearch}
        onSelectQuery={applyVoiceQuery}
      />

      <ReceiptModal
        donation={receiptDonation}
        settings={settings}
        onClose={() => setReceiptDonation(null)}
      />

      <VendorDashboardModal
        isOpen={vendorModalOpen}
        user={user}
        vendorProfile={vendorProfile}
        onClose={() => setVendorModalOpen(false)}
        onRequireAuth={() => openAuthGate('login')}
        onCatalogUpdated={loadCatalogAndBootstrap}
        onAccountUpdated={refreshAccount}
        showToast={showToast}
      />

      <AdminPanelModal
        isOpen={adminModalOpen}
        user={user}
        onClose={() => setAdminModalOpen(false)}
        onGlobalSettingsChanged={loadCatalogAndBootstrap}
        showToast={showToast}
      />

      {/* ==================== FLOATING BOTTOM-RIGHT GLOBAL SEARCH BAR (ALL PAGES) ==================== */}
      <div
        ref={floatingSearchRef}
        className="fixed bottom-4 right-3 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end no-print"
      >
        {floatingSearchOpen ? (
          <div className="w-[calc(100vw-1.5rem)] max-w-[420px] bg-white rounded-2xl shadow-2xl border-2 border-saffron/70 overflow-hidden animate-fadeIn">
            {/* Live Results / Suggestions Panel (Above Input) */}
            <div className="max-h-[52vh] overflow-y-auto box-scroll bg-white text-left">
              <div className="px-3.5 py-2.5 bg-gradient-to-r from-abhiRed to-saffron text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-extrabold">
                  <i className="fa-solid fa-magnifying-glass" />
                  <span>त्वरित खोज — पूजा, किट, पंडित व मूर्ति</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFloatingSearchOpen(false)}
                  aria-label="खोज बंद करें"
                  className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs cursor-pointer"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              {!searchQuery.trim() ? (
                <>
                  {recentSearches.length > 0 && (
                    <div className="px-3.5 py-2.5 bg-gray-50 border-b border-gray-100">
                      <div className="text-[11px] font-bold text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <i className="fa-solid fa-clock-rotate-left" /> हाल की खोज
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recentSearches.slice(0, 6).map((rs) => (
                          <button
                            key={rs}
                            type="button"
                            onClick={() => {
                              setSearchQuery(rs);
                              setActivePoojaTag('ALL');
                              saveRecentSearch(rs);
                              if (activePage !== 'home') {
                                navigateToPage('home', { keepSearch: true });
                              }
                              setFloatingSearchOpen(false);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-abhiRed text-xs font-bold text-gray-700 hover:text-abhiRed transition cursor-pointer"
                          >
                            {rs}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="px-3.5 py-2 bg-cream border-b border-orange-100 text-[11px] font-extrabold text-saffron">
                    🔥 लोकप्रिय पूजा, किट और पंडित
                  </div>
                  <div className="divide-y divide-gray-100">
                    {POPULAR_SEARCHES.slice(0, 6).map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          const clean = item.tag
                            ? item.label.split('(')[0].trim()
                            : item.keyword || item.label;
                          setSearchQuery(clean);
                          setActivePoojaTag(item.tag || 'ALL');
                          saveRecentSearch(clean);
                          if (activePage !== 'home') {
                            navigateToPage('home', { keepSearch: true });
                          }
                          setFloatingSearchOpen(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-orange-50 flex items-center justify-between gap-2 transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <i className="fa-solid fa-arrow-trend-up text-gray-400 text-xs shrink-0" />
                          <span className="text-xs font-bold text-gray-800 truncate">
                            {item.label}
                          </span>
                        </span>
                        <span className="text-[10px] font-extrabold bg-red-50 text-abhiRed px-2 py-0.5 rounded-full shrink-0">
                          {item.type}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="px-3.5 py-2 bg-orange-50/75 text-[11px] font-extrabold text-gray-800 flex items-center justify-between gap-2">
                    <span className="truncate">
                      "{searchQuery.trim()}" — {filteredListings.length} परिणाम
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        saveRecentSearch(searchQuery);
                        if (activePage !== 'home') {
                          navigateToPage('home', { keepSearch: true });
                        }
                        setFloatingSearchOpen(false);
                        window.scrollTo({ top: 260, behavior: 'smooth' });
                      }}
                      className="text-abhiRed hover:underline shrink-0 cursor-pointer"
                    >
                      सभी देखें →
                    </button>
                  </div>

                  {filteredListings.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-500">
                      कोई परिणाम नहीं मिला — दूसरा शब्द लिखें या{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setFloatingSearchOpen(false);
                          setCustomListModalOpen(true);
                        }}
                        className="text-abhiRed font-extrabold underline cursor-pointer"
                      >
                        कस्टम पर्ची अपलोड करें
                      </button>
                    </div>
                  ) : (
                    filteredListings.slice(0, 6).map((item) => {
                      const price =
                        item.category === 'pooja_box'
                          ? getBoxCalculatedPrice(item)
                          : item.basePrice;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            saveRecentSearch(searchQuery);
                            setFloatingSearchOpen(false);
                            if (activePage !== 'home') {
                              navigateToPage('home', { keepSearch: true });
                            }
                            setPujaDetail({
                              pujaName: item.title,
                              categoryTitle: 'चयनित वैदिक पूजा सेवा',
                              deityName: item.vendor,
                              customSamagri: (item.items || [])
                                .map((i) => `${i.name} (${i.unit})`)
                                .join(', '),
                              product: item,
                            });
                          }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-orange-50/80 flex items-center justify-between gap-2.5 transition cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-extrabold text-gray-900 truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate mt-0.5">
                              {item.vendor} • ⭐ {item.rating.toFixed(1)}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-xs font-extrabold text-abhiRed tabular-nums">
                              ₹{price}
                            </div>
                            <div className="text-[10px] font-bold text-saffron">देखें →</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Bottom Floating Search Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  saveRecentSearch(searchQuery);
                  if (activePage !== 'home') {
                    navigateToPage('home', { keepSearch: true });
                  }
                  setFloatingSearchOpen(false);
                  window.scrollTo({ top: 260, behavior: 'smooth' });
                }
              }}
              className="p-2 bg-orange-50/70 border-t border-orange-200 flex items-center gap-1.5"
            >
              <div className="flex-1 min-w-0 bg-white border border-orange-200 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
                <input
                  ref={floatingSearchInputRef}
                  type="text"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setActivePoojaTag('ALL');
                    setVisibleCount(10);
                  }}
                  placeholder="पूजा, किट, पंडित खोजें..."
                  className="w-full bg-transparent text-sm font-bold text-gray-900 placeholder:font-medium placeholder:text-gray-400 focus:outline-none truncate"
                />
                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActivePoojaTag('ALL');
                      floatingSearchInputRef.current?.focus();
                    }}
                    title="साफ़ करें"
                    className="text-gray-400 hover:text-abhiRed p-0.5 text-sm shrink-0 cursor-pointer"
                  >
                    <i className="fa-solid fa-circle-xmark" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFloatingSearchOpen(false);
                    startVoiceSearch();
                  }}
                  title="बोलकर खोजें"
                  className="w-8 h-8 rounded-lg bg-red-50 hover:bg-abhiRed text-abhiRed hover:text-white flex items-center justify-center shrink-0 transition cursor-pointer"
                >
                  <i className="fa-solid fa-microphone text-xs" />
                </button>
              </div>
              <button
                type="submit"
                className="shrink-0 h-10 px-3.5 rounded-xl bg-gradient-to-r from-abhiRed to-saffron hover:from-abhiRedDark hover:to-orange-600 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-magnifying-glass text-xs" />
                <span>खोजें</span>
              </button>
            </form>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFloatingSearchOpen(true);
            }}
            aria-label="खोजें (Search)"
            title="खोजें"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#e31b2e] via-[#ef3316] to-[#f25600] hover:from-[#be1225] hover:via-[#d9260d] hover:to-[#dc4b00] text-white border-2 border-white ring-1 ring-black/20 shadow-[0_8px_20px_-4px_rgba(227,27,46,0.55),0_2px_6px_rgba(0,0,0,0.22)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <i className="fa-solid fa-microphone text-base sm:text-lg drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" />
          </button>
        )}
      </div>

      {/* ==================== TOAST ==================== */}
      {toastMsg && (
        <div className="fixed bottom-20 right-4 sm:right-5 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-xs sm:text-sm font-semibold flex items-center gap-2 z-[60] no-print">
          <i className="fa-solid fa-circle-check text-green-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
