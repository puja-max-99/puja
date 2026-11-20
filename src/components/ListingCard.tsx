import React, { useState } from 'react';
import type { Listing } from '../types/puja';

interface ListingCardProps {
  product: Listing;
  bookingDate: string;
  isWishlisted: boolean;
  onToggleWishlist: (listingId: number) => void;
  onToggleAccordion: (listingId: number) => void;
  onToggleBoxItem: (listingId: number, itemIdx: number) => void;
  onUpdateBoxItemQty: (listingId: number, itemIdx: number, delta: number) => void;
  onToggleSubscription: (listingId: number) => void;
  onChangeSubscriptionCycle: (listingId: number, cycle: string) => void;
  onOpenDirectOrder: (product: Listing) => void;
  onAddBoxToCart: (product: Listing) => void;
  onAddPanditToCart: (
    product: Listing,
    variantId: number | null,
    variantLabel: string,
    price: number,
    location: string,
    date: string
  ) => void;
  onAddVariantToCart: (
    product: Listing,
    variantId: number | null,
    variantLabel: string,
    unitPrice: number,
    qty: number
  ) => void;
  onOpenReviews: (product: Listing) => void;
  onOpenPujaDetail: (product: Listing) => void;
}

const PANDIT_AREAS = [
  'Sakchi, Jamshedpur',
  'Bagbera, Jamshedpur',
  'Bistupur, Jamshedpur',
  'Ranchi',
  'Patna',
  'Varanasi',
];

export function getBoxCalculatedPrice(product: Listing): number {
  const rawSum = (product.items || []).reduce(
    (acc, it) => acc + (it.checked ? it.price * it.qty : 0),
    0
  );
  return product.subscriptionEnabled ? Math.round(rawSum * 0.9) : rawSum;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  product,
  bookingDate,
  isWishlisted,
  onToggleWishlist,
  onToggleAccordion,
  onToggleBoxItem,
  onUpdateBoxItemQty,
  onToggleSubscription,
  onChangeSubscriptionCycle,
  onOpenDirectOrder,
  onAddBoxToCart,
  onAddPanditToCart,
  onAddVariantToCart,
  onOpenReviews,
  onOpenPujaDetail,
}) => {
  const defaultArea = PANDIT_AREAS.includes(product.location)
    ? product.location
    : 'Sakchi, Jamshedpur';

  const [selectedPujaIdx, setSelectedPujaIdx] = useState(0);
  const [selectedPanditArea, setSelectedPanditArea] = useState(defaultArea);
  const [selectedPanditDate, setSelectedPanditDate] = useState(bookingDate);
  const [selectedSizeIdx, setSelectedSizeIdx] = useState(0);
  const [simpleQty, setSimpleQty] = useState(product.simpleQty || 1);

  const fallbackImg = `https://placehold.co/320x240/fff3e0/dc3545?text=${encodeURIComponent(
    product.title.slice(0, 15)
  )}`;

  const renderTypeBadge = () => {
    if (product.category === 'pooja_box') {
      return (
        <span className="text-[11px] font-extrabold text-saffron tracking-wide">
          कस्टम पूजा बॉक्स
        </span>
      );
    }
    if (product.category === 'pandit') {
      return (
        <span className="text-[11px] font-extrabold text-amber-700 tracking-wide">
          प्रमाणित पंडित जी
        </span>
      );
    }
    if (product.category === 'murti') {
      return (
        <span className="text-[11px] font-extrabold text-abhiRed tracking-wide">
          शुद्ध मूर्ति संग्रह
        </span>
      );
    }
    return (
      <span className="text-[11px] font-extrabold text-abhiRed tracking-wide">
        भगवान फोटो फ्रेम
      </span>
    );
  };

  const renderFeatureImage = () => (
    <div className="w-full sm:w-36 md:w-40 h-40 sm:h-32 rounded-xl overflow-hidden border border-orange-100 bg-cream shrink-0 relative">
      <img
        src={product.image || fallbackImg}
        alt={product.title}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = fallbackImg;
        }}
        className="w-full h-full object-cover"
      />
      <button
        type="button"
        onClick={() => onToggleWishlist(product.id)}
        title={isWishlisted ? 'विशलिस्ट से हटाएं' : 'विशलिस्ट में सेव करें'}
        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition cursor-pointer ${
          isWishlisted
            ? 'bg-abhiRed text-white'
            : 'bg-white/95 text-gray-500 hover:text-abhiRed'
        }`}
      >
        <i className={`${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart text-xs`} />
      </button>
    </div>
  );

  const ratingBtn = (
    <button
      type="button"
      onClick={() => onOpenReviews(product)}
      className="bg-green-700 hover:bg-green-800 text-white px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums cursor-pointer transition"
    >
      ★ {Number(product.rating).toFixed(1)} ({product.reviews?.length || 0})
    </button>
  );

  const globalTag = product.isGlobal ? (
    <span className="text-[11px] font-bold text-emerald-700">
      · Global Delivery
    </span>
  ) : (
    <span className="text-[11px] font-semibold text-gray-500">
      · Local Area
    </span>
  );

  if (product.category === 'pooja_box') {
    const totalPrice = getBoxCalculatedPrice(product);
    const checkedCount = (product.items || []).filter((i) => i.checked).length;

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs card-hover overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start gap-4 flex-1 min-w-0">
            {renderFeatureImage()}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                {renderTypeBadge()}
                {globalTag}
                {ratingBtn}
                <span className="text-xs text-gray-500 font-semibold">
                  <i className="fa-regular fa-clock text-saffron mr-1" />
                  {product.deliveryTime}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 leading-snug">
                {product.title}
              </h3>
              <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-x-2">
                <span className="font-bold text-gray-700">
                  <i className="fa-solid fa-store text-saffron mr-1" />
                  {product.vendor}
                </span>
                <span>·</span>
                <span className="font-semibold text-gray-600">
                  {product.location}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{product.description}</p>

              {/* Subscription strip */}
              <div className="mt-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                  <input
                    type="checkbox"
                    checked={Boolean(product.subscriptionEnabled)}
                    onChange={() => onToggleSubscription(product.id)}
                    className="w-4 h-4 accent-saffron rounded cursor-pointer"
                  />
                  <span>पूजा रिमाइंडर व सब्सक्रिप्शन <span className="text-saffron font-extrabold">(10% बचत)</span></span>
                </label>
                <select
                  value={product.subscriptionCycle || 'मासिक (हर पूर्णिमा)'}
                  onChange={(e) => onChangeSubscriptionCycle(product.id, e.target.value)}
                  className="border border-amber-300/80 rounded-lg px-2 py-1 text-[11px] font-bold bg-white text-gray-800 focus:outline-none focus:border-saffron"
                >
                  <option value="मासिक (हर पूर्णिमा)">मासिक (हर पूर्णिमा)</option>
                  <option value="मासिक (एकादशी)">मासिक (एकादशी)</option>
                  <option value="साप्ताहिक (सोमवार)">साप्ताहिक (सोमवार)</option>
                  <option value="मासिक (अमावस्या)">मासिक (अमावस्या)</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                {(product.tags || []).slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="text-[11px] text-gray-500 font-semibold"
                  >
                    #{t}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => onOpenPujaDetail(product)}
                  className="text-[11px] font-extrabold text-abhiRed hover:underline ml-1 cursor-pointer"
                >
                  विधि व मंत्र देखें →
                </button>
              </div>
            </div>
          </div>

          <div className="md:border-l md:border-gray-200 md:pl-5 flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
            <div className="text-left md:text-right">
              <div className="text-[11px] font-bold text-gray-500">
                {product.subscriptionEnabled ? '10% सब्सक्रिप्शन छूट सहित:' : 'कस्टमाइज़्ड कुल मूल्य:'}
              </div>
              <div className="text-2xl font-extrabold text-gray-900 tabular-nums">₹{totalPrice}</div>
              <div className="text-[11px] font-bold text-green-700 tabular-nums">
                {checkedCount}/{product.items.length} सामग्री चयनित
              </div>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-2">
              <button
                type="button"
                disabled={checkedCount === 0}
                onClick={() => onOpenDirectOrder(product)}
                className="bg-abhiRed hover:bg-abhiRedDark disabled:bg-gray-300 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer"
              >
                अभी ऑर्डर करें
              </button>
              <button
                type="button"
                disabled={checkedCount === 0}
                onClick={() => onAddBoxToCart(product)}
                className="bg-orange-50 hover:bg-orange-100 text-saffron border border-orange-200 disabled:opacity-40 px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer"
              >
                + कार्ट में जोड़ें
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Kit Checklist */}
        <div className="bg-cream border-t border-orange-100 px-4 sm:px-5 py-2.5">
          <button
            type="button"
            onClick={() => onToggleAccordion(product.id)}
            className="w-full flex items-center justify-between text-xs font-extrabold text-saffron hover:text-abhiRed transition cursor-pointer"
          >
            <span>
              <i className="fa-solid fa-list-check mr-1.5" /> बॉक्स सामग्री लिस्ट देखें व कस्टमाइज़ करें
            </span>
            <span className="bg-white border border-orange-200 px-2.5 py-1 rounded-lg text-[11px] text-gray-800">
              {product.expanded ? 'लिस्ट छुपाएं ▲' : 'लिस्ट खोलें ▼'}
            </span>
          </button>
          {product.expanded && (
            <div className="mt-3 pt-2.5 border-t border-orange-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto box-scroll pr-1">
              {product.items.map((it, idx) => (
                <div
                  key={`${product.id}-item-${idx}`}
                  className="flex items-center justify-between py-2 px-3 bg-white rounded-xl border border-orange-100 text-xs"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 pr-2 select-none">
                    <input
                      type="checkbox"
                      checked={it.checked}
                      onChange={() => onToggleBoxItem(product.id, idx)}
                      className="w-4 h-4 accent-abhiRed rounded cursor-pointer"
                    />
                    <span
                      className={
                        it.checked ? 'text-gray-800 font-semibold' : 'text-gray-400 line-through'
                      }
                    >
                      {it.name}{' '}
                      <span className="text-[11px] text-gray-400 font-normal tabular-nums">
                        ({it.unit} · ₹{it.price})
                      </span>
                    </span>
                  </label>
                  <div
                    className={`flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 ${
                      !it.checked ? 'opacity-40 pointer-events-none' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onUpdateBoxItemQty(product.id, idx, -1)}
                      className="w-5 h-5 flex items-center justify-center text-abhiRed font-extrabold hover:bg-red-50 rounded cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-extrabold text-gray-900 min-w-[16px] text-center tabular-nums">
                      {it.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateBoxItemQty(product.id, idx, 1)}
                      className="w-5 h-5 flex items-center justify-center text-abhiRed font-extrabold hover:bg-red-50 rounded cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (product.category === 'pandit') {
    const activePuja = product.pujaTypes[selectedPujaIdx] || {
      id: null,
      label: `वैदिक पूजा (₹${product.basePrice})`,
      price: product.basePrice,
    };

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs card-hover overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start gap-4 flex-1 min-w-0">
            {renderFeatureImage()}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                {renderTypeBadge()}
                {globalTag}
                {ratingBtn}
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900">{product.title}</h3>
              <div className="text-xs text-gray-500 mt-1">
                <span className="font-bold text-gray-700">{product.vendor}</span> ·{' '}
                <span className="font-bold text-abhiRed">{selectedPanditArea}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1.5">{product.description}</p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl text-xs">
                <select
                  value={selectedPujaIdx}
                  onChange={(e) => setSelectedPujaIdx(Number(e.target.value))}
                  className="border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 font-bold text-gray-800 focus:outline-none focus:border-abhiRed"
                >
                  {product.pujaTypes.map((p, idx) => (
                    <option key={p.id || idx} value={idx}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedPanditArea}
                  onChange={(e) => setSelectedPanditArea(e.target.value)}
                  className="border border-orange-200 rounded-xl px-3 py-2 bg-orange-50/40 font-bold text-gray-900 focus:outline-none focus:border-abhiRed cursor-pointer"
                >
                  {PANDIT_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={selectedPanditDate}
                  onChange={(e) => setSelectedPanditDate(e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 font-bold text-gray-800 focus:outline-none focus:border-abhiRed"
                />
              </div>
            </div>
          </div>

          <div className="md:border-l md:border-gray-200 md:pl-5 flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
            <div className="text-left md:text-right">
              <div className="text-[11px] font-bold text-gray-500">निश्चित दक्षिणा:</div>
              <div className="text-2xl font-extrabold text-gray-900 tabular-nums">₹{activePuja.price}</div>
            </div>
            <button
              type="button"
              onClick={() =>
                onAddPanditToCart(
                  product,
                  activePuja.id ?? null,
                  activePuja.label,
                  activePuja.price,
                  selectedPanditArea,
                  selectedPanditDate
                )
              }
              className="bg-saffron hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer"
            >
              पंडित जी बुक करें
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Murti / Photo Frame
  const activeSize = product.sizes[selectedSizeIdx] || {
    id: null,
    label: `स्टैंडर्ड साइज (₹${product.basePrice})`,
    price: product.basePrice,
  };
  const totalVariantPrice = activeSize.price * simpleQty;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs card-hover overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start gap-4 flex-1 min-w-0">
          {renderFeatureImage()}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {renderTypeBadge()}
              {globalTag}
              {ratingBtn}
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-gray-900">{product.title}</h3>
            <div className="text-xs text-gray-500 mt-1">
              <span className="font-bold text-gray-700">{product.vendor}</span> ·{' '}
              {product.location} · {product.deliveryTime}
            </div>
            <p className="text-xs text-gray-600 mt-1.5">{product.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <select
                value={selectedSizeIdx}
                onChange={(e) => setSelectedSizeIdx(Number(e.target.value))}
                className="border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 font-bold text-gray-800 focus:outline-none focus:border-abhiRed cursor-pointer"
              >
                {product.sizes.map((s, idx) => (
                  <option key={s.id || idx} value={idx}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-1.5">
                <span className="text-gray-500 font-bold">मात्रा:</span>
                <button
                  type="button"
                  onClick={() => setSimpleQty((q) => Math.max(1, q - 1))}
                  className="w-5 h-5 rounded bg-white border border-gray-200 text-abhiRed font-extrabold cursor-pointer"
                >
                  -
                </button>
                <span className="font-extrabold min-w-[18px] text-center tabular-nums">{simpleQty}</span>
                <button
                  type="button"
                  onClick={() => setSimpleQty((q) => Math.min(25, q + 1))}
                  className="w-5 h-5 rounded bg-white border border-gray-200 text-abhiRed font-extrabold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="md:border-l md:border-gray-200 md:pl-5 flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
          <div className="text-left md:text-right">
            <div className="text-[11px] font-bold text-gray-500">कुल कीमत:</div>
            <div className="text-2xl font-extrabold text-gray-900 tabular-nums">₹{totalVariantPrice}</div>
          </div>
          <button
            type="button"
            onClick={() =>
              onAddVariantToCart(
                product,
                activeSize.id ?? null,
                activeSize.label,
                activeSize.price,
                simpleQty
              )
            }
            className="bg-abhiRed hover:bg-abhiRedDark text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer"
          >
            + कार्ट में जोड़ें
          </button>
        </div>
      </div>
    </div>
  );
};
