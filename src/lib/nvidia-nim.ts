declare const process: any;
const NVIDIA_API_KEY = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_NVIDIA_NIM_API_KEY : process.env.VITE_NVIDIA_NIM_API_KEY;
const GROQ_API_KEY = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_GROQ_API_KEY : process.env.VITE_GROQ_API_KEY;

const NVIDIA_BASE_URL = '/api/nvidia';
const DEFAULT_MODEL = 'meta/llama-3.1-8b-instruct';

const CACHE_PREFIX = 'nv-cache-cc-';
const CACHE_TTL = 1000 * 60 * 60;

function cacheKey(prompt: string, model: string): string {
  const hash = btoa(encodeURIComponent(prompt)).slice(0, 64);
  return `${CACHE_PREFIX}${model}:${hash}`;
}

function getCache(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(key: string, data: string): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + CACHE_TTL }));
  } catch {}
}

export interface PuterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

async function nvidiaChat(messages: PuterMessage[], model: string): Promise<string> {
  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 4096 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA NIM error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function chat(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  _options?: { temperature?: number; maxTokens?: string }
): Promise<string> {
  const fullPrompt = systemPrompt + '|||' + messages.map(m => `${m.role}:${m.content}`).join('|||');
  const key = cacheKey(fullPrompt, DEFAULT_MODEL);
  const cached = getCache(key);
  if (cached) return cached;

  const puterMessages: PuterMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  const text = await nvidiaChat(puterMessages, DEFAULT_MODEL);
  setCache(key, text);
  return text;
}

export async function chatJSON<T>(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: string }
): Promise<T> {
  const result = await chat(
    systemPrompt + '\n\nYou MUST respond with valid JSON only. No markdown, no explanation, just raw JSON.',
    [{ role: 'user', content: userMessage }],
    options
  );
  try {
    return JSON.parse(result);
  } catch {
    const match = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`NVIDIA returned invalid JSON: ${result}`);
  }
}

// Groq Orpheus TTS integration with Browser SpeechSynthesis Fallback
const ttsCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

export async function speak(text: string): Promise<any | null> {
  const isMuted = localStorage.getItem('cold-case-ai-muted') === 'true';
  if (isMuted) return null;

  stopSpeaking();

  if (GROQ_API_KEY) {
    try {
      let audioUrl = ttsCache.get(text);
      if (!audioUrl) {
        const res = await fetch('/api/groq/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'canopylabs/orpheus-v1-english',
            input: text,
            voice: 'diana',
            response_format: 'wav',
          }),
        });

        if (!res.ok) {
          throw new Error(`Groq TTS error status ${res.status}`);
        }

        const blob = await res.blob();
        audioUrl = URL.createObjectURL(blob);
        ttsCache.set(text, audioUrl);
      }

      const audio = new Audio(audioUrl);
      currentAudio = audio;
      audio.play().catch(e => console.warn('Failed to play audio:', e));
      return audio;
    } catch (err) {
      console.warn('Groq TTS request failed, falling back to window.speechSynthesis:', err);
    }
  }

  // Fallback to local browser speech synthesis
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    return utterance;
  }

  return null;
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// Local storage case synchronization helpers
export async function saveCaseToCloud(caseId: string, caseData: any): Promise<boolean> {
  try {
    localStorage.setItem(`case_${caseId}`, JSON.stringify(caseData));
    return true;
  } catch {
    return false;
  }
}

export async function loadCaseFromCloud(caseId: string): Promise<any | null> {
  try {
    const data = localStorage.getItem(`case_${caseId}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function listCasesFromCloud(): Promise<string[]> {
  try {
    const cases: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('case_')) {
        cases.push(key.replace('case_', ''));
      }
    }
    return cases;
  } catch {
    return [];
  }
}
