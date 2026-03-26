// ============================================================
// PASSENGER SYSTEM
// ============================================================

class Passenger {
    constructor(x, y, destination, city, playerRating = 3.0, hasSeatCovers = false) {
        this.x = x;
        this.y = y;
        this.destination = destination; // building object
        this.destX = 0;
        this.destY = 0;
        this.city = city;

        // Set destination to road near building
        const roadPos = city.getRoadNearBuilding(destination);
        this.destX = roadPos.x;
        this.destY = roadPos.y;

        this.active = true;
        this.pickedUp = false;
        this.claimed = false; // claimed by AI taxi
        this.waitTimer = rand(20, 45); // seconds before they give up
        this.bobTimer = 0;
        this.spawnTime = Date.now() / 1000; // Track when passenger spawned for wait time calculation
        this.spawnX = x; // Store spawn position for efficiency calculation
        this.spawnY = y;

        // Passenger type
        this.type = this._rollType(playerRating, hasSeatCovers);
        this.name = this._generateName();

        // VIP status
        this.isVIP = this.type === 'vip';

        // Luggage
        this.hasLuggage = !this.isVIP && Math.random() < LUGGAGE_CHANCE;

        // Fare calculation
        const tileDist = dist(x, y, this.destX, this.destY) / TILE_SIZE;
        this.baseFare = Math.max(5, tileDist * BASE_FARE_PER_TILE);
        if (this.isVIP) this.baseFare *= VIP_FARE_MULTIPLIER;

        // Visual — troublemakers get a distinct look so player can avoid them
        if (this.isVIP) {
            this.emoji = '🤵';
            this.color = '#FFD700';
        } else if (this.type === 'troublemaker') {
            this.emoji = '😤';
            this.color = '#FF4444';
        } else if (this.type === 'thief') {
            // Thieves look normal — no warning (they're sneaky)
            this.emoji = this.hasLuggage ? '🧳' : '🧍';
            this.color = randChoice(['#FFD700', '#FF6B6B', '#6BCB77', '#4ECDC4', '#A78BFA', '#F472B6']);
        } else {
            this.emoji = this.hasLuggage ? '🧳' : '🧍';
            this.color = randChoice(['#FFD700', '#FF6B6B', '#6BCB77', '#4ECDC4', '#A78BFA', '#F472B6']);
        }
    }

    _rollType(playerRating = 3.0, hasSeatCovers = false) {
        const r = Math.random();

        // VIP chance increases with rating (cumulative thresholds)
        let vipChance = 0.04;
        if (playerRating >= 4.5) vipChance = 0.12;
        else if (playerRating >= 4.0) vipChance = 0.08;
        else if (playerRating >= 3.5) vipChance = 0.06;
        else if (playerRating < 2.5) vipChance = 0.01;
        // Seat covers double VIP attraction
        if (hasSeatCovers) vipChance *= 2;
        
        const thiefChance = vipChance + 0.04;       // 4% thief
        const troubleChance = thiefChance + 0.12;    // 12% troublemaker
        
        if (r < vipChance) return 'vip';
        if (r < thiefChance) return 'thief';
        if (r < troubleChance) return 'troublemaker';
        return 'normal';
    }

    _generateName() {
        const names = [
            'Alex', 'Jordan', 'Sam', 'Casey', 'Riley', 'Morgan', 'Taylor',
            'Blake', 'Jamie', 'Quinn', 'Avery', 'Charlie', 'Drew', 'Emery',
            'Frankie', 'Harper', 'Jesse', 'Kit', 'Lane', 'Noel', 'Pat',
            'Reese', 'Sage', 'Tatum', 'Val', 'Wren'
        ];
        return randChoice(names);
    }

    update(dt) {
        if (!this.active) return;
        this.bobTimer += dt * 3;
        if (!this.pickedUp) {
            this.waitTimer -= dt;
            if (this.waitTimer <= 0) {
                this.active = false;
            }
        }
    }

    getDistanceToDestination() {
        return dist(this.x, this.y, this.destX, this.destY);
    }

    getDestinationName() {
        return BUILDING_ICONS[this.destination.type] + ' ' +
               this.destination.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    calculateFare(fareBonus, fareMultiplier, rideDamage, rideTime, waitTime, avgSpeed) {
        let fare = this.baseFare * fareBonus * (fareMultiplier || 1.0);

        if (this.type === 'troublemaker') {
            // 40% chance to refuse payment (reduced from 60% since player can now see the warning)
            if (Math.random() < 0.4) {
                return { fare: 0, tip: 0, stars: 1, message: `${this.name} refused to pay!`, feedback: 'refused to pay' };
            }
            fare *= 0.5; // Pay less but not as punishing as before
        }

        // Enhanced tip calculation based on multiple factors
        let tipMult = 1.0;
        if (this.hasLuggage) tipMult *= LUGGAGE_TIP_BONUS;

        // Speed bonus/penalty
        if (avgSpeed > 0) {
            if (avgSpeed > 180) tipMult *= 0.8; // Too fast = unsafe
            else if (avgSpeed > 120 && avgSpeed <= 150) tipMult *= 1.2; // Good speed
            else if (avgSpeed < 60) tipMult *= 0.7; // Too slow
        }

        // Wait time penalty
        if (waitTime > 10) tipMult *= 0.9; // Waited too long
        if (waitTime > 20) tipMult *= 0.7; // Very long wait

        // Ride time efficiency
        if (rideTime > 0) {
            const efficiency = this.destination ? 
                dist(this.spawnX, this.spawnY, this.destination.px, this.destination.py) / (avgSpeed * rideTime) : 1;
            if (efficiency > 0.8) tipMult *= 1.1; // Efficient route
            if (efficiency < 0.3) tipMult *= 0.8; // Very inefficient
        }

        let tip = 0;
        const tipChance = this.isVIP ? 0.8 : TIP_CHANCE;
        if (Math.random() < tipChance && this.type !== 'troublemaker') {
            tip = rand(TIP_RANGE[0], TIP_RANGE[1]) * tipMult;
            if (this.isVIP) tip *= 2;
        }

        // Star rating calculation with tracked reasons
        let stars = 5;
        const ratingReasons = [];

        // Damage penalties
        if ((rideDamage || 0) > 5) { stars -= 1; ratingReasons.push('-1 crash damage'); }
        if ((rideDamage || 0) > 15) { stars -= 1; ratingReasons.push('-1 heavy damage'); }
        if (this.isVIP && (rideDamage || 0) > 3) { stars -= 1; ratingReasons.push('-1 VIP uncomfortable'); }

        // Speed penalties
        if (avgSpeed > 200) { stars -= 1; ratingReasons.push('-1 reckless speed'); }
        if (avgSpeed < 40) { stars -= 1; ratingReasons.push('-1 too slow'); }

        // Wait time penalties
        if (waitTime > 15) { stars -= 1; ratingReasons.push('-1 long wait'); }
        if (waitTime > 30) { stars -= 1; ratingReasons.push('-1 very long wait'); }

        // VIP is more demanding
        if (this.isVIP) {
            if (waitTime > 5) { stars -= 1; ratingReasons.push('-1 VIP waited'); }
            if (avgSpeed > 160) { stars -= 1; ratingReasons.push('-1 VIP felt unsafe'); }
        }

        stars = clamp(stars, 1, 5);

        // Build feedback from actual rating factors
        let feedback = null;
        if (ratingReasons.length === 0) {
            feedback = 'Perfect ride!';
        } else if (stars >= 4) {
            feedback = randChoice(['Great driving!', 'Smooth ride!', 'Nice trip!']);
        } else {
            feedback = ratingReasons.slice(0, 2).join(', ');
        }

        return { fare: Math.round(fare), tip: Math.round(tip), stars, message: null, feedback };
    }
}

class PassengerManager {
    constructor(city) {
        this.city = city;
        this.passengers = [];
        this.spawnTimer = 0;
        this.spawnInterval = BASE_PASSENGER_SPAWN_INTERVAL / 1000;
        this.eventMultiplier = 1;
    }

    update(dt, playerTaxi, aiTaxis) {
        // Rating-based spawn multiplier
        const ratingMultiplier = playerTaxi ? this._getRatingSpawnMultiplier(playerTaxi.rating) : 1.0;
        const hasSeatCovers = playerTaxi && playerTaxi.personalItems && playerTaxi.personalItems.seat_covers;

        // Spawn new passengers
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.passengers.filter(p => p.active).length < MAX_PASSENGERS) {
            this.spawnPassenger(null, playerTaxi ? playerTaxi.rating : 3.0, hasSeatCovers);
            this.spawnTimer = this.spawnInterval / this.eventMultiplier / ratingMultiplier;
        }

        // Update existing passengers
        for (const p of this.passengers) {
            p.update(dt);
        }

        // Clean up inactive passengers
        this.passengers = this.passengers.filter(p => p.active);
    }

    spawnPassenger(nearBuilding = null, playerRating = 3.0, hasSeatCovers = false) {
        let spawnPos;
        let dest;

        if (nearBuilding) {
            spawnPos = this.city.getSidewalkNearBuilding(nearBuilding);
            dest = this.city.getRandomDestinationBuilding([nearBuilding.type]);
        } else {
            spawnPos = this.city.getRandomSidewalkPosition();
            dest = this.city.getRandomDestinationBuilding();
        }

        if (dest) {
            const p = new Passenger(spawnPos.x, spawnPos.y, dest, this.city, playerRating, hasSeatCovers);
            this.passengers.push(p);
            return p;
        }
        return null;
    }

    spawnNearBuilding(buildingType, count) {
        const buildings = this.city.getBuildingsOfType(buildingType);
        for (let i = 0; i < count && buildings.length > 0; i++) {
            const b = randChoice(buildings);
            this.spawnPassenger(b);
        }
    }

    getActivePassengers() {
        return this.passengers.filter(p => p.active && !p.pickedUp);
    }

    getNearestPassenger(x, y, maxDist = TILE_SIZE * 2.5) {
        let nearest = null;
        let minDist = maxDist;
        for (const p of this.passengers) {
            if (!p.active || p.pickedUp || p.claimed) continue;
            const d = dist(x, y, p.x, p.y);
            if (d < minDist) {
                minDist = d;
                nearest = p;
            }
        }
        return nearest;
    }

    _getRatingSpawnMultiplier(rating) {
        // Higher rating = more passengers
        if (rating >= 4.5) return 1.3; // Excellent rating, 30% more passengers
        if (rating >= 4.0) return 1.15; // Great rating, 15% more passengers
        if (rating >= 3.5) return 1.05; // Good rating, 5% more passengers
        if (rating >= 3.0) return 1.0; // Average rating, normal spawn rate
        if (rating >= 2.5) return 0.9; // Below average, 10% fewer passengers
        if (rating >= 2.0) return 0.75; // Poor rating, 25% fewer passengers
        return 0.6; // Very poor rating, 40% fewer passengers
    }
}
