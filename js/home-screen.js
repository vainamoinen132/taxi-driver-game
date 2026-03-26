// ============================================================
// HOME SCREEN - Extracted from game.js
// ============================================================

class HomeScreen {
    constructor() {
        this.overlay = document.getElementById('home-screen');
    }

    show(game, activeTab) {
        game.paused = true;
        if (!this.overlay) return;

        // Initialize personal items if not set
        if (!game.taxi.personalItems) {
            game.taxi.personalItems = {};
        }

        const currentTab = activeTab || 'summary';

        // Tab definitions
        const tabs = [
            { id: 'summary', label: '📊 Summary', icon: '📊' },
            { id: 'skills', label: '📚 Skills', icon: '📚' },
            { id: 'shop', label: '🛒 Shop', icon: '🛒' },
            { id: 'garage', label: '🚗 Garage', icon: '🚗' },
            { id: 'upgrades', label: '🔧 Upgrades', icon: '🔧' },
        ];

        let tabBarHtml = '<div class="home-tab-bar">';
        for (const tab of tabs) {
            tabBarHtml += `<button class="home-tab ${currentTab === tab.id ? 'home-tab-active' : ''}" data-tab="${tab.id}">${tab.label}</button>`;
        }
        tabBarHtml += '</div>';

        let contentHtml = '';

        if (currentTab === 'summary') {
            contentHtml = this._renderSummary(game);
        } else if (currentTab === 'skills') {
            contentHtml = this._renderSkills(game);
        } else if (currentTab === 'shop') {
            contentHtml = this._renderShop(game);
        } else if (currentTab === 'garage') {
            contentHtml = this._renderGarage(game);
        } else if (currentTab === 'upgrades') {
            contentHtml = this._renderUpgrades(game);
        }

        this.overlay.innerHTML = `
            <div class="overlay-content wide home-content">
                <h2>🏡 Home — Day ${game.taxi.day}</h2>
                <div style="text-align:center;color:#f5c518;font-size:0.9rem;margin-bottom:8px">Balance: <b>${formatMoney(game.taxi.money)}</b></div>
                ${tabBarHtml}
                <div class="home-tab-content">${contentHtml}</div>
                <div class="home-actions">
                    <button class="menu-btn" id="home-rest-btn">😴 Rest & Sleep</button>
                    <button class="menu-btn" id="home-repair-btn">🔧 Repair Car</button>
                    <button class="menu-btn" id="home-refuel-btn">⛽ Refuel</button>
                    <button class="menu-btn primary" id="home-nextday-btn">☀️ Start Day ${game.taxi.day + 1}</button>
                </div>
            </div>
        `;
        this.overlay.classList.remove('hidden');

        this._bindEvents(game, currentTab);
    }

    hide() {
        if (this.overlay) this.overlay.classList.add('hidden');
    }

    _bindEvents(game, currentTab) {
        const overlay = this.overlay;

        // Bind tab buttons
        overlay.querySelectorAll('.home-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.show(game, btn.dataset.tab);
            });
        });

        // Bind skill buttons
        overlay.querySelectorAll('.home-skill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.skill;
                const sk = game.taxi.trainedSkills;
                const def = SKILL_DEFS.find(s => s.key === key);
                const lvl = sk[key] || 0;
                if (lvl < def.max && game.taxi.money >= def.cost[lvl]) {
                    game.taxi.money -= def.cost[lvl];
                    sk[key] = lvl + 1;
                    this.show(game, 'skills');
                }
            });
        });

        // Bind shop item buttons
        overlay.querySelectorAll('.shop-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.item;
                const item = SHOP_ITEMS.find(i => i.id === itemId);
                if (item && game.taxi.money >= item.price && !game.taxi.personalItems[itemId]) {
                    game.taxi.money -= item.price;
                    if (item.consumable) {
                        if (itemId === 'energy_drinks') {
                            game.taxi.fatigue = Math.max(0, game.taxi.fatigue - 50);
                            game.hazardMgr.addNotification(`🥤 Energy restored! Fatigue -50%`, 'info');
                        }
                    } else {
                        game.taxi.personalItems[itemId] = true;
                        game.hazardMgr.addNotification(`🛍️ Bought ${item.name}!`, 'info');
                    }
                    this.show(game, 'shop');
                }
            });
        });

        // Bind car buy buttons
        overlay.querySelectorAll('.car-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const carId = btn.dataset.carid;
                const model = CAR_MODELS.find(m => m.id === carId);
                if (model && game.taxi.money >= model.price) {
                    game.taxi.money -= model.price;
                    game.taxi.ownedCars.push(carId);
                    game.taxi.switchCar(carId);
                    game.hazardMgr.addNotification(`🚗 Bought ${model.name}!`, 'info');
                    this.show(game, 'garage');
                }
            });
        });

        // Bind car switch buttons
        overlay.querySelectorAll('.car-switch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                game.taxi.switchCar(btn.dataset.carid);
                this.show(game, 'garage');
            });
        });

        // Bind upgrade buttons
        overlay.querySelectorAll('.home-upgrade-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                game.taxi.doUpgrade(btn.dataset.key);
                this.show(game, 'upgrades');
            });
        });

        // Rest button
        document.getElementById('home-rest-btn').addEventListener('click', () => {
            game.taxi.fatigue = 0;
            game.taxi.isResting = false;
            game.hazardMgr.addNotification('😴 You slept well! Energy fully restored.', 'info');
            this.show(game, currentTab);
        });

        // Repair button
        document.getElementById('home-repair-btn').addEventListener('click', () => {
            if (game.taxi.health >= game.taxi.maxHealth) {
                game.hazardMgr.addNotification('✅ Car is already in perfect condition!', 'info');
                return;
            }
            const discount = game.taxi.personalItems.toolkit ? 0.7 : 1.0;
            const cost = Math.round((game.taxi.maxHealth - game.taxi.health) * REPAIR_COST_PER_PERCENT * discount);
            if (game.taxi.money < cost) {
                game.hazardMgr.addNotification(`💸 Need ${formatMoney(cost)} to repair.`, 'warning');
                return;
            }
            game.taxi.money -= cost;
            game.taxi.health = game.taxi.maxHealth;
            game.taxi.damageVisual = 0;
            game.taxi.tireHealth = TIRE_MAX_HEALTH;
            game.taxi.tireBlown = false;
            game.hazardMgr.addNotification(`🔧 Car fully repaired! -${formatMoney(cost)}`, 'info');
            this.show(game, currentTab);
        });

        // Refuel button
        document.getElementById('home-refuel-btn').addEventListener('click', () => {
            if (game.taxi.fuel >= game.taxi.fuelCapacity) {
                game.hazardMgr.addNotification('✅ Tank is already full!', 'info');
                return;
            }
            const liters = game.taxi.fuelCapacity - game.taxi.fuel;
            const cost = Math.round(liters * FUEL_COST_PER_LITER);
            if (game.taxi.money < cost) {
                game.hazardMgr.addNotification(`💸 Need ${formatMoney(cost)} to refuel.`, 'warning');
                return;
            }
            game.taxi.money -= cost;
            game.taxi.fuel = game.taxi.fuelCapacity;
            game.hazardMgr.addNotification(`⛽ Tank full! -${formatMoney(cost)}`, 'info');
            this.show(game, currentTab);
        });

        // Next day button
        document.getElementById('home-nextday-btn').addEventListener('click', () => {
            if (!game.taxi.dayEarnings.find(d => d.day === game.taxi.day)) {
                game.taxi.recordDayEnd();
            }
            game.taxi.fatigue = 0;
            game.taxi.isResting = false;
            game.taxi.day++;
            game._dayStartEarnings = game.taxi.totalEarnings;
            game._dayStartFares = game.taxi.totalFares;
            game._dayStartDamage = game.taxi.totalDamageEvents || 0;
            game.gameTime = DAY_START_HOUR * 60;
            overlay.classList.add('hidden');
            game.paused = false;
            game.hazardMgr.addNotification(`☀️ Day ${game.taxi.day} begins! Good luck!`, 'info');
        });
    }

    _renderSummary(game) {
        const dayEarnings = game.taxi.totalEarnings - (game._dayStartEarnings || 0);
        const dayFares = game.taxi.totalFares - (game._dayStartFares || 0);
        const expenses = DAILY_INSURANCE + DAILY_PARKING_FEE + DAILY_PHONE_PLAN;

        return `
            <div class="home-grid">
                <div class="home-section">
                    <h3>📊 Day ${game.taxi.day} Summary</h3>
                    <div class="stat-row"><span>Fares completed</span><span>${dayFares}</span></div>
                    <div class="stat-row"><span>Earnings</span><span style="color:#2ecc71">${formatMoney(dayEarnings)}</span></div>
                    <div class="stat-row"><span>Daily expenses</span><span style="color:#e74c3c">-${formatMoney(expenses)}</span></div>
                    <div class="stat-row"><span>Net profit</span><span style="color:${dayEarnings - expenses > 0 ? '#2ecc71' : '#e74c3c'}">${formatMoney(dayEarnings - expenses)}</span></div>
                    <div class="stat-row"><span>Distance driven</span><span>${(game.taxi.currentDayKm || 0).toFixed(1)} km</span></div>
                    <div class="stat-row"><span>Best single fare</span><span style="color:#f39c12">${formatMoney(game.taxi.currentDayTopFare || 0)}</span></div>
                    <div class="stat-row"><span>Fines today</span><span style="color:#e74c3c">${game.taxi.currentDayFines || 0}</span></div>
                    <div class="stat-row"><span>Rating</span><span>${'⭐'.repeat(Math.round(game.taxi.rating))}${'☆'.repeat(5 - Math.round(game.taxi.rating))} (${game.taxi.rating.toFixed(1)})</span></div>
                    ${this._renderEarningsHistory(game)}
                </div>
                <div class="home-section">
                    <h3>🎯 Daily Challenges</h3>
                    ${this._renderChallenges(game)}
                    <div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.1);padding-top:12px">
                        <h3>🚕 Car Status</h3>
                        <div class="stat-row"><span>Health</span><span style="color:${game.taxi.health > 60 ? '#2ecc71' : '#e74c3c'}">${Math.floor(game.taxi.health)}/${game.taxi.maxHealth}</span></div>
                        <div class="stat-row"><span>Fuel</span><span>${Math.floor(game.taxi.fuel)}/${game.taxi.fuelCapacity}L</span></div>
                        <div class="stat-row"><span>Tires</span><span style="color:${game.taxi.tireHealth > 50 ? '#2ecc71' : '#e74c3c'}">${Math.floor(game.taxi.tireHealth)}%</span></div>
                        <div class="stat-row"><span>Energy</span><span style="color:${game.taxi.fatigue < 50 ? '#2ecc71' : '#e74c3c'}">${Math.floor(100 - game.taxi.fatigue)}%</span></div>
                        <div class="stat-row"><span>Total KM</span><span>${game.taxi.totalKm.toFixed(1)} km</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    _renderSkills(game) {
        if (!game.taxi.trainedSkills) {
            game.taxi.trainedSkills = { negotiation: 0, navigation: 0, endurance: 0, mechanics: 0 };
        }
        const sk = game.taxi.trainedSkills;

        let html = '<div class="home-section"><h3>📚 Skills & Training</h3>';
        html += '<div style="color:#aaa;font-size:0.82rem;margin-bottom:12px">Invest in yourself to earn more and drive better.</div>';
        for (const s of SKILL_DEFS) {
            const lvl = sk[s.key] || 0;
            const nextCost = lvl < s.max ? s.cost[lvl] : null;
            const canBuy = nextCost && game.taxi.money >= nextCost;
            const stars = '⭐'.repeat(lvl) + '☆'.repeat(s.max - lvl);
            const pct = Math.round((lvl / s.max) * 100);
            html += `<div class="home-skill">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <b>${s.name}</b> <span style="font-size:0.8rem">${stars}</span>
                </div>
                <div class="progress-bar" style="margin:4px 0;height:4px"><div class="progress-fill" style="width:${pct}%;background:#f5c518"></div></div>
                <div style="color:#aaa;font-size:0.8rem">${s.desc}</div>
                ${nextCost ? `<button class="upgrade-btn home-skill-btn" data-skill="${s.key}" ${canBuy ? '' : 'disabled'}>
                    ${canBuy ? `Train — ${formatMoney(nextCost)}` : `Need ${formatMoney(nextCost)}`}
                </button>` : '<span style="color:#2ecc71;font-size:0.85rem">MASTERED</span>'}
            </div>`;
        }
        html += '</div>';
        return html;
    }

    _renderShop(game) {
        let html = '<div class="home-section"><h3>🛒 Personal Items Shop</h3>';
        html += '<div style="color:#aaa;font-size:0.82rem;margin-bottom:12px">Buy items to improve your taxi business. Items persist across days.</div>';
        html += '<div class="shop-grid">';
        for (const item of SHOP_ITEMS) {
            const owned = game.taxi.personalItems[item.id];
            const canAfford = game.taxi.money >= item.price;
            html += `<div class="shop-item ${owned ? 'shop-item-owned' : ''}">
                <div class="shop-item-header">
                    <span style="font-size:1.3rem">${item.icon}</span>
                    <div>
                        <b>${item.name}</b>
                        <span style="color:#f5c518;font-size:0.8rem;margin-left:6px">${formatMoney(item.price)}</span>
                    </div>
                </div>
                <div style="color:#aaa;font-size:0.8rem;margin:4px 0">${item.desc}</div>
                ${owned
                    ? '<span style="color:#2ecc71;font-size:0.85rem">✅ Owned</span>'
                    : `<button class="upgrade-btn shop-buy-btn" data-item="${item.id}" ${canAfford ? '' : 'disabled'}>
                        ${canAfford ? `Buy — ${formatMoney(item.price)}` : `Need ${formatMoney(item.price)}`}
                    </button>`
                }
            </div>`;
        }
        html += '</div></div>';
        return html;
    }

    _renderGarage(game) {
        let html = '<div class="home-section"><h3>🚗 Garage — Buy & Switch Cars</h3>';
        html += `<div style="color:#aaa;font-size:0.82rem;margin-bottom:8px">Current: <b style="color:${game.taxi.carColor}">${game.taxi.carModel.name}</b></div>`;
        html += '<div class="car-grid">';
        for (const car of CAR_MODELS) {
            const owned = game.taxi.ownedCars.includes(car.id);
            const active = game.taxi.carModelId === car.id;
            const canAfford = game.taxi.money >= car.price;
            const statBars = [
                { label: 'Speed', val: car.stats.maxSpeed, max: 320 },
                { label: 'Accel', val: car.stats.acceleration, max: 150 },
                { label: 'Fuel', val: car.stats.fuelCapacity, max: 160 },
                { label: 'Tough', val: car.stats.durability, max: 200 },
                { label: 'Fare+', val: car.stats.fareBonus * 100, max: 170 },
            ];
            const barsHtml = statBars.map(s =>
                `<div class="car-stat-row"><span>${s.label}</span><div class="car-stat-bar"><div class="car-stat-fill" style="width:${Math.round(s.val/s.max*100)}%;background:${active ? '#00FF88' : '#4a9e9e'}"></div></div></div>`
            ).join('');

            let btnHtml;
            if (active) {
                btnHtml = `<button class="menu-btn" disabled style="opacity:0.5">✅ Current</button>`;
            } else if (owned) {
                btnHtml = `<button class="menu-btn car-switch-btn" data-carid="${car.id}">🔄 Switch</button>`;
            } else {
                btnHtml = `<button class="menu-btn car-buy-btn" data-carid="${car.id}" ${canAfford ? '' : 'disabled'}>
                    ${canAfford ? `🛒 Buy — ${formatMoney(car.price)}` : `Need ${formatMoney(car.price)}`}
                </button>`;
            }

            html += `<div class="car-card ${active ? 'car-card-active' : ''}">
                <div class="car-card-header">
                    <span class="car-swatch" style="background:${car.color}"></span>
                    <b>${car.name}</b>
                    ${car.price === 0 ? '' : `<span style="color:#f5c518;font-size:0.8rem">${formatMoney(car.price)}</span>`}
                </div>
                <div style="color:#aaa;font-size:0.78rem;margin:4px 0">${car.desc}</div>
                ${barsHtml}
                ${btnHtml}
            </div>`;
        }
        html += '</div></div>';
        return html;
    }

    _renderUpgrades(game) {
        let html = '<div class="home-section"><h3>🔧 Car Upgrades</h3>';
        html += '<div style="color:#aaa;font-size:0.82rem;margin-bottom:12px">Upgrade your car components for better performance.</div>';
        html += '<div class="upgrades-grid">';
        for (const [key, upgrade] of Object.entries(UPGRADES)) {
            const level = game.taxi.upgradeLevels[key];
            const currentStats = upgrade.levels[level];
            const nextLevel = level < upgrade.levels.length - 1 ? upgrade.levels[level + 1] : null;
            const canUp = game.taxi.canUpgrade(key);
            const pct = Math.round(((level) / (upgrade.levels.length - 1)) * 100);

            html += `<div class="upgrade-card">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <b>${upgrade.icon} ${upgrade.name}</b>
                    <span style="color:#aaa;font-size:0.8rem">Lvl ${level + 1}/${upgrade.levels.length}</span>
                </div>
                <div class="progress-bar" style="margin:6px 0;height:4px"><div class="progress-fill" style="width:${pct}%;background:#3498db"></div></div>
                <div style="color:#ccc;font-size:0.82rem">${currentStats.desc}</div>
                ${nextLevel ? `
                    <div style="color:#aaa;font-size:0.78rem;margin-top:2px">Next: ${nextLevel.desc}</div>
                    <button class="upgrade-btn home-upgrade-btn" data-key="${key}" ${canUp.can ? '' : 'disabled'}>
                        ${canUp.can ? `Upgrade — ${formatMoney(nextLevel.cost)}` : canUp.reason}
                    </button>
                ` : '<span style="color:#2ecc71;font-size:0.85rem">MAX LEVEL</span>'}
            </div>`;
        }
        html += '</div></div>';
        return html;
    }

    _renderChallenges(game) {
        if (!game.challengeMgr) return '<div style="color:#aaa">Challenges loading...</div>';

        let html = '';
        for (const challenge of game.challengeMgr.currentChallenges) {
            const progress = Math.min(challenge.progress, challenge.target);
            const percent = Math.round((progress / challenge.target) * 100);
            const completed = challenge.completed;
            const color = completed ? '#2ecc71' : '#3498db';

            html += `
                <div class="challenge-item ${completed ? 'challenge-completed' : ''}">
                    <div class="challenge-header">
                        <span class="challenge-icon">${challenge.icon}</span>
                        <span class="challenge-desc">${challenge.desc}</span>
                        ${completed ? '<span class="challenge-status">✅</span>' : ''}
                    </div>
                    <div class="challenge-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${percent}%;background:${color}"></div>
                        </div>
                        <span class="progress-text">${Math.floor(progress)}/${challenge.target}</span>
                    </div>
                    ${completed && challenge.reward ? `
                        <div class="challenge-reward">
                            <span class="reward-icon">${CHALLENGE_REWARDS[challenge.reward.type.toUpperCase()]?.icon || '🎁'}</span>
                            <span class="reward-text">${this._formatRewardText(challenge.reward)}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        if (html === '') {
            html = '<div style="color:#aaa">No challenges today</div>';
        }

        return html;
    }

    _formatRewardText(reward) {
        switch (reward.type) {
            case 'money': return `+${formatMoney(reward.amount)}`;
            case 'free_repair': return 'Free repair';
            case 'free_fuel': return 'Free fuel';
            case 'tip_boost': return '50% tip boost (30 min)';
            case 'xp_bonus': return '25% XP boost (1 hour)';
            default: return 'Reward';
        }
    }

    _renderEarningsHistory(game) {
        if (!game.taxi.dayEarnings || game.taxi.dayEarnings.length === 0) return '';

        let html = '<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px">';
        html += '<div style="color:#aaa;font-size:0.8rem;margin-bottom:4px">📈 Previous Days</div>';

        const recent = game.taxi.dayEarnings.slice(-5).reverse();
        for (const day of recent) {
            const profit = day.earnings - (DAILY_INSURANCE + DAILY_PARKING_FEE + DAILY_PHONE_PLAN);
            const color = profit > 0 ? '#2ecc71' : '#e74c3c';
            html += `<div class="stat-row" style="font-size:0.82rem">
                <span>Day ${day.day}</span>
                <span style="color:${color}">${formatMoney(day.earnings)} · ${day.fares} fares · ${day.km.toFixed(1)}km</span>
            </div>`;
        }
        html += '</div>';
        return html;
    }
}

// Skill definitions (moved from game._getSkillDefs)
const SKILL_DEFS = [
    { key: 'negotiation', name: '💬 Negotiation', desc: '+10% tips per level', cost: [100, 250, 500], max: 3 },
    { key: 'navigation', name: '🧭 Navigation', desc: 'Wider minimap + route hints', cost: [80, 200, 400], max: 3 },
    { key: 'endurance', name: '💪 Endurance', desc: 'Fatigue builds 15% slower/lvl', cost: [120, 300, 600], max: 3 },
    { key: 'mechanics', name: '🔧 Mechanics', desc: 'Tire/car wear 15% slower/lvl', cost: [100, 250, 500], max: 3 },
];

// Shop item definitions (moved from game._getShopItems)
const SHOP_ITEMS = [
    { id: 'dashcam', name: 'Dashcam', icon: '📹', price: 150,
      desc: 'Reduces all fine amounts by 25%', effect: 'fineReduction' },
    { id: 'coffee_thermos', name: 'Coffee Thermos', icon: '☕', price: 80,
      desc: 'Fatigue builds 20% slower while driving', effect: 'fatigueSlow' },
    { id: 'phone_mount', name: 'Phone Mount', icon: '📱', price: 120,
      desc: 'App orders pay 15% more', effect: 'appBonus' },
    { id: 'sunglasses', name: 'Polarized Sunglasses', icon: '🕶️', price: 60,
      desc: 'Better visibility at night — no speed penalty', effect: 'nightVision' },
    { id: 'first_aid', name: 'First Aid Kit', icon: '🩹', price: 100,
      desc: 'Recover 10% health automatically after accidents', effect: 'autoHeal' },
    { id: 'toolkit', name: 'Toolkit', icon: '🧰', price: 200,
      desc: '30% discount on all repair costs', effect: 'repairDiscount' },
    { id: 'air_freshener', name: 'Premium Air Freshener', icon: '🌸', price: 40,
      desc: '+5% to all passenger ratings', effect: 'ratingBoost' },
    { id: 'gps_pro', name: 'GPS Pro Device', icon: '🗺️', price: 250,
      desc: 'Shows passenger destinations on minimap before pickup', effect: 'gpsReveal' },
    { id: 'seat_covers', name: 'Leather Seat Covers', icon: '💺', price: 180,
      desc: 'VIP passengers 2x more likely to choose you', effect: 'vipAttract' },
    { id: 'lucky_dice', name: 'Lucky Dice', icon: '🎲', price: 75,
      desc: '+15% chance of getting tips', effect: 'tipChance' },
    { id: 'energy_drinks', name: 'Energy Drink Pack', icon: '🥤', price: 50,
      desc: 'One-time: instantly restore 50% energy', effect: 'energyBoost', consumable: true },
    { id: 'better_bed', name: 'Premium Mattress', icon: '🛏️', price: 300,
      desc: 'Rest at home restores energy 50% faster', effect: 'betterRest' },
];
