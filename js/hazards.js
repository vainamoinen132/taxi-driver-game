// ============================================================
// HAZARDS SYSTEM - Speed fines, thieves, accidents
// ============================================================

class HazardManager {
    constructor(city) {
        this.city = city;
        this.speedCameras = [];
        this.notifications = [];
        this.accidentCooldown = 0;

        // Place speed cameras at some intersections
        this._placeSpeedCameras();
    }

    _placeSpeedCameras() {
        // Place cameras at ~30% of intersections
        for (const rRow of this.city.horizontalRoads) {
            for (const cCol of this.city.verticalRoads) {
                if (Math.random() < 0.1) {
                    this.speedCameras.push({
                        x: cCol * TILE_SIZE + TILE_SIZE,
                        y: rRow * TILE_SIZE + TILE_SIZE,
                        cooldown: 0,
                        radius: TILE_SIZE * 3,
                    });
                }
            }
        }
    }

    update(dt, taxi) {
        // Speed camera checks
        for (const cam of this.speedCameras) {
            if (cam.cooldown > 0) {
                cam.cooldown -= dt;
                continue;
            }
            const d = dist(taxi.x, taxi.y, cam.x, cam.y);
            if (d < cam.radius && taxi.currentDisplaySpeed > SPEED_LIMIT) {
                // FINED!
                const fine = SPEED_FINE_AMOUNT + Math.floor((taxi.currentDisplaySpeed - SPEED_LIMIT) * 0.5);
                taxi.money -= fine;
                taxi.totalFines++;
                cam.cooldown = 30; // 30 seconds before same camera can fine again
                this.addNotification(`📸 Speed fine! -${formatMoney(fine)} (${Math.floor(taxi.currentDisplaySpeed)} km/h)`, 'danger');
                taxi.flashTimer = 0.5;
                taxi.flashColor = '#ff4444';
            }
        }

        // Random accident chance (very rare, based on speed and mileage)
        this.accidentCooldown -= dt;
        if (this.accidentCooldown <= 0 && taxi.invulnTimer <= 0) {
            const accidentChance = (taxi.currentDisplaySpeed / 2000) * (taxi.totalKm / 200) * dt * 0.003;
            if (Math.random() < accidentChance && taxi.currentDisplaySpeed > 150) {
                const dmg = rand(ACCIDENT_DAMAGE_RANGE[0], ACCIDENT_DAMAGE_RANGE[1]);
                taxi.takeDamage(dmg);
                taxi.speed *= 0.1;
                taxi.invulnTimer = 3;
                this.accidentCooldown = 90;
                this.addNotification(`💥 Accident! Car damaged! (-${Math.floor(dmg)}% health)`, 'danger');
            }
        }

        // Mileage-based breakdowns
        if (taxi.checkMileageBreakdown()) {
            this.addNotification(`⚠️ Mechanical issue! Car health decreased. Visit a mechanic!`, 'warning');
        }

        // Update notification timers
        this.notifications = this.notifications.filter(n => {
            n.timer -= dt;
            return n.timer > 0;
        });
    }

    handleThiefPassenger(taxi, passenger) {
        // Thief steals money
        const stolen = rand(THIEF_STEAL_RANGE[0], THIEF_STEAL_RANGE[1]);
        const actualStolen = Math.min(stolen, taxi.money);
        taxi.money -= actualStolen;
        this.addNotification(
            `🔪 ${passenger.name} was a thief! Stole ${formatMoney(actualStolen)}!`,
            'danger'
        );
        taxi.flashTimer = 1;
        taxi.flashColor = '#ff0000';
    }

    addNotification(text, type = 'info') {
        this.notifications.push({
            text,
            type,
            timer: 4,
        });
    }

    getLatestNotification() {
        return this.notifications.length > 0
            ? this.notifications[this.notifications.length - 1]
            : null;
    }
}
