import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  X,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Share2,
} from 'lucide-react';

interface ApkInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'hi';
}

export const ApkInstallModal: React.FC<ApkInstallModalProps> = ({ isOpen, onClose, lang }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.origin);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl || window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#0E1322] border border-orange-500/30 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top Header */}
        <div className="relative p-6 bg-gradient-to-r from-orange-600/20 via-amber-600/15 to-violet-600/20 border-b border-white/10 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30 text-white">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[11px] font-semibold mb-1 border border-orange-500/30">
                <Sparkles className="w-3 h-3" />
                <span>Android & Mobile App (APK / PWA)</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {lang === 'hi' ? 'फोन में ऐप / APK कैसे पाएं' : 'Install as Android App / Get APK'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Quick Install Banner if native browser supports it */}
          {isInstallable && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {lang === 'hi' ? '1-क्लिक डायरेक्ट इंस्टॉलेशन उपलब्ध है!' : '1-Click Direct Install Available!'}
                  </h4>
                  <p className="text-xs text-neutral-300">
                    {lang === 'hi'
                      ? 'आपका ब्राउज़र सीधे WebAPK इंस्टॉल करने के लिए तैयार है।'
                      : 'Your browser is ready to install Vocalis AI directly to your device.'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleNativeInstall}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-lg shadow-emerald-500/25 active:scale-95 whitespace-nowrap cursor-pointer"
              >
                {lang === 'hi' ? 'अभी इनस्टॉल करें' : 'Install Now'}
              </button>
            </div>
          )}

          {/* Method 1: Android Chrome WebAPK Install (The standard way) */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-black flex items-center justify-center">
                  1
                </span>
                <h4 className="text-sm font-bold text-white">
                  {lang === 'hi'
                    ? 'एंड्रॉयड फोन पर डायरेक्ट ऐप इंस्टॉल करें (Recommended WebAPK)'
                    : 'Install directly on Android Phone (Recommended)'}
                </h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-semibold border border-orange-500/20">
                100% Free & Fast
              </span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              {lang === 'hi'
                ? 'Android Chrome में इस ऐप को खोलते ही Google Play Service इसे अपने-आप एक असली Android APK (WebAPK) में बदल देती है:'
                : 'Android creates a real standalone APK package on your device with full screen access and home screen launch icon:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Step 1</span>
                <p className="text-xs text-neutral-200">
                  {lang === 'hi'
                    ? 'फोन में Chrome खोलें और इस ऐप का लिंक पेस्ट करें।'
                    : 'Open this App URL in Chrome on your Android mobile.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Step 2</span>
                <p className="text-xs text-neutral-200">
                  {lang === 'hi'
                    ? 'ऊपर 3 डॉट्स (⋮) मेनू पर क्लिक करें।'
                    : 'Tap the top-right 3-dots (⋮) Chrome menu.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Step 3</span>
                <p className="text-xs text-neutral-200">
                  {lang === 'hi'
                    ? '"Install app" या "होम स्क्रीन पर जोड़ें" दबाएं। यह तुरंत ऐप बन जाएगी!'
                    : 'Tap "Install app" or "Add to Home screen". Your app icon will appear!'}
                </p>
              </div>
            </div>

            {/* Copy Link Row */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <div className="w-full flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-neutral-300 font-mono truncate">
                {currentUrl || window.location.href}
              </div>
              <button
                onClick={handleCopyUrl}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer whitespace-nowrap"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">लिंक कॉपी हो गया!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>लिंक कॉपी करें (Copy Link)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Method 2: Convert to Standalone .APK via PWABuilder / Bubblewrap */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h4 className="text-sm font-bold text-white">
                  {lang === 'hi'
                    ? 'अलग से .APK फ़ाइल डाउनलोड करना (PWABuilder / Bubblewrap)'
                    : 'Generate Standalone .APK File for Sharing / Sideloading'}
                </h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 font-semibold border border-violet-500/20">
                Play Store / Direct APK
              </span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              {lang === 'hi'
                ? 'अगर आपको दोस्तों को WhatsApp/Telegram पर भेजने के लिए अलग से `.apk` फ़ाइल चाहिए, तो Microsoft और Google का आधिकारिक टूल **PWABuilder** इस ऐप के URL से 1 मिनट में रेडीमेड साइन की हुई `.apk` फाइल बना देता है:'
                : 'To download a raw installable `.apk` file for sideloading or sharing on WhatsApp/Drive, use PWABuilder:'}
            </p>

            <div className="p-3.5 bg-black/40 rounded-xl border border-white/5 space-y-2 text-xs text-neutral-300">
              <div className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <span>
                  1. ऊपर दिए गए बटन से इस ऐप का <strong>URL कॉपी</strong> करें।
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <span>
                  2. <strong>PWABuilder.com</strong> पर जाएं और बॉक्स में यह URL पेस्ट करके <strong>Start</strong> दबाएं।
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <span>
                  3. <strong>Package for Android</strong> चुनकर <strong>Generate APK</strong> पर क्लिक करें। आपका `.apk` तुरंत डाउनलोड हो जाएगा!
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <a
                href="https://www.pwabuilder.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-violet-600/30 cursor-pointer"
              >
                <span>PWABuilder खोलें और APK बनाएं</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>PWA & Manifest Ready • Offline Cached • Standalone Mode</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold border border-white/10 transition-colors"
          >
            {lang === 'hi' ? 'समझ आ गया (Close)' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
