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
        this.challengeMgr = null;
        this.renderer = null;
        this.hud = null;

        // Audio
        this.audio = new AudioManager();

        // Floating text effects (fare cha-ching, etc.)
        this.floatingTexts = [];

        // Input
        this.keysDown = {};
        this._setupInput();
    }

    start(characterId, loadData) {
        // Stop any existing game loop
        this.running = false;

        this.characterId = characterId || 'mike';
        this.character = CHARACTERS.find(c => c.id === this.characterId) || CHARACTERS[0];
        this.saveSystem = new SaveLoadSystem();

        // Generate city (use saved seed if loading)
        const citySeed = loadData ? loadData.citySeed : undefined;
        this.city = new City(citySeed);
        this.citySeed = this.city.seed;

        // Create renderer
        this.renderer = new Renderer(this.canvas, this.minimapCanvas);

        // Create camera
        this.camera = new Camera(window.innerWidth, window.innerHeight);
        if (!this._resizeHandler) {
            this._resizeHandler = () => {
                if (this.camera) this.camera.resize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener('resize', this._resizeHandler);
        }

        // Create player taxi near home
        const home = this.city.getBuildingsOfType(BUILDING_TYPE.HOME)[0];
        const startPos = home ? this.city.getRoadNearBuilding(home) : this.city.getRandomRoadPosition();
        this.taxi = new Taxi(startPos.x, startPos.y);

        // Apply character bonuses
        this._applyCharacterBonuses();

        // Apply character starting money
        if (!loadData) {
            this.taxi.money = this.character.startingMoney;
        }

        // Create AI taxis
        this.aiTaxis = [];
        for (let i = 0; i < MAX_AI_TAXIS; i++) {
            const pos = this.city.getRandomRoadPosition();
            this.aiTaxis.push(new AiTaxi(pos.x, pos.y, this.city));
        }

        // Rivalry tracking
        this._rivalryData = {};
        for (const ai of this.aiTaxis) {
            if (!this._rivalryData[ai.companyName]) {
                this._rivalryData[ai.companyName] = { earnings: 0, fares: 0, color: ai.companyColor };
            }
        }

        // Create NPC traffic
        this.trafficMgr = new TrafficManager(this.city);

        // Create passenger manager
        this.passengerMgr = new PassengerManager(this.city);

        // Create event manager
        this.eventMgr = new EventManager(this.city, this.passengerMgr);

        // Create challenge manager
        this.challengeMgr = new ChallengeManager();

        // Create hazard manager
        this.hazardMgr = new HazardManager(this.city);
        this.hazardMgr.setChallengeManager(this.challengeMgr);

        // Create app order manager
        this.appOrderMgr = new AppOrderManager(this.city);

        // Create GPS system
        this.gps = new GPSRouteSystem(this.city);

        this.police = null; // Police patrol system disabled — was blocking gameplay

        // Create radio system
        this.radio = new RadioSystem();

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
        this._pullOverNotified = false;

        // Gradual refueling state
        this._isRefueling = false;
        this._refuelPrice = 0;
        this._refuelTotalCost = 0;

        // Create HUD
        this.hud = new HUD();

        // Create Home Screen
        this.homeScreen = new HomeScreen();

        // Reset time
        this.gameTime = DAY_START_HOUR * 60;
        this.realTimeAccum = 0;

        // Snap camera to taxi immediately (no smooth lag on start)
        this.camera.snapTo(this.taxi.x, this.taxi.y);

        // Init audio
        this.audio.init();
        this.audio.resume();

        // Tutorial — only on first new game (not on load)
        const tutorialDone = localStorage.getItem('taxi_tutorial_done');
        this._tutorial = (!loadData && !tutorialDone) ? { step: 0, delay: 3 } : null;

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

        // Night visibility: 10% speed reduction at night unless sunglasses equipped
        const hasSunglasses = this.taxi.personalItems && this.taxi.personalItems.sunglasses;
        this.taxi.nightSpeedMod = (this.weather.isNight() && !hasSunglasses) ? 0.90 : 1.0;

        // Day cycle
        if (this.gameTime >= 24 * 60) {
            this.gameTime -= 24 * 60;
            this.taxi.day++;
            this._dayStartDamage = this.taxi.totalDamageEvents || 0;
            // Auto-save on day transition
            this.saveGame('auto');
            this.hazardMgr.addNotification('💾 Auto-saved', 'success');
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

        // Debt floor — clamp money and warn player
        if (this.taxi.money < MAX_DEBT) {
            this.taxi.money = MAX_DEBT;
        }
        if (this.taxi.money < 0 && !this._debtWarned) {
            this._debtWarned = true;
            this.hazardMgr.addNotification(`💸 You're in debt! Earn fares to recover. Max debt: ${formatMoney(MAX_DEBT)}`, 'danger');
        } else if (this.taxi.money >= 0) {
            this._debtWarned = false;
        }

        // Update taxi input
        this.taxi.keys.w = !!this.keysDown['w'] || !!this.keysDown['W'] || !!this.keysDown['ArrowUp'];
        this.taxi.keys.a = !!this.keysDown['a'] || !!this.keysDown['A'] || !!this.keysDown['ArrowLeft'];
        this.taxi.keys.s = !!this.keysDown['s'] || !!this.keysDown['S'] || !!this.keysDown['ArrowDown'];
        this.taxi.keys.d = !!this.keysDown['d'] || !!this.keysDown['D'] || !!this.keysDown['ArrowRight'];

        // Update taxi
        const prevKm = this.taxi.totalKm;
        this.taxi.update(dt, this.city);
        const kmDriven = this.taxi.totalKm - prevKm;
        if (kmDriven > 0) this.taxi.currentDayKm += kmDriven;

        // Update challenges - distance driven
        if (this.challengeMgr && kmDriven > 0) {
            // Convert km to blocks (roughly 1 block = 0.05 km)
            const blocksDriven = kmDriven / 0.05;
            this.challengeMgr.updateProgress('drive_blocks', blocksDriven, this);
        }

        // Handle resting at home
        if (this.taxi.isResting) {
            const bedMod = (this.taxi.personalItems && this.taxi.personalItems.better_bed) ? 1.5 : 1.0;
            this.taxi.fatigue -= FATIGUE_REST_RATE * bedMod * dt;
            if (this.taxi.fatigue <= 0) {
                this.taxi.fatigue = 0;
                this.taxi.isResting = false;
                this.hazardMgr.addNotification('😊 Fully rested! Ready to hit the road!', 'info');
            }
            this.hud.update(this.taxi, this.gameTime, this.hazardMgr, this.eventMgr, this.appOrderMgr, this.weather, this.radio);
            this.camera.follow(this.taxi.x, this.taxi.y, dt);
            return; // skip everything else while resting
        }

        // Update AI taxis
        for (const ai of this.aiTaxis) {
            ai.update(dt, this.passengerMgr.passengers);
        }

        // Sync AI rivalry data
        for (const ai of this.aiTaxis) {
            if (this._rivalryData[ai.companyName]) {
                this._rivalryData[ai.companyName].earnings = ai.totalEarnings;
                this._rivalryData[ai.companyName].fares = ai.totalFares;
            }
        }

        // Update NPC traffic
        this.trafficMgr.update(dt, this.taxi, this.hazardMgr);

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

        // Troublemaker confirm timer decay
        if (this._troubleConfirmTimer > 0) {
            this._troubleConfirmTimer -= dt;
            if (this._troubleConfirmTimer <= 0) {
                this._troubleConfirmed = null;
            }
        }

        // Passenger proximity audio ping (cooldown-gated)
        if (!this.taxi.hasPassenger) {
            this._passengerPingCooldown = (this._passengerPingCooldown || 0) - dt;
            const nearest = this.passengerMgr.getNearestPassenger(this.taxi.x, this.taxi.y, TILE_SIZE * 3);
            if (nearest && this._passengerPingCooldown <= 0) {
                this.audio.playPassengerNearby();
                this._passengerPingCooldown = 4; // seconds between pings
            }
        }

        // First-fare tutorial
        if (this._tutorial) {
            this._tutorial.delay -= dt;
            if (this._tutorial.delay <= 0) {
                const t = this._tutorial;
                if (t.step === 0) {
                    this.hazardMgr.addNotification('🎓 Use W/S to drive, A/D to steer. Find passengers on sidewalks!', 'info');
                    t.step = 1;
                } else if (t.step === 1 && !this.taxi.hasPassenger) {
                    const near = this.passengerMgr.getNearestPassenger(this.taxi.x, this.taxi.y, TILE_SIZE * 4);
                    if (near) {
                        this.hazardMgr.addNotification('🎓 Passenger nearby! Slow down and press SPACE to pick them up.', 'info');
                        t.step = 2;
                    }
                } else if (t.step === 2 && this.taxi.hasPassenger) {
                    this.hazardMgr.addNotification('🎓 Great! Follow the green arrow to the destination.', 'info');
                    t.step = 3;
                } else if (t.step === 3 && !this.taxi.hasPassenger && this.taxi.totalFares > 0) {
                    this.hazardMgr.addNotification('🎓 First fare complete! Press G to navigate, ESC for upgrades. You got this!', 'info');
                    this._tutorial = null;
                    localStorage.setItem('taxi_tutorial_done', '1');
                }
            }
        }

        // Update events
        this.eventMgr.update(dt, this.gameTime);

        // Show event notification popup when a new event triggers
        const eventNotif = this.eventMgr.popEventNotification();
        if (eventNotif) {
            this.hazardMgr.addNotification(eventNotif, 'info');
            // Auto-navigate to event building if no passenger
            if (!this.taxi.hasPassenger) {
                const eventBuilding = this.eventMgr.getActiveEventBuilding();
                if (eventBuilding) {
                    this.taxi.navTarget = {
                        x: eventBuilding.px,
                        y: eventBuilding.py,
                        label: eventBuilding.name || 'Event',
                    };
                }
            }
        }

        // Update hazards
        this.hazardMgr.update(dt, this.taxi);

        // Update app orders
        this.appOrderMgr.update(dt, this.taxi);

        // Update radio system
        this.radio.update(dt);

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
                this.taxi.rideRealStartTime = Date.now() / 1000;
                this.taxi.rideWaitTime = (Date.now() / 1000) - (p.spawnTime || 0);
                this.audio.playPickup();
                
                // Calculate GPS route to destination
                if (this.gps) {
                    this.gps.calculateRoute(this.taxi.x, this.taxi.y, p.destX, p.destY);
                }
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

        // Gradual refueling while E is held at gas station
        if (this._isRefueling) {
            const building = this.taxi.nearBuilding;
            const eHeld = this.keysDown['e'] || this.keysDown['E'];
            if (!eHeld || !building || building.type !== BUILDING_TYPE.GAS_STATION || Math.abs(this.taxi.speed) > 5) {
                // Stop refueling
                if (this._refuelTotalCost > 0) {
                    this.hazardMgr.addNotification(`⛽ Refueled! Total: ${formatMoney(this._refuelTotalCost)}`, 'info');
                }
                this._isRefueling = false;
                this._refuelTotalCost = 0;
            } else if (this.taxi.fuel < this.taxi.fuelCapacity && this.taxi.money > 0) {
                // Fill at rate: full tank in ~10 seconds
                const fillRate = (this.taxi.fuelCapacity / 10) * dt;
                const canAfford = this.taxi.money / this._refuelPrice;
                const needed = this.taxi.fuelCapacity - this.taxi.fuel;
                const toAdd = Math.min(fillRate, canAfford, needed);
                const cost = toAdd * this._refuelPrice;
                this.taxi.fuel += toAdd;
                this.taxi.money -= cost;
                this._refuelTotalCost += cost;
                this.taxi.speed = 0; // keep car still while refueling
            } else {
                // Tank full or out of money
                if (this._refuelTotalCost > 0) {
                    this.hazardMgr.addNotification(`⛽ Tank ${this.taxi.fuel >= this.taxi.fuelCapacity ? 'full' : 'refueled'}! Total: ${formatMoney(this._refuelTotalCost)}`, 'info');
                }
                this._isRefueling = false;
                this._refuelTotalCost = 0;
            }
        }

        // Update engine audio
        this.audio.updateEngine(this.taxi.speed, this.taxi.maxSpeed);

        // Camera follow
        this.camera.follow(this.taxi.x, this.taxi.y, dt);

        // Update earnings per hour tracking
        this.taxi.updateEarningsPerHour();

        // Update HUD
        this.hud.update(this.taxi, this.gameTime, this.hazardMgr, this.eventMgr, this.appOrderMgr, this.weather, this.radio);

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

        // Milestone checks (every 5 seconds)
        this._milestoneTimer = (this._milestoneTimer || 0) - dt;
        if (this._milestoneTimer <= 0) {
            this._milestoneTimer = 5;
            this._checkMilestones();
        }

        // Update floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.life -= dt;
            ft.y -= 40 * dt; // float upward
            ft.alpha = Math.max(0, ft.life / ft.maxLife);
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    _addFloatingText(text, x, y, color) {
        this.floatingTexts.push({ text, x, y, color, life: 1.5, maxLife: 1.5, alpha: 1 });
    }

    _checkMilestones() {
        if (!this._unlockedMilestones) {
            try {
                this._unlockedMilestones = JSON.parse(localStorage.getItem('taxi_milestones') || '[]');
            } catch (e) { this._unlockedMilestones = []; }
        }
        for (const m of MILESTONES) {
            if (this._unlockedMilestones.includes(m.id)) continue;
            if (m.check(this.taxi, this)) {
                this._unlockedMilestones.push(m.id);
                localStorage.setItem('taxi_milestones', JSON.stringify(this._unlockedMilestones));
                this.hazardMgr.addNotification(`${m.icon} Achievement: ${m.name} — ${m.desc}`, 'success');
                this.audio.playEvent();
            }
        }
    }

    _checkVehicleCollision(vehicle, label) {
        const pb = this.taxi.getBounds();
        const vb = vehicle.getBounds();
        if (rectsOverlap(pb.x, pb.y, pb.w, pb.h, vb.x, vb.y, vb.w, vb.h)) {
            if (this.taxi.invulnTimer <= 0) {
                const impactSpeed = Math.abs(this.taxi.speed) + Math.abs(vehicle.speed || 0);
                if (impactSpeed > 20) {
                    // Damage scales with collision violence:
                    // - Low speed tap (20-60): minor scratch (1-4 dmg)
                    // - Medium hit (60-120): moderate dent (4-10 dmg)
                    // - High speed crash (120+): severe (10-25+ dmg)
                    const severity = Math.pow(impactSpeed / 60, 1.8);
                    const dmg = Math.min(severity * 3, 40);
                    this.taxi.takeDamage(dmg);
                    // Bounce proportional to speed
                    this.taxi.speed *= -0.3;
                    vehicle.speed *= -0.5;
                    this.taxi.invulnTimer = 1.5;
                    this.audio.playDamage();
                    // Screen shake proportional to impact
                    const shakeForce = Math.min(impactSpeed / 15, 12);
                    this.camera.shake(shakeForce, 0.4);
                    if (impactSpeed > 100) {
                        this.hazardMgr.addNotification(`💥 Heavy crash with a ${label}! -${Math.round(dmg)} HP`, 'danger');
                    } else {
                        this.hazardMgr.addNotification(`💥 Collision with a ${label}! -${Math.round(dmg)} HP`, 'danger');
                    }
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
                    this.taxi.currentDayFines++;
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
        this.renderer.minimapMode = this.minimapMode || 0;
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
            this.weather,
            this.gps,
            this.police
        );

        // Draw floating texts on top
        if (this.floatingTexts.length > 0) {
            const ctx = this.canvas.getContext('2d');
            const cam = this.camera;
            for (const ft of this.floatingTexts) {
                const sx = ft.x - cam.x;
                const sy = ft.y - cam.y;
                ctx.save();
                ctx.globalAlpha = ft.alpha;
                ctx.font = 'bold 18px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = ft.color;
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 3;
                ctx.strokeText(ft.text, sx, sy);
                ctx.fillText(ft.text, sx, sy);
                ctx.restore();
            }
        }
    }

    // Input handling
    _setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keysDown[e.key] = true;

            if (e.key === 'Escape') {
                e.preventDefault();
                if (this.running) this.togglePause();
            }

            // Controls overlay — works even when paused
            if (e.key === '?' || e.key === 'F1') {
                e.preventDefault();
                const overlay = document.getElementById('controls-overlay');
                if (overlay) overlay.classList.toggle('hidden');
                return;
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
                // Cycle: small → large → zoomed → hidden → small
                this.minimapMode = ((this.minimapMode || 0) + 1) % 4;
                const mm = this.minimapCanvas;
                mm.classList.remove('large', 'zoomed');
                if (this.minimapMode === 0) {
                    mm.style.display = '';
                } else if (this.minimapMode === 1) {
                    mm.classList.add('large');
                    mm.style.display = '';
                } else if (this.minimapMode === 2) {
                    mm.classList.add('zoomed');
                    mm.style.display = '';
                } else {
                    mm.style.display = 'none';
                }
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

            // Radio controls: . for next station, , for previous
            if (e.key === '.' || e.key === '>') {
                if (this.radio) {
                    const stationInfo = this.radio.changeStation(1);
                    this.hazardMgr.addNotification(`📻 ${stationInfo.name} - ${stationInfo.genre}`, 'info');
                }
            }
            
            if (e.key === ',' || e.key === '<') {
                if (this.radio) {
                    const stationInfo = this.radio.changeStation(-1);
                    this.hazardMgr.addNotification(`📻 ${stationInfo.name} - ${stationInfo.genre}`, 'info');
                }
            }
            
            if (e.key === 'x' || e.key === 'X') {
                if (this.radio) {
                    const enabled = this.radio.toggle();
                    this.hazardMgr.addNotification(`📻 Radio ${enabled ? 'ON' : 'OFF'}`, 'info');
                }
            }

            // Center camera on taxi
            if (e.key === 'c' || e.key === 'C') {
                this.camera.snapTo(this.taxi.x, this.taxi.y);
            }

            // Toggle GPS route
            if (e.key === 'r' || e.key === 'R') {
                if (this.gps) {
                    const enabled = this.gps.toggle();
                    this.hazardMgr.addNotification(`🗺️ GPS route ${enabled ? 'enabled' : 'disabled'}`, 'info');
                    
                    // Recalculate route if enabling and has passenger
                    if (enabled && this.taxi.hasPassenger && this.taxi.passenger) {
                        const p = this.taxi.passenger;
                        this.gps.calculateRoute(this.taxi.x, this.taxi.y, p.destX, p.destY);
                    }
                }
            }

            // Phone / App orders
            if (e.key === 'f' || e.key === 'F') {
                this._togglePhone();
            }

            // "Take me to..." navigation menu
            if (e.key === 'g' || e.key === 'G') {
                this._toggleNavMenu();
            }

            // When phone is open: 1-3 accept orders (no conflict with nav)
            if (this.showingPhone) {
                if (e.key === '1') { this._acceptAppOrder(0); }
                if (e.key === '2') { this._acceptAppOrder(1); }
                if (e.key === '3') { this._acceptAppOrder(2); }
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
                this.taxi.rideDamageTaken = 0;
                this.taxi.rideStartTime = this.gameTime;
                this.taxi.rideRealStartTime = Date.now() / 1000;
                this.taxi.rideWaitTime = 0;
                this.taxi.passenger = {
                    name: appOrder.customerName,
                    destX: appOrder.destX,
                    destY: appOrder.destY,
                    destination: appOrder.destBuilding,
                    type: 'app_order',
                    active: true,
                    pickedUp: true,
                    spawnX: appOrder.pickupX,
                    spawnY: appOrder.pickupY,
                    getDestinationName: () => BUILDING_ICONS[appOrder.destBuilding.type] + ' ' +
                        appOrder.destBuilding.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                };
                this.taxi.navTarget = { x: appOrder.destX, y: appOrder.destY, label: '📱 Drop-off' };
                this.audio.playPickup();
                this.hazardMgr.addNotification(`📱 Picked up ${appOrder.customerName}! Head to destination.`, 'info');
                
                // Calculate GPS route to destination
                if (this.gps) {
                    this.gps.calculateRoute(this.taxi.x, this.taxi.y, appOrder.destX, appOrder.destY);
                }
                
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
                // Troublemaker warning — first press shows warning, second press confirms
                if (p.type === 'troublemaker' && !this._troubleConfirmed) {
                    this._troubleConfirmed = p;
                    this._troubleConfirmTimer = 3; // 3 seconds to press again
                    this.hazardMgr.addNotification(`😤 ${p.name} looks like trouble! Press SPACE again to pick up, or drive away.`, 'warning');
                    return;
                }
                this._troubleConfirmed = null;
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
                this.taxi.rideRealStartTime = Date.now() / 1000;
                this.taxi.rideWaitTime = (Date.now() / 1000) - (p.spawnTime || 0);
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
                    const phoneMountBonus = (this.taxi.personalItems && this.taxi.personalItems.phone_mount) ? 1.15 : 1.0;
                    const result = this.appOrderMgr.completeOrder(this.taxi.fareBonus * phoneMountBonus);
                    if (result) {
                        this.taxi.money += result.fare;
                        this.taxi.totalEarnings += result.fare;
                        this.taxi.totalFares++;
                        this.audio.playDropoff();
                        this.audio.playMoney();
                        this._addFloatingText(`+${formatMoney(result.fare)}`, this.taxi.x, this.taxi.y - 30, '#FFD700');
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

    _getFareBonus() {
        let bonus = this.getCharacterBonus('fareBonus');
        const hour = this.gameTime / 60;
        bonus *= (hour >= 20 || hour < 6)
            ? this.getCharacterBonus('nightFareBonus')
            : this.getCharacterBonus('dayFarePenalty');
        return this.taxi.fareBonus * bonus;
    }

    _applyTipBonuses(result) {
        // Lucky dice: bonus 15% tip chance if no tip was given
        if (result.tip === 0 && this.taxi.personalItems && this.taxi.personalItems.lucky_dice) {
            if (Math.random() < 0.15) result.tip = rand(TIP_RANGE[0], TIP_RANGE[1]);
        }
        // Character tipAmount modifier
        const charTipMult = this.getCharacterBonus('tipAmount');
        if (charTipMult !== 1.0) result.tip = Math.round(result.tip * charTipMult);
        // Charisma (character) + negotiation (trained) boost
        const charismaLvl = (this.taxi.skills && this.taxi.skills.charisma) || 0;
        const negotiationLvl = (this.taxi.trainedSkills && this.taxi.trainedSkills.negotiation) || 0;
        const tipSkillBonus = (charismaLvl > 0.5 ? (charismaLvl - 0.5) * 0.3 : 0) + negotiationLvl * 0.10;
        if (tipSkillBonus > 0) result.tip = Math.round(result.tip * (1 + tipSkillBonus));
    }

    _completeFare(passenger) {
        if (passenger.type === 'thief') {
            this.hazardMgr.handleThiefPassenger(this.taxi, passenger);
            this.audio.playDamage();
        } else {
            const fareMultiplier = this.weather.getFareMultiplier(this.gameTime);
            const rideStats = this.taxi.getRideStats();
            const result = passenger.calculateFare(this._getFareBonus(), fareMultiplier, this.taxi.rideDamageTaken, rideStats.rideTime, rideStats.waitTime, rideStats.avgSpeed);
            this._applyTipBonuses(result);
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
                
                // Show passenger feedback
                if (result.feedback) {
                    setTimeout(() => {
                        this.hazardMgr.addNotification(`💬 "${result.feedback}" - ${passenger.name}`, result.stars >= 4 ? 'success' : 'warning');
                    }, 1000);
                }
                
                this.audio.playDropoff();
            }

            this.taxi.money += total;
            this.taxi.totalEarnings += total;
            this.audio.playMoney();
            this._addFloatingText(`+${formatMoney(total)}`, this.taxi.x, this.taxi.y - 30, total >= 50 ? '#FFD700' : '#2ecc71');

            // Track daily earnings
            this.taxi.currentDayEarnings += total;
            this.taxi.currentDayFares++;
            if (total > this.taxi.currentDayTopFare) this.taxi.currentDayTopFare = total;

            // Update challenges - earnings
            if (this.challengeMgr) {
                this.challengeMgr.updateProgress('earn_before_time', total, this);
            }

            // Update rating
            if (result.stars) {
                this.taxi.addRating(result.stars);
            }
        }

        this.taxi.totalFares++;
        passenger.active = false;
        this.taxi.passenger = null;
        this.taxi.hasPassenger = false;

        // Clear GPS route when passenger is dropped off
        if (this.gps) {
            this.gps.clearRoute();
        }

        // Reset ride statistics
        this.taxi.resetRideStats();

        // Update challenges
        if (this.challengeMgr) {
            // Fares completed challenge
            this.challengeMgr.updateProgress('fares_no_damage', 1, this);
            
            // VIP passengers challenge
            if (passenger.isVIP) {
                this.challengeMgr.updateProgress('vip_passengers', 1, this);
            }
            
            // Perfect rating challenge
            if (result.stars && result.stars >= 5) {
                this.challengeMgr.updateProgress('perfect_rating', 1, this);
            }
            
            // Night driver challenge
            const hour = (this.gameTime / 60) % 24;
            if (hour >= 22 || hour < 5) {
                this.challengeMgr.updateProgress('night_driver', 1, this);
            }
        }
    }

    _handleInteraction() {
        const building = this.taxi.nearBuilding;
        if (!building) return;
        if (Math.abs(this.taxi.speed) > 20) return;

        if (building.type === BUILDING_TYPE.GAS_STATION) {
            if (this.taxi.fuel >= this.taxi.fuelCapacity) {
                this.hazardMgr.addNotification('⛽ Tank is already full!', 'info');
                return;
            }
            // Start gradual refueling (hold E to continue)
            this._isRefueling = true;
            this._refuelPrice = building.fuelPrice || FUEL_COST_PER_LITER;
            this._refuelTotalCost = 0;
            this.audio.playRefuel();
            this.hazardMgr.addNotification(`⛽ Hold E to refuel ($${this._refuelPrice.toFixed(2)}/L)...`, 'info');
            return;
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
            this.taxi.speed = 0;
            this.homeScreen.show(this);
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
        const charRepairMod = this.getCharacterBonus('repairCost');
        const repairCost = (this.taxi.maxHealth - this.taxi.health) * REPAIR_COST_PER_PERCENT * charRepairMod;
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
            ['', ''],
            ['--- Today ---', ''],
            ['Current Day Earnings', formatMoney(this.taxi.currentDayEarnings || 0)],
            ['Earnings/Hour', formatMoney(this.taxi.earningsPerHour || 0) + '/hr'],
            ['Best Fare Today', formatMoney(this.taxi.currentDayTopFare || 0)],
            ['Avg Earnings/Day', this.taxi.day > 1 ? formatMoney(this.taxi.totalEarnings / (this.taxi.day - 1)) : 'N/A'],
            ['City Seed', this.citySeed || 'N/A'],
        ];

        stats.push(['', '']); // spacer
        stats.push(['--- Rival Companies ---', '']);
        if (this._rivalryData) {
            for (const [name, data] of Object.entries(this._rivalryData)) {
                stats.push([`\uD83D\uDE95 ${name}`, `${formatMoney(data.earnings)} (${data.fares} fares)`]);
            }
        }

        // Milestones section
        stats.push(['', '']);
        stats.push(['--- Achievements ---', '']);
        const unlocked = this._unlockedMilestones || [];
        for (const m of MILESTONES) {
            const done = unlocked.includes(m.id);
            stats.push([`${m.icon} ${m.name}`, done ? '✅' : m.desc]);
        }

        content.innerHTML = stats.map(([label, val]) =>
            `<div class="stat-row"><span>${label}</span><span>${val}</span></div>`
        ).join('');
    }

    _toggleNavMenu() {
        const navEl = document.getElementById('nav-menu');
        if (!navEl) return;
        if (!navEl.classList.contains('hidden')) {
            navEl.classList.add('hidden');
            return;
        }
        const destinations = [
            { type: BUILDING_TYPE.HOME, label: '🏡 Home', key: '1' },
            { type: BUILDING_TYPE.GAS_STATION, label: '⛽ Gas Station', key: '2' },
            { type: BUILDING_TYPE.MECHANIC, label: '🔧 Mechanic', key: '3' },
            { type: BUILDING_TYPE.HOSPITAL, label: '🏥 Hospital', key: '4' },
            { type: BUILDING_TYPE.MALL, label: '🛒 Mall', key: '5' },
            { type: BUILDING_TYPE.POLICE, label: '🚔 Police', key: '6' },
        ];
        let html = '<div id="nav-menu-header">🧭 Take me to... <small>(G to close)</small></div>';
        for (const d of destinations) {
            const b = this.city.getNearestBuildingOfType(this.taxi.x, this.taxi.y, d.type);
            const distBlocks = b ? Math.round(dist(this.taxi.x, this.taxi.y, b.px, b.py) / TILE_SIZE) : '?';
            html += `<div class="nav-menu-item" data-type="${d.type}" data-label="${d.label}">
                <span>${d.label}</span>
                <span class="nav-menu-dist">${distBlocks} blocks</span>
            </div>`;
        }
        html += `<div class="nav-menu-item nav-menu-clear" data-action="clear">
            <span>❌ Clear Navigation</span>
        </div>`;
        navEl.innerHTML = html;
        navEl.classList.remove('hidden');

        // Bind click events
        navEl.querySelectorAll('.nav-menu-item').forEach(item => {
            item.style.pointerEvents = 'all';
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                if (item.dataset.action === 'clear') {
                    this.taxi.navTarget = null;
                    this.hazardMgr.addNotification('🧭 Navigation cleared', 'info');
                } else {
                    this._setNavTo(item.dataset.type, item.dataset.label);
                }
                navEl.classList.add('hidden');
            });
        });
    }

    _applyCharacterBonuses() {
        if (!this.character || !this.taxi) return;
        
        // Store character modifiers on taxi for use in game systems
        this.taxi.characterBonuses = {};
        
        for (const bonus of this.character.bonuses) {
            this.taxi.characterBonuses[bonus.stat] = bonus.mult;
        }
        for (const weakness of this.character.weaknesses) {
            this.taxi.characterBonuses[weakness.stat] = weakness.mult;
        }

        // Set character skills on taxi (used by taxi.update for fatigue, tire wear etc.)
        this.taxi.skills = this.character.skills;
    }

    getCharacterBonus(stat) {
        if (!this.taxi || !this.taxi.characterBonuses) return 1.0;
        return this.taxi.characterBonuses[stat] || 1.0;
    }

    saveGame(slotIndex) {
        if (!this.saveSystem || !this.taxi) return false;
        return this.saveSystem.save(slotIndex, {
            characterId: this.characterId,
            taxi: this.taxi,
            gameTime: this.gameTime,
            citySeed: this.citySeed
        });
    }

    loadSavedData(saveData) {
        this.saveSystem.applyToGame(saveData, this.taxi, this);
    }

    quit() {
        this.running = false;
        this.paused = false;
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('garage-menu').classList.add('hidden');
        document.getElementById('stats-menu').classList.add('hidden');
        document.getElementById('save-screen').classList.add('hidden');
        if (this.homeScreen) this.homeScreen.hide();
    }
}
