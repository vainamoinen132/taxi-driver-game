// ============================================================
// GAME - Core game loop and state management
// ============================================================

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.minimapCanvas = document.getElementById('minimap');

        // Game state
        this.running = false;
        this.paused = false;
        this.lastTime = 0;
        this.gameTime = DAY_START_HOUR * 60; // in game minutes
        this.realTimeAccum = 0;

        // Systems (initialized on start)
        this.city = null;
        this.camera = null;
        this.taxi = null;
        this.aiTaxis = [];
        this.passengerMgr = null;
        this.eventMgr = null;
        this.hazardMgr = null;
        this.renderer = null;
        this.hud = null;

        // Audio
        this.audio = new AudioManager();

        // Input
        this.keysDown = {};
        this._setupInput();
    }

    start() {
        // Generate city
        this.city = new City();

        // Create renderer
        this.renderer = new Renderer(this.canvas, this.minimapCanvas);

        // Create camera
        this.camera = new Camera(window.innerWidth, window.innerHeight);
        window.addEventListener('resize', () => {
            this.camera.resize(window.innerWidth, window.innerHeight);
        });

        // Create player taxi near home
        const home = this.city.getBuildingsOfType(BUILDING_TYPE.HOME)[0];
        const startPos = home ? this.city.getRoadNearBuilding(home) : this.city.getRandomRoadPosition();
        this.taxi = new Taxi(startPos.x, startPos.y);

        // Create AI taxis
        this.aiTaxis = [];
        for (let i = 0; i < MAX_AI_TAXIS; i++) {
            const pos = this.city.getRandomRoadPosition();
            this.aiTaxis.push(new AiTaxi(pos.x, pos.y, this.city));
        }

        // Create NPC traffic
        this.trafficMgr = new TrafficManager(this.city);

        // Create passenger manager
        this.passengerMgr = new PassengerManager(this.city);

        // Create event manager
        this.eventMgr = new EventManager(this.city, this.passengerMgr);

        // Create hazard manager
        this.hazardMgr = new HazardManager(this.city);

        // Create app order manager
        this.appOrderMgr = new AppOrderManager(this.city);

        // Weather system
        this.weather = new WeatherSystem();

        // Phone UI state
        this.showingPhone = false;

        // Day tracking for daily expenses
        this.lastExpenseDay = 1;

        // Realism state flags
        this._pendingPickup = null;
        this._tireWarned = false;
        this._blowoutNotified = false;
        this._fuelWarned = false;
        this._fatigueWarned60 = false;
        this._fatigueWarned85 = false;

        // Create HUD
        this.hud = new HUD();

        // Reset time
        this.gameTime = DAY_START_HOUR * 60;
        this.realTimeAccum = 0;

        // Init audio
        this.audio.init();
        this.audio.resume();

        // Start game loop
        this.running = true;
        this.paused = false;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this._loop(t));
    }

    _loop(timestamp) {
        if (!this.running) return;

        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); // cap dt
        this.lastTime = timestamp;

        if (!this.paused) {
            this._update(dt);
        }

        this._render(dt);
        requestAnimationFrame((t) => this._loop(t));
    }

    _update(dt) {
        // Update game time
        this.realTimeAccum += dt;
        this.gameTime += dt * TIME_SCALE;

        // Update weather & day/night
        this.weather.update(dt, this.gameTime);

        // Pass weather effects to taxi
        this.taxi.weatherGripMod = this.weather.gripMultiplier;
        this.taxi.weatherRainIntensity = this.weather.current === 'rain' ? this.weather.intensity : 0;

        // Day cycle
        if (this.gameTime >= 24 * 60) {
            this.gameTime -= 24 * 60;
            this.taxi.day++;
        }

        // Daily expenses at start of new day
        if (this.taxi.day > this.lastExpenseDay) {
            this.lastExpenseDay = this.taxi.day;
            const expenses = DAILY_INSURANCE + DAILY_PARKING_FEE + DAILY_PHONE_PLAN;
            this.taxi.money -= expenses;
            this.hazardMgr.addNotification(
                `📅 Day ${this.taxi.day}: Daily expenses -${formatMoney(expenses)} (Insurance, Parking, Phone)`,
                'warning'
            );
        }

        // Update taxi input
        this.taxi.keys.w = !!this.keysDown['w'] || !!this.keysDown['W'] || !!this.keysDown['ArrowUp'];
        this.taxi.keys.a = !!this.keysDown['a'] || !!this.keysDown['A'] || !!this.keysDown['ArrowLeft'];
        this.taxi.keys.s = !!this.keysDown['s'] || !!this.keysDown['S'] || !!this.keysDown['ArrowDown'];
        this.taxi.keys.d = !!this.keysDown['d'] || !!this.keysDown['D'] || !!this.keysDown['ArrowRight'];

        // Update taxi
        this.taxi.update(dt, this.city);

        // Handle resting at home
        if (this.taxi.isResting) {
            this.taxi.fatigue -= FATIGUE_REST_RATE * dt;
            if (this.taxi.fatigue <= 0) {
                this.taxi.fatigue = 0;
                this.taxi.isResting = false;
                this.hazardMgr.addNotification('😊 Fully rested! Ready to hit the road!', 'info');
            }
            this.hud.update(this.taxi, this.gameTime, this.hazardMgr, this.eventMgr, this.appOrderMgr, this.weather);
            this.camera.follow(this.taxi.x, this.taxi.y);
            return; // skip everything else while resting
        }

        // Update AI taxis
        for (const ai of this.aiTaxis) {
            ai.update(dt, this.passengerMgr.passengers);
        }

        // Update NPC traffic
        this.trafficMgr.update(dt, this.taxi);

        // Check AI-player collision
        for (const ai of this.aiTaxis) {
            this._checkVehicleCollision(ai, 'taxi');
        }

        // Check NPC-player collision
        for (const npc of this.trafficMgr.cars) {
            this._checkVehicleCollision(npc, 'car');
        }

        // Check bus-player collision
        for (const bus of this.trafficMgr.buses) {
            this._checkVehicleCollision(bus, 'bus');
        }

        // Check pedestrian collision (fine, no damage to car)
        this._checkPedestrianCollisions();

        // Update passengers
        this.passengerMgr.update(dt, this.taxi, this.aiTaxis);

        // Update events
        this.eventMgr.update(dt, this.gameTime);

        // Update hazards
        this.hazardMgr.update(dt, this.taxi);

        // Update app orders
        this.appOrderMgr.update(dt, this.taxi);

        // Check interaction with buildings
        this.taxi.nearBuilding = this.taxi.getInteractionBuilding(this.city);

        // Handle pending luggage pickup completion
        if (this._pendingPickup && !this.taxi.loadingLuggage && !this.taxi.hasPassenger) {
            const p = this._pendingPickup;
            if (p.active && !p.pickedUp) {
                p.pickedUp = true;
                this.taxi.passenger = p;
                this.taxi.hasPassenger = true;
                this.taxi.rideDamageTaken = 0;
                this.taxi.rideStartTime = this.gameTime;
                this.audio.playPickup();
                this.hazardMgr.addNotification(`🧳 Luggage loaded! Head to ${p.getDestinationName()}`, 'info');
            }
            this._pendingPickup = null;
        }

        // Track damage during ride for rating
        if (this.taxi.hasPassenger && this.taxi.flashTimer > 0) {
            this.taxi.rideDamageTaken += 1;
        }

        // Tire health warnings
        if (this.taxi.tireHealth < 20 && !this._tireWarned) {
            this._tireWarned = true;
            this.hazardMgr.addNotification('🛞 Tires very worn! Visit a mechanic soon.', 'warning');
        } else if (this.taxi.tireHealth >= 20) {
            this._tireWarned = false;
        }
        if (this.taxi.tireBlown && !this._blowoutNotified) {
            this._blowoutNotified = true;
            this.hazardMgr.addNotification('💥 TIRE BLOWOUT! Car pulling to one side. Get to a mechanic!', 'danger');
        } else if (!this.taxi.tireBlown) {
            this._blowoutNotified = false;
        }

        // Low fuel warning with nav suggestion
        const fuelPct = (this.taxi.fuel / this.taxi.fuelCapacity) * 100;
        if (fuelPct < 20 && !this._fuelWarned) {
            this._fuelWarned = true;
            this.hazardMgr.addNotification('⛽ Fuel low! Press 2 to navigate to nearest gas station.', 'warning');
        } else if (fuelPct >= 20) {
            this._fuelWarned = false;
        }
        // Auto-navigate to gas station when critically low
        if (fuelPct < 8 && !this.taxi.navTarget) {
            this._setNavTo(BUILDING_TYPE.GAS_STATION, '⛽ Gas Station');
            this.hazardMgr.addNotification('⛽ CRITICAL FUEL! Auto-navigating to gas station!', 'danger');
        }

        // Fatigue warnings
        if (this.taxi.fatigue > 85 && !this._fatigueWarned85) {
            this._fatigueWarned85 = true;
            this.hazardMgr.addNotification('😴 You are very tired! Go home and rest!', 'danger');
        } else if (this.taxi.fatigue <= 85) {
            this._fatigueWarned85 = false;
        }
        if (this.taxi.fatigue > 60 && !this._fatigueWarned60) {
            this._fatigueWarned60 = true;
            this.hazardMgr.addNotification('🥱 Getting tired... consider heading home. Press 1 for directions.', 'warning');
        } else if (this.taxi.fatigue <= 60) {
            this._fatigueWarned60 = false;
        }

        // At max fatigue, force slow down
        if (this.taxi.fatigue >= MAX_FATIGUE) {
            this.taxi.speed *= 0.95;
        }

        // Update engine audio
        this.audio.updateEngine(this.taxi.speed, this.taxi.maxSpeed);

        // Camera follow
        this.camera.follow(this.taxi.x, this.taxi.y);

        // Update HUD
        this.hud.update(this.taxi, this.gameTime, this.hazardMgr, this.eventMgr, this.appOrderMgr, this.weather);

        // Update phone UI if open
        if (this.showingPhone) {
            this._updatePhoneUI();
        }

        // Check car health - immobilize if totaled
        if (this.taxi.health <= 0) {
            this.taxi.health = 0;
            this.taxi.speed = 0;
            if (!this._towNotified) {
                this._towNotified = true;
                this.hazardMgr.addNotification('💀 Car totaled! Press T for emergency tow ($100) or visit a nearby mechanic.', 'danger');
            }
        } else {
            this._towNotified = false;
        }
    }

    _checkVehicleCollision(vehicle, label) {
        const pb = this.taxi.getBounds();
        const vb = vehicle.getBounds();
        if (rectsOverlap(pb.x, pb.y, pb.w, pb.h, vb.x, vb.y, vb.w, vb.h)) {
            if (this.taxi.invulnTimer <= 0) {
                const impactSpeed = Math.abs(this.taxi.speed) + Math.abs(vehicle.speed);
                if (impactSpeed > 40) {
                    const dmg = impactSpeed * 0.06;
                    this.taxi.takeDamage(dmg);
                    this.taxi.speed *= -0.3;
                    vehicle.speed *= -0.5;
                    this.taxi.invulnTimer = 1.5;
                    this.audio.playDamage();
                    this.hazardMgr.addNotification(`💥 Collision with a ${label}!`, 'danger');
                }
            }
        }
    }

    _checkPedestrianCollisions() {
        if (!this.trafficMgr || !this.trafficMgr.pedestrians) return;
        const pb = this.taxi.getBounds();
        for (let i = this.trafficMgr.pedestrians.length - 1; i >= 0; i--) {
            const ped = this.trafficMgr.pedestrians[i];
            const pedb = ped.getBounds();
            if (rectsOverlap(pb.x, pb.y, pb.w, pb.h, pedb.x, pedb.y, pedb.w, pedb.h)) {
                if (Math.abs(this.taxi.speed) > 15 && this.taxi.invulnTimer <= 0) {
                    this.taxi.money -= PEDESTRIAN_HIT_FINE;
                    this.taxi.totalFines++;
                    this.taxi.invulnTimer = 2.0;
                    this.taxi.speed *= 0.3;
                    this.hazardMgr.addNotification(`🚶 Hit a pedestrian! Fine: ${formatMoney(PEDESTRIAN_HIT_FINE)}`, 'danger');
                    this.audio.playFine();
                    // Remove the pedestrian
                    this.trafficMgr.pedestrians.splice(i, 1);
                    // Rating penalty
                    this.taxi.addRating(1);
                }
            }
        }
    }

    _render(dt) {
        this.renderer.render(
            this.camera,
            this.city,
            this.taxi,
            this.aiTaxis,
            this.trafficMgr,
            this.passengerMgr,
            this.hazardMgr,
            this.eventMgr,
            this.appOrderMgr,
            this.gameTime,
            dt,
            this.weather
        );
    }

    // Input handling
    _setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keysDown[e.key] = true;

            if (e.key === 'Escape') {
                e.preventDefault();
                if (this.running) this.togglePause();
            }

            if (!this.running || this.paused) return;

            if (e.key === ' ' || e.key === 'Space') {
                e.preventDefault();
                this._handlePickupDropoff();
            }

            if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                this._handleInteraction();
            }

            if (e.key === 'm' || e.key === 'M') {
                this.minimapCanvas.classList.toggle('large');
                // Re-size canvas
                const mm = this.minimapCanvas;
                mm.width = mm.clientWidth;
                mm.height = mm.clientHeight;
            }

            if ((e.key === 't' || e.key === 'T') && this.taxi && this.taxi.health <= 0) {
                this._emergencyTow();
            }

            if (e.key === 'h' || e.key === 'H') {
                this.audio.playHorn();
            }

            if (e.key === 'n' || e.key === 'N') {
                this.audio.toggle();
            }

            // Phone / App orders
            if (e.key === 'f' || e.key === 'F') {
                this._togglePhone();
            }

            // When phone is open: 1-3 accept orders
            // Otherwise: 1=Home, 2=Gas Station, 3=Mechanic, 4=Hospital, 0=Clear
            if (this.showingPhone) {
                if (e.key === '1') { this._acceptAppOrder(0); }
                if (e.key === '2') { this._acceptAppOrder(1); }
                if (e.key === '3') { this._acceptAppOrder(2); }
            } else {
                if (e.key === '1') {
                    this._setNavTo(BUILDING_TYPE.HOME, '🏡 Home');
                }
                if (e.key === '2') {
                    this._setNavTo(BUILDING_TYPE.GAS_STATION, '⛽ Gas Station');
                }
                if (e.key === '3') {
                    this._setNavTo(BUILDING_TYPE.MECHANIC, '🔧 Mechanic');
                }
                if (e.key === '4') {
                    this._setNavTo(BUILDING_TYPE.HOSPITAL, '🏥 Hospital');
                }
                if (e.key === '0') {
                    this.taxi.navTarget = null;
                    this.hazardMgr.addNotification('🧭 Navigation cleared', 'info');
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keysDown[e.key] = false;
        });
    }

    _handlePickupDropoff() {
        // Handle app order pickup
        const appOrder = this.appOrderMgr.acceptedOrder;
        if (appOrder && !appOrder.pickedUp && !this.taxi.hasPassenger) {
            const d = dist(this.taxi.x, this.taxi.y, appOrder.pickupX, appOrder.pickupY);
            if (d < TILE_SIZE * 2.5 && Math.abs(this.taxi.speed) < 30) {
                appOrder.pickedUp = true;
                this.taxi.hasPassenger = true;
                this.taxi.passenger = {
                    name: appOrder.customerName,
                    destX: appOrder.destX,
                    destY: appOrder.destY,
                    destination: appOrder.destBuilding,
                    type: 'app_order',
                    active: true,
                    pickedUp: true,
                    getDestinationName: () => BUILDING_ICONS[appOrder.destBuilding.type] + ' ' +
                        appOrder.destBuilding.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                };
                this.taxi.navTarget = { x: appOrder.destX, y: appOrder.destY, label: '📱 Drop-off' };
                this.audio.playPickup();
                this.hazardMgr.addNotification(`📱 Picked up ${appOrder.customerName}! Head to destination.`, 'info');
                this._updatePhoneUI();
                return;
            }
        }

        if (!this.taxi.hasPassenger) {
            // Try to pick up nearest street passenger
            const p = this.passengerMgr.getNearestPassenger(this.taxi.x, this.taxi.y);
            if (p && Math.abs(this.taxi.speed) < 30) {
                // VIP check: requires good car health
                if (p.isVIP && this.taxi.health < VIP_MIN_CAR_HEALTH) {
                    this.hazardMgr.addNotification(`🤵 VIP ${p.name} refuses your car — health too low!`, 'warning');
                    return;
                }
                // Luggage loading delay
                if (p.hasLuggage && !this.taxi.loadingLuggage) {
                    this.taxi.loadingLuggage = true;
                    this.taxi.luggageTimer = LUGGAGE_LOAD_TIME;
                    this.hazardMgr.addNotification(`🧳 Loading luggage...`, 'info');
                    // Mark pending so we pick up after loading
                    this._pendingPickup = p;
                    return;
                }
                p.pickedUp = true;
                this.taxi.passenger = p;
                this.taxi.hasPassenger = true;
                this.taxi.rideDamageTaken = 0;
                this.taxi.rideStartTime = this.gameTime;
                this._pendingPickup = null;
                this.audio.playPickup();
                let msg = p.isVIP ? `🤵 VIP ${p.name}` : `🧑 Picked up ${p.name}`;
                msg += `! Head to ${p.getDestinationName()}`;
                this.hazardMgr.addNotification(msg, 'info');
            }
        } else {
            // Try to drop off at destination
            const p = this.taxi.passenger;
            const d = dist(this.taxi.x, this.taxi.y, p.destX, p.destY);
            if (d < TILE_SIZE * 2.5 && Math.abs(this.taxi.speed) < 30) {
                if (p.type === 'app_order') {
                    // Complete app order
                    const result = this.appOrderMgr.completeOrder(this.taxi.fareBonus);
                    if (result) {
                        this.taxi.money += result.fare;
                        this.taxi.totalEarnings += result.fare;
                        this.taxi.totalFares++;
                        this.audio.playDropoff();
                        this.hazardMgr.addNotification(`📱 ${result.app} ride complete! +${formatMoney(result.fare)}`, 'info');
                    }
                    this.taxi.passenger = null;
                    this.taxi.hasPassenger = false;
                    this.taxi.navTarget = null;
                    this._updatePhoneUI();
                } else {
                    this._completeFare(p);
                }
            }
        }
    }

    _completeFare(passenger) {
        if (passenger.type === 'thief') {
            this.hazardMgr.handleThiefPassenger(this.taxi, passenger);
            this.audio.playDamage();
        } else {
            const fareMultiplier = this.weather.getFareMultiplier(this.gameTime);
            const result = passenger.calculateFare(this.taxi.fareBonus, fareMultiplier, this.taxi.rideDamageTaken);
            const total = result.fare + result.tip;

            if (result.message) {
                this.hazardMgr.addNotification(`😤 ${result.message}`, 'warning');
                this.audio.playFine();
            } else {
                let msg = `✅ Fare: ${formatMoney(result.fare)}`;
                if (result.tip > 0) msg += ` + Tip: ${formatMoney(result.tip)}`;
                const starStr = '⭐'.repeat(result.stars) + '☆'.repeat(5 - result.stars);
                msg += ` | ${starStr}`;
                if (fareMultiplier > 1) msg += ` (${fareMultiplier}x surge)`;
                this.hazardMgr.addNotification(msg, 'info');
                this.audio.playDropoff();
            }

            this.taxi.money += total;
            this.taxi.totalEarnings += total;

            // Update rating
            if (result.stars) {
                this.taxi.addRating(result.stars);
            }
        }

        this.taxi.totalFares++;
        passenger.active = false;
        this.taxi.passenger = null;
        this.taxi.hasPassenger = false;
    }

    _handleInteraction() {
        const building = this.taxi.nearBuilding;
        if (!building) return;
        if (Math.abs(this.taxi.speed) > 20) return;

        if (building.type === BUILDING_TYPE.GAS_STATION) {
            const price = building.fuelPrice || FUEL_COST_PER_LITER;
            const result = this.taxi.refuel(price);
            if (result.success) {
                this.audio.playRefuel();
                this.hazardMgr.addNotification(
                    `⛽ Refueled! Cost: ${formatMoney(result.cost)} ($${price.toFixed(2)}/L)`,
                    'info'
                );
            }
        } else if (building.type === BUILDING_TYPE.MECHANIC) {
            const result = this.taxi.repair();
            if (result.success) {
                this.audio.playRefuel();
                this.hazardMgr.addNotification(
                    `🔧 Car repaired! Cost: ${formatMoney(result.cost)}`,
                    'info'
                );
            }
            // Also offer tire replacement if worn
            if (this.taxi.tireHealth < 30) {
                const tireResult = this.taxi.replaceTires();
                if (tireResult.success) {
                    this.hazardMgr.addNotification(
                        `🛞 Tires replaced! Cost: ${formatMoney(tireResult.cost)}`,
                        'info'
                    );
                }
            }
        } else if (building.type === BUILDING_TYPE.HOME) {
            if (this.taxi.hasPassenger) {
                this.hazardMgr.addNotification('🚕 Drop off your passenger first!', 'warning');
                return;
            }
            if (this.taxi.fatigue < 10) {
                this.hazardMgr.addNotification('😊 You\'re not tired. Keep driving!', 'info');
                return;
            }
            this.taxi.isResting = true;
            this.taxi.speed = 0;
            this.hazardMgr.addNotification('🏡 Resting at home... Fatigue recovering.', 'info');
        }
    }

    _emergencyTow() {
        const towCost = 100;
        if (this.taxi.money < towCost) {
            this.hazardMgr.addNotification('💸 Not enough money for a tow! You need $100.', 'danger');
            return;
        }
        const mechanic = this.city.getNearestBuildingOfType(this.taxi.x, this.taxi.y, BUILDING_TYPE.MECHANIC);
        if (!mechanic) return;
        const roadPos = this.city.getRoadNearBuilding(mechanic);
        this.taxi.x = roadPos.x;
        this.taxi.y = roadPos.y;
        this.taxi.speed = 0;
        this.taxi.money -= towCost;
        this.taxi.health = 15; // Just enough to limp around
        this.hazardMgr.addNotification('🚛 Towed to mechanic! -$100. Press E to repair.', 'warning');
    }

    _setNavTo(buildingType, label) {
        const b = this.city.getNearestBuildingOfType(this.taxi.x, this.taxi.y, buildingType);
        if (b) {
            this.taxi.navTarget = { x: b.px, y: b.py, label: label };
            this.hazardMgr.addNotification(`🧭 Navigating to ${label}`, 'info');
        } else {
            this.hazardMgr.addNotification(`❌ No ${label} found!`, 'warning');
        }
    }

    _togglePhone() {
        this.showingPhone = !this.showingPhone;
        const phoneEl = document.getElementById('phone-panel');
        if (phoneEl) {
            if (this.showingPhone) {
                this._updatePhoneUI();
                phoneEl.classList.remove('hidden');
            } else {
                phoneEl.classList.add('hidden');
            }
        }
    }

    _updatePhoneUI() {
        const phoneEl = document.getElementById('phone-orders');
        if (!phoneEl) return;
        const orders = this.appOrderMgr.getActiveOrders();
        const accepted = this.appOrderMgr.acceptedOrder;

        let html = '';
        if (accepted) {
            html += `<div class="phone-order accepted">`;
            html += `<b>📱 ${accepted.app}</b> - ${accepted.customerName}<br>`;
            if (!accepted.pickedUp) {
                html += `Pick up: ${accepted.distBlocks} blocks away<br>`;
                html += `<small>Drive to the 📍 marker, press SPACE</small>`;
            } else {
                html += `Drop off at destination<br>`;
            }
            html += `<b>$${accepted.fare}</b></div>`;
        } else if (orders.length === 0) {
            html = '<div class="phone-empty">No orders right now...<br><small>Check back soon!</small></div>';
        } else {
            orders.forEach((o, i) => {
                html += `<div class="phone-order">`;
                html += `<b>📱 ${o.app}</b> - ${o.customerName}<br>`;
                html += `${o.distBlocks} blocks · <b>$${o.fare}</b>`;
                html += ` <span class="phone-timer">${Math.ceil(o.expireTimer)}s</span><br>`;
                html += `<small>Press ${i + 1} to accept</small>`;
                html += `</div>`;
            });
        }
        phoneEl.innerHTML = html;
    }

    _acceptAppOrder(index) {
        if (this.taxi.hasPassenger) {
            this.hazardMgr.addNotification('🚕 Finish current ride first!', 'warning');
            return;
        }
        if (this.appOrderMgr.hasAcceptedOrder()) {
            this.hazardMgr.addNotification('📱 Already have an active order!', 'warning');
            return;
        }
        const order = this.appOrderMgr.acceptOrder(index);
        if (order) {
            this.audio.playPickup();
            this.taxi.navTarget = { x: order.pickupX, y: order.pickupY, label: `📱 ${order.app} Pickup` };
            this.hazardMgr.addNotification(`📱 ${order.app} order accepted! Pick up ${order.customerName}.`, 'info');
            this._updatePhoneUI();
        }
    }

    togglePause() {
        this.paused = !this.paused;
        const pauseMenu = document.getElementById('pause-menu');
        const garageMenu = document.getElementById('garage-menu');
        const statsMenu = document.getElementById('stats-menu');

        if (this.paused) {
            pauseMenu.classList.remove('hidden');
            garageMenu.classList.add('hidden');
            statsMenu.classList.add('hidden');
        } else {
            pauseMenu.classList.add('hidden');
            garageMenu.classList.add('hidden');
            statsMenu.classList.add('hidden');
        }
    }

    showGarage() {
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('garage-menu').classList.remove('hidden');
        this._populateGarage();
    }

    _populateGarage() {
        const grid = document.getElementById('garage-grid');
        grid.innerHTML = '';

        for (const [key, upgrade] of Object.entries(UPGRADES)) {
            const level = this.taxi.upgradeLevels[key];
            const currentStats = upgrade.levels[level];
            const nextLevel = level < upgrade.levels.length - 1 ? upgrade.levels[level + 1] : null;
            const canUp = this.taxi.canUpgrade(key);

            const item = document.createElement('div');
            item.className = 'garage-item';

            let html = `<h4>${upgrade.icon} ${upgrade.name}</h4>`;
            html += `<p>Current: ${currentStats.desc} (Lvl ${level + 1}/${upgrade.levels.length})</p>`;

            if (nextLevel) {
                html += `<p>Next: ${nextLevel.desc}</p>`;
                html += `<button class="upgrade-btn" data-key="${key}" ${canUp.can ? '' : 'disabled'}>`;
                html += canUp.can ? `Upgrade - ${formatMoney(nextLevel.cost)}` : canUp.reason;
                html += `</button>`;
            } else {
                html += `<p style="color:#2ecc71">✅ MAX LEVEL</p>`;
            }

            item.innerHTML = html;
            grid.appendChild(item);
        }

        // Add repair option
        const repairItem = document.createElement('div');
        repairItem.className = 'garage-item';
        const repairCost = (this.taxi.maxHealth - this.taxi.health) * REPAIR_COST_PER_PERCENT;
        repairItem.innerHTML = `
            <h4>🔧 Full Repair</h4>
            <p>Car Health: ${Math.floor(this.taxi.health)}/${this.taxi.maxHealth}</p>
            <p>Cost: ${formatMoney(repairCost)}</p>
            <button class="upgrade-btn" data-action="repair" ${this.taxi.health >= this.taxi.maxHealth ? 'disabled' : ''}>
                ${this.taxi.health >= this.taxi.maxHealth ? 'Fully Repaired' : `Repair - ${formatMoney(repairCost)}`}
            </button>`;
        grid.appendChild(repairItem);

        // Add refuel option
        const refuelItem = document.createElement('div');
        refuelItem.className = 'garage-item';
        const refuelCost = (this.taxi.fuelCapacity - this.taxi.fuel) * FUEL_COST_PER_LITER;
        refuelItem.innerHTML = `
            <h4>⛽ Full Refuel</h4>
            <p>Fuel: ${Math.floor(this.taxi.fuel)}/${this.taxi.fuelCapacity}L</p>
            <p>Cost: ${formatMoney(refuelCost)}</p>
            <button class="upgrade-btn" data-action="refuel" ${this.taxi.fuel >= this.taxi.fuelCapacity ? 'disabled' : ''}>
                ${this.taxi.fuel >= this.taxi.fuelCapacity ? 'Tank Full' : `Refuel - ${formatMoney(refuelCost)}`}
            </button>`;
        grid.appendChild(refuelItem);

        // Bind upgrade buttons
        grid.querySelectorAll('.upgrade-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                const action = btn.dataset.action;
                if (key) {
                    this.taxi.doUpgrade(key);
                } else if (action === 'repair') {
                    this.taxi.repair();
                } else if (action === 'refuel') {
                    this.taxi.refuel();
                }
                this._populateGarage();
            });
        });
    }

    showStats() {
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('stats-menu').classList.remove('hidden');

        const content = document.getElementById('stats-content');
        const stats = [
            ['Money', formatMoney(this.taxi.money)],
            ['Total Earnings', formatMoney(this.taxi.totalEarnings)],
            ['Fares Completed', this.taxi.totalFares],
            ['Total Distance', this.taxi.totalKm.toFixed(1) + ' km'],
            ['Day', this.taxi.day],
            ['Car Health', Math.floor(this.taxi.health) + '/' + this.taxi.maxHealth],
            ['Fuel', Math.floor(this.taxi.fuel) + '/' + this.taxi.fuelCapacity + 'L'],
            ['Damage Events', this.taxi.totalDamageEvents],
            ['Fines Received', this.taxi.totalFines],
            ['Events Witnessed', this.eventMgr.eventHistory.length],
        ];

        content.innerHTML = stats.map(([label, val]) =>
            `<div class="stat-row"><span>${label}</span><span>${val}</span></div>`
        ).join('');
    }

    quit() {
        this.running = false;
        this.paused = false;
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('garage-menu').classList.add('hidden');
        document.getElementById('stats-menu').classList.add('hidden');
    }
}
