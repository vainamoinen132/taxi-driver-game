// ============================================================
// PLAYER TAXI
// ============================================================

class Taxi {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = 0; // radians
        this.speed = 0; // pixels per second
        this.width = 40;
        this.height = 22;

        // Stats
        this.money = 500;
        this.fuel = 100;
        this.health = 100;
        this.totalKm = 0;
        this.totalFares = 0;
        this.totalEarnings = 0;
        this.day = 1;
        this.totalDamageEvents = 0;
        this.totalFines = 0;

        // Upgrade levels (index into UPGRADES arrays)
        this.upgradeLevels = {
            engine: 0,
            fuel_tank: 0,
            tires: 0,
            brakes: 0,
            body: 0,
            comfort: 0,
        };

        // Passenger
        this.passenger = null;
        this.hasPassenger = false;

        // Damage accumulation based on mileage
        this.nextBreakdownKm = rand(15, 40);

        // Speed tracking for fines
        this.currentDisplaySpeed = 0;

        // Interaction state
        this.nearBuilding = null;
        this.canInteract = false;

        // Invulnerability after accident
        this.invulnTimer = 0;

        // Fatigue
        this.fatigue = 0;
        this.isResting = false;

        // Navigation waypoint (for showing direction to a building)
        this.navTarget = null; // { x, y, label, icon }

        // Visual effects
        this.flashTimer = 0;
        this.flashColor = null;

        // Input
        this.keys = {
            w: false, a: false, s: false, d: false,
            space: false, e: false,
        };
    }

    get maxSpeed() {
        return UPGRADES.engine.levels[this.upgradeLevels.engine].maxSpeed;
    }
    get acceleration() {
        return UPGRADES.engine.levels[this.upgradeLevels.engine].acceleration;
    }
    get fuelCapacity() {
        return UPGRADES.fuel_tank.levels[this.upgradeLevels.fuel_tank].capacity;
    }
    get grip() {
        return UPGRADES.tires.levels[this.upgradeLevels.tires].grip;
    }
    get brakesPower() {
        return UPGRADES.brakes.levels[this.upgradeLevels.brakes].power;
    }
    get maxHealth() {
        return UPGRADES.body.levels[this.upgradeLevels.body].durability;
    }
    get fareBonus() {
        return UPGRADES.comfort.levels[this.upgradeLevels.comfort].fareBonus;
    }

    update(dt, city) {
        if (this.fuel <= 0) {
            // Out of fuel - coast to stop
            this.speed *= 0.95;
            if (Math.abs(this.speed) < 1) this.speed = 0;
            this._applyMovement(dt, city);
            return;
        }

        // Fatigue penalty
        const fatiguePenalty = this.fatigue > FATIGUE_PENALTY_THRESHOLD
            ? 1.0 - ((this.fatigue - FATIGUE_PENALTY_THRESHOLD) / (MAX_FATIGUE - FATIGUE_PENALTY_THRESHOLD)) * 0.5
            : 1.0;

        // Acceleration
        const accelRate = this.acceleration * (this.health / this.maxHealth * 0.5 + 0.5) * fatiguePenalty;
        if (this.keys.w) {
            this.speed += accelRate * dt;
        }
        if (this.keys.s) {
            if (this.speed > 10) {
                // Braking
                this.speed -= accelRate * 1.5 * this.brakesPower * dt;
            } else {
                // Reverse
                this.speed -= accelRate * REVERSE_SPEED_FACTOR * dt;
            }
        }

        // Clamp speed
        const maxPx = this.maxSpeed * (this.health / this.maxHealth * 0.3 + 0.7);
        this.speed = clamp(this.speed, -maxPx * REVERSE_SPEED_FACTOR, maxPx);

        // Friction
        if (!this.keys.w && !this.keys.s) {
            this.speed *= FRICTION;
            if (Math.abs(this.speed) < 2) this.speed = 0;
        }

        // Steering (only when moving)
        const steerFactor = clamp(Math.abs(this.speed) / 80, 0, 1);
        const turnRate = TURN_SPEED * this.grip * steerFactor * fatiguePenalty * dt;
        if (this.keys.a) {
            this.angle -= turnRate;
        }
        if (this.keys.d) {
            this.angle += turnRate;
        }

        this._applyMovement(dt, city);

        // Fuel consumption
        const moved = Math.abs(this.speed) * dt;
        this.fuel -= moved * FUEL_CONSUMPTION_RATE;
        this.fuel = Math.max(0, this.fuel);

        // Mileage
        const kmMoved = moved / TILE_SIZE * 0.05;
        this.totalKm += kmMoved;

        // Display speed (for HUD)
        this.currentDisplaySpeed = Math.abs(this.speed) * 1.2;

        // Invulnerability timer
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        // Flash timer
        if (this.flashTimer > 0) this.flashTimer -= dt;

        // Off-road penalty
        if (!city.isRoadAt(this.x, this.y)) {
            this.speed *= 0.96;
        }

        // Fatigue increases while driving
        if (Math.abs(this.speed) > 5) {
            this.fatigue += FATIGUE_RATE * dt;
            this.fatigue = Math.min(this.fatigue, MAX_FATIGUE);
        }
    }

    _applyMovement(dt, city) {
        const vx = Math.cos(this.angle) * this.speed * dt;
        const vy = Math.sin(this.angle) * this.speed * dt;

        const newX = this.x + vx;
        const newY = this.y + vy;

        // Simple collision with buildings
        const hw = this.width / 2, hh = this.height / 2;
        const corners = [
            [newX - hw, newY - hh],
            [newX + hw, newY - hh],
            [newX - hw, newY + hh],
            [newX + hw, newY + hh],
        ];

        let blocked = false;
        for (const [cx, cy] of corners) {
            if (city.isSolidAt(cx, cy)) {
                blocked = true;
                break;
            }
        }

        // Map bounds
        if (newX < hw || newX > MAP_WIDTH - hw || newY < hh || newY > MAP_HEIGHT - hh) {
            blocked = true;
        }

        if (blocked) {
            // Bounce back and take damage
            this.speed *= -0.3;
            if (Math.abs(this.speed) > 20 && this.invulnTimer <= 0) {
                const dmg = Math.abs(this.speed) * 0.05;
                this.takeDamage(dmg);
            }
        } else {
            this.x = newX;
            this.y = newY;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        this.health = Math.max(0, this.health);
        this.flashTimer = 0.3;
        this.flashColor = '#ff0000';
        this.totalDamageEvents++;
    }

    refuel() {
        const needed = this.fuelCapacity - this.fuel;
        const cost = needed * FUEL_COST_PER_LITER;
        if (this.money >= cost) {
            this.money -= cost;
            this.fuel = this.fuelCapacity;
            return { success: true, cost };
        }
        // Partial refuel
        const affordable = this.money / FUEL_COST_PER_LITER;
        this.fuel += affordable;
        const spent = this.money;
        this.money = 0;
        return { success: true, cost: spent };
    }

    repair() {
        const needed = this.maxHealth - this.health;
        const cost = needed * REPAIR_COST_PER_PERCENT;
        if (this.money >= cost) {
            this.money -= cost;
            this.health = this.maxHealth;
            return { success: true, cost };
        }
        // Partial repair
        const affordable = this.money / REPAIR_COST_PER_PERCENT;
        this.health += affordable;
        const spent = this.money;
        this.money = 0;
        return { success: true, cost: spent };
    }

    canUpgrade(upgradeKey) {
        const currentLevel = this.upgradeLevels[upgradeKey];
        const levels = UPGRADES[upgradeKey].levels;
        if (currentLevel >= levels.length - 1) return { can: false, reason: 'Max level' };
        const nextCost = levels[currentLevel + 1].cost;
        if (this.money < nextCost) return { can: false, reason: `Need ${formatMoney(nextCost)}` };
        return { can: true, cost: nextCost };
    }

    doUpgrade(upgradeKey) {
        const check = this.canUpgrade(upgradeKey);
        if (!check.can) return false;
        this.money -= check.cost;
        this.upgradeLevels[upgradeKey]++;
        // Reset health/fuel to new max on body/tank upgrade
        if (upgradeKey === 'body') this.health = this.maxHealth;
        if (upgradeKey === 'fuel_tank') this.fuel = this.fuelCapacity;
        return true;
    }

    checkMileageBreakdown() {
        if (this.totalKm >= this.nextBreakdownKm) {
            this.nextBreakdownKm += rand(10, 30);
            // Chance of random issue increases with mileage
            const issueChance = clamp(this.totalKm / 200, 0.1, 0.7);
            if (Math.random() < issueChance) {
                const dmg = rand(5, 20);
                this.takeDamage(dmg);
                return true;
            }
        }
        return false;
    }

    getInteractionBuilding(city) {
        // Check if near a gas station, mechanic, or home
        for (const b of city.buildings) {
            if (b.type === BUILDING_TYPE.GAS_STATION ||
                b.type === BUILDING_TYPE.MECHANIC ||
                b.type === BUILDING_TYPE.HOME) {
                const d = dist(this.x, this.y, b.px, b.py);
                if (d < TILE_SIZE * 3) {
                    return b;
                }
            }
        }
        return null;
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
