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
    }

    follow(targetX, targetY) {
        const destX = targetX - this.width / 2;
        const destY = targetY - this.height / 2;
        this.x += (destX - this.x) * this.smoothing;
        this.y += (destY - this.y) * this.smoothing;

        // Clamp to map bounds
        this.x = clamp(this.x, 0, MAP_WIDTH - this.width);
        this.y = clamp(this.y, 0, MAP_HEIGHT - this.height);
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
