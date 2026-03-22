// ============================================================
// PASSENGER SYSTEM
// ============================================================

class Passenger {
    constructor(x, y, destination, city) {
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

        // Passenger type
        this.type = this._rollType();
        this.name = this._generateName();

        // Fare calculation
        const tileDist = dist(x, y, this.destX, this.destY) / TILE_SIZE;
        this.baseFare = Math.max(5, tileDist * BASE_FARE_PER_TILE);

        // Visual
        this.emoji = this.type === 'thief' ? '🧍' : '🧍'; // all look the same
        this.color = randChoice(['#FFD700', '#FF6B6B', '#6BCB77', '#4ECDC4', '#A78BFA', '#F472B6']);
    }

    _rollType() {
        const r = Math.random();
        if (r < 0.05) return 'thief';       // 5% thief
        if (r < 0.12) return 'troublemaker'; // 7% refuses to pay
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

    calculateFare(fareBonus) {
        let fare = this.baseFare * fareBonus;

        if (this.type === 'troublemaker') {
            // Refuses to pay or pays very little
            if (Math.random() < 0.6) {
                return { fare: 0, tip: 0, message: `${this.name} refused to pay!` };
            }
            fare *= 0.3;
        }

        let tip = 0;
        if (Math.random() < TIP_CHANCE && this.type === 'normal') {
            tip = rand(TIP_RANGE[0], TIP_RANGE[1]);
        }

        return { fare: Math.round(fare), tip: Math.round(tip), message: null };
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
        // Spawn new passengers
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.passengers.filter(p => p.active).length < MAX_PASSENGERS) {
            this.spawnPassenger();
            this.spawnTimer = this.spawnInterval / this.eventMultiplier;
        }

        // Update existing passengers
        for (const p of this.passengers) {
            p.update(dt);
        }

        // Clean up inactive passengers
        this.passengers = this.passengers.filter(p => p.active);
    }

    spawnPassenger(nearBuilding = null) {
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
            const p = new Passenger(spawnPos.x, spawnPos.y, dest, this.city);
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
}
