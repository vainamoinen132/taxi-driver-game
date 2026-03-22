// ============================================================
// RIDE-HAILING APP SYSTEM (Uber/Bolt style)
// ============================================================

class AppOrderManager {
    constructor(city) {
        this.city = city;
        this.orders = [];
        this.orderTimer = 0;
        this.orderInterval = rand(15, 30); // seconds between new app orders
        this.maxOrders = 3; // max pending orders at once
        this.acceptedOrder = null;

        // App names for flavor
        this.appNames = ['QuickRide', 'CityGo', 'TaxiNow', 'RideFlash'];
    }

    update(dt, playerTaxi) {
        // Generate new orders periodically
        this.orderTimer -= dt;
        if (this.orderTimer <= 0 && this.orders.length < this.maxOrders && !this.acceptedOrder) {
            this._generateOrder();
            this.orderTimer = rand(12, 25);
        }

        // Expire old orders
        for (const order of this.orders) {
            order.expireTimer -= dt;
        }
        this.orders = this.orders.filter(o => o.expireTimer > 0);

        // Check if player reached pickup for accepted order
        if (this.acceptedOrder && !this.acceptedOrder.pickedUp) {
            const d = dist(playerTaxi.x, playerTaxi.y,
                          this.acceptedOrder.pickupX, this.acceptedOrder.pickupY);
            if (d < TILE_SIZE * 2.5 && Math.abs(playerTaxi.speed) < 30) {
                // Auto-trigger pickup ready state
                this.acceptedOrder.atPickup = true;
            } else {
                this.acceptedOrder.atPickup = false;
            }
        }
    }

    _generateOrder() {
        const pickup = this.city.getRandomRoadPosition();
        const destBuilding = this.city.getRandomDestinationBuilding();
        if (!destBuilding) return;

        const destPos = this.city.getRoadNearBuilding(destBuilding);
        const tileDist = dist(pickup.x, pickup.y, destPos.x, destPos.y) / TILE_SIZE;
        const fare = Math.round(Math.max(8, tileDist * BASE_FARE_PER_TILE * 1.3)); // App orders pay more
        const appName = randChoice(this.appNames);

        const names = [
            'Alex', 'Jordan', 'Sam', 'Casey', 'Riley', 'Morgan', 'Taylor',
            'Blake', 'Jamie', 'Quinn', 'Avery', 'Charlie', 'Drew', 'Emery',
        ];

        this.orders.push({
            id: Date.now() + Math.random(),
            app: appName,
            customerName: randChoice(names),
            pickupX: pickup.x,
            pickupY: pickup.y,
            destX: destPos.x,
            destY: destPos.y,
            destBuilding: destBuilding,
            fare: fare,
            expireTimer: rand(20, 40), // seconds before order expires
            atPickup: false,
            pickedUp: false,
            distBlocks: Math.round(tileDist),
        });
    }

    acceptOrder(index) {
        if (index < 0 || index >= this.orders.length) return null;
        if (this.acceptedOrder) return null; // already have one

        const order = this.orders.splice(index, 1)[0];
        this.acceptedOrder = order;
        return order;
    }

    completeOrder(fareBonus) {
        if (!this.acceptedOrder) return null;
        const order = this.acceptedOrder;
        const total = Math.round(order.fare * fareBonus);
        this.acceptedOrder = null;
        return { fare: total, app: order.app, customer: order.customerName };
    }

    cancelOrder() {
        this.acceptedOrder = null;
    }

    getActiveOrders() {
        return this.orders;
    }

    hasAcceptedOrder() {
        return this.acceptedOrder !== null;
    }
}
