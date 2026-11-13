import { SUPPORTED_LANGUAGES, type LanguageCode } from '../types.ts';
import { synthesizeSpeech } from '../services/geminiApi.ts';

export function getLocaleForLanguage(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.locale || 'en-IN';
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function createSpeechRecognition(language: LanguageCode): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = getLocaleForLanguage(language);
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let activeAudioEl: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activePlaybackToken = 0;
const ttsCache = new Map<string, { audioBase64: string; mimeType: string }>();

// Warm up voices list in browsers where getVoices() populates asynchronously
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}

export function stopSpeaking(): void {
  activePlaybackToken += 1;
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore cancel errors
    }
  }
  if (activeAudioEl) {
    activeAudioEl.pause();
    activeAudioEl.currentTime = 0;
    activeAudioEl = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function playViaGeminiTts(
  text: string,
  language: LanguageCode,
  token: number,
  callbacks: {
    onLoading?: (loading: boolean) => void;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  const cacheKey = `${language}::${text}`;
  try {
    callbacks.onLoading?.(true);
    let cached = ttsCache.get(cacheKey);
    if (!cached) {
      cached = await synthesizeSpeech({ text, language });
      if (ttsCache.size > 25) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, cached);
    }

    if (token !== activePlaybackToken) return;

    const blob = base64ToBlob(cached.audioBase64, cached.mimeType || 'audio/wav');
    const url = URL.createObjectURL(blob);
    activeAudioUrl = url;

    const audio = new Audio(url);
    activeAudioEl = audio;

    audio.onended = () => {
      if (token === activePlaybackToken) {
        stopSpeaking();
        callbacks.onEnd?.();
      }
    };
    audio.onerror = () => {
      if (token === activePlaybackToken) {
        stopSpeaking();
        callbacks.onError?.('Unable to play generated audio clip.');
        callbacks.onEnd?.();
      }
    };

    callbacks.onLoading?.(false);
    callbacks.onStart?.();
    await audio.play();
  } catch (err) {
    if (token === activePlaybackToken) {
      stopSpeaking();
      callbacks.onLoading?.(false);
      callbacks.onError?.(
        err instanceof Error ? err.message : 'Unable to generate audio playback.'
      );
      callbacks.onEnd?.();
    }
  }
}

export function speakText(
  text: string,
  language: LanguageCode,
  callbacks: {
    onLoading?: (loading: boolean) => void;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (message: string) => void;
  }
): void {
  const cleanText = text.trim();
  if (!cleanText) {
    callbacks.onEnd?.();
    return;
  }

  stopSpeaking();
  const token = activePlaybackToken;
  const locale = getLocaleForLanguage(language);
  const langPrefix = locale.split('-')[0].toLowerCase();

  // Check if browser SpeechSynthesis actually has a usable matching voice
  const voices = isSpeechSynthesisSupported() ? window.speechSynthesis.getVoices() : [];
  const matchedVoice =
    voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));

  // If SpeechSynthesis is unsupported, has no voices, or lacks the regional voice, use Gemini TTS directly
  if (!isSpeechSynthesisSupported() || voices.length === 0 || !matchedVoice) {
    void playViaGeminiTts(cleanText, language, token, callbacks);
    return;
  }

  // Try browser SpeechSynthesis with a 750ms watchdog in case Chrome stalls silently
  let started = false;
  let settled = false;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = locale;
  utterance.voice = matchedVoice;
  utterance.rate = 0.96;

  const watchdog = window.setTimeout(() => {
    if (!started && !settled && token === activePlaybackToken) {
      settled = true;
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
      void playViaGeminiTts(cleanText, language, token, callbacks);
    }
  }, 750);

  utterance.onstart = () => {
    if (token !== activePlaybackToken || settled) return;
    started = true;
    window.clearTimeout(watchdog);
    callbacks.onStart?.();
  };

  utterance.onend = () => {
    window.clearTimeout(watchdog);
    if (!settled && token === activePlaybackToken) {
      settled = true;
      callbacks.onEnd?.();
    }
  };

  utterance.onerror = () => {
    window.clearTimeout(watchdog);
    if (!started && !settled && token === activePlaybackToken) {
      settled = true;
      void playViaGeminiTts(cleanText, language, token, callbacks);
    } else if (!settled && token === activePlaybackToken) {
      settled = true;
      callbacks.onEnd?.();
    }
  };

  try {
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  } catch {
    window.clearTimeout(watchdog);
    settled = true;
    void playViaGeminiTts(cleanText, language, token, callbacks);
  }
}
