import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  Filter,
  Plus,
  Mic,
  Volume2,
  Check,
  Languages,
  User,
  Radio,
  Tag,
  X,
  Square,
} from 'lucide-react';
import { Voice } from '../types';
import { AudioVisualizer } from './AudioVisualizer';
import { base64ToBlobUrl } from '../utils/audio';

interface VoiceLibraryProps {
  voices: Voice[];
  selectedVoice: Voice;
  setSelectedVoice: (voice: Voice) => void;
  onUseVoice: (voice: Voice, mode: 'speech-to-speech' | 'text-to-speech') => void;
  onAddCustomVoice: (voice: Voice) => void;
  lang: 'en' | 'hi';
}

export const VoiceLibrary: React.FC<VoiceLibraryProps> = ({
  voices,
  selectedVoice,
  setSelectedVoice,
  onUseVoice,
  onAddCustomVoice,
  lang,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterGender, setFilterGender] = useState<string>('All');
  const [filterAge, setFilterAge] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Audio Player Ref for immediate sample preview
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [cachedPreviews, setCachedPreviews] = useState<Record<string, string>>({});

  // Active full player state
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [previewAudioBase64, setPreviewAudioBase64] = useState<string | null>(null);

  // Custom Voice Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customVoiceName, setCustomVoiceName] = useState<string>('Kore');
  const [customGender, setCustomGender] = useState<'Female' | 'Male' | 'Neutral'>('Female');
  const [customAge, setCustomAge] = useState<'Young' | 'Middle-aged' | 'Old'>('Young');
  const [customAccent, setCustomAccent] = useState<string>('Indian Hindi');
  const [customCategory, setCustomCategory] = useState<string>('Custom Studio');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [customSampleText, setCustomSampleText] = useState<string>('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  const playBase64 = (voiceId: string, base64: string) => {
    const url = base64ToBlobUrl(base64, 'audio/wav');
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = url;
      audioPlayerRef.current
        .play()
        .then(() => {
          setCurrentPlayingId(voiceId);
          setPreviewVoiceId(voiceId);
          setPreviewAudioBase64(base64);
        })
        .catch((e) => console.error('Play error:', e));
    }
  };

  // Handle Voice Sample Play
  const handlePlaySample = async (voice: Voice) => {
    // If this voice is currently playing, pause it
    if (currentPlayingId === voice.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setCurrentPlayingId(null);
      return;
    }

    // Stop any previously playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    // If already generated and cached, play instantly
    if (cachedPreviews[voice.id]) {
      playBase64(voice.id, cachedPreviews[voice.id]);
      return;
    }

    // Otherwise generate speech preview from sampleText
    setLoadingVoiceId(voice.id);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voice.sampleText,
          voiceName: voice.voiceName,
          style: voice.description,
        }),
      });

      const data = await response.json();
      if (data.audioBase64) {
        setCachedPreviews((prev) => ({ ...prev, [voice.id]: data.audioBase64 }));
        playBase64(voice.id, data.audioBase64);
      }
    } catch (err) {
      console.error('Failed to preview sample:', err);
    } finally {
      setLoadingVoiceId(null);
    }
  };

  // Add custom voice
  const handleCreateVoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newVoice: Voice = {
      id: 'custom-' + Date.now(),
      name: customName.trim(),
      voiceName: customVoiceName,
      gender: customGender,
      age: customAge,
      accent: customAccent.trim() || 'Custom',
      category: customCategory.trim() || 'Custom Persona',
      description: customDescription.trim() || 'Personal custom voice preset.',
      tags: ['Custom', customAccent.trim(), customGender, customAge],
      sampleText:
        customSampleText.trim() ||
        'This is my custom crafted AI voice model, tuned for realistic vocal delivery.',
      isCustom: true,
    };

    onAddCustomVoice(newVoice);
    setSelectedVoice(newVoice);
    setIsModalOpen(false);
    setCustomName('');
    setCustomDescription('');
  };

  // Filter voices
  const filteredVoices = voices.filter((v) => {
    const matchesCategory =
      filterCategory === 'All' ||
      (filterCategory === 'Hindi' && (v.accent.includes('Hindi') || v.tags.includes('Hindi'))) ||
      v.category.toLowerCase().includes(filterCategory.toLowerCase());

    const matchesGender = filterGender === 'All' || v.gender === filterGender;
    const matchesAge = filterAge === 'All' || v.age === filterAge;

    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.accent.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesGender && matchesAge && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 bg-gradient-to-r from-violet-500/10 via-orange-500/10 to-amber-500/10 border border-white/10 rounded-2xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'hi' ? 'ElevenLabs वॉइस लाइब्रेरी' : 'ElevenLabs Voice Catalog'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {lang === 'hi' ? 'रियलिस्टिक वॉइस लाइब्रेरी' : 'Realistic Voice Library'}
          </h2>
          <p className="text-sm text-neutral-300 mt-1 max-w-2xl">
            {lang === 'hi'
              ? 'हिंदी, हिंग्लिश और इंटरनेशनल आवाज़ों की क्यूरेटेड सूची। किसी भी आवाज़ को टेस्ट करें और अपनी पसंदीदा आवाज़ चुनें।'
              : 'Explore hyper-realistic voices curated for narration, podcasts, YouTube reels, Hindi storytelling, and character design.'}
          </p>
        </div>

        {/* Custom Voice Creator Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'hi' ? 'नई वॉइस डिज़ाइन करें' : 'Create Custom Voice'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#0E131F] border border-white/10 rounded-2xl space-y-3.5">
        {/* Prominent Gender Selector Tabs (User Request: Male / Female Voice Option) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 mr-1">
              <User className="w-3.5 h-3.5 text-orange-400" />
              <span>{lang === 'hi' ? 'वॉइस जेंडर चुनें:' : 'Select Gender:'}</span>
            </span>

            <div className="flex items-center p-1 bg-[#141B2B] border border-white/10 rounded-xl gap-1">
              <button
                onClick={() => setFilterGender('All')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterGender === 'All'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {lang === 'hi' ? 'सभी आवाज़ें' : 'All Voices'} ({voices.length})
              </button>

              <button
                onClick={() => setFilterGender('Female')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterGender === 'Female'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>👩</span>
                <span>{lang === 'hi' ? 'Female (महिला आवाज़ें)' : 'Female Voices'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                  {voices.filter((v) => v.gender === 'Female').length}
                </span>
              </button>

              <button
                onClick={() => setFilterGender('Male')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterGender === 'Male'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/20'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>👨</span>
                <span>{lang === 'hi' ? 'Male (पुरुष आवाज़ें)' : 'Male Voices'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                  {voices.filter((v) => v.gender === 'Male').length}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="font-semibold text-white">{filteredVoices.length}</span>
            <span>{lang === 'hi' ? 'आवाज़ें उपलब्ध' : 'voices matching'}</span>
          </div>
        </div>

        {/* Categories, Age & Search Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {['All', 'Hindi', 'Narration', 'Cinematic', 'Casual', 'News', 'Corporate'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {cat === 'Hindi' && '🇮🇳 '}
                {cat === 'All' && (lang === 'hi' ? 'सभी कैटेगरीज' : 'All Categories')}
                {cat !== 'All' && cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Age Filter: Young, Middle-aged, Old */}
            <select
              value={filterAge}
              onChange={(e) => setFilterAge(e.target.value)}
              className="bg-[#141B2B] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="All">{lang === 'hi' ? 'सभी उम्र (All Ages)' : 'All Ages'}</option>
              <option value="Young">🧒 {lang === 'hi' ? 'युवा (Young 18-25)' : 'Young (18-25)'}</option>
              <option value="Middle-aged">🧑 {lang === 'hi' ? 'प्रौढ़ (Middle-aged 35-50)' : 'Middle-aged (35-50)'}</option>
              <option value="Old">👴 {lang === 'hi' ? 'बुजुर्ग (Old / Senior 65+)' : 'Old / Senior (65+)'}</option>
            </select>

            <input
              type="text"
              placeholder={lang === 'hi' ? 'नाम या एक्सेंट खोजें...' : 'Search voices...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 sm:w-48 bg-[#141B2B] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Active Preview Player if playing */}
      {previewAudioBase64 && previewVoiceId && (
        <div className="bg-[#0E131F] border border-orange-500/40 rounded-2xl p-4 shadow-xl animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-orange-400 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {lang === 'hi' ? 'सैंपल प्रिव्यू चल रहा है' : 'Playing Voice Preview'}
            </span>
            <button
              onClick={() => {
                setPreviewVoiceId(null);
                setPreviewAudioBase64(null);
              }}
              className="p-1 rounded-md text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <AudioVisualizer
            audioBase64={previewAudioBase64}
            title={voices.find((v) => v.id === previewVoiceId)?.name || 'Preview'}
            voiceName={voices.find((v) => v.id === previewVoiceId)?.name}
            accentColor="orange"
          />
        </div>
      )}

      {/* Hidden Audio Player for instant zero-lag previews */}
      <audio
        ref={audioPlayerRef}
        onEnded={() => setCurrentPlayingId(null)}
        className="hidden"
      />

      {/* Voice Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVoices.map((voice) => {
          const isSelected = selectedVoice.id === voice.id;
          const isPlaying = currentPlayingId === voice.id;
          const isLoading = loadingVoiceId === voice.id;

          return (
            <div
              key={voice.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                isPlaying
                  ? 'bg-gradient-to-b from-[#182136] to-[#0E131F] border-orange-500/80 shadow-2xl shadow-orange-500/15 ring-1 ring-orange-500/40'
                  : isSelected
                  ? 'bg-gradient-to-b from-[#141B2B] to-[#0E131F] border-orange-500 shadow-xl shadow-orange-500/10'
                  : 'bg-[#0E131F] border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        voice.gender === 'Female'
                          ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                          : voice.gender === 'Male'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                      }`}
                    >
                      {voice.name.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {voice.name}
                        {voice.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Custom
                          </span>
                        )}
                      </h3>
                      <span className="text-[11px] text-neutral-400">{voice.accent}</span>
                    </div>
                  </div>

                  {/* Quick Play Pill Button */}
                  <button
                    onClick={() => handlePlaySample(voice)}
                    disabled={isLoading}
                    className={`p-2 rounded-xl transition-all ${
                      isPlaying
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                        : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 hover:text-white'
                    }`}
                    title={isPlaying ? 'Pause' : 'Play voice sample'}
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5 text-orange-400" />
                    )}
                  </button>
                </div>

                {/* Description */}
                <p className="text-xs text-neutral-300 mt-3 leading-relaxed">
                  {voice.description}
                </p>

                {/* Age & Tags */}
                <div className="flex flex-wrap items-center gap-1 mt-2.5">
                  {voice.age && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                        voice.age === 'Young'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : voice.age === 'Old'
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      }`}
                    >
                      {voice.age === 'Young'
                        ? '🧒 Young (युवा)'
                        : voice.age === 'Old'
                        ? '👴 Old (बुजुर्ग)'
                        : '🧑 Middle-aged (प्रौढ़)'}
                    </span>
                  )}
                  {voice.tags.filter((t) => t !== voice.age).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-neutral-300 border border-white/5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Spoken Sample Quote Box */}
                <div className="mt-3 p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-semibold text-neutral-400 block uppercase tracking-wider">
                    {lang === 'hi' ? 'नमूना वाक्य (Sample Phrase):' : 'Sample Phrase:'}
                  </span>
                  <p className="text-xs text-neutral-200 italic line-clamp-2 leading-relaxed">
                    "{voice.sampleText}"
                  </p>
                </div>

                {/* Dedicated Preview Voice Button */}
                <button
                  type="button"
                  onClick={() => handlePlaySample(voice)}
                  disabled={isLoading}
                  className={`w-full mt-3 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                    isPlaying
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 border-orange-400 ring-2 ring-orange-500/20'
                      : 'bg-white/[0.07] hover:bg-orange-500/20 hover:border-orange-500/50 text-white border-white/10 active:scale-[0.99]'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                      <span>{lang === 'hi' ? 'आवाज़ तैयार हो रही है...' : 'Generating Voice Preview...'}</span>
                    </>
                  ) : isPlaying ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span className="flex items-center gap-2">
                        <span>{lang === 'hi' ? 'प्रिव्यू रोकें (Stop)' : 'Stop Preview'}</span>
                        <span className="flex items-center gap-0.5 ml-1">
                          <span className="w-1 h-3 bg-white rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-1 h-4 bg-white rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-1 h-2 bg-white rounded-full animate-bounce [animation-delay:300ms]" />
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current text-orange-400" />
                      <span>{lang === 'hi' ? '▶ वॉइस का सैंपल सुनें (Preview Voice)' : '▶ Preview Voice Sample'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 mt-4 border-t border-white/10 flex items-center gap-2">
                <button
                  onClick={() => onUseVoice(voice, 'speech-to-speech')}
                  className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-orange-500 hover:text-white text-neutral-300 transition-all flex items-center justify-center gap-1.5"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'आवाज़ बदलें' : 'Voice Changer'}</span>
                </button>

                <button
                  onClick={() => onUseVoice(voice, 'text-to-speech')}
                  className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-orange-500 hover:text-white text-neutral-300 transition-all flex items-center justify-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'टेक्स्ट-टू-वॉइस' : 'Text to Voice'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Voice Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E131F] border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                {lang === 'hi' ? 'नई AI वॉइस डिज़ाइन करें' : 'Design Custom Voice Persona'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVoice} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  {lang === 'hi' ? 'वॉइस का नाम:' : 'Voice Name:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram (Hindi Storyteller) or Maya (News Anchor)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-[#141B2B] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">
                    {lang === 'hi' ? 'जेंडर:' : 'Gender:'}
                  </label>
                  <select
                    value={customGender}
                    onChange={(e) => setCustomGender(e.target.value as any)}
                    className="w-full bg-[#141B2B] border border-white/15 rounded-xl px-2 py-2 text-white focus:outline-none"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Neutral">Neutral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">
                    {lang === 'hi' ? 'उम्र (Age):' : 'Age:'}
                  </label>
                  <select
                    value={customAge}
                    onChange={(e) => setCustomAge(e.target.value as any)}
                    className="w-full bg-[#141B2B] border border-white/15 rounded-xl px-2 py-2 text-white focus:outline-none"
                  >
                    <option value="Young">🧒 Young</option>
                    <option value="Middle-aged">🧑 Middle</option>
                    <option value="Old">👴 Old</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">
                    {lang === 'hi' ? 'बेस मॉडल:' : 'Base Model:'}
                  </label>
                  <select
                    value={customVoiceName}
                    onChange={(e) => setCustomVoiceName(e.target.value)}
                    className="w-full bg-[#141B2B] border border-white/15 rounded-xl px-2 py-2 text-white focus:outline-none"
                  >
                    <option value="Kore">Kore</option>
                    <option value="Fenrir">Fenrir</option>
                    <option value="Puck">Puck</option>
                    <option value="Charon">Charon</option>
                    <option value="Aoede">Aoede</option>
                    <option value="Zephyr">Zephyr</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  {lang === 'hi' ? 'एक्सेंट / टोन:' : 'Accent & Cadence:'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Indian Hindi, British RP, Warm American"
                  value={customAccent}
                  onChange={(e) => setCustomAccent(e.target.value)}
                  className="w-full bg-[#141B2B] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  {lang === 'hi' ? 'विवरण & कैरेक्टर स्टाइल:' : 'Character Description:'}
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Speaks with energetic rhythm, warm low tones, and passionate expression."
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="w-full bg-[#141B2B] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg shadow-orange-500/25"
                >
                  {lang === 'hi' ? 'वॉइस सेव करें' : 'Save Voice Persona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
