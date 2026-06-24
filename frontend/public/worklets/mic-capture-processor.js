// 마이크 캡처 AudioWorklet — 입력 샘플레이트(보통 48kHz) → 16kHz 다운샘플 + Float32→PCM16(Int16 LE).
// 결과를 transferable ArrayBuffer로 메인 스레드에 post → useCall이 binary WS 전송.
// public 경로로 직접 로드(Vite 번들 미경유)되어야 안정적이라 여기 둔다.
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    // 리샘플 위상 누적(연속 청크 간 경계 보존)
    this._resamplePos = 0;
    this._muted = false;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === "mute") this._muted = !!e.data.value;
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;
    if (this._muted) return true;

    const inRate = sampleRate; // AudioWorkletGlobalScope 전역
    const ratio = inRate / this.targetRate;

    // 선형보간 다운샘플
    const outLength = Math.floor((channel.length - this._resamplePos) / ratio) + 1;
    if (outLength <= 0) return true;
    const out = new Int16Array(outLength);
    let count = 0;
    let pos = this._resamplePos;
    while (pos < channel.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const s0 = channel[i];
      const s1 = i + 1 < channel.length ? channel[i + 1] : s0;
      let sample = s0 + (s1 - s0) * frac;
      // 클램프 후 PCM16
      sample = Math.max(-1, Math.min(1, sample));
      out[count++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      pos += ratio;
    }
    // 다음 블록을 위한 위상 캐리(현재 블록 길이 기준으로 정규화)
    this._resamplePos = pos - channel.length;

    if (count > 0) {
      const buf = out.buffer.slice(0, count * 2);
      this.port.postMessage(buf, [buf]);
    }
    return true;
  }
}

registerProcessor("mic-capture-processor", MicCaptureProcessor);
