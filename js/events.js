// ============================================================
// SPECIAL EVENTS SYSTEM
// ============================================================

class EventManager {
    constructor(city, passengerManager) {
        this.city = city;
        this.passengerManager = passengerManager;
        this.activeEvent = null;
        this.eventTimer = 0;
        this.nextEventTime = rand(3, 6); // game minutes until first event
        this.gameMinutes = 0;
        this.eventHistory = [];
        this._eventBlockedTiles = [];
        this._eventSlowTiles = [];

        // Define possible events
        this.eventDefs = [
            {
                name: 'Football Match Ended',
                icon: '⚽',
                buildingType: BUILDING_TYPE.STADIUM,
                spawnCount: 6,
                spawnInterval: 2,
                duration: 60,
                message: '⚽ A football match just ended at the Stadium! Lots of fans need rides!',
            },
            {
                name: 'Concert Finished',
                icon: '🎵',
                buildingType: BUILDING_TYPE.CONCERT_HALL,
                spawnCount: 5,
                spawnInterval: 2.5,
                duration: 50,
                message: '🎵 A concert just ended! Music fans are looking for taxis!',
            },
            {
                name: 'School Dismissal',
                icon: '🏫',
                buildingType: BUILDING_TYPE.SCHOOL,
                spawnCount: 4,
                spawnInterval: 3,
                duration: 30,
                message: '🏫 School\'s out! Parents and students need rides!',
            },
            {
                name: 'Hospital Rush',
                icon: '🏥',
                buildingType: BUILDING_TYPE.HOSPITAL,
                spawnCount: 3,
                spawnInterval: 4,
                duration: 40,
                message: '🏥 Visiting hours ended at the Hospital! People need rides home!',
            },
            {
                name: 'Mall Sale',
                icon: '🛒',
                buildingType: BUILDING_TYPE.MALL,
                spawnCount: 4,
                spawnInterval: 3,
                duration: 45,
                message: '🛒 Big sale at the Mall! Shoppers need rides!',
            },
            {
                name: 'Office Rush Hour',
                icon: '🏛️',
                buildingType: BUILDING_TYPE.OFFICE,
                spawnCount: 5,
                spawnInterval: 2,
                duration: 40,
                message: '🏛️ Rush hour! Office workers flooding out!',
            },
            {
                name: 'Restaurant Night',
                icon: '🍽️',
                buildingType: BUILDING_TYPE.RESTAURANT,
                spawnCount: 3,
                spawnInterval: 4,
                duration: 35,
                message: '🍽️ Dinner rush! Restaurant goers need taxis!',
            },
            {
                name: 'Hotel Checkout',
                icon: '🏨',
                buildingType: BUILDING_TYPE.HOTEL,
                spawnCount: 4,
                spawnInterval: 3,
                duration: 40,
                message: '🏨 Hotel checkout time! Tourists looking for rides!',
            },
            {
                name: 'City Parade',
                icon: '🎉',
                buildingType: BUILDING_TYPE.STADIUM,
                spawnCount: 8,
                spawnInterval: 2,
                duration: 70,
                message: '🎉 City Parade! Streets packed with spectators needing rides! Some roads may be crowded.',
                special: 'parade',
                fareBonus: 1.3,
            },
            {
                name: 'Marathon',
                icon: '🏃',
                buildingType: BUILDING_TYPE.PARK,
                spawnCount: 5,
                spawnInterval: 3,
                duration: 50,
                message: '🏃 City Marathon underway! Runners\' families need rides. Watch out for road closures!',
                special: 'marathon',
                fareBonus: 1.2,
            },
            {
                name: 'Street Festival',
                icon: '🎪',
                buildingType: BUILDING_TYPE.RESTAURANT,
                spawnCount: 7,
                spawnInterval: 2,
                duration: 80,
                message: '🎪 Street Festival! Surge pricing active — huge demand for taxis!',
                special: 'festival',
                fareBonus: 1.8,
            },
            {
                name: 'Road Construction',
                icon: '🚧',
                buildingType: BUILDING_TYPE.FACTORY,
                spawnCount: 2,
                spawnInterval: 5,
                duration: 60,
                message: '🚧 Road Construction! Some routes may be slower. Workers need rides when done.',
                special: 'construction',
                fareBonus: 1.0,
            },
        ];
    }

    update(dt, gameMinutes) {
        this.gameMinutes = gameMinutes;

        // Active event
        if (this.activeEvent) {
            this.eventTimer -= dt;

            // Spawn passengers during event
            if (this.activeEvent._spawnCooldown <= 0 && this.activeEvent._spawnsLeft > 0) {
                this.passengerManager.spawnNearBuilding(
                    this.activeEvent.buildingType, 1
                );
                this.activeEvent._spawnsLeft--;
                this.activeEvent._spawnCooldown = this.activeEvent.spawnInterval;
            }
            this.activeEvent._spawnCooldown -= dt;

            if (this.eventTimer <= 0) {
                // Clean up blocked/slow tiles from event
                if (this._eventBlockedTiles.length > 0) {
                    this.city.unblockRoadTiles(this._eventBlockedTiles);
                    this._eventBlockedTiles = [];
                }
                if (this._eventSlowTiles.length > 0) {
                    this.city.removeSlowTiles(this._eventSlowTiles);
                    this._eventSlowTiles = [];
                }
                this.activeEvent = null;
                this.passengerManager.eventMultiplier = 1;
            }
            return;
        }

        // Check if it's time for a new event
        this.nextEventTime -= dt / 60; // convert to game minutes
        if (this.nextEventTime <= 0) {
            this._triggerRandomEvent();
            this.nextEventTime = rand(3, 8);
        }
    }

    _triggerRandomEvent() {
        const event = { ...randChoice(this.eventDefs) };
        event._spawnCooldown = 0;
        event._spawnsLeft = event.spawnCount;

        // Check if the building type exists
        const buildings = this.city.getBuildingsOfType(event.buildingType);
        if (buildings.length === 0) return;

        this.activeEvent = event;
        this.eventTimer = event.duration;
        this.passengerManager.eventMultiplier = 2;
        this.eventHistory.push(event.name);

        // Push a one-time notification so the player knows where to go
        const targetBuilding = buildings[0];
        const districtName = targetBuilding.district || 'the city';
        const directionHint = targetBuilding.name || event.buildingType.replace(/_/g, ' ');
        this._lastEventNotification = `${event.icon} ${event.name}! Head to ${directionHint} in ${districtName} for surge fares!`;

        // Apply road effects based on special type
        if (event.special) {
            const building = buildings[0];
            if (event.special === 'parade') {
                const tiles = this._getEventRoadTiles(building, randInt(4, 6));
                this._eventBlockedTiles = tiles;
                this.city.blockRoadTiles(tiles);
            } else if (event.special === 'construction') {
                const tiles = this._getEventRoadTiles(building, randInt(3, 5));
                this._eventSlowTiles = tiles;
                this.city.addSlowTiles(tiles);
            } else if (event.special === 'marathon') {
                const tiles = this._getEventRoadTiles(building, randInt(6, 8));
                this._eventBlockedTiles = tiles;
                this.city.blockRoadTiles(tiles);
            } else if (event.special === 'festival') {
                const tiles = this._getEventRoadTiles(building, randInt(4, 6));
                this._eventSlowTiles = tiles;
                this.city.addSlowTiles(tiles);
            }
        }
    }

    getActiveEventMessage() {
        return this.activeEvent ? this.activeEvent.message : null;
    }

    // Returns and clears the one-time notification for a new event
    popEventNotification() {
        const msg = this._lastEventNotification;
        this._lastEventNotification = null;
        return msg;
    }

    getActiveEventBuilding() {
        if (!this.activeEvent) return null;
        const buildings = this.city.getBuildingsOfType(this.activeEvent.buildingType);
        return buildings.length > 0 ? buildings[0] : null;
    }

    _getEventRoadTiles(building, count) {
        const tiles = [];
        if (!building) return tiles;
        const startCol = Math.floor(building.px / TILE_SIZE);
        const startRow = Math.floor(building.py / TILE_SIZE);
        // Search outward from building for road tiles
        for (let radius = 1; radius < 6 && tiles.length < count; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    const r = startRow + dr;
                    const c = startCol + dc;
                    if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
                        if (isRoadTile(this.city.tiles[r][c])) {
                            tiles.push({ row: r, col: c });
                            if (tiles.length >= count) return tiles;
                        }
                    }
                }
            }
        }
        return tiles;
    }
}
