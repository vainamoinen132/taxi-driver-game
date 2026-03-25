// ============================================================
// MAIN - Entry point, menu navigation
// ============================================================

(function () {
    const game = new Game();
    const saveSystem = new SaveLoadSystem();
    let selectedCharId = null;

    // Screen management
    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    // Check for existing saves and show continue button
    function updateMainMenu() {
        const btnContinue = document.getElementById('btn-continue');
        if (saveSystem.hasSaves()) {
            btnContinue.style.display = 'block';
        } else {
            btnContinue.style.display = 'none';
        }
    }

    // ---- Character Selection ----
    function buildCharacterGrid() {
        const grid = document.getElementById('char-grid');
        grid.innerHTML = '';
        
        CHARACTERS.forEach(char => {
            const card = document.createElement('div');
            card.className = 'char-card';
            card.dataset.charId = char.id;
            
            const canvas = document.createElement('canvas');
            canvas.width = 80;
            canvas.height = 80;
            canvas.className = 'char-card-portrait';
            
            const nameEl = document.createElement('div');
            nameEl.className = 'char-card-name';
            nameEl.textContent = char.name.split('"')[0].trim();
            
            const nicknameEl = document.createElement('div');
            nicknameEl.className = 'char-card-nickname';
            const nickMatch = char.name.match(/"([^"]+)"/);
            nicknameEl.textContent = nickMatch ? `"${nickMatch[1]}"` : '';
            
            card.appendChild(canvas);
            card.appendChild(nameEl);
            card.appendChild(nicknameEl);
            grid.appendChild(card);
            
            // Draw portrait
            const ctx = canvas.getContext('2d');
            drawCharacterPortrait(ctx, char, 0, 0, 80);
            
            card.addEventListener('click', () => selectCharacter(char.id));
        });
    }

    function selectCharacter(charId) {
        selectedCharId = charId;
        const char = CHARACTERS.find(c => c.id === charId);
        if (!char) return;
        
        // Highlight selected card
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
        document.querySelector(`.char-card[data-char-id="${charId}"]`).classList.add('selected');
        
        // Show detail panel
        const detail = document.getElementById('char-detail');
        detail.classList.remove('hidden');
        
        // Draw large portrait
        const largeCanvas = document.getElementById('char-portrait-large');
        const ctx = largeCanvas.getContext('2d');
        ctx.clearRect(0, 0, 120, 120);
        drawCharacterPortrait(ctx, char, 0, 0, 120);
        
        // Fill details
        document.getElementById('char-detail-name').textContent = char.name;
        document.getElementById('char-detail-bio').textContent = char.bio;
        document.getElementById('char-detail-personality').textContent = char.personality;
        
        // Skills bars
        const skillsEl = document.getElementById('char-skills');
        const skillNames = { driving: '🏎️ Driving', charisma: '💬 Charisma', endurance: '💪 Endurance', mechanic: '🔧 Mechanic', navigation: '🧭 Navigation' };
        let skillsHtml = '';
        for (const [key, label] of Object.entries(skillNames)) {
            const val = char.skills[key] || 0;
            const pct = Math.round(val * 100);
            const color = pct >= 80 ? '#2ecc71' : pct >= 60 ? '#f39c12' : '#e74c3c';
            skillsHtml += `<div class="skill-row">
                <span class="skill-label">${label}</span>
                <div class="skill-bar"><div class="skill-fill" style="width:${pct}%;background:${color}"></div></div>
                <span class="skill-value">${pct}%</span>
            </div>`;
        }
        skillsEl.innerHTML = skillsHtml;
        
        // Bonuses
        const bonusEl = document.getElementById('char-bonuses');
        bonusEl.innerHTML = char.bonuses.map(b => `<li class="bonus-item">✅ ${b.desc}</li>`).join('');
        
        // Weaknesses
        const weakEl = document.getElementById('char-weaknesses');
        weakEl.innerHTML = char.weaknesses.map(w => `<li class="weakness-item">⚠️ ${w.desc}</li>`).join('');
        
        // Starting info
        const carModel = CAR_MODELS.find(m => m.id === char.startingCar) || CAR_MODELS[0];
        document.getElementById('char-start-money').textContent = `💰 Starting: ${formatMoney(char.startingMoney)}`;
        document.getElementById('char-start-car').textContent = `🚗 Car: ${carModel.name}`;
    }

    // ---- Save/Load Slots ----
    function buildSaveSlots(containerId, mode) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        for (let i = 0; i < 3; i++) {
            const info = saveSystem.getSaveInfo(i);
            const slot = document.createElement('div');
            slot.className = 'save-slot' + (info ? ' has-data' : ' empty');
            
            if (info) {
                slot.innerHTML = `
                    <div class="save-slot-header">
                        <span class="save-slot-name">${info.characterName}</span>
                        <span class="save-slot-date">${info.dateStr}</span>
                    </div>
                    <div class="save-slot-details">
                        <span>📅 Day ${info.day}</span>
                        <span>💰 ${formatMoney(info.money)}</span>
                        <span>📏 ${info.totalKm.toFixed(1)} km</span>
                        <span>⭐ ${info.rating.toFixed(1)}</span>
                    </div>
                    <div class="save-slot-actions">
                        <button class="slot-btn ${mode === 'save' ? 'primary' : 'primary'}" data-slot="${i}" data-action="${mode}">
                            ${mode === 'save' ? '💾 Save Here' : '▶️ Load'}
                        </button>
                        <button class="slot-btn danger" data-slot="${i}" data-action="delete">🗑️ Delete</button>
                    </div>
                `;
            } else {
                slot.innerHTML = `
                    <div class="save-slot-empty">Slot ${i + 1} — Empty</div>
                    ${mode === 'save' ? `<button class="slot-btn primary" data-slot="${i}" data-action="save">💾 Save Here</button>` : ''}
                `;
            }
            
            container.appendChild(slot);
        }
        
        // Wire up slot buttons
        container.querySelectorAll('.slot-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotIdx = parseInt(e.target.dataset.slot);
                const action = e.target.dataset.action;
                
                if (action === 'save') {
                    if (game.saveGame(slotIdx)) {
                        game.hazardMgr.addNotification('💾 Game saved!', 'info');
                        buildSaveSlots(containerId, mode);
                    }
                } else if (action === 'load') {
                    const data = saveSystem.load(slotIdx);
                    if (data) {
                        showScreen('game-screen');
                        game.start(data.characterId, data);
                        game.loadSavedData(data);
                    }
                } else if (action === 'delete') {
                    if (confirm('Delete this save?')) {
                        saveSystem.deleteSave(slotIdx);
                        buildSaveSlots(containerId, mode);
                        updateMainMenu();
                    }
                }
            });
        });
    }

    // ---- Event Listeners ----

    // Main menu: New Game -> Character Select
    document.getElementById('btn-new-game').addEventListener('click', () => {
        buildCharacterGrid();
        document.getElementById('char-detail').classList.add('hidden');
        selectedCharId = null;
        showScreen('character-select');
    });

    // Main menu: Continue -> Load most recent save
    document.getElementById('btn-continue').addEventListener('click', () => {
        // Find most recent save
        let latest = null;
        let latestSlot = -1;
        for (let i = 0; i < 3; i++) {
            const data = saveSystem.load(i);
            if (data && (!latest || data.timestamp > latest.timestamp)) {
                latest = data;
                latestSlot = i;
            }
        }
        if (latest) {
            showScreen('game-screen');
            game.start(latest.characterId, latest);
            game.loadSavedData(latest);
        }
    });

    // Main menu: Load Game
    document.getElementById('btn-load-game').addEventListener('click', () => {
        buildSaveSlots('load-slots', 'load');
        showScreen('load-screen');
    });

    // Main menu: How to Play
    document.getElementById('btn-how-to-play').addEventListener('click', () => {
        showScreen('how-to-play');
    });

    // Back buttons
    document.getElementById('btn-back-menu').addEventListener('click', () => {
        showScreen('main-menu');
        updateMainMenu();
    });

    document.getElementById('btn-char-back').addEventListener('click', () => {
        showScreen('main-menu');
    });

    document.getElementById('btn-load-back').addEventListener('click', () => {
        showScreen('main-menu');
    });

    // Character select: Start Game
    document.getElementById('btn-start-game').addEventListener('click', () => {
        if (!selectedCharId) return;
        showScreen('game-screen');
        game.start(selectedCharId);
    });

    // Pause menu buttons
    document.getElementById('btn-resume').addEventListener('click', () => {
        game.togglePause();
    });

    document.getElementById('btn-save').addEventListener('click', () => {
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('save-screen').classList.remove('hidden');
        buildSaveSlots('save-slots', 'save');
    });

    document.getElementById('btn-save-close').addEventListener('click', () => {
        document.getElementById('save-screen').classList.add('hidden');
        document.getElementById('pause-menu').classList.remove('hidden');
    });

    document.getElementById('btn-upgrades').addEventListener('click', () => {
        game.showGarage();
    });

    document.getElementById('btn-stats').addEventListener('click', () => {
        game.showStats();
    });

    document.getElementById('btn-quit').addEventListener('click', () => {
        game.quit();
        showScreen('main-menu');
        updateMainMenu();
    });

    // Garage close
    document.getElementById('btn-close-garage').addEventListener('click', () => {
        document.getElementById('garage-menu').classList.add('hidden');
        document.getElementById('pause-menu').classList.remove('hidden');
    });

    // Stats close
    document.getElementById('btn-close-stats').addEventListener('click', () => {
        document.getElementById('stats-menu').classList.add('hidden');
        document.getElementById('pause-menu').classList.remove('hidden');
    });

    // Start on main menu
    updateMainMenu();
    showScreen('main-menu');
})();
