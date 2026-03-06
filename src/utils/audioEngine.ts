/**
 * Procedural Audio Engine for Daily Driver
 * 
 * Uses the Web Audio API to synthesize mechanical sounds in real-time.
 * No audio files needed — all sounds are generated procedurally.
 */

class AudioEngine {
      private ctx: AudioContext | null = null;
      private muted = false;

      /** Initialize AudioContext — must be called from a user gesture */
      init(): void {
            if (!this.ctx) {
                  this.ctx = new AudioContext();
            }
            // Browser autoplay policy: context starts suspended, must resume on user gesture
            if (this.ctx.state === 'suspended') {
                  this.ctx.resume();
            }
      }

      /** Set muted state */
      setMuted(muted: boolean): void {
            this.muted = muted;
      }

      /** Get muted state */
      getMuted(): boolean {
            return this.muted;
      }

      /** Ensure context is ready before playing */
      private ensureContext(): AudioContext | null {
            if (!this.ctx || this.muted) return null;
            if (this.ctx.state === 'suspended') {
                  this.ctx.resume();
            }
            return this.ctx;
      }

      /**
       * Wheel Tick — short mechanical click
       * Triggered when the outer or inner wheel snaps to a new item.
       * A 4ms burst of filtered noise.
       */
      tickClick(): void {
            const ctx = this.ensureContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            // 1. Transient (The "Tick" part) - High-mid burst for the shell impact
            const transientDuration = 0.005;
            const bufferSize = Math.ceil(ctx.sampleRate * transientDuration);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                  data[i] = (Math.random() * 2 - 1);
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const transientFilter = ctx.createBiquadFilter();
            transientFilter.type = 'bandpass';
            transientFilter.frequency.value = 1800;
            transientFilter.Q.value = 2; // Resonance for that plastic snap
            const transientGain = ctx.createGain();
            transientGain.gain.setValueAtTime(0.4, now);
            transientGain.gain.exponentialRampToValueAtTime(0.001, now + transientDuration);

            // 2. The "Thock" (Lower resonant body of the mechanical click)
            const thockOsc = ctx.createOscillator();
            thockOsc.type = 'sine';
            thockOsc.frequency.setValueAtTime(220, now); // Deep resonant thock
            thockOsc.frequency.exponentialRampToValueAtTime(150, now + 0.035);
            const thockGain = ctx.createGain();
            thockGain.gain.setValueAtTime(0.7, now);
            thockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

            // 3. Subtle sub-component for extra weight
            const subOsc = ctx.createOscillator();
            subOsc.type = 'triangle'; // Triangle for a bit more mechanical texture than sine
            subOsc.frequency.setValueAtTime(110, now);
            const subGain = ctx.createGain();
            subGain.gain.setValueAtTime(0.3, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

            // Connections
            source.connect(transientFilter);
            transientFilter.connect(transientGain);
            transientGain.connect(ctx.destination);

            thockOsc.connect(thockGain);
            thockGain.connect(ctx.destination);

            subOsc.connect(subGain);
            subGain.connect(ctx.destination);

            // Start & Stop
            source.start(now);
            thockOsc.start(now);
            subOsc.start(now);

            source.stop(now + 0.05);
            thockOsc.stop(now + 0.05);
            subOsc.stop(now + 0.05);
      }

      /**
       * Button Thud — heavy, satisfying press
       * Triggered on the bottom action button click.
       * An 90Hz sine wave with 80ms decay + click transient.
       */
      buttonThud(): void {
            const ctx = this.ensureContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(90, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

            const clickOsc = ctx.createOscillator();
            clickOsc.type = 'square';
            clickOsc.frequency.value = 800;
            const clickGain = ctx.createGain();
            clickGain.gain.setValueAtTime(0.15, now);
            clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

            osc.connect(gain);
            gain.connect(ctx.destination);
            clickOsc.connect(clickGain);
            clickGain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.15);
            clickOsc.start(now);
            clickOsc.stop(now + 0.02);
      }

      /**
       * Task Complete Snap — crisp mechanical snap
       * Triggered when a task checkbox is toggled.
       * High-frequency triangle wave with 2ms attack, 50ms release.
       */
      taskSnap(): void {
            const ctx = this.ensureContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1600, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 0.03);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.4, now + 0.002);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.06);
      }

      /**
       * Printer Buzz — receipt printing sound
       * Triggered when the receipt animation starts.
       * Oscillating square wave for ~1.5s.
       */
      printerBuzz(): void {
            const ctx = this.ensureContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            const duration = 1.5;

            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, now);

            for (let t = 0; t < duration; t += 0.08) {
                  osc.frequency.setValueAtTime(300, now + t);
                  osc.frequency.setValueAtTime(200, now + t + 0.04);
            }

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.setValueAtTime(0.1, now + duration - 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + duration);
      }
}

/** Singleton audio engine instance */
export const audioEngine = new AudioEngine();
