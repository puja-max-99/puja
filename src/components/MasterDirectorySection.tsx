import React from 'react';
import type { MasterCategory } from '../types/puja';

interface MasterDirectorySectionProps {
  categories: MasterCategory[];
  activeDirCatId: string | null;
  onSelectDirCat: (catId: string | null) => void;
  onFilterByMasterCat: (catId: string) => void;
  onOpenPujaDetail: (pujaName: string, catCode: string, deity: string) => void;
  onFocusSearch: () => void;
}

const CAT_ICONS = [
  'fa-om',
  'fa-sun',
  'fa-hands-praying',
  'fa-calendar-week',
  'fa-moon',
  'fa-leaf',
  'fa-fire-flame-curved',
  'fa-gopuram',
  'fa-star-and-crescent',
  'fa-fire',
  'fa-house-chimney',
  'fa-baby',
  'fa-water',
  'fa-bell',
  'fa-clock',
  'fa-map-location-dot',
  'fa-book-open',
];

export const MasterDirectorySection: React.FC<MasterDirectorySectionProps> = ({
  categories,
  activeDirCatId,
  onSelectDirCat,
  onFilterByMasterCat,
  onOpenPujaDetail,
  onFocusSearch,
}) => {
  const selectedCat = activeDirCatId
    ? categories.find((c) => c.id === activeDirCatId) || null
    : null;

  return (
    <section
      id="masterDirectorySection"
      className="mt-8 sm:mt-12 bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-xs overflow-hidden"
    >
      <div className="bg-gradient-to-r from-abhiRed via-[#c92a2a] to-saffron text-white p-4 sm:p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs font-bold tracking-wide text-amber-200 mb-1">
              संपूर्ण वैदिक पंचांग · मल्टी-टैग कैटलॉग
            </div>
            <h2 className="text-base sm:text-xl md:text-2xl font-extrabold text-white leading-snug">
              हिंदू पूजा मास्टर डायरेक्टरी (17 मुख्य श्रेणियां)
            </h2>
            <p className="text-[11px] sm:text-xs text-orange-100 mt-1 leading-relaxed">
              किसी भी श्रेणी पर क्लिक कर पूजा लिस्ट खोलें, या किसी भी पूजा पर क्लिक करके मुहूर्त, सामग्री, विधि व मंत्र पढ़ें
            </p>
          </div>
          <button
            type="button"
            onClick={onFocusSearch}
            className="w-full md:w-auto justify-center shrink-0 bg-white/15 hover:bg-white/25 border border-white/30 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
          >
            <i className="fa-solid fa-magnifying-glass" /> ऊपर मास्टर सर्च में खोजें ↑
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-5 md:p-6">
        {selectedCat ? (
          <div className="bg-cream border border-orange-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 sm:pb-4 mb-3.5 sm:mb-4 border-b border-orange-200/70">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectDirCat(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-800 hover:text-abhiRed bg-white border border-gray-200 px-3 py-1.5 rounded-xl mb-2 transition cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-left" /> सभी 17 प्रमुख श्रेणियां देखें
                </button>
                <h3 className="text-base sm:text-xl font-extrabold text-gray-900 leading-snug">
                  {selectedCat.code}
                </h3>
                <p className="text-[11px] sm:text-xs font-semibold text-gray-600 mt-0.5">
                  आराध्य देव: {selectedCat.deity} · कुल {selectedCat.items.length} पूजाएं
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onFilterByMasterCat(selectedCat.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full sm:w-auto shrink-0 bg-abhiRed hover:bg-abhiRedDark text-white px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer text-center"
              >
                इस श्रेणी की किट व पंडित बुक करें →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5">
              {selectedCat.items.map((pujaName, idx) => (
                <button
                  key={`${selectedCat.id}-${idx}`}
                  type="button"
                  onClick={() => onOpenPujaDetail(pujaName, selectedCat.code, selectedCat.deity)}
                  className="flex items-center justify-between gap-2 text-left p-2.5 sm:p-3 rounded-xl bg-white hover:bg-orange-50/60 border border-gray-200 hover:border-saffron text-xs sm:text-sm font-bold text-gray-800 hover:text-abhiRed transition cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="text-saffron font-extrabold mr-1.5 tabular-nums">{idx + 1}.</span>
                    {pujaName}
                  </span>
                  <i className="fa-solid fa-chevron-right text-[10px] text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {categories.map((cat, idx) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectDirCat(cat.id)}
                className="group text-left rounded-xl sm:rounded-2xl border border-gray-200 hover:border-saffron bg-white hover:bg-orange-50/40 p-3 sm:p-4 hover:shadow-md transition flex flex-col justify-between cursor-pointer min-w-0"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-2.5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-orange-50 group-hover:bg-saffron text-saffron group-hover:text-white flex items-center justify-center text-xs sm:text-sm transition shrink-0">
                      <i className={`fa-solid ${CAT_ICONS[idx % CAT_ICONS.length]}`} />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-gray-500 tabular-nums shrink-0">
                      {cat.items.length} पूजाएं
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm md:text-base font-extrabold text-gray-900 group-hover:text-abhiRed leading-snug line-clamp-2">
                    {cat.code}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 font-semibold mt-1 line-clamp-1">
                    आराध्य: {cat.deity}
                  </p>
                </div>
                <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] sm:text-xs font-extrabold text-saffron group-hover:text-abhiRed">
                  <span>पूजा लिस्ट</span>
                  <i className="fa-solid fa-arrow-right transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
