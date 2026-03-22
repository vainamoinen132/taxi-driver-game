// ============================================================
// NPC TRAFFIC - Civilian cars driving around the city
// ============================================================

class NpcCar {
    constructor(x, y, city) {
        this.x = x;
        this.y = y;
        this.city = city;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = rand(40, 90);
        this.maxSpeed = this.speed;
        this.width = 36;
        this.height = 20;

        // Random car color
        this.color = randChoice([
            '#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400',
            '#2c3e50', '#16a085', '#7f8c8d', '#e74c3c', '#3498db',
            '#1abc9c', '#9b59b6', '#34495e', '#e67e22', '#95a5a6',
        ]);

        // Navigation
        this.targetX = x;
        this.targetY = y;
        this._pickNewTarget();

        // State
        this.stoppedTimer = 0;
        this.stuckTimer = 0;
        this.lastX = x;
        this.lastY = y;
    }

    _pickNewTarget() {
        const pos = this.city.getRandomRoadPosition();
        this.targetX = pos.x;
        this.targetY = pos.y;
    }

    update(dt, allCars, playerTaxi) {
        // Check if reached target
        const dTarget = dist(this.x, this.y, this.targetX, this.targetY);
        if (dTarget < TILE_SIZE * 2) {
            this._pickNewTarget();
        }

        // Steer toward target
        const desiredAngle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        let diff = desiredAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += clamp(diff, -2.0 * dt, 2.0 * dt);

        // Slow down for turns
        const turnAmount = Math.abs(diff);
        const turnSpeedFactor = turnAmount > 0.5 ? 0.5 : 1.0;

        // Collision avoidance with other cars and player
        let avoidance = 0;
        const lookAhead = this.speed * 0.4 + 30;

        // Check player taxi
        const pDist = dist(this.x, this.y, playerTaxi.x, playerTaxi.y);
        if (pDist < lookAhead + 20) {
            avoidance = Math.max(avoidance, 1.0 - pDist / (lookAhead + 20));
        }

        // Check other NPC cars
        for (const other of allCars) {
            if (other === this) continue;
            const oDist = dist(this.x, this.y, other.x, other.y);
            if (oDist < lookAhead) {
                avoidance = Math.max(avoidance, 1.0 - oDist / lookAhead);
            }
        }

        // Apply speed
        const targetSpeed = this.maxSpeed * turnSpeedFactor * (1.0 - avoidance * 0.8);
        this.speed += (targetSpeed - this.speed) * dt * 3;
        this.speed = clamp(this.speed, 0, this.maxSpeed);

        // Move
        const vx = Math.cos(this.angle) * this.speed * dt;
        const vy = Math.sin(this.angle) * this.speed * dt;
        const newX = this.x + vx;
        const newY = this.y + vy;

        // Collision check
        if (!this.city.isSolidAt(newX, newY) &&
            newX > 20 && newX < MAP_WIDTH - 20 &&
            newY > 20 && newY < MAP_HEIGHT - 20) {
            this.x = newX;
            this.y = newY;
        } else {
            this.angle += rand(-1, 1);
            this._pickNewTarget();
        }

        // Stuck detection
        const moved = dist(this.x, this.y, this.lastX, this.lastY);
        if (moved < 1) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 3) {
                // Teleport to a random road
                const pos = this.city.getRandomRoadPosition();
                this.x = pos.x;
                this.y = pos.y;
                this._pickNewTarget();
                this.stuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;
        }
        this.lastX = this.x;
        this.lastY = this.y;
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            w: this.width,
            h: this.height,
        };
    }
}

class TrafficManager {
    constructor(city) {
        this.city = city;
        this.cars = [];

        // Spawn initial NPC cars
        for (let i = 0; i < MAX_NPC_CARS; i++) {
            const pos = city.getRandomRoadPosition();
            this.cars.push(new NpcCar(pos.x, pos.y, city));
        }
    }

    update(dt, playerTaxi) {
        for (const car of this.cars) {
            car.update(dt, this.cars, playerTaxi);
        }
    }
}
