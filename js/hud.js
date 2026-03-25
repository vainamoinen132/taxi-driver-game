// ============================================================
// HUD MANAGER
// ============================================================

class HUD {
    constructor() {
        this.moneyEl = document.querySelector('#hud-money span');
        this.fuelBar = document.querySelector('.fuel-bar');
        this.healthBar = document.querySelector('.health-bar');
        this.fatigueBar = document.querySelector('.fatigue-bar');
        this.speedEl = document.querySelector('#hud-speed span');
        this.kmEl = document.querySelector('#hud-km span');
        this.timeEl = document.querySelector('#hud-time span');
        this.dayEl = document.querySelector('#hud-day span');
        this.passengerInfo = document.getElementById('hud-passenger-info');
        this.passengerStatus = document.getElementById('passenger-status');
        this.notificationEl = document.getElementById('hud-notification');
        this.interactionPrompt = document.getElementById('interaction-prompt');
        this.interactionText = document.getElementById('interaction-text');
        this.eventBanner = document.getElementById('event-banner');
        this.eventText = document.getElementById('event-text');

        // Radio display elements
        this.radioDisplay = document.getElementById('radio-display');
        this.radioStation = document.getElementById('radio-station');
        this.radioContent = document.getElementById('radio-content');

        this.lastNotifText = '';
        this.eventBannerTimer = 0;
    }

    update(taxi, gameTime, hazardManager, eventManager, appOrderMgr, weather, radio) {
        // Money
        this.moneyEl.textContent = '$' + Math.floor(taxi.money).toLocaleString();

        // Fuel bar
        const fuelPct = (taxi.fuel / taxi.fuelCapacity) * 100;
        this.fuelBar.style.width = fuelPct + '%';
        if (fuelPct < 20) {
            this.fuelBar.style.background = '#e74c3c';
        } else {
            this.fuelBar.style.background = 'linear-gradient(90deg, #e74c3c, #f39c12, #2ecc71)';
        }

        // Health bar
        const healthPct = (taxi.health / taxi.maxHealth) * 100;
        this.healthBar.style.width = healthPct + '%';
        if (healthPct < 25) {
            this.healthBar.style.background = '#e74c3c';
        } else {
            this.healthBar.style.background = 'linear-gradient(90deg, #e74c3c, #3498db, #2ecc71)';
        }

        // Fatigue / Energy bar
        if (this.fatigueBar) {
            const energyPct = ((MAX_FATIGUE - taxi.fatigue) / MAX_FATIGUE) * 100;
            this.fatigueBar.style.width = energyPct + '%';
            if (energyPct < 25) {
                this.fatigueBar.style.background = '#e74c3c';
            } else if (energyPct < 50) {
                this.fatigueBar.style.background = '#f39c12';
            } else {
                this.fatigueBar.style.background = 'linear-gradient(90deg, #f39c12, #2ecc71)';
            }
        }

        // Speed
        this.speedEl.textContent = Math.floor(taxi.currentDisplaySpeed);

        // KM
        this.kmEl.textContent = taxi.totalKm.toFixed(1);

        // Time
        this.timeEl.textContent = formatTime(gameTime);
        this.dayEl.textContent = taxi.day;

        // Passenger info
        if (taxi.loadingLuggage) {
            this.passengerInfo.classList.remove('hidden');
            this.passengerStatus.textContent = '🧳 Loading luggage...';
        } else if (taxi.hasPassenger && taxi.passenger) {
            this.passengerInfo.classList.remove('hidden');
            const destName = taxi.passenger.getDestinationName();
            let pText = `🧑 ${taxi.passenger.name} → ${destName}`;
            if (taxi.passenger.isVIP) pText = `⭐ VIP: ${taxi.passenger.name} → ${destName}`;
            if (taxi.passenger.hasLuggage) pText += ' 🧳';
            this.passengerStatus.textContent = pText;
        } else if (appOrderMgr && appOrderMgr.acceptedOrder && !appOrderMgr.acceptedOrder.pickedUp) {
            this.passengerInfo.classList.remove('hidden');
            const o = appOrderMgr.acceptedOrder;
            this.passengerStatus.textContent = `📱 ${o.app}: Pick up ${o.customerName} (SPACE at marker)`;
        } else {
            this.passengerInfo.classList.remove('hidden');
            const appCount = appOrderMgr ? appOrderMgr.getActiveOrders().length : 0;
            let statusText = 'Looking for passengers... (SPACE to pick up)';
            if (appCount > 0) statusText += ` | 📱 ${appCount} app orders (F)`;
            this.passengerStatus.textContent = statusText;
        }

        // Notifications from hazards
        const notif = hazardManager.getLatestNotification();
        if (notif && notif.text !== this.lastNotifText) {
            this.lastNotifText = notif.text;
            this.notificationEl.textContent = notif.text;
            this.notificationEl.classList.remove('hidden');
            this.notificationEl.style.background = notif.type === 'danger'
                ? 'rgba(231,76,60,0.9)'
                : notif.type === 'warning'
                    ? 'rgba(243,156,18,0.9)'
                    : 'rgba(46,204,113,0.9)';
        } else if (!notif) {
            this.notificationEl.classList.add('hidden');
            this.lastNotifText = '';
        }

        // Radio display
        if (radio && this.radioDisplay) {
            const content = radio.getCurrentContent();
            const stationInfo = radio.getCurrentStationInfo();
            
            if (stationInfo.enabled && content) {
                this.radioDisplay.classList.remove('hidden');
                this.radioStation.textContent = stationInfo.name;
                this.radioStation.style.color = stationInfo.color;
                
                if (content.type === 'music') {
                    this.radioContent.textContent = `🎵 ${content.title} - ${content.artist}`;
                } else if (content.type === 'news') {
                    this.radioContent.textContent = `📰 ${content.text}`;
                }
            } else {
                this.radioDisplay.classList.add('hidden');
            }
        }

        // Interaction prompt
        const interBuilding = taxi.nearBuilding;
        if (interBuilding && Math.abs(taxi.speed) < 20) {
            this.interactionPrompt.classList.remove('hidden');
            if (interBuilding.type === BUILDING_TYPE.GAS_STATION) {
                const price = interBuilding.fuelPrice ? `$${interBuilding.fuelPrice.toFixed(2)}/L` : '';
                this.interactionText.textContent = `⛽ Hold E to Refuel ${price}`;
            } else if (interBuilding.type === BUILDING_TYPE.MECHANIC) {
                let mechText = '🔧 Press E to Repair';
                if (taxi.tireHealth < 80 || taxi.tireBlown) mechText += ' | Also replaces tires';
                this.interactionText.textContent = mechText;
            } else if (interBuilding.type === BUILDING_TYPE.HOME) {
                this.interactionText.textContent = '🏡 Press E to Rest at Home';
            }
        } else {
            this.interactionPrompt.classList.add('hidden');
        }

        // Event banner
        const eventMsg = eventManager.getActiveEventMessage();
        if (eventMsg) {
            this.eventBanner.classList.remove('hidden');
            this.eventText.textContent = eventMsg;
        } else {
            this.eventBanner.classList.add('hidden');
        }
    }
}
