import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type {
  DonationRecord,
  Listing,
  ListingReview,
  OrderRecord,
  SiteSettings,
  UserAddress,
  UserProfile,
} from '../types/puja';

// ==================== TRACKING & BOOKING HISTORY MODAL ====================

interface TrackingModalProps {
  isOpen: boolean;
  orders: OrderRecord[];
  donations: DonationRecord[];
  user: UserProfile | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onCancelOrder: (orderId: string) => Promise<void>;
  onOpenReceipt: (donation: DonationRecord) => void;
}

const STEPS = ['ऑर्डर प्राप्त', 'सामग्री पैकिंग / संकल्प', 'डिस्पैच / मार्ग में', 'पूर्ण / डिलीवर्ड'];

export const TrackingModal: React.FC<TrackingModalProps> = ({
  isOpen,
  orders,
  donations,
  user,
  onClose,
  onRequireAuth,
  onCancelOrder,
  onOpenReceipt,
}) => {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto box-scroll">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
        >
          <i className="fa-solid fa-xmark" />
        </button>
        <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-1">
          📦 मेरी बुकिंग्स एवं लाइव ऑर्डर ट्रैकिंग
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          आपके सभी पूजा किट ऑर्डर, पंडित बुकिंग और सेवा दक्षिणा रसीदों का विवरण
        </p>

        {!user ? (
          <div className="text-center py-10 bg-cream border border-orange-200 rounded-2xl">
            <div className="text-4xl mb-2">🔐</div>
            <p className="text-sm font-extrabold text-gray-800">
              अपनी बुकिंग्स और ऑर्डर ट्रैक करने के लिए लॉगिन करें
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequireAuth();
              }}
              className="mt-3 bg-abhiRed hover:bg-abhiRedDark text-white px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer"
            >
              लॉगिन / साइन अप करें
            </button>
          </div>
        ) : orders.length === 0 && donations.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-2xl text-xs text-gray-500">
            अभी तक कोई ऑर्डर या बुकिंग नहीं है। अपनी पहली पूजा किट या पंडित जी बुक करें!
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((ord) => {
              const titleLine =
                ord.items?.map((i) => i.titleSnapshot).join(', ') || ord.orderType;
              const dateStr = new Date(ord.createdAt).toLocaleDateString('hi-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });
              return (
                <div
                  key={ord.id}
                  className="bg-cream border border-orange-200 rounded-xl p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-extrabold bg-abhiRed text-white px-2 py-0.5 rounded">
                        #{ord.id}
                      </span>
                      <span className="text-[11px] font-extrabold bg-white border border-orange-200 text-saffron px-2 py-0.5 rounded">
                        {ord.orderType}
                      </span>
                      {ord.cancelledAt && (
                        <span className="text-[11px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded">
                          रद्द (Cancelled)
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-500">{dateStr}</span>
                    </div>
                    <span className="text-base font-extrabold text-gray-900">₹{ord.total}</span>
                  </div>

                  <div className="text-sm font-extrabold text-gray-900">{titleLine}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {ord.customerName} • {ord.addressLine}
                    {ord.promoCode ? ` • कूपन: ${ord.promoCode} (-₹${ord.discount})` : ''}
                  </div>

                  {!ord.cancelledAt && (
                    <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-orange-200/60">
                      {STEPS.map((st, sIdx) => {
                        const active = sIdx <= ord.statusStep;
                        return (
                          <div key={st} className="flex-1 text-center">
                            <div
                              className={`h-1.5 rounded-full mb-1 ${
                                active ? 'bg-green-600' : 'bg-gray-200'
                              }`}
                            />
                            <span
                              className={`text-[10px] font-bold ${
                                active ? 'text-green-800' : 'text-gray-400'
                              }`}
                            >
                              {st}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-orange-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-gray-500 font-semibold">
                      भुगतान: {ord.paymentMethod}
                    </span>
                    <div className="flex gap-2">
                      {!ord.cancelledAt && ord.statusStep < 2 && (
                        <button
                          type="button"
                          disabled={cancellingId === ord.id}
                          onClick={async () => {
                            setCancellingId(ord.id);
                            try {
                              await onCancelOrder(ord.id);
                            } finally {
                              setCancellingId(null);
                            }
                          }}
                          className="text-abhiRed hover:bg-red-50 border border-red-200 px-3 py-1 rounded-lg font-extrabold cursor-pointer"
                        >
                          {cancellingId === ord.id ? 'रद्द हो रहा...' : 'ऑर्डर रद्द करें'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 px-3 py-1 rounded-lg font-bold cursor-pointer"
                      >
                        <i className="fa-solid fa-print mr-1" />
                        रसीद
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {donations.map((d) => (
              <div
                key={d.id}
                className="bg-amber-50/70 border border-amber-300 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="bg-amber-900 text-white font-extrabold px-2 py-0.5 rounded text-[10px] mr-1.5">
                    #{d.id}
                  </span>
                  <span className="font-extrabold text-gray-900">{d.cause}</span>
                  <div className="text-gray-600 mt-0.5">
                    भक्त: {d.donorName} {d.donorCity ? `(${d.donorCity})` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-abhiRed text-sm">₹{d.amount}</span>
                  <button
                    type="button"
                    onClick={() => onOpenReceipt(d)}
                    className="bg-white border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                  >
                    रसीद देखें
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== CUSTOM PUJA LIST MODAL ====================

interface CustomListModalProps {
  isOpen: boolean;
  defaultDate: string;
  user: UserProfile | null;
  addresses: UserAddress[];
  onClose: () => void;
  onAddCustomToCart: (payload: {
    title: string;
    details: string;
    price: number;
    pujaDate: string;
  }) => void;
  onSubmitted: (orderId: string, msg: string) => void;
  showToast: (msg: string) => void;
}

export const CustomListModal: React.FC<CustomListModalProps> = ({
  isOpen,
  defaultDate,
  user,
  addresses,
  onClose,
  onAddCustomToCart,
  onSubmitted,
  showToast,
}) => {
  const [pujaName, setPujaName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [manualItems, setManualItems] = useState<Array<{ name: string; qty: string }>>([
    { name: '', qty: '' },
  ]);
  const [needPandit, setNeedPandit] = useState(false);
  const [pujaDate, setPujaDate] = useState(defaultDate);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const defAddr = addresses.find((a) => a.isDefault) || addresses[0];
    if (defAddr) {
      setCustName(defAddr.name);
      setCustPhone(defAddr.phone);
      setCustAddress([defAddr.addressLine, defAddr.city, defAddr.pincode].filter(Boolean).join(', '));
    } else if (user) {
      setCustName((prev) => prev || user.name);
      setCustPhone((prev) => prev || user.phone || '');
    }
  }, [addresses, user, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f && f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(String(reader.result || ''));
      reader.readAsDataURL(f);
    } else {
      setPreviewUrl(null);
    }
  };

  const validManualItems = manualItems.filter((m) => m.name.trim());

  const handleAddToCart = () => {
    if (!file && validManualItems.length === 0) {
      showToast('कृपया पर्ची की फोटो अपलोड करें या कम से कम एक सामग्री लिखें');
      return;
    }
    const estPrice = Math.max(299, validManualItems.length * 65 + (needPandit ? 1100 : 0));
    const details = [
      file ? `अपलोड पर्ची: ${file.name}` : '',
      validManualItems.length > 0
        ? `सामग्री: ${validManualItems.map((m) => (m.qty ? `${m.name} (${m.qty})` : m.name)).join(', ')}`
        : '',
      needPandit ? `पंडित जी सहित (तिथि: ${pujaDate})` : '',
    ]
      .filter(Boolean)
      .join(' • ');

    onAddCustomToCart({
      title: `कस्टम पूजा लिस्ट: ${pujaName || 'कस्टम पूजा'}`,
      details,
      price: estPrice,
      pujaDate,
    });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && validManualItems.length === 0) {
      showToast('कृपया पर्ची की फोटो अपलोड करें या कम से कम एक सामग्री लिखें');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('pujaName', pujaName);
      fd.append('needPandit', String(needPandit));
      fd.append('pujaDate', pujaDate);
      fd.append('customerName', custName);
      fd.append('phone', custPhone);
      fd.append('address', custAddress);
      fd.append('manualItems', JSON.stringify(validManualItems));
      if (file) fd.append('file', file);

      const data = await apiFetch<{ orderId: string; estimatedPrice: number }>(
        '/api/custom-lists',
        {
          method: 'POST',
          body: fd,
        }
      );

      onSubmitted(
        data.orderId,
        `धन्यवाद ${custName}! PujaJunction.com पर आपकी "${pujaName}" कस्टम लिस्ट (अनुमानित ₹${data.estimatedPrice}) "${custAddress}" के लिए बुक हो गई है।`
      );
      setPujaName('');
      setFile(null);
      setPreviewUrl(null);
      setManualItems([{ name: '', qty: '' }]);
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'कस्टम लिस्ट सबमिट नहीं हो सकी।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative my-8 max-h-[92vh] overflow-y-auto box-scroll">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-orange-100 text-saffron flex items-center justify-center text-xl font-bold shrink-0">
            <i className="fa-solid fa-file-circle-plus" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">
              अपनी कस्टम पूजा लिस्ट अपलोड करें व बुक करें
            </h3>
            <p className="text-xs text-gray-500">पर्ची की फोटो अपलोड करें या अपनी सामग्री लिस्ट लिखें</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              पूजा / अनुष्ठान का नाम *
            </label>
            <input
              type="text"
              required
              value={pujaName}
              onChange={(e) => setPujaName(e.target.value)}
              placeholder="जैसे: गृह प्रवेश या सत्यनारायण कथा"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-abhiRed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              पर्ची की फोटो / PDF चुनें (Optional, Max 5MB)
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-orange-300 hover:border-abhiRed bg-cream rounded-xl p-4 cursor-pointer transition text-center">
              <i className="fa-solid fa-cloud-arrow-up text-2xl text-saffron mb-1" />
              <span className="text-xs font-extrabold text-gray-800">
                फोटो खींचें या फाइल चुनें (JPG, PNG, PDF)
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {file && (
              <div className="mt-2.5 bg-gray-50 border border-gray-200 rounded-xl p-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover border border-gray-300"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-red-100 text-abhiRed flex items-center justify-center font-extrabold text-xs">
                      PDF
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-gray-800 truncate">{file.name}</div>
                    <div className="text-[11px] text-green-600 font-bold">✓ अपलोड के लिए तैयार</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="text-xs text-abhiRed font-bold hover:underline shrink-0 cursor-pointer"
                >
                  हटाएं
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-700">सामग्री आइटम जोड़ें</label>
              <button
                type="button"
                onClick={() => setManualItems((prev) => [...prev, { name: '', qty: '' }])}
                className="text-xs font-extrabold text-abhiRed hover:underline cursor-pointer"
              >
                + और आइटम जोड़ें
              </button>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto box-scroll pr-1">
              {manualItems.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => {
                      const next = [...manualItems];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setManualItems(next);
                    }}
                    placeholder="सामग्री का नाम (जैसे: घी)"
                    className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-abhiRed"
                  />
                  <input
                    type="text"
                    value={row.qty}
                    onChange={(e) => {
                      const next = [...manualItems];
                      next[idx] = { ...next[idx], qty: e.target.value };
                      setManualItems(next);
                    }}
                    placeholder="मात्रा (250g)"
                    className="w-24 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-abhiRed"
                  />
                  {manualItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setManualItems((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-gray-400 hover:text-abhiRed px-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-xmark text-xs" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-extrabold text-gray-800">
              <input
                type="checkbox"
                checked={needPandit}
                onChange={(e) => setNeedPandit(e.target.checked)}
                className="w-4 h-4 accent-abhiRed rounded"
              />
              <span>साथ में पंडित जी भी बुक करना है</span>
            </label>
            <input
              type="date"
              value={pujaDate}
              onChange={(e) => setPujaDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 border-t border-gray-100 pt-3">
            <input
              type="text"
              required
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              placeholder="आपका पूरा नाम *"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-abhiRed"
            />
            <input
              type="tel"
              required
              value={custPhone}
              onChange={(e) => setCustPhone(e.target.value)}
              placeholder="मोबाइल नंबर *"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-abhiRed"
            />
            <input
              type="text"
              required
              value={custAddress}
              onChange={(e) => setCustAddress(e.target.value)}
              placeholder="पूरा डिलीवरी पता / पिनकोड *"
              className="sm:col-span-2 w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-abhiRed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full bg-orange-100 hover:bg-orange-200 text-saffron font-extrabold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              + कार्ट में जोड़ें
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              {submitting ? 'सबमिट हो रहा है...' : 'अभी बुक करें'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== REVIEWS MODAL ====================

interface ReviewsModalProps {
  product: Listing | null;
  user: UserProfile | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onReviewUpdated: (listingId: number, ratingAvg: number, reviews: ListingReview[]) => void;
  showToast: (msg: string) => void;
}

export const ReviewsModal: React.FC<ReviewsModalProps> = ({
  product,
  user,
  onClose,
  onRequireAuth,
  onReviewUpdated,
  showToast,
}) => {
  const [reviewsList, setReviewsList] = useState<ListingReview[]>([]);
  const [authorName, setAuthorName] = useState(user?.name || '');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setReviewsList(product.reviews || []);
      setAuthorName(user?.name || '');
    }
  }, [product, user]);

  if (!product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setSaving(true);
    try {
      const data = await apiFetch<{
        review: ListingReview;
        ratingAvg: number;
      }>(`/api/listings/${product.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ authorName, rating, comment }),
      });

      const updatedList = [
        data.review,
        ...reviewsList.filter((r) => r.id !== data.review.id),
      ];
      setReviewsList(updatedList);
      setComment('');
      onReviewUpdated(product.id, data.ratingAvg, updatedList);
      showToast('आपकी समीक्षा सफलतापूर्वक जुड़ गई है!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'समीक्षा सबमिट नहीं हो सकी।');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reviewId: number) => {
    try {
      const data = await apiFetch<{ ratingAvg: number }>(
        `/api/listings/${product.id}/reviews/${reviewId}`,
        { method: 'DELETE' }
      );
      const next = reviewsList.filter((r) => r.id !== reviewId);
      setReviewsList(next);
      onReviewUpdated(product.id, data.ratingAvg, next);
      showToast('समीक्षा हटा दी गई।');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'हटाने में समस्या आई।');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto box-scroll">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <h3 className="text-lg font-extrabold text-gray-900 pr-8">{product.title}</h3>
        <p className="text-xs text-gray-500 mt-0.5 mb-4">
          {product.vendor} • औसत रेटिंग: ★ {Number(product.rating).toFixed(1)} ({reviewsList.length}{' '}
          समीक्षाएं)
        </p>

        <div className="space-y-2.5 max-h-56 overflow-y-auto box-scroll pr-1 mb-4">
          {reviewsList.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-xl text-xs text-gray-500">
              अभी तक कोई समीक्षा नहीं है — पहली समीक्षा लिखें!
            </div>
          ) : (
            reviewsList.map((r) => (
              <div
                key={r.id}
                className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold text-gray-900">{r.author}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 font-extrabold">
                      {'★'.repeat(r.rating)}
                      {'☆'.repeat(5 - r.rating)}
                    </span>
                    {user && (r.userId === user.id || user.role === 'admin') && (
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="text-gray-400 hover:text-abhiRed cursor-pointer"
                        title="समीक्षा हटाएं"
                      >
                        <i className="fa-solid fa-trash text-[11px]" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-gray-700">{r.comment}</p>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-cream border border-orange-200 rounded-xl p-3.5 space-y-2.5 text-xs"
        >
          <div className="font-extrabold text-gray-900">
            अपनी समीक्षा लिखें {!user && '(लॉगिन आवश्यक)'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="आपका नाम *"
              className="border border-gray-300 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-abhiRed"
            />
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2.5 py-2 bg-white font-bold focus:outline-none focus:border-abhiRed"
            >
              <option value={5}>★★★★★ (5 - उत्कृष्ट)</option>
              <option value={4}>★★★★☆ (4 - बहुत अच्छा)</option>
              <option value={3}>★★★☆☆ (3 - ठीक है)</option>
              <option value={2}>★★☆☆☆ (2 - औसत)</option>
              <option value={1}>★☆☆☆☆ (1 - खराब)</option>
            </select>
          </div>
          <textarea
            rows={2}
            required
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="सामग्री की शुद्धता या पंडित जी के अनुभव के बारे में लिखें..."
            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-abhiRed"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-saffron hover:bg-orange-600 disabled:opacity-60 text-white font-extrabold py-2.5 rounded-xl transition cursor-pointer"
          >
            {saving ? 'सबमिट हो रहा...' : user ? 'समीक्षा सबमिट करें' : 'लॉगिन कर समीक्षा लिखें'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ==================== PUJA DETAIL MODAL ====================

export interface PujaDetailInfo {
  pujaName: string;
  categoryTitle: string;
  deityName: string;
  customSamagri?: string;
  product?: Listing | null;
}

interface PujaDetailModalProps {
  detail: PujaDetailInfo | null;
  onClose: () => void;
  onBookKit: (detail: PujaDetailInfo) => void;
  onOpenCustomList: () => void;
}

export const PujaDetailModal: React.FC<PujaDetailModalProps> = ({
  detail,
  onClose,
  onBookKit,
  onOpenCustomList,
}) => {
  if (!detail) return null;

  const tags = [
    detail.categoryTitle.split(' ')[1] || 'वैदिक',
    detail.deityName.split(' ')[0],
    'शुद्ध सामग्री',
    'पंचांग विधि',
  ];

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto box-scroll">
        <button
          type="button"
          onClick={onClose}
          className="sticky top-0 float-right w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 z-10 cursor-pointer"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="bg-abhiRed text-white text-xs font-extrabold px-3 py-0.5 rounded-full">
            {detail.categoryTitle}
          </span>
          <span className="bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
            आराध्य: {detail.deityName}
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900">{detail.pujaName}</h2>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((t) => (
            <span
              key={t}
              className="bg-orange-50 text-saffron border border-orange-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
            >
              #{t}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs">
          <div className="bg-cream border border-orange-200 rounded-xl p-3">
            <div className="font-extrabold text-saffron mb-0.5">
              <i className="fa-regular fa-calendar-check mr-1" />
              तिथि एवं मुहूर्त
            </div>
            <div className="text-gray-800 font-semibold">
              {detail.pujaName} हेतु पंचांग अनुसार प्रातःकाल, अभिजीत मुहूर्त एवं प्रदोष काल सर्वश्रेष्ठ माने जाते हैं।
            </div>
          </div>
          <div className="bg-cream border border-orange-200 rounded-xl p-3">
            <div className="font-extrabold text-saffron mb-0.5">
              <i className="fa-solid fa-sparkles mr-1" />
              महत्व
            </div>
            <div className="text-gray-800 font-semibold">
              {detail.pujaName} करने से घर में सकारात्मक ऊर्जा, मानसिक शांति, आरोग्य और सुख-समृद्धि का वास होता है।
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-xs sm:text-sm">
          <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200">
            <h4 className="font-extrabold text-gray-900 mb-1">
              <i className="fa-solid fa-box-open text-abhiRed mr-1.5" />
              संपूर्ण पूजा सामग्री
            </h4>
            <p className="text-gray-700 leading-relaxed">
              {detail.customSamagri ||
                'रोली, मौली (कलावा), अक्षत (चावल), हल्दी, चंदन, गंगाजल, गाय का शुद्ध घी, कपूर, धूपबत्ती, पान-सुपारी, लौंग-इलायची, कलश, नारियल, पुष्प एवं पंचमेवा प्रसाद।'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200">
            <h4 className="font-extrabold text-gray-900 mb-1">
              <i className="fa-solid fa-book-open text-saffron mr-1.5" />
              पूजा विधि व नियम
            </h4>
            <p className="text-gray-700 leading-relaxed">
              1. प्रातः स्नान कर स्वच्छ वस्त्र धारण करें। 2. पूर्व या उत्तर दिशा की ओर मुख कर आसन पर बैठें। 3. जल छिड़क कर पवित्रीकरण और हाथ में जल-अक्षत लेकर संकल्प लें। 4. सर्वप्रथम श्री गणेश व कलश पूजन करें, तत्पश्चात मुख्य आराध्य देव का पंचोपचार या षोडशोपचार पूजन, मंत्र जाप, कथा एवं आरती करें।
            </p>
          </div>
          <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200">
            <h4 className="font-extrabold text-amber-950 mb-1">
              <i className="fa-solid fa-om text-abhiRed mr-1.5" />
              प्रमुख वैदिक मंत्र
            </h4>
            <p className="text-amber-950 font-bold leading-relaxed">
              ॐ गं गणपतये नमः ॥ ॐ नमो भगवते वासुदेवाय ॥ ॐ नमः शिवाय ॥ ॐ श्री महालक्ष्म्यै नमः ॥
            </p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onBookKit(detail);
            }}
            className="flex-1 bg-abhiRed hover:bg-abhiRedDark text-white font-extrabold py-3 rounded-xl text-xs sm:text-sm shadow transition cursor-pointer"
          >
            <i className="fa-solid fa-bag-shopping mr-1.5" />
            इस पूजा की किट बुक करें
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCustomList();
            }}
            className="flex-1 bg-saffron hover:bg-orange-600 text-white font-extrabold py-3 rounded-xl text-xs sm:text-sm shadow transition cursor-pointer"
          >
            <i className="fa-solid fa-file-arrow-up mr-1.5" />
            कस्टम लिस्ट अपलोड करें
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== VOICE SEARCH MODAL ====================

interface VoiceSearchModalProps {
  isOpen: boolean;
  statusText: string;
  transcript: string;
  onStop: () => void;
  onSelectQuery: (q: string) => void;
}

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({
  isOpen,
  statusText,
  transcript,
  onStop,
  onSelectQuery,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative">
        <button
          type="button"
          onClick={onStop}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
        >
          <i className="fa-solid fa-xmark" />
        </button>
        <div className="w-16 h-16 rounded-full bg-red-50 text-abhiRed flex items-center justify-center text-2xl mx-auto mb-3 mic-listening border border-red-200">
          <i className="fa-solid fa-microphone" />
        </div>
        <h3 className="text-lg font-extrabold text-gray-900">बोलिए, मैं सुन रहा हूँ...</h3>
        <p className="text-xs text-gray-500 mt-1">{statusText}</p>
        <div className="mt-3 bg-cream border border-orange-200 rounded-xl p-2.5 text-sm font-extrabold text-abhiRed min-h-[40px]">
          {transcript}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="text-[11px] font-bold text-gray-400 mb-2">या तुरंत चुनें:</div>
          <div className="flex flex-wrap justify-center gap-1.5 text-xs">
            {['सत्यनारायण', 'गृह प्रवेश', 'रुद्राभिषेक', 'छठ पूजा'].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onSelectQuery(q)}
                className="px-2.5 py-1 rounded-full bg-orange-50 text-saffron font-bold hover:bg-orange-100 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== SEVA DAKSHINA RECEIPT MODAL ====================

interface ReceiptModalProps {
  donation: DonationRecord | null;
  settings: SiteSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ donation, settings, onClose }) => {
  if (!donation) return null;

  const dateText = new Date(donation.createdAt).toLocaleDateString('hi-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const fullDonor = donation.donorCity
    ? `${donation.donorName} (${donation.donorCity})`
    : donation.donorName;

  const waMsg = `🙏 *सेवा दक्षिणा पुष्टि - PujaJunction.com*\n\n*रसीद ID:* #${donation.id}\n*नाम:* ${fullDonor}\n*सेवा:* ${donation.cause}\n*दक्षिणा:* ₹${donation.amount}\n\nमैंने UPI (${settings.upiId}) से सेवा दक्षिणा अर्पण कर दी है।`;

  return (
    <div
      id="receiptModal"
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print-only-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gradient-to-b from-amber-50 to-white border-2 border-amber-400 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl relative my-8">
        <button
          type="button"
          onClick={onClose}
          className="no-print absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-gray-600 border border-gray-200 cursor-pointer"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <span className="inline-block bg-green-100 text-green-800 text-[11px] font-extrabold px-3 py-1 rounded-full mb-2">
          ✅ सेवा दक्षिणा अर्पण प्रमाणपत्र
        </span>
        <h3 className="text-xl font-extrabold text-amber-950">🪔 आशीर्वाद सेवा रसीद</h3>
        <p className="text-xs text-gray-600 mt-1">आपके धार्मिक सहयोग के लिए हृदय से धन्यवाद!</p>

        <div className="bg-white border border-amber-200 rounded-xl p-3.5 my-4 text-xs text-left space-y-2">
          <div className="flex justify-between border-b border-dashed border-gray-100 pb-1.5">
            <span className="text-gray-500">रसीद क्रमांक:</span>
            <strong className="text-gray-900">#{donation.id}</strong>
          </div>
          <div className="flex justify-between border-b border-dashed border-gray-100 pb-1.5">
            <span className="text-gray-500">संस्था:</span>
            <strong className="text-gray-900">{settings.siteName}</strong>
          </div>
          <div className="flex justify-between border-b border-dashed border-gray-100 pb-1.5">
            <span className="text-gray-500">भक्त का नाम:</span>
            <strong className="text-gray-900">{fullDonor}</strong>
          </div>
          <div className="flex justify-between border-b border-dashed border-gray-100 pb-1.5">
            <span className="text-gray-500">सेवा उद्देश्य:</span>
            <strong className="text-saffron">{donation.cause}</strong>
          </div>
          <div className="flex justify-between border-b border-dashed border-gray-100 pb-1.5">
            <span className="text-gray-500">दक्षिणा राशि:</span>
            <strong className="text-abhiRed text-sm">₹{donation.amount}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">दिनांक:</span>
            <strong className="text-gray-900">{dateText}</strong>
          </div>
        </div>

        <div className="space-y-2 no-print">
          <a
            href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(waMsg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-2.5 rounded-xl text-xs shadow"
          >
            <i className="fa-brands fa-whatsapp mr-1.5" />
            WhatsApp पर कन्फर्म करें
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer"
          >
            <i className="fa-solid fa-print mr-1.5" />
            रसीद प्रिंट / Save करें
          </button>
        </div>
      </div>
    </div>
  );
};
