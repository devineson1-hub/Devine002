export function base64ToBlobUrl(base64: string, mimeType = 'audio/wav'): string {
  try {
    const cleanBase64 = base64.replace(/^data:audio\/\w+;base64,/, '');
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Error creating blob url:', err);
    return `data:${mimeType};base64,${base64}`;
  }
}

export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64Data] = result.split(',');
      const mimeMatch = header.match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : file.type || 'audio/wav';
      resolve({ base64: base64Data, mimeType });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function downloadAudio(base64: string, filename: string, mimeType = 'audio/wav') {
  const blobUrl = base64ToBlobUrl(base64, mimeType);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportAsWav(base64: string, filename: string) {
  const cleanName = filename.replace(/\.(wav|mp3)$/i, '');
  downloadAudio(base64, `${cleanName}.wav`, 'audio/wav');
}

export async function exportAsMp3(base64: string, filename: string): Promise<void> {
  const cleanName = filename.replace(/\.(wav|mp3)$/i, '');
  try {
    const response = await fetch('/api/convert-to-mp3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: base64,
        filename: `${cleanName}.mp3`,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.mp3Base64) {
      throw new Error(data.error || 'MP3 conversion failed');
    }

    downloadAudio(data.mp3Base64, `${cleanName}.mp3`, 'audio/mpeg');
  } catch (err) {
    console.warn('Falling back to client-side audio download as MP3/WAV', err);
    // Client fallback download
    downloadAudio(base64, `${cleanName}.wav`, 'audio/wav');
    throw err;
  }
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/^data:audio\/\w+;base64,/, '');
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function exportBatchAsZip(
  items: Array<{
    id: string;
    title: string;
    voiceDisplayName: string;
    type: string;
    timestamp: number;
    transcript: string;
    audioBase64: string;
    mimeType?: string;
  }>,
  format: 'wav' | 'mp3' = 'wav',
  onProgress?: (percent: number, message: string) => void
): Promise<void> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default || JSZipModule;
  const zip = new JSZip();

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const folderName = `vocalis_audio_batch_${timestampStr}`;
  const folder = zip.folder(folderName) || zip;

  let transcriptsSummary = `========================================================\n` +
    `VOCALIS AI AUDIO STUDIO - BATCH EXPORT SUMMARY\n` +
    `Export Date: ${new Date().toLocaleString()}\n` +
    `Total Clips: ${items.length}\n` +
    `Format: ${format.toUpperCase()}\n` +
    `========================================================\n\n`;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (onProgress) {
      const pct = Math.round(((i + 0.5) / items.length) * 75);
      onProgress(pct, `Packaging clip ${i + 1} of ${items.length} (${item.title.slice(0, 20)})...`);
    }

    const cleanTitle = (item.title || `clip_${i + 1}`)
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 35) || `clip_${i + 1}`;

    const filename = `${String(i + 1).padStart(2, '0')}_${cleanTitle}_${item.voiceDisplayName.replace(/[^a-zA-Z0-9]/g, '')}.${format}`;

    let audioBytes: Uint8Array;

    if (format === 'mp3') {
      try {
        const response = await fetch('/api/convert-to-mp3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: item.audioBase64,
            filename,
          }),
        });
        const data = await response.json();
        if (data.mp3Base64) {
          audioBytes = base64ToUint8Array(data.mp3Base64);
        } else {
          audioBytes = base64ToUint8Array(item.audioBase64);
        }
      } catch (err) {
        console.warn('Fallback to wav bytes for zip item', err);
        audioBytes = base64ToUint8Array(item.audioBase64);
      }
    } else {
      audioBytes = base64ToUint8Array(item.audioBase64);
    }

    folder.file(filename, audioBytes);

    transcriptsSummary += `[#${i + 1}] File: ${filename}\n` +
      `Title: ${item.title}\n` +
      `Voice: ${item.voiceDisplayName}\n` +
      `Generation Type: ${item.type}\n` +
      `Date: ${new Date(item.timestamp).toLocaleString()}\n` +
      `Transcript: "${item.transcript}"\n` +
      `--------------------------------------------------------\n\n`;
  }

  // Include comprehensive metadata README inside the zip
  folder.file('Transcripts_and_Metadata.txt', transcriptsSummary);

  if (onProgress) {
    onProgress(85, 'Compressing ZIP archive...');
  }

  const blob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) {
      const compressionPct = 85 + Math.round(metadata.percent * 0.15);
      onProgress(compressionPct, `Compressing: ${Math.round(metadata.percent)}%`);
    }
  });

  const downloadUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = `vocalis_batch_${format}_${items.length}_clips.zip`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadUrl);
}

export async function extractTextFromFile(file: File): Promise<{ text: string; filename: string; sizeKb: number }> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const sizeKb = Math.round(file.size / 1024);

  // Text-based files
  if (['txt', 'md', 'srt', 'json', 'csv', 'tsv', 'vtt', 'xml', 'html'].includes(extension || '')) {
    const text = await file.text();
    // Clean up SRT or VTT timestamps if requested or keep clean text
    if (extension === 'srt' || extension === 'vtt') {
      const cleanSubtitles = text
        .replace(/\d+\r?\n\d{2}:\d{2}:\d{2}[,\.]\d{3} --> \d{2}:\d{2}:\d{2}[,\.]\d{3}\r?\n/g, '')
        .replace(/<[^>]+>/g, '')
        .trim();
      return { text: cleanSubtitles, filename: file.name, sizeKb };
    }
    return { text: text.trim(), filename: file.name, sizeKb };
  }

  // Fallback text read
  try {
    const text = await file.text();
    // Filter non-printable ASCII/Unicode binary junk if accidentally uploaded
    const printable = text.replace(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g, '');
    if (printable.length > 20) {
      return { text: printable.slice(0, 10000).trim(), filename: file.name, sizeKb };
    }
  } catch (e) {
    // ignore
  }

  throw new Error(`Please upload a supported text file (.txt, .md, .srt, .json, .csv). For ${file.name}, text could not be parsed.`);
}
