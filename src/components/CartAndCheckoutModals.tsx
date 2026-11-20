import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { CartItem, Listing, SiteSettings, UserAddress, UserProfile } from '../types/puja';
import { getBoxCalculatedPrice } from './ListingCard';

interface CartDrawerProps {
  isOpen: boolean;
  cart: CartItem[];
  user: UserProfile | null;
  addresses: UserAddress[];
  settings: SiteSettings;
  onClose: () => void;
  onRemoveItem: (id: number) => void;
  onRequireAuth: (pendingAction: () => void) => void;
  onOrderCreated: (orderId: string, summaryMsg: string) => void;
  showToast: (msg: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  cart,
  user,
  addresses,
  settings,
  onClose,
  onRemoveItem,
  onRequireAuth,
  onOrderCreated,
  showToast,
}) => {
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
    label: string;
  } | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'COD'>('UPI');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const defAddr = addresses.find((a) => a.isDefault) || addresses[0];
    if (defAddr) {
      setCustName(defAddr.name);
      setCustPhone(defAddr.phone);
      setCustAddress(
        [defAddr.addressLine, defAddr.city, defAddr.pincode].filter(Boolean).join(', ')
      );
    } else if (user) {
      setCustName((prev) => prev || user.name);
      setCustPhone((prev) => prev || user.phone || '');
    }
  }, [addresses, user, isOpen]);

  if (!isOpen) return null;

  const subtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.qty, 0);
  const discount = appliedPromo ? Math.min(appliedPromo.discountAmount, subtotal) : 0;
  const grandTotal = Math.max(0, subtotal - discount);

  const handleApplyPromo = async () => {
    setPromoErr(null);
    if (!promoInput.trim()) return;
    try {
      const data = await apiFetch<{ code: string; discountAmount: number; label: string }>(
        '/api/promo/validate',
        {
          method: 'POST',
          body: JSON.stringify({ subtotal, code: promoInput }),
        }
      );
      setAppliedPromo(data);
      showToast(`कूपन ${data.code} लागू हुआ!`);
    } catch (err: unknown) {
      setAppliedPromo(null);
      setPromoErr(err instanceof Error ? err.message : 'अमान्य कोड');
    }
  };

  const placeOrderNow = async () => {
    setSubmitting(true);
    try {
      const data = await apiFetch<{ order: { id: string; total: number } }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'cart',
          customerName: custName,
          phone: custPhone,
          addressLine: custAddress,
          paymentMethod,
          promoCode: appliedPromo?.code || null,
        }),
      });
      setAppliedPromo(null);
      setPromoInput('');
      onOrderCreated(
        data.order.id,
        `धन्यवाद ${custName}! PujaJunction.com पर आपका ₹${data.order.total} का ऑर्डर "${custAddress}" के लिए कन्फर्म हो गया है।`
      );
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'ऑर्डर कन्फर्म नहीं हो सका।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth(() => {
        // After login & cart merge, reopen cart drawer so user confirms cleanly
        showToast('लॉगिन सफल! अब अपना ऑर्डर कन्फर्म करें।');
      });
      return;
    }
    void placeOrderNow();
  };

  const whatsappText = `🙏 *नया पूजा ऑर्डर - PujaJunction.com*\n\n*नाम:* ${custName || 'ग्राहक'}\n*मोबाइल:* ${custPhone || 'N/A'}\n*पता:* ${custAddress || 'N/A'}\n\n*आइटम्स:*\n${cart
    .map((c) => `• ${c.title} (₹${c.unitPrice * c.qty}) - ${c.details}`)
    .join('\n')}\n\n*कुल देय राशि:* ₹${grandTotal}`;
  const whatsappHref = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
    whatsappText
  )}`;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-cream">
          <h3 className="text-lg font-extrabold text-gray-900">आपका पूजा कार्ट ({cart.length})</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 box-scroll">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2">🛒</div>
              <p className="text-sm font-bold text-gray-700">आपका कार्ट अभी खाली है</p>
              <p className="text-xs text-gray-400 mt-1">अपनी पसंद का पूजा बॉक्स या पंडित जी चुनें</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="bg-cream border border-orange-200/80 rounded-xl p-3.5 relative"
              >
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-abhiRed text-xs cursor-pointer"
                  aria-label="हटाएं"
                >
                  <i className="fa-solid fa-trash" />
                </button>
                <div className="text-[11px] text-saffron font-bold mb-0.5">{item.vendorName}</div>
                <h4 className="text-sm font-extrabold text-gray-900 pr-5">{item.title}</h4>
                <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">{item.details}</p>
                <div className="text-right font-extrabold text-base text-gray-900 mt-2">
                  ₹{item.unitPrice * item.qty}
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 max-h-[60vh] overflow-y-auto box-scroll">
            {/* Promo Code Box */}
            <div className="mb-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="प्रोमो कोड (GANESH10 या PUJA51)"
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-xs font-extrabold uppercase bg-white focus:outline-none focus:border-abhiRed"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="bg-gray-900 hover:bg-black text-white px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  लागू करें
                </button>
              </div>
              {appliedPromo && (
                <div className="text-[11px] font-bold text-green-700 mt-1">
                  ✓ कूपन {appliedPromo.code} लागू ({appliedPromo.label}: -₹{discount})
                </div>
              )}
              {promoErr && (
                <div className="text-[11px] font-bold text-abhiRed mt-1">{promoErr}</div>
              )}
            </div>

            <div className="space-y-1 text-xs mb-3 bg-white p-3 rounded-xl border border-gray-200">
              <div className="flex justify-between text-gray-600">
                <span>उप-योग (Subtotal):</span>
                <span className="font-bold">₹{subtotal}</span>
              </div>
              {discount > 0 && appliedPromo && (
                <div className="flex justify-between text-green-700 font-bold">
                  <span>कूपन छूट ({appliedPromo.code}):</span>
                  <span>-₹{discount}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-gray-100 text-sm font-extrabold text-gray-900">
                <span>कुल देय राशि:</span>
                <span className="text-xl text-abhiRed">₹{grandTotal}</span>
              </div>
            </div>

            {addresses.length > 0 && (
              <div className="mb-2">
                <select
                  onChange={(e) => {
                    const addr = addresses.find((a) => a.id === Number(e.target.value));
                    if (addr) {
                      setCustName(addr.name);
                      setCustPhone(addr.phone);
                      setCustAddress(
                        [addr.addressLine, addr.city, addr.pincode].filter(Boolean).join(', ')
                      );
                    }
                  }}
                  className="w-full border border-orange-200 rounded-xl px-2.5 py-1.5 text-xs font-bold bg-orange-50/70 text-gray-800"
                >
                  <option value="">📍 सेव किया गया पता चुनें ({addresses.length})</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}: {a.addressLine} ({a.pincode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-2 text-sm">
              <input
                type="text"
                required
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                placeholder="आपका पूरा नाम *"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-abhiRed"
              />
              <input
                type="tel"
                required
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                placeholder="मोबाइल / WhatsApp नंबर *"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-abhiRed"
              />
              <input
                type="text"
                required
                value={custAddress}
                onChange={(e) => setCustAddress(e.target.value)}
                placeholder="पूरा डिलीवरी पता / पिनकोड *"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-abhiRed"
              />

              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`py-2 rounded-xl border cursor-pointer ${
                    paymentMethod === 'UPI'
                      ? 'border-abhiRed bg-red-50 text-abhiRed'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  💳 UPI भुगतान
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`py-2 rounded-xl border cursor-pointer ${
                    paymentMethod === 'COD'
                      ? 'border-abhiRed bg-red-50 text-abhiRed'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  💵 Cash on Delivery
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-xs transition text-center block"
                >
                  <i className="fa-brands fa-whatsapp mr-1" />
                  WhatsApp पर भेजें
                </a>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer"
                >
                  {submitting
                    ? 'कन्फर्म हो रहा है...'
                    : user
                    ? 'ऑर्डर कन्फर्म करें'
                    : 'लॉगिन कर ऑर्डर करें'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

interface DirectOrderModalProps {
  product: Listing | null;
  user: UserProfile | null;
  addresses: UserAddress[];
  settings: SiteSettings;
  onClose: () => void;
  onRequireAuth: (pendingAction: () => void) => void;
  onOrderCreated: (orderId: string, summaryMsg: string) => void;
  showToast: (msg: string) => void;
}

export const DirectOrderModal: React.FC<DirectOrderModalProps> = ({
  product,
  user,
  addresses,
  settings,
  onClose,
  onRequireAuth,
  onOrderCreated,
  showToast,
}) => {
  const [promoInput, setPromoInput] = useState('');
  const [promoResult, setPromoResult] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'COD'>('UPI');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPromoInput('');
    setPromoResult(null);
    setPromoErr(null);
    const defAddr = addresses.find((a) => a.isDefault) || addresses[0];
    if (defAddr) {
      setName(defAddr.name);
      setPhone(defAddr.phone);
      setPincode(defAddr.pincode || defAddr.city || '');
      setAddress(defAddr.addressLine);
    } else if (user) {
      setName((prev) => prev || user.name);
      setPhone((prev) => prev || user.phone || '');
    }
  }, [product, addresses, user]);

  if (!product) return null;

  const selectedItems = product.items.filter((i) => i.checked);
  const baseTotal = getBoxCalculatedPrice(product);
  const finalTotal = Math.max(0, baseTotal - (promoResult?.discountAmount || 0));
  const detailsText = selectedItems.map((i) => `${i.name} (x${i.qty})`).join(', ');

  const handleApplyPromo = async () => {
    setPromoErr(null);
    try {
      const data = await apiFetch<{ code: string; discountAmount: number }>('/api/promo/validate', {
        method: 'POST',
        body: JSON.stringify({ subtotal: baseTotal, code: promoInput }),
      });
      setPromoResult(data);
    } catch (err: unknown) {
      setPromoResult(null);
      setPromoErr(err instanceof Error ? err.message : 'अमान्य कोड');
    }
  };

  const executeOrder = async () => {
    setSubmitting(true);
    try {
      const data = await apiFetch<{ order: { id: string; total: number } }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'direct',
          customerName: name,
          phone,
          pincode,
          addressLine: address,
          paymentMethod,
          promoCode: promoResult?.code || null,
          directItem: {
            listingId: product.id,
            itemType: 'pooja_box',
            selectedItems: selectedItems.map((i) => ({
              id: i.id,
              name: i.name,
              qty: i.qty,
              price: i.price,
            })),
            subscriptionEnabled: Boolean(product.subscriptionEnabled),
            subscriptionCycle: product.subscriptionCycle,
          },
        }),
      });
      onOrderCreated(
        data.order.id,
        `धन्यवाद ${name}! PujaJunction.com पर आपका "${product.title}" (₹${data.order.total}) का ऑर्डर "${address}, ${pincode}" के लिए कन्फर्म हो गया है।`
      );
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'ऑर्डर बनाने में समस्या आई।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth(() => {
        showToast('लॉगिन सफल! अब अपना ऑर्डर कन्फर्म करें।');
      });
      return;
    }
    void executeOrder();
  };

  const waMsg = `🙏 *तुरंत पूजा ऑर्डर - PujaJunction.com*\n\n*किट:* ${product.title}\n*कुल राशि:* ₹${finalTotal}\n*नाम:* ${name || 'ग्राहक'}\n*मोबाइल:* ${phone || 'N/A'}\n*पता:* ${address || 'N/A'}, ${pincode}\n*सामग्री:* ${detailsText}`;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative my-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
        >
          <i className="fa-solid fa-xmark" />
        </button>
        <h3 className="text-base font-extrabold text-gray-900 mb-1">
          तुरंत बुकिंग (Express Checkout)
        </h3>
        <p className="text-xs text-gray-500 font-semibold mb-3">
          {product.title} • {product.vendor}
        </p>

        <div className="bg-cream border border-orange-200 rounded-xl p-3 mb-3 text-xs">
          <p className="text-gray-700 mb-2">चयनित सामग्री: {detailsText}</p>
          <div className="flex gap-1.5 mb-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="कूपन (GANESH10 / PUJA51)"
              className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-extrabold uppercase bg-white"
            />
            <button
              type="button"
              onClick={handleApplyPromo}
              className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
            >
              लागू
            </button>
          </div>
          {promoResult && (
            <div className="text-[11px] font-bold text-green-700 mb-1.5">
              ✓ {promoResult.code} लागू (-₹{promoResult.discountAmount})
            </div>
          )}
          {promoErr && <div className="text-[11px] font-bold text-abhiRed mb-1.5">{promoErr}</div>}
          <div className="flex justify-between items-center pt-1.5 border-t border-orange-100 font-extrabold text-sm text-gray-900">
            <span>कुल देय राशि:</span>
            <span className="text-abhiRed text-lg">₹{finalTotal}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 text-sm">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="आपका पूरा नाम *"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-abhiRed"
          />
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="मोबाइल नंबर *"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-abhiRed"
          />
          <input
            type="text"
            required
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            placeholder="जिला और पिनकोड *"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-abhiRed"
          />
          <input
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="मकान नंबर, पूरा पता *"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-abhiRed"
          />

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPaymentMethod('UPI')}
              className={`py-2 rounded-xl border cursor-pointer ${
                paymentMethod === 'UPI'
                  ? 'border-abhiRed bg-red-50 text-abhiRed'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              💳 UPI भुगतान
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('COD')}
              className={`py-2 rounded-xl border cursor-pointer ${
                paymentMethod === 'COD'
                  ? 'border-abhiRed bg-red-50 text-abhiRed'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              💵 Cash on Delivery
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(waMsg)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-xs transition text-center block"
            >
              <i className="fa-brands fa-whatsapp mr-1" />
              WhatsApp पर भेजें
            </a>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              {submitting ? 'कन्फर्म हो रहा है...' : 'अभी ऑर्डर कन्फर्म करें'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface OrderSuccessModalProps {
  orderId: string | null;
  message: string;
  onClose: () => void;
  onTrack: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  orderId,
  message,
  onClose,
  onTrack,
}) => {
  if (!orderId) return null;
  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl mx-auto mb-3">
          <i className="fa-solid fa-check" />
        </div>
        <h3 className="text-xl font-extrabold text-gray-900">
          बुकिंग / ऑर्डर सफलतापूर्वक कन्फर्म हो गया!
        </h3>
        <p className="text-sm text-gray-600 mt-1">{message}</p>
        <div className="text-xs font-extrabold text-abhiRed mt-2">
          बुकिंग ID: <span>#{orderId}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onTrack();
            }}
            className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer"
          >
            ऑर्डर ट्रैक करें
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-abhiRed hover:bg-abhiRedDark text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
          >
            ठीक है, जारी रखें
          </button>
        </div>
      </div>
    </div>
  );
};
