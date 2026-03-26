// ============================================================
// AI COMPETING TAXIS — Road-following with rivalry tracking
// Uses shared RoadNav utilities for pathfinding and movement
// ============================================================

const AI_TAXI_COMPANIES = [
    { name: 'RapidCab', color: '#e74c3c' },
    { name: 'GreenLine', color: '#2ecc71' },
    { name: 'BlueStar', color: '#3498db' },
    { name: 'CityRide', color: '#9b59b6' },
];

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

        // Company identity
        const company = randChoice(AI_TAXI_COMPANIES);
        this.companyName = company.name;
        this.companyColor = company.color;
        this.color = company.color;

        // Rivalry / earnings tracking
        this.totalEarnings = 0;
        this.totalFares = 0;

        // AI state machine: roaming → chasing_passenger → carrying → roaming
        this.state = 'roaming';
        this.targetPassenger = null;
        this.carryTimer = 0;
        this.stuckTimer = 0;
        this.lastX = x;
        this.lastY = y;

        // Road-following waypoints
        this.waypoints = [];
        this.waypointIdx = 0;
        this._buildPath();
    }

    _buildPath() {
        this.waypoints = RoadNav.buildRoamPath(this, 30, 6);
        this.waypointIdx = 0;
    }

    _buildPathToward(tx, ty) {
        this.waypoints = RoadNav.buildPathToward(this, tx, ty, 30, 6);
        this.waypointIdx = 0;
    }

    // ---- Main update ----

    update(dt, passengers) {
        // Stuck detection
        this.stuckTimer += dt;
        if (this.stuckTimer > 3) {
            const moved = dist(this.x, this.y, this.lastX, this.lastY);
            if (moved < 10) {
                this._buildPath();
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

        this._followWaypoints(dt);
    }

    // ---- State handlers ----

    _roam(dt, passengers) {
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
            this._buildPathToward(nearestP.x, nearestP.y);
            return;
        }

        if (this.waypointIdx >= this.waypoints.length || this.waypoints.length < 2) {
            this._buildPath();
        }
    }

    _chasePassenger(dt) {
        if (!this.targetPassenger || this.targetPassenger.pickedUp || !this.targetPassenger.active) {
            this.state = 'roaming';
            this.targetPassenger = null;
            this._buildPath();
            return;
        }

        if (this.waypointIdx >= this.waypoints.length || this.waypoints.length < 2) {
            this._buildPathToward(this.targetPassenger.x, this.targetPassenger.y);
        }

        const d = dist(this.x, this.y, this.targetPassenger.x, this.targetPassenger.y);
        if (d < TILE_SIZE) {
            this.targetPassenger.active = false;
            this.targetPassenger = null;
            this.state = 'carrying';
            this.carryTimer = rand(8, 20);
            this._buildPath();
        }
    }

    _carry(dt) {
        this.carryTimer -= dt;
        if (this.carryTimer <= 0) {
            const fareAmount = rand(15, 40);
            this.totalEarnings += fareAmount;
            this.totalFares++;
            this.state = 'roaming';
        }

        if (this.waypointIdx >= this.waypoints.length || this.waypoints.length < 2) {
            this._buildPath();
        }
    }

    // ---- Waypoint-following movement ----

    _followWaypoints(dt) {
        if (this.waypoints.length < 2) {
            this._buildPath();
            return;
        }

        if (RoadNav.advanceWaypoint(this)) return;

        const result = RoadNav.followWaypoint(this, dt, this.maxSpeed);
        if (!result) return;

        // Aggressive speed control (AI taxis don't brake for traffic)
        if (this.speed < result.targetSpeed) {
            this.speed += 50 * dt;
        } else {
            this.speed -= 60 * dt;
        }
        this.speed = clamp(this.speed, 0, this.maxSpeed);

        if (!RoadNav.moveOnRoad(this, dt)) {
            this._buildPath();
        }
    }

    getBounds() {
        return RoadNav.getBounds(this);
    }
}
