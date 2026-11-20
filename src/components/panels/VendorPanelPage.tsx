import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type {
  OrderRecord,
  PayoutRequest,
  PromoCodeRecord,
  UserProfile,
  VendorProfile,
} from '../../types/puja';

interface VendorListingRow {
  id: number;
  title: string;
  category: string;
  poojaTag: string;
  sku?: string | null;
  image: string;
  description: string;
  basePrice: number;
  salePrice?: number | null;
  stockQty: number;
  stockStatus: string;
  deliveryTime: string;
  isGlobal: boolean;
  status: string;
  items?: Array<{ id: number; name: string; unit: string; price: number; defaultQty: number }>;
}

interface VendorDashboardPayload {
  vendorProfile: VendorProfile | null;
  stats: {
    totalOrders: number;
    pendingOrders: number;
    activeListings: number;
    totalListings: number;
    lowStockCount: number;
    pendingQuotes: number;
    grossEarnings: number;
    commissionRate: number;
    commission: number;
    netEarnings: number;
    paidOut: number;
    availableBalance: number;
  };
  listings: VendorListingRow[];
  orders: OrderRecord[];
  customLists: Array<{
    id: number;
    pujaName: string;
    customerName: string;
    phone: string;
    address: string;
    filePath?: string | null;
    fileName?: string | null;
    manualItemsJson?: Array<{ name: string; qty: string }> | null;
    status: string;
    quotedPrice?: number | null;
    orderId?: string | null;
  }>;
  coupons: PromoCodeRecord[];
  reviews: Array<{
    id: number;
    listingId: number;
    listingTitle: string;
    authorName: string;
    rating: number;
    comment: string;
    vendorReply?: string | null;
    createdAt: string;
  }>;
  payouts: PayoutRequest[];
}

interface VendorPanelPageProps {
  user: UserProfile | null;
  vendorProfile: VendorProfile | null;
  onRequireLogin: () => void;
  onCatalogUpdated: () => Promise<void>;
  onAccountUpdated: () => Promise<void>;
  onOpenStorefront: () => void;
  showToast: (msg: string) => void;
}

const STEP_LABELS = ['ऑर्डर प्राप्त', 'सामग्री पैकिंग', 'डिस्पैच', 'डिलीवर्ड'];

export const VendorPanelPage: React.FC<VendorPanelPageProps> = ({
  user,
  vendorProfile,
  onRequireLogin,
  onCatalogUpdated,
  onAccountUpdated,
  onOpenStorefront,
  showToast,
}) => {
  const [tab, setTab] = useState<
    'overview' | 'products' | 'orders' | 'quotes' | 'coupons' | 'reviews' | 'payouts' | 'settings'
  >('overview');
  const [data, setData] = useState<VendorDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);

  // Vendor application state (for customer users)
  const [applyShop, setApplyShop] = useState('');
  const [applyLoc, setApplyLoc] = useState('Sakchi, Jamshedpur');
  const [applyPhone, setApplyPhone] = useState(user?.phone || '');
  const [applyGst, setApplyGst] = useState('');
  const [applyDesc, setApplyDesc] = useState('');

  // WooCommerce Product Create / Edit state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingListingId, setEditingListingId] = useState<number | null>(null);
  const [prodTitle, setProdTitle] = useState('');
  const [prodCat, setProdCat] = useState<'pooja_box' | 'murti' | 'photo' | 'pandit'>('pooja_box');
  const [prodSku, setProdSku] = useState('');
  const [prodPrice, setProdPrice] = useState('451');
  const [prodSalePrice, setProdSalePrice] = useState('');
  const [prodStockQty, setProdStockQty] = useState('40');
  const [prodDelivery, setProdDelivery] = useState('30-45 मि.');
  const [prodGlobal, setProdGlobal] = useState(true);
  const [prodImage, setProdImage] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodChecklist, setProdChecklist] = useState<Array<{ name: string; unit: string; price: string }>>([
    { name: 'शुद्ध रोली व चंदन', unit: '1 पैक', price: '45' },
    { name: 'गाय का देसी घी', unit: '200ml', price: '180' },
    { name: 'भीमसेनी कपूर व धूप', unit: '1 डिब्बी', price: '75' },
  ]);
  const [productSearch, setProductSearch] = useState('');

  // Coupons form
  const [couponCode, setCouponCode] = useState('');
  const [couponType, setCouponType] = useState<'percent' | 'flat'>('percent');
  const [couponVal, setCouponVal] = useState('10');
  const [couponMin, setCouponMin] = useState('399');

  // Quote & Review Reply local maps
  const [quoteMap, setQuoteMap] = useState<Record<number, string>>({});
  const [replyMap, setReplyMap] = useState<Record<number, string>>({});

  // Payout form
  const [payoutAmt, setPayoutAmt] = useState('');
  const [payoutUpi, setPayoutUpi] = useState('');

  // Store Settings form
  const [stShopName, setStShopName] = useState('');
  const [stLocation, setStLocation] = useState('');
  const [stPhone, setStPhone] = useState('');
  const [stDesc, setStDesc] = useState('');
  const [stGst, setStGst] = useState('');
  const [stUpi, setStUpi] = useState('');
  const [stBank, setStBank] = useState('');
  const [stShipFee, setStShipFee] = useState('0');
  const [stFreeAbove, setStFreeAbove] = useState('499');
  const [stCod, setStCod] = useState(true);

  const isVendorAccess =
    user?.role === 'vendor' || user?.role === 'super_admin' || user?.role === 'admin';

  const loadDashboard = useCallback(async () => {
    if (!user || !isVendorAccess) return;
    setLoading(true);
    try {
      const res = await apiFetch<VendorDashboardPayload>('/api/vendor/dashboard');
      setData(res);
      if (res.vendorProfile) {
        const vp = res.vendorProfile;
        setStShopName(vp.shopName || '');
        setStLocation(vp.location || '');
        setStPhone(vp.phone || '');
        setStDesc(vp.description || '');
        setStGst(vp.gstNumber || '');
        setStUpi(vp.upiId || '');
        setStBank(vp.bankAccount || '');
        setStShipFee(String(vp.shippingFee ?? 0));
        setStFreeAbove(String(vp.freeShippingAbove ?? 499));
        setStCod(vp.codEnabled ?? true);
        setPayoutUpi(vp.upiId || vp.bankAccount || '');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'वेंडर डैशबोर्ड लोड नहीं हो सका।');
    } finally {
      setLoading(false);
    }
  }, [user, isVendorAccess, showToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-12 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 text-saffron flex items-center justify-center text-2xl mb-4">
            <i className="fa-solid fa-store" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">वेंडर स्टोर पैनल (WooCommerce Style)</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1.5 mb-5">
            अपने पूजा भंडार के उत्पाद, स्टॉक, ऑर्डर, कूपन, कस्टम पर्ची कोटेशन और पेआउट मैनेज करने के लिए लॉगिन करें।
          </p>
          <button
            type="button"
            onClick={onRequireLogin}
            className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-6 py-2.5 rounded-xl text-sm shadow-sm cursor-pointer"
          >
            वेंडर लॉगिन / रजिस्ट्रेशन करें
          </button>
        </div>
      </div>
    );
  }

  if (!isVendorAccess) {
    const handleApply = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await apiFetch('/api/vendor/apply', {
          method: 'POST',
          body: JSON.stringify({
            shopName: applyShop,
            location: applyLoc,
            phone: applyPhone,
            gstNumber: applyGst,
            description: applyDesc,
          }),
        });
        await onAccountUpdated();
        showToast('✅ वेंडर आवेदन सुपर एडमिन को भेज दिया गया है!');
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'आवेदन विफल रहा।');
      }
    };

    return (
      <div className="max-w-xl mx-auto my-10 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">🏪 अपना पूजा भंडार / वेंडर स्टोर खोलें</h2>
          <p className="text-xs text-gray-600 mb-4">
            {vendorProfile
              ? `आपका आवेदन "${vendorProfile.shopName}" स्थिति: ${vendorProfile.status} (सुपर एडमिन वेरिफिकेशन के बाद पैनल सक्रिय होगा)।`
              : 'PujaJunction.com पर अपनी पूजा सामग्री किट, मूर्तियां व फोटो बेचें।'}
          </p>
          {!vendorProfile && (
            <form onSubmit={handleApply} className="space-y-3 text-xs">
              <input
                type="text"
                required
                value={applyShop}
                onChange={(e) => setApplyShop(e.target.value)}
                placeholder="दुकान / पूजा भंडार का नाम *"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={applyLoc}
                  onChange={(e) => setApplyLoc(e.target.value)}
                  placeholder="शहर / पता *"
                  className="border border-gray-300 rounded-xl px-3 py-2.5"
                />
                <input
                  type="tel"
                  required
                  value={applyPhone}
                  onChange={(e) => setApplyPhone(e.target.value)}
                  placeholder="मोबाइल नंबर *"
                  className="border border-gray-300 rounded-xl px-3 py-2.5"
                />
              </div>
              <input
                type="text"
                value={applyGst}
                onChange={(e) => setApplyGst(e.target.value)}
                placeholder="GST नंबर (Optional)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5"
              />
              <textarea
                rows={3}
                value={applyDesc}
                onChange={(e) => setApplyDesc(e.target.value)}
                placeholder="अपनी दुकान और पूजा सामग्री का संक्षिप्त विवरण..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5"
              />
              <button
                type="submit"
                className="w-full bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold py-2.5 rounded-xl cursor-pointer"
              >
                वेंडर आवेदन सबमिट करें
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingListingId(null);
    setProdTitle('');
    setProdCat('pooja_box');
    setProdSku('');
    setProdPrice('451');
    setProdSalePrice('');
    setProdStockQty('40');
    setProdDelivery('30-45 मि.');
    setProdGlobal(true);
    setProdImage('');
    setProdDesc('');
    setProdChecklist([
      { name: 'शुद्ध रोली व चंदन', unit: '1 पैक', price: '45' },
      { name: 'गाय का देसी घी', unit: '200ml', price: '180' },
      { name: 'भीमसेनी कपूर व धूप', unit: '1 डिब्बी', price: '75' },
    ]);
    setProductModalOpen(true);
  };

  const openEditModal = (l: VendorListingRow) => {
    setEditingListingId(l.id);
    setProdTitle(l.title);
    setProdCat((['pooja_box', 'murti', 'photo', 'pandit'].includes(l.category) ? l.category : 'pooja_box') as 'pooja_box');
    setProdSku(l.sku || '');
    setProdPrice(String(l.basePrice));
    setProdSalePrice(l.salePrice ? String(l.salePrice) : '');
    setProdStockQty(String(l.stockQty ?? 40));
    setProdDelivery(l.deliveryTime || '30-45 मि.');
    setProdGlobal(Boolean(l.isGlobal));
    setProdImage(l.image || '');
    setProdDesc(l.description || '');
    setProdChecklist(
      l.items && l.items.length > 0
        ? l.items.map((it) => ({ name: it.name, unit: it.unit, price: String(it.price) }))
        : [{ name: 'शुद्ध पूजा सामग्री', unit: '1 सेट', price: String(l.basePrice) }]
    );
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanItems = prodChecklist
        .filter((i) => i.name.trim())
        .map((i) => ({ name: i.name.trim(), unit: i.unit.trim() || '1 पैक', price: Number(i.price) || 50, qty: 1 }));

      if (editingListingId) {
        await apiFetch(`/api/vendor/listings/${editingListingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: prodTitle,
            sku: prodSku,
            basePrice: Number(prodPrice),
            salePrice: prodSalePrice ? Number(prodSalePrice) : null,
            stockQty: Number(prodStockQty),
            deliveryTime: prodDelivery,
            isGlobal: prodGlobal,
            image: prodImage || undefined,
            description: prodDesc,
            items: prodCat === 'pooja_box' ? cleanItems : undefined,
          }),
        });
        showToast('✅ उत्पाद सफलतापूर्वक अपडेट हो गया!');
      } else {
        await apiFetch('/api/vendor/listings', {
          method: 'POST',
          body: JSON.stringify({
            category: prodCat,
            shopName: data?.vendorProfile?.shopName || stShopName || `${user.name} पूजा भंडार`,
            location: data?.vendorProfile?.location || stLocation || 'Sakchi, Jamshedpur',
            title: prodTitle,
            sku: prodSku,
            price: Number(prodPrice),
            salePrice: prodSalePrice ? Number(prodSalePrice) : null,
            stockQty: Number(prodStockQty),
            deliveryTime: prodDelivery,
            isGlobal: prodGlobal,
            imageUrl: prodImage,
            description: prodDesc,
            items: prodCat === 'pooja_box' ? cleanItems : undefined,
          }),
        });
        showToast('🎉 नया उत्पाद स्टोर पर लाइव हो गया!');
      }
      setProductModalOpen(false);
      await Promise.all([loadDashboard(), onCatalogUpdated()]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'उत्पाद सेव करने में समस्या आई।');
    }
  };

  const handleToggleProductStatus = async (l: VendorListingRow) => {
    const nextStatus = l.status === 'active' ? 'paused' : 'active';
    await apiFetch(`/api/vendor/listings/${l.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    showToast(nextStatus === 'active' ? 'उत्पाद सक्रिय किया गया' : 'उत्पाद रोका गया (Paused)');
    await Promise.all([loadDashboard(), onCatalogUpdated()]);
  };

  const handleDeleteProduct = async (id: number) => {
    await apiFetch(`/api/vendor/listings/${id}`, { method: 'DELETE' });
    showToast('उत्पाद हटाया गया।');
    await Promise.all([loadDashboard(), onCatalogUpdated()]);
  };

  const handleOrderStep = async (orderId: string, step: number, paymentStatus?: string) => {
    await apiFetch(`/api/vendor/orders/${orderId}/step`, {
      method: 'PATCH',
      body: JSON.stringify({ step, paymentStatus }),
    });
    showToast(`ऑर्डर #${orderId} अपडेट हो गया।`);
    await loadDashboard();
  };

  const handleSendQuote = async (listId: number) => {
    const price = Number(quoteMap[listId] || 499);
    await apiFetch(`/api/vendor/custom-lists/${listId}/quote`, {
      method: 'PATCH',
      body: JSON.stringify({ quotedPrice: price }),
    });
    showToast(`₹${price} का कोटेशन ग्राहक को भेज दिया गया!`);
    await loadDashboard();
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/vendor/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: couponCode,
          type: couponType,
          value: Number(couponVal),
          minOrder: Number(couponMin),
        }),
      });
      setCouponCode('');
      showToast('🎉 नया स्टोर कूपन बन गया!');
      await loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'कूपन बनाने में त्रुटि।');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/vendor/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          shopName: stShopName,
          location: stLocation,
          phone: stPhone,
          description: stDesc,
          gstNumber: stGst,
          upiId: stUpi,
          bankAccount: stBank,
          shippingFee: Number(stShipFee) || 0,
          freeShippingAbove: Number(stFreeAbove) || 499,
          codEnabled: stCod,
        }),
      });
      showToast('✅ WooCommerce स्टोर सेटिंग्स सेव हो गईं!');
      await Promise.all([loadDashboard(), onCatalogUpdated()]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'सेटिंग्स सेव विफल।');
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/vendor/payouts', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(payoutAmt), upiOrBank: payoutUpi }),
      });
      setPayoutAmt('');
      showToast('✅ पेआउट अनुरोध सुपर एडमिन को भेज दिया गया है।');
      await loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'पेआउट अनुरोध विफल।');
    }
  };

  const filteredProducts = (data?.listings || []).filter(
    (l) =>
      !productSearch.trim() ||
      l.title.toLowerCase().includes(productSearch.toLowerCase()) ||
      (l.sku || '').toLowerCase().includes(productSearch.toLowerCase())
  );

  const navItems: Array<{ id: typeof tab; label: string; icon: string; badge?: number }> = [
    { id: 'overview', label: 'स्टोर ओवरव्यू', icon: 'fa-chart-line' },
    { id: 'products', label: 'उत्पाद व स्टॉक', icon: 'fa-boxes-stacked', badge: data?.stats.totalListings },
    { id: 'orders', label: 'ऑर्डर मैनेजमेंट', icon: 'fa-truck-fast', badge: data?.stats.pendingOrders },
    { id: 'quotes', label: 'कस्टम पर्ची', icon: 'fa-file-invoice', badge: data?.stats.pendingQuotes },
    { id: 'coupons', label: 'स्टोर कूपन', icon: 'fa-ticket', badge: data?.coupons.length },
    { id: 'reviews', label: 'ग्राहक समीक्षाएं', icon: 'fa-star', badge: data?.reviews.length },
    { id: 'payouts', label: 'कमाई व पेआउट', icon: 'fa-indian-rupee-sign' },
    { id: 'settings', label: 'स्टोर सेटिंग्स', icon: 'fa-sliders' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Store Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-abhiRed to-saffron text-white flex items-center justify-center text-xl shadow-xs">
            <i className="fa-solid fa-store" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900">
                {data?.vendorProfile?.shopName || 'वेंडर स्टोर पैनल'}
              </h2>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                  data?.vendorProfile?.status === 'approved'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {data?.vendorProfile?.status === 'approved' ? '✓ सत्यापित वेंडर' : '⏳ वेरिफिकेशन प्रतीक्षारत'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              📍 {data?.vendorProfile?.location || 'Jamshedpur'} • कमीशन दर: {data?.stats.commissionRate ?? 8}% • WooCommerce Store Manager
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-abhiRed hover:bg-abhiRedDark text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer"
          >
            <i className="fa-solid fa-plus mr-1.5" />
            नया उत्पाद जोड़ें
          </button>
          <button
            type="button"
            onClick={onOpenStorefront}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-3.5 py-2.5 rounded-xl cursor-pointer"
          >
            ← स्टोरफ्रंट देखें
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-2.5 shadow-2xs">
          <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`shrink-0 lg:w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  tab === item.id
                    ? 'bg-abhiRed text-white shadow-xs'
                    : 'text-gray-700 hover:bg-orange-50 hover:text-abhiRed'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <i className={`fa-solid ${item.icon} w-4 text-center`} />
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      tab === item.id ? 'bg-white text-abhiRed' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <div className="lg:col-span-9 space-y-5">
          {loading && !data ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-500 font-bold">
              स्टोर डेटा लोड हो रहा है...
            </div>
          ) : (
            data && (
              <>
                {tab === 'overview' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">कुल बिक्री (Gross)</div>
                        <div className="text-2xl font-extrabold text-gray-900 mt-1">₹{data.stats.grossEarnings}</div>
                        <div className="text-[11px] text-green-700 font-bold mt-0.5">शुद्ध कमाई: ₹{data.stats.netEarnings}</div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">कुल ऑर्डर</div>
                        <div className="text-2xl font-extrabold text-abhiRed mt-1">{data.stats.totalOrders}</div>
                        <div className="text-[11px] text-saffron font-bold mt-0.5">{data.stats.pendingOrders} प्रोसेसिंग में</div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">सक्रिय उत्पाद</div>
                        <div className="text-2xl font-extrabold text-gray-900 mt-1">
                          {data.stats.activeListings} / {data.stats.totalListings}
                        </div>
                        <div className="text-[11px] text-amber-700 font-bold mt-0.5">
                          {data.stats.lowStockCount} लो-स्टॉक अलर्ट
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">उपलब्ध बैलेंस</div>
                        <div className="text-2xl font-extrabold text-green-700 mt-1">₹{data.stats.availableBalance}</div>
                        <div className="text-[11px] text-gray-500 font-semibold mt-0.5">पेआउट हेतु तैयार</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <h3 className="text-sm font-extrabold text-gray-900 mb-3">ताज़ा ऑर्डर</h3>
                        {data.orders.length === 0 ? (
                          <p className="text-xs text-gray-500 py-4 text-center">अभी कोई ऑर्डर नहीं।</p>
                        ) : (
                          <div className="space-y-2 text-xs">
                            {data.orders.slice(0, 4).map((o) => (
                              <div key={o.id} className="border border-gray-100 bg-gray-50 rounded-xl p-2.5 flex justify-between">
                                <div>
                                  <div className="font-extrabold text-gray-900">#{o.id} • {o.customerName}</div>
                                  <div className="text-[11px] text-gray-500">{STEP_LABELS[o.statusStep]}</div>
                                </div>
                                <div className="font-extrabold text-abhiRed">₹{o.total}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <h3 className="text-sm font-extrabold text-gray-900 mb-3">कस्टम पर्ची अनुरोध</h3>
                        {data.customLists.length === 0 ? (
                          <p className="text-xs text-gray-500 py-4 text-center">कोई लंबित पर्ची नहीं।</p>
                        ) : (
                          <div className="space-y-2 text-xs">
                            {data.customLists.slice(0, 4).map((c) => (
                              <div key={c.id} className="border border-orange-100 bg-cream rounded-xl p-2.5 flex justify-between">
                                <div>
                                  <div className="font-extrabold text-gray-900">{c.pujaName}</div>
                                  <div className="text-[11px] text-gray-500">{c.customerName} • {c.phone}</div>
                                </div>
                                <span className="font-extrabold text-saffron">₹{c.quotedPrice || 299}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'products' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-extrabold text-gray-900">
                        उत्पाद व इन्वेंटरी (WooCommerce Catalog)
                      </h3>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="नाम या SKU खोजें..."
                          className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="bg-abhiRed hover:bg-abhiRedDark text-white text-xs font-extrabold px-3.5 py-2 rounded-xl cursor-pointer"
                        >
                          + नया उत्पाद
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500 font-extrabold">
                            <th className="py-2.5 pr-3">उत्पाद</th>
                            <th className="py-2.5 px-2">SKU</th>
                            <th className="py-2.5 px-2">मूल्य</th>
                            <th className="py-2.5 px-2">स्टॉक</th>
                            <th className="py-2.5 px-2">स्थिति</th>
                            <th className="py-2.5 pl-2 text-right">कार्रवाई</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredProducts.map((l) => (
                            <tr key={l.id} className="hover:bg-gray-50/70">
                              <td className="py-2.5 pr-3">
                                <div className="flex items-center gap-2.5">
                                  <img
                                    src={l.image}
                                    alt={l.title}
                                    className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-gray-900 truncate max-w-[220px]">{l.title}</div>
                                    <div className="text-[10px] text-gray-500">{l.category} • {l.deliveryTime}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-2 font-mono text-[11px] text-gray-600">{l.sku || `PJ-${l.id}`}</td>
                              <td className="py-2.5 px-2">
                                <div className="font-extrabold text-gray-900">₹{l.basePrice}</div>
                                {l.salePrice && (
                                  <div className="text-[10px] text-green-700 font-bold">सेल: ₹{l.salePrice}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-2">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                    l.stockQty === 0 || l.stockStatus === 'outofstock'
                                      ? 'bg-red-50 text-red-700'
                                      : l.stockQty <= 5
                                      ? 'bg-amber-50 text-amber-800'
                                      : 'bg-green-50 text-green-700'
                                  }`}
                                >
                                  {l.stockQty ?? 50} पीस
                                </span>
                              </td>
                              <td className="py-2.5 px-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    l.status === 'active'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-200 text-gray-700'
                                  }`}
                                >
                                  {l.status === 'active' ? 'सक्रिय' : 'रोका गया'}
                                </span>
                              </td>
                              <td className="py-2.5 pl-2 text-right whitespace-nowrap space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(l)}
                                  className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold cursor-pointer"
                                >
                                  एडिट
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleToggleProductStatus(l)}
                                  className="px-2 py-1 rounded-lg bg-orange-50 text-saffron hover:bg-orange-100 font-bold cursor-pointer"
                                >
                                  {l.status === 'active' ? 'रोकें' : 'चालू'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteProduct(l.id)}
                                  className="px-2 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-bold cursor-pointer"
                                >
                                  हटाएं
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {tab === 'orders' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <h3 className="text-base font-extrabold text-gray-900">स्टोर ऑर्डर फुलफिलमेंट</h3>
                    {data.orders.length === 0 ? (
                      <p className="text-xs text-gray-500 py-8 text-center">अभी कोई ऑर्डर नहीं मिला।</p>
                    ) : (
                      data.orders.map((ord) => (
                        <div key={ord.id} className="border border-gray-200 rounded-2xl p-4 text-xs space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-sm text-gray-900">
                                #{ord.id} • {ord.customerName} ({ord.phone})
                              </div>
                              <div className="text-gray-500">{ord.addressLine}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-extrabold text-abhiRed">₹{ord.total}</div>
                              <div className="text-[11px] font-bold text-gray-600">
                                {ord.paymentMethod} • {ord.paymentStatus}
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-xl p-2.5 space-y-1">
                            {ord.items?.map((i) => (
                              <div key={i.id} className="flex justify-between">
                                <span className="font-bold text-gray-800">{i.titleSnapshot}</span>
                                <span className="font-extrabold">₹{i.price}</span>
                              </div>
                            ))}
                          </div>

                          {!ord.cancelledAt && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="flex flex-wrap gap-1.5">
                                {STEP_LABELS.map((lbl, idx) => (
                                  <button
                                    key={lbl}
                                    type="button"
                                    onClick={() => void handleOrderStep(ord.id, idx)}
                                    className={`px-2.5 py-1 rounded-lg font-extrabold border cursor-pointer ${
                                      ord.statusStep === idx
                                        ? 'bg-abhiRed text-white border-abhiRed'
                                        : idx < ord.statusStep
                                        ? 'bg-green-50 text-green-800 border-green-300'
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    {idx + 1}. {lbl}
                                  </button>
                                ))}
                              </div>
                              {ord.paymentStatus !== 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => void handleOrderStep(ord.id, ord.statusStep, 'paid')}
                                  className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white font-extrabold cursor-pointer"
                                >
                                  ✓ पेमेंट प्राप्त मार्क करें
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'quotes' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <h3 className="text-base font-extrabold text-gray-900">कस्टम पूजा पर्ची कोटेशन</h3>
                    {data.customLists.length === 0 ? (
                      <p className="text-xs text-gray-500 py-8 text-center">कोई कस्टम पर्ची नहीं मिली।</p>
                    ) : (
                      data.customLists.map((cl) => (
                        <div key={cl.id} className="border border-orange-200 bg-cream rounded-2xl p-4 text-xs space-y-2">
                          <div className="flex flex-wrap justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-sm text-gray-900">{cl.pujaName}</div>
                              <div className="text-gray-600">
                                {cl.customerName} • {cl.phone} • {cl.address}
                              </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-white border border-orange-200 text-saffron font-extrabold self-start">
                              {cl.status} (₹{cl.quotedPrice || 299})
                            </span>
                          </div>
                          {cl.filePath && (
                            <a
                              href={cl.filePath}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block text-abhiRed font-extrabold hover:underline"
                            >
                              📎 अपलोड पर्ची खोलें ({cl.fileName})
                            </a>
                          )}
                          {cl.manualItemsJson && cl.manualItemsJson.length > 0 && (
                            <div className="bg-white rounded-xl p-2 text-gray-700">
                              सामग्री: {cl.manualItemsJson.map((m) => `${m.name} (${m.qty})`).join(', ')}
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="number"
                              value={quoteMap[cl.id] ?? String(cl.quotedPrice || 499)}
                              onChange={(e) => setQuoteMap((p) => ({ ...p, [cl.id]: e.target.value }))}
                              className="w-32 bg-white border border-gray-300 rounded-xl px-3 py-1.5 font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSendQuote(cl.id)}
                              className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-4 py-1.5 rounded-xl cursor-pointer"
                            >
                              ₹ कोटेशन भेजें
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'coupons' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                    <h3 className="text-base font-extrabold text-gray-900">स्टोर डिस्काउंट कूपन</h3>
                    <form onSubmit={handleCreateCoupon} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      <input
                        type="text"
                        required
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="कोड (जैसे SHIV15)"
                        className="border border-gray-300 rounded-xl px-3 py-2 font-mono uppercase"
                      />
                      <select
                        value={couponType}
                        onChange={(e) => setCouponType(e.target.value as 'percent' | 'flat')}
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      >
                        <option value="percent">% छूट</option>
                        <option value="flat">₹ फ्लैट छूट</option>
                      </select>
                      <input
                        type="number"
                        required
                        value={couponVal}
                        onChange={(e) => setCouponVal(e.target.value)}
                        placeholder="मान"
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                      <input
                        type="number"
                        value={couponMin}
                        onChange={(e) => setCouponMin(e.target.value)}
                        placeholder="न्यूनतम ऑर्डर"
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                      <button
                        type="submit"
                        className="bg-saffron hover:bg-orange-600 text-white font-extrabold rounded-xl px-3 py-2 cursor-pointer"
                      >
                        + कूपन बनाएं
                      </button>
                    </form>

                    <div className="space-y-2 text-xs">
                      {data.coupons.map((c) => (
                        <div
                          key={c.id}
                          className="border border-gray-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono font-extrabold text-sm text-abhiRed">{c.code}</span>
                            <span className="ml-2 font-bold text-gray-700">
                              {c.type === 'percent' ? `${c.value}% छूट` : `₹${c.value} छूट`} (न्यूनतम ₹{c.minOrder})
                            </span>
                            <span className="ml-2 text-gray-500">• उपयोग: {c.usedCount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/vendor/coupons/${c.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ isActive: !c.isActive }),
                                });
                                await loadDashboard();
                              }}
                              className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer ${
                                c.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {c.isActive ? 'सक्रिय' : 'बंद'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/vendor/coupons/${c.id}`, { method: 'DELETE' });
                                await loadDashboard();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold cursor-pointer"
                            >
                              हटाएं
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'reviews' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <h3 className="text-base font-extrabold text-gray-900">ग्राहक समीक्षाएं एवं उत्तर</h3>
                    {data.reviews.length === 0 ? (
                      <p className="text-xs text-gray-500 py-8 text-center">अभी कोई समीक्षा नहीं मिली।</p>
                    ) : (
                      data.reviews.map((r) => (
                        <div key={r.id} className="border border-gray-200 rounded-2xl p-4 text-xs space-y-2">
                          <div className="flex justify-between">
                            <div className="font-extrabold text-gray-900">
                              {r.authorName} — <span className="text-saffron">{r.listingTitle}</span>
                            </div>
                            <span className="font-extrabold text-amber-600">{'★'.repeat(r.rating)}</span>
                          </div>
                          <p className="text-gray-700">{r.comment}</p>
                          {r.vendorReply ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 text-green-900 font-semibold">
                              🏪 आपका उत्तर: {r.vendorReply}
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={replyMap[r.id] || ''}
                                onChange={(e) => setReplyMap((p) => ({ ...p, [r.id]: e.target.value }))}
                                placeholder="ग्राहक को धन्यवाद या उत्तर लिखें..."
                                className="flex-1 border border-gray-300 rounded-xl px-3 py-1.5"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/vendor/reviews/${r.id}/reply`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ reply: replyMap[r.id] }),
                                  });
                                  showToast('उत्तर सेव हो गया।');
                                  await loadDashboard();
                                }}
                                className="bg-abhiRed text-white font-extrabold px-3.5 py-1.5 rounded-xl cursor-pointer"
                              >
                                भेजें
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'payouts' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                        <div className="font-bold text-gray-600">शुद्ध कमाई (Net)</div>
                        <div className="text-xl font-extrabold text-gray-900 mt-1">₹{data.stats.netEarnings}</div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                        <div className="font-bold text-gray-600">प्राप्त पेआउट</div>
                        <div className="text-xl font-extrabold text-green-700 mt-1">₹{data.stats.paidOut}</div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                        <div className="font-bold text-gray-600">निकासी हेतु उपलब्ध</div>
                        <div className="text-xl font-extrabold text-abhiRed mt-1">₹{data.stats.availableBalance}</div>
                      </div>
                    </div>

                    <form onSubmit={handleRequestPayout} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <input
                        type="number"
                        min={100}
                        required
                        value={payoutAmt}
                        onChange={(e) => setPayoutAmt(e.target.value)}
                        placeholder="राशि (न्यूनतम ₹100)"
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                      <input
                        type="text"
                        required
                        value={payoutUpi}
                        onChange={(e) => setPayoutUpi(e.target.value)}
                        placeholder="UPI ID या बैंक खाता विवरण"
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                      <button
                        type="submit"
                        className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold rounded-xl px-4 py-2 cursor-pointer"
                      >
                        पेआउट अनुरोध भेजें
                      </button>
                    </form>

                    <div className="space-y-2 text-xs">
                      {data.payouts.map((p) => (
                        <div
                          key={p.id}
                          className="border border-gray-200 rounded-xl p-3 flex flex-wrap justify-between items-center gap-2"
                        >
                          <div>
                            <div className="font-extrabold text-gray-900">₹{p.amount} → {p.upiOrBank}</div>
                            <div className="text-gray-500">
                              {new Date(p.createdAt).toLocaleDateString('hi-IN')} {p.adminNote ? `• ${p.adminNote}` : ''}
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full font-extrabold bg-orange-50 text-saffron uppercase text-[10px]">
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'settings' && (
                  <form
                    onSubmit={handleSaveSettings}
                    className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 text-xs"
                  >
                    <h3 className="text-base font-extrabold text-gray-900">WooCommerce स्टोर एवं शिपिंग सेटिंग्स</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">दुकान / भंडार नाम *</label>
                        <input
                          type="text"
                          required
                          value={stShopName}
                          onChange={(e) => setStShopName(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">लोकेशन / शहर *</label>
                        <input
                          type="text"
                          required
                          value={stLocation}
                          onChange={(e) => setStLocation(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">मोबाइल / WhatsApp</label>
                        <input
                          type="tel"
                          value={stPhone}
                          onChange={(e) => setStPhone(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">GST नंबर</label>
                        <input
                          type="text"
                          value={stGst}
                          onChange={(e) => setStGst(e.target.value)}
                          placeholder="20ABCDE1234F1Z5"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 font-mono uppercase"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">UPI ID (पेआउट हेतु)</label>
                        <input
                          type="text"
                          value={stUpi}
                          onChange={(e) => setStUpi(e.target.value)}
                          placeholder="store@upi"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">बैंक खाता / IFSC</label>
                        <input
                          type="text"
                          value={stBank}
                          onChange={(e) => setStBank(e.target.value)}
                          placeholder="A/C No & IFSC"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">डिलीवरी शुल्क (₹)</label>
                        <input
                          type="number"
                          value={stShipFee}
                          onChange={(e) => setStShipFee(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">फ्री शिपिंग सीमा (₹ से ऊपर)</label>
                        <input
                          type="number"
                          value={stFreeAbove}
                          onChange={(e) => setStFreeAbove(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">स्टोर विवरण</label>
                      <textarea
                        rows={3}
                        value={stDesc}
                        onChange={(e) => setStDesc(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stCod}
                        onChange={(e) => setStCod(e.target.checked)}
                        className="accent-abhiRed w-4 h-4"
                      />
                      <span>Cash on Delivery (COD) स्वीकार करें</span>
                    </label>
                    <button
                      type="submit"
                      className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-6 py-2.5 rounded-xl cursor-pointer"
                    >
                      सेटिंग्स सेव करें
                    </button>
                  </form>
                )}
              </>
            )
          )}
        </div>
      </div>

      {/* Create / Edit WooCommerce Product Modal */}
      {productModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProductModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-gray-900">
                {editingListingId ? 'उत्पाद संपादित करें' : 'नया पूजा उत्पाद / किट जोड़ें'}
              </h3>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">उत्पाद का नाम / शीर्षक *</label>
                  <input
                    type="text"
                    required
                    value={prodTitle}
                    onChange={(e) => setProdTitle(e.target.value)}
                    placeholder="जैसे: संपूर्ण सत्यनारायण पूजा बॉक्स (21 सामग्री)"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">श्रेणी *</label>
                  <select
                    value={prodCat}
                    disabled={Boolean(editingListingId)}
                    onChange={(e) => setProdCat(e.target.value as 'pooja_box')}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="pooja_box">पूजा सामग्री किट (Pooja Box)</option>
                    <option value="murti">दिव्य मूर्ति / शिवलिंग</option>
                    <option value="photo">भगवान फोटो फ्रेम</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">SKU कोड</label>
                  <input
                    type="text"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    placeholder="PJ-KIT-101"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">नियमित मूल्य (₹) *</label>
                  <input
                    type="number"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">सेल / ऑफर मूल्य (₹)</label>
                  <input
                    type="number"
                    value={prodSalePrice}
                    onChange={(e) => setProdSalePrice(e.target.value)}
                    placeholder="वैकल्पिक"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">स्टॉक मात्रा (Qty) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={prodStockQty}
                    onChange={(e) => setProdStockQty(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">डिलीवरी समय</label>
                  <input
                    type="text"
                    value={prodDelivery}
                    onChange={(e) => setProdDelivery(e.target.value)}
                    placeholder="30-45 मि."
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">उत्पाद फोटो URL</label>
                  <input
                    type="url"
                    value={prodImage}
                    onChange={(e) => setProdImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">विवरण</label>
                  <textarea
                    rows={2}
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {prodCat === 'pooja_box' && (
                <div className="border border-orange-200 bg-cream rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-900">किट सामग्री चेकलिस्ट (ग्राहक कस्टमाइज़ कर सकते हैं)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setProdChecklist((prev) => [...prev, { name: '', unit: '1 पैक', price: '50' }])
                      }
                      className="text-abhiRed font-extrabold cursor-pointer"
                    >
                      + सामग्री जोड़ें
                    </button>
                  </div>
                  {prodChecklist.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) =>
                          setProdChecklist((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                          )
                        }
                        placeholder="सामग्री नाम"
                        className="col-span-6 bg-white border border-gray-300 rounded-lg px-2 py-1.5"
                      />
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) =>
                          setProdChecklist((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, unit: e.target.value } : r))
                          )
                        }
                        placeholder="मात्रा"
                        className="col-span-3 bg-white border border-gray-300 rounded-lg px-2 py-1.5"
                      />
                      <input
                        type="number"
                        value={row.price}
                        onChange={(e) =>
                          setProdChecklist((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, price: e.target.value } : r))
                          )
                        }
                        placeholder="₹"
                        className="col-span-2 bg-white border border-gray-300 rounded-lg px-2 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => setProdChecklist((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 text-red-600 font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prodGlobal}
                  onChange={(e) => setProdGlobal(e.target.checked)}
                  className="accent-abhiRed w-4 h-4"
                />
                <span>संपूर्ण भारत / ग्लोबल डिलीवरी उपलब्ध</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold cursor-pointer"
                >
                  {editingListingId ? 'बदलाव सेव करें' : 'उत्पाद लाइव करें'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
