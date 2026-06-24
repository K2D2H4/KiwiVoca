// useTTS — Gemini TTS(백엔드 /api/tts) 기반 발음 재생.
// 단어/표현을 서버에서 고품질 음성(WAV)으로 합성해 재생한다.
// 네트워크/합성 실패 시 브라우저 내장 Web Speech API 로 자동 폴백(오프라인·resilience).
// speak(text, langCode): 덱 lang_term(en/ko/ru/ja 등)을 서버에 넘겨 해당 언어로 읽음.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

// 폴백(Web Speech)용: 덱 언어 코드 → BCP-47 로케일
const LANG_MAP: Record<string, string> = {
  en: "en-US",
  ko: "ko-KR",
  ru: "ru-RU",
  ja: "ja-JP",
  zh: "zh-CN",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
};

function toBcp47(langCode?: string): string {
  if (!langCode) return "en-US";
  const normalized = langCode.replace("_", "-").toLowerCase();
  const base = normalized.split("-")[0];
  if (normalized.includes("-")) {
    const [lang, region] = normalized.split("-");
    return `${lang}-${region.toUpperCase()}`;
  }
  return LANG_MAP[base] ?? "en-US";
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

// 모듈 전역: 합성 결과 blob URL 캐시 + 현재 재생 중 오디오(전역 1개만 재생).
// 모든 SpeakButton 인스턴스가 캐시를 공유해 같은 단어 재요청/재과금을 막는다.
const blobCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

// 진행 중 재생(서버 오디오 + 폴백 음성) 전부 중단
function stopAll(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  getSynth()?.cancel();
}

export function useTTS() {
  // 브라우저면 항상 시도 가능(서버 TTS, 실패 시 Web Speech 폴백)
  const supported = typeof window !== "undefined";

  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  // 같은 훅에서 새 speak 호출 시 이전(지연 도착) 콜백을 무효화하는 토큰
  const tokenRef = useRef(0);

  // 폴백용 voice 목록은 비동기로 채워질 수 있어 미리 로드/구독
  useEffect(() => {
    const synth = getSynth();
    if (!synth) return;
    const load = () => {
      voicesRef.current = synth.getVoices();
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
    };
  }, []);

  // 언마운트 시 토큰 무효화(언마운트 후 setState 방지)
  useEffect(() => {
    return () => {
      tokenRef.current++;
    };
  }, []);

  const pickVoice = useCallback((bcp47: string): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;
    if (!voices.length) return null;
    const lower = bcp47.toLowerCase();
    const baseLang = lower.split("-")[0];
    return (
      voices.find((v) => v.lang.toLowerCase() === lower) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(baseLang)) ??
      null
    );
  }, []);

  // 폴백 — 브라우저 내장 음성으로 읽기 (서버 TTS 실패 시)
  const fallbackSpeak = useCallback(
    (text: string, langCode?: string) => {
      const synth = getSynth();
      if (!synth) {
        setSpeaking(false);
        return;
      }
      synth.cancel();
      const bcp47 = toBcp47(langCode);
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = bcp47;
      const voice = pickVoice(bcp47);
      if (voice) utter.voice = voice;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      synth.speak(utter);
    },
    [pickVoice]
  );

  const speak = useCallback(
    async (text: string, langCode?: string) => {
      const clean = text?.trim();
      if (!clean) return;

      stopAll();
      const token = ++tokenRef.current;
      // 클릭 즉시 재생 표시(서버 합성 지연 동안 펄스 유지)
      setSpeaking(true);

      const key = `${langCode ?? ""}|${clean}`;
      try {
        let url = blobCache.get(key);
        if (!url) {
          const res = await api.get("/tts", {
            params: langCode ? { text: clean, lang: langCode } : { text: clean },
            responseType: "blob",
          });
          url = URL.createObjectURL(res.data as Blob);
          blobCache.set(key, url);
        }
        // 합성/요청 중 새 speak 가 들어왔으면 이 재생은 폐기
        if (token !== tokenRef.current) return;

        const audio = new Audio(url);
        currentAudio = audio;

        const finish = () => {
          if (currentAudio === audio) currentAudio = null;
          // 이 토큰이 최신일 때만 상태 내림(다른 버튼이 재생 중이면 건드리지 않음)
          if (token === tokenRef.current) setSpeaking(false);
        };
        audio.addEventListener("ended", finish);
        audio.addEventListener("pause", finish); // stopAll() 로 중단될 때
        audio.addEventListener("error", () => {
          if (currentAudio === audio && token === tokenRef.current) {
            fallbackSpeak(clean, langCode);
          }
        });

        try {
          await audio.play();
        } catch {
          // play() 거부 — 외부 중단(다른 버튼이 stopAll)인 경우는 무시,
          // 실제 재생 실패면 폴백
          if (currentAudio === audio && token === tokenRef.current) {
            fallbackSpeak(clean, langCode);
          }
        }
      } catch {
        // 네트워크/서버 합성 실패 → 브라우저 음성으로 폴백
        if (token === tokenRef.current) fallbackSpeak(clean, langCode);
      }
    },
    [fallbackSpeak]
  );

  return { speak, speaking, supported };
}
