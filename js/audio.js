// ============================================================
// AUDIO SYSTEM - Synthesized sounds (no external files needed)
// ============================================================

class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.masterVolume = 0.3;
        this.engineOsc = null;
        this.engineGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.ctx.destination);

            // Engine sound: low-frequency oscillator
            this.engineOsc = this.ctx.createOscillator();
            this.engineGain = this.ctx.createGain();
            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.value = 60;
            this.engineGain.gain.value = 0;
            this.engineOsc.connect(this.engineGain);
            this.engineGain.connect(this.masterGain);
            this.engineOsc.start();

            this.initialized = true;
        } catch (e) {
            this.enabled = false;
        }
    }

    updateEngine(speed, maxSpeed) {
        if (!this.initialized || !this.enabled) return;
        const normalizedSpeed = Math.abs(speed) / maxSpeed;
        // Frequency ramps from 50 Hz (idle) to 180 Hz (max)
        const freq = 50 + normalizedSpeed * 130;
        const vol = 0.02 + normalizedSpeed * 0.12;
        this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
        this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    }

    playPickup() {
        this._playTone([440, 550, 660], 0.08, 'sine', 0.15);
    }

    playDropoff() {
        this._playTone([660, 550, 440, 550, 660, 880], 0.07, 'sine', 0.12);
    }

    playMoney() {
        this._playTone([800, 1000, 1200], 0.06, 'sine', 0.1);
    }

    playHorn() {
        this._playTone([350, 440], 0.2, 'square', 0.08);
    }

    playDamage() {
        this._playNoise(0.15, 0.2);
    }

    playFine() {
        this._playTone([600, 400, 300], 0.12, 'square', 0.1);
    }

    playRefuel() {
        this._playTone([300, 350, 400, 450, 500], 0.06, 'sine', 0.08);
    }

    playEvent() {
        this._playTone([523, 659, 784, 1047], 0.1, 'sine', 0.1);
    }

    _playTone(freqs, noteDuration, type, volume) {
        if (!this.initialized || !this.enabled) return;
        const now = this.ctx.currentTime;
        freqs.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume, now + i * noteDuration);
            gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * noteDuration);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + i * noteDuration);
            osc.stop(now + (i + 1) * noteDuration + 0.05);
        });
    }

    _playNoise(duration, volume) {
        if (!this.initialized || !this.enabled) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(this.masterGain);
        source.start();
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled && this.engineGain) {
            this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
}
