export interface Voice {
  id: string;
  name: string;
  voiceName: string; // 'Kore' | 'Fenrir' | 'Puck' | 'Charon' | 'Aoede' | 'Zephyr'
  gender: 'Female' | 'Male' | 'Neutral';
  age?: 'Young' | 'Middle-aged' | 'Old';
  accent: string;
  category: string;
  description: string;
  tags: string[];
  sampleText: string;
  isCustom?: boolean;
}

export interface GeneratedAudio {
  id: string;
  title: string;
  type: 'speech-to-speech' | 'text-to-speech';
  audioBase64: string;
  mimeType: string;
  duration?: number;
  timestamp: number;
  transcript: string;
  voiceName: string;
  voiceDisplayName: string;
  emotion?: string;
  language?: string;
  originalAudioBase64?: string;
}

export interface VoiceSettings {
  stability: number; // 0 to 1
  similarityBoost: number; // 0 to 1
  styleExaggeration: number; // 0 to 1
  speed: number; // 0.5 to 2.0
  pitchShift: number; // -12 to +12 semitones
  emotion: string;
  language: string;
}
