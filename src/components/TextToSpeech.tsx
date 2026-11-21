import React, { useState, useRef } from 'react';
import {
  Volume2,
  Upload,
  FileText,
  Sparkles,
  Sliders,
  RefreshCw,
  AlertCircle,
  X,
  Play,
  Copy,
  Check,
  BookOpen,
  ArrowRight,
  Smile,
  Mic,
} from 'lucide-react';
import { Voice, GeneratedAudio } from '../types';
import { AudioVisualizer } from './AudioVisualizer';
import { VoiceDynamicsControls } from './VoiceDynamicsControls';
import { extractTextFromFile } from '../utils/audio';
import { SAMPLE_SCRIPTS, EMOTIONS } from '../data/voices';

interface TextToSpeechProps {
  voices: Voice[];
  selectedVoice: Voice;
  setSelectedVoice: (voice: Voice) => void;
  onAudioGenerated: (audio: GeneratedAudio) => void;
  lang: 'en' | 'hi';
}

export const TextToSpeech: React.FC<TextToSpeechProps> = ({
  voices,
  selectedVoice,
  setSelectedVoice,
  onAudioGenerated,
  lang,
}) => {
  const [text, setText] = useState<string>(
    'Welcome to Vocalis Studio. Experience human-like voice synthesis with unmatched emotion, clarity, and realism.'
  );

  // Uploaded file metadata
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    sizeKb: number;
    wordCount: number;
  } | null>(null);

  // Settings
  const [emotion, setEmotion] = useState<string>(EMOTIONS[0].value);
  const [stability, setStability] = useState<number>(0.75);
  const [pitch, setPitch] = useState<number>(0);
  const [voiceAge, setVoiceAge] = useState<'default' | 'young' | 'middle-aged' | 'old'>('default');
  const [clarity, setClarity] = useState<number>(0.85);
  const [speed, setSpeed] = useState<number>(1.0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Auto');

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'All' | 'Female' | 'Male'>('All');

  // Result
  const [resultAudio, setResultAudio] = useState<{
    audioBase64: string;
    mimeType: string;
    text: string;
    voice: string;
  } | null>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    try {
      setErrorMessage(null);
      const extracted = await extractTextFromFile(file);
      setText(extracted.text);
      const wordCount = extracted.text.trim().split(/\s+/).filter(Boolean).length;
      setUploadedFile({
        name: extracted.filename,
        sizeKb: extracted.sizeKb,
        wordCount,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to read uploaded text file.');
    }
  };

  // Handle Text File Upload (.txt, .md, .srt, .docx, .json, etc.)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
  };

  // Insert expressivity tags like <laugh>, <breath>, etc.
  const insertTag = (tag: string) => {
    setText((prev) => `${prev} ${tag} `);
  };

  // Load sample script
  const loadScript = (scriptText: string) => {
    setText(scriptText);
    setUploadedFile(null);
  };

  // Word and Duration estimates
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.max(1, Math.round((words / 140) * 60));

  // Synthesize Voice
  const handleGenerate = async () => {
    if (!text || !text.trim()) {
      setErrorMessage(
        lang === 'hi' ? 'कृपया पहले कुछ टेक्स्ट लिखें या टेक्स्ट फ़ाइल अपलोड करें।' : 'Please enter text or upload a text file first.'
      );
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setResultAudio(null);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voiceName: selectedVoice.voiceName,
          style: `${emotion}. Stability: ${stability}, Clarity boost: ${clarity}`,
          stability,
          speed,
          pitch,
          voiceAge,
          emotion,
          language: selectedLanguage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate voice');
      }

      setResultAudio({
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        text: data.text,
        voice: data.voice,
      });

      onAudioGenerated({
        id: 'tts-' + Date.now(),
        title: `${selectedVoice.name} Speech`,
        type: 'text-to-speech',
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        timestamp: Date.now(),
        transcript: text.trim(),
        voiceName: selectedVoice.voiceName,
        voiceDisplayName: selectedVoice.name,
        emotion,
        language: selectedLanguage,
      });
    } catch (err: any) {
      console.error('TTS error:', err);
      setErrorMessage(err.message || 'Error occurred during speech synthesis.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-pink-500/10 border border-orange-500/20 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-semibold mb-2">
              <Volume2 className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'टेक्स्ट-टू-स्पीच स्टूडियो' : 'Text-to-Speech Studio'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {lang === 'hi'
                ? 'टेक्स्ट या फ़ाइल से रियलिस्टिक आवाज़ बनाएं'
                : 'Generate Realistic Voice from Text or File'}
            </h2>
            <p className="text-sm text-neutral-300 mt-1 max-w-2xl">
              {lang === 'hi'
                ? 'अपनी कहानी, यूट्यूब स्क्रिप्ट या टेक्स्ट फ़ाइल (.txt, .md, .srt) अपलोड करें। प्राकृतिक और भावुक आवाज़ में सुनें।'
                : 'Paste your script or upload a text file (.txt, .md, .srt). Generate studio-quality human voiceovers in seconds.'}
            </p>
          </div>

          {/* Text File Upload Button (User Request Highlight) */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{lang === 'hi' ? '📁 टेक्स्ट फ़ाइल अपलोड करें' : '📁 Upload Text File'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.srt,.json,.csv,.vtt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Editor & File Upload */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#0E131F] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
            {/* Uploaded File Banner if present */}
            {uploadedFile && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-orange-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {uploadedFile.name}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {uploadedFile.sizeKb} KB • {uploadedFile.wordCount} {lang === 'hi' ? 'शब्द लोड किए गए' : 'words loaded'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={removeUploadedFile}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Script Text Area with Drag & Drop */}
            <div
              className={`relative rounded-xl transition-all ${
                isDragging
                  ? 'ring-2 ring-orange-500 bg-orange-500/10'
                  : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0E131F]/90 backdrop-blur-sm rounded-xl border-2 border-dashed border-orange-500 pointer-events-none">
                  <Upload className="w-10 h-10 text-orange-400 animate-bounce mb-2" />
                  <p className="text-sm font-bold text-white">
                    {lang === 'hi' ? 'टेक्स्ट फ़ाइल यहाँ छोड़ें (.txt, .md, .srt)' : 'Drop text file here (.txt, .md, .srt)'}
                  </p>
                </div>
              )}

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={9}
                placeholder={
                  lang === 'hi'
                    ? 'यहाँ अपनी स्क्रिप्ट लिखें या टेक्स्ट फ़ाइल (.txt, .md, .srt) ड्रैग & ड्रॉप करें...'
                    : 'Type or paste your script here, or drag & drop a text file (.txt, .md, .srt)...'
                }
                className="w-full bg-[#141B2B] border border-white/15 focus:border-orange-500 rounded-xl p-4 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none resize-none leading-relaxed transition-all"
              />

              {/* Expressive Bursts Tag Inserters */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1 mr-1">
                  <Smile className="w-3.5 h-3.5 text-amber-400" />
                  {lang === 'hi' ? 'भावुक टैग जोड़ें:' : 'Insert Vocal Burst:'}
                </span>

                <button
                  onClick={() => insertTag('<laugh>')}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-amber-300 border border-white/10 transition-colors"
                  title="Laughing burst"
                >
                  &lt;laugh&gt; {lang === 'hi' ? '(हंसना)' : ''}
                </button>
                <button
                  onClick={() => insertTag('<breath>')}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-amber-300 border border-white/10 transition-colors"
                  title="Natural breath pause"
                >
                  &lt;breath&gt; {lang === 'hi' ? '(सांस)' : ''}
                </button>
                <button
                  onClick={() => insertTag('<gasp>')}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-amber-300 border border-white/10 transition-colors"
                  title="Gasp of surprise"
                >
                  &lt;gasp&gt; {lang === 'hi' ? '(चौंकना)' : ''}
                </button>
                <button
                  onClick={() => insertTag('|yeah|')}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-amber-300 border border-white/10 transition-colors"
                  title="Conversational backchannel"
                >
                  |yeah|
                </button>
                <button
                  onClick={() => insertTag('|mhm|')}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-amber-300 border border-white/10 transition-colors"
                  title="Affirmative sound"
                >
                  |mhm|
                </button>
              </div>
            </div>

            {/* Word & Duration Bar */}
            <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-white/10">
              <div className="flex items-center gap-3">
                <span>
                  <strong className="text-white">{words}</strong> {lang === 'hi' ? 'शब्द' : 'words'}
                </span>
                <span>•</span>
                <span>
                  <strong className="text-white">{text.length}</strong> {lang === 'hi' ? 'अक्षर' : 'chars'}
                </span>
                <span>•</span>
                <span>
                  {lang === 'hi' ? 'अनुमानित समय: ' : 'Est: ~'}
                  <strong className="text-orange-400">{estimatedSeconds}s</strong>
                </span>
              </div>

              <button
                onClick={() => setText('')}
                className="text-neutral-400 hover:text-red-400 transition-colors"
                title="Clear text"
              >
                {lang === 'hi' ? 'साफ़ करें' : 'Clear'}
              </button>
            </div>
          </div>

          {/* Sample Scripts Accordion */}
          <div className="bg-[#0E131F] border border-white/10 rounded-2xl p-4 shadow-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
              <BookOpen className="w-3.5 h-3.5 text-orange-400" />
              <span>{lang === 'hi' ? 'रेडीमेड स्क्रिप्ट सैंपल्स:' : 'Sample Scripts:'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SAMPLE_SCRIPTS.map((sc) => (
                <button
                  key={sc.title}
                  onClick={() => loadScript(sc.text)}
                  className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-left transition-all group"
                >
                  <span className="text-[11px] font-semibold text-white group-hover:text-orange-400 block truncate">
                    {sc.title}
                  </span>
                  <span className="text-[9px] text-neutral-400">{sc.category}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Voice Selection, Emotion & Generate */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Selected Voice Card */}
          <div className="bg-[#0E131F] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                {lang === 'hi' ? 'चुनी गई आवाज़' : 'Selected Voice'}
              </span>
              <span className="text-xs text-orange-400 font-semibold">{selectedVoice.accent}</span>
            </div>

            {/* Voice Dropdown & Male/Female Option */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300">
                  {lang === 'hi' ? 'वॉइस पर्सोना चुनें (50 आवाज़ें):' : 'Select Voice (50 Voices):'}
                </label>

                {/* Male / Female Filter Pills */}
                <div className="flex items-center bg-[#141B2B] p-0.5 rounded-lg border border-white/10 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setVoiceGenderFilter('All')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      voiceGenderFilter === 'All'
                        ? 'bg-orange-500 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    All ({voices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceGenderFilter('Female');
                      const firstFemale = voices.find((v) => v.gender === 'Female');
                      if (firstFemale && selectedVoice.gender !== 'Female') {
                        setSelectedVoice(firstFemale);
                      }
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      voiceGenderFilter === 'Female'
                        ? 'bg-pink-500 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span>👩 Female</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceGenderFilter('Male');
                      const firstMale = voices.find((v) => v.gender === 'Male');
                      if (firstMale && selectedVoice.gender !== 'Male') {
                        setSelectedVoice(firstMale);
                      }
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      voiceGenderFilter === 'Male'
                        ? 'bg-blue-500 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span>👨 Male</span>
                  </button>
                </div>
              </div>

              <select
                value={selectedVoice.id}
                onChange={(e) => {
                  const found = voices.find((v) => v.id === e.target.value);
                  if (found) setSelectedVoice(found);
                }}
                className="w-full bg-[#161D2E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                {voices
                  .filter(
                    (v) => voiceGenderFilter === 'All' || v.gender === voiceGenderFilter
                  )
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.gender === 'Female' ? '👩' : '👨'} {v.name} ({v.age || 'Mature'} • {v.accent})
                    </option>
                  ))}
              </select>
            </div>

            {/* Voice Detail Pill */}
            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 space-y-1">
              <p className="text-xs text-neutral-300 leading-relaxed">
                {selectedVoice.description}
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedVoice.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Emotion / Delivery Style */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                {lang === 'hi' ? 'डिलीवरी स्टाइल & इमोशन:' : 'Delivery Emotion & Style:'}
              </label>
              <select
                value={emotion}
                onChange={(e) => setEmotion(e.target.value)}
                className="w-full bg-[#161D2E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                {EMOTIONS.map((em) => (
                  <option key={em.label} value={em.value}>
                    {em.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Voice Pitch, Stability & Age Dynamics Control Component */}
            <VoiceDynamicsControls
              pitch={pitch}
              setPitch={setPitch}
              stability={stability}
              setStability={setStability}
              age={voiceAge}
              setAge={setVoiceAge}
              clarity={clarity}
              setClarity={setClarity}
              speed={speed}
              setSpeed={setSpeed}
              lang={lang}
            />

            {/* Generate Trigger */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-xl ${
                isGenerating || !text.trim()
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-orange-500/25 active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{lang === 'hi' ? 'आवाज़ तैयार हो रही है...' : 'Synthesizing Audio...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>
                    {lang === 'hi'
                      ? `${selectedVoice.name} में आवाज़ बनाएं`
                      : `Generate Speech (${selectedVoice.name})`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Generated Result Player */}
          {resultAudio && (
            <div className="bg-[#0E131F] border border-orange-500/30 rounded-2xl p-5 shadow-2xl space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {lang === 'hi' ? 'जनरेटेड ऑडियो' : 'Generated Master Audio'}
                </h3>
              </div>

              <AudioVisualizer
                audioBase64={resultAudio.audioBase64}
                mimeType={resultAudio.mimeType}
                title={`${selectedVoice.name} Speech`}
                voiceName={selectedVoice.name}
                downloadFilename={`vocalis_${selectedVoice.voiceName}`}
                accentColor="orange"
                showDownload={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
