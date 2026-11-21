import React, { useState } from 'react';
import {
  History,
  Trash2,
  Download,
  Play,
  Volume2,
  Mic,
  Clock,
  FileAudio,
  Search,
  Check,
  Copy,
  Music,
  Archive,
  CheckSquare,
  Square,
  Sparkles,
  Loader2,
  FileArchive,
  AlertCircle,
} from 'lucide-react';
import { GeneratedAudio } from '../types';
import { AudioVisualizer } from './AudioVisualizer';
import { exportAsWav, exportAsMp3, exportBatchAsZip } from '../utils/audio';

interface AudioHistoryProps {
  history: GeneratedAudio[];
  onClearHistory: () => void;
  onDeleteAudio: (id: string) => void;
  onDeleteMultipleAudio?: (ids: string[]) => void;
  lang: 'en' | 'hi';
}

export const AudioHistory: React.FC<AudioHistoryProps> = ({
  history,
  onClearHistory,
  onDeleteAudio,
  onDeleteMultipleAudio,
  lang,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'speech-to-speech' | 'text-to-speech'>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingMp3Id, setExportingMp3Id] = useState<string | null>(null);
  const [successExport, setSuccessExport] = useState<{ id: string; format: string } | null>(null);

  // Batch Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchFormat, setBatchFormat] = useState<'wav' | 'mp3'>('wav');
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ percent: number; message: string } | null>(null);
  const [zipSuccessMessage, setZipSuccessMessage] = useState<string | null>(null);

  const filtered = history.filter((item) => {
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.transcript.toLowerCase().includes(search.toLowerCase()) ||
      item.voiceDisplayName.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const isAllSelected = filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id));
  const isPartiallySelected =
    filtered.some((item) => selectedIds.has(item.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all filtered items
      const next = new Set(selectedIds);
      filtered.forEach((item) => next.delete(item.id));
      setSelectedIds(next);
    } else {
      // Select all filtered items
      const next = new Set(selectedIds);
      filtered.forEach((item) => next.add(item.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const copyTranscript = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportWav = (item: GeneratedAudio) => {
    const cleanTitle = item.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    exportAsWav(item.audioBase64, `${cleanTitle}_${item.id}.wav`);
    setSuccessExport({ id: item.id, format: 'WAV' });
    setTimeout(() => setSuccessExport(null), 2500);
  };

  const handleExportMp3 = async (item: GeneratedAudio) => {
    setExportingMp3Id(item.id);
    try {
      const cleanTitle = item.title.replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportAsMp3(item.audioBase64, `${cleanTitle}_${item.id}.mp3`);
      setSuccessExport({ id: item.id, format: 'MP3' });
      setTimeout(() => setSuccessExport(null), 2500);
    } catch (err) {
      console.error('Export MP3 error:', err);
    } finally {
      setExportingMp3Id(null);
    }
  };

  // Batch Export as ZIP
  const handleBatchDownloadZip = async (targetItems?: GeneratedAudio[]) => {
    const itemsToExport =
      targetItems ||
      (selectedIds.size > 0
        ? history.filter((item) => selectedIds.has(item.id))
        : filtered);

    if (itemsToExport.length === 0) return;

    setIsExportingZip(true);
    setZipProgress({ percent: 10, message: lang === 'hi' ? 'ZIP फ़ाइल तैयार हो रही है...' : 'Initializing ZIP export...' });
    setZipSuccessMessage(null);

    try {
      await exportBatchAsZip(itemsToExport, batchFormat, (percent, message) => {
        setZipProgress({ percent, message });
      });

      setZipSuccessMessage(
        lang === 'hi'
          ? `सफलतापूर्वक ${itemsToExport.length} ऑडियो क्लिप्स की ZIP डाउनलोड हो गई!`
          : `Successfully exported ${itemsToExport.length} audio clips as ZIP!`
      );
      setTimeout(() => setZipSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Batch export failed:', err);
      alert(lang === 'hi' ? 'ZIP डाउनलोड में समस्या आई। कृपया दोबारा प्रयास करें।' : 'Failed to generate ZIP archive.');
    } finally {
      setIsExportingZip(false);
      setZipProgress(null);
    }
  };

  const handleBatchDelete = () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    const confirmMsg =
      lang === 'hi'
        ? `क्या आप चुनी हुई ${idsToDelete.length} ऑडियो हटाना चाहते हैं?`
        : `Are you sure you want to delete ${idsToDelete.length} selected audio clips?`;

    if (window.confirm(confirmMsg)) {
      if (onDeleteMultipleAudio) {
        onDeleteMultipleAudio(idsToDelete);
      } else {
        idsToDelete.forEach((id) => onDeleteAudio(id));
      }
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-violet-500/10 border border-white/10 rounded-2xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-semibold mb-2">
            <History className="w-3.5 h-3.5" />
            <span>{lang === 'hi' ? 'ऑडियो लाइब्रेरी & इतिहास' : 'Audio History & Exports'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {lang === 'hi' ? 'आपकी जनरेट की गई आवाज़ें' : 'Your Generated Audio Library'}
          </h2>
          <p className="text-sm text-neutral-300 mt-1">
            {lang === 'hi'
              ? 'यहाँ आपके सभी कनवर्टेड वॉइस और टेक्स्ट-टू-स्पीच ऑडियो सुरक्षित रहते हैं। एक साथ कई ऑडियो सेलेक्ट करके पूरी ZIP फ़ाइल भी डाउनलोड कर सकते हैं।'
              : 'Browse, listen, select multiple clips, and export as individual WAV/MP3 files or a combined ZIP archive.'}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-white/5 text-[11px] text-neutral-300">
            <span className="font-semibold text-orange-400">
              {lang === 'hi' ? 'सपोर्टेड एक्सपोर्ट:' : 'Export Formats:'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white font-mono">
              WAV (Lossless)
            </span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-amber-300 font-mono">
              MP3 (320kbps)
            </span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-300 font-semibold font-mono flex items-center gap-1">
              <Archive className="w-3 h-3" />
              ZIP Batch Export
            </span>
          </div>
        </div>

        {history.length > 0 && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Download ALL as ZIP button right from header */}
            <button
              onClick={() => handleBatchDownloadZip(history)}
              disabled={isExportingZip}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500 text-orange-300 hover:text-white text-xs font-bold border border-orange-500/30 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              title="Download entire library as ZIP"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'सभी ऑडियो ZIP में डाउनलोड करें' : 'Download All as ZIP'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 font-mono">
                {history.length}
              </span>
            </button>

            <button
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-red-500/20 hover:text-red-400 text-neutral-400 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'साफ़ करें' : 'Clear All'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0E131F] border border-white/10 rounded-2xl">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white/[0.04] text-neutral-400 hover:text-white'
            }`}
          >
            {lang === 'hi' ? 'सभी ऑडियो' : 'All'} ({history.length})
          </button>
          <button
            onClick={() => setFilterType('speech-to-speech')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'speech-to-speech'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white/[0.04] text-neutral-400 hover:text-white'
            }`}
          >
            <Mic className="w-3 h-3" />
            <span>{lang === 'hi' ? 'वॉइस कनवर्टेड' : 'Speech-to-Speech'}</span>
          </button>
          <button
            onClick={() => setFilterType('text-to-speech')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'text-to-speech'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white/[0.04] text-neutral-400 hover:text-white'
            }`}
          >
            <Volume2 className="w-3 h-3" />
            <span>{lang === 'hi' ? 'टेक्स्ट-टू-स्पीच' : 'Text-to-Speech'}</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={lang === 'hi' ? 'ऑडियो या शब्द खोजें...' : 'Search clips...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141B2B] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* BATCH ACTION TOOLBAR (Select All, Batch Download ZIP, Batch Delete) */}
      {filtered.length > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-[#111728] to-[#151D33] border border-orange-500/20 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
          {/* Select All Checkbox & Count */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white border border-white/10 transition-colors cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-orange-400" />
              ) : isPartiallySelected ? (
                <div className="w-4 h-4 rounded border-2 border-orange-400 flex items-center justify-center">
                  <div className="w-2 h-0.5 bg-orange-400" />
                </div>
              ) : (
                <Square className="w-4 h-4 text-neutral-400" />
              )}
              <span>
                {isAllSelected
                  ? lang === 'hi'
                    ? 'सभी अनसेलेक्ट करें'
                    : 'Deselect All'
                  : lang === 'hi'
                  ? `सभी चुनें (${filtered.length})`
                  : `Select All (${filtered.length})`}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 font-bold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-orange-400" />
                <span>
                  {selectedIds.size} {lang === 'hi' ? 'चुने गए' : 'selected'}
                </span>
              </span>
            )}

            {selectedIds.size > 0 && (
              <button
                onClick={clearSelection}
                className="text-[11px] text-neutral-400 hover:text-neutral-200 underline transition-colors cursor-pointer"
              >
                {lang === 'hi' ? 'क्लियर सिलेक्शन' : 'Clear'}
              </button>
            )}
          </div>

          {/* Batch Actions: Format & Download ZIP Button */}
          <div className="flex items-center gap-2">
            {/* Format Picker */}
            <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-0.5 text-xs font-semibold text-neutral-300">
              <button
                onClick={() => setBatchFormat('wav')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  batchFormat === 'wav'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'hover:text-white'
                }`}
              >
                WAV ZIP
              </button>
              <button
                onClick={() => setBatchFormat('mp3')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  batchFormat === 'mp3'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'hover:text-white'
                }`}
              >
                MP3 ZIP
              </button>
            </div>

            {/* DOWNLOAD ALL / DOWNLOAD SELECTED AS ZIP BUTTON */}
            <button
              onClick={() => handleBatchDownloadZip()}
              disabled={isExportingZip}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-xs shadow-lg shadow-orange-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {isExportingZip ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{zipProgress?.message || (lang === 'hi' ? 'कंप्रेस हो रहा है...' : 'Generating ZIP...')}</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  <span>
                    {selectedIds.size > 0
                      ? lang === 'hi'
                        ? `चुनी हुई (${selectedIds.size}) ZIP डाउनलोड करें`
                        : `Download Selected (${selectedIds.size}) as ZIP`
                      : lang === 'hi'
                      ? `सभी (${filtered.length}) ZIP डाउनलोड करें`
                      : `Download All (${filtered.length}) as ZIP`}
                  </span>
                </>
              )}
            </button>

            {/* Batch Delete Button */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
                title="Delete selected clips"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{lang === 'hi' ? 'हटाएं' : 'Delete'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ZIP Progress Bar when exporting */}
      {isExportingZip && zipProgress && (
        <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs text-orange-300 font-semibold">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              {zipProgress.message}
            </span>
            <span>{zipProgress.percent}%</span>
          </div>
          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300 rounded-full"
              style={{ width: `${zipProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* ZIP Download Success Toast */}
      {zipSuccessMessage && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-300 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{zipSuccessMessage}</span>
        </div>
      )}

      {/* History Items */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-[#0E131F] border border-white/5 rounded-2xl">
          <FileAudio className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-white">
            {lang === 'hi' ? 'कोई ऑडियो नहीं मिला' : 'No Audio Clips Found'}
          </h4>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            {lang === 'hi'
              ? 'आवाज़ बदलने या टेक्स्ट से नई आवाज़ बनाने के लिए ऊपर दिए गए टैब पर जाएं।'
              : 'Generate speech or convert your audio in the tabs above to see your history here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isSelected = selectedIds.has(item.id);

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl shadow-xl space-y-4 transition-all duration-200 border ${
                  isSelected
                    ? 'bg-[#12192B] border-orange-500/60 ring-2 ring-orange-500/30 shadow-orange-500/10'
                    : 'bg-[#0E131F] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    {/* Item Checkbox for Batch Selection */}
                    <button
                      onClick={(e) => toggleSelectItem(item.id, e)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title={isSelected ? 'Deselect clip' : 'Select clip'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-orange-400" />
                      ) : (
                        <Square className="w-5 h-5 text-neutral-500 hover:text-neutral-300" />
                      )}
                    </button>

                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        item.type === 'speech-to-speech'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {item.type === 'speech-to-speech' ? (
                        <Mic className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {item.title}
                        <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white/[0.06] text-neutral-300">
                          {item.voiceDisplayName}
                        </span>
                      </h4>
                      <span className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Quick Select Pill */}
                    <button
                      onClick={(e) => toggleSelectItem(item.id, e)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-orange-500 text-white border-orange-400'
                          : 'bg-white/[0.04] text-neutral-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>

                    <button
                      onClick={() => copyTranscript(item.id, item.transcript)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                      title="Copy transcript"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => onDeleteAudio(item.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-white/[0.06] transition-colors cursor-pointer"
                      title="Delete clip"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Transcript snippet */}
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                  <p className="text-xs text-neutral-300 italic line-clamp-2 leading-relaxed">
                    "{item.transcript}"
                  </p>
                </div>

                {/* Waveform Player */}
                <AudioVisualizer
                  audioBase64={item.audioBase64}
                  mimeType={item.mimeType}
                  title={item.title}
                  voiceName={item.voiceDisplayName}
                  downloadFilename={`vocalis_${item.id}`}
                  accentColor="orange"
                  showDownload={false}
                />

                {/* Dedicated Individual Export Controls: WAV & MP3 */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-bold text-white">
                      {lang === 'hi' ? 'सीधे डिवाइस में एक्सपोर्ट करें:' : 'Export directly to device:'}
                    </span>
                    <span className="text-[10px] text-neutral-400 hidden sm:inline">
                      {lang === 'hi' ? '(हाई-क्वालिटी WAV या MP3 चुनें)' : '(High-quality WAV or MP3)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Export WAV Button */}
                    <button
                      onClick={() => handleExportWav(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500 text-orange-300 hover:text-white border border-orange-500/30 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                      title="Download uncompressed 24kHz Lossless WAV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export WAV</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-orange-500/20 text-orange-200">
                        Lossless
                      </span>
                    </button>

                    {/* Export MP3 Button */}
                    <button
                      onClick={() => handleExportMp3(item)}
                      disabled={exportingMp3Id === item.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Download 320kbps High-Quality MP3"
                    >
                      {exportingMp3Id === item.id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          <span>Converting MP3...</span>
                        </>
                      ) : (
                        <>
                          <Music className="w-3.5 h-3.5" />
                          <span>Export MP3</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-200">
                            320k
                          </span>
                        </>
                      )}
                    </button>

                    {successExport?.id === item.id && (
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 animate-in fade-in">
                        <Check className="w-3.5 h-3.5" />
                        <span>{successExport.format} Downloaded!</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
