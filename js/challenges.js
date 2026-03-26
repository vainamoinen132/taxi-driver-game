// ============================================================
// DAILY CHALLENGES SYSTEM
// ============================================================

class ChallengeManager {
    constructor() {
        this.currentChallenges = [];
        this.completedToday = [];
        this.activeBonuses = [];
        this.lastDayReset = 0;
    }

    generateDailyChallenges() {
        this.currentChallenges = [];
        this.completedToday = [];
        
        // Generate 3 random challenges for the day
        const challengePool = Object.values(CHALLENGE_TYPES);
        const selected = [];
        
        // Ensure variety - don't pick same type twice
        while (selected.length < 3 && selected.length < challengePool.length) {
            const available = challengePool.filter(c => !selected.includes(c));
            const challenge = randChoice(available);
            selected.push(challenge);
            
            // Generate specific parameters for this challenge
            const challengeData = this._generateChallengeData(challenge);
            this.currentChallenges.push(challengeData);
        }
    }

    _generateChallengeData(challengeType) {
        const data = {
            type: challengeType.id,
            desc: challengeType.desc,
            icon: challengeType.icon,
            progress: 0,
            target: 0,
            completed: false,
            reward: null
        };

        switch (challengeType.id) {
            case 'fares_no_damage':
                data.target = rand(3, 5);
                data.desc = data.desc.replace('{count}', data.target);
                data.reward = { type: 'money', amount: rand(150, 300) };
                break;
                
            case 'earn_before_time':
                data.target = rand(600, 1200);
                data.timeLimit = rand(14, 18); // 2-6 PM
                data.desc = data.desc.replace('${amount}', data.target).replace('{time}', data.timeLimit);
                data.reward = { type: 'tip_boost', duration: 1800 };
                break;
                
            case 'drive_blocks':
                data.target = rand(20, 40);
                data.desc = data.desc.replace('{count}', data.target);
                data.reward = { type: 'money', amount: rand(100, 200) };
                break;
                
            case 'vip_passengers':
                data.target = rand(2, 3);
                data.desc = data.desc.replace('{count}', data.target);
                data.reward = { type: 'money', amount: rand(300, 500) };
                break;
                
            case 'perfect_rating':
                data.target = rand(2, 3);
                data.desc = data.desc.replace('{count}', data.target);
                data.reward = { type: 'free_repair' };
                break;
                
            case 'speed_limits':
                data.target = 5; // 5 km
                data.desc = data.desc.replace('5km', '5km');
                data.reward = { type: 'free_fuel' };
                break;
                
            case 'no_passenger_wait':
                data.target = rand(3, 5);
                data.desc = data.desc.replace('{count}', data.target);
                data.reward = { type: 'money', amount: rand(120, 250) };
                break;
                
            case 'night_driver':
                data.target = 3;
                data.desc = data.desc.replace('3', '3');
                data.reward = { type: 'xp_bonus', duration: 3600 };
                break;
        }

        return data;
    }

    updateProgress(challengeType, amount = 1, game) {
        // Reset challenges if new day
        if (game && game.taxi.day !== this.lastDayReset) {
            this.generateDailyChallenges();
            this.lastDayReset = game.taxi.day;
        }

        const challenge = this.currentChallenges.find(c => c.type === challengeType && !c.completed);
        if (!challenge) return false;

        challenge.progress = Math.min(challenge.progress + amount, challenge.target);
        
        if (challenge.progress >= challenge.target && !challenge.completed) {
            challenge.completed = true;
            this.completedToday.push(challenge.type);
            this._grantReward(challenge.reward, game);
            return true; // Challenge completed
        }
        
        return false;
    }

    _grantReward(reward, game) {
        if (!game || !game.taxi) return;

        switch (reward.type) {
            case 'money':
                game.taxi.money += reward.amount;
                game.hazardMgr.addNotification(`🎉 Challenge completed! +${formatMoney(reward.amount)}`, 'success');
                break;
                
            case 'free_repair':
                game.taxi.health = game.taxi.maxHealth;
                game.taxi.damageVisual = 0;
                game.hazardMgr.addNotification(`🎉 Challenge completed! Free car repair!`, 'success');
                break;
                
            case 'free_fuel':
                game.taxi.fuel = game.taxi.fuelCapacity;
                game.hazardMgr.addNotification(`🎉 Challenge completed! Free tank of fuel!`, 'success');
                break;
                
            case 'tip_boost':
                this.activeBonuses.push({
                    type: 'tip_boost',
                    multiplier: 1.5,
                    endTime: Date.now() + reward.duration * 1000
                });
                game.hazardMgr.addNotification(`🎉 Challenge completed! 50% tip boost for 30 minutes!`, 'success');
                break;
                
            case 'xp_bonus':
                this.activeBonuses.push({
                    type: 'xp_bonus',
                    multiplier: 1.25,
                    endTime: Date.now() + reward.duration * 1000
                });
                game.hazardMgr.addNotification(`🎉 Challenge completed! 25% XP boost for 1 hour!`, 'success');
                break;
        }
    }

    getBonusMultiplier(bonusType) {
        const bonus = this.activeBonuses.find(b => b.type === bonusType && b.endTime > Date.now());
        return bonus ? bonus.multiplier : 1.0;
    }

    cleanupExpiredBonuses() {
        this.activeBonuses = this.activeBonuses.filter(b => b.endTime > Date.now());
    }

    getChallengeProgress(challengeType) {
        const challenge = this.currentChallenges.find(c => c.type === challengeType);
        return challenge ? { progress: challenge.progress, target: challenge.target, completed: challenge.completed } : null;
    }
}
