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

        // Tire system
        this.tireHealth = TIRE_MAX_HEALTH;
        this.tireBlown = false;
        this.tirePullDir = 0; // random pull direction when blown

        // Star rating
        this.rating = RATING_INITIAL;
        this.ratingHistory = []; // last N fare ratings
        this.rideDamageTaken = 0; // damage during current ride
        this.rideStartTime = 0;

        // Visual damage state (0=clean, 1=scratched, 2=dented, 3=wrecked)
        this.damageVisual = 0;

        // Luggage loading
        this.loadingLuggage = false;
        this.luggageTimer = 0;

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

        // Steering (only when moving, flip when reversing)
        const steerFactor = clamp(Math.abs(this.speed) / 80, 0, 1);
        const gripMod = this.weatherGripMod || 1.0;
        const tireGripMod = this.tireBlown ? 0.5 : clamp(this.tireHealth / 50, 0.6, 1.0);
        const turnRate = TURN_SPEED * this.grip * gripMod * tireGripMod * steerFactor * fatiguePenalty * dt;
        const steerDir = this.speed < 0 ? -1 : 1;
        if (this.keys.a) {
            this.angle -= turnRate * steerDir;
        }
        if (this.keys.d) {
            this.angle += turnRate * steerDir;
        }

        // Tire blowout pull
        if (this.tireBlown && Math.abs(this.speed) > 10) {
            this.angle += this.tirePullDir * TIRE_BLOWOUT_PULL * dt;
            this.speed *= 0.995; // gradual slowdown
        }

        this._applyMovement(dt, city);

        // Fuel consumption
        const moved = Math.abs(this.speed) * dt;
        this.fuel -= moved * FUEL_CONSUMPTION_RATE;
        this.fuel = Math.max(0, this.fuel);

        // Mileage
        const kmMoved = moved / TILE_SIZE * 0.05;
        this.totalKm += kmMoved;

        // Tire wear (mechanics skill reduces wear)
        const mechanicsLvl = (this.skills && this.skills.mechanics) || 0;
        const tireWearMult = ((this.weatherRainIntensity || 0) > 0.2 ? TIRE_RAIN_WEAR_MULT : 1.0) * (1 - mechanicsLvl * 0.15);
        this.tireHealth -= moved * TIRE_WEAR_RATE * tireWearMult;
        this.tireHealth = Math.max(0, this.tireHealth);
        if (this.tireHealth <= 0 && !this.tireBlown) {
            this.tireBlown = true;
            this.tirePullDir = Math.random() < 0.5 ? -1 : 1;
        }

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

        // Update visual damage level
        const healthPct = this.health / this.maxHealth;
        if (healthPct > 0.7) this.damageVisual = 0;
        else if (healthPct > 0.4) this.damageVisual = 1;
        else if (healthPct > 0.15) this.damageVisual = 2;
        else this.damageVisual = 3;

        // Luggage loading timer
        if (this.loadingLuggage) {
            this.luggageTimer -= dt;
            this.speed = 0; // can't move while loading
            if (this.luggageTimer <= 0) {
                this.loadingLuggage = false;
            }
        }

        // Fatigue increases while driving (endurance skill slows it)
        if (Math.abs(this.speed) > 5) {
            const enduranceLvl = (this.skills && this.skills.endurance) || 0;
            this.fatigue += FATIGUE_RATE * (1 - enduranceLvl * 0.15) * dt;
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

    refuel(pricePerLiter) {
        const price = pricePerLiter || FUEL_COST_PER_LITER;
        const needed = this.fuelCapacity - this.fuel;
        const cost = needed * price;
        if (this.money >= cost) {
            this.money -= cost;
            this.fuel = this.fuelCapacity;
            return { success: true, cost };
        }
        // Partial refuel
        const affordable = this.money / price;
        this.fuel += affordable;
        const spent = this.money;
        this.money = 0;
        return { success: true, cost: spent };
    }

    replaceTires() {
        const cost = 80;
        if (this.money < cost) return { success: false, cost: 0 };
        this.money -= cost;
        this.tireHealth = TIRE_MAX_HEALTH;
        this.tireBlown = false;
        this.tirePullDir = 0;
        return { success: true, cost };
    }

    addRating(stars) {
        this.ratingHistory.push(stars);
        if (this.ratingHistory.length > RATING_SMOOTH_FARES) {
            this.ratingHistory.shift();
        }
        const sum = this.ratingHistory.reduce((a, b) => a + b, 0);
        this.rating = sum / this.ratingHistory.length;
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
        // Check if taxi is on/near a parking tile belonging to a service building
        const { col, row } = pixelToTile(this.x, this.y);
        for (const b of city.buildings) {
            if (b.type !== BUILDING_TYPE.GAS_STATION &&
                b.type !== BUILDING_TYPE.MECHANIC &&
                b.type !== BUILDING_TYPE.HOME) continue;

            // Check if on the building's parking lot
            if (b.parkingTiles && b.parkingTiles.length > 0) {
                for (const pt of b.parkingTiles) {
                    if (Math.abs(col - pt.col) <= 1 && Math.abs(row - pt.row) <= 1) {
                        return b;
                    }
                }
            }

            // Fallback: close to building center (for buildings without parking)
            const d = dist(this.x, this.y, b.px, b.py);
            if (d < TILE_SIZE * 2.5) {
                return b;
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
