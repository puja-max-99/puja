import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import type {
  DonationRecord,
  Listing,
  NotificationItem,
  SubscriptionRecord,
  UserAddress,
  UserProfile,
} from '../types/puja';

interface AccountModalProps {
  isOpen: boolean;
  initialTab?: 'profile' | 'addresses' | 'wishlist' | 'subscriptions' | 'donations' | 'notifications';
  user: UserProfile | null;
  addresses: UserAddress[];
  wishlistListings: Listing[];
  subscriptions: SubscriptionRecord[];
  donations: DonationRecord[];
  notifications: NotificationItem[];
  onClose: () => void;
  onRefreshAccount: () => Promise<void>;
  onLogout: (allDevices?: boolean) => Promise<void>;
  onToggleWishlist: (listingId: number) => void;
  onOpenReceipt: (donation: DonationRecord) => void;
  showToast: (msg: string) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  initialTab = 'profile',
  user,
  addresses,
  wishlistListings,
  subscriptions,
  donations,
  notifications,
  onClose,
  onRefreshAccount,
  onLogout,
  onToggleWishlist,
  onOpenReceipt,
  showToast,
}) => {
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Address form
  const [addrLabel, setAddrLabel] = useState('घर');
  const [addrName, setAddrName] = useState(user?.name || '');
  const [addrPhone, setAddrPhone] = useState(user?.phone || '');
  const [addrLine, setAddrLine] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrPin, setAddrPin] = useState('');
  const [addrDefault, setAddrDefault] = useState(true);

  if (!isOpen || !user) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, phone }),
      });
      await onRefreshAccount();
      showToast('प्रोफ़ाइल सफलतापूर्वक अपडेट हो गई!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'अपडेट विफल रहा।');
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      await onRefreshAccount();
      showToast('✅ पासवर्ड सफलतापूर्वक सेव हो गया!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'पासवर्ड अपडेट विफल।');
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
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
          isDefault: addrDefault,
        }),
      });
      setAddrLine('');
      setAddrCity('');
      setAddrPin('');
      await onRefreshAccount();
      showToast('नया पता सेव हो गया!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'पता सेव नहीं हो सका।');
    }
  };

  const handleDeleteAddress = async (id: number) => {
    try {
      await apiFetch(`/api/addresses/${id}`, { method: 'DELETE' });
      await onRefreshAccount();
      showToast('पता हटा दिया गया।');
    } catch {
      showToast('पता हटाने में समस्या आई।');
    }
  };

  const handleSetDefaultAddress = async (id: number) => {
    try {
      await apiFetch(`/api/addresses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isDefault: true }),
      });
      await onRefreshAccount();
      showToast('डिफ़ॉल्ट पता अपडेट हुआ!');
    } catch {
      showToast('अपडेट विफल।');
    }
  };

  const handleUpdateSub = async (id: number, status: 'active' | 'paused' | 'cancelled') => {
    try {
      await apiFetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await onRefreshAccount();
      showToast('सब्सक्रिप्शन स्टेटस अपडेट हो गया।');
    } catch {
      showToast('अपडेट विफल।');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await apiFetch('/api/me', { method: 'DELETE' });
      await onLogout(false);
      onClose();
      showToast('आपका खाता हटा दिया गया है।');
    } catch {
      showToast('खाता हटाने में समस्या आई।');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      await onRefreshAccount();
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl relative my-8 max-h-[92vh] overflow-y-auto box-scroll">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-4 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-abhiRed to-saffron text-white flex items-center justify-center font-extrabold text-lg shrink-0 overflow-hidden">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-gray-900 truncate">{user.name}</h3>
            <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
              <span>{user.email}</span>
              <span className="bg-orange-100 text-saffron px-2 py-0.5 rounded-full font-bold uppercase text-[10px]">
                {user.role}
              </span>
              {user.googleId && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                  Google लिंक है
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Account Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-5 text-xs font-extrabold">
          {(
            [
              ['profile', '👤 प्रोफ़ाइल व सुरक्षा'],
              ['addresses', `📍 पता पुस्तिका (${addresses.length})`],
              ['wishlist', `❤️ विशलिस्ट (${wishlistListings.length})`],
              ['subscriptions', `🔄 सब्सक्रिप्शन (${subscriptions.length})`],
              ['donations', `🙏 दक्षिणा (${donations.length})`],
              ['notifications', `🔔 सूचनाएं (${notifications.filter((n) => !n.isRead).length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                tab === key
                  ? 'bg-abhiRed text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="space-y-5 text-xs sm:text-sm">
            <form
              onSubmit={handleSaveProfile}
              className="bg-cream border border-orange-200 rounded-xl p-4 space-y-3"
            >
              <h4 className="font-extrabold text-gray-900">व्यक्तिगत विवरण</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">पूरा नाम</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">मोबाइल नंबर</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold px-5 py-2 rounded-xl text-xs cursor-pointer"
              >
                प्रोफ़ाइल सेव करें
              </button>
            </form>

            <form
              onSubmit={handleSavePassword}
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3"
            >
              <h4 className="font-extrabold text-gray-900">
                {user.hasPassword ? 'पासवर्ड बदलें' : 'पासवर्ड सेट करें (Google खाते के लिए)'}
              </h4>
              {user.hasPassword && (
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="वर्तमान पासवर्ड *"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
                />
              )}
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="नया पासवर्ड (कम से कम 8 अक्षर, 1 letter + 1 अंक) *"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
              />
              <button
                type="submit"
                className="bg-gray-900 hover:bg-black text-white font-extrabold px-5 py-2 rounded-xl text-xs cursor-pointer"
              >
                पासवर्ड अपडेट करें
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => onLogout(true)}
                className="bg-orange-50 hover:bg-orange-100 text-saffron border border-saffron/30 font-extrabold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                सभी डिवाइस से लॉगआउट करें
              </button>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-abhiRed hover:underline font-extrabold text-xs cursor-pointer"
                >
                  खाता स्थायी रूप से हटाएं
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-xs">
                  <span className="font-bold text-red-800">पक्का हटाएं?</span>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="bg-abhiRed text-white px-2.5 py-1 rounded-lg font-extrabold cursor-pointer"
                  >
                    हां, हटाएं
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-gray-600 font-bold cursor-pointer"
                  >
                    नहीं
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'addresses' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {addresses.map((a) => (
                <div
                  key={a.id}
                  className="bg-cream border border-orange-200 rounded-xl p-3.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-gray-900">{a.label}</span>
                      {a.isDefault && (
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                          डिफ़ॉल्ट
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-gray-800">
                      {a.name} • {a.phone}
                    </div>
                    <div className="text-gray-600 mt-0.5">
                      {a.addressLine}
                      {a.city ? `, ${a.city}` : ''}
                      {a.pincode ? ` - ${a.pincode}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-2.5 pt-2 border-t border-orange-100 font-bold">
                    {!a.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultAddress(a.id)}
                        className="text-saffron hover:underline cursor-pointer"
                      >
                        डिफ़ॉल्ट बनाएं
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(a.id)}
                      className="text-abhiRed hover:underline cursor-pointer"
                    >
                      हटाएं
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddAddress}
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2.5"
            >
              <div className="font-extrabold text-gray-900">+ नया डिलीवरी पता जोड़ें</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={addrLabel}
                  onChange={(e) => setAddrLabel(e.target.value)}
                  placeholder="लेबल (घर / ऑफिस)"
                  className="border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
                />
                <input
                  type="text"
                  required
                  value={addrName}
                  onChange={(e) => setAddrName(e.target.value)}
                  placeholder="पूरा नाम *"
                  className="border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
                />
                <input
                  type="tel"
                  required
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                  placeholder="मोबाइल नंबर *"
                  className="border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
                />
              </div>
              <input
                type="text"
                required
                value={addrLine}
                onChange={(e) => setAddrLine(e.target.value)}
                placeholder="मकान नंबर, गली, मोहल्ला *"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  placeholder="शहर / जिला"
                  className="border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
                />
                <input
                  type="text"
                  value={addrPin}
                  onChange={(e) => setAddrPin(e.target.value)}
                  placeholder="पिनकोड"
                  className="border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
                />
              </div>
              <label className="flex items-center gap-2 font-bold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addrDefault}
                  onChange={(e) => setAddrDefault(e.target.checked)}
                  className="accent-abhiRed w-4 h-4"
                />
                <span>इसे डिफ़ॉल्ट पता बनाएं</span>
              </label>
              <button
                type="submit"
                className="bg-saffron hover:bg-orange-600 text-white font-extrabold px-5 py-2 rounded-xl cursor-pointer"
              >
                पता सेव करें
              </button>
            </form>
          </div>
        )}

        {tab === 'wishlist' && (
          <div className="space-y-2.5 text-xs">
            {wishlistListings.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-500">
                आपकी विशलिस्ट खाली है — किसी भी पूजा किट पर ❤️ क्लिक कर सेव करें।
              </div>
            ) : (
              wishlistListings.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 bg-cream border border-orange-200 rounded-xl p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-extrabold text-gray-900 truncate">{item.title}</div>
                      <div className="text-gray-500">{item.vendor} • ₹{item.basePrice}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(item.id)}
                    className="text-abhiRed hover:underline font-bold shrink-0 cursor-pointer"
                  >
                    हटाएं
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'subscriptions' && (
          <div className="space-y-2.5 text-xs">
            {subscriptions.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-500">
                अभी कोई सक्रिय मासिक पूजा सब्सक्रिप्शन नहीं है। किसी भी किट पर 10% सब्सक्रिप्शन चुनकर ऑर्डर करें!
              </div>
            ) : (
              subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-cream border border-orange-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-extrabold text-gray-900">
                      {sub.listingTitle || `पूजा किट #${sub.listingId}`}
                    </div>
                    <div className="text-gray-600 mt-0.5">
                      अवधि: {sub.cycle} • अगली डिलीवरी: {sub.nextDeliveryDate} • ₹{sub.price}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-white border border-orange-200 font-extrabold uppercase text-[10px]">
                      {sub.status}
                    </span>
                    {sub.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateSub(sub.id, 'paused')}
                        className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                      >
                        रोकें (Pause)
                      </button>
                    )}
                    {sub.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateSub(sub.id, 'active')}
                        className="bg-green-100 text-green-800 px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                      >
                        पुनः शुरू करें
                      </button>
                    )}
                    {sub.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateSub(sub.id, 'cancelled')}
                        className="text-abhiRed font-bold hover:underline cursor-pointer"
                      >
                        रद्द करें
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'donations' && (
          <div className="space-y-2.5 text-xs">
            {donations.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-500">
                अभी तक कोई सेवा दक्षिणा रिकॉर्ड नहीं है।
              </div>
            ) : (
              donations.map((d) => (
                <div
                  key={d.id}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-extrabold text-gray-900">
                      #{d.id} • {d.cause}
                    </div>
                    <div className="text-gray-600">
                      {new Date(d.createdAt).toLocaleDateString('hi-IN')} • ₹{d.amount}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenReceipt(d)}
                    className="bg-white border border-amber-300 text-amber-900 px-3 py-1 rounded-lg font-bold cursor-pointer"
                  >
                    रसीद देखें
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-2.5 text-xs">
            {notifications.some((n) => !n.isRead) && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={handleMarkAllNotificationsRead}
                  className="text-abhiRed font-extrabold hover:underline cursor-pointer"
                >
                  सभी को पढ़ा हुआ चिह्नित करें
                </button>
              </div>
            )}
            {notifications.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-500">
                कोई नई सूचना नहीं है।
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-xl p-3 border ${
                    n.isRead
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-orange-50/70 border-orange-200'
                  }`}
                >
                  <div className="font-extrabold text-gray-900">{n.title}</div>
                  <div className="text-gray-600 mt-0.5">{n.body}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
