// ============================================================
// AI COMPETING TAXIS
// ============================================================

class AiTaxi {
    constructor(x, y, city) {
        this.x = x;
        this.y = y;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 0;
        this.maxSpeed = rand(100, 160);
        this.width = 40;
        this.height = 22;
        this.city = city;
        this.color = randChoice(['#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#e67e22']);

        // AI state
        this.state = 'roaming'; // roaming, chasing_passenger, carrying
        this.targetX = x;
        this.targetY = y;
        this.targetPassenger = null;
        this.carryTimer = 0;
        this.pathTimer = 0;
        this.stuckTimer = 0;
        this.lastX = x;
        this.lastY = y;
    }

    update(dt, passengers) {
        this.pathTimer -= dt;
        this.stuckTimer += dt;

        // Check if stuck
        if (this.stuckTimer > 2) {
            const moved = dist(this.x, this.y, this.lastX, this.lastY);
            if (moved < 10) {
                // Unstick: pick new target
                this._pickNewRoamTarget();
                this.angle += rand(-1, 1);
            }
            this.lastX = this.x;
            this.lastY = this.y;
            this.stuckTimer = 0;
        }

        switch (this.state) {
            case 'roaming':
                this._roam(dt, passengers);
                break;
            case 'chasing_passenger':
                this._chasePassenger(dt);
                break;
            case 'carrying':
                this._carry(dt);
                break;
        }

        // Move toward target
        this._moveToward(dt);
    }

    _roam(dt, passengers) {
        // Look for unclaimed passengers
        let nearestP = null;
        let nearestD = Infinity;
        for (const p of passengers) {
            if (p.pickedUp || p.claimed) continue;
            const d = dist(this.x, this.y, p.x, p.y);
            if (d < nearestD && d < TILE_SIZE * 20) {
                nearestD = d;
                nearestP = p;
            }
        }

        if (nearestP) {
            this.targetPassenger = nearestP;
            nearestP.claimed = true;
            this.state = 'chasing_passenger';
            this.targetX = nearestP.x;
            this.targetY = nearestP.y;
            return;
        }

        // Random roaming
        if (this.pathTimer <= 0) {
            this._pickNewRoamTarget();
        }
    }

    _chasePassenger(dt) {
        if (!this.targetPassenger || this.targetPassenger.pickedUp || !this.targetPassenger.active) {
            this.state = 'roaming';
            this.targetPassenger = null;
            return;
        }

        this.targetX = this.targetPassenger.x;
        this.targetY = this.targetPassenger.y;

        const d = dist(this.x, this.y, this.targetX, this.targetY);
        if (d < TILE_SIZE) {
            // Pick up passenger
            this.targetPassenger.active = false;
            this.targetPassenger = null;
            this.state = 'carrying';
            this.carryTimer = rand(8, 20);
            this._pickNewRoamTarget();
        }
    }

    _carry(dt) {
        this.carryTimer -= dt;
        if (this.carryTimer <= 0) {
            this.state = 'roaming';
        }
        if (this.pathTimer <= 0) {
            this._pickNewRoamTarget();
        }
    }

    _pickNewRoamTarget() {
        const pos = this.city.getRandomRoadPosition();
        this.targetX = pos.x;
        this.targetY = pos.y;
        this.pathTimer = rand(3, 8);
    }

    _moveToward(dt) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const targetAngle = Math.atan2(dy, dx);

        // Smooth turn
        const diff = angleDiff(this.angle, targetAngle);
        this.angle += diff * 2.5 * dt;

        // Accelerate
        const d = dist(this.x, this.y, this.targetX, this.targetY);
        if (d > 30) {
            this.speed += this.maxSpeed * 0.6 * dt;
        } else {
            this.speed *= 0.95;
        }
        this.speed = clamp(this.speed, 0, this.maxSpeed);

        // Apply friction
        this.speed *= 0.98;

        // Move
        const newX = this.x + Math.cos(this.angle) * this.speed * dt;
        const newY = this.y + Math.sin(this.angle) * this.speed * dt;

        // Simple collision check
        if (!this.city.isSolidAt(newX, newY) &&
            newX > 20 && newX < MAP_WIDTH - 20 &&
            newY > 20 && newY < MAP_HEIGHT - 20) {
            this.x = newX;
            this.y = newY;
        } else {
            this.speed *= -0.3;
            this.angle += rand(-0.5, 0.5);
        }

        // Off-road slowdown
        if (!this.city.isRoadAt(this.x, this.y)) {
            this.speed *= 0.94;
        }
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
