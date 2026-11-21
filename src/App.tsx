import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SpeechToSpeech } from './components/SpeechToSpeech';
import { TextToSpeech } from './components/TextToSpeech';
import { VoiceLibrary } from './components/VoiceLibrary';
import { AudioHistory } from './components/AudioHistory';
import { ApkInstallModal } from './components/ApkInstallModal';
import { VOICES } from './data/voices';
import { Voice, GeneratedAudio } from './types';
import { Sparkles, Mic, Volume2, ShieldCheck, HeartHandshake, Smartphone } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'speech-to-speech' | 'text-to-speech' | 'voices' | 'history'>('text-to-speech');
  const [lang, setLang] = useState<'en' | 'hi'>('hi'); // Default Hindi / Hinglish friendly as requested
  const [voices, setVoices] = useState<Voice[]>(VOICES);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(VOICES[0]);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);

  // Persistent History
  const [history, setHistory] = useState<GeneratedAudio[]>(() => {
    try {
      const saved = localStorage.getItem('vocalis_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vocalis_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save history to localStorage', e);
    }
  }, [history]);

  const handleAudioGenerated = (newAudio: GeneratedAudio) => {
    setHistory((prev) => [newAudio, ...prev]);
  };

  const handleClearHistory = () => {
    if (window.confirm(lang === 'hi' ? 'क्या आप पूरी हिस्ट्री हटाना चाहते हैं?' : 'Clear all history?')) {
      setHistory([]);
    }
  };

  const handleDeleteAudio = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDeleteMultipleAudio = (ids: string[]) => {
    setHistory((prev) => prev.filter((item) => !ids.includes(item.id)));
  };

  const handleAddCustomVoice = (newVoice: Voice) => {
    setVoices((prev) => [newVoice, ...prev]);
  };

  const handleUseVoice = (voice: Voice, mode: 'speech-to-speech' | 'text-to-speech') => {
    setSelectedVoice(voice);
    setActiveTab(mode);
  };

  return (
    <div className="min-h-screen bg-[#070A11] text-neutral-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
        historyCount={history.length}
        onOpenApkModal={() => setIsApkModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Quick Studio Mode Bar (ElevenLabs Style) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-[#0E131F] border border-white/10 rounded-2xl shadow-xl">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('text-to-speech')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'text-to-speech'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 ring-1 ring-orange-400/40'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{lang === 'hi' ? '📝 टेक्स्ट से आवाज़ (Text to Speech)' : '📝 Text to Speech'}</span>
            </button>

            <button
              onClick={() => setActiveTab('speech-to-speech')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'speech-to-speech'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 ring-1 ring-orange-400/40'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>{lang === 'hi' ? '🎙️ आवाज़ बदलें (Speech to Speech)' : '🎙️ Speech to Speech'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick APK Button in Studio Bar */}
            <button
              onClick={() => setIsApkModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-semibold transition-all cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? '📱 फोन में APK / ऐप लगाएं' : '📱 Install Mobile App'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-3 pr-2 text-xs text-neutral-400">
              <span className="flex items-center gap-1 text-orange-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{selectedVoice.name}</span>
              </span>
              <span>•</span>
              <span>{selectedVoice.accent}</span>
            </div>
          </div>
        </div>

        {activeTab === 'speech-to-speech' && (
          <SpeechToSpeech
            voices={voices}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            onAudioGenerated={handleAudioGenerated}
            lang={lang}
          />
        )}

        {activeTab === 'text-to-speech' && (
          <TextToSpeech
            voices={voices}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            onAudioGenerated={handleAudioGenerated}
            lang={lang}
          />
        )}

        {activeTab === 'voices' && (
          <VoiceLibrary
            voices={voices}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            onUseVoice={handleUseVoice}
            onAddCustomVoice={handleAddCustomVoice}
            lang={lang}
          />
        )}

        {activeTab === 'history' && (
          <AudioHistory
            history={history}
            onClearHistory={handleClearHistory}
            onDeleteAudio={handleDeleteAudio}
            onDeleteMultipleAudio={handleDeleteMultipleAudio}
            lang={lang}
          />
        )}
      </main>

      {/* APK / Mobile Install Guide Modal */}
      <ApkInstallModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
        lang={lang}
      />

      {/* Studio Footer */}
      <footer className="border-t border-white/10 bg-[#0B0F17]/80 backdrop-blur-md py-6 px-4 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-300">Vocalis AI Studio</span>
            <span>•</span>
            <span>{lang === 'hi' ? 'ElevenLabs स्तर का वॉइस जनरेटर & कनवर्टर' : 'ElevenLabs-grade AI Voice Synthesis'}</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Studio 24kHz Lossless Audio</span>
            </span>
            <span>•</span>
            <button
              onClick={() => setIsApkModalOpen(true)}
              className="text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'Android APK / App Guide' : 'Install on Android'}</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
