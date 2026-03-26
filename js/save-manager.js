// ============================================================
// SAVE/LOAD SYSTEM - Extracted from characters.js and game.js
// ============================================================

class SaveLoadSystem {
    constructor() {
        this.saveSlots = 3;
    }

    save(slotIndex, gameState) {
        const saveData = {
            version: 1,
            timestamp: Date.now(),
            dateStr: new Date().toLocaleString(),
            characterId: gameState.characterId,
            taxi: {
                x: gameState.taxi.x,
                y: gameState.taxi.y,
                angle: gameState.taxi.angle,
                money: gameState.taxi.money,
                fuel: gameState.taxi.fuel,
                health: gameState.taxi.health,
                totalKm: gameState.taxi.totalKm,
                totalFares: gameState.taxi.totalFares,
                totalEarnings: gameState.taxi.totalEarnings,
                day: gameState.taxi.day,
                totalDamageEvents: gameState.taxi.totalDamageEvents,
                totalFines: gameState.taxi.totalFines,
                rating: gameState.taxi.rating,
                ratingHistory: gameState.taxi.ratingHistory,
                tireHealth: gameState.taxi.tireHealth,
                fatigue: gameState.taxi.fatigue,
                carModelId: gameState.taxi.carModelId,
                ownedCars: gameState.taxi.ownedCars,
                upgradeLevels: gameState.taxi.upgradeLevels,
                damageVisual: gameState.taxi.damageVisual,
                skills: gameState.taxi.skills || null,
                trainedSkills: gameState.taxi.trainedSkills || null,
                personalItems: gameState.taxi.personalItems || null,
                dayEarnings: gameState.taxi.dayEarnings || [],
                currentDayEarnings: gameState.taxi.currentDayEarnings || 0,
                currentDayFares: gameState.taxi.currentDayFares || 0,
                currentDayKm: gameState.taxi.currentDayKm || 0,
                currentDayFines: gameState.taxi.currentDayFines || 0,
                currentDayTopFare: gameState.taxi.currentDayTopFare || 0
            },
            citySeed: gameState.citySeed || null,
            gameTime: gameState.gameTime
        };

        try {
            localStorage.setItem(`taxi_save_${slotIndex}`, JSON.stringify(saveData));
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            return false;
        }
    }

    load(slotIndex) {
        try {
            const data = localStorage.getItem(`taxi_save_${slotIndex}`);
            if (!data) return null;
            return JSON.parse(data);
        } catch (e) {
            console.error('Load failed:', e);
            return null;
        }
    }

    getSaveInfo(slotIndex) {
        const data = this.load(slotIndex);
        if (!data) return null;
        const character = CHARACTERS.find(c => c.id === data.characterId) || CHARACTERS[0];
        return {
            exists: true,
            characterName: character.name,
            day: data.taxi.day,
            money: data.taxi.money,
            totalKm: data.taxi.totalKm,
            dateStr: data.dateStr,
            rating: data.taxi.rating
        };
    }

    deleteSave(slotIndex) {
        localStorage.removeItem(`taxi_save_${slotIndex}`);
    }

    hasSaves() {
        for (let i = 0; i < this.saveSlots; i++) {
            if (localStorage.getItem(`taxi_save_${i}`)) return true;
        }
        return false;
    }

    // Restore saved data onto a taxi instance and game state
    applyToGame(saveData, taxi, game) {
        if (!saveData || !saveData.taxi) return;

        const s = saveData.taxi;

        taxi.money = s.money !== undefined ? s.money : 500;
        taxi.fuel = s.fuel !== undefined ? s.fuel : taxi.fuelCapacity;
        taxi.health = s.health !== undefined ? s.health : taxi.maxHealth;
        taxi.totalKm = s.totalKm !== undefined ? s.totalKm : 0;
        taxi.totalFares = s.totalFares !== undefined ? s.totalFares : 0;
        taxi.totalEarnings = s.totalEarnings !== undefined ? s.totalEarnings : 0;
        taxi.day = s.day !== undefined ? s.day : 1;
        taxi.totalDamageEvents = s.totalDamageEvents !== undefined ? s.totalDamageEvents : 0;
        taxi.totalFines = s.totalFines !== undefined ? s.totalFines : 0;
        taxi.rating = s.rating !== undefined ? s.rating : RATING_INITIAL;
        taxi.ratingHistory = s.ratingHistory || [];
        taxi.tireHealth = s.tireHealth !== undefined ? s.tireHealth : TIRE_MAX_HEALTH;
        taxi.fatigue = s.fatigue !== undefined ? s.fatigue : 0;
        taxi.damageVisual = s.damageVisual !== undefined ? s.damageVisual : 0;

        if (s.carModelId) {
            taxi.carModelId = s.carModelId;
            taxi._applyCarModel();
        }
        if (s.ownedCars) taxi.ownedCars = s.ownedCars;
        if (s.upgradeLevels) taxi.upgradeLevels = s.upgradeLevels;
        if (s.skills) taxi.skills = s.skills;
        if (s.trainedSkills) taxi.trainedSkills = s.trainedSkills;
        if (s.personalItems) taxi.personalItems = s.personalItems;

        // Load earnings tracking data
        if (s.dayEarnings) taxi.dayEarnings = s.dayEarnings;
        if (s.currentDayEarnings !== undefined) taxi.currentDayEarnings = s.currentDayEarnings;
        if (s.currentDayFares !== undefined) taxi.currentDayFares = s.currentDayFares;
        if (s.currentDayKm !== undefined) taxi.currentDayKm = s.currentDayKm;
        if (s.currentDayFines !== undefined) taxi.currentDayFines = s.currentDayFines;
        if (s.currentDayTopFare !== undefined) taxi.currentDayTopFare = s.currentDayTopFare;

        if (saveData.citySeed) game.citySeed = saveData.citySeed;
        if (saveData.gameTime) game.gameTime = saveData.gameTime;
    }
}
