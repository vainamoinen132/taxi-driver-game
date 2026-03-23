// ============================================================
// WEATHER & DAY/NIGHT SYSTEM
// ============================================================

const WEATHER_TYPES = {
    CLEAR: 'clear',
    RAIN: 'rain',
    FOG: 'fog',
};

class WeatherSystem {
    constructor() {
        this.current = WEATHER_TYPES.CLEAR;
        this.nextChangeTimer = rand(120, 300); // seconds until next weather change
        this.intensity = 0;       // 0-1, ramps up/down
        this.targetIntensity = 0;
        this.rainDrops = [];
        this.gripMultiplier = 1.0;
        this.visibilityMultiplier = 1.0;
        this.demandMultiplier = 1.0;

        // Day/night
        this.dayProgress = 0;   // 0-1 through the day (set from gameTime)
        this.ambientLight = 1.0; // 0=pitch dark, 1=full day
        this.skyColor = '#87CEEB';

        // Precalc rain drops
        for (let i = 0; i < 200; i++) {
            this.rainDrops.push({
                x: Math.random() * 2000 - 500,
                y: Math.random() * 1500 - 500,
                speed: rand(400, 800),
                length: rand(8, 20),
            });
        }
    }

    update(dt, gameTime) {
        // Update day progress
        const hour = (gameTime / 60) % 24;
        this.dayProgress = hour / 24;
        this._updateAmbientLight(hour);

        // Weather timer
        this.nextChangeTimer -= dt;
        if (this.nextChangeTimer <= 0) {
            this._changeWeather();
            this.nextChangeTimer = rand(90, 240);
        }

        // Ramp intensity
        if (this.intensity < this.targetIntensity) {
            this.intensity = Math.min(this.intensity + dt * 0.15, this.targetIntensity);
        } else if (this.intensity > this.targetIntensity) {
            this.intensity = Math.max(this.intensity - dt * 0.1, this.targetIntensity);
        }

        // Calculate effects
        if (this.current === WEATHER_TYPES.RAIN) {
            this.gripMultiplier = 1.0 - this.intensity * 0.35;
            this.visibilityMultiplier = 1.0 - this.intensity * 0.2;
            this.demandMultiplier = 1.0 + this.intensity * 0.5;
        } else if (this.current === WEATHER_TYPES.FOG) {
            this.gripMultiplier = 1.0 - this.intensity * 0.1;
            this.visibilityMultiplier = 1.0 - this.intensity * 0.5;
            this.demandMultiplier = 1.0 + this.intensity * 0.3;
        } else {
            this.gripMultiplier = 1.0;
            this.visibilityMultiplier = 1.0;
            this.demandMultiplier = 1.0;
        }

        // Update rain positions
        if (this.current === WEATHER_TYPES.RAIN) {
            for (const drop of this.rainDrops) {
                drop.y += drop.speed * dt;
                if (drop.y > 1200) {
                    drop.y = -20;
                    drop.x = Math.random() * 2000 - 500;
                }
            }
        }
    }

    _updateAmbientLight(hour) {
        // Smooth light curve: dark at night, bright during day
        if (hour >= 6 && hour < 8) {
            // Dawn
            this.ambientLight = (hour - 6) / 2;
            this.skyColor = this._lerpColor('#1a1a3e', '#FFB347', (hour - 6) / 2);
        } else if (hour >= 8 && hour < 17) {
            // Day
            this.ambientLight = 1.0;
            this.skyColor = '#87CEEB';
        } else if (hour >= 17 && hour < 19) {
            // Dusk
            this.ambientLight = 1.0 - (hour - 17) / 2;
            this.skyColor = this._lerpColor('#87CEEB', '#FF6B6B', (hour - 17) / 2);
        } else if (hour >= 19 && hour < 21) {
            // Evening
            this.ambientLight = 0.3 - (hour - 19) / 2 * 0.15;
            this.skyColor = this._lerpColor('#FF6B6B', '#1a1a3e', (hour - 19) / 2);
        } else {
            // Night
            this.ambientLight = 0.15;
            this.skyColor = '#0a0a2e';
        }
    }

    _changeWeather() {
        const r = Math.random();
        if (r < 0.5) {
            this.current = WEATHER_TYPES.CLEAR;
            this.targetIntensity = 0;
        } else if (r < 0.8) {
            this.current = WEATHER_TYPES.RAIN;
            this.targetIntensity = rand(0.3, 1.0);
        } else {
            this.current = WEATHER_TYPES.FOG;
            this.targetIntensity = rand(0.3, 0.8);
        }
    }

    _lerpColor(c1, c2, t) {
        const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
        const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }

    isNight() {
        return this.ambientLight < 0.4;
    }

    isRushHour(gameTime) {
        const hour = (gameTime / 60) % 24;
        return (hour >= 7 && hour < 9) || (hour >= 17 && hour < 19);
    }

    isLateNight(gameTime) {
        const hour = (gameTime / 60) % 24;
        return hour >= 23 || hour < 4;
    }

    getFareMultiplier(gameTime) {
        if (this.isLateNight(gameTime)) return 2.0;
        if (this.isRushHour(gameTime)) return 1.5;
        return 1.0;
    }

    getWeatherIcon() {
        if (this.current === WEATHER_TYPES.RAIN) return '🌧️';
        if (this.current === WEATHER_TYPES.FOG) return '🌫️';
        if (this.isNight()) return '🌙';
        return '☀️';
    }

    getWeatherLabel() {
        if (this.current === WEATHER_TYPES.RAIN) return 'Rainy';
        if (this.current === WEATHER_TYPES.FOG) return 'Foggy';
        return 'Clear';
    }
}
