import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type {
  DonationRecord,
  Listing,
  OrderRecord,
  SiteSettings,
  UserProfile,
  VendorProfile,
} from '../types/puja';

const STEP_LABELS = ['ऑर्डर प्राप्त', 'सामग्री पैकिंग', 'डिस्पैच', 'पूर्ण'];

// ==================== VENDOR DASHBOARD MODAL ====================

interface VendorDashboardModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  vendorProfile: VendorProfile | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onCatalogUpdated: () => Promise<void>;
  onAccountUpdated: () => Promise<void>;
  showToast: (msg: string) => void;
}

interface VendorDashboardData {
  vendorProfile: VendorProfile | null;
  stats: {
    totalOrders: number;
    activeListings: number;
    grossEarnings: number;
    commission: number;
    netEarnings: number;
  };
  listings: Listing[];
  orders: OrderRecord[];
  customLists: Array<{
    id: number;
    pujaName: string;
    customerName: string;
    phone: string;
    address: string;
    filePath: string | null;
    status: string;
    quotedPrice: number | null;
  }>;
}

export const VendorDashboardModal: React.FC<VendorDashboardModalProps> = ({
  isOpen,
  user,
  vendorProfile,
  onClose,
  onRequireAuth,
  onCatalogUpdated,
  onAccountUpdated,
  showToast,
}) => {
  const [tab, setTab] = useState<'orders' | 'listings' | 'add' | 'custom'>('orders');
  const [dash, setDash] = useState<VendorDashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  // Vendor application fields
  const [appShop, setAppShop] = useState('');
  const [appLoc, setAppLoc] = useState('Sakchi, Jamshedpur');
  const [appPhone, setAppPhone] = useState(user?.phone || '');
  const [appDesc, setAppDesc] = useState('');

  // Add listing fields
  const [vCategory, setVCategory] = useState<'pooja_box' | 'pandit' | 'murti' | 'photo'>('pooja_box');
  const [vShopName, setVShopName] = useState(vendorProfile?.shopName || '');
  const [vLocation, setVLocation] = useState(vendorProfile?.location || 'Sakchi, Jamshedpur');
  const [vPrice, setVPrice] = useState(350);
  const [vTitle, setVTitle] = useState('');
  const [vBoxItemsText, setVBoxItemsText] = useState(
    'रोली व चंदन, शुद्ध घी, कपूर व धूपबत्ती, कलावा'
  );
  const [vImageUrl, setVImageUrl] = useState(
    'https://placehold.co/320x240/fff3e0/dc3545?text=New+Pooja+Kit'
  );
  const [vGlobal, setVGlobal] = useState(true);
  const [quoteDrafts, setQuoteDrafts] = useState<Record<number, string>>({});

  const isApprovedVendor = user && (user.role === 'vendor' || user.role === 'admin');

  const fetchVendorDash = async () => {
    if (!isApprovedVendor) return;
    setLoading(true);
    try {
      const data = await apiFetch<VendorDashboardData>('/api/vendor/dashboard');
      setDash(data);
      if (data.vendorProfile?.shopName && !vShopName) {
        setVShopName(data.vendorProfile.shopName);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'वेंडर डेटा लोड नहीं हो सका।');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isApprovedVendor) {
      void fetchVendorDash();
    }
  }, [isOpen, isApprovedVendor]);

  if (!isOpen) return null;

  const handleApplyVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/vendor/apply', {
        method: 'POST',
        body: JSON.stringify({
          shopName: appShop,
          location: appLoc,
          phone: appPhone,
          description: appDesc,
        }),
      });
      await onAccountUpdated();
      showToast('✅ आपका वेंडर आवेदन सफलतापूर्वक सबमिट हो गया!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'आवेदन विफल रहा।');
    }
  };

  const handleAdvanceOrder = async (orderId: string) => {
    try {
      await apiFetch(`/api/vendor/orders/${orderId}/step`, { method: 'PATCH', body: JSON.stringify({}) });
      showToast(`ऑर्डर #${orderId} का स्टेटस अपडेट किया गया!`);
      await fetchVendorDash();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'स्टेटस अपडेट विफल।');
    }
  };

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/vendor/listings', {
        method: 'POST',
        body: JSON.stringify({
          category: vCategory,
          shopName: vShopName,
          location: vLocation,
          price: vPrice,
          title: vTitle,
          imageUrl: vImageUrl,
          isGlobal: vGlobal,
          boxItemsText: vBoxItemsText,
        }),
      });
      setVTitle('');
      showToast(`"${vTitle}" सफलतापूर्वक लाइव हो गया है!`);
      await onCatalogUpdated();
      await fetchVendorDash();
      setTab('listings');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'लिस्टिंग जोड़ने में त्रुटि।');
    }
  };

  const handleToggleListingStatus = async (listing: Listing) => {
    try {
      const nextStatus = listing.status === 'active' ? 'paused' : 'active';
      await apiFetch(`/api/vendor/listings/${listing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await onCatalogUpdated();
      await fetchVendorDash();
      showToast('लिस्टिंग स्टेटस बदला गया।');
    } catch {
      showToast('अपडेट विफल।');
    }
  };

  const handleSendQuote = async (listId: number) => {
    const val = parseInt(quoteDrafts[listId] || '499', 10);
    try {
      await apiFetch(`/api/vendor/custom-lists/${listId}/quote`, {
        method: 'PATCH',
        body: JSON.stringify({ quotedPrice: val }),
      });
      showToast(`₹${val} का कोटेशन ग्राहक को भेज दिया गया!`);
      await fetchVendorDash();
    } catch {
      showToast('कोटेशन भेजने में त्रुटि।');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl relative my-8 max-h-[92vh] overflow-y-auto box-scroll">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="border-b border-gray-200 pb-3 mb-4 pr-8">
          <h3 className="text-lg sm:text-xl font-extrabold text-gray-900">
            🏪 वेंडर एवं पंडित डैशबोर्ड (Vendor Panel)
          </h3>
          <p className="text-xs text-gray-500">
            ऑर्डर स्टेटस अपडेट करें, नई पूजा किट या पंडित सेवा लाइव करें और कमाई देखें
          </p>
        </div>

        {!user ? (
          <div className="text-center py-10 bg-cream border border-orange-200 rounded-2xl">
            <p className="text-sm font-extrabold text-gray-800 mb-3">
              वेंडर पैनल खोलने या विक्रेता बनने के लिए पहले लॉगिन करें
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequireAuth();
              }}
              className="bg-abhiRed text-white px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer"
            >
              लॉगिन / साइन अप करें
            </button>
          </div>
        ) : !isApprovedVendor ? (
          <div className="space-y-4 text-xs sm:text-sm">
            {vendorProfile ? (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 text-center">
                <div className="text-3xl mb-2">⏳</div>
                <h4 className="font-extrabold text-amber-950 text-base">
                  आपका वेंडर आवेदन ({vendorProfile.shopName}) समीक्षाधीन है
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  स्थिति: <strong className="uppercase">{vendorProfile.status}</strong> • एडमिन अनुमोदन के बाद आपका वेंडर डैशबोर्ड सक्रिय हो जाएगा।
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleApplyVendor}
                className="bg-cream border border-orange-200 rounded-2xl p-4 sm:p-5 space-y-3"
              >
                <h4 className="font-extrabold text-gray-900 text-base">
                  PujaJunction.com पर विक्रेता / पंडित जी के रूप में जुड़ें
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={appShop}
                    onChange={(e) => setAppShop(e.target.value)}
                    placeholder="दुकान / संस्था / आचार्य का नाम *"
                    className="border border-gray-300 rounded-xl px-3 py-2 bg-white"
                  />
                  <input
                    type="tel"
                    required
                    value={appPhone}
                    onChange={(e) => setAppPhone(e.target.value)}
                    placeholder="मोबाइल नंबर *"
                    className="border border-gray-300 rounded-xl px-3 py-2 bg-white"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={appLoc}
                  onChange={(e) => setAppLoc(e.target.value)}
                  placeholder="शहर / सेवा क्षेत्र *"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
                />
                <textarea
                  rows={2}
                  value={appDesc}
                  onChange={(e) => setAppDesc(e.target.value)}
                  placeholder="अपनी पूजा सामग्री या वैदिक सेवाओं का संक्षिप्त विवरण..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
                />
                <button
                  type="submit"
                  className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-6 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  वेंडर आवेदन सबमिट करें
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Earnings KPI strip */}
            {dash && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-cream border border-orange-200 rounded-xl p-3">
                  <div className="text-gray-500 font-bold">कुल ऑर्डर</div>
                  <div className="text-xl font-extrabold text-gray-900">{dash.stats.totalOrders}</div>
                </div>
                <div className="bg-cream border border-orange-200 rounded-xl p-3">
                  <div className="text-gray-500 font-bold">सक्रिय लिस्टिंग</div>
                  <div className="text-xl font-extrabold text-saffron">{dash.stats.activeListings}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <div className="text-green-700 font-bold">कुल बिक्री</div>
                  <div className="text-xl font-extrabold text-green-900">₹{dash.stats.grossEarnings}</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <div className="text-blue-700 font-bold">नेट कमाई (8% शुल्क बाद)</div>
                  <div className="text-xl font-extrabold text-blue-900">₹{dash.stats.netEarnings}</div>
                </div>
              </div>
            )}

            {/* Vendor Tabs */}
            <div className="flex flex-wrap gap-2 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setTab('orders')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                  tab === 'orders' ? 'bg-abhiRed text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                आने वाले ऑर्डर ({dash?.orders.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setTab('listings')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                  tab === 'listings' ? 'bg-abhiRed text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                मेरी लिस्टिंग्स ({dash?.listings.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setTab('add')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                  tab === 'add' ? 'bg-abhiRed text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                + नया किट / पंडित जोड़ें
              </button>
              <button
                type="button"
                onClick={() => setTab('custom')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                  tab === 'custom' ? 'bg-abhiRed text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                कस्टम पर्ची कोटेशन ({dash?.customLists.length || 0})
              </button>
            </div>

            {loading && <div className="text-xs text-gray-500">डेटा लोड हो रहा है...</div>}

            {tab === 'orders' && (
              <div className="space-y-2.5 text-xs">
                {(dash?.orders || []).length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-500">
                    अभी कोई नया ऑर्डर नहीं आया है।
                  </div>
                ) : (
                  dash!.orders.map((b) => (
                    <div
                      key={b.id}
                      className="bg-cream border border-orange-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-extrabold text-gray-900">
                          #{b.id} — {b.items?.map((i) => i.titleSnapshot).join(', ') || b.orderType}
                        </div>
                        <div className="text-gray-600 mt-0.5">
                          {b.customerName} ({b.phone}) • राशि: <strong>₹{b.total}</strong> •{' '}
                          {b.addressLine}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200 font-extrabold text-saffron">
                          {b.cancelledAt ? 'रद्द' : STEP_LABELS[b.statusStep] || 'पूर्ण'}
                        </span>
                        {!b.cancelledAt && b.statusStep < 3 && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceOrder(b.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-extrabold cursor-pointer"
                          >
                            अगला चरण →
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'listings' && (
              <div className="space-y-2.5 text-xs">
                {(dash?.listings || []).map((l) => (
                  <div
                    key={l.id}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-extrabold text-gray-900">{l.title}</div>
                      <div className="text-gray-500">
                        {l.category} • ₹{l.basePrice} • स्थिति: <strong>{l.status}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleListingStatus(l)}
                      className="bg-white border border-gray-300 px-3 py-1 rounded-lg font-bold cursor-pointer"
                    >
                      {l.status === 'active' ? 'Pause करें' : 'Active करें'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'add' && (
              <form onSubmit={handleAddListing} className="space-y-3 text-xs sm:text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">सेवा श्रेणी *</label>
                    <select
                      value={vCategory}
                      onChange={(e) =>
                        setVCategory(e.target.value as 'pooja_box' | 'pandit' | 'murti' | 'photo')
                      }
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 font-bold bg-white"
                    >
                      <option value="pooja_box">पूजा सामग्री किट (Pooja Box)</option>
                      <option value="pandit">पंडित जी बुकिंग (Pandit Ji)</option>
                      <option value="murti">मूर्ति (Murti)</option>
                      <option value="photo">भगवान फोटो फ्रेम (Photo Frame)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      दुकान / संस्था / आचार्य का नाम *
                    </label>
                    <input
                      type="text"
                      required
                      value={vShopName}
                      onChange={(e) => setVShopName(e.target.value)}
                      placeholder="जैसे: श्री राम पूजा भंडार"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      मूल्य / दक्षिणा (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={50}
                      value={vPrice}
                      onChange={(e) => setVPrice(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      सेवा क्षेत्र (Location)
                    </label>
                    <select
                      value={vLocation}
                      onChange={(e) => setVLocation(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
                    >
                      <option value="Sakchi, Jamshedpur">Sakchi, Jamshedpur</option>
                      <option value="Bagbera, Jamshedpur">Bagbera, Jamshedpur</option>
                      <option value="Bistupur, Jamshedpur">Bistupur, Jamshedpur</option>
                      <option value="Ranchi">Ranchi, Jharkhand</option>
                      <option value="Patna">Patna, Bihar</option>
                      <option value="Varanasi">Varanasi, UP</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">शीर्षक *</label>
                  <input
                    type="text"
                    required
                    value={vTitle}
                    onChange={(e) => setVTitle(e.target.value)}
                    placeholder="जैसे: गृह प्रवेश संपूर्ण किट"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
                {vCategory === 'pooja_box' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      बॉक्स सामग्री (कॉमा से अलग करें)
                    </label>
                    <input
                      type="text"
                      value={vBoxItemsText}
                      onChange={(e) => setVBoxItemsText(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      फीचर इमेज URL *
                    </label>
                    <input
                      type="url"
                      required
                      value={vImageUrl}
                      onChange={(e) => setVImageUrl(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div className="pt-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                      <input
                        type="checkbox"
                        checked={vGlobal}
                        onChange={(e) => setVGlobal(e.target.checked)}
                        className="w-4 h-4 accent-abhiRed"
                      />{' '}
                      🌍 ग्लोबल डिलीवरी उपलब्ध
                    </label>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-abhiRed hover:bg-abhiRedDark text-white font-bold py-3 rounded-xl shadow-md transition cursor-pointer"
                >
                  अभी लाइव लिस्ट करें
                </button>
              </form>
            )}

            {tab === 'custom' && (
              <div className="space-y-2.5 text-xs">
                {(dash?.customLists || []).map((cl) => (
                  <div
                    key={cl.id}
                    className="bg-cream border border-orange-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-extrabold text-gray-900">
                        {cl.pujaName} • {cl.customerName} ({cl.phone})
                      </div>
                      <div className="text-gray-600">{cl.address}</div>
                      {cl.filePath && (
                        <a
                          href={cl.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 font-bold hover:underline"
                        >
                          📎 अपलोड पर्ची देखें
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder={String(cl.quotedPrice || 499)}
                        value={quoteDrafts[cl.id] ?? String(cl.quotedPrice || '')}
                        onChange={(e) =>
                          setQuoteDrafts((prev) => ({ ...prev, [cl.id]: e.target.value }))
                        }
                        className="w-24 border border-gray-300 rounded-lg px-2 py-1 bg-white font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendQuote(cl.id)}
                        className="bg-saffron text-white px-3 py-1.5 rounded-lg font-extrabold cursor-pointer"
                      >
                        कोट भेजें
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== ADMIN PANEL MODAL ====================

interface AdminPanelModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onGlobalSettingsChanged: () => Promise<void>;
  showToast: (msg: string) => void;
}

interface AdminDashData {
  stats: {
    usersCount: number;
    vendorsCount: number;
    pendingVendors: number;
    listingsCount: number;
    ordersCount: number;
    totalRevenue: number;
    donationsCount: number;
    totalDonationsAmt: number;
  };
  users: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
  }>;
  vendors: VendorProfile[];
  listings: Listing[];
  orders: OrderRecord[];
  promos: Array<{
    id: number;
    code: string;
    type: string;
    value: number;
    minOrder: number;
    usedCount: number;
    isActive: boolean;
  }>;
  settings: SiteSettings;
  donations: DonationRecord[];
  auditLogs: Array<{
    id: number;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: string;
  }>;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  user,
  onClose,
  onGlobalSettingsChanged,
  showToast,
}) => {
  const [tab, setTab] = useState<'overview' | 'users' | 'vendors' | 'promos' | 'settings' | 'logs'>(
    'overview'
  );
  const [data, setData] = useState<AdminDashData | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoType, setPromoType] = useState<'percent' | 'flat'>('percent');
  const [promoValue, setPromoValue] = useState(10);
  const [settingsDraft, setSettingsDraft] = useState<Partial<SiteSettings>>({});

  const loadAdmin = async () => {
    try {
      const res = await apiFetch<AdminDashData>('/api/admin/dashboard');
      setData(res);
      setSettingsDraft(res.settings);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'एडमिन डेटा लोड नहीं हो सका।');
    }
  };

  useEffect(() => {
    if (isOpen && user?.role === 'admin') {
      void loadAdmin();
    }
  }, [isOpen, user]);

  if (!isOpen || user?.role !== 'admin') return null;

  const handleUserUpdate = async (id: number, payload: { role?: string; status?: string }) => {
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      showToast('उपयोगकर्ता अपडेट हुआ!');
      await loadAdmin();
    } catch {
      showToast('अपडेट विफल।');
    }
  };

  const handleVendorStatus = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/admin/vendors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast(`वेंडर ${status === 'approved' ? 'स्वीकृत' : 'अस्वीकृत'} किया गया!`);
      await loadAdmin();
    } catch {
      showToast('वेंडर अपडेट विफल।');
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/promos', {
        method: 'POST',
        body: JSON.stringify({ code: promoCode, type: promoType, value: promoValue }),
      });
      setPromoCode('');
      showToast('नया प्रोमो कोड बन गया!');
      await loadAdmin();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'प्रोमो कोड त्रुटि।');
    }
  };

  const handleTogglePromo = async (id: number, isActive: boolean) => {
    try {
      await apiFetch(`/api/admin/promos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      await loadAdmin();
    } catch {
      showToast('प्रोमो अपडेट विफल।');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(settingsDraft),
      });
      showToast('✅ साइट सेटिंग्स और पंचांग अपडेट हो गया!');
      await onGlobalSettingsChanged();
      await loadAdmin();
    } catch {
      showToast('सेटिंग्स सेव विफल।');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl relative my-8 max-h-[92vh] overflow-y-auto box-scroll">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 mb-4 pr-8">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-gray-900">
              🛡️ PujaJunction.com एडमिन कंट्रोल पैनल
            </h3>
            <p className="text-xs text-gray-500">
              यूज़र्स, वेंडर अनुमोदन, ऑर्डर, प्रोमो कोड, UPI/WhatsApp सेटिंग्स व CSV एक्सपोर्ट
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-extrabold">
            <a
              href="/api/admin/export/orders"
              download
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1.5 rounded-lg"
            >
              ⬇ Orders CSV
            </a>
            <a
              href="/api/admin/export/users"
              download
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1.5 rounded-lg"
            >
              ⬇ Users CSV
            </a>
            <a
              href="/api/admin/export/donations"
              download
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1.5 rounded-lg"
            >
              ⬇ Donations CSV
            </a>
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 text-xs">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="text-red-700 font-bold">कुल राजस्व (Orders)</div>
              <div className="text-xl font-extrabold text-abhiRed">
                ₹{data.stats.totalRevenue} ({data.stats.ordersCount})
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <div className="text-saffron font-bold">कुल यूज़र्स</div>
              <div className="text-xl font-extrabold text-gray-900">{data.stats.usersCount}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="text-blue-700 font-bold">वेंडर्स (Pending)</div>
              <div className="text-xl font-extrabold text-blue-900">
                {data.stats.vendorsCount} ({data.stats.pendingVendors})
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
              <div className="text-amber-900 font-bold">सेवा दक्षिणा</div>
              <div className="text-xl font-extrabold text-amber-950">
                ₹{data.stats.totalDonationsAmt} ({data.stats.donationsCount})
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-4 text-xs font-extrabold">
          {(
            [
              ['overview', '📦 ऑर्डर व दक्षिणा'],
              ['users', '👥 यूज़र्स'],
              ['vendors', '🏪 वेंडर्स'],
              ['promos', '🏷️ प्रोमो कोड'],
              ['settings', '⚙️ सेटिंग्स व पंचांग'],
              ['logs', '📜 ऑडिट लॉग'],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                tab === k ? 'bg-abhiRed text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {tab === 'overview' && data && (
          <div className="space-y-3 text-xs">
            <h4 className="font-extrabold text-gray-900">हाल के ऑर्डर ({data.orders.length})</h4>
            {data.orders.slice(0, 15).map((o) => (
              <div
                key={o.id}
                className="bg-cream border border-orange-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="font-extrabold text-abhiRed">#{o.id}</span> •{' '}
                  <span className="font-bold">{o.customerName}</span> ({o.phone}) • {o.orderType}
                  <div className="text-gray-500">{o.addressLine}</div>
                </div>
                <div className="font-extrabold text-gray-900">
                  ₹{o.total} • {STEP_LABELS[o.statusStep] || 'पूर्ण'}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'users' && data && (
          <div className="space-y-2 text-xs">
            {data.users.map((u) => (
              <div
                key={u.id}
                className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="font-extrabold text-gray-900">
                    {u.name} <span className="text-gray-500 font-normal">({u.email})</span>
                  </div>
                  <div className="text-gray-500">
                    Role: <strong>{u.role}</strong> • Status: <strong>{u.status}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    onChange={(e) => handleUserUpdate(u.id, { role: e.target.value })}
                    className="border border-gray-300 rounded-lg px-2 py-1 bg-white font-bold"
                  >
                    <option value="customer">customer</option>
                    <option value="vendor">vendor</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      handleUserUpdate(u.id, {
                        status: u.status === 'active' ? 'blocked' : 'active',
                      })
                    }
                    className="bg-white border border-gray-300 px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                  >
                    {u.status === 'active' ? 'Block' : 'Unblock'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'vendors' && data && (
          <div className="space-y-2 text-xs">
            {data.vendors.map((v) => (
              <div
                key={v.id}
                className="bg-cream border border-orange-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="font-extrabold text-gray-900">{v.shopName}</div>
                  <div className="text-gray-600">
                    📍 {v.location} • 📞 {v.phone} • स्थिति: <strong className="uppercase">{v.status}</strong>
                  </div>
                </div>
                <div className="flex gap-2">
                  {v.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleVendorStatus(v.id, 'approved')}
                      className="bg-green-600 text-white px-3 py-1 rounded-lg font-extrabold cursor-pointer"
                    >
                      Approve
                    </button>
                  )}
                  {v.status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => handleVendorStatus(v.id, 'rejected')}
                      className="bg-red-100 text-abhiRed px-3 py-1 rounded-lg font-extrabold cursor-pointer"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'promos' && data && (
          <div className="space-y-4 text-xs">
            <form
              onSubmit={handleCreatePromo}
              className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex flex-wrap items-center gap-2"
            >
              <input
                type="text"
                required
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="नया कोड (जैसे: SHIV20)"
                className="border border-gray-300 rounded-lg px-3 py-1.5 uppercase font-extrabold bg-white"
              />
              <select
                value={promoType}
                onChange={(e) => setPromoType(e.target.value as 'percent' | 'flat')}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-bold"
              >
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
              <input
                type="number"
                required
                min={1}
                value={promoValue}
                onChange={(e) => setPromoValue(Number(e.target.value))}
                className="w-24 border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-bold"
              />
              <button
                type="submit"
                className="bg-abhiRed text-white px-4 py-1.5 rounded-lg font-extrabold cursor-pointer"
              >
                + जोड़ें
              </button>
            </form>

            <div className="space-y-2">
              {data.promos.map((p) => (
                <div
                  key={p.id}
                  className="bg-cream border border-orange-200 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="font-extrabold text-gray-900">{p.code}</span> •{' '}
                    {p.type === 'percent' ? `${p.value}%` : `₹${p.value}`} छूट • उपयोग: {p.usedCount}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePromo(p.id, !p.isActive)}
                    className={`px-3 py-1 rounded-lg font-extrabold cursor-pointer ${
                      p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {p.isActive ? 'Active' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">WhatsApp नंबर</label>
                <input
                  type="text"
                  value={settingsDraft.whatsappNumber || ''}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, whatsappNumber: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">UPI ID (सेवा दक्षिणा)</label>
                <input
                  type="text"
                  value={settingsDraft.upiId || ''}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, upiId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">आज की तिथि (Panchang)</label>
                <input
                  type="text"
                  value={settingsDraft.panchangTithi || ''}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, panchangTithi: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">अभिजीत मुहूर्त</label>
                <input
                  type="text"
                  value={settingsDraft.panchangAbhijit || ''}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, panchangAbhijit: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </div>
            </div>
            <button
              type="submit"
              className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-5 py-2.5 rounded-xl cursor-pointer"
            >
              सेटिंग्स सेव करें
            </button>
          </form>
        )}

        {tab === 'logs' && data && (
          <div className="space-y-1.5 text-xs">
            {data.auditLogs.length === 0 ? (
              <div className="text-gray-500 py-6 text-center">अभी कोई ऑडिट लॉग नहीं है।</div>
            ) : (
              data.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex justify-between"
                >
                  <span>
                    <strong>{log.action}</strong> ({log.targetType}: {log.targetId})
                  </span>
                  <span className="text-gray-400">
                    {new Date(log.createdAt).toLocaleString('hi-IN')}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
