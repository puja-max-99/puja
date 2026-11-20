import React, { useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch, setInMemoryAuthToken, setSessionToken } from '../lib/api';
import type { UserProfile } from '../types/puja';

export type PortalContext = 'user' | 'vendor' | 'pandit' | 'super_admin';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: 'login' | 'register' | 'forgot' | 'verify';
  portalContext?: PortalContext;
  pendingVerifyToken?: string | null;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile, verificationToken?: string | null) => void;
  showToast: (msg: string) => void;
}

const PORTAL_META: Record<
  PortalContext,
  { title: string; subtitle: string; icon: string; badge: string }
> = {
  user: {
    title: 'PujaJunction.com लॉगिन',
    subtitle: 'ऑर्डर ट्रैकिंग, पंडित बुकिंग, सब्सक्रिप्शन और यूज़र पैनल के लिए लॉगिन करें',
    icon: 'ॐ',
    badge: 'श्रद्धालु / User Portal',
  },
  vendor: {
    title: 'वेंडर स्टोर पैनल लॉगिन',
    subtitle: 'पूजा किट, स्टॉक, ऑर्डर, कूपन और पेआउट मैनेज करने के लिए लॉगिन करें',
    icon: '🏪',
    badge: 'WooCommerce Vendor Portal',
  },
  pandit: {
    title: 'पंडित जी पैनल लॉगिन',
    subtitle: 'अपनी लिस्टिंग प्रोफ़ाइल, पूजा सेवाएं, दक्षिणा और यजमान बुकिंग मैनेज करें',
    icon: '🙏',
    badge: 'Vedic Pandit Portal',
  },
  super_admin: {
    title: 'सुपर एडमिन कंट्रोल लॉगिन',
    subtitle: 'संपूर्ण वेबसाइट, वेंडर, पंडित जी, यूज़र्स, ऑर्डर और पेआउट का मास्टर नियंत्रण',
    icon: '🛡️',
    badge: 'Super Admin Master Portal',
  },
};

const QUICK_ACCOUNTS: Array<{
  role: PortalContext;
  label: string;
  email: string;
  password: string;
}> = [
  { role: 'super_admin', label: 'सुपर एडमिन', email: 'admin@pujajunction.com', password: 'Admin@1234' },
  { role: 'vendor', label: 'वेंडर स्टोर', email: 'vendor@pujajunction.com', password: 'Vendor@1234' },
  { role: 'pandit', label: 'पंडित जी', email: 'pandit@pujajunction.com', password: 'Pandit@1234' },
  { role: 'user', label: 'ग्राहक / User', email: 'user@pujajunction.com', password: 'User@1234' },
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialTab = 'login',
  portalContext = 'user',
  pendingVerifyToken = null,
  onClose,
  onAuthSuccess,
  showToast,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot' | 'reset' | 'verify'>(initialTab);
  const [accountType, setAccountType] = useState<'customer' | 'vendor' | 'pandit'>('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('Jamshedpur');
  const [experienceYears, setExperienceYears] = useState('8');
  const [education, setEducation] = useState('काशी वैदिक आचार्य / शास्त्री');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [generatedResetToken, setGeneratedResetToken] = useState<string | null>(null);
  const [verifyTokenInput, setVerifyTokenInput] = useState(pendingVerifyToken || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setErrorMsg(null);
      setInfoMsg(null);
      if (portalContext === 'vendor') setAccountType('vendor');
      else if (portalContext === 'pandit') setAccountType('pandit');
      else setAccountType('customer');
    }
  }, [isOpen, initialTab, portalContext]);

  useEffect(() => {
    if (pendingVerifyToken) setVerifyTokenInput(pendingVerifyToken);
  }, [pendingVerifyToken]);

  if (!isOpen) return null;

  const meta = PORTAL_META[portalContext] || PORTAL_META.user;

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();
      setInMemoryAuthToken(idToken);
      const data = await apiFetch<{ user: UserProfile; sessionToken?: string }>('/api/auth/google', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ idToken }),
      });
      if (data.sessionToken) setSessionToken(data.sessionToken, true);
      showToast(`🙏 स्वागत है, ${data.user.name}!`);
      onAuthSuccess(data.user, null);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google लॉगिन विफल रहा।';
      setErrorMsg(msg.includes('popup-closed') ? 'Google लॉगिन विंडो बंद कर दी गई।' : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ user: UserProfile; sessionToken?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, remember }),
      });
      if (data.sessionToken) setSessionToken(data.sessionToken, remember);
      showToast(`🙏 स्वागत है, ${data.user.name}!`);
      onAuthSuccess(data.user, null);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'लॉगिन विफल रहा।');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password !== confirmPassword) {
      setErrorMsg('पासवर्ड और कन्फर्म पासवर्ड मेल नहीं खा रहे हैं।');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{
        user: UserProfile;
        verificationToken?: string;
        sessionToken?: string;
      }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            phone,
            password,
            accountType,
            shopName: accountType === 'vendor' ? shopName : undefined,
            city: accountType !== 'customer' ? city : undefined,
            experienceYears: accountType === 'pandit' ? Number(experienceYears) || 5 : undefined,
            education: accountType === 'pandit' ? education : undefined,
          }),
        }
      );
      if (data.sessionToken) setSessionToken(data.sessionToken, true);
      showToast('खाता सफलतापूर्वक बन गया! कृपया ईमेल सत्यापित करें।');
      onAuthSuccess(data.user, data.verificationToken || null);
      if (data.verificationToken) {
        setVerifyTokenInput(data.verificationToken);
        setInfoMsg('आपका ईमेल सत्यापन कोड तैयार है। नीचे "ईमेल सत्यापित करें" पर क्लिक करें।');
        setTab('verify');
      } else {
        onClose();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'रजिस्ट्रेशन विफल रहा।');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ user: UserProfile }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verifyTokenInput }),
      });
      showToast('✅ आपका ईमेल सफलतापूर्वक सत्यापित हो गया!');
      onAuthSuccess(data.user, null);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'सत्यापन विफल रहा।');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ message: string; resetToken?: string | null }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setInfoMsg(data.message);
      if (data.resetToken) {
        setGeneratedResetToken(data.resetToken);
        setResetTokenInput(data.resetToken);
        setTab('reset');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'अनुरोध विफल रहा।');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password !== confirmPassword) {
      setErrorMsg('दोनों पासवर्ड एक जैसे होने चाहिए।');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetTokenInput, newPassword: password }),
      });
      showToast('✅ पासवर्ड बदल गया! अब नए पासवर्ड से लॉगिन करें।');
      setInfoMsg(data.message);
      setPassword('');
      setConfirmPassword('');
      setTab('login');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'पासवर्ड रीसेट विफल रहा।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative my-8 border border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
          aria-label="बंद करें"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-abhiRed to-saffron text-white flex items-center justify-center text-xl font-extrabold shadow-xs shrink-0">
            {meta.icon}
          </div>
          <div>
            <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-abhiRed bg-red-50 border border-red-200 px-2 py-0.5 rounded-md mb-0.5">
              {meta.badge}
            </span>
            <h3 className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">{meta.title}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">{meta.subtitle}</p>
          </div>
        </div>

        {(tab === 'login' || tab === 'register') && (
          <>
            <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-xl mb-4 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-lg transition cursor-pointer ${
                  tab === 'login' ? 'bg-abhiRed text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                लॉगिन करें
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-lg transition cursor-pointer ${
                  tab === 'register' ? 'bg-abhiRed text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                नया खाता बनाएं
              </button>
            </div>

            {tab === 'login' && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-extrabold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-2xs transition cursor-pointer mb-3 disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.94 0 3.51.68 4.75 1.81l3.48-3.48C18.14 1.38 15.32 0 12 0 7.31 0 3.25 2.69 1.28 6.6l4.06 3.15C6.31 6.86 8.92 5.04 12 5.04z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-1.99 3.72-4.93 3.72-8.69z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.34 14.25c-.24-.71-.38-1.47-.38-2.25s.14-1.54.38-2.25L1.28 6.6C.46 8.24 0 10.06 0 12s.46 3.76 1.28 5.4l4.06-3.15z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.08.72-2.45 1.16-4.23 1.16-3.08 0-5.69-1.82-6.66-4.46L1.28 18.07C3.25 21.31 7.31 24 12 24z"
                    />
                  </svg>
                  <span>Google (Gmail) से जारी रखें</span>
                </button>

                <div className="relative flex items-center justify-center my-3">
                  <div className="border-t border-gray-200 w-full" />
                  <span className="bg-white px-2.5 text-[11px] font-bold text-gray-400 shrink-0">
                    या ईमेल व पासवर्ड से लॉगिन
                  </span>
                  <div className="border-t border-gray-200 w-full" />
                </div>
              </>
            )}
          </>
        )}

        {errorMsg && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-3 py-2 text-xs font-bold">
            <i className="fa-solid fa-circle-exclamation mr-1.5" />
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="mb-3 bg-green-50 border border-green-200 text-green-800 rounded-xl px-3 py-2 text-xs font-bold">
            <i className="fa-solid fa-circle-check mr-1.5" />
            {infoMsg}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">ईमेल पता *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@pujajunction.com"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-abhiRed"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">पासवर्ड *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="अपना पासवर्ड दर्ज करें"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:border-abhiRed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-abhiRed w-4 h-4"
                />
                <span>मुझे याद रखें</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setTab('forgot');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="text-abhiRed font-bold hover:underline cursor-pointer"
              >
                पासवर्ड भूल गए?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-abhiRed hover:bg-abhiRedDark disabled:opacity-60 text-white font-extrabold py-2.5 rounded-xl shadow-sm transition cursor-pointer"
            >
              {loading ? 'सत्यापन हो रहा है...' : 'लॉगिन करें'}
            </button>

            {/* Quick Role Portal Fill (Real DB accounts with bcrypt login) */}
            <div className="pt-3 mt-2 border-t border-gray-100">
              <div className="text-[11px] font-bold text-gray-500 mb-2 flex items-center justify-between">
                <span>तेज़ पोर्टल टेस्ट लॉगिन (Real DB खाते):</span>
                <span className="text-[10px] text-gray-400">क्लिक कर भरें</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword(acc.password);
                      setErrorMsg(null);
                    }}
                    className={`text-left px-2.5 py-1.5 rounded-lg border text-[11px] transition cursor-pointer ${
                      email === acc.email
                        ? 'bg-orange-50 border-saffron text-gray-900 font-extrabold'
                        : 'bg-gray-50 hover:bg-orange-50/60 border-gray-200 text-gray-700 font-bold'
                    }`}
                  >
                    <div className="truncate">{acc.label}</div>
                    <div className="text-[10px] text-gray-500 font-mono truncate">{acc.email}</div>
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-2.5 text-xs sm:text-sm">
            {/* Role Account Type Chooser */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">खाता प्रकार चुनें *</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['customer', '👤 ग्राहक', 'User'],
                    ['vendor', '🏪 विक्रेता', 'Vendor'],
                    ['pandit', '🙏 पंडित जी', 'Pandit'],
                  ] as const
                ).map(([typeKey, label, sub]) => (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => setAccountType(typeKey)}
                    className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer ${
                      accountType === typeKey
                        ? 'bg-orange-50 border-abhiRed text-abhiRed font-extrabold shadow-2xs'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 font-bold'
                    }`}
                  >
                    <div className="text-xs leading-tight">{label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {accountType === 'pandit' ? 'पंडित जी का पूरा नाम *' : 'पूरा नाम *'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={accountType === 'pandit' ? 'जैसे: आचार्य पं. रामकृष्ण तिवारी' : 'जैसे: राजेश शर्मा'}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-abhiRed"
              />
            </div>

            {accountType === 'vendor' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-orange-50/70 border border-orange-200 rounded-xl p-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">दुकान / भंडार नाम *</label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="श्री गणेश पूजा भंडार"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-abhiRed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">शहर / लोकेशन *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Sakchi, Jamshedpur"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-abhiRed"
                  />
                </div>
              </div>
            )}

            {accountType === 'pandit' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-orange-50/70 border border-orange-200 rounded-xl p-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">शहर / क्षेत्र *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Jamshedpur / Varanasi"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-abhiRed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">अनुभव (वर्ष) *</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-abhiRed"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">गुरुकुल / शिक्षा</label>
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="काशी विश्वनाथ वैदिक परंपरा / शास्त्री"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-abhiRed"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ईमेल *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-abhiRed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">मोबाइल *</label>
                <input
                  type="tel"
                  required={accountType !== 'customer'}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-abhiRed"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                पासवर्ड * (8+ अक्षर, 1 letter व 1 अंक)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="कम से कम 8 अक्षर"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 pr-10 focus:outline-none focus:border-abhiRed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">पासवर्ड कन्फर्म करें *</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="पासवर्ड दोबारा लिखें"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-abhiRed"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-saffron hover:bg-orange-600 disabled:opacity-60 text-white font-extrabold py-2.5 rounded-xl shadow-sm transition cursor-pointer mt-1"
            >
              {loading
                ? 'खाता बन रहा है...'
                : accountType === 'vendor'
                ? 'वेंडर खाता बनाएं'
                : accountType === 'pandit'
                ? 'पंडित जी प्रोफ़ाइल बनाएं'
                : 'नया खाता बनाएं'}
            </button>
          </form>
        )}

        {tab === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-3 text-xs sm:text-sm">
            <h4 className="font-extrabold text-gray-900">पासवर्ड रीसेट करें</h4>
            <p className="text-xs text-gray-500">अपना पंजीकृत ईमेल पता दर्ज करें — हम आपको वन-टाइम रीसेट कोड देंगे।</p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="पंजीकृत ईमेल पता *"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-abhiRed"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold py-2.5 rounded-xl transition cursor-pointer"
            >
              {loading ? 'भेजा जा रहा है...' : 'रीसेट कोड प्राप्त करें'}
            </button>
            <button
              type="button"
              onClick={() => setTab('login')}
              className="w-full text-xs font-bold text-gray-600 hover:text-abhiRed cursor-pointer"
            >
              ← वापस लॉगिन पर जाएं
            </button>
          </form>
        )}

        {tab === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-3 text-xs sm:text-sm">
            <h4 className="font-extrabold text-gray-900">नया पासवर्ड सेट करें</h4>
            {generatedResetToken && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-950 font-semibold break-all">
                रीसेट कोड तैयार है (ऑटो-भरा गया)
              </div>
            )}
            <input
              type="text"
              required
              value={resetTokenInput}
              onChange={(e) => setResetTokenInput(e.target.value)}
              placeholder="रीसेट कोड *"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 font-mono text-xs focus:outline-none focus:border-abhiRed"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="नया पासवर्ड (8+ अक्षर, letter + number)"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-abhiRed"
            />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="नया पासवर्ड कन्फर्म करें"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-abhiRed"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-2.5 rounded-xl transition cursor-pointer"
            >
              {loading ? 'अपडेट हो रहा है...' : 'पासवर्ड अपडेट करें'}
            </button>
          </form>
        )}

        {tab === 'verify' && (
          <form onSubmit={handleVerifyEmail} className="space-y-3 text-xs sm:text-sm">
            <h4 className="font-extrabold text-gray-900">ईमेल सत्यापित करें</h4>
            <p className="text-xs text-gray-600">
              अपना ईमेल सत्यापित करने के लिए नीचे दिए गए बटन पर क्लिक करें (आपका सत्यापन टोकन 24 घंटे के लिए वैध है)।
            </p>
            <input
              type="text"
              required
              value={verifyTokenInput}
              onChange={(e) => setVerifyTokenInput(e.target.value)}
              placeholder="सत्यापन टोकन *"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 font-mono text-xs focus:outline-none focus:border-abhiRed"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-2.5 rounded-xl transition cursor-pointer"
            >
              {loading ? 'सत्यापित हो रहा है...' : '✅ ईमेल सत्यापित करें'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-xs font-bold text-gray-500 hover:text-gray-800 cursor-pointer"
            >
              बाद में सत्यापित करें
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
