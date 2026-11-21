import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { VOICES } from './src/data/voices';

dotenv.config();

const execFilePromise = util.promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Google GenAI
let ai: GoogleGenAI | null = null;

// Helper: Ensure Gemini client
function getGenAI() {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      ai = new GoogleGenAI({
        apiKey: key,
        apiVersion: 'v1beta',
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }
  return ai;
}

// Full 50-voice curated catalog mapped to Gemini audio personas
const VOICES_CATALOG = VOICES;
const ALLOWED_BASE_VOICES = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr']);

// Bounded in-memory store for agent-generated audio clips (max 50 clips, 30 min TTL)
interface StoredAudioClip {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  createdAt: number;
}
const generatedAudioStore = new Map<string, StoredAudioClip>();
const AUDIO_TTL_MS = 30 * 60 * 1000;
const MAX_STORED_CLIPS = 50;

function storeGeneratedAudio(base64: string, mimeType = 'audio/wav', filenamePrefix = 'vocalis_voice'): string {
  const now = Date.now();
  for (const [key, clip] of generatedAudioStore.entries()) {
    if (now - clip.createdAt > AUDIO_TTL_MS) {
      generatedAudioStore.delete(key);
    }
  }
  while (generatedAudioStore.size >= MAX_STORED_CLIPS) {
    const oldestKey = generatedAudioStore.keys().next().value;
    if (!oldestKey) break;
    generatedAudioStore.delete(oldestKey);
  }

  const id = crypto.randomUUID();
  const cleanBase64 = base64.replace(/^data:audio\/\w+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  const safePrefix = filenamePrefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'vocalis_voice';
  generatedAudioStore.set(id, {
    buffer,
    mimeType,
    filename: `${safePrefix}_${id.slice(0, 8)}.wav`,
    createdAt: now,
  });
  return id;
}

function getPublicBaseUrl(req: express.Request): string {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const proto = forwardedProto === 'https' || forwardedProto === 'http' ? forwardedProto : req.protocol || 'http';
  const rawHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() || req.get('host') || '';
  const isLocalHost = !rawHost || /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawHost);

  if (!isLocalHost && /^[a-zA-Z0-9.-]+(:\d+)?$/.test(rawHost)) {
    return `${proto}://${rawHost}`;
  }

  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // fall through to host fallback
    }
  }

  const safeHost = /^[a-zA-Z0-9.-]+(:\d+)?$/.test(rawHost) ? rawHost : `localhost:${PORT}`;
  return `${proto}://${safeHost}`;
}

interface OAuthClientRecord {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: number;
}
interface PendingOAuthRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
  attempts: number;
  expiresAt: number;
}
interface OAuthCodeRecord {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  expiresAt: number;
}
interface OAuthTokenRecord {
  clientId: string;
  scope: string;
  expiresAt: number;
}

const oauthClients = new Map<string, OAuthClientRecord>();
const pendingOAuthRequests = new Map<string, PendingOAuthRequest>();
const oauthAuthCodes = new Map<string, OAuthCodeRecord>();
const oauthAccessTokens = new Map<string, OAuthTokenRecord>();
const oauthRefreshTokens = new Map<string, OAuthTokenRecord>();

function setBoundedMap<K, V>(map: Map<K, V>, key: K, value: V, maxSize = 250) {
  while (map.size >= maxSize) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
  map.set(key, value);
}

function sha256Hex(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

function timingSafeTextEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidOAuthRedirectUri(rawUri: unknown): rawUri is string {
  if (typeof rawUri !== 'string' || rawUri.length > 512) return false;
  try {
    const parsed = new URL(rawUri);
    if (parsed.protocol === 'https:') return true;
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

const TRUSTED_CONNECTOR_ORIGINS = new Set(['https://claude.ai', 'https://claude.com']);

function signOAuthPayload(secret: string, payloadObj: Record<string, any>): string {
  const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', `vocalis-oauth:${secret}`).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyOAuthPayload(secret: string, token: string): Record<string, any> | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', `vocalis-oauth:${secret}`).update(payload).digest('base64url');
  if (!timingSafeTextEqual(sig, expectedSig)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded !== 'object') return null;
    if (typeof decoded.exp === 'number' && decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

function applySafeAgentCors(req: express.Request, res: express.Response) {
  const origin = req.headers.origin;
  if (!origin) return;
  const configuredToken = process.env.VOCALIS_API_TOKEN?.trim();
  const appUrl = process.env.APP_URL?.trim();
  let allowedOrigin: string | null = null;
  if (TRUSTED_CONNECTOR_ORIGINS.has(origin)) {
    allowedOrigin = origin;
  }
  if (!allowedOrigin && appUrl && appUrl !== 'MY_APP_URL') {
    try {
      if (new URL(appUrl).origin === origin) {
        allowedOrigin = origin;
      }
    } catch {
      // ignore invalid APP_URL
    }
  }
  if (!allowedOrigin && !configuredToken) {
    // Allow public discovery/preview only when no secret token is configured
    allowedOrigin = origin;
  }
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-API-Key, API-Key, X-Auth-Token, Mcp-Session-Id, MCP-Protocol-Version'
    );
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');
  }
}

function verifyAgentAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  applySafeAgentCors(req, res);
  const configuredToken = process.env.VOCALIS_API_TOKEN?.trim();
  if (!configuredToken) {
    return next();
  }
  const baseUrl = getPublicBaseUrl(req);
  const resourceMetadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`;

  const authHeader = (req.headers.authorization || '').trim();
  const customKeyHeader =
    (typeof req.headers['x-api-key'] === 'string' && req.headers['x-api-key'].trim()) ||
    (typeof req.headers['api-key'] === 'string' && req.headers['api-key'].trim()) ||
    (typeof req.headers['x-auth-token'] === 'string' && req.headers['x-auth-token'].trim()) ||
    '';

  let providedToken = '';
  if (authHeader) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    providedToken = bearerMatch ? bearerMatch[1].trim() : authHeader;
  } else if (customKeyHeader) {
    providedToken = customKeyHeader;
  }

  if (!providedToken) {
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl}"`);
    return res.status(401).json({
      error: 'Unauthorized. Provide Authorization: Bearer <token> or sign in via OAuth.',
    });
  }

  if (timingSafeTextEqual(providedToken, configuredToken)) {
    return next();
  }

  const signedClaims = verifyOAuthPayload(configuredToken, providedToken);
  if (signedClaims && signedClaims.typ === 'access') {
    return next();
  }

  const tokenHash = sha256Hex(providedToken);
  const oauthRecord = oauthAccessTokens.get(tokenHash);
  if (oauthRecord) {
    if (oauthRecord.expiresAt > Date.now()) {
      return next();
    }
    oauthAccessTokens.delete(tokenHash);
  }

  res.setHeader('WWW-Authenticate', `Bearer error="invalid_token", resource_metadata="${resourceMetadataUrl}"`);
  return res.status(401).json({ error: 'Unauthorized. Invalid or expired access token.' });
}

interface TtsSynthesisParams {
  text: string;
  voiceId?: string;
  voiceName?: string;
  style?: string;
  stability?: number;
  speed?: number;
  pitch?: number;
  voiceAge?: string;
  emotion?: string;
  language?: string;
}

async function synthesizeTtsAudio(params: TtsSynthesisParams) {
  const client = getGenAI();
  if (!client) {
    const err: any = new Error('GEMINI_API_KEY is not configured in environment secrets.');
    err.status = 500;
    throw err;
  }

  const {
    text,
    voiceId,
    voiceName = 'Kore',
    style = 'Natural, clear, human-like cadence',
    stability = 0.75,
    speed = 1.0,
    pitch = 0,
    voiceAge = 'default',
    emotion = 'Natural',
    language = 'Auto',
  } = params;

  if (!text || typeof text !== 'string' || !text.trim()) {
    const err: any = new Error('Text content is required');
    err.status = 400;
    throw err;
  }
  if (text.length > 10000) {
    const err: any = new Error('Text exceeds maximum length of 10,000 characters');
    err.status = 400;
    throw err;
  }

  const catalogMatch = voiceId
    ? VOICES_CATALOG.find((v) => v.id === voiceId || v.name.toLowerCase() === voiceId.toLowerCase())
    : undefined;
  const resolvedVoiceName = catalogMatch?.voiceName || (ALLOWED_BASE_VOICES.has(voiceName) ? voiceName : 'Kore');

  let stylePrompt = catalogMatch
    ? `${catalogMatch.description}. ${style || ''}`.trim()
    : style || 'Clear, natural, professional human voice';
  if (emotion && emotion !== 'Natural') {
    stylePrompt += `. Emotion: ${emotion}`;
  }
  if (language && language !== 'Auto') {
    stylePrompt += `. Target spoken language: ${language}`;
  }
  const effectiveAge = voiceAge && voiceAge !== 'default' ? voiceAge : catalogMatch?.age?.toLowerCase();
  if (effectiveAge && effectiveAge !== 'default') {
    if (effectiveAge === 'young') {
      stylePrompt += '. Vocal age character: youthful, young adult (18-25 years old), energetic, fresh bright cadence';
    } else if (effectiveAge === 'old') {
      stylePrompt += '. Vocal age character: elderly senior citizen (65+ years old), wise grandfatherly/grandmotherly gravitas, aged vocal texture and comforting depth';
    } else if (effectiveAge === 'middle-aged') {
      stylePrompt += '. Vocal age character: middle-aged mature adult (35-50 years old), experienced, seasoned, steady and authoritative';
    }
  }
  const clampedPitch = Math.max(-12, Math.min(12, Number(pitch) || 0));
  if (clampedPitch !== 0) {
    const pitchDesc =
      clampedPitch < -4
        ? 'deep, resonant, low-register pitch'
        : clampedPitch < 0
        ? 'slightly lower pitch'
        : clampedPitch > 4
        ? 'high, bright pitch'
        : 'slightly higher pitch';
    stylePrompt += `. Vocal pitch register: ${pitchDesc} (${clampedPitch > 0 ? '+' : ''}${clampedPitch} semitones)`;
  }
  const clampedStability = Math.max(0, Math.min(1, Number(stability ?? 0.75)));
  const stabDesc =
    clampedStability < 0.45
      ? 'highly dynamic, expressive vocal inflections with animated emotion'
      : clampedStability > 0.8
      ? 'very steady, controlled, grounded, uniform vocal stability'
      : 'balanced natural human stability';
  stylePrompt += `. Voice stability: ${stabDesc}`;

  const clampedSpeed = Math.max(0.5, Math.min(2.0, Number(speed ?? 1.0)));
  if (clampedSpeed !== 1.0) {
    const speedDesc =
      clampedSpeed < 0.85
        ? 'very slow, deliberate pacing'
        : clampedSpeed < 1.0
        ? 'slightly slower, relaxed pacing'
        : clampedSpeed > 1.25
        ? 'fast, brisk energetic pacing'
        : 'slightly faster pacing';
    stylePrompt += `. Speaking speed: ${speedDesc} (${clampedSpeed}x)`;
  }

  let audioPart: any = null;
  let usedModel = 'gemini-3.8-flash-tts';

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: stylePrompt,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: resolvedVoiceName,
            },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    audioPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);
  } catch (primaryErr: any) {
    console.warn('Primary TTS (gemini-3.8-flash-tts) failed, trying gemini-3.8-flash-lite-tts:', primaryErr?.message);
  }

  if (!audioPart?.inlineData?.data) {
    usedModel = 'gemini-3.8-flash-lite-tts';
    const fallbackResponse = await client.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: stylePrompt,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: resolvedVoiceName,
            },
          },
        },
      },
    });

    audioPart = fallbackResponse.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
  }

  if (!audioPart?.inlineData?.data) {
    const err: any = new Error('Audio synthesis failed to produce audio data.');
    err.status = 500;
    throw err;
  }

  return {
    audioBase64: audioPart.inlineData.data as string,
    mimeType: (audioPart.inlineData.mimeType as string) || 'audio/wav',
    text: text.trim(),
    voice: catalogMatch ? `${catalogMatch.name} (${resolvedVoiceName})` : resolvedVoiceName,
    voiceName: resolvedVoiceName,
    style: stylePrompt,
    model: usedModel,
  };
}

// API: Get voice catalog
app.get('/api/voices', (req, res) => {
  applySafeAgentCors(req, res);
  res.json({ voices: VOICES_CATALOG });
});

// API: Check system status & API key state
app.get('/api/status', (_req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    hasApiKey: hasKey,
    voicesCount: VOICES_CATALOG.length,
    agentAuthRequired: Boolean(process.env.VOCALIS_API_TOKEN?.trim()),
    endpoints: {
      mcp: '/mcp',
      openApi: '/openapi.json',
      agentTts: '/api/agent/tts',
      agentMultiSpeaker: '/api/agent/multi-speaker',
      audioDownload: '/api/audio/:id.wav',
    },
  });
});

// API: Serve generated audio clip directly as binary WAV (with Range support for mobile/browsers)
app.get('/api/audio/:id', (req, res) => {
  applySafeAgentCors(req, res);
  const rawId = req.params.id || '';
  const match = rawId.match(/^([a-f0-9-]{36})(?:\.wav)?$/i);
  if (!match) {
    return res.status(400).json({ error: 'Invalid audio clip ID' });
  }
  const clip = generatedAudioStore.get(match[1]);
  if (!clip) {
    return res.status(404).json({ error: 'Audio clip expired or not found' });
  }

  const total = clip.buffer.length;
  const contentType = clip.mimeType || 'audio/wav';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', `inline; filename="${clip.filename}"`);
  res.setHeader('Cache-Control', 'private, max-age=1800');

  const rangeHeader = req.headers.range;
  if (rangeHeader && /^bytes=\d*-\d*$/i.test(rangeHeader.trim())) {
    const [startStr, endStr] = rangeHeader.replace(/^bytes=/i, '').split('-');
    const start = startStr ? Math.min(Number(startStr), total - 1) : 0;
    const end = endStr ? Math.min(Number(endStr), total - 1) : total - 1;
    if (start <= end && start >= 0) {
      const chunk = clip.buffer.subarray(start, end + 1);
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(chunk.length));
      return res.send(chunk);
    }
  }

  res.setHeader('Content-Length', String(total));
  res.send(clip.buffer);
});

// API: Text-To-Speech (ElevenLabs-style Voice Synthesis)
app.post('/api/tts', async (req, res) => {
  try {
    const result = await synthesizeTtsAudio(req.body || {});
    res.json(result);
  } catch (error: any) {
    console.error('TTS error:', error);
    res.status(error.status || 500).json({
      error: error.message || 'Error occurred during voice generation',
      details: error.toString(),
    });
  }
});

// API: Speech-To-Speech / Voice Changer (Convert audio to realistic voice)
app.post('/api/speech-to-speech', async (req, res) => {
  try {
    const client = getGenAI();
    if (!client) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured in environment secrets.',
      });
    }

    const {
      audioBase64,
      mimeType = 'audio/webm',
      targetVoice = 'Kore',
      customStyle = 'Retain original pacing and emotional inflections, speak with studio clarity',
      enhanceAudio = true,
      targetLanguage = 'Keep original',
      pitch = 0,
      stability = 0.75,
      voiceAge = 'default',
    } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio file / recording data is required' });
    }

    // Step 1: Transcribe input audio using gemini-3.5-transcribe, then detect language/emotion
    let analysis: any = {
      transcript: '',
      language: 'English',
      detectedEmotion: 'Natural',
      recommendedSpeechStyle: 'Natural expressive human speech',
    };

    const transcribeResponse = await client.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: mimeType || 'audio/wav',
            },
          },
          { text: 'Transcribe this audio verbatim in its original language.' },
        ],
      },
    });

    analysis.transcript = transcribeResponse.text?.trim() || '';

    if (analysis.transcript) {
      try {
        const metaResponse = await client.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Analyze this spoken transcript and identify the language, likely emotion/tone, and a concise TTS speech style description.\nTranscript: "${analysis.transcript}"`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                language: { type: Type.STRING },
                detectedEmotion: { type: Type.STRING },
                recommendedSpeechStyle: { type: Type.STRING },
              },
            },
          },
        });
        const meta = JSON.parse(metaResponse.text?.trim() || '{}');
        if (meta.language) analysis.language = meta.language;
        if (meta.detectedEmotion) analysis.detectedEmotion = meta.detectedEmotion;
        if (meta.recommendedSpeechStyle) analysis.recommendedSpeechStyle = meta.recommendedSpeechStyle;
      } catch (metaErr: any) {
        console.warn('Metadata analysis skipped:', metaErr?.message);
      }
    }

    if (!analysis.transcript || analysis.transcript.trim().length === 0) {
      return res.status(400).json({
        error: 'Could not clearly detect speech in the uploaded audio. Please speak clearly or try a clearer audio recording.',
      });
    }

    // Step 2: Synthesize in target realistic voice
    let synthesizedStyle = `${customStyle || analysis.recommendedSpeechStyle}. Emotion: ${analysis.detectedEmotion}. Language: ${targetLanguage !== 'Keep original' ? targetLanguage : analysis.language}. Studio quality, realistic human cadence.`;
    if (voiceAge && voiceAge !== 'default') {
      if (voiceAge === 'young') {
        synthesizedStyle += '. Vocal age character: youthful, young adult (18-25 years old), energetic, fresh bright cadence';
      } else if (voiceAge === 'old') {
        synthesizedStyle += '. Vocal age character: elderly senior citizen (65+ years old), wise grandfatherly/grandmotherly gravitas, aged vocal depth';
      } else if (voiceAge === 'middle-aged') {
        synthesizedStyle += '. Vocal age character: middle-aged mature adult (35-50 years old), experienced and steady';
      }
    }
    if (pitch !== undefined && Number(pitch) !== 0) {
      const p = Number(pitch);
      const pitchDesc = p < -4 ? 'deep, resonant, low-register pitch' : p < 0 ? 'slightly lower pitch' : p > 4 ? 'high, bright pitch' : 'slightly higher pitch';
      synthesizedStyle += `. Vocal pitch register: ${pitchDesc} (${p > 0 ? '+' : ''}${p} semitones)`;
    }
    if (stability !== undefined) {
      const s = Number(stability);
      const stabDesc = s < 0.45 ? 'highly dynamic, expressive vocal inflections' : s > 0.8 ? 'very steady, controlled, grounded vocal stability' : 'balanced natural stability';
      synthesizedStyle += `. Voice stability: ${stabDesc}`;
    }

    let audioPart: any = null;
    try {
      const ttsResponse = await client.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: analysis.transcript,
                speechMetadata: {
                  style: synthesizedStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: targetVoice || 'Kore',
              },
            },
          },
        },
      });

      const candidate = ttsResponse.candidates?.[0];
      audioPart = candidate?.content?.parts?.find(
        (p: any) => p.inlineData?.data
      );
    } catch (ttsErr: any) {
      console.warn('Primary STS TTS failed, falling back to gemini-3.8-flash-lite-tts:', ttsErr?.message);
    }

    if (!audioPart?.inlineData?.data) {
      const fallbackResponse = await client.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: analysis.transcript,
                speechMetadata: {
                  style: synthesizedStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: targetVoice || 'Kore',
              },
            },
          },
        },
      });

      audioPart = fallbackResponse.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData?.data
      );
    }

    if (!audioPart?.inlineData?.data) {
      return res.status(500).json({
        error: 'Voice conversion synthesis failed.',
        analysis,
      });
    }

    res.json({
      audioBase64: audioPart.inlineData.data,
      mimeType: audioPart.inlineData.mimeType || 'audio/wav',
      transcript: analysis.transcript,
      detectedLanguage: analysis.language,
      detectedEmotion: analysis.detectedEmotion,
      targetVoice,
      appliedStyle: synthesizedStyle,
    });
  } catch (error: any) {
    console.error('Speech-to-Speech conversion error:', error);
    res.status(500).json({
      error: error.message || 'Error occurred during voice conversion',
      details: error.toString(),
    });
  }
});

async function synthesizeMultiSpeakerAudio(params: {
  dialogue: Array<{ speaker: string; text: string; style?: string }>;
  speaker1?: { name: string; voice: string };
  speaker2?: { name: string; voice: string };
}) {
  const client = getGenAI();
  if (!client) {
    const err: any = new Error('GEMINI_API_KEY is not configured in environment secrets.');
    err.status = 500;
    throw err;
  }

  const {
    dialogue,
    speaker1 = { name: 'Alex', voice: 'Puck' },
    speaker2 = { name: 'Sam', voice: 'Kore' },
  } = params;

  if (!Array.isArray(dialogue) || dialogue.length === 0) {
    const err: any = new Error('Dialogue array is required');
    err.status = 400;
    throw err;
  }

  const parts = dialogue.map((item) => ({
    text: `${String(item.speaker || speaker1.name)}: ${String(item.text || '')}`,
    speechMetadata: {
      speaker: String(item.speaker || speaker1.name),
      style: item.style || 'Natural conversational tone',
    },
  }));

  const response = await client.models.generateContent({
    model: 'gemini-3.8-flash-tts',
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: speaker1.name,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: ALLOWED_BASE_VOICES.has(speaker1.voice) ? speaker1.voice : 'Puck' },
              },
            },
            {
              speaker: speaker2.name,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: ALLOWED_BASE_VOICES.has(speaker2.voice) ? speaker2.voice : 'Kore' },
              },
            },
          ],
        },
      },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);

  if (!audioPart?.inlineData?.data) {
    const err: any = new Error('Multi-speaker audio generation failed');
    err.status = 500;
    throw err;
  }

  return {
    audioBase64: audioPart.inlineData.data as string,
    mimeType: (audioPart.inlineData.mimeType as string) || 'audio/wav',
    dialogueCount: dialogue.length,
  };
}

// API: Multi-speaker Screenplay / Dialogue generation
app.post('/api/multi-speaker', async (req, res) => {
  try {
    const result = await synthesizeMultiSpeakerAudio(req.body || {});
    res.json(result);
  } catch (error: any) {
    console.error('Multi-speaker error:', error);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to synthesize multi-speaker dialogue',
    });
  }
});

// =========================================================================
// AI AGENT & CLAUDE MCP INTEGRATION (OpenAPI + Direct Audio URLs + /mcp)
// =========================================================================

app.options(['/api/agent/*', '/mcp', '/openapi.json', '/api/voices', '/api/audio/:id'], (req, res) => {
  applySafeAgentCors(req, res);
  res.status(204).end();
});

// Agent-friendly TTS: Returns direct playable/downloadable .wav URL (compact for LLM context)
app.post('/api/agent/tts', verifyAgentAuth, async (req, res) => {
  applySafeAgentCors(req, res);
  try {
    const { includeBase64 = false, ...ttsParams } = req.body || {};
    const result = await synthesizeTtsAudio(ttsParams);
    const clipId = storeGeneratedAudio(result.audioBase64, result.mimeType, `tts_${result.voiceName}`);
    const baseUrl = getPublicBaseUrl(req);
    const audioUrl = `${baseUrl}/api/audio/${clipId}.wav`;

    const payload: Record<string, any> = {
      audioUrl,
      mimeType: result.mimeType,
      voice: result.voice,
      model: result.model,
      text: result.text,
      expiresInMinutes: 30,
    };
    if (includeBase64 === true) {
      payload.audioBase64 = result.audioBase64;
    }
    res.json(payload);
  } catch (error: any) {
    res.status(error.status || 500).json({
      error: error.message || 'Agent TTS generation failed',
    });
  }
});

// Agent-friendly Multi-Speaker Dialogue: Returns direct playable/downloadable .wav URL
app.post('/api/agent/multi-speaker', verifyAgentAuth, async (req, res) => {
  applySafeAgentCors(req, res);
  try {
    const result = await synthesizeMultiSpeakerAudio(req.body || {});
    const clipId = storeGeneratedAudio(result.audioBase64, result.mimeType, 'dialogue');
    const baseUrl = getPublicBaseUrl(req);
    const audioUrl = `${baseUrl}/api/audio/${clipId}.wav`;

    res.json({
      audioUrl,
      mimeType: result.mimeType,
      dialogueCount: result.dialogueCount,
      expiresInMinutes: 30,
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      error: error.message || 'Agent multi-speaker generation failed',
    });
  }
});

// OpenAPI 3.1 Specification for Cloud AI Agents (Custom GPTs, LangChain, n8n, OpenAI Agents)
app.get('/openapi.json', (req, res) => {
  applySafeAgentCors(req, res);
  const baseUrl = getPublicBaseUrl(req);
  const authRequired = Boolean(process.env.VOCALIS_API_TOKEN?.trim());

  res.json({
    openapi: '3.1.0',
    info: {
      title: 'Vocalis AI Voice Studio API',
      version: '1.0.0',
      description: 'Generate realistic Hindi, Hinglish, and English AI speech and multi-speaker dialogues.',
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
    ...(authRequired ? { security: [{ bearerAuth: [] }] } : {}),
    paths: {
      '/api/voices': {
        get: {
          operationId: 'listVoices',
          summary: 'List all 50 realistic AI voice personas',
          responses: {
            '200': {
              description: 'List of available voice personas',
            },
          },
        },
      },
      '/api/agent/tts': {
        post: {
          operationId: 'generateVoice',
          summary: 'Generate realistic AI speech from text and return a direct WAV audio URL',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['text'],
                  properties: {
                    text: { type: 'string', description: 'Script to speak (Hindi, Hinglish, English, etc.). Supports <laugh>, <breath>, <gasp>.' },
                    voiceId: { type: 'string', description: 'Optional voice preset ID from /api/voices (e.g. priya-kore-hindi, aarav-fenrir-hindi, rachel-kore).' },
                    voiceName: { type: 'string', enum: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr'], default: 'Kore' },
                    emotion: { type: 'string', description: 'Delivery style/emotion (e.g. Natural, Warm storyteller, Cinematic)' },
                    language: { type: 'string', description: 'Target language (Auto, Hindi, Hinglish, English)' },
                    voiceAge: { type: 'string', enum: ['default', 'young', 'middle-aged', 'old'], default: 'default' },
                    speed: { type: 'number', minimum: 0.5, maximum: 2.0, default: 1.0 },
                    pitch: { type: 'number', minimum: -12, maximum: 12, default: 0 },
                    stability: { type: 'number', minimum: 0, maximum: 1, default: 0.75 },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Generated audio URL and metadata',
            },
          },
        },
      },
      '/api/agent/multi-speaker': {
        post: {
          operationId: 'generateDialogue',
          summary: 'Generate a 2-speaker AI podcast or dialogue audio URL',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['dialogue'],
                  properties: {
                    speaker1: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', default: 'Alex' },
                        voice: { type: 'string', enum: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr'], default: 'Puck' },
                      },
                    },
                    speaker2: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', default: 'Sam' },
                        voice: { type: 'string', enum: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr'], default: 'Kore' },
                      },
                    },
                    dialogue: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['speaker', 'text'],
                        properties: {
                          speaker: { type: 'string' },
                          text: { type: 'string' },
                          style: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Generated dialogue audio URL' },
          },
        },
      },
    },
  });
});

// Streamable HTTP MCP Server for Claude AI / Claude Desktop / Claude Code
const MCP_TOOLS = [
  {
    name: 'list_voices',
    description: 'List available realistic Hindi, Hinglish, and English voice personas in Vocalis AI Studio.',
    inputSchema: {
      type: 'object',
      properties: {
        gender: { type: 'string', enum: ['All', 'Female', 'Male'], description: 'Filter by gender' },
        language: { type: 'string', description: 'Optional filter keyword like Hindi, Hinglish, British, American' },
        age: { type: 'string', enum: ['All', 'Young', 'Middle-aged', 'Old'], description: 'Filter by vocal age' },
      },
    },
  },
  {
    name: 'generate_voice',
    description: 'Generate realistic AI speech from text in Hindi, Hinglish, or English and return a direct playable WAV audio URL.',
    inputSchema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string', description: 'The script to convert to speech. Supports <laugh>, <breath>, <gasp>, |yeah|, |mhm|.' },
        voiceId: { type: 'string', description: 'Optional voice ID from list_voices (e.g. priya-kore-hindi, aarav-fenrir-hindi, rachel-kore).' },
        voiceName: { type: 'string', enum: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr'], description: 'Base voice model if voiceId is omitted.' },
        emotion: { type: 'string', description: 'Delivery emotion or style (e.g. Natural, Warm storyteller, Cinematic, Energetic).' },
        language: { type: 'string', description: 'Target language hint (Auto, Hindi, Hinglish, English).' },
        voiceAge: { type: 'string', enum: ['default', 'young', 'middle-aged', 'old'] },
        speed: { type: 'number', description: 'Speaking speed from 0.5 to 2.0 (default 1.0).' },
        pitch: { type: 'number', description: 'Pitch shift from -12 to +12 semitones (default 0).' },
        stability: { type: 'number', description: 'Voice stability from 0.0 to 1.0 (default 0.75).' },
      },
    },
  },
  {
    name: 'generate_dialogue',
    description: 'Generate a natural two-speaker podcast or conversational audio clip and return its WAV URL.',
    inputSchema: {
      type: 'object',
      required: ['dialogue'],
      properties: {
        speaker1: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            voice: { type: 'string', enum: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr'] },
          },
        },
        speaker2: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            voice: { type: 'string', enum: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr'] },
          },
        },
        dialogue: {
          type: 'array',
          items: {
            type: 'object',
            required: ['speaker', 'text'],
            properties: {
              speaker: { type: 'string' },
              text: { type: 'string' },
              style: { type: 'string' },
            },
          },
        },
      },
    },
  },
];

const SUPPORTED_MCP_VERSIONS = new Set(['2025-06-18', '2025-03-26', '2024-11-05']);

app.get('/mcp', verifyAgentAuth, (req, res) => {
  applySafeAgentCors(req, res);
  if (req.headers.accept?.includes('text/event-stream')) {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed: Server does not open unsolicited SSE streams.' });
  }
  res.json({
    name: 'vocalis-ai-studio',
    version: '1.0.0',
    transport: 'streamable-http',
    protocolVersion: '2025-03-26',
    tools: MCP_TOOLS.map((t) => t.name),
  });
});

app.delete('/mcp', verifyAgentAuth, (req, res) => {
  applySafeAgentCors(req, res);
  res.status(204).end();
});

app.post('/mcp', verifyAgentAuth, async (req, res) => {
  applySafeAgentCors(req, res);
  const body = req.body;
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: body?.id ?? null,
      error: { code: -32600, message: 'Invalid JSON-RPC 2.0 request' },
    });
  }

  const { id, method, params = {} } = body;
  const incomingSessionId = (req.headers['mcp-session-id'] as string | undefined)?.trim();
  if (incomingSessionId) {
    res.setHeader('Mcp-Session-Id', incomingSessionId);
  }

  // Notifications have no id (or notifications/* prefix) and expect 202 Accepted
  if (method.startsWith('notifications/') || id === undefined) {
    return res.status(202).end();
  }

  try {
    if (method === 'initialize') {
      const requestedVersion = typeof params?.protocolVersion === 'string' ? params.protocolVersion : '';
      const protocolVersion = SUPPORTED_MCP_VERSIONS.has(requestedVersion) ? requestedVersion : '2025-03-26';
      const sessionId = incomingSessionId || crypto.randomUUID();
      res.setHeader('Mcp-Session-Id', sessionId);

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: 'vocalis-ai-studio',
            version: '1.0.0',
          },
        },
      });
    }

    if (method === 'ping') {
      return res.json({ jsonrpc: '2.0', id, result: {} });
    }

    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: { tools: MCP_TOOLS },
      });
    }

    if (method === 'resources/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: { resources: [] },
      });
    }

    if (method === 'resources/templates/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: { resourceTemplates: [] },
      });
    }

    if (method === 'prompts/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: { prompts: [] },
      });
    }

    if (method === 'tools/call') {
      const toolName = params.name;
      const args = params.arguments || {};

      if (toolName === 'list_voices') {
        const gender = args.gender && args.gender !== 'All' ? String(args.gender) : null;
        const age = args.age && args.age !== 'All' ? String(args.age) : null;
        const langQuery = args.language ? String(args.language).toLowerCase() : null;

        const filtered = VOICES_CATALOG.filter((v) => {
          if (gender && v.gender !== gender) return false;
          if (age && v.age !== age) return false;
          if (
            langQuery &&
            !v.accent.toLowerCase().includes(langQuery) &&
            !v.category.toLowerCase().includes(langQuery) &&
            !v.tags.some((t) => t.toLowerCase().includes(langQuery))
          ) {
            return false;
          }
          return true;
        }).map((v) => ({
          id: v.id,
          name: v.name,
          voiceName: v.voiceName,
          gender: v.gender,
          age: v.age,
          accent: v.accent,
          category: v.category,
        }));

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ count: filtered.length, voices: filtered }, null, 2) }],
          },
        });
      }

      if (toolName === 'generate_voice') {
        const result = await synthesizeTtsAudio(args);
        const clipId = storeGeneratedAudio(result.audioBase64, result.mimeType, `mcp_${result.voiceName}`);
        const audioUrl = `${getPublicBaseUrl(req)}/api/audio/${clipId}.wav`;

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    audioUrl,
                    mimeType: result.mimeType,
                    voice: result.voice,
                    model: result.model,
                    text: result.text,
                    expiresInMinutes: 30,
                  },
                  null,
                  2
                ),
              },
            ],
          },
        });
      }

      if (toolName === 'generate_dialogue') {
        const result = await synthesizeMultiSpeakerAudio(args);
        const clipId = storeGeneratedAudio(result.audioBase64, result.mimeType, 'mcp_dialogue');
        const audioUrl = `${getPublicBaseUrl(req)}/api/audio/${clipId}.wav`;

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    audioUrl,
                    mimeType: result.mimeType,
                    dialogueCount: result.dialogueCount,
                    expiresInMinutes: 30,
                  },
                  null,
                  2
                ),
              },
            ],
          },
        });
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` },
      });
    }

    return res.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (err: any) {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        isError: true,
        content: [{ type: 'text', text: err.message || 'Tool execution failed' }],
      },
    });
  }
});

// API: Convert WAV to MP3 (High quality 320kbps via ffmpeg)
app.post('/api/convert-to-mp3', async (req, res) => {
  try {
    const { audioBase64, filename = 'vocalis_audio' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }

    const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
    const wavBuffer = Buffer.from(cleanBase64, 'base64');

    const tempDir = os.tmpdir();
    const uniqueId = Date.now() + '_' + Math.random().toString(36).substring(7);
    const inputWavPath = path.join(tempDir, `input_${uniqueId}.wav`);
    const outputMp3Path = path.join(tempDir, `output_${uniqueId}.mp3`);

    await fs.promises.writeFile(inputWavPath, wavBuffer);

    // Convert via ffmpeg to 320kbps MP3 stereo 44.1kHz
    await execFilePromise('ffmpeg', [
      '-y',
      '-i',
      inputWavPath,
      '-vn',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-b:a',
      '320k',
      outputMp3Path,
    ]);

    const mp3Buffer = await fs.promises.readFile(outputMp3Path);
    const mp3Base64 = mp3Buffer.toString('base64');

    // Asynchronous cleanup
    fs.promises.unlink(inputWavPath).catch(() => {});
    fs.promises.unlink(outputMp3Path).catch(() => {});

    res.json({
      mp3Base64,
      mimeType: 'audio/mpeg',
      filename: filename.endsWith('.mp3') ? filename : `${filename}.mp3`,
    });
  } catch (error: any) {
    console.error('MP3 conversion error:', error);
    res.status(500).json({
      error: error.message || 'Failed to convert audio to MP3',
    });
  }
});

// =========================================================================
// MCP OAUTH 2.1 + DYNAMIC CLIENT REGISTRATION (for Claude Mobile/Web)
// Active whenever VOCALIS_API_TOKEN is set; returns 404 when auth is off.
// =========================================================================

function renderOAuthAuthorizePage(opts: {
  requestId: string;
  clientName: string;
  errorText?: string;
}): string {
  const safeId = escapeHtml(opts.requestId);
  const safeClient = escapeHtml(opts.clientName || 'AI Connector');
  const errorBlock = opts.errorText
    ? `<div class="err">${escapeHtml(opts.errorText)}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize Vocalis AI Connector</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #070A11; color: #F5F5F5; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 20px; }
    .card { width: 100%; max-width: 400px; background: #0E131F; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
    h1 { font-size: 19px; margin: 0 0 8px; color: #fff; }
    p { font-size: 13px; color: #A3A3A3; line-height: 1.5; margin: 0 0 18px; }
    .badge { display: inline-block; font-size: 12px; color: #FB923C; background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.3); padding: 4px 10px; border-radius: 8px; margin-bottom: 14px; }
    label { display: block; font-size: 12px; color: #D4D4D4; margin-bottom: 6px; font-weight: 600; }
    input[type="password"] { width: 100%; box-sizing: border-box; padding: 11px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: #070A11; color: #fff; font-size: 14px; margin-bottom: 14px; }
    button { width: 100%; padding: 12px; border: 0; border-radius: 10px; background: linear-gradient(90deg, #F97316, #F59E0B); color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; }
    .err { background: rgba(239,68,68,0.14); border: 1px solid rgba(239,68,68,0.35); color: #FCA5A5; font-size: 12px; padding: 10px; border-radius: 8px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Vocalis AI Voice Studio</div>
    <h1>Connect ${safeClient}</h1>
    <p>Enter your <strong>VOCALIS_API_TOKEN</strong> access passcode to grant this AI connector permission to generate voices.</p>
    ${errorBlock}
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="request_id" value="${safeId}" />
      <label for="passcode">Connector Passcode (VOCALIS_API_TOKEN)</label>
      <input id="passcode" name="passcode" type="password" required autocomplete="current-password" placeholder="Enter your VOCALIS_API_TOKEN" />
      <button type="submit">Authorize & Connect</button>
    </form>
  </div>
</body>
</html>`;
}

function applyOAuthPublicCors(res: express.Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version');
}

app.options(
  ['/.well-known/*', '/oauth/register', '/oauth/token'],
  (_req, res) => {
    applyOAuthPublicCors(res);
    res.status(204).end();
  }
);

app.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/*'], (req, res) => {
  applyOAuthPublicCors(res);
  if (!process.env.VOCALIS_API_TOKEN?.trim()) {
    return res.status(404).json({ error: 'OAuth is not enabled because VOCALIS_API_TOKEN is unset.' });
  }
  const baseUrl = getPublicBaseUrl(req);
  res.json({
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header'],
    scopes_supported: ['mcp:tools'],
  });
});

app.get(['/.well-known/oauth-authorization-server', '/.well-known/openid-configuration'], (req, res) => {
  applyOAuthPublicCors(res);
  if (!process.env.VOCALIS_API_TOKEN?.trim()) {
    return res.status(404).json({ error: 'OAuth is not enabled because VOCALIS_API_TOKEN is unset.' });
  }
  const baseUrl = getPublicBaseUrl(req);
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp:tools'],
  });
});

const consumedOAuthJtis = new Map<string, number>();

function resolveOAuthClient(secret: string, clientId: string): OAuthClientRecord | null {
  const cached = oauthClients.get(clientId);
  if (cached) return cached;
  if (clientId.startsWith('v1_')) {
    const claims = verifyOAuthPayload(secret, clientId.slice(3));
    if (
      claims &&
      claims.typ === 'cli' &&
      Array.isArray(claims.ru) &&
      claims.ru.every(isValidOAuthRedirectUri)
    ) {
      return {
        clientId,
        clientName: typeof claims.nm === 'string' ? claims.nm : 'Claude Connector',
        redirectUris: claims.ru,
        createdAt: Date.now(),
      };
    }
  }
  return null;
}

app.post('/oauth/register', (req, res) => {
  applyOAuthPublicCors(res);
  const configuredToken = process.env.VOCALIS_API_TOKEN?.trim();
  if (!configuredToken) {
    return res.status(404).json({ error: 'OAuth registration is disabled when VOCALIS_API_TOKEN is unset.' });
  }
  const { redirect_uris, client_name } = req.body || {};
  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0 || redirect_uris.length > 10) {
    return res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris must be a non-empty array.' });
  }
  if (!redirect_uris.every(isValidOAuthRedirectUri)) {
    return res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'Only HTTPS or localhost redirect URIs are allowed.' });
  }

  const safeName = typeof client_name === 'string' && client_name.trim() ? client_name.trim().slice(0, 80) : 'Claude Connector';
  const issuedAt = Math.floor(Date.now() / 1000);
  const clientId = `v1_${signOAuthPayload(configuredToken, {
    typ: 'cli',
    nm: safeName,
    ru: redirect_uris,
    iat: issuedAt,
  })}`;

  setBoundedMap(oauthClients, clientId, {
    clientId,
    clientName: safeName,
    redirectUris: redirect_uris,
    createdAt: Date.now(),
  });

  res.status(201).json({
    client_id: clientId,
    client_id_issued_at: issuedAt,
    client_name: safeName,
    redirect_uris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  });
});

app.get('/oauth/authorize', (req, res) => {
  const configuredToken = process.env.VOCALIS_API_TOKEN?.trim();
  if (!configuredToken) {
    return res.status(404).send('OAuth is not active on this server.');
  }
  const clientId = String(req.query.client_id || '');
  const redirectUri = String(req.query.redirect_uri || '');
  const responseType = String(req.query.response_type || '');
  const codeChallenge = String(req.query.code_challenge || '');
  const codeChallengeMethod = String(req.query.code_challenge_method || 'S256');
  const state = String(req.query.state || '');
  const scope = String(req.query.scope || 'mcp:tools');

  const client = resolveOAuthClient(configuredToken, clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return res.status(400).send('Invalid client_id or redirect_uri. Please remove and re-add the connector in Claude.');
  }
  if (responseType !== 'code' || codeChallengeMethod !== 'S256' || !codeChallenge || codeChallenge.length > 256) {
    return res.status(400).send('Invalid OAuth request parameters (PKCE S256 required).');
  }

  const requestToken = signOAuthPayload(configuredToken, {
    typ: 'req',
    cid: client.clientId,
    cn: client.clientName,
    ru: redirectUri,
    st: state,
    cc: codeChallenge,
    sc: scope,
    jti: crypto.randomUUID(),
    exp: Date.now() + 15 * 60 * 1000,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
  res.send(renderOAuthAuthorizePage({ requestId: requestToken, clientName: client.clientName }));
});

app.post('/oauth/authorize', (req, res) => {
  const configuredToken = process.env.VOCALIS_API_TOKEN?.trim();
  if (!configuredToken) {
    return res.status(404).send('OAuth is not active on this server.');
  }
  const requestId = String(req.body?.request_id || '');
  const passcode = String(req.body?.passcode || '').trim();

  let cid = '';
  let clientName = 'Claude Connector';
  let redirectUri = '';
  let state = '';
  let codeChallenge = '';
  let scope = 'mcp:tools';
  let jti = '';

  const signedReq = verifyOAuthPayload(configuredToken, requestId);
  if (signedReq && signedReq.typ === 'req' && isValidOAuthRedirectUri(signedReq.ru)) {
    jti = String(signedReq.jti || '');
    if (jti && consumedOAuthJtis.has(jti)) {
      return res.status(400).send('Authorization session already used. Please retry connecting from Claude.');
    }
    cid = String(signedReq.cid || '');
    clientName = String(signedReq.cn || 'Claude Connector');
    redirectUri = signedReq.ru;
    state = String(signedReq.st || '');
    codeChallenge = String(signedReq.cc || '');
    scope = String(signedReq.sc || 'mcp:tools');
  } else {
    const pending = pendingOAuthRequests.get(requestId);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingOAuthRequests.delete(requestId);
      return res.status(400).send('Authorization session expired. Please retry connecting from Claude.');
    }
    cid = pending.clientId;
    clientName = pending.clientName;
    redirectUri = pending.redirectUri;
    state = pending.state;
    codeChallenge = pending.codeChallenge;
    scope = pending.scope;
  }

  if (!passcode || !timingSafeTextEqual(passcode, configuredToken)) {
    const attemptKey = jti || requestId.slice(0, 64);
    const prevAttempts = consumedOAuthJtis.get(`att:${attemptKey}`) || 0;
    const nextAttempts = prevAttempts + 1;
    setBoundedMap(consumedOAuthJtis, `att:${attemptKey}`, nextAttempts, 500);
    if (nextAttempts >= 5) {
      if (jti) setBoundedMap(consumedOAuthJtis, jti, Date.now(), 500);
      pendingOAuthRequests.delete(requestId);
      return res.status(429).send('Too many invalid passcode attempts. Please restart connection from Claude.');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
    return res.status(401).send(
      renderOAuthAuthorizePage({
        requestId,
        clientName,
        errorText: 'Invalid VOCALIS_API_TOKEN passcode. Please check your Secret and try again.',
      })
    );
  }

  if (jti) {
    setBoundedMap(consumedOAuthJtis, jti, Date.now(), 500);
    consumedOAuthJtis.delete(`att:${jti}`);
  }
  pendingOAuthRequests.delete(requestId);

  const code = signOAuthPayload(configuredToken, {
    typ: 'code',
    cid,
    ru: redirectUri,
    cc: codeChallenge,
    sc: scope,
    jti: crypto.randomUUID(),
    exp: Date.now() + 5 * 60 * 1000,
  });

  const redirectTarget = new URL(redirectUri);
  redirectTarget.searchParams.set('code', code);
  if (state) {
    redirectTarget.searchParams.set('state', state);
  }
  return res.redirect(302, redirectTarget.toString());
});

app.post('/oauth/token', (req, res) => {
  applyOAuthPublicCors(res);
  res.setHeader('Cache-Control', 'no-store');
  const configuredToken = process.env.VOCALIS_API_TOKEN?.trim();
  if (!configuredToken) {
    return res.status(404).json({ error: 'unsupported_grant_type' });
  }

  const bodyParams = req.body || {};
  let { grant_type, code, redirect_uri, client_id, code_verifier, refresh_token } = bodyParams;

  if (!client_id && typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(req.headers.authorization.slice(6).trim(), 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      client_id = colonIdx >= 0 ? decodeURIComponent(decoded.slice(0, colonIdx)) : decodeURIComponent(decoded);
    } catch {
      // ignore malformed Basic header
    }
  }

  if (grant_type === 'authorization_code') {
    let authRecord: OAuthCodeRecord | undefined;
    if (typeof code === 'string') {
      const signedCode = verifyOAuthPayload(configuredToken, code);
      if (signedCode && signedCode.typ === 'code') {
        const codeJti = String(signedCode.jti || '');
        if (codeJti && consumedOAuthJtis.has(codeJti)) {
          return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code already used.' });
        }
        if (codeJti) {
          setBoundedMap(consumedOAuthJtis, codeJti, Date.now(), 500);
        }
        authRecord = {
          clientId: String(signedCode.cid || ''),
          redirectUri: String(signedCode.ru || ''),
          codeChallenge: String(signedCode.cc || ''),
          scope: String(signedCode.sc || 'mcp:tools'),
          expiresAt: Number(signedCode.exp || 0),
        };
      } else {
        authRecord = oauthAuthCodes.get(code);
        oauthAuthCodes.delete(code);
      }
    }

    if (!authRecord || authRecord.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code is invalid or expired.' });
    }
    if (client_id !== authRecord.clientId || redirect_uri !== authRecord.redirectUri) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id or redirect_uri mismatch.' });
    }
    if (typeof code_verifier !== 'string' || !code_verifier) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier is required.' });
    }

    const computedChallenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');
    if (!timingSafeTextEqual(computedChallenge, authRecord.codeChallenge)) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid PKCE code_verifier.' });
    }

    const accessExpiresIn = 7 * 24 * 60 * 60;
    const accessToken = signOAuthPayload(configuredToken, {
      typ: 'access',
      cid: authRecord.clientId,
      scope: authRecord.scope,
      exp: Date.now() + accessExpiresIn * 1000,
    });
    const newRefreshToken = signOAuthPayload(configuredToken, {
      typ: 'refresh',
      cid: authRecord.clientId,
      scope: authRecord.scope,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    setBoundedMap(oauthAccessTokens, sha256Hex(accessToken), {
      clientId: authRecord.clientId,
      scope: authRecord.scope,
      expiresAt: Date.now() + accessExpiresIn * 1000,
    }, 500);

    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: accessExpiresIn,
      refresh_token: newRefreshToken,
      scope: authRecord.scope,
    });
  }

  if (grant_type === 'refresh_token') {
    if (typeof refresh_token !== 'string' || !refresh_token) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const signedRefresh = verifyOAuthPayload(configuredToken, refresh_token);
    if (!signedRefresh || signedRefresh.typ !== 'refresh') {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token is invalid or expired.' });
    }
    if (client_id && client_id !== signedRefresh.cid) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    const accessExpiresIn = 7 * 24 * 60 * 60;
    const scope = typeof signedRefresh.scope === 'string' ? signedRefresh.scope : 'mcp:tools';
    const accessToken = signOAuthPayload(configuredToken, {
      typ: 'access',
      cid: signedRefresh.cid,
      scope,
      exp: Date.now() + accessExpiresIn * 1000,
    });
    const rotatedRefresh = signOAuthPayload(configuredToken, {
      typ: 'refresh',
      cid: signedRefresh.cid,
      scope,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: accessExpiresIn,
      refresh_token: rotatedRefresh,
      scope,
    });
  }

  return res.status(400).json({ error: 'unsupported_grant_type' });
});

// Ensure any other /.well-known/* discovery probes return JSON 404 instead of SPA HTML
app.use('/.well-known', (req, res) => {
  applySafeAgentCors(req, res);
  res.status(404).json({ error: 'No OAuth or well-known metadata configured at this endpoint.' });
});

// Configure Vite middleware in dev or static files in prod
async function startServer() {
  let viteMiddlewares: any = null;
  let viteReadyPromise: Promise<void> | null = null;

  if (!isProd) {
    viteReadyPromise = (async () => {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      viteMiddlewares = vite.middlewares;
    })();

    app.use(async (req, res, next) => {
      if (!viteMiddlewares && viteReadyPromise) {
        await viteReadyPromise;
      }
      if (viteMiddlewares) {
        return viteMiddlewares(req, res, next);
      }
      next();
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });

  if (viteReadyPromise) {
    await viteReadyPromise;
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
