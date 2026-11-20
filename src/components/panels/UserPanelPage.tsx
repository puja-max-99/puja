import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type {
  DonationRecord,
  Listing,
  NotificationItem,
  OrderRecord,
  PanditBookingRecord,
  SubscriptionRecord,
  UserAddress,
  UserProfile,
} from '../../types/puja';

interface UserDashboardPayload {
  stats: {
    ordersCount: number;
    activeOrders: number;
    panditBookingsCount: number;
    activeSubscriptions: number;
    totalSpent: number;
    totalDonated: number;
    wishlistCount: number;
    unreadNotifications: number;
  };
  orders: OrderRecord[];
  panditBookings: PanditBookingRecord[];
  subscriptions: SubscriptionRecord[];
  customLists: Array<{
    id: number;
    pujaName: string;
    filePath?: string | null;
    fileName?: string | null;
    manualItemsJson?: Array<{ name: string; qty: string }> | null;
    needPandit: boolean;
    pujaDate?: string | null;
    status: string;
    quotedPrice?: number | null;
    orderId?: string | null;
    createdAt: string;
  }>;
  donations: DonationRecord[];
  addresses: UserAddress[];
  wishlistListings: Array<Listing & { vendorName?: string }>;
  notifications: NotificationItem[];
}

interface UserPanelPageProps {
  user: UserProfile | null;
  onRequireLogin: () => void;
  onRefreshAccount: () => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  onToggleWishlist: (listingId: number) => void;
  onOpenReceipt: (don: DonationRecord) => void;
  onLogout: (allDevices?: boolean) => Promise<void>;
  onOpenStorefront: () => void;
  onSwitchPanel: (panel: 'vendor_panel' | 'pandit_panel' | 'super_admin') => void;
  showToast: (msg: string) => void;
}

const STEP_LABELS = ['ऑर्डर प्राप्त', 'पैकिंग / संकल्प', 'डिस्पैच', 'डिलीवर्ड'];

export const UserPanelPage: React.FC<UserPanelPageProps> = ({
  user,
  onRequireLogin,
  onRefreshAccount,
  onCancelOrder,
  onToggleWishlist,
  onOpenReceipt,
  onLogout,
  onOpenStorefront,
  onSwitchPanel,
  showToast,
}) => {
  const [tab, setTab] = useState<
    | 'overview'
    | 'orders'
    | 'bookings'
    | 'subscriptions'
    | 'custom_lists'
    | 'donations'
    | 'wishlist'
    | 'addresses'
    | 'notifications'
    | 'profile'
  >('overview');
  const [data, setData] = useState<UserDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);

  // Profile & password state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currPw, setCurrPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [saving, setSaving] = useState(false);

  // New Address state
  const [addrLabel, setAddrLabel] = useState('घर');
  const [addrName, setAddrName] = useState(user?.name || '');
  const [addrPhone, setAddrPhone] = useState(user?.phone || '');
  const [addrLine, setAddrLine] = useState('');
  const [addrCity, setAddrCity] = useState('Jamshedpur');
  const [addrPin, setAddrPin] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch<UserDashboardPayload>('/api/user/dashboard');
      setData(res);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'यूज़र पैनल लोड नहीं हो सका।');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setAddrName(user?.name || '');
    setAddrPhone(user?.phone || '');
    void loadDashboard();
  }, [user, loadDashboard]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-12 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-abhiRed flex items-center justify-center text-2xl mb-4">
            <i className="fa-solid fa-user-lock" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">ग्राहक / यूज़र पैनल</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1.5 mb-5">
            अपने पूजा ऑर्डर, पंडित जी बुकिंग्स, मासिक सब्सक्रिप्शन, दक्षिणा रसीदें और पते देखने के लिए लॉगिन करें।
          </p>
          <button
            type="button"
            onClick={onRequireLogin}
            className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-6 py-2.5 rounded-xl text-sm shadow-sm cursor-pointer"
          >
            <i className="fa-solid fa-right-to-bracket mr-2" />
            लॉगिन / नया खाता बनाएं
          </button>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, phone }),
      });
      await onRefreshAccount();
      showToast('✅ प्रोफ़ाइल अपडेट हो गई।');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'अपडेट विफल रहा।');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currPw, newPassword: newPw }),
      });
      setCurrPw('');
      setNewPw('');
      showToast('✅ पासवर्ड सफलतापूर्वक बदल गया।');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'पासवर्ड अपडेट विफल।');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: addrLabel,
          name: addrName,
          phone: addrPhone,
          addressLine: addrLine,
          city: addrCity,
          pincode: addrPin,
          isDefault: (data?.addresses.length || 0) === 0,
        }),
      });
      setAddrLine('');
      setAddrPin('');
      await Promise.all([loadDashboard(), onRefreshAccount()]);
      showToast('✅ नया पता सेव हो गया।');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'पता सेव नहीं हो सका।');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    try {
      await apiFetch(`/api/addresses/${id}`, { method: 'DELETE' });
      await Promise.all([loadDashboard(), onRefreshAccount()]);
      showToast('पता हटाया गया।');
    } catch {
      showToast('पता हटाया नहीं जा सका।');
    }
  };

  const handleSubStatus = async (id: number, status: 'active' | 'paused' | 'cancelled') => {
    try {
      await apiFetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await Promise.all([loadDashboard(), onRefreshAccount()]);
      showToast('सब्सक्रिप्शन स्टेटस अपडेट हो गया।');
    } catch {
      showToast('अपडेट विफल रहा।');
    }
  };

  const handleReadAllNotifs = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      await Promise.all([loadDashboard(), onRefreshAccount()]);
      showToast('सभी सूचनाएं पढ़ी हुई मार्क की गईं।');
    } catch {
      // ignore
    }
  };

  const navItems: Array<{ id: typeof tab; label: string; icon: string; badge?: number }> = [
    { id: 'overview', label: 'डैशबोर्ड', icon: 'fa-gauge' },
    { id: 'orders', label: 'मेरे ऑर्डर', icon: 'fa-box-open', badge: data?.stats.ordersCount },
    { id: 'bookings', label: 'पंडित बुकिंग', icon: 'fa-hands-praying', badge: data?.stats.panditBookingsCount },
    { id: 'subscriptions', label: 'सब्सक्रिप्शन', icon: 'fa-rotate', badge: data?.stats.activeSubscriptions },
    { id: 'custom_lists', label: 'कस्टम पर्ची', icon: 'fa-file-lines', badge: data?.customLists.length },
    { id: 'donations', label: 'सेवा दक्षिणा', icon: 'fa-hand-holding-heart', badge: data?.donations.length },
    { id: 'wishlist', label: 'विशलिस्ट', icon: 'fa-heart', badge: data?.stats.wishlistCount },
    { id: 'addresses', label: 'पते (Addresses)', icon: 'fa-location-dot', badge: data?.addresses.length },
    { id: 'notifications', label: 'सूचनाएं', icon: 'fa-bell', badge: data?.stats.unreadNotifications },
    { id: 'profile', label: 'प्रोफ़ाइल व सुरक्षा', icon: 'fa-user-gear' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top User Strip */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-abhiRed to-saffron text-white font-extrabold text-xl flex items-center justify-center shadow-xs">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900">{user.name}</h2>
              <span className="text-[10px] font-extrabold uppercase bg-orange-50 text-saffron border border-orange-200 px-2 py-0.5 rounded-md">
                {user.role === 'super_admin' || user.role === 'admin'
                  ? 'Super Admin'
                  : user.role === 'vendor'
                  ? 'Vendor'
                  : user.role === 'pandit'
                  ? 'Pandit Ji'
                  : 'श्रद्धालु (User)'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {user.email} {user.phone ? `• ${user.phone}` : ''}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {(user.role === 'vendor' || user.role === 'super_admin' || user.role === 'admin') && (
            <button
              type="button"
              onClick={() => onSwitchPanel('vendor_panel')}
              className="px-3 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-saffron border border-orange-200 cursor-pointer"
            >
              🏪 वेंडर पैनल
            </button>
          )}
          {(user.role === 'pandit' || user.role === 'super_admin' || user.role === 'admin') && (
            <button
              type="button"
              onClick={() => onSwitchPanel('pandit_panel')}
              className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
            >
              🙏 पंडित पैनल
            </button>
          )}
          {(user.role === 'super_admin' || user.role === 'admin') && (
            <button
              type="button"
              onClick={() => onSwitchPanel('super_admin')}
              className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-abhiRed border border-red-200 cursor-pointer"
            >
              🛡️ सुपर एडमिन
            </button>
          )}
          <button
            type="button"
            onClick={onOpenStorefront}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 cursor-pointer"
          >
            ← शॉपिंग जारी रखें
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar */}
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

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-5">
          {loading && !data ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-500 font-bold">
              यूज़र पैनल लोड हो रहा है...
            </div>
          ) : (
            <>
              {tab === 'overview' && data && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl border border-gray-200 p-4">
                      <div className="text-[11px] font-bold text-gray-500">कुल ऑर्डर</div>
                      <div className="text-2xl font-extrabold text-gray-900 mt-1">{data.stats.ordersCount}</div>
                      <div className="text-[11px] text-saffron font-bold mt-0.5">{data.stats.activeOrders} सक्रिय</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4">
                      <div className="text-[11px] font-bold text-gray-500">पंडित जी बुकिंग</div>
                      <div className="text-2xl font-extrabold text-abhiRed mt-1">{data.stats.panditBookingsCount}</div>
                      <div className="text-[11px] text-gray-500 font-semibold mt-0.5">वैदिक अनुष्ठान</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4">
                      <div className="text-[11px] font-bold text-gray-500">कुल पूजा खर्च</div>
                      <div className="text-2xl font-extrabold text-green-700 mt-1">₹{data.stats.totalSpent}</div>
                      <div className="text-[11px] text-gray-500 font-semibold mt-0.5">{data.stats.activeSubscriptions} सब्सक्रिप्शन</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4">
                      <div className="text-[11px] font-bold text-gray-500">सेवा दक्षिणा</div>
                      <div className="text-2xl font-extrabold text-saffron mt-1">₹{data.stats.totalDonated}</div>
                      <div className="text-[11px] text-gray-500 font-semibold mt-0.5">{data.donations.length} रसीदें</div>
                    </div>
                  </div>

                  {/* Quick Recent Orders */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-extrabold text-gray-900">हाल के ऑर्डर</h3>
                      <button
                        type="button"
                        onClick={() => setTab('orders')}
                        className="text-xs font-extrabold text-abhiRed hover:underline cursor-pointer"
                      >
                        सभी देखें →
                      </button>
                    </div>
                    {data.orders.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">अभी तक कोई ऑर्डर नहीं किया गया है।</p>
                    ) : (
                      <div className="space-y-2.5">
                        {data.orders.slice(0, 3).map((ord) => (
                          <div
                            key={ord.id}
                            className="border border-gray-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-extrabold text-gray-900">
                                #{ord.id} • {ord.orderType}
                              </div>
                              <div className="text-gray-500 mt-0.5">
                                {ord.items?.map((i) => i.titleSnapshot).join(', ')}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-abhiRed">₹{ord.total}</div>
                              <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-50 text-saffron border border-orange-200 mt-0.5">
                                {ord.cancelledAt ? 'रद्द' : STEP_LABELS[ord.statusStep] || 'प्रोसेसिंग'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'orders' && data && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-gray-900">मेरे ऑर्डर एवं लाइव ट्रैकिंग</h3>
                    <button
                      type="button"
                      onClick={() => void loadDashboard()}
                      className="text-xs font-bold text-gray-600 hover:text-abhiRed cursor-pointer"
                    >
                      <i className="fa-solid fa-rotate-right mr-1" /> रिफ्रेश
                    </button>
                  </div>
                  {data.orders.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center">कोई ऑर्डर नहीं मिला।</p>
                  ) : (
                    data.orders.map((ord) => (
                      <div key={ord.id} className="border border-gray-200 rounded-2xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                          <div>
                            <div className="text-sm font-extrabold text-gray-900">
                              ऑर्डर #{ord.id}{' '}
                              <span className="text-xs font-bold text-gray-500">({ord.orderType})</span>
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {new Date(ord.createdAt).toLocaleString('hi-IN')} • {ord.paymentMethod}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold text-abhiRed">₹{ord.total}</span>
                            {!ord.cancelledAt && ord.statusStep < 2 && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await onCancelOrder(ord.id);
                                  await loadDashboard();
                                }}
                                className="text-[11px] font-extrabold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg cursor-pointer"
                              >
                                रद्द करें
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 4-step live tracker */}
                        {ord.cancelledAt ? (
                          <div className="text-xs font-extrabold text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                            यह ऑर्डर रद्द किया जा चुका है।
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-1.5">
                            {STEP_LABELS.map((lbl, idx) => (
                              <div
                                key={lbl}
                                className={`text-center py-1.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold border ${
                                  idx <= ord.statusStep
                                    ? 'bg-green-50 border-green-300 text-green-800'
                                    : 'bg-gray-50 border-gray-200 text-gray-400'
                                }`}
                              >
                                {idx <= ord.statusStep ? '✓ ' : `${idx + 1}. `}
                                {lbl}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1.5 text-xs">
                          {ord.items?.map((it) => (
                            <div key={it.id} className="bg-gray-50 rounded-xl px-3 py-2 flex justify-between gap-2">
                              <div>
                                <div className="font-bold text-gray-900">{it.titleSnapshot}</div>
                                <div className="text-[11px] text-gray-500">{it.detailsSnapshot}</div>
                              </div>
                              <div className="font-extrabold text-gray-800 shrink-0">₹{it.price}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'bookings' && data && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                  <h3 className="text-base font-extrabold text-gray-900">मेरी पंडित जी बुकिंग्स</h3>
                  {data.panditBookings.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center">अभी कोई पंडित बुकिंग नहीं है।</p>
                  ) : (
                    data.panditBookings.map((b) => (
                      <div key={b.id} className="border border-orange-200 bg-cream rounded-2xl p-4 text-xs space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-extrabold text-gray-900">{b.panditName || b.listingTitle}</div>
                          <span className="px-2.5 py-0.5 rounded-full font-extrabold bg-white border border-orange-300 text-saffron uppercase text-[10px]">
                            {b.status}
                          </span>
                        </div>
                        <div className="font-bold text-gray-800">पूजा: {b.pujaType}</div>
                        <div className="text-gray-600">
                          📅 तिथि: <b>{b.pujaDate}</b> • ⏰ {b.muhurat} • 📍 {b.location}
                        </div>
                        {b.panditPhone && (
                          <div className="text-gray-700 font-semibold">📞 पंडित जी संपर्क: {b.panditPhone}</div>
                        )}
                        {b.panditNotes && (
                          <div className="bg-white border border-amber-200 rounded-xl p-2.5 text-amber-950 font-semibold mt-1">
                            📝 पंडित जी का संदेश: {b.panditNotes}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'subscriptions' && data && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                  <h3 className="text-base font-extrabold text-gray-900">मासिक पूजा किट सब्सक्रिप्शन</h3>
                  {data.subscriptions.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center">कोई सक्रिय सब्सक्रिप्शन नहीं है।</p>
                  ) : (
                    data.subscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className="border border-gray-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-extrabold text-gray-900 text-sm">{sub.listingTitle}</div>
                          <div className="text-gray-600 mt-0.5">
                            {sub.cycle} • अगली डिलीवरी: <b>{sub.nextDeliveryDate}</b> • ₹{sub.price}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-saffron font-extrabold uppercase text-[10px]">
                            {sub.status}
                          </span>
                          {sub.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => void handleSubStatus(sub.id, 'paused')}
                              className="px-2.5 py-1 rounded-lg border border-gray-300 font-bold hover:bg-gray-100 cursor-pointer"
                            >
                              रोकें
                            </button>
                          )}
                          {sub.status === 'paused' && (
                            <button
                              type="button"
                              onClick={() => void handleSubStatus(sub.id, 'active')}
                              className="px-2.5 py-1 rounded-lg bg-green-600 text-white font-bold cursor-pointer"
                            >
                              पुनः चालू करें
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'custom_lists' && data && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                  <h3 className="text-base font-extrabold text-gray-900">अपलोड की गई कस्टम पूजा लिस्ट</h3>
                  {data.customLists.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center">अभी कोई कस्टम पर्ची अपलोड नहीं की गई है।</p>
                  ) : (
                    data.customLists.map((cl) => (
                      <div key={cl.id} className="border border-gray-200 rounded-2xl p-4 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-extrabold text-sm text-gray-900">
                            {cl.pujaName} {cl.orderId ? `(#${cl.orderId})` : ''}
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-saffron border border-orange-200 font-extrabold">
                            ₹{cl.quotedPrice || 299} • {cl.status}
                          </span>
                        </div>
                        {cl.filePath && (
                          <a
                            href={cl.filePath}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block text-abhiRed font-bold hover:underline"
                          >
                            📎 अपलोड की गई पर्ची देखें ({cl.fileName || 'फाइल'})
                          </a>
                        )}
                        {cl.manualItemsJson && cl.manualItemsJson.length > 0 && (
                          <div className="text-gray-600">
                            सामग्री: {cl.manualItemsJson.map((m) => `${m.name} (${m.qty})`).join(', ')}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'donations' && data && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                  <h3 className="text-base font-extrabold text-gray-900">मेरी सेवा दक्षिणा रसीदें</h3>
                  {data.donations.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center">अभी कोई दक्षिणा रसीद उपलब्ध नहीं है।</p>
                  ) : (
                    data.donations.map((don) => (
                      <div
                        key={don.id}
                        className="border border-orange-200 bg-cream rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-extrabold text-gray-900 text-sm">
                            {don.cause} — ₹{don.amount}
                          </div>
                          <div className="text-gray-500">
                            रसीद #{don.id} • {new Date(don.createdAt).toLocaleDateString('hi-IN')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenReceipt(don)}
                          className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-3 py-1.5 rounded-xl cursor-pointer"
                        >
                          रसीद देखें / प्रिंट
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'wishlist' && data && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-base font-extrabold text-gray-900 mb-3">मेरी सेव की गई विशलिस्ट</h3>
                  {data.wishlistListings.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center">विशलिस्ट खाली है।</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {data.wishlistListings.map((item) => (
                        <div key={item.id} className="border border-gray-200 rounded-2xl p-3 flex gap-3 items-center">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-100"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-extrabold text-gray-900 truncate">{item.title}</div>
                            <div className="text-xs font-extrabold text-abhiRed mt-0.5">₹{item.basePrice}</div>
                            <button
                              type="button"
                              onClick={async () => {
                                onToggleWishlist(item.id);
                                setTimeout(() => void loadDashboard(), 400);
                              }}
                              className="text-[11px] font-bold text-gray-500 hover:text-abhiRed mt-1 cursor-pointer"
                            >
                              हटाएं
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'addresses' && data && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
                  <h3 className="text-base font-extrabold text-gray-900">मेरे डिलीवरी पते</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.addresses.map((a) => (
                      <div key={a.id} className="border border-gray-200 rounded-2xl p-3.5 text-xs relative">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-abhiRed">{a.label}</span>
                          <button
                            type="button"
                            onClick={() => void handleDeleteAddress(a.id)}
                            className="text-gray-400 hover:text-red-600 cursor-pointer"
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                        <div className="font-bold text-gray-900">{a.name} ({a.phone})</div>
                        <div className="text-gray-600 mt-0.5">
                          {a.addressLine}, {a.city} {a.pincode}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddAddress} className="border-t border-gray-100 pt-4 space-y-3 text-xs">
                    <h4 className="font-extrabold text-gray-900">नया पता जोड़ें</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        value={addrLabel}
                        onChange={(e) => setAddrLabel(e.target.value)}
                        placeholder="लेबल (घर / ऑफिस)"
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                      <input
                        type="text"
                        required
                        value={addrName}
                        onChange={(e) => setAddrName(e.target.value)}
                        placeholder="पूरा नाम *"
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                      <input
                        type="tel"
                        required
                        value={addrPhone}
                        onChange={(e) => setAddrPhone(e.target.value)}
                        placeholder="मोबाइल नंबर *"
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      value={addrLine}
                      onChange={(e) => setAddrLine(e.target.value)}
                      placeholder="मकान नं., गली, मोहल्ला *"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2"
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={addrCity}
                        onChange={(e) => setAddrCity(e.target.value)}
                        placeholder="शहर"
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                      <input
                        type="text"
                        value={addrPin}
                        onChange={(e) => setAddrPin(e.target.value)}
                        placeholder="पिनकोड"
                        className="border border-gray-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-saffron hover:bg-orange-600 text-white font-extrabold px-5 py-2 rounded-xl cursor-pointer"
                    >
                      पता सेव करें
                    </button>
                  </form>
                </div>
              )}

              {tab === 'notifications' && data && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-gray-900">मेरी सूचनाएं</h3>
                    <button
                      type="button"
                      onClick={() => void handleReadAllNotifs()}
                      className="text-xs font-extrabold text-abhiRed hover:underline cursor-pointer"
                    >
                      सभी पढ़ी हुई मार्क करें
                    </button>
                  </div>
                  {data.notifications.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center">कोई सूचना नहीं है।</p>
                  ) : (
                    data.notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-xl p-3 border text-xs ${
                          n.isRead ? 'bg-white border-gray-200' : 'bg-orange-50 border-orange-200'
                        }`}
                      >
                        <div className="font-extrabold text-gray-900">{n.title}</div>
                        <div className="text-gray-600 mt-0.5">{n.body}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'profile' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <form
                    onSubmit={handleSaveProfile}
                    className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 text-xs"
                  >
                    <h3 className="text-sm font-extrabold text-gray-900">व्यक्तिगत विवरण</h3>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">पूरा नाम</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">मोबाइल नंबर</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-4 py-2 rounded-xl cursor-pointer"
                    >
                      प्रोफ़ाइल सेव करें
                    </button>
                  </form>

                  <form
                    onSubmit={handleChangePassword}
                    className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 text-xs"
                  >
                    <h3 className="text-sm font-extrabold text-gray-900">पासवर्ड व सुरक्षा</h3>
                    <input
                      type="password"
                      value={currPw}
                      onChange={(e) => setCurrPw(e.target.value)}
                      placeholder="वर्तमान पासवर्ड"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2"
                    />
                    <input
                      type="password"
                      required
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="नया पासवर्ड (8+ अक्षर, letter + number)"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-gray-900 hover:bg-black text-white font-extrabold px-4 py-2 rounded-xl cursor-pointer"
                      >
                        पासवर्ड बदलें
                      </button>
                      <button
                        type="button"
                        onClick={() => void onLogout(true)}
                        className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-extrabold px-4 py-2 rounded-xl cursor-pointer"
                      >
                        सभी डिवाइस से लॉगआउट
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
