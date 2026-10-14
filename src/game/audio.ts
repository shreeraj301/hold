type Tone = OscillatorType;

export function createAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let music: GainNode | null = null;
  let muted = false;
  let bedOn = false;
  let voices = 0;
  let noiseBuf: AudioBuffer | null = null;
  const bedNodes: OscillatorNode[] = [];
  const bedGains: GainNode[] = [];
  const last = new Map<string, number>();

  function ensure() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    music = ctx.createGain();
    master.gain.value = 0.9;
    sfx.gain.value = 1;
    music.gain.value = 0.0001;
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    const audio = ensure();
    if (audio && audio.state === "suspended") void audio.resume();
  }

  function resume() {
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  function noise(audio: AudioContext) {
    if (noiseBuf && noiseBuf.sampleRate === audio.sampleRate) return noiseBuf;
    const len = Math.floor(audio.sampleRate * 0.4);
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      brown = brown * 0.98 + white * 0.02;
      data[i] = white * 0.55 + brown * 10;
    }
    noiseBuf = buf;
    return buf;
  }

  function setMuted(next: boolean) {
    muted = next;
    if (!ctx || !master || !music) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(next ? 0.0001 : 0.9, now, 0.02);
    if (!next && bedOn) ensureBed();
  }

  function voiceEnd(nodes: Array<{ disconnect: () => void }>) {
    voices = Math.max(0, voices - 1);
    for (const node of nodes) node.disconnect();
  }

  function blip(key: string, freq: number, dur: number, type: Tone, gain: number, slide?: number, gap = 0.045) {
    if (muted) return;
    const audio = ensure();
    if (!audio || !sfx) return;
    if (audio.state === "suspended") void audio.resume();
    if (audio.state === "closed") return;
    const now = audio.currentTime;
    const prev = last.get(key) ?? 0;
    if (now - prev < gap) return;
    if (voices > 18) return;
    last.set(key, now);
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    const rate = 1 + (Math.random() * 2 - 1) * 0.045;
    osc.frequency.setValueAtTime(freq * rate, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), now + dur);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(amp);
    amp.connect(sfx);
    voices += 1;
    osc.onended = () => voiceEnd([osc, amp]);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function grit(key: string, dur: number, gain: number, freq: number, gap = 0.04) {
    if (muted) return;
    const audio = ensure();
    if (!audio || !sfx) return;
    if (audio.state === "suspended") void audio.resume();
    if (audio.state === "closed") return;
    const now = audio.currentTime;
    const prev = last.get(key) ?? 0;
    if (now - prev < gap) return;
    if (voices > 18) return;
    last.set(key, now);
    const src = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const amp = audio.createGain();
    src.buffer = noise(audio);
    src.loop = true;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.value = 0.7;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(sfx);
    voices += 1;
    src.onended = () => voiceEnd([src, filter, amp]);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  function stopBed(audio: AudioContext) {
    const now = audio.currentTime;
    if (music) {
      music.gain.cancelScheduledValues(now);
      music.gain.setTargetAtTime(0.0001, now, 0.08);
    }
    const oscs = bedNodes.splice(0);
    const gains = bedGains.splice(0);
    for (const osc of oscs) {
      try {
        osc.stop(now + 0.4);
      } catch {
        /* already stopped */
      }
    }
    window.setTimeout(() => {
      for (const osc of oscs) osc.disconnect();
      for (const amp of gains) amp.disconnect();
    }, 480);
  }

  function ensureBed() {
    const audio = ensure();
    if (!audio || !music || bedNodes.length > 0) return;
    const voicesBed: Array<[number, OscillatorType, number]> = [
      [98, "sine", 0.5],
      [146.8, "triangle", 0.28],
      [196, "sine", 0.18],
    ];
    for (const [freq, type, level] of voicesBed) {
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.value = level;
      osc.connect(amp);
      amp.connect(music);
      osc.start();
      bedNodes.push(osc);
      bedGains.push(amp);
    }
    const now = audio.currentTime;
    music.gain.cancelScheduledValues(now);
    music.gain.setValueAtTime(0.0001, now);
    music.gain.setTargetAtTime(muted ? 0.0001 : 0.15, now, 0.6);
  }

  function bed(on: boolean) {
    bedOn = on;
    const audio = ensure();
    if (!audio || !music) return;
    if (!on) {
      stopBed(audio);
      return;
    }
    if (audio.state === "suspended") void audio.resume();
    ensureBed();
    const now = audio.currentTime;
    music.gain.setTargetAtTime(muted ? 0.0001 : 0.15, now, 0.45);
  }

  return {
    unlock,
    resume,
    setMuted,
    bed,
    stop() {
      bedOn = false;
      const oscs = bedNodes.splice(0);
      const gains = bedGains.splice(0);
      for (const osc of oscs) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
        osc.disconnect();
      }
      for (const amp of gains) amp.disconnect();
      if (ctx && ctx.state !== "closed") void ctx.close();
      ctx = null;
      master = null;
      sfx = null;
      music = null;
    },
    ui() {
      blip("ui", 880, 0.045, "sine", 0.035, 620, 0.02);
      grit("ui-n", 0.03, 0.02, 1800, 0.02);
    },
    place() {
      blip("place", 240, 0.1, "sine", 0.06, 120, 0.02);
      blip("place-h", 720, 0.06, "triangle", 0.03, 480, 0.02);
    },
    shot(kind: string) {
      if (kind === "needle") {
        blip("needle", 1760, 0.03, "square", 0.016, 980, 0.035);
        grit("needle-n", 0.02, 0.03, 3200, 0.03);
      } else if (kind === "lance") {
        blip("lance", 180, 0.16, "sine", 0.07, 62, 0.05);
        grit("lance-n", 0.08, 0.045, 420, 0.05);
      } else if (kind === "bloom") {
        blip("bloom", 120, 0.14, "triangle", 0.065, 48, 0.05);
        grit("bloom-n", 0.16, 0.06, 180, 0.05);
      } else {
        blip("drift", 520, 0.12, "sine", 0.028, 390, 0.06);
        blip("drift-h", 780, 0.14, "triangle", 0.02, 620, 0.06);
      }
    },
    explode() {
      blip("explode", 78, 0.24, "sine", 0.08, 36, 0.07);
      grit("explode-n", 0.2, 0.07, 140, 0.07);
    },
    kill(big: boolean) {
      if (big) {
        blip("core", 160, 0.32, "sine", 0.08, 48, 0.03);
        grit("core-n", 0.22, 0.06, 200, 0.04);
        return;
      }
      blip("kill", 920, 0.07, "sine", 0.04, 460, 0.028);
      grit("kill-n", 0.04, 0.025, 1400, 0.028);
    },
    leak() {
      blip("leak", 110, 0.3, "sine", 0.08, 42, 0.05);
      grit("leak-n", 0.18, 0.05, 160, 0.05);
    },
    wave() {
      blip("wave", 320, 0.1, "sine", 0.04, 480, 0.08);
      window.setTimeout(() => blip("wave2", 480, 0.14, "triangle", 0.035, 720, 0), 90);
    },
    win() {
      blip("win", 523, 0.14, "sine", 0.05, 660, 0);
      window.setTimeout(() => blip("win2", 784, 0.16, "sine", 0.05, 880, 0), 120);
      window.setTimeout(() => blip("win3", 1046, 0.22, "triangle", 0.04, 1240, 0), 240);
    },
    lose() {
      blip("lose", 220, 0.28, "sine", 0.06, 90, 0);
      grit("lose-n", 0.24, 0.04, 120, 0);
    },
    close() {
      blip("close", 392, 0.16, "sine", 0.045, 262, 0);
      window.setTimeout(() => blip("close2", 196, 0.28, "triangle", 0.04, 98, 0), 110);
    },
  };
}

export type AudioBus = ReturnType<typeof createAudio>;
