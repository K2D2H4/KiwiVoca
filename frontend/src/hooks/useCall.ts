// useCall — Gemini Live 가상 전화 오케스트레이션.
// WebSocket(ws/wss, origin 동적) + 마이크 캡처(16kHz PCM16) + TTS 재생(24kHz PCM16).
// 백엔드 WS 계약:
//   연결: ws(s)://<host>/api/call/ws?token=<access_jwt>&deck_id=<id>
//   클라→서버 오디오: PCM16 16kHz mono binary
//   서버→클라 오디오: PCM16 24kHz mono binary (받는 즉시 재생 큐)
//   제어(JSON 텍스트): ready{target_words} / turn_complete / error / (클라) end_turn / text
//   close: 4401 인증 / 4403 덱접근 / 4404 덱없음 / 4500 서버 / 1000 정상
import { useCallback, useEffect, useRef, useState } from "react";
import { ACCESS_TOKEN_KEY } from "../lib/api";

export type CallStatus =
  | "idle"
  | "connecting"
  | "connected" // WS open, ready 대기
  | "in_call" // ready 수신, 통화 중
  | "ended"
  | "error";

// 친화 한국어가 아닌 에러 "코드" — UI에서 i18n 키로 매핑
export type CallErrorCode =
  | "auth" // 4401 토큰 만료/무효 → 재로그인
  | "deck_forbidden" // 4403
  | "deck_not_found" // 4404
  | "server" // 4500
  | "mic_denied" // getUserMedia 거부
  | "mic_unavailable" // 장치 없음/미지원
  | "connection" // 연결 실패/비정상 종료
  | "unknown";

const MIC_SAMPLE_RATE = 16000; // 참고용(실제 다운샘플은 worklet)
const PLAYBACK_SAMPLE_RATE = 24000;

interface UseCallReturn {
  status: CallStatus;
  errorCode: CallErrorCode | null;
  targetWords: string[];
  muted: boolean;
  /** AI가 발화(재생) 중인지 — 말하는 모션/상태 텍스트용 */
  aiSpeaking: boolean;
  /** 마이크 입력 레벨 0~1 (음성 비주얼용) */
  micLevel: number;
  startCall: () => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  /** 사용자 발화 종료 신호 */
  endTurn: () => void;
  /** 선택: 텍스트 턴 전송 */
  sendText: (text: string) => void;
}

export function useCall(deckId: string | undefined): UseCallReturn {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorCode, setErrorCode] = useState<CallErrorCode | null>(null);
  const [targetWords, setTargetWords] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  // --- 자원 ref (재렌더 무관) ---
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0); // 끊김 없는 스케줄링 누적 시각
  const aiSpeakingTimerRef = useRef<number | null>(null);
  const mutedRef = useRef(false);
  const teardownRef = useRef<() => void>(() => {});

  // --- 정리 ---
  const teardown = useCallback(() => {
    if (aiSpeakingTimerRef.current) {
      clearTimeout(aiSpeakingTimerRef.current);
      aiSpeakingTimerRef.current = null;
    }
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close(1000, "client end");
        } catch {
          /* noop */
        }
      }
    }
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
      } catch {
        /* noop */
      }
      workletNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (captureCtxRef.current) {
      captureCtxRef.current.close().catch(() => {});
      captureCtxRef.current = null;
    }
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }
    nextPlayTimeRef.current = 0;
    setMicLevel(0);
    setAiSpeaking(false);
  }, []);

  // 최신 teardown을 ref로 보관(언마운트 클린업이 항상 최신 자원 정리)
  teardownRef.current = teardown;

  // --- 24kHz PCM16 재생: 받은 ArrayBuffer를 Int16→Float32 → AudioBuffer 큐잉 ---
  const enqueuePlayback = useCallback((buf: ArrayBuffer) => {
    const ctx = playbackCtxRef.current;
    if (!ctx || buf.byteLength === 0) return;
    const int16 = new Int16Array(buf);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;

    const audioBuffer = ctx.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32);

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);

    // 끊김 없는 스케줄: 다음 시작 시각 누적(지연 시 현재 시각으로 보정)
    const now = ctx.currentTime;
    const startAt = Math.max(now, nextPlayTimeRef.current);
    src.start(startAt);
    nextPlayTimeRef.current = startAt + audioBuffer.duration;

    // AI 말하는 중 표시 — 재생 끝나는 시점까지 유지
    setAiSpeaking(true);
    if (aiSpeakingTimerRef.current) clearTimeout(aiSpeakingTimerRef.current);
    const msUntilDone = (nextPlayTimeRef.current - now) * 1000 + 120;
    aiSpeakingTimerRef.current = window.setTimeout(() => {
      setAiSpeaking(false);
    }, msUntilDone);
  }, []);

  // --- 마이크 캡처 시작: getUserMedia → AudioWorklet(폴백 ScriptProcessor) ---
  const startCapture = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    mediaStreamRef.current = stream;

    // 캡처 컨텍스트(브라우저 기본 레이트, 보통 48kHz)
    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    captureCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const source = ctx.createMediaStreamSource(stream);

    // 입력 레벨 미터(가벼운 analyser)
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const levelData = new Uint8Array(analyser.frequencyBinCount);

    const sendChunk = (buf: ArrayBuffer) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && !mutedRef.current) {
        ws.send(buf);
      }
    };

    let usedWorklet = false;
    if (ctx.audioWorklet) {
      try {
        await ctx.audioWorklet.addModule("/worklets/mic-capture-processor.js");
        const node = new AudioWorkletNode(ctx, "mic-capture-processor");
        node.port.onmessage = (e) => sendChunk(e.data as ArrayBuffer);
        source.connect(node);
        // worklet은 destination 연결 불필요(출력 없음)하나 일부 브라우저 안정성 위해 무음 연결
        node.connect(ctx.destination);
        workletNodeRef.current = node;
        usedWorklet = true;
      } catch {
        usedWorklet = false;
      }
    }

    // 폴백: ScriptProcessor(메인 스레드 다운샘플 + PCM16)
    if (!usedWorklet) {
      const SP_SIZE = 4096;
      const processor = ctx.createScriptProcessor(SP_SIZE, 1, 1);
      const inRate = ctx.sampleRate;
      const ratio = inRate / MIC_SAMPLE_RATE;
      let resamplePos = 0;
      processor.onaudioprocess = (ev) => {
        if (mutedRef.current) return;
        const channel = ev.inputBuffer.getChannelData(0);
        const outLength = Math.floor((channel.length - resamplePos) / ratio) + 1;
        if (outLength <= 0) return;
        const out = new Int16Array(outLength);
        let count = 0;
        let pos = resamplePos;
        while (pos < channel.length) {
          const i = Math.floor(pos);
          const frac = pos - i;
          const s0 = channel[i];
          const s1 = i + 1 < channel.length ? channel[i + 1] : s0;
          let s = s0 + (s1 - s0) * frac;
          s = Math.max(-1, Math.min(1, s));
          out[count++] = s < 0 ? s * 0x8000 : s * 0x7fff;
          pos += ratio;
        }
        resamplePos = pos - channel.length;
        if (count > 0) sendChunk(out.buffer.slice(0, count * 2));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      // 폴백 노드는 disconnect 위해 workletNodeRef 자리에 보관(타입만 다름)
      workletNodeRef.current = processor as unknown as AudioWorkletNode;
    }

    // 레벨 미터 루프
    const tick = () => {
      if (!captureCtxRef.current) return;
      analyser.getByteTimeDomainData(levelData);
      let sum = 0;
      for (let i = 0; i < levelData.length; i++) {
        const v = (levelData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / levelData.length);
      setMicLevel(mutedRef.current ? 0 : Math.min(1, rms * 2.4));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  // --- 통화 시작 ---
  const startCall = useCallback(async () => {
    if (!deckId) {
      setErrorCode("deck_not_found");
      setStatus("error");
      return;
    }
    setErrorCode(null);
    setTargetWords([]);
    setStatus("connecting");

    // 1) 마이크 먼저 확보(권한 거부면 WS 열지 않음)
    try {
      // 재생 컨텍스트(24kHz) 준비 — 사용자 제스처 컨텍스트에서 생성/resume
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const playCtx = new AC({ sampleRate: PLAYBACK_SAMPLE_RATE });
      playbackCtxRef.current = playCtx;
      if (playCtx.state === "suspended") await playCtx.resume();
      nextPlayTimeRef.current = playCtx.currentTime;

      await startCapture();
    } catch (err) {
      teardown();
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setErrorCode("mic_denied");
      } else if (name === "NotFoundError" || name === "NotReadableError") {
        setErrorCode("mic_unavailable");
      } else {
        setErrorCode("mic_unavailable");
      }
      setStatus("error");
      return;
    }

    // 2) WebSocket 연결
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/api/call/ws?token=${encodeURIComponent(
      token
    )}&deck_id=${encodeURIComponent(deckId)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      teardown();
      setErrorCode("connection");
      setStatus("error");
      return;
    }
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (ev) => {
      // 바이너리 = 24kHz PCM16 TTS
      if (ev.data instanceof ArrayBuffer) {
        enqueuePlayback(ev.data);
        return;
      }
      // 텍스트 = 제어 JSON
      if (typeof ev.data === "string") {
        try {
          const msg = JSON.parse(ev.data) as {
            type?: string;
            target_words?: string[];
            message?: string;
          };
          if (msg.type === "ready") {
            setTargetWords(Array.isArray(msg.target_words) ? msg.target_words : []);
            setStatus("in_call");
          } else if (msg.type === "turn_complete") {
            // 모델 발화 1턴 끝 — 별도 처리 없음(재생 큐가 자연 종료)
          } else if (msg.type === "error") {
            setErrorCode("server");
            setStatus("error");
          }
        } catch {
          /* 비-JSON 텍스트 무시 */
        }
      }
    };

    ws.onerror = () => {
      // close에서 코드별 처리하므로 여기선 상태만 보강
      if (status !== "error") {
        setErrorCode((prev) => prev ?? "connection");
      }
    };

    ws.onclose = (ev) => {
      const code = ev.code;
      // 정상 종료(1000) 또는 사용자가 이미 종료
      if (code === 1000) {
        setStatus((s) => (s === "ended" ? s : "ended"));
        teardown();
        return;
      }
      // 코드별 에러 매핑
      let mapped: CallErrorCode = "connection";
      if (code === 4401) mapped = "auth";
      else if (code === 4403) mapped = "deck_forbidden";
      else if (code === 4404) mapped = "deck_not_found";
      else if (code === 4500) mapped = "server";
      setErrorCode(mapped);
      setStatus("error");
      teardown();
    };
  }, [deckId, startCapture, enqueuePlayback, teardown, status]);

  // --- 제어 헬퍼 ---
  const endTurn = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "end_turn" }));
    }
  }, []);

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && text.trim()) {
      ws.send(JSON.stringify({ type: "text", text }));
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      // worklet에도 mute 통지(트랙은 살려두되 청크 전송 중단)
      const node = workletNodeRef.current;
      if (node && "port" in node && node.port) {
        try {
          node.port.postMessage({ type: "mute", value: next });
        } catch {
          /* 폴백 노드(ScriptProcessor)는 port 없음 — mutedRef로 처리 */
        }
      }
      return next;
    });
  }, []);

  const endCall = useCallback(() => {
    setStatus("ended");
    teardown();
  }, [teardown]);

  // 언마운트 시 항상 정리
  useEffect(() => {
    return () => {
      teardownRef.current();
    };
  }, []);

  return {
    status,
    errorCode,
    targetWords,
    muted,
    aiSpeaking,
    micLevel,
    startCall,
    endCall,
    toggleMute,
    endTurn,
    sendText,
  };
}
