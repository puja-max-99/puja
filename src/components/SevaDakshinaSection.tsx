import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { DonationRecord, SiteSettings, UserProfile } from '../types/puja';

interface SevaDakshinaSectionProps {
  settings: SiteSettings;
  user: UserProfile | null;
  onReceiptGenerated: (donation: DonationRecord) => void;
  showToast: (msg: string) => void;
}

const CAUSES = [
  '🐄 गौ सेवा (चारा व गुड़)',
  '🪔 मंदिर दीपदान सेवा',
  '🍚 अन्नदान महासेवा',
  '🛕 मंदिर धार्मिक दक्षिणा',
];

const QUICK_AMOUNTS = [11, 21, 51, 101, 251, 501];

const DEFAULT_TICKER = [
  'अभी 12 मिनट पहले अमित वर्मा जी ने ₹101 की गौ सेवा दक्षिणा अर्पण की',
  'अभी 28 मिनट पहले प्रिया शर्मा जी ने ₹51 का मंदिर दीपदान किया',
  'अभी 45 मिनट पहले राजेश गुप्ता जी ने ₹251 की अन्नदान सेवा अर्पण की',
  'अभी 1 घंटे पहले सुनीता देवी जी ने ₹101 की मंदिर दक्षिणा भेजी',
];

export const SevaDakshinaSection: React.FC<SevaDakshinaSectionProps> = ({
  settings,
  user,
  onReceiptGenerated,
  showToast,
}) => {
  const [cause, setCause] = useState(CAUSES[0]);
  const [amount, setAmount] = useState(51);
  const [donorName, setDonorName] = useState(user?.name || '');
  const [donorCity, setDonorCity] = useState('');
  const [tickerItems, setTickerItems] = useState<string[]>(DEFAULT_TICKER);
  const [tickerIdx, setTickerIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.name && !donorName) {
      setDonorName(user.name);
    }
  }, [user, donorName]);

  useEffect(() => {
    apiFetch<Array<{ donorName: string; cause: string; amount: number }>>('/api/donations/recent')
      .then((rows) => {
        if (rows.length > 0) {
          const liveMsgs = rows.map(
            (r) => `${r.donorName} जी ने ₹${r.amount} की ${r.cause} अर्पण की`
          );
          setTickerItems([...liveMsgs, ...DEFAULT_TICKER]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIdx((prev) => (prev + 1) % tickerItems.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [tickerItems.length]);

  const safeAmt = amount >= 1 ? amount : 11;
  const cleanNote = cause.replace(/[^\w\s()&-]/gi, '').trim() || 'Seva Dakshina';
  const upiUrl = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(
    settings.payeeName
  )}&am=${safeAmt}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(
    upiUrl
  )}`;

  const handleCopyUpi = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(settings.upiId).catch(() => {});
    }
    showToast(`UPI ID कॉपी हो गई: ${settings.upiId}`);
  };

  const handleGenerateReceipt = async () => {
    setSaving(true);
    try {
      const created = await apiFetch<DonationRecord>('/api/donations', {
        method: 'POST',
        body: JSON.stringify({
          donorName: donorName.trim() || 'श्रद्धालु भक्त',
          donorCity: donorCity.trim(),
          cause,
          amount: safeAmt,
        }),
      });
      onReceiptGenerated(created);
      setTickerItems((prev) => [
        `अभी-अभी ${created.donorName} जी ने ₹${created.amount} की ${created.cause} अर्पण की`,
        ...prev,
      ]);
      setTickerIdx(0);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'रसीद जनरेट नहीं हो सकी।');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="seva-dakshina-section"
      className="mt-12 bg-gradient-to-br from-amber-50/75 via-white to-orange-50/75 rounded-2xl border border-amber-200 shadow-xs p-5 sm:p-7"
    >
      <div className="text-center max-w-2xl mx-auto mb-6">
        <div className="text-xs font-extrabold tracking-wide text-saffron mb-1">
          100% श्रद्धा · त्वरित UPI QR व डिजिटल आशीर्वाद रसीद
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900">
          धार्मिक सेवा एवं श्रद्धा दक्षिणा (Seva Dakshina)
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          गौ सेवा, मंदिर दीपदान, अन्नदान या मंदिर दक्षिणा के लिए अपनी इच्छानुसार राशि अर्पण करें और तुरंत डिजिटल रसीद प्राप्त करें।
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div>
            <div className="text-xs font-extrabold text-gray-800 mb-2">
              चरण 1: सेवा का उद्देश्य चुनें
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CAUSES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCause(c)}
                  className={
                    cause === c
                      ? 'px-3.5 py-2.5 rounded-xl border border-saffron bg-orange-50 text-saffron font-extrabold text-xs text-left transition cursor-pointer'
                      : 'px-3.5 py-2.5 rounded-xl border border-gray-200 hover:border-orange-300 bg-white text-gray-800 font-bold text-xs text-left transition cursor-pointer'
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-extrabold text-gray-800 mb-2">
              चरण 2: श्रद्धा राशि (Amount) चुनें या लिखें
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={
                    amount === amt
                      ? 'py-2 rounded-xl border border-saffron bg-saffron text-white font-extrabold text-xs transition cursor-pointer tabular-nums'
                      : 'py-2 rounded-xl border border-gray-200 bg-white hover:border-orange-300 text-gray-900 font-extrabold text-xs transition cursor-pointer tabular-nums'
                  }
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-abhiRed text-sm">
                ₹
              </span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || '11', 10)))}
                placeholder="अन्य राशि लिखें"
                className="w-full pl-8 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-extrabold text-gray-900 bg-white focus:outline-none focus:border-abhiRed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                आपका शुभ नाम (रसीद हेतु)
              </label>
              <input
                type="text"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder="जैसे: राजेश शर्मा"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-abhiRed"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                शहर / गोत्र (Optional)
              </label>
              <input
                type="text"
                value={donorCity}
                onChange={(e) => setDonorCity(e.target.value)}
                placeholder="जैसे: जमशेदपुर / भारद्वाज"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-abhiRed"
              />
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-xl p-3.5">
            <div className="flex justify-between text-xs font-extrabold text-amber-950 mb-1.5">
              <span>🎯 साप्ताहिक गौ सेवा एवं अन्नदान संकल्प</span>
              <span>74% पूर्ण</span>
            </div>
            <div className="w-full h-2.5 bg-amber-100 rounded-full overflow-hidden mb-2">
              <div className="h-full w-[74%] bg-gradient-to-r from-saffron to-abhiRed rounded-full" />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping shrink-0" />
              <span>{tickerItems[tickerIdx]}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border-2 border-dashed border-amber-300 rounded-2xl p-5 text-center shadow-2xs">
          <div className="bg-orange-50 text-saffron border border-orange-200 rounded-xl py-2 px-3 text-xs font-extrabold mb-3">
            {cause} — ₹{safeAmt}
          </div>
          <img
            src={qrUrl}
            alt="UPI QR Code"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://placehold.co/180x180/fff7ed/ea580c?text=UPI+QR';
            }}
            className="w-40 h-40 mx-auto rounded-xl border border-gray-200 p-1.5 bg-white mb-3"
          />
          <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 mb-3 text-xs font-extrabold text-amber-950">
            <span>{settings.upiId}</span>
            <button
              type="button"
              onClick={handleCopyUpi}
              className="bg-amber-900 hover:bg-black text-white px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
            >
              Copy
            </button>
          </div>
          <a
            href={upiUrl}
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition mb-2"
          >
            <i className="fa-solid fa-mobile-screen-button mr-1.5" />
            PhonePe / GPay / Paytm से अर्पण करें
          </a>
          <button
            type="button"
            disabled={saving}
            onClick={handleGenerateReceipt}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-extrabold py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition cursor-pointer"
          >
            <i className="fa-solid fa-receipt mr-1.5" />
            {saving ? 'रसीद बन रही है...' : 'दक्षिणा भेज दी — रसीद प्राप्त करें'}
          </button>
        </div>
      </div>
    </section>
  );
};
