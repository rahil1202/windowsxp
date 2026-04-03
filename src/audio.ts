import type { AssetManifest, SoundId } from "./types";

type LoopHandle = {
  stop: () => void;
};

type SampleLibrary = Partial<Record<SoundId, AudioBuffer[]>>;

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private loops = new Map<SoundId, LoopHandle>();
  private readonly htmlTemplates = new Map<SoundId, HTMLAudioElement>();
  private muted = false;
  private readonly disabled =
    typeof navigator !== "undefined" &&
    (Boolean(navigator.webdriver) || /Headless/i.test(navigator.userAgent));
  private samples: SampleLibrary = {};
  private buffersReady = false;

  constructor(private readonly manifest: AssetManifest) {}

  async unlock(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) {
      return false;
    }
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    this.buildBuffers();
    return ctx.state === "running";
  }

  setMuted(value: boolean): void {
    this.muted = value;
    if (this.masterGain) {
      this.masterGain.gain.value = value ? 0 : 0.28;
    }
    if (value) {
      this.stopAllLoops();
    }
  }

  getMuted(): boolean {
    return this.muted;
  }

  preload(): void {
    this.ensureContext();
    this.buildBuffers();
    this.preloadHtmlAudio();
  }

  play(soundId: SoundId): void {
    if (this.muted) {
      return;
    }
    if (this.playHtmlSound(soundId)) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) {
      return;
    }
    this.buildBuffers();

    const variants = this.samples[soundId];
    if (!variants || variants.length === 0) {
      return;
    }

    const buffer = variants[Math.floor(Math.random() * variants.length)];
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.playbackRateFor(soundId);

    const gain = ctx.createGain();
    gain.gain.value = this.oneShotGain(soundId);

    if (soundId === "glass-hit" || soundId === "ricochet") {
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = soundId === "glass-hit" ? 420 : 680;
      source.connect(filter);
      filter.connect(gain);
    } else if (soundId === "impact-low") {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 720;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    gain.connect(this.masterGain);
    source.start();
    source.stop(ctx.currentTime + buffer.duration + 0.02);
  }

  startLoop(soundId: SoundId): void {
    if (this.muted || this.loops.has(soundId)) {
      return;
    }
    if (this.startHtmlLoop(soundId)) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) {
      return;
    }
    this.buildBuffers();

    const variants = this.samples[soundId];
    if (!variants || variants.length === 0) {
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = variants[0];
    source.loop = true;
    source.playbackRate.value = soundId === "chainsaw-loop" ? 1.03 : 1;

    const gain = ctx.createGain();
    gain.gain.value =
      soundId === "chainsaw-loop" ? 0.18 : soundId === "laser-loop" ? 0.12 : 0.16;

    if (soundId === "flame-loop") {
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 260;
      const wobble = ctx.createOscillator();
      const wobbleGain = ctx.createGain();
      wobble.type = "sine";
      wobble.frequency.value = 2.8;
      wobbleGain.gain.value = 0.05;
      wobble.connect(wobbleGain);
      wobbleGain.connect(gain.gain);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      wobble.start();
      source.start();
      this.loops.set(soundId, {
        stop: () => {
          source.stop();
          wobble.stop();
          gain.disconnect();
        }
      });
      return;
    }

    if (soundId === "chainsaw-loop") {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 920;
      filter.Q.value = 0.8;
      const tremolo = ctx.createOscillator();
      const tremoloGain = ctx.createGain();
      tremolo.type = "triangle";
      tremolo.frequency.value = 12;
      tremoloGain.gain.value = 0.04;
      tremolo.connect(tremoloGain);
      tremoloGain.connect(gain.gain);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      tremolo.start();
      source.start();
      this.loops.set(soundId, {
        stop: () => {
          source.stop();
          tremolo.stop();
          gain.disconnect();
        }
      });
      return;
    }

    if (soundId === "laser-loop") {
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 860;
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = "sawtooth";
      shimmer.frequency.value = 18;
      shimmerGain.gain.value = 0.025;
      shimmer.connect(shimmerGain);
      shimmerGain.connect(gain.gain);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      shimmer.start();
      source.start();
      this.loops.set(soundId, {
        stop: () => {
          source.stop();
          shimmer.stop();
          gain.disconnect();
        }
      });
    }
  }

  stopLoop(soundId: SoundId): void {
    const handle = this.loops.get(soundId);
    if (!handle) {
      return;
    }
    handle.stop();
    this.loops.delete(soundId);
  }

  stopAllLoops(): void {
    for (const soundId of [...this.loops.keys()]) {
      this.stopLoop(soundId);
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.disabled) {
      return null;
    }
    if (typeof window === "undefined") {
      return null;
    }
    const AudioCtor =
      window.AudioContext ??
      // @ts-expect-error Older webkit-prefixed Safari.
      window.webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }
    if (!this.context) {
      this.context = new AudioCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.28;
      this.masterGain.connect(this.context.destination);
    }
    return this.context;
  }

  private preloadHtmlAudio(): void {
    if (typeof Audio === "undefined") {
      return;
    }
    for (const [soundId, entry] of Object.entries(this.manifest.sounds) as Array<
      [SoundId, AssetManifest["sounds"][SoundId]]
    >) {
      if (!entry.src || this.htmlTemplates.has(soundId)) {
        continue;
      }
      const audio = new Audio(entry.src);
      audio.preload = "auto";
      this.htmlTemplates.set(soundId, audio);
      try {
        audio.load();
      } catch {
        // Ignore preload failures and attempt playback lazily later.
      }
    }
  }

  private playHtmlSound(soundId: SoundId): boolean {
    const template = this.htmlTemplates.get(soundId);
    if (!template) {
      return false;
    }
    const instance = template.cloneNode(true) as HTMLAudioElement;
    instance.volume = Math.min(1, this.oneShotGain(soundId));
    instance.playbackRate = this.playbackRateFor(soundId);
    void instance.play().catch(() => undefined);
    return true;
  }

  private startHtmlLoop(soundId: SoundId): boolean {
    const template = this.htmlTemplates.get(soundId);
    if (!template) {
      return false;
    }
    const instance = template.cloneNode(true) as HTMLAudioElement;
    instance.loop = true;
    instance.currentTime = 0;
    instance.playbackRate = soundId === "chainsaw-loop" ? 1.03 : 1;
    instance.volume =
      soundId === "chainsaw-loop" ? 0.18 : soundId === "laser-loop" ? 0.12 : 0.16;
    void instance.play().catch(() => undefined);
    this.loops.set(soundId, {
      stop: () => {
        instance.pause();
        instance.currentTime = 0;
      }
    });
    return true;
  }

  private buildBuffers(): void {
    if (this.buffersReady || !this.context) {
      return;
    }

    this.samples["glass-hit"] = [this.makeGlassHit(), this.makeGlassHit(0.88)];
    this.samples["impact-low"] = [this.makeImpact(), this.makeImpact(0.94)];
    this.samples["machine-gun"] = [this.makeMachineGun(), this.makeMachineGun(1.06)];
    this.samples.ricochet = [this.makeRicochet(), this.makeRicochet(0.92)];
    this.samples.spark = [this.makeSpark(), this.makeSpark(1.08)];
    this.samples.termite = [this.makeTermiteTick(), this.makeTermiteTick(1.14)];
    this.samples["flame-loop"] = [this.makeFlameLoop()];
    this.samples["chainsaw-loop"] = [this.makeChainsawLoop()];
    this.samples["paint-spray"] = [this.makePaintSpray(), this.makePaintSpray(1.08)];
    this.samples["phaser-shot"] = [this.makePhaserShot(), this.makePhaserShot(1.05)];
    this.samples["laser-loop"] = [this.makeLaserLoop()];
    this.samples["stamp-hit"] = [this.makeStampHit(), this.makeStampHit(0.96)];
    this.samples["xp-startup"] = [];
    this.buffersReady = true;
  }

  private makeGlassHit(pitch = 1): AudioBuffer {
    return this.createBuffer(0.38, (data, rate) => {
      let lp = 0;
      let hp = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const envelope = Math.exp(-10 * t);
        const noise = this.randSigned();
        lp += (noise - lp) * 0.08;
        hp = noise - lp;
        const ringA = Math.sin(2 * Math.PI * 1680 * pitch * t);
        const ringB = Math.sin(2 * Math.PI * 2480 * pitch * t + 0.4);
        const ringC = Math.sin(2 * Math.PI * 3220 * pitch * t + 0.9);
        data[i] =
          hp * envelope * 0.34 +
          ringA * Math.exp(-14 * t) * 0.16 +
          ringB * Math.exp(-17 * t) * 0.12 +
          ringC * Math.exp(-19 * t) * 0.08;
      }
    });
  }

  private makeImpact(pitch = 1): AudioBuffer {
    return this.createBuffer(0.42, (data, rate) => {
      let low = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const noise = this.randSigned();
        low += (noise - low) * 0.03;
        const body = Math.sin(2 * Math.PI * 62 * pitch * t) * Math.exp(-8 * t);
        const click = low * Math.exp(-16 * t) * 0.55;
        data[i] = body * 0.8 + click * 0.26;
      }
    });
  }

  private makeMachineGun(pitch = 1): AudioBuffer {
    return this.createBuffer(0.45, (data, rate) => {
      let lp = 0;
      let mid = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const n = this.randSigned();
        lp += (n - lp) * 0.05;
        mid += (n - mid) * 0.18;
        const crack = (n - mid) * Math.exp(-30 * t) * 0.85;
        const snap = Math.sin(2 * Math.PI * 980 * pitch * t) * Math.exp(-28 * t) * 0.2;
        const thump = Math.sin(2 * Math.PI * 78 * pitch * t) * Math.exp(-9 * t) * 0.42;
        const tail = lp * Math.exp(-7 * t) * 0.18;
        data[i] = crack + snap + thump + tail;
      }
    });
  }

  private makePaintSpray(pitch = 1): AudioBuffer {
    return this.createBuffer(0.22, (data, rate) => {
      let band = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const noise = this.randSigned();
        band += (noise - band) * 0.28;
        const hiss = (noise - band) * Math.exp(-10 * t) * 0.22;
        const pop = Math.sin(2 * Math.PI * 340 * pitch * t) * Math.exp(-14 * t) * 0.08;
        data[i] = hiss + pop;
      }
    });
  }

  private makePhaserShot(pitch = 1): AudioBuffer {
    return this.createBuffer(0.34, (data, rate) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const sweep = 320 + 780 * (1 - Math.exp(-6 * t));
        const body = Math.sin(2 * Math.PI * sweep * pitch * t) * Math.exp(-4 * t) * 0.24;
        const shimmer =
          Math.sin(2 * Math.PI * 1680 * pitch * t + 0.2) * Math.exp(-12 * t) * 0.18;
        data[i] = body + shimmer;
      }
    });
  }

  private makeStampHit(pitch = 1): AudioBuffer {
    return this.createBuffer(0.28, (data, rate) => {
      let low = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const noise = this.randSigned();
        low += (noise - low) * 0.04;
        const thunk = Math.sin(2 * Math.PI * 76 * pitch * t) * Math.exp(-11 * t) * 0.72;
        const slap = low * Math.exp(-24 * t) * 0.22;
        data[i] = thunk + slap;
      }
    });
  }

  private makeRicochet(pitch = 1): AudioBuffer {
    return this.createBuffer(0.33, (data, rate) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const sweep = 2200 * pitch + 1400 * Math.sin(t * 22);
        const tone =
          Math.sin(2 * Math.PI * sweep * t) * Math.exp(-10 * t) * 0.24 +
          Math.sin(2 * Math.PI * 3200 * pitch * t + 0.5) * Math.exp(-18 * t) * 0.12;
        const grit = this.randSigned() * Math.exp(-22 * t) * 0.08;
        data[i] = tone + grit;
      }
    });
  }

  private makeSpark(pitch = 1): AudioBuffer {
    return this.createBuffer(0.12, (data, rate) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const envelope = Math.exp(-26 * t);
        const tone =
          Math.sin(2 * Math.PI * 2600 * pitch * t) +
          Math.sin(2 * Math.PI * 3800 * pitch * t + 0.6) * 0.5;
        data[i] = tone * envelope * 0.18 + this.randSigned() * envelope * 0.06;
      }
    });
  }

  private makeTermiteTick(pitch = 1): AudioBuffer {
    return this.createBuffer(0.13, (data, rate) => {
      let lp = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const noise = this.randSigned();
        lp += (noise - lp) * 0.24;
        const scratch = (noise - lp) * Math.exp(-24 * t) * 0.24;
        const click = Math.sin(2 * Math.PI * 480 * pitch * t) * Math.exp(-18 * t) * 0.08;
        data[i] = scratch + click;
      }
    });
  }

  private makeFlameLoop(): AudioBuffer {
    return this.createLoopBuffer(1.1, (data, rate) => {
      let low = 0;
      let band = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const n = this.randSigned();
        low += (n - low) * 0.03;
        band += (n - band) * 0.16;
        const roar = (band - low) * 0.28;
        const body = low * 0.22;
        const flutter = Math.sin(2 * Math.PI * 7 * t) * 0.05;
        data[i] = roar + body + flutter;
      }
    });
  }

  private makeChainsawLoop(): AudioBuffer {
    return this.createLoopBuffer(0.92, (data, rate) => {
      let lp = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const noise = this.randSigned();
        lp += (noise - lp) * 0.05;
        const fundamental = Math.sin(2 * Math.PI * 94 * t);
        const harmonicA = Math.sin(2 * Math.PI * 188 * t + 0.4) * 0.45;
        const harmonicB = Math.sin(2 * Math.PI * 376 * t + 0.6) * 0.18;
        const engine = Math.tanh((fundamental + harmonicA + harmonicB) * 1.8) * 0.34;
        const grit = (noise - lp) * 0.2;
        const wobble = Math.sin(2 * Math.PI * 11 * t) * 0.05;
        data[i] = engine + grit + wobble;
      }
    });
  }

  private makeLaserLoop(): AudioBuffer {
    return this.createLoopBuffer(0.78, (data, rate) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const whine =
          Math.sin(2 * Math.PI * 880 * t) * 0.12 +
          Math.sin(2 * Math.PI * 1320 * t + 0.6) * 0.08;
        const modulation = Math.sin(2 * Math.PI * 5.5 * t) * 0.05;
        const staticEdge = this.randSigned() * 0.02;
        data[i] = whine + modulation + staticEdge;
      }
    });
  }

  private createBuffer(
    duration: number,
    render: (data: Float32Array, sampleRate: number) => void
  ): AudioBuffer {
    const context = this.context!;
    const sampleRate = context.sampleRate;
    const length = Math.max(1, Math.floor(duration * sampleRate));
    const buffer = context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    render(data, sampleRate);
    this.normalize(data, 0.95);
    return buffer;
  }

  private createLoopBuffer(
    duration: number,
    render: (data: Float32Array, sampleRate: number) => void
  ): AudioBuffer {
    const buffer = this.createBuffer(duration, render);
    const data = buffer.getChannelData(0);
    const fadeSamples = Math.floor(buffer.sampleRate * 0.03);
    for (let i = 0; i < fadeSamples; i++) {
      const fade = i / Math.max(1, fadeSamples);
      data[i] *= fade;
      data[data.length - 1 - i] *= fade;
    }
    return buffer;
  }

  private normalize(data: Float32Array, ceiling: number): void {
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
    if (peak < 1e-4) {
      return;
    }
    const scale = ceiling / peak;
    for (let i = 0; i < data.length; i++) {
      data[i] *= scale;
    }
  }

  private oneShotGain(soundId: SoundId): number {
    switch (soundId) {
      case "glass-hit":
        return 0.95;
      case "impact-low":
        return 0.8;
      case "machine-gun":
        return 1;
      case "ricochet":
        return 0.7;
      case "spark":
        return 0.55;
      case "termite":
        return 0.42;
      case "paint-spray":
        return 0.46;
        case "phaser-shot":
          return 0.62;
        case "stamp-hit":
          return 0.78;
        case "xp-startup":
          return 0.9;
        default:
          return 0.7;
      }
  }

  private playbackRateFor(soundId: SoundId): number {
    switch (soundId) {
      case "termite":
        return this.random(0.92, 1.18);
      case "machine-gun":
        return this.random(0.94, 1.08);
        case "paint-spray":
        case "phaser-shot":
        case "stamp-hit":
          return this.random(0.96, 1.08);
        case "xp-startup":
          return 1;
        default:
          return this.random(0.97, 1.04);
      }
  }

  private randSigned(): number {
    return Math.random() * 2 - 1;
  }

  private random(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
