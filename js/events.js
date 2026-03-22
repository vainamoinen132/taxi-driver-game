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
    }

    getActiveEventMessage() {
        return this.activeEvent ? this.activeEvent.message : null;
    }

    getActiveEventBuilding() {
        if (!this.activeEvent) return null;
        const buildings = this.city.getBuildingsOfType(this.activeEvent.buildingType);
        return buildings.length > 0 ? buildings[0] : null;
    }
}
