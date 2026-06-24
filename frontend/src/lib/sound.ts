// 효과음 엔진 — Web Audio API 합성(무에셋). 학습 게임용 마림바/벨/글래스 톤.
// 귀엽고 청량하면서 난잡하지 않게: 짧은 어택 + 매끄러운 지수 감쇠, 펜타토닉/메이저, 낮은 게인.
// 모든 재생은 사용자 탭/클릭에서 트리거되므로 브라우저 자동재생 정책에 걸리지 않는다.
// 켜짐/꺼짐은 soundStore(zustand)가 관리 — 이 파일은 "이름→합성"만 담당(순수).

export type SoundName =
  | "flip" // 플래시카드 뒤집기 — 가벼운 휘릭
  | "tap" // 타일 선택 — 말랑한 팝
  | "correct" // 정답 — 밝게 상승하는 2음
  | "wrong" // 오답 — 부드럽게 하강(귀엽게)
  | "match" // 짝 맞춤 — 반짝이는 상승 3음
  | "complete" // 라운드 완료 — 경쾌한 아르페지오
  | "celebrate"; // 만점 — 완료 + 반짝임 레이어

// 펜타토닉/메이저 음정(Hz) — 통일감 있는 맑은 톤
const N = {
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  D6: 1174.66,
  E6: 1318.51,
  G6: 1567.98,
  A6: 1760.0,
  C7: 2093.0,
} as const;

// --- 오디오 그래프 (지연 생성, 1회만) ---
let ctx: AudioContext | null = null;
let bus: GainNode | null = null; // 보이스 합류점
let comp: DynamicsCompressorNode | null = null; // 부드러운 리미팅(클리핑 방지 + 프로덕션 느낌)

type Ctor = typeof AudioContext;

function ensure(): { ctx: AudioContext; bus: GainNode } | null {
  if (typeof window === "undefined") return null;
  const AC: Ctor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!AC) return null;

  if (!ctx) {
    ctx = new AC();
    bus = ctx.createGain();
    bus.gain.value = 0.9;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    bus.connect(comp);
    comp.connect(ctx.destination);
  }
  // 일부 브라우저는 첫 제스처까지 suspended — 재생 시마다 깨운다
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return { ctx, bus: bus! };
}

// --- 합성 프리미티브 ---

interface VoiceOpts {
  freq: number;
  type?: OscillatorType;
  start?: number; // now 기준 오프셋(초)
  dur: number;
  peak?: number; // 게인 피크
  attack?: number;
  glideTo?: number; // 피치 스윕 목표
  filterHz?: number; // 라운딩용 로우패스
  pan?: number; // -1..1, 살짝만
}

// 단일 오실레이터 + 지수 ADSR(클릭 방지). 짧고 또렷하게.
function voice(c: AudioContext, dest: AudioNode, o: VoiceOpts) {
  const t0 = c.currentTime + (o.start ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + o.dur);

  const g = c.createGain();
  const peak = o.peak ?? 0.4;
  const attack = o.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

  osc.connect(g);
  let out: AudioNode = g;

  if (o.filterHz) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.filterHz;
    out.connect(f);
    out = f;
  }
  if (o.pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = o.pan;
    out.connect(p);
    out = p;
  }
  out.connect(dest);

  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

// 마림바/벨 핑 — 기본음 + 옥타브/배음 레이어로 글래스 느낌. 빠른 감쇠.
interface PingOpts {
  freq: number;
  start?: number;
  dur?: number;
  peak?: number;
  pan?: number;
}

function ping(c: AudioContext, dest: AudioNode, o: PingOpts) {
  const dur = o.dur ?? 0.24;
  const peak = o.peak ?? 0.15;
  const start = o.start ?? 0;
  // 기본음(둥근 사인)
  voice(c, dest, {
    freq: o.freq,
    type: "sine",
    start,
    dur,
    peak,
    attack: 0.004,
    pan: o.pan,
  });
  // 옥타브 배음 — 밝기 추가, 더 짧게
  voice(c, dest, {
    freq: o.freq * 2,
    type: "sine",
    start,
    dur: dur * 0.6,
    peak: peak * 0.4,
    attack: 0.003,
    pan: o.pan,
  });
  // 12도 배음 — 살짝 반짝임(아주 짧고 약하게)
  voice(c, dest, {
    freq: o.freq * 3,
    type: "triangle",
    start,
    dur: dur * 0.35,
    peak: peak * 0.12,
    attack: 0.002,
    pan: o.pan,
  });
}

// 감쇠 노이즈 → 밴드패스 스윕 = 가벼운 "휘릭"(종이/카드 넘김)
function whoosh(
  c: AudioContext,
  dest: AudioNode,
  o: { start?: number; dur: number; peak: number; from: number; to: number }
) {
  const t0 = c.currentTime + (o.start ?? 0);
  const len = Math.max(1, Math.floor(c.sampleRate * o.dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len); // 끝으로 갈수록 감쇠
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(o.from, t0);
  bp.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  bp.Q.value = 0.9;

  const g = c.createGain();
  g.gain.setValueAtTime(o.peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

  src.connect(bp);
  bp.connect(g);
  g.connect(dest);
  src.start(t0);
  src.stop(t0 + o.dur + 0.02);
}

// --- 사운드 레시피 ---
const RECIPES: Record<SoundName, (c: AudioContext, d: AudioNode) => void> = {
  // 가벼운 휘릭 + 톡 — 카드 넘김
  flip: (c, d) => {
    whoosh(c, d, { dur: 0.13, peak: 0.05, from: 1100, to: 2700 });
    voice(c, d, {
      freq: N.A5,
      type: "triangle",
      dur: 0.09,
      peak: 0.07,
      attack: 0.004,
      glideTo: N.D6,
      filterHz: 3600,
    });
  },

  // 말랑한 버블 팝 — 타일 선택
  tap: (c, d) => {
    voice(c, d, {
      freq: N.A5,
      type: "sine",
      dur: 0.1,
      peak: 0.13,
      attack: 0.004,
      glideTo: N.D6,
      filterHz: 3800,
    });
  },

  // 정답 — 밝게 상승(G5→C6) + 반짝임(G6)
  correct: (c, d) => {
    ping(c, d, { freq: N.G5, start: 0, dur: 0.22, peak: 0.16 });
    ping(c, d, { freq: N.C6, start: 0.07, dur: 0.26, peak: 0.16 });
    ping(c, d, { freq: N.G6, start: 0.14, dur: 0.18, peak: 0.055, pan: 0.12 });
  },

  // 오답 — 부드럽게 하강(D5→A4). 로우패스로 둥글게, 혼나는 느낌 X
  wrong: (c, d) => {
    voice(c, d, {
      freq: N.D5,
      type: "triangle",
      start: 0,
      dur: 0.17,
      peak: 0.13,
      attack: 0.006,
      filterHz: 1500,
    });
    voice(c, d, {
      freq: 440.0, // A4
      type: "triangle",
      start: 0.1,
      dur: 0.22,
      peak: 0.12,
      attack: 0.006,
      filterHz: 1300,
    });
  },

  // 짝 맞춤 — 반짝이는 상승 펜타토닉(C6→E6→G6) + 윗 반짝임
  match: (c, d) => {
    ping(c, d, { freq: N.C6, start: 0, dur: 0.2, peak: 0.13 });
    ping(c, d, { freq: N.E6, start: 0.06, dur: 0.2, peak: 0.13 });
    ping(c, d, { freq: N.G6, start: 0.12, dur: 0.26, peak: 0.14, pan: 0.1 });
    ping(c, d, { freq: N.C7, start: 0.17, dur: 0.16, peak: 0.05, pan: -0.12 });
  },

  // 완료 — 경쾌한 4음 아르페지오(C5 E5 G5 C6) + 마무리 반짝임
  complete: (c, d) => {
    const seq = [N.C5, N.E5, N.G5, N.C6];
    seq.forEach((f, i) =>
      ping(c, d, {
        freq: f,
        start: i * 0.09,
        dur: i === seq.length - 1 ? 0.4 : 0.28,
        peak: 0.15,
      })
    );
    ping(c, d, { freq: N.G6, start: 0.36, dur: 0.22, peak: 0.06, pan: 0.12 });
  },

  // 만점 — 5음 상승 + 마무리 트라이어드 반짝임
  celebrate: (c, d) => {
    const seq = [N.C5, N.E5, N.G5, N.C6, N.E6];
    seq.forEach((f, i) =>
      ping(c, d, {
        freq: f,
        start: i * 0.08,
        dur: 0.3,
        peak: 0.15,
        pan: i % 2 ? 0.1 : -0.1,
      })
    );
    // 마무리 반짝이는 트라이어드(C6+E6+G6)
    [N.C6, N.E6, N.G6].forEach((f, i) =>
      ping(c, d, { freq: f, start: 0.46, dur: 0.5, peak: 0.07, pan: (i - 1) * 0.18 })
    );
    voice(c, d, { freq: N.C7, type: "sine", start: 0.5, dur: 0.4, peak: 0.04, attack: 0.004 });
  },
};

// 같은 사운드가 너무 촘촘히 겹쳐 난잡해지는 것 방지(연타 가드)
const lastPlayed: Partial<Record<SoundName, number>> = {};
const MIN_GAP_MS = 45;

/** 효과음 재생 — soundStore가 켜진 경우에만 호출할 것(useSound가 게이트). */
export function playSound(name: SoundName) {
  const audio = ensure();
  if (!audio) return;
  const now = audio.ctx.currentTime * 1000;
  const prev = lastPlayed[name] ?? -Infinity;
  if (now - prev < MIN_GAP_MS) return;
  lastPlayed[name] = now;
  try {
    RECIPES[name](audio.ctx, audio.bus);
  } catch {
    // 합성 실패는 조용히 무시 — 효과음은 부가 기능
  }
}
