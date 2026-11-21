import React from 'react';
import { Sliders, RotateCcw, Volume2, Music, Sparkles, Activity, Shield, Flame } from 'lucide-react';

interface VoiceDynamicsControlsProps {
  pitch: number;
  setPitch: (val: number) => void;
  stability: number;
  setStability: (val: number) => void;
  age?: 'default' | 'young' | 'middle-aged' | 'old';
  setAge?: (age: 'default' | 'young' | 'middle-aged' | 'old') => void;
  clarity?: number;
  setClarity?: (val: number) => void;
  speed?: number;
  setSpeed?: (val: number) => void;
  lang: 'en' | 'hi';
  compact?: boolean;
}

export const VoiceDynamicsControls: React.FC<VoiceDynamicsControlsProps> = ({
  pitch,
  setPitch,
  stability,
  setStability,
  age = 'default',
  setAge,
  clarity,
  setClarity,
  speed,
  setSpeed,
  lang,
  compact = false,
}) => {
  // Format pitch label
  const getPitchLabel = (val: number) => {
    if (val === 0) return lang === 'hi' ? 'नेचुरल पिच (0st)' : 'Natural (0st)';
    if (val < -4) return lang === 'hi' ? `गहरी आवाज़ (${val}st)` : `Deep Bass (${val}st)`;
    if (val < 0) return lang === 'hi' ? `हल्की भारी (${val}st)` : `Low Timbre (${val}st)`;
    if (val > 4) return lang === 'hi' ? `तीखी / ऊँची (+${val}st)` : `High Pitch (+${val}st)`;
    return lang === 'hi' ? `हल्की ऊँची (+${val}st)` : `Bright (+${val}st)`;
  };

  // Format stability label
  const getStabilityLabel = (val: number) => {
    if (val < 0.45) return lang === 'hi' ? 'अधिक भावुक & डायनामिक' : 'Highly Expressive & Dynamic';
    if (val > 0.8) return lang === 'hi' ? 'काफ़ी शांत व स्थिर' : 'Ultra Stable & Consistent';
    return lang === 'hi' ? 'संतुलित नैचुरल' : 'Balanced & Natural';
  };

  const handleReset = () => {
    setPitch(0);
    setStability(0.75);
    if (setAge) setAge('default');
    if (setClarity) setClarity(0.85);
    if (setSpeed) setSpeed(1.0);
  };

  return (
    <div className="bg-[#121824] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>{lang === 'hi' ? 'वॉइस पिच & स्टेबिलिटी कंट्रोल्स' : 'Voice Pitch & Stability Dynamics'}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                ElevenLabs Style
              </span>
            </h4>
            <p className="text-[10px] text-neutral-400">
              {lang === 'hi'
                ? 'उम्र (Young, Middle-aged, Old), भारीपन (Pitch) और स्थिरता (Stability) सेट करें'
                : 'Fine-tune age timbre (Young, Middle, Old), pitch depth, and stability'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white text-[11px] font-medium transition-colors border border-white/5"
          title="Reset to recommended defaults"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{lang === 'hi' ? 'रीसेट' : 'Reset'}</span>
        </button>
      </div>

      <div className="space-y-4">
        {/* Voice Type / Age Selector */}
        {setAge && (
          <div className="space-y-1.5 pb-2 border-b border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'hi' ? 'वॉइस प्रकार / उम्र (Voice Age):' : 'Voice Age & Type:'}</span>
              </label>

              <span className="text-[11px] font-medium text-orange-400">
                {age === 'young'
                  ? lang === 'hi'
                    ? '🧒 युवा आवाज़ (Young)'
                    : '🧒 Youthful (18-25)'
                  : age === 'middle-aged'
                  ? lang === 'hi'
                    ? '🧑 मध्यम आयु (Middle-aged)'
                    : '🧑 Mature (35-50)'
                  : age === 'old'
                  ? lang === 'hi'
                    ? '👴 बुजुर्ग आवाज़ (Old / Senior)'
                    : '👴 Senior / Elder (65+)'
                  : lang === 'hi'
                  ? '✨ स्वाभाविक (Default)'
                  : '✨ Natural Default'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setAge('default')}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1 ${
                  age === 'default'
                    ? 'bg-white/15 text-white border-white/30 shadow-sm'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] text-neutral-400 border-white/5'
                }`}
              >
                <span>✨</span>
                <span className="truncate">{lang === 'hi' ? 'डिफ़ॉल्ट' : 'Default'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAge('young')}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1 ${
                  age === 'young'
                    ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/25 ring-1 ring-orange-400/40'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] text-neutral-300 border-white/5'
                }`}
              >
                <span>🧒</span>
                <span className="truncate">{lang === 'hi' ? 'युवा (Young)' : 'Young'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAge('middle-aged')}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1 ${
                  age === 'middle-aged'
                    ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/25 ring-1 ring-orange-400/40'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] text-neutral-300 border-white/5'
                }`}
              >
                <span>🧑</span>
                <span className="truncate">{lang === 'hi' ? 'प्रौढ़ (Middle)' : 'Middle'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAge('old')}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1 ${
                  age === 'old'
                    ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/25 ring-1 ring-orange-400/40'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] text-neutral-300 border-white/5'
                }`}
              >
                <span>👴</span>
                <span className="truncate">{lang === 'hi' ? 'बुजुर्ग (Old)' : 'Old'}</span>
              </button>
            </div>
          </div>
        )}
        {/* Pitch Slider Control */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-amber-400" />
              <label className="text-xs font-semibold text-neutral-200">
                {lang === 'hi' ? 'वॉइस पिच (Pitch Shift)' : 'Voice Pitch (Semitones)'}
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-neutral-400">
                {getPitchLabel(pitch)}
              </span>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                  pitch === 0
                    ? 'bg-neutral-800 text-neutral-300'
                    : pitch < 0
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                }`}
              >
                {pitch > 0 ? `+${pitch}` : pitch} st
              </span>
            </div>
          </div>

          {/* Interactive Range Input */}
          <div className="relative pt-1">
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={pitch}
              onChange={(e) => setPitch(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gradient-to-r from-indigo-600 via-neutral-600 to-orange-500 rounded-lg appearance-none cursor-pointer accent-white hover:opacity-95 transition-opacity"
            />
            {/* Center mark indicator at 0 */}
            <div className="flex justify-between text-[10px] text-neutral-500 mt-1 font-mono">
              <span className="text-indigo-400">-12 st (Deep Bass)</span>
              <span className={`cursor-pointer ${pitch === 0 ? 'text-white font-bold' : ''}`} onClick={() => setPitch(0)}>
                0 st (Natural)
              </span>
              <span className="text-orange-400">+12 st (Higher / Bright)</span>
            </div>
          </div>

          {/* Quick Pitch Presets */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[10px] text-neutral-400 font-medium mr-1">
              {lang === 'hi' ? 'त्वरित पिच:' : 'Presets:'}
            </span>
            <button
              type="button"
              onClick={() => setPitch(-5)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                pitch === -5
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 border border-white/5'
              }`}
            >
              🎙️ {lang === 'hi' ? 'डीप मेल (-5st)' : 'Deep Voice (-5)'}
            </button>
            <button
              type="button"
              onClick={() => setPitch(0)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                pitch === 0
                  ? 'bg-neutral-600 text-white font-bold'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 border border-white/5'
              }`}
            >
              ⚖️ {lang === 'hi' ? 'नैचुरल (0st)' : 'Natural (0)'}
            </button>
            <button
              type="button"
              onClick={() => setPitch(4)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                pitch === 4
                  ? 'bg-orange-600 text-white font-bold'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 border border-white/5'
              }`}
            >
              ✨ {lang === 'hi' ? 'तीखी / ऊँची (+4st)' : 'High (+4)'}
            </button>
          </div>
        </div>

        {/* Stability Slider Control */}
        <div className="space-y-1.5 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-orange-400" />
              <label className="text-xs font-semibold text-neutral-200">
                {lang === 'hi' ? 'वॉइस स्टेबिलिटी (Stability)' : 'Voice Stability'}
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-neutral-400">
                {getStabilityLabel(stability)}
              </span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {Math.round(stability * 100)}%
              </span>
            </div>
          </div>

          <div className="relative pt-1">
            <input
              type="range"
              min="0.15"
              max="1.0"
              step="0.05"
              value={stability}
              onChange={(e) => setStability(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
              <span>{lang === 'hi' ? 'अधिक भावुक / उतार-चढ़ाव (Variable)' : 'Variable / Expressive'}</span>
              <span>{lang === 'hi' ? 'स्थिर व सुसंगत (Consistent)' : 'Stable / Steady'}</span>
            </div>
          </div>

          {/* Quick Stability Presets */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[10px] text-neutral-400 font-medium mr-1">
              {lang === 'hi' ? 'मोड:' : 'Mode:'}
            </span>
            <button
              type="button"
              onClick={() => setStability(0.35)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                stability === 0.35
                  ? 'bg-orange-500 text-white font-bold'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 border border-white/5'
              }`}
            >
              🎭 {lang === 'hi' ? 'भावुक / ड्रामैटिक (35%)' : 'Expressive (35%)'}
            </button>
            <button
              type="button"
              onClick={() => setStability(0.75)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                stability === 0.75
                  ? 'bg-orange-500 text-white font-bold'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 border border-white/5'
              }`}
            >
              ⚖️ {lang === 'hi' ? 'नेचुरल स्टोरीटेलिंग (75%)' : 'Natural (75%)'}
            </button>
            <button
              type="button"
              onClick={() => setStability(0.95)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                stability === 0.95
                  ? 'bg-orange-500 text-white font-bold'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 border border-white/5'
              }`}
            >
              🛡️ {lang === 'hi' ? 'न्यूज़ एंकर / स्थिर (95%)' : 'Consistent (95%)'}
            </button>
          </div>
        </div>

        {/* Optional Clarity Boost */}
        {clarity !== undefined && setClarity && (
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <label className="text-xs font-semibold text-neutral-200">
                  {lang === 'hi' ? 'क्लैरिटी & सिमिलैरिटी बूस्ट' : 'Clarity & Similarity Boost'}
                </label>
              </div>
              <span className="font-mono text-xs font-bold text-orange-400">
                {Math.round(clarity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={clarity}
              onChange={(e) => setClarity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
          </div>
        )}

        {/* Optional Speed Multiplier */}
        {speed !== undefined && setSpeed && (
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
                <label className="text-xs font-semibold text-neutral-200">
                  {lang === 'hi' ? 'बोलने की गति (Speech Speed)' : 'Speaking Speed'}
                </label>
              </div>
              <span className="font-mono text-xs font-bold text-neutral-200">
                {speed.toFixed(2)}x
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.05"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex gap-1">
                {[0.8, 1.0, 1.2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      speed === s ? 'bg-orange-500 text-white font-bold' : 'bg-white/5 text-neutral-400'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
