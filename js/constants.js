// ============================================================
// GAME CONSTANTS
// ============================================================

const TILE_SIZE = 64;
const MAP_COLS = 55;
const MAP_ROWS = 40;
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
    PARKING: 8,
    HIGHWAY: 9,
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

// Building colors (wall colors — roofs are drawn separately)
const BUILDING_COLORS = {
    house: '#e8d8c0',
    apartment: '#d0c8c0',
    school: '#d4dce8',
    hospital: '#f0e0e0',
    restaurant: '#f0e0c8',
    stadium: '#c8d8c8',
    concert_hall: '#e0d0e8',
    mall: '#e8d8e0',
    office: '#d8dce0',
    factory: '#c8c0b8',
    gas_station: '#e8e0d0',
    mechanic: '#e0d8c8',
    police: '#d0d8e8',
    hotel: '#d8e8e8',
    park: '#c8e0c0',
    church: '#e0dcd8',
    bank: '#e8e0c8',
    gym: '#e8d8d8',
    home_base: '#f0e8c0',
};

// Roof colors per building type (distinct colored roofs like the screenshot)
const BUILDING_ROOF_COLORS = {
    house: '#c0594a',
    apartment: '#7090b8',
    school: '#5878b0',
    hospital: '#e07070',
    restaurant: '#d88040',
    stadium: '#508850',
    concert_hall: '#9068a8',
    mall: '#c06080',
    office: '#8898a8',
    factory: '#908078',
    gas_station: '#d05040',
    mechanic: '#d89040',
    police: '#4868a8',
    hotel: '#40a0b0',
    park: '#60b050',
    church: '#a09890',
    bank: '#d0a830',
    gym: '#c06080',
    home_base: '#d0c040',
};

// District names (easily extensible for new cities)
const DISTRICTS = [
    { id: 'downtown', name: 'Downtown', color: '#3498db' },
    { id: 'old_town', name: 'Old Town', color: '#e67e22' },
    { id: 'harbor', name: 'Harbor District', color: '#2c3e50' },
    { id: 'industrial', name: 'Industrial Zone', color: '#7f8c8d' },
    { id: 'university', name: 'University Area', color: '#9b59b6' },
    { id: 'financial', name: 'Financial District', color: '#27ae60' },
    { id: 'chinatown', name: 'Chinatown', color: '#e74c3c' },
    { id: 'suburbs', name: 'Suburbs', color: '#1abc9c' },
    { id: 'arts', name: 'Arts Quarter', color: '#f39c12' },
];

// Building name pools for procedural generation (scalable)
const BUILDING_NAMES = {
    hospital: ['City General Hospital', 'Mercy Medical Center', 'St. Mary Hospital', 'Central Care Hospital'],
    school: ['Lincoln Elementary', 'Washington High School', 'Roosevelt Academy', 'Jefferson School'],
    restaurant: ['Golden Dragon', 'Pizza Palace', 'Burger Joint', 'Sushi Express', 'The Steakhouse'],
    stadium: ['City Stadium', 'Sports Arena', 'Ballpark', 'Athletic Field'],
    concert_hall: ['Grand Theater', 'Opera House', 'Music Hall', 'Concert Center'],
    mall: ['Central Mall', 'Shopping Plaza', 'Market Square', 'Retail Center'],
    office: ['Tower Plaza', 'Business Center', 'Corporate Tower', 'Office Complex'],
    factory: ['Industrial Plant', 'Manufacturing Co', 'Factory Complex', 'Production Facility'],
    gas_station: ['Shell Station', 'BP Gas', 'Exxon Station', 'Quick Fuel', 'Gas-N-Go'],
    mechanic: ['Auto Repair', 'Car Care Center', 'Quick Fix', 'Garage Plus', 'Auto Service'],
    police: ['Police Station', 'Precinct HQ', 'Law Enforcement Center'],
    hotel: ['Grand Hotel', 'City Inn', 'Comfort Stay', 'Plaza Hotel'],
    church: ['Community Church', 'St. Cathedral', 'First Church', 'Trinity Chapel'],
    bank: ['First Bank', 'City Bank', 'National Bank', 'Trust Bank'],
    gym: ['Fit Gym', 'Power House', 'Workout Center', 'Fitness Plus'],
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

// Car models available for purchase
const CAR_MODELS = [
    {
        id: 'starter_cab',
        name: 'City Cab',
        price: 0,
        color: '#f5c518',
        desc: 'Your trusty starter taxi. Reliable but nothing special.',
        stats: { maxSpeed: 180, acceleration: 80, fuelCapacity: 100, grip: 1.0, brakes: 1.0, durability: 100, fareBonus: 1.0, fuelEfficiency: 1.0 },
        width: 40, height: 22,
    },
    {
        id: 'compact',
        name: 'EcoRun Compact',
        price: 800,
        color: '#27ae60',
        desc: 'Fuel-efficient compact. Great mileage, low maintenance.',
        stats: { maxSpeed: 160, acceleration: 70, fuelCapacity: 80, grip: 1.1, brakes: 1.0, durability: 90, fareBonus: 1.0, fuelEfficiency: 0.6 },
        width: 36, height: 20,
    },
    {
        id: 'sedan',
        name: 'ComfortLine Sedan',
        price: 2000,
        color: '#2980b9',
        desc: 'Spacious sedan. Passengers love the comfort — higher fares.',
        stats: { maxSpeed: 200, acceleration: 90, fuelCapacity: 120, grip: 1.1, brakes: 1.2, durability: 120, fareBonus: 1.25, fuelEfficiency: 0.9 },
        width: 44, height: 24,
    },
    {
        id: 'suv',
        name: 'RoadKing SUV',
        price: 4500,
        color: '#8e44ad',
        desc: 'Tough SUV. High durability and grip, handles any weather.',
        stats: { maxSpeed: 190, acceleration: 85, fuelCapacity: 160, grip: 1.5, brakes: 1.3, durability: 180, fareBonus: 1.15, fuelEfficiency: 1.3 },
        width: 46, height: 26,
    },
    {
        id: 'sports',
        name: 'Veloce GT',
        price: 8000,
        color: '#e74c3c',
        desc: 'Fast sports car. Blazing speed, great brakes, but fragile.',
        stats: { maxSpeed: 300, acceleration: 140, fuelCapacity: 90, grip: 1.4, brakes: 1.8, durability: 80, fareBonus: 1.1, fuelEfficiency: 1.4 },
        width: 42, height: 20,
    },
    {
        id: 'luxury',
        name: 'Prestige Limo',
        price: 15000,
        color: '#1a1a2e',
        desc: 'Ultimate luxury. VIPs flock to you. Huge fare bonus.',
        stats: { maxSpeed: 240, acceleration: 100, fuelCapacity: 140, grip: 1.3, brakes: 1.5, durability: 150, fareBonus: 1.6, fuelEfficiency: 1.1 },
        width: 50, height: 24,
    },
];

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
const FUEL_CONSUMPTION_RATE = 0.0015; // per pixel moved — generous fuel economy
const REPAIR_COST_PER_PERCENT = 1.5;
const FUEL_COST_PER_LITER = 1.5;
const BASE_FARE_PER_TILE = 2.5;
const TIP_CHANCE = 0.45;
const TIP_RANGE = [2, 15];
const SPEED_FINE_AMOUNT = 30;
const SPEED_LIMIT = 120; // city speed limit (km/h display speed)
const THIEF_STEAL_RANGE = [10, 40];
const ACCIDENT_DAMAGE_RANGE = [5, 15];

// Time system (1 real second = X game minutes)
const TIME_SCALE = 2; // slow realistic pace
const DAY_START_HOUR = 6;

// Passenger spawn
const BASE_PASSENGER_SPAWN_INTERVAL = 1800; // ms — more passengers
const MAX_PASSENGERS = 30;
const MAX_AI_TAXIS = 3;
const MAX_NPC_CARS = 10;

// Fatigue
const MAX_FATIGUE = 100;
const FATIGUE_RATE = 0.03; // per real second — much slower
const FATIGUE_REST_RATE = 15; // recovery per real second at home — faster rest
const FATIGUE_PENALTY_THRESHOLD = 85; // above this, driving gets harder — more forgiving

// Event durations (game minutes)
const EVENT_DURATION = 60;

// Physics
const FRICTION = 0.97;
const TURN_SPEED = 2.5;
const REVERSE_SPEED_FACTOR = 0.4;

// Economy - Fuel price variation per station
const FUEL_PRICE_MIN = 1.5;
const FUEL_PRICE_MAX = 3.5;
const FUEL_PRICE_FLUCTUATION = 0.3; // +/- per hour

// Daily expenses
const DAILY_INSURANCE = 8;
const DAILY_PARKING_FEE = 4;
const DAILY_PHONE_PLAN = 3;

// Tire system
const TIRE_MAX_HEALTH = 100;
const TIRE_WEAR_RATE = 0.0008;  // per pixel moved — slower wear
const TIRE_RAIN_WEAR_MULT = 1.2;
const TIRE_BLOWOUT_PULL = 0.8;  // steering pull when blown — manageable

// Passenger rating
const RATING_INITIAL = 4.0;
const RATING_SMOOTH_FARES = 20; // rolling average window

// VIP passengers
const VIP_CHANCE = 0.08;
const VIP_FARE_MULTIPLIER = 3.5;
const VIP_MIN_CAR_HEALTH = 80;
const VIP_WAIT_TIME = 15; // seconds - impatient

// Luggage
const LUGGAGE_CHANCE = 0.25;
const LUGGAGE_LOAD_TIME = 2.0; // seconds
const LUGGAGE_TIP_BONUS = 1.5;

// Pedestrians
const MAX_PEDESTRIANS = 25;
const PEDESTRIAN_SPEED = 25;
const PEDESTRIAN_HIT_FINE = 75;

// Buses
const MAX_BUSES = 3;
const BUS_SPEED = 35;
const BUS_STOP_TIME = 4; // seconds at each stop

// Traffic lights
const RED_LIGHT_FINE = 50;
const TRAFFIC_LIGHT_CYCLE = 12; // seconds per full cycle (green -> yellow -> red)
const TRAFFIC_LIGHT_PLACEMENT = 0.35; // % of intersections that get traffic lights

// Speed limits (displayed on roads, camera enforced)
const SPEED_LIMIT_CITY = 120; // km/h display speed in city
const SPEED_LIMIT_SLOW = 80; // km/h in school/hospital zones

// Daily challenges
const CHALLENGE_TYPES = {
    FARES_NO_DAMAGE: { id: 'fares_no_damage', desc: 'Complete {count} fares without taking damage', icon: '🛡️' },
    EARN_BEFORE_TIME: { id: 'earn_before_time', desc: 'Earn ${amount} before {time} PM', icon: '💰' },
    DRIVE_BLOCKS: { id: 'drive_blocks', desc: 'Drive {count} city blocks', icon: '📏' },
    VIP_PASSENGERS: { id: 'vip_passengers', desc: 'Pick up {count} VIP passengers', icon: '⭐' },
    PERFECT_RATING: { id: 'perfect_rating', desc: 'Get {count} 5-star ratings', icon: '🌟' },
    SPEED_LIMITS: { id: 'speed_limits', desc: 'Drive 5km without speeding', icon: '🚦' },
    NO_PASSENGER_WAIT: { id: 'no_passenger_wait', desc: 'Pick up passengers within 10 seconds', icon: '⏱️' },
    NIGHT_DRIVER: { id: 'night_driver', desc: 'Complete 3 fares after 10 PM', icon: '🌙' },
};

const CHALLENGE_REWARDS = {
    MONEY: { type: 'money', icon: '💵' },
    FREE_REPAIR: { type: 'free_repair', icon: '🔧' },
    FREE_FUEL: { type: 'free_fuel', icon: '⛽' },
    TIP_BOOST: { type: 'tip_boost', icon: '💰', duration: 1800 }, // 30 minutes
    XP_BONUS: { type: 'xp_bonus', icon: '⭐', duration: 3600 }, // 1 hour
};

// Highway
const HIGHWAY_SPEED_LIMIT = 350; // no speed cameras on highway
