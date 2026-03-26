// ============================================================
// CHARACTER / DRIVER SYSTEM
// ============================================================

const CHARACTERS = [
    {
        id: 'mike',
        name: 'Mike "Ironwheel" Torres',
        age: 42,
        portrait: null, // Will draw with canvas
        portraitColors: { skin: '#c68642', hair: '#1a1a1a', shirt: '#2c3e50', eyes: '#3e2723' },
        bio: 'A veteran cab driver with 20 years on the streets. Knows every shortcut in the city.',
        personality: 'Calm and experienced',
        skills: {
            driving: 0.9,     // Better handling & speed
            charisma: 0.5,    // Average tips
            endurance: 0.8,   // Slower fatigue
            mechanic: 0.7,    // Cheaper repairs
            navigation: 0.9   // Better GPS efficiency
        },
        bonuses: [
            { stat: 'maxSpeed', mult: 1.08, desc: '+8% top speed' },
            { stat: 'fatigueRate', mult: 0.8, desc: '20% slower fatigue' },
            { stat: 'repairCost', mult: 0.85, desc: '15% cheaper repairs' }
        ],
        weaknesses: [
            { stat: 'tipChance', mult: 0.9, desc: '10% fewer tips (grumpy)' }
        ],
        startingMoney: 500,
        startingCar: 'starter_cab'
    },
    {
        id: 'sarah',
        name: 'Sarah "Dash" Chen',
        age: 28,
        portrait: null,
        portraitColors: { skin: '#f5deb3', hair: '#2c1810', shirt: '#e74c3c', eyes: '#1a1a1a' },
        bio: 'Former delivery driver turned taxi queen. Fast, friendly, and always gets five stars.',
        personality: 'Energetic and charming',
        skills: {
            driving: 0.6,
            charisma: 0.95,
            endurance: 0.5,
            mechanic: 0.3,
            navigation: 0.7
        },
        bonuses: [
            { stat: 'tipChance', mult: 1.25, desc: '+25% tip chance' },
            { stat: 'fareBonus', mult: 1.1, desc: '+10% fare bonus' },
            { stat: 'vipChance', mult: 1.3, desc: '30% more VIP passengers' }
        ],
        weaknesses: [
            { stat: 'fuelEfficiency', mult: 1.15, desc: '15% more fuel usage (aggressive driving)' },
            { stat: 'repairCost', mult: 1.2, desc: '20% pricier repairs' }
        ],
        startingMoney: 400,
        startingCar: 'starter_cab'
    },
    {
        id: 'boris',
        name: 'Boris "The Tank" Petrov',
        age: 38,
        portrait: null,
        portraitColors: { skin: '#ffe0bd', hair: '#8B7355', shirt: '#27ae60', eyes: '#2e86c1' },
        bio: 'Ex-truck driver who handles any vehicle like a tank. His car rarely breaks down.',
        personality: 'Tough and reliable',
        skills: {
            driving: 0.7,
            charisma: 0.4,
            endurance: 0.95,
            mechanic: 0.9,
            navigation: 0.5
        },
        bonuses: [
            { stat: 'durability', mult: 1.2, desc: '+20% car durability' },
            { stat: 'fatigueRate', mult: 0.7, desc: '30% slower fatigue' },
            { stat: 'repairCost', mult: 0.7, desc: '30% cheaper repairs' }
        ],
        weaknesses: [
            { stat: 'maxSpeed', mult: 0.92, desc: '8% slower (cautious driver)' },
            { stat: 'tipChance', mult: 0.85, desc: '15% fewer tips (intimidating)' }
        ],
        startingMoney: 600,
        startingCar: 'starter_cab'
    },
    {
        id: 'luna',
        name: 'Luna "Nightshift" Reyes',
        age: 24,
        portrait: null,
        portraitColors: { skin: '#deb887', hair: '#4a0080', shirt: '#9b59b6', eyes: '#2ecc71' },
        bio: 'A night owl who thrives after dark. She knows where the best fares hide at midnight.',
        personality: 'Mysterious and sharp-eyed',
        skills: {
            driving: 0.7,
            charisma: 0.7,
            endurance: 0.6,
            mechanic: 0.4,
            navigation: 0.85
        },
        bonuses: [
            { stat: 'nightFareBonus', mult: 1.3, desc: '+30% night fare bonus (after 8 PM)' },
            { stat: 'fuelEfficiency', mult: 0.85, desc: '15% better fuel efficiency' },
            { stat: 'navigation', mult: 1.15, desc: '15% better navigation' }
        ],
        weaknesses: [
            { stat: 'dayFarePenalty', mult: 0.9, desc: '10% less daytime fares (sleepy mornings)' },
            { stat: 'fatigueRate', mult: 1.15, desc: '15% faster daytime fatigue' }
        ],
        startingMoney: 450,
        startingCar: 'starter_cab'
    },
    {
        id: 'frank',
        name: 'Frank "Lucky" O\'Brien',
        age: 55,
        portrait: null,
        portraitColors: { skin: '#f5cba7', hair: '#bdc3c7', shirt: '#f39c12', eyes: '#6c3461' },
        bio: 'A retired gambler with uncanny luck. Passengers love his stories and always tip well.',
        personality: 'Jovial and talkative',
        skills: {
            driving: 0.5,
            charisma: 0.85,
            endurance: 0.4,
            mechanic: 0.5,
            navigation: 0.6
        },
        bonuses: [
            { stat: 'tipChance', mult: 1.35, desc: '+35% tip chance' },
            { stat: 'tipAmount', mult: 1.2, desc: '+20% tip amounts' },
            { stat: 'luckyEvent', mult: 1.25, desc: '25% more lucky events' }
        ],
        weaknesses: [
            { stat: 'fatigueRate', mult: 1.25, desc: '25% faster fatigue (old bones)' },
            { stat: 'maxSpeed', mult: 0.95, desc: '5% slower reflexes' },
            { stat: 'durability', mult: 0.9, desc: '10% less durable car (rough handling)' }
        ],
        startingMoney: 700,
        startingCar: 'starter_cab'
    }
];

// Draw character portrait on a canvas
function drawCharacterPortrait(ctx, character, x, y, size) {
    const c = character.portraitColors;
    const s = size;
    const cx = x + s / 2;
    const cy = y + s / 2;

    // Background circle
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = c.skin;
    ctx.fillRect(cx - s * 0.08, cy + s * 0.1, s * 0.16, s * 0.15);

    // Shirt / body
    ctx.fillStyle = c.shirt;
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.35, s * 0.28, s * 0.18, 0, Math.PI, 0);
    ctx.fill();

    // Head
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.05, s * 0.18, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.18, s * 0.19, s * 0.12, 0, Math.PI, 0);
    ctx.fill();
    // Side hair
    ctx.fillRect(cx - s * 0.19, cy - s * 0.2, s * 0.06, s * 0.15);
    ctx.fillRect(cx + s * 0.13, cy - s * 0.2, s * 0.06, s * 0.15);

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.07, cy - s * 0.06, s * 0.045, s * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.07, cy - s * 0.06, s * 0.045, s * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = c.eyes;
    ctx.beginPath();
    ctx.arc(cx - s * 0.065, cy - s * 0.055, s * 0.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.075, cy - s * 0.055, s * 0.02, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (small smile)
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.06, s * 0.06, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Border circle
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
    ctx.stroke();
}

// SaveLoadSystem moved to js/save-manager.js
