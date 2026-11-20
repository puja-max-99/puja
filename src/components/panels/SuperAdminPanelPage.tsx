import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type {
  DonationRecord,
  OrderRecord,
  PanditBookingRecord,
  PanditProfile,
  PayoutRequest,
  PromoCodeRecord,
  SiteSettings,
  UserProfile,
  VendorProfile,
} from '../../types/puja';

interface AdminDashboardPayload {
  stats: {
    usersCount: number;
    customersCount: number;
    vendorsCount: number;
    pendingVendors: number;
    panditsCount: number;
    pendingPandits: number;
    listingsCount: number;
    activeListings: number;
    ordersCount: number;
    bookingsCount: number;
    pendingPayoutsCount: number;
    pendingPayoutsAmt: number;
    totalRevenue: number;
    estCommission: number;
    donationsCount: number;
    totalDonationsAmt: number;
  };
  users: Array<{
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    status: string;
    emailVerifiedAt?: string | null;
    createdAt: string;
  }>;
  vendors: VendorProfile[];
  pandits: PanditProfile[];
  listings: Array<{
    id: number;
    title: string;
    vendorName: string;
    category: string;
    basePrice: number;
    stockQty: number;
    isGlobal: boolean;
    status: string;
    location: string;
  }>;
  orders: OrderRecord[];
  bookings: PanditBookingRecord[];
  promos: PromoCodeRecord[];
  payouts: PayoutRequest[];
  settings: Partial<SiteSettings>;
  donations: DonationRecord[];
  customLists: Array<{
    id: number;
    pujaName: string;
    customerName: string;
    phone: string;
    status: string;
    quotedPrice?: number | null;
    orderId?: string | null;
  }>;
  auditLogs: Array<{
    id: number;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: string;
  }>;
}

interface SuperAdminPanelPageProps {
  user: UserProfile | null;
  onRequireLogin: () => void;
  onGlobalDataChanged: () => Promise<void>;
  onOpenStorefront: () => void;
  onSwitchPanel: (panel: 'vendor_panel' | 'pandit_panel' | 'user_panel') => void;
  showToast: (msg: string) => void;
}

const STEP_LABELS = ['ऑर्डर प्राप्त', 'पैकिंग / संकल्प', 'डिस्पैच', 'डिलीवर्ड'];

export const SuperAdminPanelPage: React.FC<SuperAdminPanelPageProps> = ({
  user,
  onRequireLogin,
  onGlobalDataChanged,
  onOpenStorefront,
  onSwitchPanel,
  showToast,
}) => {
  const [tab, setTab] = useState<
    | 'overview'
    | 'users'
    | 'vendors'
    | 'pandits'
    | 'listings'
    | 'orders'
    | 'payouts'
    | 'promos'
    | 'donations'
    | 'settings'
  >('overview');
  const [data, setData] = useState<AdminDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [listingSearch, setListingSearch] = useState('');
  const [listingCatFilter, setListingCatFilter] = useState('ALL');

  // Commission edit map
  const [commMap, setCommMap] = useState<Record<number, string>>({});

  // Payout admin note map
  const [payoutNoteMap, setPayoutNoteMap] = useState<Record<number, string>>({});

  // Promo creation form
  const [promoCode, setPromoCode] = useState('');
  const [promoType, setPromoType] = useState<'percent' | 'flat'>('percent');
  const [promoVal, setPromoVal] = useState('15');
  const [promoMin, setPromoMin] = useState('299');

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const loadDashboard = useCallback(async () => {
    if (!user || !isSuperAdmin) return;
    setLoading(true);
    try {
      const res = await apiFetch<AdminDashboardPayload>('/api/admin/dashboard');
      setData(res);
      setSettingsForm({
        siteName: res.settings.siteName || 'PujaJunction.com',
        whatsappNumber: res.settings.whatsappNumber || '919876543210',
        upiId: res.settings.upiId || 'wahanilet@ptyes',
        payeeName: res.settings.payeeName || 'PujaJunction.com',
        panchangTithi: res.settings.panchangTithi || '',
        panchangNakshatra: res.settings.panchangNakshatra || '',
        panchangAbhijit: res.settings.panchangAbhijit || '',
        panchangRahukaal: res.settings.panchangRahukaal || '',
      });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'सुपर एडमिन डेटा लोड नहीं हो सका।');
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin, showToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (!user || !isSuperAdmin) {
    return (
      <div className="max-w-xl mx-auto my-12 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-abhiRed flex items-center justify-center text-2xl mb-4">
            <i className="fa-solid fa-shield-halved" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">सुपर एडमिन मास्टर कंट्रोल पैनल</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1.5 mb-5">
            {user
              ? 'यह पैनल केवल अधिकृत सुपर एडमिन खाते के लिए सुरक्षित है।'
              : 'संपूर्ण वेबसाइट, वेंडर, पंडित जी, यूज़र्स, ऑर्डर और पेआउट मैनेज करने के लिए सुपर एडमिन लॉगिन करें।'}
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={onRequireLogin}
              className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-5 py-2.5 rounded-xl text-sm shadow-sm cursor-pointer"
            >
              सुपर एडमिन लॉगिन
            </button>
            <button
              type="button"
              onClick={onOpenStorefront}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-4 py-2.5 rounded-xl text-sm cursor-pointer"
            >
              होमपेज पर जाएं
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: typeof tab; label: string; icon: string; badge?: number }> = [
    { id: 'overview', label: 'मास्टर ओवरव्यू', icon: 'fa-chart-pie' },
    { id: 'users', label: 'यूज़र्स व रोल्स', icon: 'fa-users', badge: data?.stats.usersCount },
    { id: 'vendors', label: 'वेंडर प्रबंधन', icon: 'fa-store', badge: data?.stats.pendingVendors },
    { id: 'pandits', label: 'पंडित जी प्रबंधन', icon: 'fa-hands-praying', badge: data?.stats.pendingPandits },
    { id: 'listings', label: 'सभी उत्पाद व लिस्टिंग', icon: 'fa-boxes-stacked', badge: data?.stats.listingsCount },
    { id: 'orders', label: 'ऑर्डर व पर्ची', icon: 'fa-receipt', badge: data?.stats.ordersCount },
    { id: 'payouts', label: 'पेआउट सेटलमेंट', icon: 'fa-money-bill-transfer', badge: data?.stats.pendingPayoutsCount },
    { id: 'promos', label: 'प्रोमो व कूपन', icon: 'fa-ticket' },
    { id: 'donations', label: 'सेवा दक्षिणा', icon: 'fa-hand-holding-heart' },
    { id: 'settings', label: 'सेटिंग्स व पंचांग', icon: 'fa-sliders' },
  ];

  const filteredUsers = (data?.users || []).filter((u) => {
    const roleMatch =
      userRoleFilter === 'ALL' ||
      u.role === userRoleFilter ||
      (userRoleFilter === 'super_admin' && u.role === 'admin');
    const qMatch =
      !userSearch.trim() ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    return roleMatch && qMatch;
  });

  const filteredListings = (data?.listings || []).filter((l) => {
    const catMatch = listingCatFilter === 'ALL' || l.category === listingCatFilter;
    const qMatch =
      !listingSearch.trim() ||
      l.title.toLowerCase().includes(listingSearch.toLowerCase()) ||
      l.vendorName.toLowerCase().includes(listingSearch.toLowerCase());
    return catMatch && qMatch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Super Admin Command Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-abhiRed to-saffron text-white flex items-center justify-center text-xl shadow-xs">
            <i className="fa-solid fa-shield-halved" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900">
                सुपर एडमिन मास्टर कंट्रोल पैनल
              </h2>
              <span className="text-[10px] font-extrabold bg-red-50 text-abhiRed border border-red-200 px-2 py-0.5 rounded-md">
                SUPER ADMIN
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              लॉगिन: {user.name} ({user.email}) • सभी पोर्टल्स का केंद्रीय नियंत्रण
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
          <button
            type="button"
            onClick={() => onSwitchPanel('vendor_panel')}
            className="px-3 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-saffron border border-orange-200 cursor-pointer"
          >
            🏪 वेंडर पैनल
          </button>
          <button
            type="button"
            onClick={() => onSwitchPanel('pandit_panel')}
            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
          >
            🙏 पंडित पैनल
          </button>
          <button
            type="button"
            onClick={() => onSwitchPanel('user_panel')}
            className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 cursor-pointer"
          >
            👤 यूज़र पैनल
          </button>
          <button
            type="button"
            onClick={onOpenStorefront}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 cursor-pointer"
          >
            ← लाइव साइट
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
                      tab === item.id ? 'bg-white text-abhiRed' : 'bg-red-50 text-abhiRed'
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
              मास्टर डेटा लोड हो रहा है...
            </div>
          ) : (
            data && (
              <>
                {tab === 'overview' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">कुल रेवेन्यू</div>
                        <div className="text-2xl font-extrabold text-abhiRed mt-1">₹{data.stats.totalRevenue}</div>
                        <div className="text-[11px] text-green-700 font-bold mt-0.5">अनुमानित कमीशन: ₹{data.stats.estCommission}</div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">कुल यूज़र्स</div>
                        <div className="text-2xl font-extrabold text-gray-900 mt-1">{data.stats.usersCount}</div>
                        <div className="text-[11px] text-gray-500 font-semibold mt-0.5">
                          वेंडर: {data.stats.vendorsCount} • पंडित: {data.stats.panditsCount}
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">ऑर्डर व बुकिंग्स</div>
                        <div className="text-2xl font-extrabold text-gray-900 mt-1">{data.stats.ordersCount}</div>
                        <div className="text-[11px] text-saffron font-bold mt-0.5">पंडित बुकिंग्स: {data.stats.bookingsCount}</div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">सेवा दक्षिणा</div>
                        <div className="text-2xl font-extrabold text-saffron mt-1">₹{data.stats.totalDonationsAmt}</div>
                        <div className="text-[11px] text-gray-500 font-semibold mt-0.5">लंबित पेआउट: ₹{data.stats.pendingPayoutsAmt}</div>
                      </div>
                    </div>

                    {/* Pending Approvals Quick Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => setTab('vendors')}
                        className="bg-white hover:bg-orange-50 border border-orange-200 rounded-2xl p-4 text-left transition cursor-pointer"
                      >
                        <div className="font-extrabold text-gray-900">🏪 लंबित वेंडर वेरिफिकेशन</div>
                        <div className="text-2xl font-extrabold text-saffron mt-1">{data.stats.pendingVendors}</div>
                        <div className="text-gray-500 mt-0.5">स्वीकृत करने के लिए क्लिक करें →</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab('pandits')}
                        className="bg-white hover:bg-orange-50 border border-orange-200 rounded-2xl p-4 text-left transition cursor-pointer"
                      >
                        <div className="font-extrabold text-gray-900">🙏 लंबित पंडित जी प्रोफ़ाइल</div>
                        <div className="text-2xl font-extrabold text-abhiRed mt-1">{data.stats.pendingPandits}</div>
                        <div className="text-gray-500 mt-0.5">वेरिफाई व लाइव करने हेतु क्लिक करें →</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab('payouts')}
                        className="bg-white hover:bg-orange-50 border border-orange-200 rounded-2xl p-4 text-left transition cursor-pointer"
                      >
                        <div className="font-extrabold text-gray-900">💸 लंबित पेआउट अनुरोध</div>
                        <div className="text-2xl font-extrabold text-green-700 mt-1">{data.stats.pendingPayoutsCount}</div>
                        <div className="text-gray-500 mt-0.5">राशि ₹{data.stats.pendingPayoutsAmt} सेटल करें →</div>
                      </button>
                    </div>

                    {/* CSV Exports */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                      <h3 className="text-sm font-extrabold text-gray-900 mb-3">📊 रिपोर्ट्स CSV डाउनलोड</h3>
                      <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                        {(
                          [
                            ['orders', 'ऑर्डर्स CSV'],
                            ['users', 'यूज़र्स CSV'],
                            ['vendors', 'वेंडर्स CSV'],
                            ['pandits', 'पंडित जी CSV'],
                            ['donations', 'दक्षिणा CSV'],
                          ] as const
                        ).map(([t, lbl]) => (
                          <a
                            key={t}
                            href={`/api/admin/export/${t}`}
                            className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white transition"
                          >
                            <i className="fa-solid fa-download mr-1.5" />
                            {lbl}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'users' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-extrabold text-gray-900">सभी यूज़र्स एवं रोल (RBAC)</h3>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="नाम या ईमेल खोजें..."
                          className="border border-gray-300 rounded-xl px-3 py-1.5"
                        />
                        <select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value)}
                          className="border border-gray-300 rounded-xl px-3 py-1.5 bg-white font-bold"
                        >
                          <option value="ALL">सभी रोल्स</option>
                          <option value="customer">Customer</option>
                          <option value="vendor">Vendor</option>
                          <option value="pandit">Pandit</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500 font-extrabold">
                            <th className="py-2 pr-3">नाम / ईमेल</th>
                            <th className="py-2 px-2">रोल</th>
                            <th className="py-2 px-2">स्थिति</th>
                            <th className="py-2 pl-2 text-right">कार्रवाई</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredUsers.map((u) => (
                            <tr key={u.id}>
                              <td className="py-2.5 pr-3">
                                <div className="font-extrabold text-gray-900">{u.name}</div>
                                <div className="text-[11px] text-gray-500">
                                  {u.email} {u.phone ? `• ${u.phone}` : ''}
                                </div>
                              </td>
                              <td className="py-2.5 px-2">
                                <select
                                  value={u.role === 'admin' ? 'super_admin' : u.role}
                                  onChange={async (e) => {
                                    await apiFetch(`/api/admin/users/${u.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ role: e.target.value }),
                                    });
                                    showToast(`${u.name} का रोल अपडेट हो गया।`);
                                    await loadDashboard();
                                  }}
                                  className="border border-gray-300 rounded-lg px-2 py-1 bg-white font-bold"
                                >
                                  <option value="customer">Customer</option>
                                  <option value="vendor">Vendor</option>
                                  <option value="pandit">Pandit</option>
                                  <option value="super_admin">Super Admin</option>
                                </select>
                              </td>
                              <td className="py-2.5 px-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    u.status === 'active'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {u.status}
                                </span>
                              </td>
                              <td className="py-2.5 pl-2 text-right">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await apiFetch(`/api/admin/users/${u.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({
                                        status: u.status === 'active' ? 'blocked' : 'active',
                                      }),
                                    });
                                    showToast('यूज़र स्थिति अपडेट हो गई।');
                                    await loadDashboard();
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold cursor-pointer"
                                >
                                  {u.status === 'active' ? 'ब्लॉक करें' : 'अनब्लॉक करें'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {tab === 'vendors' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <h3 className="text-base font-extrabold text-gray-900">वेंडर स्टोर्स नियंत्रण एवं कमीशन</h3>
                    {data.vendors.map((v) => (
                      <div key={v.id} className="border border-gray-200 rounded-2xl p-4 text-xs space-y-2.5">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div>
                            <div className="font-extrabold text-sm text-gray-900">
                              {v.shopName}{' '}
                              {v.isVerified && <i className="fa-solid fa-circle-check text-blue-600 text-xs" />}
                            </div>
                            <div className="text-gray-600">
                              📍 {v.location} • 📞 {v.phone} {v.gstNumber ? `• GST: ${v.gstNumber}` : ''}
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-extrabold self-start uppercase text-[10px] ${
                              v.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : v.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {v.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-600">कमीशन %:</span>
                            <input
                              type="number"
                              min={0}
                              max={40}
                              value={commMap[v.id] ?? String(v.commissionRate ?? 8)}
                              onChange={(e) => setCommMap((p) => ({ ...p, [v.id]: e.target.value }))}
                              className="w-16 border border-gray-300 rounded-lg px-2 py-1 font-bold"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/admin/vendors/${v.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ commissionRate: Number(commMap[v.id] ?? v.commissionRate ?? 8) }),
                                });
                                showToast('कमीशन दर सेव हुई।');
                                await loadDashboard();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-gray-900 text-white font-bold cursor-pointer"
                            >
                              सेव
                            </button>
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/admin/vendors/${v.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'approved' }),
                                });
                                showToast(`"${v.shopName}" स्वीकृत हो गया!`);
                                await loadDashboard();
                              }}
                              className="px-3 py-1 rounded-lg bg-green-600 text-white font-extrabold cursor-pointer"
                            >
                              ✓ स्वीकृत करें
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/admin/vendors/${v.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'suspended' }),
                                });
                                showToast('वेंडर अस्थायी रूप से रोका गया।');
                                await loadDashboard();
                              }}
                              className="px-3 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 font-extrabold cursor-pointer"
                            >
                              रोकें
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'pandits' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <h3 className="text-base font-extrabold text-gray-900">पंडित जी प्रोफ़ाइल वेरिफिकेशन एवं प्रबंधन</h3>
                    {data.pandits.map((p) => (
                      <div key={p.id} className="border border-orange-200 bg-cream rounded-2xl p-4 text-xs space-y-2">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.photoUrl}
                              alt={p.fullName}
                              className="w-12 h-12 rounded-xl object-cover border border-orange-200"
                            />
                            <div>
                              <div className="font-extrabold text-sm text-gray-900">
                                {p.fullName}{' '}
                                {p.isVerified && <i className="fa-solid fa-circle-check text-blue-600 text-xs" />}
                              </div>
                              <div className="text-gray-600">
                                {p.title} • 📍 {p.city} • {p.experienceYears} वर्ष अनुभव • दक्षिणा ₹{p.baseDakshina}+
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-extrabold self-start uppercase text-[10px] ${
                              p.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : p.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <div className="text-gray-700">
                          शिक्षा: <b>{p.education}</b> • संपन्न पूजाएं: <b>{p.completedPujas}+</b> • 📞 {p.phone}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/admin/pandits/${p.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'approved' }),
                              });
                              showToast(`🙏 ${p.fullName} वेरिफाई व स्टोरफ्रंट पर लाइव हो गए!`);
                              await Promise.all([loadDashboard(), onGlobalDataChanged()]);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-extrabold cursor-pointer"
                          >
                            ✓ वेरिफाई व लाइव करें
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/admin/pandits/${p.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'rejected' }),
                              });
                              showToast('पंडित प्रोफ़ाइल अस्वीकृत / रोका गया।');
                              await Promise.all([loadDashboard(), onGlobalDataChanged()]);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-white border border-red-200 text-red-700 font-extrabold cursor-pointer"
                          >
                            अस्वीकृत / रोकें
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'listings' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-extrabold text-gray-900">सभी उत्पाद व लिस्टिंग मॉडरेशन</h3>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <input
                          type="text"
                          value={listingSearch}
                          onChange={(e) => setListingSearch(e.target.value)}
                          placeholder="शीर्षक या वेंडर खोजें..."
                          className="border border-gray-300 rounded-xl px-3 py-1.5"
                        />
                        <select
                          value={listingCatFilter}
                          onChange={(e) => setListingCatFilter(e.target.value)}
                          className="border border-gray-300 rounded-xl px-3 py-1.5 bg-white font-bold"
                        >
                          <option value="ALL">सभी श्रेणियां</option>
                          <option value="pooja_box">पूजा किट</option>
                          <option value="pandit">पंडित जी</option>
                          <option value="murti">मूर्ति</option>
                          <option value="photo">फोटो</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      {filteredListings.map((l) => (
                        <div
                          key={l.id}
                          className="border border-gray-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-extrabold text-gray-900">{l.title}</div>
                            <div className="text-gray-500">
                              {l.vendorName} • {l.category} • ₹{l.basePrice} • स्टॉक: {l.stockQty ?? 50}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/admin/listings/${l.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: l.status === 'active' ? 'paused' : 'active' }),
                                });
                                showToast('लिस्टिंग स्थिति अपडेट हुई।');
                                await Promise.all([loadDashboard(), onGlobalDataChanged()]);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer ${
                                l.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {l.status === 'active' ? 'सक्रिय' : 'रोका गया'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/admin/listings/${l.id}`, { method: 'DELETE' });
                                showToast('लिस्टिंग हटाई गई।');
                                await Promise.all([loadDashboard(), onGlobalDataChanged()]);
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

                {tab === 'orders' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <h3 className="text-base font-extrabold text-gray-900">सभी प्लेटफ़ॉर्म ऑर्डर्स</h3>
                    {data.orders.length === 0 ? (
                      <p className="text-xs text-gray-500 py-8 text-center">अभी कोई ऑर्डर नहीं।</p>
                    ) : (
                      data.orders.map((o) => (
                        <div key={o.id} className="border border-gray-200 rounded-2xl p-4 text-xs space-y-2">
                          <div className="flex flex-wrap justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-sm text-gray-900">
                                #{o.id} • {o.customerName} ({o.phone})
                              </div>
                              <div className="text-gray-500">{o.orderType} • {o.addressLine}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-abhiRed text-base">₹{o.total}</div>
                              <div className="text-[11px] font-bold text-gray-600">{o.paymentMethod} • {o.paymentStatus}</div>
                            </div>
                          </div>
                          {!o.cancelledAt && (
                            <div className="flex flex-wrap gap-1.5">
                              {STEP_LABELS.map((lbl, idx) => (
                                <button
                                  key={lbl}
                                  type="button"
                                  onClick={async () => {
                                    await apiFetch(`/api/vendor/orders/${o.id}/step`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ step: idx }),
                                    });
                                    showToast(`ऑर्डर #${o.id} → ${lbl}`);
                                    await loadDashboard();
                                  }}
                                  className={`px-2.5 py-1 rounded-lg font-extrabold border cursor-pointer ${
                                    o.statusStep === idx
                                      ? 'bg-abhiRed text-white border-abhiRed'
                                      : 'bg-white text-gray-600 border-gray-300'
                                  }`}
                                >
                                  {idx + 1}. {lbl}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'payouts' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <h3 className="text-base font-extrabold text-gray-900">वेंडर एवं पंडित जी पेआउट सेटलमेंट</h3>
                    {data.payouts.length === 0 ? (
                      <p className="text-xs text-gray-500 py-8 text-center">कोई पेआउट अनुरोध नहीं।</p>
                    ) : (
                      data.payouts.map((p) => (
                        <div key={p.id} className="border border-gray-200 rounded-2xl p-4 text-xs space-y-2">
                          <div className="flex flex-wrap justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-sm text-gray-900">
                                ₹{p.amount} — {p.userName} ({p.roleType === 'pandit' ? 'पंडित जी' : 'वेंडर'})
                              </div>
                              <div className="text-gray-600">UPI / बैंक: <b>{p.upiOrBank}</b> • {p.userEmail}</div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-saffron font-extrabold uppercase text-[10px] self-start">
                              {p.status}
                            </span>
                          </div>
                          {p.status === 'pending' && (
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="text"
                                value={payoutNoteMap[p.id] || ''}
                                onChange={(e) => setPayoutNoteMap((m) => ({ ...m, [p.id]: e.target.value }))}
                                placeholder="UTR / रेफरेंस नोट (Optional)"
                                className="flex-1 border border-gray-300 rounded-xl px-3 py-1.5"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/admin/payouts/${p.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ status: 'paid', adminNote: payoutNoteMap[p.id] }),
                                  });
                                  showToast(`₹${p.amount} पेआउट Paid मार्क हो गया!`);
                                  await loadDashboard();
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-green-600 text-white font-extrabold cursor-pointer"
                              >
                                ✓ Paid मार्क करें
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/admin/payouts/${p.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ status: 'rejected', adminNote: payoutNoteMap[p.id] }),
                                  });
                                  showToast('पेआउट अनुरोध अस्वीकृत किया गया।');
                                  await loadDashboard();
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200 font-extrabold cursor-pointer"
                              >
                                अस्वीकृत
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'promos' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                    <h3 className="text-base font-extrabold text-gray-900">ग्लोबल एवं वेंडर प्रोमो कोड्स</h3>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await apiFetch('/api/admin/promos', {
                          method: 'POST',
                          body: JSON.stringify({
                            code: promoCode,
                            type: promoType,
                            value: Number(promoVal),
                            minOrder: Number(promoMin),
                          }),
                        });
                        setPromoCode('');
                        showToast('✅ ग्लोबल प्रोमो कोड बनाया गया।');
                        await loadDashboard();
                      }}
                      className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs"
                    >
                      <input
                        type="text"
                        required
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="कोड (UTSAV20)"
                        className="border border-gray-300 rounded-xl px-3 py-2 font-mono uppercase"
                      />
                      <select
                        value={promoType}
                        onChange={(e) => setPromoType(e.target.value as 'percent' | 'flat')}
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      >
                        <option value="percent">% छूट</option>
                        <option value="flat">₹ फ्लैट</option>
                      </select>
                      <input
                        type="number"
                        required
                        value={promoVal}
                        onChange={(e) => setPromoVal(e.target.value)}
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                      <input
                        type="number"
                        value={promoMin}
                        onChange={(e) => setPromoMin(e.target.value)}
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                      <button
                        type="submit"
                        className="bg-abhiRed text-white font-extrabold rounded-xl px-3 py-2 cursor-pointer"
                      >
                        + प्रोमो बनाएं
                      </button>
                    </form>

                    <div className="space-y-2 text-xs">
                      {data.promos.map((c) => (
                        <div key={c.id} className="border border-gray-200 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <span className="font-mono font-extrabold text-abhiRed text-sm">{c.code}</span>
                            <span className="ml-2 font-bold text-gray-700">
                              {c.type === 'percent' ? `${c.value}%` : `₹${c.value}`} • उपयोग: {c.usedCount}
                            </span>
                            <span className="ml-2 text-[10px] text-gray-500">
                              ({c.vendorId ? `Vendor #${c.vendorId}` : 'Global'})
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/admin/promos/${c.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ isActive: !c.isActive }),
                                });
                                await loadDashboard();
                              }}
                              className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                                c.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {c.isActive ? 'सक्रिय' : 'बंद'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/admin/promos/${c.id}`, { method: 'DELETE' });
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

                {tab === 'donations' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 text-xs">
                    <h3 className="text-base font-extrabold text-gray-900">
                      सेवा दक्षिणा खाता (कुल ₹{data.stats.totalDonationsAmt})
                    </h3>
                    {data.donations.map((d) => (
                      <div key={d.id} className="border border-orange-200 bg-cream rounded-xl p-3 flex justify-between">
                        <div>
                          <div className="font-extrabold text-gray-900">{d.donorName} ({d.donorCity || 'भारत'})</div>
                          <div className="text-gray-600">{d.cause} • रसीद #{d.id}</div>
                        </div>
                        <div className="font-extrabold text-abhiRed text-sm">₹{d.amount}</div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'settings' && (
                  <div className="space-y-5">
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await apiFetch('/api/admin/settings', {
                          method: 'PATCH',
                          body: JSON.stringify(settingsForm),
                        });
                        showToast('✅ साइट सेटिंग्स एवं लाइव पंचांग अपडेट हो गया!');
                        await onGlobalDataChanged();
                      }}
                      className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 text-xs"
                    >
                      <h3 className="text-base font-extrabold text-gray-900">साइट सेटिंग्स एवं लाइव पंचांग</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(
                          [
                            ['siteName', 'वेबसाइट नाम'],
                            ['whatsappNumber', 'WhatsApp सहायता नंबर'],
                            ['upiId', 'मुख्य UPI ID'],
                            ['payeeName', 'UPI प्राप्तकर्ता नाम'],
                            ['panchangTithi', 'आज की तिथि'],
                            ['panchangNakshatra', 'आज का नक्षत्र'],
                            ['panchangAbhijit', 'अभिजीत मुहूर्त'],
                            ['panchangRahukaal', 'राहुकाल'],
                          ] as const
                        ).map(([k, lbl]) => (
                          <div key={k}>
                            <label className="block font-bold text-gray-700 mb-1">{lbl}</label>
                            <input
                              type="text"
                              value={settingsForm[k] || ''}
                              onChange={(e) => setSettingsForm((p) => ({ ...p, [k]: e.target.value }))}
                              className="w-full border border-gray-300 rounded-xl px-3 py-2"
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        type="submit"
                        className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-6 py-2.5 rounded-xl cursor-pointer"
                      >
                        सेटिंग्स सेव करें
                      </button>
                    </form>

                    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2 text-xs">
                      <h3 className="text-sm font-extrabold text-gray-900">हाल के ऑडिट लॉग्स</h3>
                      {data.auditLogs.slice(0, 12).map((log) => (
                        <div key={log.id} className="border-b border-gray-100 py-1.5 flex justify-between text-gray-700">
                          <span>
                            <b>{log.action}</b> • {log.targetType} #{log.targetId}
                          </span>
                          <span className="text-gray-400">{new Date(log.createdAt).toLocaleString('hi-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};
