import React, { useEffect, useState } from 'react';

export interface HeroOfferSlide {
  id: string;
  image: string;
  kicker: string;
  title: string;
  subtitle: string;
  promoCode?: string;
  primaryLabel: string;
  secondaryLabel: string;
  actionType: 'pooja_box' | 'pandit' | 'murti';
  searchKeyword?: string;
}

const HERO_OFFER_SLIDES: HeroOfferSlide[] = [
  {
    id: 'satyanarayan-special-kit',
    image: '/src/assets/images/hero_satyanarayan_offer_1795112252551.jpg',
    kicker: 'विशेष पूजा किट ऑफर · कोड: GANESH10',
    title: 'सत्यनारायण कथा एवं पूर्णिमा संपूर्ण वैदिक किट',
    subtitle:
      '100% शुद्ध सामग्री के साथ 10% अतिरिक्त छूट — मासिक सब्सक्रिप्शन पर हर माह समय पर होम डिलीवरी।',
    promoCode: 'GANESH10',
    primaryLabel: 'विशेष किट देखें',
    secondaryLabel: 'कोड कॉपी करें',
    actionType: 'pooja_box',
    searchKeyword: 'सत्यनारायण',
  },
  {
    id: 'griha-pravesh-latest-offer',
    image: '/src/assets/images/hero_festival_mahapuja_1795112260665.jpg',
    kicker: 'नवीनतम पूजा ऑफर · गृह प्रवेश व महापर्व',
    title: 'संपूर्ण हवन सामग्री किट एवं सत्यापित पंडित बुकिंग',
    subtitle:
      'शुभ मुहूर्त पर घर बैठे संपूर्ण हवन-पूजन व्यवस्था — तुरंत ऑर्डर पर ₹51 की सीधी बचत (कोड: PUJA51)।',
    promoCode: 'PUJA51',
    primaryLabel: 'पंडित जी बुक करें',
    secondaryLabel: 'कोड कॉपी करें',
    actionType: 'pandit',
  },
  {
    id: 'divine-murti-festive-offer',
    image: '/src/assets/images/hero_murti_collection_1795112369375.jpg',
    kicker: 'उत्सव विशेष संग्रह · इको-फ्रेंडली व शुद्ध नर्मदेश्वर',
    title: 'गणेश मूर्ति, नर्मदेश्वर शिवलिंग व पूजन फोटो फ्रेम',
    subtitle:
      'सुरक्षित पैकेजिंग व संपूर्ण भारत में त्वरित डिलीवरी — घर के मंदिर के लिए प्रमाणित दिव्य संग्रह।',
    promoCode: 'GANESH10',
    primaryLabel: 'मूर्ति संग्रह देखें',
    secondaryLabel: 'सभी पूजा किट',
    actionType: 'murti',
  },
];

interface HeroOfferSliderProps {
  paused?: boolean;
  onNavigatePage: (page: 'pooja_box' | 'pandit' | 'murti', searchKeyword?: string) => void;
  onCopyPromo: (code: string) => void;
}

export const HeroOfferSlider: React.FC<HeroOfferSliderProps> = ({
  paused = false,
  onNavigatePage,
  onCopyPromo,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const total = HERO_OFFER_SLIDES.length;
  const activeSlide = HERO_OFFER_SLIDES[activeIndex];

  useEffect(() => {
    if (paused || isHovered) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [paused, isHovered, total]);

  const goPrev = () => setActiveIndex((prev) => (prev - 1 + total) % total);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % total);

  return (
    <div
      className="relative w-full lg:min-h-[500px] lg:flex lg:flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-roledescription="carousel"
      aria-label="विशेष पूजा किट एवं नवीनतम ऑफर स्लाइडर"
    >
      {/* Full-Bleed Section Background Slide Images with Smooth Bottom Fade */}
      <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
        {HERO_OFFER_SLIDES.map((slide, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div
              key={slide.id}
              aria-hidden={!isActive}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {!failedImages[slide.id] ? (
                <img
                  src={slide.image}
                  alt={slide.title}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImages((prev) => ({ ...prev, [slide.id]: true }))}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#450a0a] via-[#7f1d1d] to-[#9a3412]" />
              )}
            </div>
          );
        })}

        {/* Clean image on mobile/tablet (soft bottom dot scrim); left text scrim on desktop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:bg-gradient-to-r lg:from-black/70 lg:via-black/35 lg:to-transparent" />
      </div>

      {/* Left / Right Navigation Arrows */}
      <button
        type="button"
        onClick={goPrev}
        aria-label="पिछला ऑफर"
        className="hidden md:flex absolute left-3 lg:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white border border-white/25 items-center justify-center transition cursor-pointer backdrop-blur-xs"
      >
        <i className="fa-solid fa-chevron-left text-xs" />
      </button>
      <button
        type="button"
        onClick={goNext}
        aria-label="अगला ऑफर"
        className="hidden md:flex absolute right-3 lg:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white border border-white/25 items-center justify-center transition cursor-pointer backdrop-blur-xs"
      >
        <i className="fa-solid fa-chevron-right text-xs" />
      </button>

      {/* Foreground Offer Copy */}
      <div className="relative z-20 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 pb-8 sm:pt-9 sm:pb-11 lg:pt-14 lg:pb-14 min-h-[190px] sm:min-h-[245px] md:min-h-[295px] lg:min-h-[500px] flex flex-col justify-end">
        <div className="max-w-6xl mx-auto md:px-6 lg:px-2 w-full lg:flex-1 lg:flex lg:flex-col lg:justify-between">
          <div className="hidden lg:flex lg:my-auto flex-col justify-center max-w-2xl text-left">
            <div className="text-[11px] sm:text-xs font-bold tracking-wide text-amber-300 mb-1.5">
              {activeSlide.kicker}
            </div>
            <h1 className="text-lg sm:text-2xl md:text-[1.85rem] font-extrabold text-white leading-snug text-balance drop-shadow-xs">
              {activeSlide.title}
            </h1>
            <p className="text-xs sm:text-sm text-orange-100/95 mt-2 max-w-xl leading-relaxed line-clamp-2">
              {activeSlide.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => onNavigatePage(activeSlide.actionType, activeSlide.searchKeyword)}
                className="px-4 sm:px-5 py-2.5 rounded-xl bg-saffron hover:bg-orange-600 text-white text-xs sm:text-sm font-extrabold shadow-md transition cursor-pointer whitespace-nowrap"
              >
                {activeSlide.primaryLabel}
              </button>

              {activeSlide.promoCode && activeSlide.secondaryLabel === 'कोड कॉपी करें' ? (
                <button
                  type="button"
                  onClick={() => onCopyPromo(activeSlide.promoCode!)}
                  className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs sm:text-sm font-bold backdrop-blur-xs transition cursor-pointer whitespace-nowrap"
                >
                  <i className="fa-regular fa-copy mr-1.5 text-amber-300" />
                  {activeSlide.promoCode} कॉपी करें
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigatePage('pooja_box')}
                  className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs sm:text-sm font-bold backdrop-blur-xs transition cursor-pointer whitespace-nowrap"
                >
                  {activeSlide.secondaryLabel}
                </button>
              )}
            </div>
          </div>

          {/* Pagination Indicators & Slide Counter */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              {HERO_OFFER_SLIDES.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={`स्लाइड ${idx + 1}: ${slide.title}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === activeIndex
                      ? 'w-7 bg-amber-300'
                      : 'w-2 bg-white/45 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-bold text-white/85 tabular-nums">
              {activeIndex + 1} / {total}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
