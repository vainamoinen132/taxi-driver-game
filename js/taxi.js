// ============================================================
// PLAYER TAXI
// ============================================================

class Taxi {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = 0; // radians
        this.speed = 0; // pixels per second

        // Upgrade levels (index into UPGRADES arrays) - initialize first!
        this.upgradeLevels = {
            engine: 0,
            fuel_tank: 0,
            tires: 0,
            brakes: 0,
            body: 0,
            comfort: 0,
        };

        // Car model system
        this.carModelId = 'starter_cab';
        this.ownedCars = ['starter_cab'];
        this._applyCarModel();

        // Stats
        this.money = 500;
        this.fuel = this.fuelCapacity;
        this.health = this.maxHealth;
        this.totalKm = 0;
        this.totalFares = 0;
        this.totalEarnings = 0;
        this.day = 1;
        this.totalDamageEvents = 0;
        this.totalFines = 0;

        // Per-day earnings tracking
        this.dayEarnings = [];  // Array of { day, earnings, fares, km, fines, topFare }
        this.currentDayEarnings = 0;
        this.currentDayFares = 0;
        this.currentDayKm = 0;
        this.currentDayFines = 0;
        this.currentDayTopFare = 0;
        this.earningsPerHour = 0;
        this._earningsTrackStart = Date.now() / 1000;

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
        this.rideRealStartTime = 0; // real clock time for ride duration calculation
        this.rideWaitTime = 0; // time passenger waited for pickup
        this.rideDistance = 0; // distance traveled during ride
        this.rideSpeedSum = 0; // sum of speeds for average calculation
        this.rideSpeedSamples = 0; // number of speed samples

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

    _applyCarModel() {
        const model = CAR_MODELS.find(m => m.id === this.carModelId) || CAR_MODELS[0];
        this._carStats = model.stats;
        this.width = model.width;
        this.height = model.height;
        this.carColor = model.color;
    }

    switchCar(modelId) {
        this.carModelId = modelId;
        this._applyCarModel();
        this.health = this.maxHealth;
        this.fuel = this.fuelCapacity;
        this.tireHealth = TIRE_MAX_HEALTH;
        this.tireBlown = false;
    }

    get carModel() {
        return CAR_MODELS.find(m => m.id === this.carModelId) || CAR_MODELS[0];
    }

    get maxSpeed() {
        const base = this._carStats ? this._carStats.maxSpeed : 100;
        const upgBonus = UPGRADES.engine.levels[this.upgradeLevels.engine].maxSpeed - 100;
        const charMod = (this.characterBonuses && this.characterBonuses.maxSpeed) || 1.0;
        return (base + upgBonus) * charMod;
    }
    get acceleration() {
        const base = this._carStats ? this._carStats.acceleration : 50;
        const upgBonus = UPGRADES.engine.levels[this.upgradeLevels.engine].acceleration - 50;
        return base + upgBonus;
    }
    get fuelCapacity() {
        const base = this._carStats ? this._carStats.fuelCapacity : 100;
        const upgBonus = UPGRADES.fuel_tank.levels[this.upgradeLevels.fuel_tank].capacity - 100;
        return base + upgBonus;
    }
    get grip() {
        const base = this._carStats ? this._carStats.grip : 1.0;
        const upgBonus = UPGRADES.tires.levels[this.upgradeLevels.tires].grip - 1.0;
        return base + upgBonus;
    }
    get brakesPower() {
        const base = this._carStats ? this._carStats.brakes : 1.0;
        const upgBonus = UPGRADES.brakes.levels[this.upgradeLevels.brakes].power - 1.0;
        return base + upgBonus;
    }
    get maxHealth() {
        const base = this._carStats ? this._carStats.durability : 100;
        const upgBonus = UPGRADES.body.levels[this.upgradeLevels.body].durability - 100;
        const charMod = (this.characterBonuses && this.characterBonuses.durability) || 1.0;
        return Math.round((base + upgBonus) * charMod);
    }
    get fareBonus() {
        const base = this._carStats ? this._carStats.fareBonus : 1.0;
        const upgBonus = UPGRADES.comfort.levels[this.upgradeLevels.comfort].fareBonus - 1.0;
        return base + upgBonus;
    }
    get fuelEfficiency() {
        const base = this._carStats ? this._carStats.fuelEfficiency : 1.0;
        const charMod = (this.characterBonuses && this.characterBonuses.fuelEfficiency) || 1.0;
        return base * charMod;
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

        // Fuel consumption (affected by car's fuel efficiency)
        const moved = Math.abs(this.speed) * dt;
        this.fuel -= moved * FUEL_CONSUMPTION_RATE * this.fuelEfficiency;
        this.fuel = Math.max(0, this.fuel);

        // Mileage
        const kmMoved = moved / TILE_SIZE * 0.05;
        this.totalKm += kmMoved;

        // Track ride statistics
        if (this.hasPassenger) {
            this.rideDistance += kmMoved;
            this.rideSpeedSum += Math.abs(this.speed);
            this.rideSpeedSamples++;
        }

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

        // Slow tile penalty (construction, festival zones)
        if (city.isSlowAt && city.isSlowAt(this.x, this.y)) {
            this.speed *= 0.93;
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

        // Fatigue increases while driving (endurance skill + character bonus slow it)
        if (Math.abs(this.speed) > 5) {
            const enduranceLvl = (this.skills && this.skills.endurance) || 0;
            const charFatigueMod = (this.characterBonuses && this.characterBonuses.fatigueRate) || 1.0;
            const coffeeMod = (this.personalItems && this.personalItems.coffee_thermos) ? 0.8 : 1.0;
            this.fatigue += FATIGUE_RATE * (1 - enduranceLvl * 0.15) * charFatigueMod * coffeeMod * dt;
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
            // Damage proportional to impact speed before bounce
            const impactSpeed = Math.abs(this.speed);
            this.speed *= -0.3;
            if (impactSpeed > 15 && this.invulnTimer <= 0) {
                const severity = Math.pow(impactSpeed / 40, 1.6);
                const dmg = Math.min(severity * 2.5, 30);
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
        // Air freshener boosts ratings by 5%
        if (this.personalItems && this.personalItems.air_freshener) {
            stars = Math.min(5, stars * 1.05);
        }
        this.ratingHistory.push(stars);
        if (this.ratingHistory.length > RATING_SMOOTH_FARES) {
            this.ratingHistory.shift();
        }
        const sum = this.ratingHistory.reduce((a, b) => a + b, 0);
        this.rating = sum / this.ratingHistory.length;
    }

    repair() {
        const needed = this.maxHealth - this.health;
        const charRepairMod = (this.characterBonuses && this.characterBonuses.repairCost) || 1.0;
        const costPerPct = REPAIR_COST_PER_PERCENT * charRepairMod;
        const cost = needed * costPerPct;
        if (this.money >= cost) {
            this.money -= cost;
            this.health = this.maxHealth;
            return { success: true, cost };
        }
        // Partial repair
        const affordable = this.money / costPerPct;
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
        // Only trigger when taxi is actually ON a parking tile and nearly stopped
        if (Math.abs(this.speed) > 15) return null;
        const { col, row } = pixelToTile(this.x, this.y);
        // Only these building types have player interactions
        const interactable = [BUILDING_TYPE.GAS_STATION, BUILDING_TYPE.MECHANIC, BUILDING_TYPE.HOME];
        for (const b of city.buildings) {
            if (b.parkingTiles.length === 0) continue;
            if (!interactable.includes(b.type)) continue;
            for (const ptile of b.parkingTiles) {
                if (ptile.col === col && ptile.row === row) {
                    return b;
                }
            }
        }
        return null;
    }

    getRideStats() {
        const rideTime = this.rideRealStartTime > 0 ? (Date.now() / 1000) - this.rideRealStartTime : 0;
        const avgSpeed = this.rideSpeedSamples > 0 ? (this.rideSpeedSum / this.rideSpeedSamples) : 0;
        
        return {
            rideTime,
            waitTime: this.rideWaitTime,
            avgSpeed,
            distance: this.rideDistance
        };
    }

    resetRideStats() {
        this.rideDamageTaken = 0;
        this.rideStartTime = 0;
        this.rideRealStartTime = 0;
        this.rideWaitTime = 0;
        this.rideDistance = 0;
        this.rideSpeedSum = 0;
        this.rideSpeedSamples = 0;
    }

    recordDayEnd() {
        this.dayEarnings.push({
            day: this.day,
            earnings: this.currentDayEarnings,
            fares: this.currentDayFares,
            km: this.currentDayKm,
            fines: this.currentDayFines,
            topFare: this.currentDayTopFare
        });
        this.currentDayEarnings = 0;
        this.currentDayFares = 0;
        this.currentDayKm = 0;
        this.currentDayFines = 0;
        this.currentDayTopFare = 0;
        this._earningsTrackStart = Date.now() / 1000;
    }

    updateEarningsPerHour() {
        const elapsed = (Date.now() / 1000) - this._earningsTrackStart;
        if (elapsed > 10) { // at least 10 seconds
            this.earningsPerHour = (this.currentDayEarnings / elapsed) * 3600;
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
