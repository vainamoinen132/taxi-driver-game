// ============================================================
// GAME CONSTANTS
// ============================================================

const TILE_SIZE = 64;
const MAP_COLS = 80;
const MAP_ROWS = 60;
const MAP_WIDTH = MAP_COLS * TILE_SIZE;
const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;

// Tile types
const TILE = {
    GRASS: 0,
    ROAD_H: 1,
    ROAD_V: 2,
    ROAD_CROSS: 3,
    SIDEWALK: 4,
    BUILDING: 5,
    WATER: 6,
    PARK: 7,
};

// Building types
const BUILDING_TYPE = {
    HOUSE: 'house',
    APARTMENT: 'apartment',
    SCHOOL: 'school',
    HOSPITAL: 'hospital',
    RESTAURANT: 'restaurant',
    STADIUM: 'stadium',
    CONCERT_HALL: 'concert_hall',
    MALL: 'mall',
    OFFICE: 'office',
    FACTORY: 'factory',
    GAS_STATION: 'gas_station',
    MECHANIC: 'mechanic',
    POLICE: 'police',
    HOTEL: 'hotel',
    PARK: 'park',
    CHURCH: 'church',
    BANK: 'bank',
    GYM: 'gym',
    HOME: 'home_base',
};

// Building colors
const BUILDING_COLORS = {
    house: '#8B4513',
    apartment: '#A0522D',
    school: '#4169E1',
    hospital: '#FF6B6B',
    restaurant: '#FF8C00',
    stadium: '#228B22',
    concert_hall: '#9B59B6',
    mall: '#E91E63',
    office: '#607D8B',
    factory: '#795548',
    gas_station: '#F44336',
    mechanic: '#FF9800',
    police: '#1565C0',
    hotel: '#00BCD4',
    park: '#4CAF50',
    church: '#9E9E9E',
    bank: '#FFC107',
    gym: '#E91E63',
    home_base: '#FFEB3B',
};

// Building labels (icons)
const BUILDING_ICONS = {
    house: '🏠',
    apartment: '🏢',
    school: '🏫',
    hospital: '🏥',
    restaurant: '🍽️',
    stadium: '🏟️',
    concert_hall: '🎵',
    mall: '🛒',
    office: '🏛️',
    factory: '🏭',
    gas_station: '⛽',
    mechanic: '🔧',
    police: '🚔',
    hotel: '🏨',
    park: '🌳',
    church: '⛪',
    bank: '🏦',
    gym: '💪',
    home_base: '🏡',
};

// Car upgrade definitions
const UPGRADES = {
    engine: {
        name: 'Engine',
        icon: '🔧',
        levels: [
            { cost: 0, maxSpeed: 180, acceleration: 80, desc: 'Stock Engine' },
            { cost: 300, maxSpeed: 220, acceleration: 100, desc: 'Tuned Engine' },
            { cost: 800, maxSpeed: 260, acceleration: 120, desc: 'Sport Engine' },
            { cost: 2000, maxSpeed: 310, acceleration: 150, desc: 'Racing Engine' },
        ]
    },
    fuel_tank: {
        name: 'Fuel Tank',
        icon: '⛽',
        levels: [
            { cost: 0, capacity: 100, desc: 'Standard Tank (100L)' },
            { cost: 200, capacity: 130, desc: 'Extended Tank (130L)' },
            { cost: 600, capacity: 170, desc: 'Large Tank (170L)' },
            { cost: 1500, capacity: 220, desc: 'Massive Tank (220L)' },
        ]
    },
    tires: {
        name: 'Tires',
        icon: '🛞',
        levels: [
            { cost: 0, grip: 1.0, desc: 'Standard Tires' },
            { cost: 200, grip: 1.2, desc: 'Sport Tires' },
            { cost: 500, grip: 1.5, desc: 'Premium Tires' },
            { cost: 1200, grip: 1.8, desc: 'Racing Tires' },
        ]
    },
    brakes: {
        name: 'Brakes',
        icon: '🛑',
        levels: [
            { cost: 0, power: 1.0, desc: 'Standard Brakes' },
            { cost: 250, power: 1.3, desc: 'Performance Brakes' },
            { cost: 700, power: 1.6, desc: 'Ceramic Brakes' },
            { cost: 1800, power: 2.0, desc: 'Carbon Ceramic' },
        ]
    },
    body: {
        name: 'Body',
        icon: '🚕',
        levels: [
            { cost: 0, durability: 100, desc: 'Standard Body' },
            { cost: 400, durability: 140, desc: 'Reinforced Body' },
            { cost: 1000, durability: 180, desc: 'Armored Body' },
            { cost: 2500, durability: 230, desc: 'Titanium Body' },
        ]
    },
    comfort: {
        name: 'Comfort',
        icon: '💺',
        levels: [
            { cost: 0, fareBonus: 1.0, desc: 'Basic Interior' },
            { cost: 350, fareBonus: 1.15, desc: 'Leather Seats' },
            { cost: 900, fareBonus: 1.3, desc: 'Premium Interior' },
            { cost: 2200, fareBonus: 1.5, desc: 'Luxury Interior' },
        ]
    },
};

// Game balance
const FUEL_CONSUMPTION_RATE = 0.003; // per pixel moved (realistic: ~330km per tank)
const REPAIR_COST_PER_PERCENT = 3;
const FUEL_COST_PER_LITER = 2;
const BASE_FARE_PER_TILE = 1.5;
const TIP_CHANCE = 0.3;
const TIP_RANGE = [1, 10];
const SPEED_FINE_AMOUNT = 50;
const SPEED_LIMIT = 200; // km/h display speed
const THIEF_STEAL_RANGE = [20, 80];
const ACCIDENT_DAMAGE_RANGE = [10, 35];

// Time system (1 real second = X game minutes)
const TIME_SCALE = 2; // slow realistic pace
const DAY_START_HOUR = 6;

// Passenger spawn
const BASE_PASSENGER_SPAWN_INTERVAL = 2500; // ms
const MAX_PASSENGERS = 25;
const MAX_AI_TAXIS = 4;
const MAX_NPC_CARS = 20;

// Fatigue
const MAX_FATIGUE = 100;
const FATIGUE_RATE = 0.08; // per real second
const FATIGUE_REST_RATE = 8; // recovery per real second at home
const FATIGUE_PENALTY_THRESHOLD = 75; // above this, driving gets harder

// Event durations (game minutes)
const EVENT_DURATION = 60;

// Physics
const FRICTION = 0.97;
const TURN_SPEED = 2.5;
const REVERSE_SPEED_FACTOR = 0.4;
