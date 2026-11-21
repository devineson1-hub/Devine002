import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download, Volume2, VolumeX, RotateCcw, FastForward, Check, Copy } from 'lucide-react';
import { base64ToBlobUrl, formatTime, downloadAudio } from '../utils/audio';

interface AudioVisualizerProps {
  audioBase64: string;
  mimeType?: string;
  title?: string;
  voiceName?: string;
  downloadFilename?: string;
  accentColor?: string; // e.g. 'orange' | 'violet' | 'emerald'
  showDownload?: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioBase64,
  mimeType = 'audio/wav',
  title = 'Generated Audio',
  voiceName,
  downloadFilename = 'vocalis_audio',
  accentColor = 'orange',
  showDownload = true,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [copied, setCopied] = useState(false);

  const [audioUrl, setAudioUrl] = useState<string | null>(() => {
    return audioBase64 ? base64ToBlobUrl(audioBase64, mimeType) : null;
  });

  useEffect(() => {
    if (!audioBase64) {
      setAudioUrl(null);
      return;
    }
    const url = base64ToBlobUrl(audioBase64, mimeType);
    setAudioUrl(url);

    return () => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [audioBase64, mimeType]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => console.error('Audio play error:', err));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleSpeedChange = () => {
    const speeds = [1.0, 1.25, 1.5, 0.75];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Draw simulated or active waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const width = canvas.width;
    const height = canvas.height;
    const barCount = 48;
    const barWidth = 3;
    const gap = (width - barCount * barWidth) / (barCount - 1);

    // Static waveform seed for consistency
    const staticHeights: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const sinVal = Math.sin((i / barCount) * Math.PI * 4);
      const cosVal = Math.cos((i / barCount) * Math.PI * 2);
      const h = Math.abs(sinVal * 0.5 + cosVal * 0.3) * 0.7 + 0.15;
      staticHeights.push(h);
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const progress = duration > 0 ? currentTime / duration : 0;
      const currentBarIndex = Math.floor(progress * barCount);

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + gap);
        let factor = staticHeights[i];

        if (isPlaying && Math.abs(i - currentBarIndex) <= 4) {
          const wobble = Math.sin(Date.now() / 120 + i) * 0.25;
          factor = Math.min(1.0, Math.max(0.1, factor + wobble));
        }

        const barHeight = Math.max(4, factor * height * 0.85);
        const y = (height - barHeight) / 2;

        const isPast = i <= currentBarIndex;

        if (isPast) {
          ctx.fillStyle =
            accentColor === 'emerald'
              ? '#10b981'
              : accentColor === 'violet'
              ? '#a855f7'
              : '#f97316';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      if (isPlaying) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, currentTime, duration, accentColor]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-[#121824] border border-white/10 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}

      <div className="flex flex-col gap-3">
        {/* Top title & metadata */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isPlaying ? 'bg-orange-500 animate-ping' : 'bg-neutral-500'
              }`}
            />
            <span className="text-sm font-semibold text-white truncate max-w-[220px] sm:max-w-md">
              {title}
            </span>
            {voiceName && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.08] text-neutral-300 border border-white/10">
                Voice: {voiceName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSpeedChange}
              className="text-[11px] font-mono font-medium px-2 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 border border-white/10 transition-colors"
              title="Playback speed"
            >
              {playbackRate}x
            </button>

            {showDownload && (
              <button
                onClick={() => downloadAudio(audioBase64, downloadFilename, mimeType)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-sm shadow-orange-500/30"
                title="Download WAV file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WAV</span>
              </button>
            )}
          </div>
        </div>

        {/* Waveform Canvas */}
        <div
          className="relative w-full h-14 bg-black/30 rounded-xl border border-white/5 flex items-center justify-center px-4 cursor-pointer hover:border-white/15 transition-all"
          onClick={togglePlay}
        >
          <canvas
            ref={canvasRef}
            width={480}
            height={56}
            className="w-full h-full object-contain pointer-events-none"
          />
        </div>

        {/* Progress scrub bar */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-neutral-400 w-10 text-right">
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400 transition-all"
          />

          <span className="text-[11px] font-mono text-neutral-400 w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Playback action buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/25 transition-transform active:scale-95"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  setCurrentTime(0);
                }
              }}
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Restart"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
