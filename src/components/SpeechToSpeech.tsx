import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Upload,
  Sparkles,
  Volume2,
  RefreshCw,
  Sliders,
  Check,
  AlertCircle,
  Play,
  Pause,
  ArrowRight,
  FileAudio,
  Languages,
  Zap,
} from 'lucide-react';
import { Voice, GeneratedAudio } from '../types';
import { AudioVisualizer } from './AudioVisualizer';
import { VoiceDynamicsControls } from './VoiceDynamicsControls';
import { blobToBase64, fileToBase64, formatTime } from '../utils/audio';
import { EMOTIONS } from '../data/voices';

interface SpeechToSpeechProps {
  voices: Voice[];
  selectedVoice: Voice;
  setSelectedVoice: (voice: Voice) => void;
  onAudioGenerated: (audio: GeneratedAudio) => void;
  lang: 'en' | 'hi';
}

export const SpeechToSpeech: React.FC<SpeechToSpeechProps> = ({
  voices,
  selectedVoice,
  setSelectedVoice,
  onAudioGenerated,
  lang,
}) => {
  // Input method: 'record' | 'upload'
  const [inputMode, setInputMode] = useState<'record' | 'upload'>('record');

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Audio state
  const [inputAudioBase64, setInputAudioBase64] = useState<string | null>(null);
  const [inputAudioMime, setInputAudioMime] = useState<string>('audio/webm');
  const [inputFileName, setInputFileName] = useState<string>('');

  // Conversion settings
  const [emotion, setEmotion] = useState(EMOTIONS[0].value);
  const [stability, setStability] = useState(0.75);
  const [pitch, setPitch] = useState(0);
  const [voiceAge, setVoiceAge] = useState<'default' | 'young' | 'middle-aged' | 'old'>('default');
  const [similarity, setSimilarity] = useState(0.85);
  const [targetLanguage, setTargetLanguage] = useState('Keep original');
  const [enhanceAudio, setEnhanceAudio] = useState(true);

  // Processing state
  const [isConverting, setIsConverting] = useState(false);
  const [conversionStep, setConversionStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'All' | 'Female' | 'Male'>('All');

  // Result state
  const [result, setResult] = useState<{
    audioBase64: string;
    mimeType: string;
    transcript: string;
    detectedLanguage?: string;
    detectedEmotion?: string;
  } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Start Mic Recording
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const base64 = await blobToBase64(audioBlob);
        setInputAudioBase64(base64);
        setInputAudioMime(mimeType);
        setInputFileName(`Voice_Recording_${new Date().toLocaleTimeString().replace(/:/g, '-')}.webm`);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      setErrorMessage(
        lang === 'hi'
          ? 'माइक्रोफ़ोन एक्सेस नहीं मिला। कृपया ब्राउज़र में माइक की अनुमति दें या ऑडियो फ़ाइल अपलोड करें।'
          : 'Microphone permission denied or device not found. Please grant microphone access or upload an audio file.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  // Handle Audio File Upload
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage(lang === 'hi' ? 'फ़ाइल का साइज़ 25MB से कम होना चाहिए।' : 'File size must be under 25MB.');
      return;
    }

    try {
      setErrorMessage(null);
      const { base64, mimeType } = await fileToBase64(file);
      setInputAudioBase64(base64);
      setInputAudioMime(mimeType);
      setInputFileName(file.name);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to read audio file.');
    }
  };

  // Convert Voice API Call
  const handleConvertVoice = async () => {
    if (!inputAudioBase64) {
      setErrorMessage(lang === 'hi' ? 'कृपया पहले अपनी आवाज़ रिकॉर्ड करें या ऑडियो फ़ाइल अपलोड करें।' : 'Please record audio or upload an audio file first.');
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setResult(null);

    // Step indicators
    setConversionStep(lang === 'hi' ? '1/3 ऑडियो सुनकर शब्द और अंदाज़ पहचाना जा रहा है...' : '1/3 Listening and transcribing speech verbatim...');

    const step2Timer = setTimeout(() => {
      setConversionStep(lang === 'hi' ? '2/3 पिच और इमोशनल एक्सप्रेशन ट्रांसफर किए जा रहे हैं...' : '2/3 Extracting tone and emotional inflections...');
    }, 2200);

    const step3Timer = setTimeout(() => {
      setConversionStep(
        lang === 'hi'
          ? `3/3 ${selectedVoice.name} में रियलिस्टिक वॉइस तैयार हो रही है...`
          : `3/3 Synthesizing into ${selectedVoice.name} realistic voice...`
      );
    }, 4500);

    try {
      const response = await fetch('/api/speech-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: inputAudioBase64,
          mimeType: inputAudioMime,
          targetVoice: selectedVoice.voiceName,
          customStyle: `${emotion}. Voice Stability: ${stability}, Clarity boost: ${similarity}`,
          enhanceAudio,
          targetLanguage,
          pitch,
          stability,
          voiceAge,
        }),
      });

      clearTimeout(step2Timer);
      clearTimeout(step3Timer);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to convert audio.');
      }

      setResult({
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        transcript: data.transcript,
        detectedLanguage: data.detectedLanguage,
        detectedEmotion: data.detectedEmotion,
      });

      // Save to parent history
      onAudioGenerated({
        id: 'sts-' + Date.now(),
        title: `${selectedVoice.name} Voice Conversion`,
        type: 'speech-to-speech',
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        timestamp: Date.now(),
        transcript: data.transcript,
        voiceName: selectedVoice.voiceName,
        voiceDisplayName: selectedVoice.name,
        emotion: data.detectedEmotion || emotion,
        language: data.detectedLanguage || targetLanguage,
        originalAudioBase64: inputAudioBase64,
      });
    } catch (err: any) {
      console.error('Conversion failed:', err);
      setErrorMessage(err.message || 'Error occurred while converting audio. Please verify your connection.');
    } finally {
      setIsConverting(false);
      setConversionStep('');
    }
  };

  // Sample prompt audio loader for quick testing
  const loadSampleAudioPrompt = (sampleType: 'hindi' | 'english') => {
    // Generate synthetic audio using browser TTS / base sample
    const sampleText =
      sampleType === 'hindi'
        ? 'नमस्ते, यह मेरी असली आवाज़ का टेस्ट है। देखते हैं AI इसे कितना रियलिस्टिक बना सकता है।'
        : 'Hello there! This is a test recording to see how realistic and expressive this AI voice converter sounds.';

    // Fast synthesize via TTS to simulate recording
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: sampleText,
        voiceName: 'Puck',
        style: 'Casual raw microphone audio tone',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.audioBase64) {
          setInputAudioBase64(data.audioBase64);
          setInputAudioMime('audio/wav');
          setInputFileName(sampleType === 'hindi' ? 'Sample_Hindi_Voice.wav' : 'Sample_English_Voice.wav');
        }
      })
      .catch((e) => console.error(e));
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-violet-500/10 border border-orange-500/20 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-semibold mb-2">
              <Zap className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'स्पीच-टू-स्पीच वॉइस चेंजर' : 'Speech-to-Speech Voice Changer'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {lang === 'hi'
                ? 'अपनी आवाज़ को Realistic AI Voice में बदलें'
                : 'Convert Your Audio into a Realistic Voice'}
            </h2>
            <p className="text-sm text-neutral-300 mt-1 max-w-2xl">
              {lang === 'hi'
                ? 'अपनी खुद की आवाज़ रिकॉर्ड करें या कोई भी ऑडियो फ़ाइल अपलोड करें। ElevenLabs जैसे रियलिस्टिक इंसानी आवाज़ (Voice Personas) में सेकंडों में बदलें।'
                : 'Record your voice or upload any audio file. Transform it into studio-grade human voices with exact emotional inflections and pitch preservation.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <span className="text-xs text-neutral-400 font-medium">
              {lang === 'hi' ? 'त्वरित टेस्ट सैंपल:' : 'Quick Sample:'}
            </span>
            <button
              onClick={() => loadSampleAudioPrompt('hindi')}
              className="px-2.5 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200 border border-white/10 transition-colors"
            >
              🇮🇳 हिंदी
            </button>
            <button
              onClick={() => loadSampleAudioPrompt('english')}
              className="px-2.5 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200 border border-white/10 transition-colors"
            >
              🌐 English
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Input & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input (Mic or File) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="bg-[#0E131F] border border-white/10 rounded-2xl p-5 shadow-xl">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                {lang === 'hi' ? 'स्टेप 1: इनपुट ऑडियो' : 'Step 1: Input Audio'}
              </span>

              <div className="flex items-center gap-1 p-0.5 bg-black/40 rounded-lg border border-white/10">
                <button
                  onClick={() => setInputMode('record')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    inputMode === 'record'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'माइक रिकॉर्ड' : 'Record Mic'}</span>
                </button>
                <button
                  onClick={() => setInputMode('upload')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    inputMode === 'upload'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'फ़ाइल अपलोड' : 'Upload File'}</span>
                </button>
              </div>
            </div>

            {/* Input Mode: Record Audio */}
            {inputMode === 'record' && (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  {isRecording && (
                    <div className="absolute -inset-3 rounded-full bg-red-500/20 animate-ping pointer-events-none" />
                  )}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${
                      isRecording
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/40 ring-4 ring-red-400/30'
                        : 'bg-gradient-to-tr from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-orange-500/30'
                    }`}
                  >
                    {isRecording ? (
                      <Square className="w-8 h-8 fill-current" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {isRecording
                      ? lang === 'hi'
                        ? 'रिकॉर्डिंग चालू है... (रोकने के लिए क्लिक करें)'
                        : 'Recording in progress... (Click to stop)'
                      : lang === 'hi'
                      ? 'रिकॉर्ड करने के लिए माइक दबाएं'
                      : 'Click to start recording your voice'}
                  </p>
                  <p className="font-mono text-xs text-orange-400 font-bold">
                    {isRecording ? formatTime(recordingDuration) : '00:00'}
                  </p>
                </div>
              </div>
            )}

            {/* Input Mode: Upload Audio File */}
            {inputMode === 'upload' && (
              <div className="py-6">
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/20 hover:border-orange-500/50 rounded-xl cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 text-center">
                  <FileAudio className="w-10 h-10 text-orange-400 mb-2" />
                  <span className="text-sm font-semibold text-white">
                    {lang === 'hi'
                      ? 'अपनी ऑडियो फ़ाइल यहाँ ड्रॉप करें'
                      : 'Drop your audio file here or browse'}
                  </span>
                  <span className="text-xs text-neutral-400 mt-1">
                    MP3, WAV, M4A, WEBM, OGG (Max 25MB)
                  </span>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac"
                    onChange={handleAudioFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Preview of User's Input Audio */}
            {inputAudioBase64 && (
              <div className="pt-4 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-300">
                  <span className="font-medium text-neutral-400">
                    {lang === 'hi' ? 'आपकी ओरिजिनल ऑडियो:' : 'Your Original Audio:'}
                  </span>
                  <span className="font-mono text-orange-400 truncate max-w-[180px]">
                    {inputFileName || 'recording.webm'}
                  </span>
                </div>
                <AudioVisualizer
                  audioBase64={inputAudioBase64}
                  mimeType={inputAudioMime}
                  title={lang === 'hi' ? 'आपकी रिकॉर्डेड ऑडियो' : 'Your Original Voice'}
                  accentColor="emerald"
                  showDownload={false}
                />
              </div>
            )}
          </div>

          {/* Voice Conversion Settings (ElevenLabs Controls) */}
          <div className="bg-[#0E131F] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <Sliders className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                {lang === 'hi' ? 'वॉइस कस्टमाइज़ेशन & सेटिंग्स' : 'Voice Controls & Dynamics'}
              </span>
            </div>

            {/* Emotion / Style */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                {lang === 'hi' ? 'इमोशन & अंदाज़ (Style):' : 'Delivery Emotion & Style:'}
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

            {/* Voice Pitch, Stability & Age Dynamics Controls */}
            <VoiceDynamicsControls
              pitch={pitch}
              setPitch={setPitch}
              stability={stability}
              setStability={setStability}
              age={voiceAge}
              setAge={setVoiceAge}
              clarity={similarity}
              setClarity={setSimilarity}
              lang={lang}
            />

            {/* Target Language & Enhance */}
            <div className="pt-2 border-t border-white/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-300">
                  {lang === 'hi' ? 'बैकग्राउंड नॉइज़ हटाएं (Denoise):' : 'Studio Clean & Denoise:'}
                </span>
                <input
                  type="checkbox"
                  checked={enhanceAudio}
                  onChange={(e) => setEnhanceAudio(e.target.checked)}
                  className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-300">
                  {lang === 'hi' ? 'भाषा (Language):' : 'Language Output:'}
                </span>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="bg-[#161D2E] border border-white/15 rounded-lg px-2 py-1 text-xs text-neutral-200"
                >
                  <option value="Keep original">Keep Original (ऑटो)</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Hinglish">Hinglish (हिंग्लिश)</option>
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Voice Selection & Conversion Output */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Target Voice Selection */}
          <div className="bg-[#0E131F] border border-white/10 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                {lang === 'hi'
                  ? 'स्टेप 2: टारगेट रियलिस्टिक आवाज़ चुनें'
                  : 'Step 2: Choose Target Realistic Voice'}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                {voices.length} {lang === 'hi' ? 'वॉइसेस उपलब्ध' : 'Voices Available'}
              </span>
            </div>

            {/* Male / Female Filter Pills in Step 2 */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center bg-[#141B2B] p-0.5 rounded-lg border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setVoiceGenderFilter('All')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    voiceGenderFilter === 'All'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  All ({voices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceGenderFilter('Female')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    voiceGenderFilter === 'Female'
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>👩 Female ({voices.filter((v) => v.gender === 'Female').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceGenderFilter('Male')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    voiceGenderFilter === 'Male'
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>👨 Male ({voices.filter((v) => v.gender === 'Male').length})</span>
                </button>
              </div>

              <span className="text-[11px] text-neutral-400">
                {voices.filter((v) => voiceGenderFilter === 'All' || v.gender === voiceGenderFilter).length} {lang === 'hi' ? 'आवाज़ें' : 'voices'}
              </span>
            </div>

            {/* Voice Cards Carousel / Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[290px] overflow-y-auto pr-1">
              {voices
                .filter(
                  (v) => voiceGenderFilter === 'All' || v.gender === voiceGenderFilter
                )
                .map((v) => {
                const isSelected = selectedVoice.id === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVoice(v)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/10 border-orange-500 shadow-md shadow-orange-500/15'
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            v.gender === 'Female'
                              ? 'bg-pink-500/20 text-pink-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {v.name.slice(0, 1)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white leading-tight">{v.name}</h4>
                          <span className="text-[10px] text-neutral-400">{v.accent}</span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-neutral-300 mt-2 line-clamp-2 leading-relaxed">
                      {v.description}
                    </p>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {v.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Trigger Button */}
          <div className="space-y-3">
            <button
              onClick={handleConvertVoice}
              disabled={isConverting || !inputAudioBase64}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-all shadow-xl ${
                isConverting || !inputAudioBase64
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5'
                  : 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-orange-500/25 active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isConverting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>{conversionStep || 'Converting to Realistic Voice...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-200" />
                  <span>
                    {lang === 'hi'
                      ? `अपनी आवाज़ को ${selectedVoice.name} में कन्वर्ट करें`
                      : `Convert Voice to ${selectedVoice.name}`}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Step 3: Converted Result Output */}
          {result && (
            <div className="bg-[#0E131F] border border-orange-500/30 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-white">
                    {lang === 'hi' ? 'कन्वर्टेड Realistic Voice' : 'Converted Realistic Voice Result'}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {result.detectedLanguage && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      {result.detectedLanguage}
                    </span>
                  )}
                  {result.detectedEmotion && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {result.detectedEmotion}
                    </span>
                  )}
                </div>
              </div>

              {/* Transcribed Speech Box */}
              <div className="p-3.5 bg-black/40 rounded-xl border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="font-semibold">
                    {lang === 'hi' ? 'ट्रांस्क्रिप्ट (बोले गए शब्द):' : 'Transcribed Spoken Text:'}
                  </span>
                </div>
                <p className="text-xs text-neutral-200 leading-relaxed italic">
                  "{result.transcript}"
                </p>
              </div>

              {/* Master Audio Visualizer Player */}
              <AudioVisualizer
                audioBase64={result.audioBase64}
                mimeType={result.mimeType}
                title={`${selectedVoice.name} (Realistic Conversion)`}
                voiceName={selectedVoice.name}
                downloadFilename={`vocalis_converted_${selectedVoice.voiceName}`}
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
