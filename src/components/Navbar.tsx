import React from 'react';
import { Mic, Volume2, Sparkles, History, Radio, Languages, Music, Smartphone } from 'lucide-react';

interface NavbarProps {
  activeTab: 'speech-to-speech' | 'text-to-speech' | 'voices' | 'history';
  setActiveTab: (tab: 'speech-to-speech' | 'text-to-speech' | 'voices' | 'history') => void;
  lang: 'en' | 'hi';
  setLang: (lang: 'en' | 'hi') => void;
  historyCount: number;
  onOpenApkModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  lang,
  setLang,
  historyCount,
  onOpenApkModal,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-[#0B0F17]/90 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-violet-600 shadow-lg shadow-orange-500/20 text-white font-bold">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg lg:text-xl tracking-tight text-white bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                Vocalis AI
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30">
                Studio
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 hidden sm:block">
              {lang === 'hi'
                ? 'ElevenLabs स्टाइल वॉइस कनवर्टर & जेनरेटर'
                : 'Realistic Voice Converter & Speech Synthesis'}
            </p>
          </div>
        </div>

        {/* Center Tabs */}
        <nav className="flex items-center gap-1.5 p-1 bg-white/[0.04] border border-white/10 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('text-to-speech')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === 'text-to-speech'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20 font-semibold'
                : 'text-neutral-300 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{lang === 'hi' ? 'टेक्स्ट से वॉइस (TTS)' : 'Text-to-Speech'}</span>
          </button>

          <button
            onClick={() => setActiveTab('speech-to-speech')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === 'speech-to-speech'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20 font-semibold'
                : 'text-neutral-300 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{lang === 'hi' ? 'आवाज़ बदलें (Voice Changer)' : 'Speech-to-Speech'}</span>
          </button>

          <button
            onClick={() => setActiveTab('voices')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === 'voices'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20 font-semibold'
                : 'text-neutral-300 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{lang === 'hi' ? 'वॉइस लाइब्रेरी' : 'Voice Library'}</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap relative ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20 font-semibold'
                : 'text-neutral-300 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{lang === 'hi' ? 'इतिहास' : 'History'}</span>
            {historyCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
                {historyCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Tools & Language Toggle */}
        <div className="flex items-center gap-2">
          {/* APK / Mobile App Install Button */}
          {onOpenApkModal && (
            <button
              onClick={onOpenApkModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500 text-orange-300 hover:text-white border border-orange-500/30 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              title={lang === 'hi' ? 'फोन में ऐप / APK इंस्टॉल करें' : 'Get APK / Mobile App'}
            >
              <Smartphone className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">{lang === 'hi' ? 'APK / ऐप' : 'APK / App'}</span>
            </button>
          )}

          {/* Language Switch */}
          <button
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Switch Language / भाषा बदलें"
          >
            <Languages className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-semibold">{lang === 'en' ? 'हिंदी' : 'English'}</span>
          </button>

          {/* ElevenLabs Style Live Indicator */}
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>HD 24kHz</span>
          </div>
        </div>
      </div>
    </header>
  );
};
