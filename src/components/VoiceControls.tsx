import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Square, Volume2 } from 'lucide-react';
import type { LanguageCode } from '../types.ts';
import { transcribeAudio } from '../services/geminiApi.ts';
import {
  createSpeechRecognition,
  getLocaleForLanguage,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
  type SpeechRecognitionLike,
} from '../utils/speech.ts';

interface VoiceInputButtonProps {
  language: LanguageCode;
  onTranscript: (text: string) => void;
  label?: string;
}

// Remember across components in the same session if browser Web Speech API cloud endpoint is blocked
let sessionPreferAudioRecorder = false;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function VoiceInputButton({
  language,
  onTranscript,
  label = 'Speak',
}: VoiceInputButtonProps) {
  const [mode, setMode] = useState<'idle' | 'speech_api' | 'recording' | 'transcribing'>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startMediaRecorder = async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setMode('idle');
      setNotice('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stopStream();
        const actualMime = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
        const audioBlob = new Blob(chunksRef.current, { type: actualMime });
        chunksRef.current = [];

        if (audioBlob.size < 250) {
          setMode('idle');
          setNotice('Recording was too short. Tap Speak and talk clearly.');
          return;
        }

        setMode('transcribing');
        try {
          const audioBase64 = await blobToBase64(audioBlob);
          const { transcript } = await transcribeAudio({
            audioBase64,
            mimeType: actualMime,
            language,
          });
          if (transcript) {
            onTranscript(transcript);
            setNotice(null);
          } else {
            setNotice('Could not catch any words. Please try speaking closer to the mic.');
          }
        } catch (err) {
          setNotice(
            err instanceof Error ? err.message : 'Unable to transcribe recorded audio.'
          );
        } finally {
          setMode('idle');
        }
      };

      recorder.start();
      setMode('recording');
      setNotice(null);
    } catch (err) {
      stopStream();
      setMode('idle');
      const name = (err as { name?: string })?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setNotice(
          'Microphone permission is blocked. Allow mic access in your browser address bar and retry.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setNotice('No microphone detected on this device.');
      } else {
        setNotice('Unable to access microphone in this window.');
      }
    }
  };

  const handleToggle = async () => {
    setNotice(null);

    if (mode === 'speech_api') {
      recognitionRef.current?.stop();
      setMode('idle');
      return;
    }

    if (mode === 'recording') {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      } else {
        stopStream();
        setMode('idle');
      }
      return;
    }

    if (mode === 'transcribing') return;

    // Try Web Speech API first unless it previously failed with a network/service block
    const rec = !sessionPreferAudioRecorder ? createSpeechRecognition(language) : null;
    if (!rec) {
      await startMediaRecorder();
      return;
    }

    let gotResult = false;
    recognitionRef.current = rec;

    rec.onresult = (event) => {
      gotResult = true;
      const lastIdx = event.results.length - 1;
      const transcript = event.results[lastIdx]?.[0]?.transcript?.trim();
      if (transcript) {
        onTranscript(transcript);
      }
    };

    rec.onerror = async (event) => {
      if (event.error === 'aborted') {
        setMode('idle');
        return;
      }

      if (
        event.error === 'network' ||
        event.error === 'service-not-allowed' ||
        event.error === 'language-not-supported'
      ) {
        sessionPreferAudioRecorder = true;
        // Seamless fallback to MediaRecorder + Gemini audio transcription
        await startMediaRecorder();
        return;
      }

      setMode('idle');
      if (event.error === 'not-allowed') {
        setNotice(
          'Microphone permission is blocked. Allow mic access in your browser address bar and retry.'
        );
      } else if (event.error === 'audio-capture') {
        setNotice('No microphone detected. Check your audio input device.');
      } else if (event.error === 'no-speech') {
        setNotice('No speech heard — tap Speak and start talking right away.');
      } else {
        sessionPreferAudioRecorder = true;
        await startMediaRecorder();
      }
    };

    rec.onend = () => {
      // Only reset to idle if we didn't fall back into active recording
      setMode((curr) => (curr === 'speech_api' ? 'idle' : curr));
      if (!gotResult) {
        // Leave any error/fallback notice intact
      }
    };

    try {
      rec.start();
      setMode('speech_api');
    } catch {
      sessionPreferAudioRecorder = true;
      await startMediaRecorder();
    }
  };

  const isListening = mode === 'speech_api' || mode === 'recording';
  const isBusy = mode === 'transcribing';

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isBusy}
        title={`Voice input (${getLocaleForLanguage(language)})`}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60 ${
          isListening
            ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        {isBusy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Transcribing...</span>
          </>
        ) : isListening ? (
          <>
            <MicOff className="h-3.5 w-3.5" />
            <span>{mode === 'recording' ? 'Stop & Transcribe' : 'Stop Mic'}</span>
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5" />
            <span>{label}</span>
          </>
        )}
      </button>
      {notice && <span className="text-[11px] text-amber-700 text-right max-w-xs">{notice}</span>}
    </div>
  );
}

interface SpeakButtonProps {
  id: string;
  activeSpeakingId: string | null;
  onSpeakingChange: (id: string | null) => void;
  text: string;
  language: LanguageCode;
  label?: string;
}

export function SpeakButton({
  id,
  activeSpeakingId,
  onSpeakingChange,
  text,
  language,
  label = 'Listen',
}: SpeakButtonProps) {
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const isPlaying = activeSpeakingId === id;

  useEffect(() => {
    if (activeSpeakingId !== id) {
      setLoadingAudio(false);
    }
  }, [activeSpeakingId, id]);

  const handleToggle = () => {
    setAudioError(null);
    if (isPlaying || loadingAudio) {
      stopSpeaking();
      setLoadingAudio(false);
      onSpeakingChange(null);
      return;
    }

    onSpeakingChange(id);
    speakText(text, language, {
      onLoading: (loading) => setLoadingAudio(loading),
      onStart: () => {
        setLoadingAudio(false);
        onSpeakingChange(id);
      },
      onEnd: () => {
        setLoadingAudio(false);
        onSpeakingChange(null);
      },
      onError: (msg) => {
        setLoadingAudio(false);
        setAudioError(msg);
      },
    });
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={!text.trim()}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50 ${
          isPlaying || loadingAudio
            ? 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        {loadingAudio ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Preparing Audio...</span>
          </>
        ) : isPlaying ? (
          <>
            <Square className="h-3.5 w-3.5 fill-current" />
            <span>Stop Audio</span>
          </>
        ) : (
          <>
            <Volume2 className="h-3.5 w-3.5" />
            <span>{label}</span>
          </>
        )}
      </button>
      {audioError && <span className="text-[11px] text-amber-700">{audioError}</span>}
    </div>
  );
}
