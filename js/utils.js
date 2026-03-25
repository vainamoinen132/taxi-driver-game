// ============================================================
// UTILITY FUNCTIONS
// ============================================================

// Seeded random number generator (mulberry32)
class SeededRandom {
    constructor(seed) {
        this.state = seed;
    }
    next() {
        this.state |= 0;
        this.state = this.state + 0x6D2B79F5 | 0;
        let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    rand(min, max) { return this.next() * (max - min) + min; }
    randInt(min, max) { return Math.floor(this.rand(min, max + 1)); }
    randChoice(arr) { return arr[Math.floor(this.next() * arr.length)]; }
}

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
}

function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function tileToPixel(col, row) {
    return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}

function pixelToTile(x, y) {
    return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
}

function isRoadTile(tile) {
    return tile === TILE.ROAD_H || tile === TILE.ROAD_V || tile === TILE.ROAD_CROSS || tile === TILE.HIGHWAY || tile === TILE.PARKING;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
}

function formatMoney(amount) {
    return '$' + Math.floor(amount).toLocaleString();
}

function formatTime(totalMinutes) {
    let hours = Math.floor(totalMinutes / 60) % 24;
    let mins = Math.floor(totalMinutes % 60);
    let ampm = hours >= 12 ? 'PM' : 'AM';
    let h = hours % 12;
    if (h === 0) h = 12;
    return h + ':' + (mins < 10 ? '0' : '') + mins + ' ' + ampm;
}

// Simple AABB collision
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Point in rect
function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// Weighted random choice
function weightedChoice(items, weights) {
    let total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}
