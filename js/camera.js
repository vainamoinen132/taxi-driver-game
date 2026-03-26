// ============================================================
// CAMERA - follows the player taxi
// ============================================================

class Camera {
    constructor(canvasWidth, canvasHeight) {
        this.x = 0;
        this.y = 0;
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.smoothing = 0.08;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
    }

    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    follow(targetX, targetY, dt) {
        const destX = targetX - this.width / 2;
        const destY = targetY - this.height / 2;
        this.x += (destX - this.x) * this.smoothing;
        this.y += (destY - this.y) * this.smoothing;

        // Clamp to map bounds
        this.x = clamp(this.x, 0, MAP_WIDTH - this.width);
        this.y = clamp(this.y, 0, MAP_HEIGHT - this.height);

        // Apply screen shake
        if (this.shakeTimer > 0 && dt) {
            this.shakeTimer -= dt;
            const decay = this.shakeTimer > 0 ? this.shakeTimer / 0.5 : 0;
            this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
            this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
            this.x += this.shakeOffsetX;
            this.y += this.shakeOffsetY;
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
        }
    }

    snapTo(targetX, targetY) {
        this.x = targetX - this.width / 2;
        this.y = targetY - this.height / 2;
        this.x = clamp(this.x, 0, MAP_WIDTH - this.width);
        this.y = clamp(this.y, 0, MAP_HEIGHT - this.height);
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
    }

    // Check if a world-space rect is visible
    isVisible(x, y, w, h) {
        return x + w > this.x && x < this.x + this.width &&
               y + h > this.y && y < this.y + this.height;
    }

    // Convert world coords to screen coords
    worldToScreen(wx, wy) {
        return { x: wx - this.x, y: wy - this.y };
    }
}
