import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type {
  PanditBookingRecord,
  PanditProfile,
  PayoutRequest,
  UserProfile,
} from '../../types/puja';

interface PanditDashboardPayload {
  profile: PanditProfile;
  linkedListing: {
    id: number;
    title: string;
    status: string;
    ratingAvg: number;
    basePrice: number;
    location: string;
  } | null;
  services: Array<{ id: number; label: string; price: number }>;
  bookings: PanditBookingRecord[];
  reviews: Array<{
    id: number;
    authorName: string;
    rating: number;
    comment: string;
    createdAt: string;
  }>;
  payouts: PayoutRequest[];
  stats: {
    totalBookings: number;
    upcomingBookings: number;
    completedBookings: number;
    totalCompletedPujas: number;
    servicesCount: number;
    grossDakshina: number;
    netDakshina: number;
    availableBalance: number;
    ratingAvg: number;
  };
}

interface PanditPanelPageProps {
  user: UserProfile | null;
  panditProfile: PanditProfile | null;
  onRequireLogin: () => void;
  onCatalogUpdated: () => Promise<void>;
  onAccountUpdated: () => Promise<void>;
  onOpenStorefront: () => void;
  showToast: (msg: string) => void;
}

const WEEK_DAYS = ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'];

export const PanditPanelPage: React.FC<PanditPanelPageProps> = ({
  user,
  panditProfile,
  onRequireLogin,
  onCatalogUpdated,
  onAccountUpdated,
  onOpenStorefront,
  showToast,
}) => {
  const [tab, setTab] = useState<
    'overview' | 'profile' | 'services' | 'bookings' | 'schedule' | 'payouts'
  >('overview');
  const [data, setData] = useState<PanditDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);

  // Pandit application state (for customer users)
  const [appName, setAppName] = useState(user?.name || '');
  const [appCity, setAppCity] = useState('Jamshedpur');
  const [appPhone, setAppPhone] = useState(user?.phone || '');
  const [appEdu, setAppEdu] = useState('काशी विश्वनाथ वैदिक आचार्य / शास्त्री');
  const [appExp, setAppExp] = useState('10');

  // Full Profile Editor state
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [experienceYears, setExperienceYears] = useState('10');
  const [education, setEducation] = useState('');
  const [languages, setLanguages] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [baseDakshina, setBaseDakshina] = useState('1100');
  const [onlinePuja, setOnlinePuja] = useState(true);
  const [travelAvail, setTravelAvail] = useState(true);
  const [availStatus, setAvailStatus] = useState<'available' | 'busy' | 'on_leave'>('available');
  const [availableDays, setAvailableDays] = useState<string[]>(WEEK_DAYS);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [upiId, setUpiId] = useState('');

  // Add Puja Service form
  const [svcLabel, setSvcLabel] = useState('');
  const [svcPrice, setSvcPrice] = useState('1100');

  // Booking notes map
  const [notesMap, setNotesMap] = useState<Record<number, string>>({});

  // Payout form
  const [payoutAmt, setPayoutAmt] = useState('');
  const [payoutUpi, setPayoutUpi] = useState('');

  const isPanditAccess =
    user?.role === 'pandit' || user?.role === 'super_admin' || user?.role === 'admin';

  const loadDashboard = useCallback(async () => {
    if (!user || !isPanditAccess) return;
    setLoading(true);
    try {
      const res = await apiFetch<PanditDashboardPayload>('/api/pandit/dashboard');
      setData(res);
      const p = res.profile;
      setFullName(p.fullName || '');
      setTitle(p.title || '');
      setPhone(p.phone || '');
      setCity(p.city || '');
      setServiceAreas((p.serviceAreasJson || []).join(', '));
      setExperienceYears(String(p.experienceYears ?? 5));
      setEducation(p.education || '');
      setLanguages((p.languagesJson || []).join(', '));
      setSpecializations((p.specializationsJson || []).join(', '));
      setBio(p.bio || '');
      setPhotoUrl(p.photoUrl || '');
      setBaseDakshina(String(p.baseDakshina ?? 1100));
      setOnlinePuja(Boolean(p.onlinePujaAvailable));
      setTravelAvail(Boolean(p.travelAvailable));
      setAvailStatus(
        p.availabilityStatus === 'busy' || p.availabilityStatus === 'on_leave'
          ? p.availabilityStatus
          : 'available'
      );
      setAvailableDays(p.availableDaysJson || WEEK_DAYS);
      setBlockedDates(p.blockedDatesJson || []);
      setUpiId(p.upiId || '');
      setPayoutUpi(p.upiId || '');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'पंडित पैनल लोड नहीं हो सका।');
    } finally {
      setLoading(false);
    }
  }, [user, isPanditAccess, showToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-12 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-saffron flex items-center justify-center text-2xl mb-4">
            <i className="fa-solid fa-hands-praying" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">पंडित जी पैनल (Listing Profile & Bookings)</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1.5 mb-5">
            अपनी वैदिक लिस्टिंग प्रोफ़ाइल, पूजा सेवाएं, दक्षिणा पैकेज, उपलब्धता कैलेंडर और यजमान बुकिंग्स मैनेज करने के लिए लॉगिन करें।
          </p>
          <button
            type="button"
            onClick={onRequireLogin}
            className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-6 py-2.5 rounded-xl text-sm shadow-sm cursor-pointer"
          >
            पंडित जी लॉगिन / पंजीकरण करें
          </button>
        </div>
      </div>
    );
  }

  if (!isPanditAccess) {
    const handleApply = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await apiFetch('/api/pandit/apply', {
          method: 'POST',
          body: JSON.stringify({
            fullName: appName,
            city: appCity,
            phone: appPhone,
            education: appEdu,
            experienceYears: Number(appExp) || 5,
          }),
        });
        await onAccountUpdated();
        showToast('✅ पंडित जी पंजीकरण सुपर एडमिन को भेज दिया गया है!');
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'आवेदन विफल रहा।');
      }
    };

    return (
      <div className="max-w-xl mx-auto my-10 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">🙏 वैदिक पंडित / आचार्य पंजीकरण</h2>
          <p className="text-xs text-gray-600 mb-4">
            {panditProfile
              ? `आपका प्रोफ़ाइल "${panditProfile.fullName}" स्थिति: ${panditProfile.status} (सुपर एडमिन वेरिफिकेशन के बाद लाइव होगा)।`
              : 'PujaJunction.com से जुड़ें और अपने शहर व ऑनलाइन यजमानों हेतु वैदिक पूजन सेवाएं प्रदान करें।'}
          </p>
          {!panditProfile && (
            <form onSubmit={handleApply} className="space-y-3 text-xs">
              <input
                type="text"
                required
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="पंडित जी का पूरा नाम *"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={appCity}
                  onChange={(e) => setAppCity(e.target.value)}
                  placeholder="शहर *"
                  className="border border-gray-300 rounded-xl px-3 py-2.5"
                />
                <input
                  type="tel"
                  required
                  value={appPhone}
                  onChange={(e) => setAppPhone(e.target.value)}
                  placeholder="मोबाइल नंबर *"
                  className="border border-gray-300 rounded-xl px-3 py-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={appEdu}
                  onChange={(e) => setAppEdu(e.target.value)}
                  placeholder="गुरुकुल / शिक्षा"
                  className="border border-gray-300 rounded-xl px-3 py-2.5"
                />
                <input
                  type="number"
                  min={1}
                  value={appExp}
                  onChange={(e) => setAppExp(e.target.value)}
                  placeholder="अनुभव (वर्ष)"
                  className="border border-gray-300 rounded-xl px-3 py-2.5"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold py-2.5 rounded-xl cursor-pointer"
              >
                पंडित जी आवेदन सबमिट करें
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      await apiFetch('/api/pandit/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          title,
          phone,
          city,
          serviceAreasJson: serviceAreas,
          experienceYears: Number(experienceYears) || 5,
          education,
          languagesJson: languages,
          specializationsJson: specializations,
          bio,
          photoUrl,
          baseDakshina: Number(baseDakshina) || 1100,
          onlinePujaAvailable: onlinePuja,
          travelAvailable: travelAvail,
          availabilityStatus: availStatus,
          availableDaysJson: availableDays,
          blockedDatesJson: blockedDates,
          upiId,
        }),
      });
      showToast('✅ पंडित जी लिस्टिंग प्रोफ़ाइल अपडेट व स्टोरफ्रंट से सिंक हो गई!');
      await Promise.all([loadDashboard(), onCatalogUpdated()]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'प्रोफ़ाइल सेव नहीं हो सकी।');
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/pandit/services', {
        method: 'POST',
        body: JSON.stringify({ label: svcLabel, price: Number(svcPrice) }),
      });
      setSvcLabel('');
      setSvcPrice('1100');
      showToast('✅ नई पूजा सेवा व दक्षिणा लाइव जुड़ गई!');
      await Promise.all([loadDashboard(), onCatalogUpdated()]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'सेवा जोड़ने में त्रुटि।');
    }
  };

  const handleDeleteService = async (variantId: number) => {
    await apiFetch(`/api/pandit/services/${variantId}`, { method: 'DELETE' });
    showToast('पूजा सेवा हटाई गई।');
    await Promise.all([loadDashboard(), onCatalogUpdated()]);
  };

  const handleUpdateBooking = async (
    id: number,
    status: 'confirmed' | 'completed' | 'rescheduled' | 'cancelled'
  ) => {
    try {
      await apiFetch(`/api/pandit/bookings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          panditNotes: notesMap[id] || undefined,
        }),
      });
      showToast('✅ यजमान बुकिंग अपडेट व ग्राहक को सूचित किया गया!');
      await loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'बुकिंग अपडेट विफल।');
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/pandit/payouts', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(payoutAmt), upiOrBank: payoutUpi }),
      });
      setPayoutAmt('');
      showToast('✅ दक्षिणा पेआउट अनुरोध भेज दिया गया।');
      await loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'पेआउट विफल।');
    }
  };

  const navItems: Array<{ id: typeof tab; label: string; icon: string; badge?: number }> = [
    { id: 'overview', label: 'मेरा प्रोफ़ाइल कार्ड', icon: 'fa-id-card' },
    { id: 'profile', label: 'प्रोफ़ाइल व परिचय एडिट', icon: 'fa-user-pen' },
    { id: 'services', label: 'पूजा सेवाएं व दक्षिणा', icon: 'fa-om', badge: data?.services.length },
    { id: 'bookings', label: 'यजमान बुकिंग्स', icon: 'fa-calendar-check', badge: data?.stats.upcomingBookings },
    { id: 'schedule', label: 'उपलब्धता व कैलेंडर', icon: 'fa-clock' },
    { id: 'payouts', label: 'दक्षिणा व समीक्षाएं', icon: 'fa-indian-rupee-sign' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Pandit Top Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <img
            src={data?.profile.photoUrl || 'https://placehold.co/100x100/fff3e0/dc3545?text=Pandit'}
            alt={data?.profile.fullName || 'Pandit Ji'}
            className="w-14 h-14 rounded-2xl object-cover border-2 border-saffron shadow-xs"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900">
                {data?.profile.fullName || user.name}
              </h2>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                  data?.profile.status === 'approved'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {data?.profile.status === 'approved' ? '✓ सत्यापित वैदिक आचार्य' : '⏳ वेरिफिकेशन प्रतीक्षारत'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {data?.profile.title} • 📍 {data?.profile.city} • {data?.profile.experienceYears}+ वर्ष अनुभव
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={availStatus}
            onChange={(e) => {
              const next = e.target.value as 'available' | 'busy' | 'on_leave';
              setAvailStatus(next);
              void apiFetch('/api/pandit/profile', {
                method: 'PATCH',
                body: JSON.stringify({ availabilityStatus: next }),
              }).then(() => showToast('उपलब्धता स्थिति अपडेट हुई।'));
            }}
            className="border border-orange-300 bg-orange-50 text-gray-900 font-extrabold rounded-xl px-3 py-2 cursor-pointer"
          >
            <option value="available">🟢 उपलब्ध (Available)</option>
            <option value="busy">🟡 व्यस्त (Busy)</option>
            <option value="on_leave">🔴 अवकाश पर (On Leave)</option>
          </select>
          <button
            type="button"
            onClick={onOpenStorefront}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-3.5 py-2 rounded-xl cursor-pointer"
          >
            ← वेबसाइट देखें
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
              पंडित जी पैनल लोड हो रहा है...
            </div>
          ) : (
            data && (
              <>
                {tab === 'overview' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">आगामी बुकिंग्स</div>
                        <div className="text-2xl font-extrabold text-abhiRed mt-1">{data.stats.upcomingBookings}</div>
                        <div className="text-[11px] text-gray-500 font-semibold mt-0.5">कुल: {data.stats.totalBookings}</div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">संपन्न अनुष्ठान</div>
                        <div className="text-2xl font-extrabold text-gray-900 mt-1">{data.stats.totalCompletedPujas}+</div>
                        <div className="text-[11px] text-amber-600 font-bold mt-0.5">★ {data.stats.ratingAvg} रेटिंग</div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">पूजा सेवाएं</div>
                        <div className="text-2xl font-extrabold text-saffron mt-1">{data.stats.servicesCount}</div>
                        <div className="text-[11px] text-gray-500 font-semibold mt-0.5">बेस दक्षिणा ₹{data.profile.baseDakshina}</div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="text-[11px] font-bold text-gray-500">उपलब्ध दक्षिणा</div>
                        <div className="text-2xl font-extrabold text-green-700 mt-1">₹{data.stats.availableBalance}</div>
                        <div className="text-[11px] text-gray-500 font-semibold mt-0.5">कुल: ₹{data.stats.grossDakshina}</div>
                      </div>
                    </div>

                    {/* Live Storefront Listing-Profile Preview Card */}
                    <div className="bg-white rounded-2xl border-2 border-orange-200 overflow-hidden shadow-sm">
                      <div className="bg-gradient-to-r from-abhiRed to-saffron text-white px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
                        <span>👁️ यजमानों को दिखने वाली आपकी लाइव लिस्टिंग प्रोफ़ाइल (Storefront Preview)</span>
                        <span className="bg-white/20 px-2.5 py-0.5 rounded-full">
                          लिस्टिंग स्थिति: {data.linkedListing?.status === 'active' ? 'LIVE' : 'Draft / Pending'}
                        </span>
                      </div>
                      <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                        <div className="md:col-span-4">
                          <img
                            src={data.profile.photoUrl}
                            alt={data.profile.fullName}
                            className="w-full h-48 object-cover rounded-2xl border border-orange-100 shadow-xs"
                          />
                          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-extrabold">
                            {data.profile.onlinePujaAvailable && (
                              <span className="bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-lg">
                                📹 ऑनलाइन वीडियो पूजा
                              </span>
                            )}
                            {data.profile.travelAvailable && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
                                🚗 घर आकर पूजन
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-xs">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="text-lg font-extrabold text-gray-900">
                                {data.profile.fullName}
                                {data.profile.isVerified && (
                                  <i className="fa-solid fa-circle-check text-blue-600 ml-1.5 text-sm" />
                                )}
                              </h3>
                              <div className="text-saffron font-bold mt-0.5">
                                {data.profile.title} • {data.profile.education}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-extrabold text-abhiRed">₹{data.profile.baseDakshina}+</div>
                              <div className="text-[11px] text-gray-500">प्रारंभिक दक्षिणा</div>
                            </div>
                          </div>

                          <p className="text-gray-700 leading-relaxed">{data.profile.bio}</p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-cream border border-orange-100 rounded-xl p-3">
                            <div>
                              <span className="font-extrabold text-gray-900">📍 सेवा क्षेत्र:</span>{' '}
                              {(data.profile.serviceAreasJson || [data.profile.city]).join(', ')}
                            </div>
                            <div>
                              <span className="font-extrabold text-gray-900">🗣️ भाषाएं:</span>{' '}
                              {(data.profile.languagesJson || []).join(', ')}
                            </div>
                            <div className="sm:col-span-2">
                              <span className="font-extrabold text-gray-900">🕉️ विशेषज्ञता:</span>{' '}
                              <span className="inline-flex flex-wrap gap-1 ml-1">
                                {(data.profile.specializationsJson || []).map((s) => (
                                  <span
                                    key={s}
                                    className="bg-white border border-orange-200 text-abhiRed px-2 py-0.5 rounded-md font-bold text-[11px]"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setTab('profile')}
                              className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-4 py-2 rounded-xl cursor-pointer"
                            >
                              ✏️ प्रोफ़ाइल एडिट करें
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab('services')}
                              className="bg-orange-50 hover:bg-orange-100 text-saffron border border-orange-200 font-extrabold px-4 py-2 rounded-xl cursor-pointer"
                            >
                              🕉️ पूजा सेवाएं व दक्षिणा मैनेज करें
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'profile' && (
                  <form
                    onSubmit={handleSaveProfile}
                    className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 text-xs"
                  >
                    <h3 className="text-base font-extrabold text-gray-900">
                      पंडित जी लिस्टिंग प्रोफ़ाइल व परिचय संपादन
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">पूरा नाम *</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">उपाधि / शीर्षक</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="काशी वैदिक आचार्य एवं ज्योतिष विद्वान"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">मोबाइल / WhatsApp *</label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">मुख्य शहर *</label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">अनुभव (वर्षों में)</label>
                        <input
                          type="number"
                          min={0}
                          max={70}
                          value={experienceYears}
                          onChange={(e) => setExperienceYears(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">प्रारंभिक दक्षिणा (₹)</label>
                        <input
                          type="number"
                          min={251}
                          value={baseDakshina}
                          onChange={(e) => setBaseDakshina(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">गुरुकुल / वैदिक शिक्षा</label>
                        <input
                          type="text"
                          value={education}
                          onChange={(e) => setEducation(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">UPI ID (दक्षिणा पेआउट हेतु)</label>
                        <input
                          type="text"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="panditji@upi"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-gray-700 mb-1">सेवा क्षेत्र (कॉमा से अलग लिखें)</label>
                        <input
                          type="text"
                          value={serviceAreas}
                          onChange={(e) => setServiceAreas(e.target.value)}
                          placeholder="Sakchi, Bistupur, Kadma, Sonari, Online Video"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">भाषाएं (कॉमा से अलग)</label>
                        <input
                          type="text"
                          value={languages}
                          onChange={(e) => setLanguages(e.target.value)}
                          placeholder="हिन्दी, संस्कृत, भोजपुरी, बंगाली"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">विशेष पूजाएं (कॉमा से अलग)</label>
                        <input
                          type="text"
                          value={specializations}
                          onChange={(e) => setSpecializations(e.target.value)}
                          placeholder="सत्यनारायण कथा, गृह प्रवेश, रुद्राभिषेक, विवाह"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-gray-700 mb-1">प्रोफ़ाइल फोटो URL</label>
                        <input
                          type="url"
                          value={photoUrl}
                          onChange={(e) => setPhotoUrl(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-gray-700 mb-1">परिचय / Bio</label>
                        <textarea
                          rows={3}
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-5 pt-1 font-bold text-gray-800">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={onlinePuja}
                          onChange={(e) => setOnlinePuja(e.target.checked)}
                          className="accent-abhiRed w-4 h-4"
                        />
                        <span>ऑनलाइन वीडियो कॉल पूजा उपलब्ध</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={travelAvail}
                          onChange={(e) => setTravelAvail(e.target.checked)}
                          className="accent-abhiRed w-4 h-4"
                        />
                        <span>यजमान के घर जाकर पूजा उपलब्ध</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-6 py-2.5 rounded-xl cursor-pointer"
                    >
                      प्रोफ़ाइल सेव व लाइव सिंक करें
                    </button>
                  </form>
                )}

                {tab === 'services' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900">मेरी पूजा सेवाएं व दक्षिणा पैकेज</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        यहाँ जोड़ी गई हर पूजा सेवा सीधे आपकी लाइव लिस्टिंग प्रोफ़ाइल में यजमानों को बुकिंग विकल्प के रूप में दिखेगी।
                      </p>
                    </div>

                    <form onSubmit={handleAddService} className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                      <input
                        type="text"
                        required
                        value={svcLabel}
                        onChange={(e) => setSvcLabel(e.target.value)}
                        placeholder="पूजा सेवा का नाम (जैसे: महामृत्युंजय जप व हवन)"
                        className="sm:col-span-7 border border-gray-300 rounded-xl px-3 py-2.5"
                      />
                      <input
                        type="number"
                        required
                        min={251}
                        value={svcPrice}
                        onChange={(e) => setSvcPrice(e.target.value)}
                        placeholder="दक्षिणा (₹)"
                        className="sm:col-span-3 border border-gray-300 rounded-xl px-3 py-2.5"
                      />
                      <button
                        type="submit"
                        className="sm:col-span-2 bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold rounded-xl px-3 py-2.5 cursor-pointer"
                      >
                        + जोड़ें
                      </button>
                    </form>

                    <div className="space-y-2 text-xs">
                      {data.services.map((s) => (
                        <div
                          key={s.id}
                          className="border border-orange-200 bg-cream rounded-xl p-3.5 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-extrabold text-gray-900 text-sm">{s.label}</div>
                            <div className="text-saffron font-bold">दक्षिणा: ₹{s.price}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDeleteService(s.id)}
                            className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 font-extrabold hover:bg-red-50 cursor-pointer"
                          >
                            हटाएं
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'bookings' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <h3 className="text-base font-extrabold text-gray-900">यजमान बुकिंग्स प्रबंधन</h3>
                    {data.bookings.length === 0 ? (
                      <p className="text-xs text-gray-500 py-8 text-center">अभी कोई यजमान बुकिंग प्राप्त नहीं हुई है।</p>
                    ) : (
                      data.bookings.map((b) => (
                        <div key={b.id} className="border border-gray-200 rounded-2xl p-4 text-xs space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-sm text-gray-900">
                                {b.pujaType} <span className="text-gray-500">(#{b.orderId})</span>
                              </div>
                              <div className="text-gray-600 mt-0.5">
                                यजमान: <b>{b.customerName || 'श्रद्धालु'}</b>{' '}
                                {b.customerPhone ? `(${b.customerPhone})` : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-extrabold text-abhiRed">₹{b.dakshinaAmount || data.profile.baseDakshina}</div>
                              <span className="inline-block px-2.5 py-0.5 rounded-full bg-orange-50 text-saffron font-extrabold uppercase text-[10px]">
                                {b.status}
                              </span>
                            </div>
                          </div>

                          <div className="bg-cream border border-orange-100 rounded-xl p-2.5 text-gray-700">
                            📅 तिथि: <b>{b.pujaDate}</b> • ⏰ मुहूर्त: {b.muhurat} • 📍 स्थान: {b.location}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={notesMap[b.id] ?? b.panditNotes ?? ''}
                              onChange={(e) => setNotesMap((p) => ({ ...p, [b.id]: e.target.value }))}
                              placeholder="संकल्प / तैयारी हेतु यजमान को संदेश लिखें..."
                              className="flex-1 border border-gray-300 rounded-xl px-3 py-1.5"
                            />
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleUpdateBooking(b.id, 'confirmed')}
                                className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-extrabold cursor-pointer"
                              >
                                कन्फर्म
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleUpdateBooking(b.id, 'completed')}
                                className="px-3 py-1.5 rounded-xl bg-green-600 text-white font-extrabold cursor-pointer"
                              >
                                ✓ संपन्न (Complete)
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleUpdateBooking(b.id, 'cancelled')}
                                className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200 font-extrabold cursor-pointer"
                              >
                                रद्द
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'schedule' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5 text-xs">
                    <h3 className="text-base font-extrabold text-gray-900">साप्ताहिक उपलब्धता एवं अवकाश तिथियां</h3>
                    <div>
                      <div className="font-bold text-gray-700 mb-2">उपलब्ध दिवस चुनें:</div>
                      <div className="flex flex-wrap gap-2">
                        {WEEK_DAYS.map((day) => {
                          const active = availableDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() =>
                                setAvailableDays((prev) =>
                                  active ? prev.filter((d) => d !== day) : [...prev, day]
                                )
                              }
                              className={`px-3.5 py-2 rounded-xl font-extrabold border cursor-pointer ${
                                active
                                  ? 'bg-abhiRed text-white border-abhiRed'
                                  : 'bg-white text-gray-600 border-gray-300'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4 space-y-2.5">
                      <div className="font-bold text-gray-700">व्यस्त / ब्लॉक तिथियां (Blocked Dates):</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={newBlockedDate}
                          onChange={(e) => setNewBlockedDate(e.target.value)}
                          className="border border-gray-300 rounded-xl px-3 py-2"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newBlockedDate && !blockedDates.includes(newBlockedDate)) {
                              setBlockedDates((p) => [...p, newBlockedDate]);
                              setNewBlockedDate('');
                            }
                          }}
                          className="bg-gray-900 text-white font-extrabold px-4 py-2 rounded-xl cursor-pointer"
                        >
                          + तिथि ब्लॉक करें
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {blockedDates.map((d) => (
                          <span
                            key={d}
                            className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full font-bold"
                          >
                            {d}
                            <button
                              type="button"
                              onClick={() => setBlockedDates((p) => p.filter((x) => x !== d))}
                              className="cursor-pointer font-extrabold"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSaveProfile()}
                      className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-6 py-2.5 rounded-xl cursor-pointer"
                    >
                      कैलेंडर सेव करें
                    </button>
                  </div>
                )}

                {tab === 'payouts' && (
                  <div className="space-y-5">
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 text-xs">
                      <h3 className="text-base font-extrabold text-gray-900">दक्षिणा पेआउट अनुरोध</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-cream border border-orange-200 rounded-xl p-3.5">
                          <div className="text-gray-600 font-bold">कुल दक्षिणा</div>
                          <div className="text-xl font-extrabold text-gray-900 mt-0.5">₹{data.stats.grossDakshina}</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3.5">
                          <div className="text-gray-600 font-bold">शुद्ध दक्षिणा</div>
                          <div className="text-xl font-extrabold text-green-700 mt-0.5">₹{data.stats.netDakshina}</div>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5">
                          <div className="text-gray-600 font-bold">निकासी योग्य</div>
                          <div className="text-xl font-extrabold text-abhiRed mt-0.5">₹{data.stats.availableBalance}</div>
                        </div>
                      </div>

                      <form onSubmit={handleRequestPayout} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                          placeholder="UPI ID / बैंक विवरण"
                          className="border border-gray-300 rounded-xl px-3 py-2"
                        />
                        <button
                          type="submit"
                          className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold rounded-xl px-4 py-2 cursor-pointer"
                        >
                          दक्षिणा निकासी अनुरोध
                        </button>
                      </form>

                      <div className="space-y-2">
                        {data.payouts.map((p) => (
                          <div key={p.id} className="border border-gray-200 rounded-xl p-3 flex justify-between items-center">
                            <div>
                              <div className="font-extrabold text-gray-900">₹{p.amount} → {p.upiOrBank}</div>
                              <div className="text-gray-500">{p.adminNote || new Date(p.createdAt).toLocaleDateString('hi-IN')}</div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-saffron font-extrabold uppercase text-[10px]">
                              {p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 text-xs">
                      <h3 className="text-base font-extrabold text-gray-900">यजमान समीक्षाएं</h3>
                      {data.reviews.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">अभी कोई यजमान समीक्षा नहीं।</p>
                      ) : (
                        data.reviews.map((r) => (
                          <div key={r.id} className="border border-gray-200 rounded-xl p-3">
                            <div className="flex justify-between font-extrabold">
                              <span>{r.authorName}</span>
                              <span className="text-amber-500">{'★'.repeat(r.rating)}</span>
                            </div>
                            <p className="text-gray-700 mt-1">{r.comment}</p>
                          </div>
                        ))
                      )}
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
