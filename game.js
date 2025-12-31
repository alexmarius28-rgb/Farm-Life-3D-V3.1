// --- WATER TOWER BUILDING LIMIT ---
function canPlaceWaterTower() {
    const maxTowers = Math.floor(20 / (gameState.level || 1));
    const currentTowers = (gameState.buildings || []).filter(b => b.type === 'water_tower').length;
    return currentTowers < maxTowers;
}

// Hook into building placement logic (example, adapt as needed)
const origPlaceBuilding = window.placeBuilding;
window.placeBuilding = function(type, ...args) {
    if (type === 'water_tower') {
        const maxTowers = Math.floor(20 / (gameState.level || 1));
        const currentTowers = (gameState.buildings || []).filter(b => b.type === 'water_tower').length;
        if (currentTowers >= maxTowers) {
            showNotification(`You can only have ${maxTowers} water towers at your level.`, 'error');
            return;
        }
    }
    if (origPlaceBuilding) return origPlaceBuilding.apply(this, [type, ...args]);
};
// --- WATER TOWER PRODUCTION LOGIC ---
window.checkWaterTowerProduction = function() {
    // Check if player has a Water Tower
    const hasWaterTower = gameState.buildings && gameState.buildings.some(b => b.type === 'water_tower');
    if (!hasWaterTower) return;

    // Unlimited buckets, auto-collect
    if (!gameState.lastWaterProductionTime) gameState.lastWaterProductionTime = Date.now();
    if (gameState.inventory.water_bucket === undefined) gameState.inventory.water_bucket = 0;

    const now = Date.now();
    const elapsed = now - (gameState.lastWaterProductionTime || now);
    const productionTime = 30 * 60 * 1000; // 30 minutes
    const produceAmount = 150;

    if (elapsed >= productionTime) {
        gameState.inventory.water_bucket += produceAmount;
        gameState.lastWaterProductionTime = now;
        const collectionTime = new Date(now).toLocaleTimeString();
        showNotification(`Produced ${produceAmount} Water Buckets!<br><span style='font-size:12px;color:#3498db;'>Collected at: ${collectionTime}</span>`, 'success');
        saveGame && saveGame();
        window.refreshInventory && window.refreshInventory();
    }
};

// --- CROP WATERING AND GROWTH ---
// Each crop must be watered 3 times to grow. If not watered in 1 day, it disappears.
window.checkCropWatering = function() {
    const now = Date.now();
    (gameState.crops || []).forEach((crop, idx) => {
        if (!crop.watered) crop.watered = 0;
        if (!crop.lastWatered) crop.lastWatered = crop.plantedAt || now;
        // If not watered in 1 day (86400000 ms), remove crop
        if (now - crop.lastWatered > 86400000) {
            // Remove crop from gameState and scene
            gameState.crops.splice(idx, 1);
            if (window.removeCropFromScene) window.removeCropFromScene(crop);
            showNotification('A crop has withered due to lack of water.', 'error');
        }
    });
};

// Call these in the main game loop
const origGameTick = window.gameTick;
window.gameTick = function() {
    window.checkWaterTowerProduction && window.checkWaterTowerProduction();
    window.checkCropWatering && window.checkCropWatering();
    if (origGameTick) origGameTick();
};

// Water a crop (call this when player uses water bucket on a crop)
window.waterCrop = function(crop) {
    if (!crop.watered) crop.watered = 0;
    crop.watered++;
    crop.lastWatered = Date.now();
    if (gameState.inventory.water_bucket > 0) {
        gameState.inventory.water_bucket--;
        window.refreshInventory && window.refreshInventory();
    }
    if (crop.watered >= 3) {
        // Mark as ready to grow/harvest
        crop.ready = true;
        showNotification('Crop is fully watered and ready to grow!', 'success');
    } else {
        showNotification(`Crop watered (${crop.watered}/3)`, 'info');
    }
    saveGame && saveGame();
};
window.sellInventoryItem = function(type) {
    const qty = gameState.inventory[type] || 0;
    if (qty <= 0) return;
    const def = BuildingTypes[type];
    const price = Math.floor((def ? def.cost : 10) * 0.6);
    const total = price * qty;
    if (total > 0) {
        addMoney(total);
        SoundEffects.playHarvest();
        checkMissions('sell', type, qty);
        gameState.inventory[type] = 0;
        saveGame();
        window.refreshInventory();
    }
};
// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
// Mobile Detection
const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
const IS_MOBILE = isMobileDevice() || isTouch;

if (IS_MOBILE) {
    console.log('Mobile device detected. Optimizations enabled.');
    // Disable context menu on mobile to prevent accidental right-click
    document.addEventListener('contextmenu', (e) => e.preventDefault(), false);
}

// Ensure Developer always has VIP access
try {
    const ROLES_KEY = 'farmSimRoles';
    const roles = JSON.parse(localStorage.getItem(ROLES_KEY) || '{}');
    if (roles['Developer'] !== 'vip') {
        roles['Developer'] = 'vip';
        localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
        console.log('Developer granted VIP access');
    }
    // Ensure Adi always has VIP access
    if (roles['Adi'] !== 'vip') {
        roles['Adi'] = 'vip';
        localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
        console.log('Adi granted VIP access');
    }
    // Remove Adi from admin role if present
    if (roles['Adi'] === 'admin') {
        roles['Adi'] = 'vip';
        localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
        console.log('Adi removed from admin role');
    }
    // Ensure Iqbal has VIP access (no admin)
    if (roles['Iqbal'] !== 'vip') {
        roles['Iqbal'] = 'vip';
        localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
        console.log('Iqbal granted VIP access');
    }
    // Remove Iqbal from admin role if present
    if (roles['Iqbal'] === 'admin') {
        roles['Iqbal'] = 'vip';
        localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
        console.log('Iqbal removed from admin role, set to VIP');
    }
} catch(e) { console.error('Error granting Developer VIP:', e); }

const TILE_SIZE = 10;
const GRID_SIZE = 20; // 20x20 grid
let gridSize = GRID_SIZE;

const BuildingTypes = {
    // --- LEGACY COMPATIBILITY ---
    'field': { name: 'Field', cost: 50, income: 10, level: 1, category: 'hidden', color: 0x8B4513, type: 'crop_small', desc: 'Legacy', icon: '🌱' },
    'flower_patch': { name: 'Flowers', cost: 100, income: 20, level: 2, category: 'hidden', color: 0xFF69B4, type: 'crop_small', desc: 'Legacy', icon: '🌸' },

    // --- CROPS ---
    'wheat': { name: 'Wheat', cost: 20, income: 5, level: 1, category: 'crop', color: 0xf5deb3, type: 'crop_small', desc: 'Basic grain', icon: '🌾', growthTime: 60 },
    'corn': { name: 'Corn', cost: 40, income: 12, level: 2, category: 'crop', color: 0xffd700, type: 'crop_tall', desc: 'Golden cobs', icon: '🌽', growthTime: 120 },
    'carrot': { name: 'Carrot', cost: 30, income: 8, level: 1, category: 'crop', color: 0xe67e22, type: 'crop_small', desc: 'Orange crunch', icon: '🥕', growthTime: 120 },
    'potato': { name: 'Potato', cost: 35, income: 9, level: 2, category: 'crop', color: 0x8b4513, type: 'crop_small', desc: 'Underground tuber', icon: '🥔', growthTime: 180 },
    'tomato': { name: 'Tomato', cost: 50, income: 15, level: 3, category: 'crop', color: 0xff6347, type: 'crop_bush', desc: 'Juicy red', icon: '🍅', growthTime: 180 },
    'pumpkin': { name: 'Pumpkin', cost: 80, income: 25, level: 4, category: 'crop', color: 0xd35400, type: 'crop_ground', desc: 'Halloween favorite', icon: '🎃', growthTime: 240 },
    'strawberry': { name: 'Strawberry', cost: 120, income: 35, level: 5, category: 'crop', color: 0xff0066, type: 'crop_small', desc: 'Sweet berry', icon: '🍓', growthTime: 300 },
    'lettuce': { name: 'Lettuce', cost: 25, income: 6, level: 1, category: 'crop', color: 0x2ecc71, type: 'crop_small', desc: 'Green leaf', icon: '🥬', growthTime: 360 },
    'radish': { name: 'Radish', cost: 30, income: 7, level: 2, category: 'crop', color: 0xc0392b, type: 'crop_small', desc: 'Spicy root', icon: '🥗', growthTime: 14 },
    'onion': { name: 'Onion', cost: 35, income: 8, level: 2, category: 'crop', color: 0xfdfefe, type: 'crop_small', desc: 'Makes you cry', icon: '🧅', growthTime: 360 },
    'pepper': { name: 'Pepper', cost: 55, income: 16, level: 3, category: 'crop', color: 0xf1c40f, type: 'crop_bush', desc: 'Hot or sweet', icon: '🌶️', growthTime: 360 },
    'cucumber': { name: 'Cucumber', cost: 45, income: 13, level: 3, category: 'crop', color: 0x27ae60, type: 'crop_bush', desc: 'Cool crunch', icon: '🥒', growthTime: 420 },
    'watermelon': { name: 'Watermelon', cost: 90, income: 28, level: 4, category: 'crop', color: 0x2196f3, type: 'crop_ground', desc: 'Summer treat', icon: '🍉', growthTime: 480 },
    'eggplant': { name: 'Eggplant', cost: 60, income: 18, level: 4, category: 'crop', color: 0x8e44ad, type: 'crop_bush', desc: 'Purple veggie', icon: '🍆', growthTime: 540 },
    'pineapple': { name: 'Pineapple', cost: 150, income: 45, level: 6, category: 'crop', color: 0xf39c12, type: 'crop_small', desc: 'Tropical fruit', icon: '🍍', growthTime: 540 },
    'grapes': { name: 'Grapes', cost: 130, income: 40, level: 5, category: 'crop', color: 0x9b59b6, type: 'crop_tall', desc: 'Vine fruit', icon: '🍇', growthTime: 600 },
    'blueberries': { name: 'Blueberry', cost: 110, income: 32, level: 5, category: 'crop', color: 0x2980b9, type: 'crop_bush', desc: 'Blue gems', icon: '🫐', growthTime: 600 },
    'raspberries': { name: 'Raspberry', cost: 115, income: 33, level: 5, category: 'crop', color: 0xe91e63, type: 'crop_bush', desc: 'Red gems', icon: '🍒', growthTime: 600 },
    'rice': { name: 'Rice', cost: 40, income: 10, level: 2, category: 'crop', color: 0xecf0f1, type: 'crop_small', desc: 'Staple grain', icon: '🍚', growthTime: 300 },
    'coffee': { name: 'Coffee', cost: 200, income: 60, level: 7, category: 'crop', color: 0x3e2723, type: 'crop_bush', desc: 'Morning brew', icon: '☕', growthTime: 70 },
    'cotton': { name: 'Cotton', cost: 70, income: 20, level: 3, category: 'crop', color: 0xffffff, type: 'crop_bush', desc: 'Soft fiber', icon: '☁️', growthTime: 28 },
    'sunflower': { name: 'Sunflower', cost: 60, income: 18, level: 3, category: 'crop', color: 0xf1c40f, type: 'crop_tall', desc: 'Follows sun', icon: '🌻', growthTime: 36 },
    'tulip': { name: 'Tulip', cost: 80, income: 15, level: 2, category: 'crop', color: 0xe91e63, type: 'crop_small', desc: 'Pretty flower', icon: '🌷', growthTime: 18 },
    'rose': { name: 'Rose', cost: 100, income: 25, level: 4, category: 'crop', color: 0xc0392b, type: 'crop_bush', desc: 'Romantic', icon: '🌹', growthTime: 48 },
    
    // --- PLOTS ---
    'plot': { name: 'Plot Tile', cost: 15, income: 0, level: 1, category: 'plot', color: 0x8B4513, type: 'plot_tile', desc: 'Grow seeds here', icon: '🟫', power: 0 },

    // --- BUILDINGS ---
    'barn': { name: 'Barn', cost: 200, income: 30, level: 1, category: 'building', color: 0xcc0000, type: 'building_animal', desc: 'Stores animals', icon: '🐮', width: 2, depth: 2, power: -5 },
    'coop': { name: 'Coop', cost: 300, income: 45, level: 3, category: 'building', color: 0xFFD700, type: 'building_animal', desc: 'Chickens live here', icon: '🐔', power: -5 },
    'silo': { name: 'Silo', cost: 800, income: 80, level: 5, category: 'building', color: 0xA9A9A9, type: 'building_tower', desc: 'Grain storage', icon: '🏭', power: -10 },
    'house': { name: 'House', cost: 500, income: 5, level: 1, category: 'building', color: 0x0000cc, type: 'building_house', desc: 'Farmer lives here', icon: '🏠', width: 2, depth: 2, power: -5 },
    'mill': { name: 'Windmill', cost: 1200, income: 100, level: 6, category: 'building', color: 0xffffff, type: 'building_tower', desc: 'Grinds grain', icon: '🌬️', power: -10 },
    'bakery': { name: 'Bakery', cost: 1500, income: 150, level: 7, category: 'building', color: 0xd35400, type: 'building_shop', desc: 'Bakes bread', icon: '🥖', power: -20 },
    'dairy': { name: 'Dairy', cost: 1800, income: 180, level: 8, category: 'building', color: 0xecf0f1, type: 'building_shop', desc: 'Milk products', icon: '🥛', power: -20 },
    'sugar_mill': { name: 'Sugar Mill', cost: 2000, income: 200, level: 9, category: 'building', color: 0x95a5a6, type: 'building_factory', desc: 'Sweet stuff', icon: '🍬', width: 2, depth: 2, power: -25 },
    'textile_mill': { name: 'Textile', cost: 2200, income: 220, level: 10, category: 'building', color: 0x8e44ad, type: 'building_factory', desc: 'Makes cloth', icon: '🧶', width: 2, depth: 2, power: -25 },
    'jam_maker': { name: 'Jam Factory', cost: 2500, income: 250, level: 11, category: 'building', color: 0xe91e63, type: 'building_factory', desc: 'Berry jam', icon: '🍯', width: 2, depth: 2, power: -25 },
    'grill': { name: 'BBQ Grill', cost: 1000, income: 90, level: 5, category: 'building', color: 0x333333, type: 'building_shop', desc: 'Tasty meat', icon: '🍖', power: -10 },
    'juice_press': { name: 'Juice Press', cost: 1300, income: 120, level: 6, category: 'building', color: 0xf39c12, type: 'building_shop', desc: 'Fresh juice', icon: '🧃', power: -15 },
    'ice_cream': { name: 'Ice Cream', cost: 3000, income: 300, level: 12, category: 'building', color: 0xffcdd2, type: 'building_shop', desc: 'Cold treats', icon: '🍦', power: -30 },
    'popcorn': { name: 'Popcorn', cost: 1100, income: 100, level: 5, category: 'building', color: 0xffeb3b, type: 'building_shop', desc: 'Snack time', icon: '🍿', power: -10 },
    'coffee_kiosk': { name: 'Coffee Hut', cost: 1600, income: 160, level: 7, category: 'building', color: 0x795548, type: 'building_shop', desc: 'Caffeine fix', icon: '☕', power: -15 },
    'pig_pen': { name: 'Pig Pen', cost: 600, income: 60, level: 4, category: 'building', color: 0xf48fb1, type: 'building_animal', desc: 'Oink oink', icon: '🐷', width: 2, depth: 2, power: -5 },
    'sheep_pasture': { name: 'Sheep Pen', cost: 700, income: 70, level: 4, category: 'building', color: 0xffffff, type: 'building_animal', desc: 'Wooly friends', icon: '🐑', width: 2, depth: 2, power: -5 },
    'goat_yard': { name: 'Goat Yard', cost: 750, income: 75, level: 5, category: 'building', color: 0xa1887f, type: 'building_animal', desc: 'Climbers', icon: '🐐', width: 2, depth: 2, power: -5 },
    'duck_pond': { name: 'Duck Pond', cost: 900, income: 90, level: 6, category: 'building', color: 0x03a9f4, type: 'building_animal', desc: 'Quack quack', icon: '🦆', width: 2, depth: 2, power: -5 },
    'stable': { name: 'Stable', cost: 2500, income: 100, level: 10, category: 'building', color: 0x5d4037, type: 'building_animal', desc: 'Horses', icon: '🐴', width: 3, depth: 2, power: -10 },
    'breeding_center': { name: 'Breeding Center', cost: 1800, income: 0, level: 6, category: 'building', color: 0xe91e63, type: 'building_breeding', desc: 'Breed animals here', icon: '💕', width: 2, depth: 2, power: -5 },
    'warehouse': { name: 'Warehouse', cost: 1000, income: 50, level: 5, category: 'building', color: 0x607d8b, type: 'building_factory', desc: 'Big storage', icon: '📦', width: 2, depth: 2, power: -15 },
    'water_tower': { name: 'Water Twr', cost: 500, income: 20, level: 3, category: 'building', color: 0x3498db, type: 'building_tower', desc: 'Hydration', icon: '💧', power: -5 },
    'solar': { name: 'Solar Panel', cost: 1500, income: 0, level: 8, category: 'building', color: 0x2c3e50, type: 'building_tech', desc: 'Green energy', icon: '☀️', power: 30 },
    'generator': { name: 'Generator', cost: 1200, income: 0, level: 7, category: 'building', color: 0xe74c3c, type: 'building_tech', desc: 'Power up', icon: '⚡', power: 50 },
    'cottage': { name: 'Cottage', cost: 2000, income: 10, level: 8, category: 'building', color: 0xd35400, type: 'building_house', desc: 'Cozy home', icon: '🏡', width: 2, depth: 2, power: -10 },
    'mansion': { name: 'Mansion', cost: 10000, income: 50, level: 20, category: 'building', color: 0xecf0f1, type: 'building_house', desc: 'Luxury living', icon: '🏰', width: 3, depth: 3, power: -20 },
    'guest_house': { name: 'Guest House', cost: 3000, income: 20, level: 10, category: 'building', color: 0x1abc9c, type: 'building_house', desc: 'For friends', icon: '🏘️', width: 2, depth: 2, power: -10 },
    'market': { name: 'Market', cost: 800, income: 80, level: 4, category: 'building', color: 0xf1c40f, type: 'building_shop', desc: 'Sell goods', icon: '🏪', width: 2, depth: 2, power: -10 },
    'florist': { name: 'Florist', cost: 900, income: 90, level: 5, category: 'building', color: 0xe91e63, type: 'building_shop', desc: 'Flower power', icon: '💐', power: -10 },
    'tool_shed': { name: 'Tool Shed', cost: 400, income: 10, level: 2, category: 'building', color: 0x7f8c8d, type: 'building_house', desc: 'Store tools', icon: '🔧', power: -5 },
    'garage': { name: 'Garage', cost: 1500, income: 30, level: 6, category: 'building', color: 0x95a5a6, type: 'building_house', desc: 'Car park', icon: '🚗', width: 2, depth: 2, power: -10 },
    
    // --- ANIMALS (Shop) ---
    'animal_cow': { name: 'Cow', cost: 300, income: 0, level: 3, category: 'animal', color: 0xffffff, kind: 'cow', desc: 'For breeding', icon: '🐮' },
    'animal_chicken': { name: 'Chicken', cost: 150, income: 0, level: 2, category: 'animal', color: 0xfff5e1, kind: 'chicken', desc: 'For breeding', icon: '🐔' },
    'animal_pig': { name: 'Pig', cost: 250, income: 0, level: 3, category: 'animal', color: 0xf48fb1, kind: 'pig', desc: 'For breeding', icon: '🐷' },
    'animal_sheep': { name: 'Sheep', cost: 280, income: 0, level: 3, category: 'animal', color: 0xffffff, kind: 'sheep', desc: 'For breeding', icon: '🐑' },
    'animal_goat': { name: 'Goat', cost: 260, income: 0, level: 3, category: 'animal', color: 0xa1887f, kind: 'goat', desc: 'For breeding', icon: '🐐' },
    'animal_duck': { name: 'Duck', cost: 160, income: 0, level: 2, category: 'animal', color: 0xffffcc, kind: 'duck', desc: 'For breeding', icon: '🦆' },
    'animal_horse': { name: 'Horse', cost: 500, income: 0, level: 6, category: 'animal', color: 0x8d6e63, kind: 'horse', desc: 'For breeding', icon: '🐴' },


    // --- PRODUCTS ---
    'truffle': { name: 'Truffle', cost: 100, category: 'product', color: 0x3e2723, icon: '🍄' },
    'egg': { name: 'Egg', cost: 0, category: 'product', color: 0xffffff, icon: '🥚' },
    'apple': { name: 'Apple', cost: 50, category: 'product', color: 0xc0392b, icon: '🍎' },
    'orange': { name: 'Orange', cost: 55, category: 'product', color: 0xff9800, icon: '🍊' },
    'lemon': { name: 'Lemon', cost: 55, category: 'product', color: 0xffeb3b, icon: '🍋' },
    'cherry': { name: 'Cherry', cost: 60, category: 'product', color: 0xe91e63, icon: '🍒' },
    'water_bucket': { name: 'Water Bucket', cost: 0, category: 'product', color: 0x3498db, icon: '🪣' },

    // --- TREES ---
    'tree_apple': { name: 'Apple Tree', cost: 150, income: 10, level: 3, category: 'tree', color: 0xc0392b, type: 'tree_fruit', desc: 'Fruit tree', icon: '🍎', growthTime: 1800, product: 'apple' },
    'tree_orange': { name: 'Orange Tree', cost: 160, income: 12, level: 4, category: 'tree', color: 0xff9800, type: 'tree_fruit', desc: 'Citrus fruit', icon: '🍊', growthTime: 1800, product: 'orange' },
    'tree_lemon': { name: 'Lemon Tree', cost: 160, income: 12, level: 4, category: 'tree', color: 0xffeb3b, type: 'tree_fruit', desc: 'Sour citrus', icon: '🍋', growthTime: 1800, product: 'lemon' },
    'tree_cherry': { name: 'Cherry Tree', cost: 180, income: 15, level: 5, category: 'tree', color: 0xe91e63, type: 'tree_fruit', desc: 'Sweet cherry', icon: '🍒', growthTime: 1800, product: 'cherry' },

    // --- DECORATIONS ---
    'fence_white': { name: 'White Fence', cost: 10, income: 0, level: 1, category: 'decoration', color: 0xffffff, type: 'deco_fence', desc: 'Classic look', icon: '🚧' },
    'fence_wood': { name: 'Wood Fence', cost: 10, income: 0, level: 1, category: 'decoration', color: 0x8b4513, type: 'deco_fence', desc: 'Rustic look', icon: '🪵' },
    'fence_stone': { name: 'Stone Wall', cost: 15, income: 0, level: 2, category: 'decoration', color: 0x7f8c8d, type: 'deco_fence', desc: 'Sturdy wall', icon: '🧱' },
    'path_dirt': { name: 'Dirt Path', cost: 5, income: 0, level: 1, category: 'decoration', color: 0xd7ccc8, type: 'deco_path', desc: 'Simple path', icon: '🛤️' },
    'path_stone': { name: 'Stone Path', cost: 10, income: 0, level: 2, category: 'decoration', color: 0x9e9e9e, type: 'deco_path', desc: 'Paved walk', icon: '🌑' },
    'path_brick': { name: 'Brick Path', cost: 15, income: 0, level: 3, category: 'decoration', color: 0xc0392b, type: 'deco_path', desc: 'Red bricks', icon: '🧱' },
    'hedge': { name: 'Hedge', cost: 20, income: 0, level: 2, category: 'decoration', color: 0x2ecc71, type: 'deco_block', desc: 'Green wall', icon: '🌳' },
    'fountain': { name: 'Fountain', cost: 500, income: 5, level: 5, category: 'decoration', color: 0x3498db, type: 'deco_water', desc: 'Pretty water', icon: '⛲' },
    'bench': { name: 'Bench', cost: 50, income: 0, level: 2, category: 'decoration', color: 0x8b4513, type: 'deco_prop', desc: 'Sit down', icon: '🪑' },
    'streetlight': { name: 'Streetlight', cost: 100, income: 0, level: 4, category: 'decoration', color: 0xf1c40f, type: 'deco_pole', desc: 'Light up', icon: '💡' },
    'scarecrow': { name: 'Scarecrow', cost: 75, income: 1, level: 3, category: 'decoration', color: 0xe67e22, type: 'deco_prop', desc: 'Scare birds', icon: '👻' },
    'hay_bale': { name: 'Hay Bale', cost: 20, income: 0, level: 1, category: 'decoration', color: 0xffeb3b, type: 'deco_block', desc: 'Farm vibe', icon: '🌾' },
    'flower_pot': { name: 'Flower Pot', cost: 25, income: 0, level: 1, category: 'decoration', color: 0xe91e63, type: 'deco_prop', desc: 'Potted bloom', icon: '🪴' },
    'statue': { name: 'Statue', cost: 1000, income: 10, level: 10, category: 'decoration', color: 0xbdc3c7, type: 'deco_prop', desc: 'Artistic', icon: '🗿' },
    'pond': { name: 'Small Pond', cost: 300, income: 5, level: 4, category: 'decoration', color: 0x03a9f4, type: 'deco_water', desc: 'Fishy', icon: '🐟' },
    'tree_oak': { name: 'Oak Tree', cost: 100, income: 2, level: 2, category: 'decoration', color: 0x228b22, type: 'deco_tree', desc: 'Big shade', icon: '🌳', growthTime: 300 },
    'tree_pine': { name: 'Pine Tree', cost: 100, income: 2, level: 2, category: 'decoration', color: 0x2e7d32, type: 'deco_tree', desc: 'Evergreen', icon: '🌲', growthTime: 300 },
    'bush': { name: 'Bush', cost: 30, income: 0, level: 1, category: 'decoration', color: 0x4caf50, type: 'deco_bush', desc: 'Shrubbery', icon: '🌿' },

    // --- ECSTATIC DECORATIONS ---
    // New Players
    'gnome': { name: 'Garden Gnome', cost: 50, income: 0, level: 1, category: 'decoration', color: 0xe74c3c, type: 'deco_prop', desc: 'Lucky charm', icon: '🎅' },
    'rock_cluster': { name: 'Rock Cluster', cost: 40, income: 0, level: 1, category: 'decoration', color: 0x7f8c8d, type: 'deco_prop', desc: 'Natural vibes', icon: '🪨' },
    'flower_bed': { name: 'Flower Bed', cost: 60, income: 0, level: 2, category: 'decoration', color: 0xff69b4, type: 'deco_prop', desc: 'Colorful blooms', icon: '🌺' },

    // Old Players / High Level
    'bonfire': { name: 'Bonfire', cost: 500, income: 0, level: 5, category: 'decoration', color: 0xd35400, type: 'deco_fire', desc: 'Cozy fire', icon: '🔥' },
    'gazebo': { name: 'Gazebo', cost: 5000, income: 20, level: 12, category: 'decoration', color: 0xffffff, type: 'deco_structure', desc: 'Fancy shelter', icon: '🛖', width: 2, depth: 2 },
    'golden_cow': { name: 'Golden Cow', cost: 50000, income: 100, level: 25, category: 'decoration', color: 0xffd700, type: 'deco_prop', desc: 'Ultimate status', icon: '🏆' },

    'tractor': { name: 'Tractor', cost: 800, income: 0, level: 4, category: 'vehicle', color: 0xe74c3c, type: 'vehicle_basic', desc: 'Farming vehicle', icon: '🚜' },
    'harvester': { name: 'Harvester', cost: 1500, income: 0, level: 7, category: 'vehicle', color: 0x2ecc71, type: 'vehicle_basic', desc: 'Harvest crops', icon: '🚜' },
    'pickup_truck': { name: 'Pickup Truck', cost: 900, income: 0, level: 4, category: 'vehicle', color: 0x34495e, type: 'vehicle_basic', desc: 'Utility transport', icon: '🛻' },
    'taxi': { name: 'Canberra Elite Taxis', cost: 600, income: 0, level: 3, category: 'vehicle', color: 0xffffff, type: 'vehicle_basic', desc: 'White Taxi', icon: '🚕', signText: 'Canberra Elite Taxis' },
    'sprayer': { name: 'Sprayer', cost: 1100, income: 0, level: 5, category: 'vehicle', color: 0x1abc9c, type: 'vehicle_basic', desc: 'Crop sprayer', icon: '💦' },
    'seed_drill': { name: 'Seed Drill', cost: 1200, income: 0, level: 6, category: 'vehicle', color: 0xf39c12, type: 'vehicle_basic', desc: 'Plant seeds', icon: '🌰' },
    'plow': { name: 'Plow', cost: 1000, income: 0, level: 5, category: 'vehicle', color: 0x7f8c8d, type: 'vehicle_basic', desc: 'Till soil', icon: '🚜' },
    'road': { name: 'Road', cost: 20, income: 0, level: 3, category: 'decoration', color: 0x333333, type: 'deco_road', desc: 'Paved road', icon: '🛣️' },
    'main_house': { name: 'Main House', cost: 1000, income: 0, level: 1, category: 'building', color: 0x3498db, type: 'main_house', desc: 'Your home base', icon: '🏡', width: 3, depth: 3 },
    'milk_bottle': { name: 'Milk Bottle', cost: 0, income: 50, level: 1, category: 'product', color: 0xffffff, type: 'product', desc: 'Fresh Milk', icon: '<img src="data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'64\' height=\'64\' viewBox=\'0 0 64 64\'><path d=\'M22 4 L42 4 L42 14 L50 24 L50 60 L14 60 L14 24 L22 14 Z\' fill=\'%23ffffff\' stroke=\'%23333\' stroke-width=\'2\'/><rect x=\'14\' y=\'32\' width=\'36\' height=\'16\' fill=\'%233498db\'/><text x=\'32\' y=\'44\' font-family=\'sans-serif\' font-size=\'10\' fill=\'white\' text-anchor=\'middle\'>MILK</text></svg>" width="32" height="32">' }
};

// ------------------------------------------------------------------
// COOP UPGRADE SYSTEM
// ------------------------------------------------------------------
window.showCoopUpgradeMenu = function(selectedBuilding) {
    const modal = document.getElementById('animal-building-modal');
    const content = document.getElementById('animal-modal-content');
    const btn = document.getElementById('animal-upgrade-btn');
    const collectBtn = document.getElementById('animal-collect-btn');
    
    modal.style.display = 'block';
    collectBtn.style.display = 'none'; 
    
    // Find the coop building if not provided
    let building = selectedBuilding || (gameState.buildings && gameState.buildings.find(b => b.type === 'coop'));
    if (!building) {
        alert('No Coop found!');
        return;
    }
    if (!building.level) building.level = 1;
    
    // Override upgrade button action with the building
    btn.onclick = () => window.upgradeCoop(building);

    const currentLevel = building.level;
    const nextLevel = currentLevel + 1;
    
    const currentInfo = CoopLevels[currentLevel];
    
    let html = `<p style="font-size: 16px; margin-bottom: 20px;">Current Level: <strong style="color:#f1c40f">${currentLevel}</strong></p>`;
    html += `<p style="font-size: 14px; margin-bottom: 20px;">Produces: <strong>${currentInfo.eggs} Eggs</strong> every <strong>${currentInfo.productionTime / 60000} mins</strong></p>`;
    
    if (currentLevel >= 5) {
        html += `<p style="font-size: 18px; color: #2ecc71;">Maximum Level Reached!</p>`;
        btn.style.display = 'none';
    } else {
        const reqs = CoopLevels[nextLevel];
        if (!reqs) {
             html += `<p>Coming Soon...</p>`;
             btn.style.display = 'none';
        } else {
            btn.style.display = 'block';
            html += `<h3 style="margin-bottom: 15px;">Upgrade to Level ${nextLevel}</h3>`;
            html += `<p style="font-size: 14px; margin-bottom: 10px;">New Production: <strong>${reqs.eggs} Eggs</strong> every <strong>${reqs.productionTime / 60000} mins</strong></p>`;
            const canAfford = gameState.money >= reqs.cost;
            html += `
                <div class="upgrade-cost-display" style="border: 1px solid ${canAfford ? '#2ecc71' : '#e74c3c'}">
                    <span>💰 Cost:</span>
                    <span style="color:${canAfford ? '#2ecc71' : '#e74c3c'}">$${reqs.cost}</span>
                </div>
            `;

            html += `<h4 style="text-align: left; margin-bottom: 10px;">Requirements:</h4>`;
            html += `<ul class="upgrade-req-list">`;
            
            let canUpgrade = true;
            if (!canAfford) canUpgrade = false;
            
            if (reqs.req) {
                for (const [crop, amount] of Object.entries(reqs.req)) {
                    const have = gameState.inventory[crop] || 0;
                    const ok = have >= amount;
                    if (!ok) canUpgrade = false;
                    
                    const cropDef = BuildingTypes[crop];
                    const cropName = cropDef ? cropDef.name : crop;
                    const icon = cropDef ? cropDef.icon : '❓';
                    
                    html += `
                        <li class="upgrade-req-item" style="border-left: 4px solid ${ok ? '#2ecc71' : '#e74c3c'}">
                            <span class="upgrade-req-icon">${icon}</span>
                            <div class="upgrade-req-info">
                                <span class="upgrade-req-name">${cropName}</span>
                                <span class="upgrade-req-count" style="color:${ok ? '#2ecc71' : '#e74c3c'}">
                                    ${have} / ${amount}
                                </span>
                            </div>
                            <span class="upgrade-status-icon" style="color:${ok ? '#2ecc71' : '#e74c3c'}">
                                ${ok ? '✔' : '✖'}
                            </span>
                        </li>
                    `;
                }
            }
            html += `</ul>`;
            
            btn.disabled = !canUpgrade;
            if (!canUpgrade) {
                btn.style.background = '#95a5a6';
                btn.style.cursor = 'not-allowed';
                btn.innerText = "Requirements Not Met";
            } else {
                btn.style.background = ''; // Reset to default CSS
                btn.style.cursor = 'pointer';
                btn.innerText = "Upgrade Coop";
            }
        }
    }
    
    content.innerHTML = html;
};

window.upgradeCoop = function(selectedBuilding) {
    // Find the coop building if not provided
    let building = selectedBuilding || (gameState.buildings && gameState.buildings.find(b => b.type === 'coop'));
    if (!building) {
        alert('No Coop found!');
        return;
    }
    
    if (!building.level) building.level = 1;
    const currentLevel = building.level;
    const nextLevel = currentLevel + 1;
    const reqs = CoopLevels[nextLevel];
    
    if (!reqs) return;
    
    // Validate again
    if (gameState.money < reqs.cost) return;
    if (reqs.req) {
        for (const [crop, amount] of Object.entries(reqs.req)) {
            if ((gameState.inventory[crop] || 0) < amount) return;
        }
    }
    
    // Deduct
    addMoney(-reqs.cost);
    if (reqs.req) {
        for (const [crop, amount] of Object.entries(reqs.req)) {
            gameState.inventory[crop] -= amount;
        }
    }
    
    // Level Up
    building.level = nextLevel;
    showNotification(`Upgraded Coop to Level ${nextLevel}!`, "success");
    SoundEffects.playBuild();

    // Immediately update the 3D model for the coop
    const mesh = objects.find(o => o.userData.type === 'coop' && o.position.x === building.x && o.position.z === building.z);
    if (mesh) {
        scene.remove(mesh);
        const idx = objects.indexOf(mesh);
        if (idx !== -1) objects.splice(idx, 1);
        const newMesh = createDetailedBuilding('coop', building);
        newMesh.position.copy(mesh.position);
        scene.add(newMesh);
        objects.push(newMesh);
    }
    
    // Refresh UI with the specific building
    showCoopUpgradeMenu(building);
    saveGame();
    
    if (nextLevel === 5) {
        showNotification("Congratulations! You have fully upgraded your Coop!", "success");
    }
};

window.checkEggProduction = function() {
    if (!gameState.coopLevel) gameState.coopLevel = 1; // Default
    
    // Check if player has a Coop building
    const hasCoop = gameState.buildings && gameState.buildings.some(b => b.type === 'coop');
    if (!hasCoop) return;
    
    // Check power
    if (gameState.electricity) {
        const isPowered = gameState.electricity.produced >= gameState.electricity.consumed;
        if (!isPowered) return;
    }
    
    const level = gameState.coopLevel;
    const info = CoopLevels[level];
    if (!info) return;

    const now = Date.now();
    const elapsed = now - (gameState.lastEggProductionTime || now);

    if (!gameState.lastEggProductionTime) {
        gameState.lastEggProductionTime = now;
        return;
    }

    if (elapsed >= info.productionTime) {
        // Produce eggs
        const amount = info.eggs;
        // Create a pending collection for NPC farmers to pick up
        const coopObj = objects.find(o => o.userData.type === 'coop');
        const pos = coopObj ? coopObj.position.clone() : null;
        const pending = {
            id: 'pending_egg_' + Date.now() + '_' + Math.floor(Math.random()*9999),
            type: 'egg',
            amount: amount,
            producedAt: now,
            buildingType: 'coop',
            pos: pos,
            collected: false
        };
        gameState.pendingCollections = gameState.pendingCollections || [];
        gameState.pendingCollections.push(pending);
        gameState.lastEggProductionTime = now;

        // Visual feedback for ready product
        if (coopObj) playEggCollectionAnimation(coopObj.position);
        showNotification(`${amount} Eggs are ready for pickup by farmers.`, 'info');
        saveGame();
    }
};

function playEggCollectionAnimation(position) {
    const el = document.createElement('div');
    el.innerHTML = '<span style="font-size: 40px;">🥚</span><div style="background:#f1c40f; color:black; padding:2px 5px; border-radius:4px; font-weight:bold; font-size:12px; position:absolute; bottom:-10px; left:50%; transform:translateX(-50%);">EGGS</div>';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '2000';
    el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
    el.style.transition = 'all 1.5s ease-out';
    el.style.opacity = '1';
    
    // Project position
    const pos = position.clone();
    pos.y += 5; // Start above coop
    pos.project(camera);
    
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = (pos.x + 1) / 2 * w;
    const y = (1 - pos.y) / 2 * h;
    
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    
    document.body.appendChild(el);
    
    // Animate
    requestAnimationFrame(() => {
        el.style.transform = 'translateY(-100px) scale(1.5)';
        el.style.opacity = '0';
    });
    
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, 1500);
}

function updateCoopTimers() {
    if (!gameState.coopLevel) return;
    const level = gameState.coopLevel;
    const info = CoopLevels[level];
    if (!info) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    objects.forEach(obj => {
        if (obj.userData.type !== 'coop') return;

        // Create UI if missing
        if (!obj.userData.timerEl) {
            const el = document.createElement('div');
            el.className = 'crop-timer'; // Reuse crop timer styling
            el.innerHTML = `
                <div class="timer-content">
                    <span class="timer-icon">🥚</span>
                    <span class="timer-text">Wait...</span>
                    <div class="timer-bar-bg"><div class="timer-bar-fill" style="background: #f1c40f;"></div></div>
                </div>
            `;
            
            document.body.appendChild(el);
            obj.userData.timerEl = el;
            
            // Cache refs
            obj.userData.timerRefs = {
                container: el,
                text: el.querySelector('.timer-text'),
                fill: el.querySelector('.timer-bar-fill')
            };
        }
        
        const refs = obj.userData.timerRefs;
        
        // Position
        const pos = obj.position.clone();
        pos.y += 6; // Higher than crops
        pos.project(camera);
        
        // Check visibility
        const onScreen = pos.x > -1 && pos.x < 1 && pos.y > -1 && pos.y < 1 && pos.z < 1;
        if (!onScreen) {
            refs.container.style.display = 'none';
            return;
        }
        
        refs.container.style.display = 'flex';
        const screenX = (pos.x + 1) / 2 * w;
        const screenY = (1 - pos.y) / 2 * h;
        refs.container.style.left = `${screenX}px`;
        refs.container.style.top = `${screenY}px`;

        // Calculate Time
        const now = Date.now();
        const elapsed = now - (gameState.lastEggProductionTime || now);
        const totalTime = info.productionTime;
        
        // If ready
        if (elapsed >= totalTime) {
            if (!refs.container.classList.contains('ripe')) {
                refs.container.classList.add('ripe');
                refs.text.innerText = 'COLLECTING...';
                refs.text.style.color = '#fff';
            }
        } else {
            // Growing
            refs.container.classList.remove('ripe');
            
            const remaining = totalTime - elapsed;
            const pct = Math.min(100, (elapsed / totalTime) * 100);
            
            const seconds = remaining / 1000;
            const timeStr = seconds > 60 ? `${(seconds/60).toFixed(1)}m` : `${seconds.toFixed(0)}s`;
            
            if (refs.text.innerText !== timeStr) {
                refs.text.innerText = timeStr;
                refs.text.style.color = '#fff';
            }
            refs.fill.style.width = `${pct}%`;
        }
    });
}

// ------------------------------------------------------------------
// POWER UPGRADE SYSTEM
// ------------------------------------------------------------------
window.showPowerUpgradeMenu = function(type) {
    const modal = document.getElementById('animal-building-modal');
    const content = document.getElementById('animal-modal-content');
    const btn = document.getElementById('animal-upgrade-btn');
    const collectBtn = document.getElementById('animal-collect-btn');
    
    modal.style.display = 'block';
    collectBtn.style.display = 'none'; 
    
    // Per-building solar panel upgrade support
    // If called as showPowerUpgradeMenu(type, building), use building.level for solar
    btn.onclick = () => window.upgradePowerBuilding(type, arguments[1]);

    let currentLevel, Levels, name;
    if (type === 'generator') {
        currentLevel = gameState.generatorLevel || 1;
        Levels = GeneratorLevels;
        name = 'Generator';
    } else {
        var building = arguments[1];
        currentLevel = building && building.level ? building.level : 1;
        Levels = SolarLevels;
        name = 'Solar Panel';
    }
    const nextLevel = currentLevel + 1;
    const currentInfo = Levels[currentLevel];
    
    let html = `<h2 style="margin-bottom:10px; color:#f1c40f">⚡ ${name}</h2>`;
    html += `<p style="font-size: 16px; margin-bottom: 20px;">Current Level: <strong style="color:#f1c40f">${currentLevel}</strong></p>`;
    html += `<p style="font-size: 14px; margin-bottom: 20px;">Produces: <strong>${currentInfo.power} KW</strong></p>`;
    
    if (currentLevel >= 5) {
        html += `<p style="font-size: 18px; color: #2ecc71;">Maximum Level Reached!</p>`;
        btn.style.display = 'none';
    } else {
        const reqs = Levels[nextLevel];
        if (!reqs) {
             html += `<p>Coming Soon...</p>`;
             btn.style.display = 'none';
        } else {
            btn.style.display = 'block';
            html += `<h3 style="margin-bottom: 15px;">Upgrade to Level ${nextLevel}</h3>`;
            html += `<p style="font-size: 14px; margin-bottom: 10px;">New Production: <strong>${reqs.power} KW</strong></p>`;
            
            // Cost Display
            const canAfford = gameState.money >= reqs.cost;
            html += `
                <div class="upgrade-cost-display" style="border: 1px solid ${canAfford ? '#2ecc71' : '#e74c3c'}">
                    <span>💰 Cost:</span>
                    <span style="color:${canAfford ? '#2ecc71' : '#e74c3c'}">$${reqs.cost}</span>
                </div>
            `;
            
            html += `<h4 style="text-align: left; margin-bottom: 10px;">Requirements:</h4>`;
            html += `<ul class="upgrade-req-list">`;
            
            let canUpgrade = true;
            if (!canAfford) canUpgrade = false;
            
            if (reqs.req) {
                for (const [crop, amount] of Object.entries(reqs.req)) {
                    const have = gameState.inventory[crop] || 0;
                    const ok = have >= amount;
                    if (!ok) canUpgrade = false;
                    
                    const cropDef = BuildingTypes[crop];
                    const cropName = cropDef ? cropDef.name : crop;
                    const icon = cropDef ? cropDef.icon : '❓';
                    
                    html += `
                        <li class="upgrade-req-item" style="border-left: 4px solid ${ok ? '#2ecc71' : '#e74c3c'}">
                            <span class="upgrade-req-icon">${icon}</span>
                            <div class="upgrade-req-info">
                                <span class="upgrade-req-name">${cropName}</span>
                                <span class="upgrade-req-count" style="color:${ok ? '#2ecc71' : '#e74c3c'}">
                                    ${have} / ${amount}
                                </span>
                            </div>
                            <span class="upgrade-status-icon" style="color:${ok ? '#2ecc71' : '#e74c3c'}">
                                ${ok ? '✔' : '✖'}
                            </span>
                        </li>
                    `;
                }
            }
            html += `</ul>`;
            
            btn.disabled = !canUpgrade;
            if (!canUpgrade) {
                btn.style.background = '#95a5a6';
                btn.style.cursor = 'not-allowed';
                btn.innerText = "Requirements Not Met";
            } else {
                btn.style.background = ''; // Reset to default CSS
                btn.style.cursor = 'pointer';
                btn.innerText = `Upgrade ${name}`;
            }
        }
    }
    
    content.innerHTML = html;
};

window.upgradePowerBuilding = function(type) {
    let currentLevel, Levels, name;
    var building = arguments[1];
    if (type === 'generator') {
        currentLevel = gameState.generatorLevel || 1;
        Levels = GeneratorLevels;
        name = 'Generator';
    } else {
        currentLevel = building && building.level ? building.level : 1;
        Levels = SolarLevels;
        name = 'Solar Panel';
    }
    const nextLevel = currentLevel + 1;
    const reqs = Levels[nextLevel];
    if (!reqs) return;
    // Validate again
    if (gameState.money < reqs.cost) return;
    if (reqs.req) {
        for (const [crop, amount] of Object.entries(reqs.req)) {
            if ((gameState.inventory[crop] || 0) < amount) return;
        }
    }
    // Deduct
    addMoney(-reqs.cost);
    if (reqs.req) {
        for (const [crop, amount] of Object.entries(reqs.req)) {
            gameState.inventory[crop] -= amount;
        }
    }
    // Level Up
    if (type === 'generator') gameState.generatorLevel = nextLevel;
    else if (building) building.level = nextLevel;
    showNotification(`Upgraded ${name} to Level ${nextLevel}!`, "success");
    SoundEffects.playBuild();

    // Immediately update the 3D model for this building (solar panel or generator)
    if (type === 'solar' && building) {
        // Find the mesh in the scene
        const mesh = objects.find(o => o.userData.type === 'solar' && o.position.x === building.x && o.position.z === building.z && (o.userData.id === building.id || typeof o.userData.id === 'undefined' || typeof building.id === 'undefined'));
        if (mesh) {
            // Remove old mesh from scene and objects array
            scene.remove(mesh);
            const idx = objects.indexOf(mesh);
            if (idx !== -1) objects.splice(idx, 1);
            // Create new mesh with updated level
            const newMesh = createDetailedBuilding('solar', building);
            newMesh.position.copy(mesh.position);
            newMesh.userData.id = building.id;
            scene.add(newMesh);
            objects.push(newMesh);
        }
    } else if (type === 'generator') {
        // Find the generator mesh in the scene
        const mesh = objects.find(o => o.userData.type === 'generator' && o.position.x === building.x && o.position.z === building.z);
        if (mesh) {
            scene.remove(mesh);
            const idx = objects.indexOf(mesh);
            if (idx !== -1) objects.splice(idx, 1);
            const newMesh = createDetailedBuilding('generator', building);
            newMesh.position.copy(mesh.position);
            scene.add(newMesh);
            objects.push(newMesh);
        }
    }

    // Refresh UI
    showPowerUpgradeMenu(type, building);
    saveGame();
    if (nextLevel === 5) {
        showNotification(`Congratulations! You have fully upgraded your ${name}!`, "success");
    }
};

// ------------------------------------------------------------------
// CONNECTION LOGIC (Fences, Walls, etc.)
// ------------------------------------------------------------------
window.updateConnections = function(x, z, updateNeighbors = true) {
    const building = gameState.buildings.find(b => b.x === x && b.z === z);
    if (!building) return;
    
    const mesh = objects.find(o => o.position.x === x && o.position.z === z);
    if (!mesh) return;
    
    const type = building.type;
    const def = BuildingTypes[type];
    
    // Currently only for deco_fence
    if (!def || def.type !== 'deco_fence') return;
    
    // Check neighbors
    const neighbors = {
        top: hasConnectableNeighbor(x, z - TILE_SIZE, type),
        bottom: hasConnectableNeighbor(x, z + TILE_SIZE, type),
        left: hasConnectableNeighbor(x - TILE_SIZE, z, type),
        right: hasConnectableNeighbor(x + TILE_SIZE, z, type)
    };
    
    // Update Mesh Geometry
    updateFenceGeometry(mesh, neighbors, def.color);
    
    if (updateNeighbors) {
        updateConnections(x, z - TILE_SIZE, false);
        updateConnections(x, z + TILE_SIZE, false);
        updateConnections(x - TILE_SIZE, z, false);
        updateConnections(x + TILE_SIZE, z, false);
    }
};

function hasConnectableNeighbor(x, z, type) {
    const b = gameState.buildings.find(b => b.x === x && b.z === z);
    if (!b) return false;
    
    const def = BuildingTypes[b.type];
    if (!def) return false;
    
    // Connect to fences
    return def.type === 'deco_fence'; 
}

function updateFenceGeometry(group, neighbors, color) {
    // Clear existing children
    while(group.children.length > 0){ 
        group.remove(group.children[0]); 
    }
    
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8, metalness: 0.1 });
    
    // Center Post
    const postW = 0.25 * TILE_SIZE;
    const postH = 0.8 * TILE_SIZE;
    const post = new THREE.Mesh(new THREE.BoxGeometry(postW, postH, postW), mat);
    post.position.y = postH / 2;
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
    
    // Rails
    const railThick = 0.1 * TILE_SIZE;
    const railLen = 0.5 * TILE_SIZE; // Reach center of neighbor
    const railY1 = 0.6 * TILE_SIZE;
    const railY2 = 0.3 * TILE_SIZE;
    
    const addRail = (x, z, rotY, len) => {
        const r1 = new THREE.Mesh(new THREE.BoxGeometry(len, railThick, railThick), mat);
        r1.position.set(x, railY1, z);
        if (rotY) r1.rotation.y = rotY;
        r1.castShadow = true;
        group.add(r1);
        
        const r2 = new THREE.Mesh(new THREE.BoxGeometry(len, railThick, railThick), mat);
        r2.position.set(x, railY2, z);
        if (rotY) r2.rotation.y = rotY;
        r2.castShadow = true;
        group.add(r2);
    };

    // Note: Neighbors are Top (-Z), Bottom (+Z), Left (-X), Right (+X)
    
    if (neighbors.top) { // -Z
        addRail(0, -railLen/2, Math.PI/2, railLen);
    }
    
    if (neighbors.bottom) { // +Z
        addRail(0, railLen/2, Math.PI/2, railLen);
    }
    
    if (neighbors.left) { // -X
        addRail(-railLen/2, 0, 0, railLen);
    }
    
    if (neighbors.right) { // +X
        addRail(railLen/2, 0, 0, railLen);
    }
}

const MainHouseLevels = {
    2: { cost: 1000, crops: { wheat: 10 }, growthRate: 1.1 },
    3: { cost: 2000, crops: { corn: 15 }, growthRate: 1.2 },
    4: { cost: 3500, crops: { carrot: 20 }, growthRate: 1.3 },
    5: { cost: 5000, crops: { potato: 25 }, growthRate: 1.4 },
    6: { cost: 7500, crops: { tomato: 30 }, growthRate: 1.5 },
    7: { cost: 10000, crops: { lettuce: 40 }, growthRate: 1.6 },
    8: { cost: 15000, crops: { pumpkin: 30 }, growthRate: 1.7 },
    9: { cost: 25000, crops: { strawberry: 50 }, growthRate: 1.8 },
    10: { cost: 40000, crops: { watermelon: 40 }, growthRate: 2.0 },
    11: { cost: 60000, crops: { pineapple: 50 }, growthRate: 2.2 },
    12: { cost: 90000, crops: { grapes: 60 }, growthRate: 2.4 },
    13: { cost: 130000, crops: { coffee: 80 }, growthRate: 2.6 },
    14: { cost: 200000, crops: { rose: 100 }, growthRate: 2.8 },
    15: { cost: 350000, crops: { sunflower: 150 }, growthRate: 3.0 }
};

const BarnLevels = {
    1: { milkBottles: 10, productionTime: 10 * 60 * 1000, cost: 0 },
    2: { milkBottles: 15, productionTime: 25 * 60 * 1000, cost: 5000, req: { milk_bottle: 30 } },
    3: { milkBottles: 20, productionTime: 30 * 60 * 1000, cost: 15000, req: { milk_bottle: 60 } },
    4: { milkBottles: 25, productionTime: 35 * 60 * 1000, cost: 50000, req: { milk_bottle: 100 } },
    5: { milkBottles: 30, productionTime: 40 * 60 * 1000, cost: 100000, req: { milk_bottle: 150 } }
};

const CoopLevels = {
    1: { eggs: 10, productionTime: 10 * 60 * 1000, cost: 0 },
    2: { eggs: 15, productionTime: 25 * 60 * 1000, cost: 4000, req: { egg: 40 } },
    3: { eggs: 20, productionTime: 30 * 60 * 1000, cost: 12000, req: { egg: 80 } },
    4: { eggs: 25, productionTime: 35 * 60 * 1000, cost: 40000, req: { egg: 120 } },
    5: { eggs: 30, productionTime: 40 * 60 * 1000, cost: 80000, req: { egg: 160 } }
};

const PigPenLevels = {
    1: { truffles: 10, productionTime: 10 * 60 * 1000, cost: 0 },
    2: { truffles: 15, productionTime: 25 * 60 * 1000, cost: 5000, req: { truffle: 30 } },
    3: { truffles: 20, productionTime: 30 * 60 * 1000, cost: 15000, req: { truffle: 60 } },
    4: { truffles: 25, productionTime: 35 * 60 * 1000, cost: 50000, req: { truffle: 100 } },
    5: { truffles: 30, productionTime: 40 * 60 * 1000, cost: 100000, req: { truffle: 150 } }
};

const GeneratorLevels = {
    1: { power: 50, cost: 0 },
    2: { power: 75, cost: 2000, req: { wheat: 20 } },
    3: { power: 100, cost: 5000, req: { corn: 20 } },
    4: { power: 150, cost: 10000, req: { carrot: 40 } },
    5: { power: 200, cost: 20000, req: { potato: 40 } }
};

const SolarLevels = {
    1: { power: 30, cost: 0 },
    2: { power: 45, cost: 2500, req: { wheat: 20 } },
    3: { power: 60, cost: 6000, req: { corn: 20 } },
    4: { power: 90, cost: 12000, req: { carrot: 40 } },
    5: { power: 120, cost: 25000, req: { potato: 40 } }
};

let currentShopCategory = 'crop';
let currentShopSearchTerm = '';
let currentShopSort = 'name_asc';
window.setShopSearchTerm = function(term) {
    currentShopSearchTerm = (term || '').toLowerCase();
    updateBuildMenu();
};
window.setShopSort = function(val) {
    currentShopSort = val || 'name_asc';
    updateBuildMenu();
};

// ------------------------------------------------------------------
// UTILS
// ------------------------------------------------------------------
function createProceduralTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    if (type === 'grass') {
        // Farmville 2 style: vibrant, painted grass
        ctx.fillStyle = '#7ed957'; // bright base
        ctx.fillRect(0, 0, 512, 512);

        // Soft color variation (painted look)
        for (let i = 0; i < 35000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const w = 2 + Math.random() * 3;
            const h = 2 + Math.random() * 3;
            ctx.fillStyle = Math.random() > 0.5 ? '#a8e063' : (Math.random() > 0.5 ? '#6ecb3c' : '#b6f7a0');
            ctx.globalAlpha = 0.13 + Math.random() * 0.18;
            ctx.beginPath();
            ctx.ellipse(x, y, w, h, Math.random()*Math.PI, 0, Math.PI*2);
            ctx.fill();
        }

        // Soft highlights
        for (let i = 0; i < 1200; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = 18 + Math.random() * 18;
            ctx.globalAlpha = 0.07 + Math.random() * 0.07;
            ctx.fillStyle = '#eaffd0';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        
    } else if (type === 'soil') {
        // Base Brown
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(0, 0, 512, 512);
        
        // Noise (Dirt clumps)
        for (let i = 0; i < 20000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = Math.random() * 4;
            ctx.fillStyle = Math.random() > 0.5 ? '#4e342e' : '#795548';
            ctx.globalAlpha = 0.2 + Math.random() * 0.3;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Furrows (optional lines)
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 4;
        for (let i = 0; i < 512; i+=20) {
             ctx.beginPath();
             ctx.moveTo(0, i);
             ctx.lineTo(512, i);
             ctx.stroke();
        }
    } else if (type === 'asphalt') {
        // Base Dark Gray
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, 512, 512);
        
        // Noise (Grain)
        for (let i = 0; i < 50000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const w = Math.random() * 2;
            const h = Math.random() * 2;
            ctx.fillStyle = Math.random() > 0.5 ? '#444444' : '#222222';
            ctx.globalAlpha = 0.1 + Math.random() * 0.2;
            ctx.fillRect(x, y, w, h);
        }
    } else if (type === 'stone') {
        // Base Grey
        ctx.fillStyle = '#9e9e9e';
        ctx.fillRect(0, 0, 512, 512);
        
        // Stones
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const s = 30 + Math.random() * 50;
            ctx.fillStyle = Math.random() > 0.5 ? '#bdbdbd' : '#757575';
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            // Irregular shape
            ctx.moveTo(x, y);
            ctx.lineTo(x + s, y + Math.random()*10);
            ctx.lineTo(x + s - 10, y + s);
            ctx.lineTo(x - 10, y + s - 10);
            ctx.fill();
            
            // Outline
            ctx.strokeStyle = '#616161';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Noise
        for (let i = 0; i < 10000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
            ctx.globalAlpha = 0.05;
            ctx.fillRect(x, y, 2, 2);
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// ------------------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------------------
let scene, camera, renderer;
let raycaster, mouse;
let groundPlane;
let gridHelper;
let objects = []; // Objects that can be interacted with (buildings)
let npcs = []; // Array of NPC meshes/data
let buildings = []; // Track logical building data
let isVisiting = false; // Flag to check if we are on another farm
let vehicles = [];
let animals = [];
let sellMode = false;
let moveMode = false;
let movingObject = null;
let hoveredCrop = null;

let gameState = {
    playerName: 'Player',
    money: 1000,
    diamonds: 1000,
    day: 1,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    buildings: [],
    missions: [],
    inventory: {
        milk_bottle: 0
    },
        marketListings: [], // { id, item, qty, price }
    weather: 'Sunny',
    barnLevel: 1,
    lastMilkProductionTime: Date.now()
};

// Pending collections waiting for NPC farmers to pick up
gameState.pendingCollections = gameState.pendingCollections || [];
// NPC farmer list (one per house)
gameState.npcs = gameState.npcs || [];

let selectedBuildingType = null;
let previewMesh = null;
let tileMarker = null;
let selectedRotation = 0;
let lastTime = 0;
let clouds = [];
let gameTime = 0; // 0 to 24 hours
let dirLight;
let zoomLevel = 150; // Initial zoom level (orthographic size)
let windSpeed = 1.0;
let audioEnabled = true;
let gameStarted = false;
let payWithDiamonds = false;

// ------------------------------------------------------------------
// HELPER FUNCTIONS (Collision, Birds)
// ------------------------------------------------------------------
window.getOccupiedTiles = function(type, x, z, rotation) {
    const def = BuildingTypes[type];
    if (!def) return [{x, z}];
    
    const wRaw = def.width || 1;
    const dRaw = def.depth || 1;
    
    const isRotated = (rotation % 2 === 1);
    const w = isRotated ? dRaw : wRaw;
    const d = isRotated ? wRaw : dRaw;
    
    const tiles = [];
    for(let i=0; i<w; i++) {
        for(let j=0; j<d; j++) {
            tiles.push({
                x: x + i * TILE_SIZE,
                z: z + j * TILE_SIZE
            });
        }
    }
    return tiles;
};

window.checkCollision = function(tiles, ignoreList = []) {
    const limit = (gameState.gridSize * TILE_SIZE) / 2 - 1.5;
    
    for(const t of tiles) {
        // Check boundaries
        if (Math.abs(t.x) > limit || Math.abs(t.z) > limit) return true;
        
        // Check collisions with other buildings
        for(const b of gameState.buildings) {
            if (ignoreList.includes(b)) continue;
            const bTiles = getOccupiedTiles(b.type, b.x, b.z, b.rotation || 0);
            for(const bt of bTiles) {
                // Strict collision: if tile centers are within TILE_SIZE distance, it's a collision
                const dx = bt.x - t.x;
                const dz = bt.z - t.z;
                if (Math.abs(dx) < TILE_SIZE && Math.abs(dz) < TILE_SIZE) {
                    return true;
                }
            }
        }
    }
    return false;
};

const birds = [];
window.initBirds = function() {
    const birdColors = [0xffffff, 0xdddddd, 0xaaddff]; // White, Grey, Light Blue
    
    for(let i=0; i<15; i++) {
        const bird = new THREE.Group();
        
        // Body (Scaled up x1.5)
        const bodyGeo = new THREE.ConeGeometry(0.3, 1.2, 8);
        bodyGeo.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshStandardMaterial({ color: birdColors[i % 3], roughness: 0.9 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        bird.add(body);
        
        // Head
        const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 0, 0.6);
        bird.add(head);

        // Beak (Yellow Cone)
        const beakGeo = new THREE.ConeGeometry(0.08, 0.3, 8);
        beakGeo.rotateX(Math.PI / 2);
        const beakMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.6 });
        const beak = new THREE.Mesh(beakGeo, beakMat);
        beak.position.set(0, 0, 0.85);
        bird.add(beak);

        // Tail (Fan)
        const tailGeo = new THREE.BoxGeometry(0.6, 0.05, 0.6);
        tailGeo.translate(0, 0, -0.3);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.position.set(0, 0, -0.6);
        bird.add(tail);
        
        // Wings (Pivots) - Larger
        const wingGeo = new THREE.BoxGeometry(1.2, 0.05, 0.5);
        wingGeo.translate(0.6, 0, 0); // Pivot at edge
        
        const lWing = new THREE.Mesh(wingGeo, bodyMat);
        lWing.position.set(-0.15, 0.1, 0);
        lWing.rotation.z = Math.PI; // Flip
        bird.add(lWing);
        
        const rWing = new THREE.Mesh(wingGeo, bodyMat);
        rWing.position.set(0.15, 0.1, 0);
        bird.add(rWing);
        
        bird.userData.wings = { l: lWing, r: rWing };

        // Position & Flight Data
        bird.position.set(
            (Math.random() - 0.5) * gridSize * TILE_SIZE,
            40 + Math.random() * 50, // Higher flight
            (Math.random() - 0.5) * gridSize * TILE_SIZE
        );
        
        bird.userData.speed = 20 + Math.random() * 15;
        bird.userData.angle = Math.random() * Math.PI * 2;
        bird.userData.radius = 50 + Math.random() * 100;
        bird.userData.center = { x: bird.position.x, z: bird.position.z };
        bird.userData.yBase = bird.position.y;
        bird.userData.yOffset = Math.random() * 1000;
        
        scene.add(bird);
        birds.push(bird);
    }
};

window.updateBirds = function(delta) {
    const time = Date.now() * 0.001;
    const dt = delta / 1000;
    
    birds.forEach(bird => {
        // Move
        const oldAngle = bird.userData.angle;
        bird.userData.angle += (bird.userData.speed / bird.userData.radius) * dt;
        
        const x = bird.userData.center.x + Math.cos(bird.userData.angle) * bird.userData.radius;
        const z = bird.userData.center.z + Math.sin(bird.userData.angle) * bird.userData.radius;
        const y = bird.userData.yBase + Math.sin(time + bird.userData.yOffset) * 5;
        
        // Rotate to face direction
        const dx = x - bird.position.x;
        const dz = z - bird.position.z;
        
        bird.position.set(x, y, z);

        if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
             const targetRot = Math.atan2(-dx, -dz) + Math.PI/2;
             bird.rotation.y = targetRot;
             
             // Banking (Roll) based on turn
             // Simpler: Just bank inwards
             bird.rotation.z = -Math.PI/8; // Slight constant bank for circular flight
             
             // Dynamic Pitch
             bird.rotation.x = Math.sin(time * 2) * 0.1;
        }
        
        // Flap Wings
        const flap = Math.sin(time * 12); // Slower, more majestic flap
        if (bird.userData.wings) {
            bird.userData.wings.l.rotation.z = Math.PI + flap * 0.6;
            bird.userData.wings.r.rotation.z = -flap * 0.6;
        }
    });
};

// ------------------------------------------------------------------
// AUDIO SYSTEM
// ------------------------------------------------------------------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const SoundEffects = {
    bgm: null,
    ambiance: null,
    currentDayPart: null, // 'morning', 'day', 'evening', 'night'
    weatherNode: null,
    weatherGain: null,
    masterGain: null,
    
    // Modern Audio Config
    vol: {
        music: 0.15,
        sfx: 0.2,
        ambiance: 0.1
    },

    init: function() {
        if (!this.masterGain) {
            this.masterGain = audioCtx.createGain();
            this.masterGain.gain.setValueAtTime(1, audioCtx.currentTime);
            this.masterGain.connect(audioCtx.destination);
        }
    },
    
    playTone: function(freq, type, duration, vol = 0.1) {
        if (!audioEnabled) return;
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain || audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },

    playBuild: function() {
        this.playTone(300, 'square', 0.1, 0.1);
        setTimeout(() => this.playTone(400, 'square', 0.1, 0.1), 100);
    },

    playHarvest: function() {
        // Modern "pop" sound
        if (!audioEnabled) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.masterGain || audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },
    
    playClick: function() {
        this.playTone(800, 'triangle', 0.05, 0.05);
    },

    playThunder: function() {
        // Thunder sound effect - low rumble with noise
        if (!audioEnabled) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        try {
            // Create noise burst
            const src = audioCtx.createBufferSource();
            src.buffer = this.createNoiseBuffer();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            
            // Low-pass filter for rumble
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, audioCtx.currentTime);
            
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
            
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain || audioCtx.destination);
            
            src.start();
            src.stop(audioCtx.currentTime + 1.5);
        } catch(e) {
            console.warn('Thunder sound error:', e);
        }
    },

    playMoney: function() {
        this.playTone(800, 'sine', 0.1, 0.15);
        setTimeout(() => this.playTone(1000, 'sine', 0.1, 0.15), 50);
    },
    
    updateAmbiance: function(gameTime) {
        if (!audioEnabled) {
            this.stopBGM();
            return;
        }
        
        // Determine Day Part
        let part = 'day';
        if (gameTime >= 5 && gameTime < 8) part = 'morning';
        else if (gameTime >= 8 && gameTime < 17) part = 'day';
        else if (gameTime >= 17 && gameTime < 20) part = 'evening';
        else part = 'night';

        // Only update if changed
        if (this.currentDayPart !== part) {
            this.currentDayPart = part;
            this.transitionMusic(part);
        }
        
        // Ensure loops are running if enabled
        if (!this.bgm) this.transitionMusic(part);
    },

    transitionMusic: function(part) {
        // Fade out old
        if (this.bgm) {
            const oldBgm = this.bgm;
            const now = audioCtx.currentTime;
            try {
                oldBgm.gain.gain.setValueAtTime(oldBgm.gain.gain.value, now);
                oldBgm.gain.gain.linearRampToValueAtTime(0, now + 2);
                setTimeout(() => {
                    oldBgm.nodes.forEach(n => { try{n.stop();}catch(e){} });
                }, 2000);
            } catch(e) {}
        }

        // Start New
        this.bgm = this.createProceduralMusic(part);
    },

    createProceduralMusic: function(part) {
        this.init();
        const master = audioCtx.createGain();
        master.gain.setValueAtTime(0, audioCtx.currentTime);
        master.gain.linearRampToValueAtTime(this.vol.music, audioCtx.currentTime + 2);
        master.connect(this.masterGain);

        const nodes = [];
        const ctx = audioCtx;
        const now = ctx.currentTime;

        // --- AMBIANCE LAYERS ---
        // 1. Base Drone / Pad
        const drone = ctx.createOscillator();
        const droneGain = ctx.createGain();
        drone.type = 'triangle';
        droneGain.gain.value = 0.05;
        
        if (part === 'night') {
            drone.frequency.value = 110; // A2
            // Add crickets (High freq random beeps)
            this.startCricketLoop(nodes, master);
        } else if (part === 'morning') {
            drone.frequency.value = 293.66; // D4
            // Birds
            this.startBirdLoop(nodes, master);
        } else if (part === 'evening') {
            drone.frequency.value = 196; // G3
        } else {
            drone.frequency.value = 261.63; // C4
        }
        
        drone.connect(droneGain);
        droneGain.connect(master);
        drone.start();
        nodes.push(drone);

        // --- MELODY SEQUENCER ---
        // Simple arpeggios based on scale
        let scale = [];
        let tempo = 1.0; // seconds per note

        if (part === 'morning') {
            scale = [293.66, 369.99, 440.00, 587.33, 739.99]; // D Major Pentatonic
            tempo = 0.8;
        } else if (part === 'day') {
            scale = [261.63, 329.63, 392.00, 523.25, 659.25]; // C Major Arp
            tempo = 0.6;
        } else if (part === 'evening') {
            scale = [196.00, 246.94, 293.66, 392.00, 493.88]; // G Major
            tempo = 1.2;
        } else {
            scale = [110.00, 164.81, 196.00, 220.00, 329.63]; // A Minor 7
            tempo = 2.0;
        }

        // Sequencer Loop
        const seqLoop = setInterval(() => {
            if (audioCtx.state === 'suspended') return;
            if (!audioEnabled) return;
            
            // Random chance to play a note
            if (Math.random() < 0.6) {
                const noteFreq = scale[Math.floor(Math.random() * scale.length)];
                const noteOsc = ctx.createOscillator();
                const noteGain = ctx.createGain();
                
                noteOsc.type = part === 'night' ? 'sine' : 'triangle';
                noteOsc.frequency.setValueAtTime(noteFreq, ctx.currentTime);
                
                noteGain.gain.setValueAtTime(0, ctx.currentTime);
                noteGain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
                noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + tempo * 2);
                
                noteOsc.connect(noteGain);
                noteGain.connect(master);
                
                noteOsc.start();
                noteOsc.stop(ctx.currentTime + tempo * 2);
            }
        }, tempo * 1000);

        // Store interval to clear later
        nodes.push({ stop: () => clearInterval(seqLoop) });

        return { nodes, gain: master };
    },

    startCricketLoop: function(nodes, dest) {
        const loop = setInterval(() => {
            if (Math.random() > 0.3) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.value = 4000 + Math.random() * 500;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.05);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(dest);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        }, 200);
        nodes.push({ stop: () => clearInterval(loop) });
    },

    startBirdLoop: function(nodes, dest) {
        const loop = setInterval(() => {
            if (Math.random() > 0.1) return; // Rare
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.setValueAtTime(1500 + Math.random() * 500, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(2000 + Math.random() * 500, audioCtx.currentTime + 0.2);
            osc.type = 'sine';
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.1);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(dest);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }, 1000);
        nodes.push({ stop: () => clearInterval(loop) });
    },

    playBGM: function() {
        // Triggered by user interaction usually
        if (!audioEnabled) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        // Force update to start correct track
        this.currentDayPart = null; 
        this.updateAmbiance(gameState ? (gameTime || 12) : 12);
    },
    
    stopBGM: function() {
        if (this.bgm) {
            this.bgm.nodes.forEach(n => { try{n.stop();}catch(e){} });
            try{this.bgm.gain.disconnect();}catch(e){}
            this.bgm = null;
        }
    },
    createNoiseBuffer: function() {
        const sampleRate = audioCtx.sampleRate;
        const buffer = audioCtx.createBuffer(1, sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < sampleRate; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    },
    setWeather: function(type) {
        if (this.weatherNode) {
            try { this.weatherNode.stop(); } catch(e) {}
            this.weatherNode.disconnect();
            if (this.weatherGain) this.weatherGain.disconnect();
            this.weatherNode = null;
            this.weatherGain = null;
        }
        if (!audioEnabled) return;
        if (type === 'Sunny') return;
        const src = audioCtx.createBufferSource();
        src.buffer = this.createNoiseBuffer();
        src.loop = true;
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        if (type === 'Rain') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2000, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        } else if (type === 'Snow') {
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        } else if (type === 'Cloudy') {
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        } else {
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        }
        src.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        src.start();
        this.weatherNode = src;
        this.weatherGain = gain;
    }
};
window.toggleAudio = function() {
    audioEnabled = !audioEnabled;
    const btn = document.getElementById('audio-btn');
    if (btn) {
        btn.innerText = audioEnabled ? '🔈 Audio: On' : '🔇 Audio: Off';
        btn.style.background = audioEnabled ? '#9b59b6' : '#7f8c8d';
    }
    if (!audioEnabled) {
        SoundEffects.stopBGM();
        SoundEffects.setWeather('Sunny');
    } else {
        SoundEffects.playBGM();
        SoundEffects.setWeather(gameState.weather);
    }
};

// ------------------------------------------------------------------
// MISSIONS SYSTEM
// ------------------------------------------------------------------
function initDefaultMissions() {
    const missions = [
        { id: 1, name: "First Harvest", desc: "Harvest 5 Wheat", type: "harvest", target: "wheat", count: 5, reward: 50, claimed: false },
        { id: 2, name: "Corn Lover", desc: "Plant 3 Corn", type: "build", target: "corn", count: 3, reward: 100, claimed: false },
        { id: 3, name: "Chicken Run", desc: "Build a Coop", type: "build", target: "coop", count: 1, reward: 200, claimed: false },
        { id: 4, name: "Decoration", desc: "Place 5 Fences", type: "build", target: "fence_white", count: 5, reward: 50, claimed: false },
        { id: 5, name: "Big Spender", desc: "Have 500 Coins", type: "money", count: 500, reward: 100, claimed: false },
        
        // New Missions with Codes
        { id: 31, name: "Level Up!", desc: "Reach Level 5", type: "level", count: 5, reward: 1000, claimed: false },
        { id: 32, name: "Carrot King", desc: "Harvest 20 Carrots", type: "harvest", target: "carrot", count: 20, reward: 500, claimed: false },
        { id: 33, name: "Barn Builder", desc: "Build a Barn", type: "build", target: "barn", count: 1, reward: 2000, claimed: false },
        { id: 34, name: "Rich Farmer", desc: "Have 10,000 Coins", type: "money", count: 10000, reward: 5000, claimed: false }
    ];
    for(let i=6; i<=30; i++) {
        missions.push({
            id: i,
            name: `Mission ${i}`,
            desc: `Earn ${i * 100} Coins`,
            type: "money",
            count: i * 100,
            reward: i * 50,
            claimed: false
        });
    }
    return missions;
}

function refreshDailyMissions() {
    // Keep uncompleted Story/Tutorial missions (ids < 1000)
    gameState.missions = (gameState.missions || []).filter(m => m.id < 1000 && !m.claimed);
    
    const selected = [];
    
    // Categorize BuildingTypes
    const crops = [];
    const trees = [];
    const buildings = [];
    const decorations = [];
    
    Object.keys(BuildingTypes).forEach(key => {
        const def = BuildingTypes[key];
        if (def.category === 'crop') crops.push(key);
        else if (def.category === 'tree') trees.push(key);
        else if (def.category === 'building' || def.category === 'vehicle') buildings.push(key);
        else if (def.category === 'decoration') decorations.push(key);
    });

    for(let i=0; i<6; i++) {
        let m;
        const r = Math.random();
        
        // 15% Harvest Crop
        if (r < 0.15) {
            const crop = crops[Math.floor(Math.random() * crops.length)];
            const count = Math.floor(Math.random() * 50) + 10; // 10-60
            const def = BuildingTypes[crop];
            m = {
                desc: `Harvest ${count} ${def.name}`,
                type: 'harvest',
                target: crop,
                count: count,
                reward: Math.floor(count * (def.cost || 10) * 0.8) + 50
            };
        } 
        // 15% Plant Crop
        else if (r < 0.30) {
            const crop = crops[Math.floor(Math.random() * crops.length)];
            const count = Math.floor(Math.random() * 30) + 5; // 5-35
            const def = BuildingTypes[crop];
            m = {
                desc: `Plant ${count} ${def.name}`,
                type: 'build', // Planting is building
                target: crop,
                count: count,
                reward: Math.floor(count * (def.cost || 10) * 0.5) + 30
            };
        }
        // 10% Sell Crop (New)
        else if (r < 0.40) {
            const crop = crops[Math.floor(Math.random() * crops.length)];
            const count = Math.floor(Math.random() * 40) + 10; // 10-50
            const def = BuildingTypes[crop];
            m = {
                desc: `Sell ${count} ${def.name}`,
                type: 'sell',
                target: crop,
                count: count,
                reward: Math.floor(count * (def.cost || 10) * 0.4) + 40
            };
        }
        // 15% Earn Money
        else if (r < 0.55) {
            const amount = (Math.floor(Math.random() * 50) + 5) * 100; // 500 - 5500
            m = {
                desc: `Earn ${amount} Coins`,
                type: 'money',
                count: amount,
                reward: Math.floor(amount * 0.1)
            };
        }
        // 10% Gain XP (New)
        else if (r < 0.65) {
            const amount = (Math.floor(Math.random() * 20) + 5) * 50; // 250 - 1250 XP
            m = {
                desc: `Gain ${amount} XP`,
                type: 'xp',
                count: amount,
                reward: Math.floor(amount * 0.5)
            };
        }
        // 10% Harvest Tree
        else if (r < 0.75 && trees.length > 0) {
            const tree = trees[Math.floor(Math.random() * trees.length)];
            const count = Math.floor(Math.random() * 10) + 3;
            const def = BuildingTypes[tree];
            m = {
                desc: `Harvest ${count} ${def.name}`,
                type: 'harvest',
                target: tree,
                count: count,
                reward: count * 15 + 60
            };
        }
        // 10% Build Structure/Vehicle
        else if (r < 0.85 && buildings.length > 0) {
            const b = buildings[Math.floor(Math.random() * buildings.length)];
            const count = 1;
            const def = BuildingTypes[b];
            m = {
                desc: `Build a ${def.name}`,
                type: 'build',
                target: b,
                count: count,
                reward: Math.floor(def.cost * 0.2) + 100
            };
        }
        // 15% Place Decoration
        else {
            const d = decorations.length > 0 ? decorations[Math.floor(Math.random() * decorations.length)] : 'fence_white';
            const count = Math.floor(Math.random() * 5) + 2;
            const def = BuildingTypes[d] || BuildingTypes['fence_white'];
            m = {
                desc: `Place ${count} ${def.name}`,
                type: 'build',
                target: d,
                count: count,
                reward: count * 5 + 20
            };
        }
        
        selected.push({
            id: 1000 + Date.now() + i, // Unique ID
            name: "Daily Mission",
            desc: m.desc,
            type: m.type,
            target: m.target,
            count: m.count,
            reward: m.reward,
            claimed: false,
            isDaily: true,
            progress: 0
        });
    }
    
    gameState.missions.push(...selected);
    gameState.lastMissionRefreshDate = new Date().toDateString();
    updateMissionUI();
}

function checkMissions(actionType, targetType, amount = 1) {
    if (!gameState.missions) return;
    let completed = false;
    
    gameState.missions.forEach(m => {
        if (m.claimed) return;
        
        // Handle Daily Missions (Progress based)
        if (m.isDaily) {
            if (m.type === actionType) {
                let match = false;
                if (m.type === 'money') match = true;
                else if (m.type === 'xp') match = true;
                else if (m.target === targetType) match = true;
                
                if (match) {
                    m.progress = (m.progress || 0) + amount;
                    if (m.progress >= m.count) {
                        completeMission(m);
                        completed = true;
                    }
                }
            }
            return;
        }
        
        // Handle Legacy/Story Missions (State based)
        if (m.type === 'money') {
            if (gameState.money >= m.count) {
                completeMission(m);
                completed = true;
            }
        } else if (m.type === 'level') {
            if (gameState.level >= m.count) {
                completeMission(m);
                completed = true;
            }
        } else if (m.type === actionType) {
            if (m.target === targetType) {
                let count = 0;
                if (actionType === 'harvest') {
                    count = gameState.inventory ? (gameState.inventory[targetType] || 0) : 0;
                } else {
                    count = gameState.buildings.filter(b => b.type === targetType).length;
                }
                
                if (count >= m.count) {
                    completeMission(m);
                    completed = true;
                }
            }
        }
    });
    
    if (completed) updateMissionUI();
    // Also update UI to show progress bars if needed, even if not completed
    updateMissionUI(); 
}

function completeMission(mission) {
    mission.claimed = true;
    addMoney(mission.reward);
    SoundEffects.playHarvest();

    // Check for Secret Codes
    let secretCode = null;
    if (mission.id === 1) secretCode = 'WELCOME';
    else if (mission.id === 3) secretCode = 'FARM2025';
    else if (mission.id === 10) secretCode = 'RICH';
    else if (mission.id === 31) secretCode = 'LEVEL5';
    else if (mission.id === 32) secretCode = 'CARROT20';
    else if (mission.id === 33) secretCode = 'BARN';
    else if (mission.id === 34) secretCode = 'TYCOON';

    if (secretCode) {
        showMissionCompleteModal(mission.name, secretCode);
    }
}

window.showMissionCompleteModal = function(missionName, secretCode) {
    const modal = document.getElementById('mission-complete-modal');
    const content = document.getElementById('mission-complete-content');
    if (modal && content) {
        let html = `<p style="margin-bottom: 10px;">You have completed <strong>${missionName}</strong>!</p>`;
        
        if (secretCode) {
            html += `
                <div style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 10px; margin-top: 15px; border: 1px dashed #f1c40f;">
                    <p style="margin: 0; font-size: 14px; color: #ccc;">SECRET CODE UNLOCKED</p>
                    <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #f1c40f; letter-spacing: 2px;">${secretCode}</p>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #aaa;">(Go to Codes menu to redeem)</p>
                </div>
            `;
        }
        
        content.innerHTML = html;
        modal.style.display = 'block';
    }
};

// ------------------------------------------------------------------
// MOCK CLOUD STORAGE (Simulate Server)
// ------------------------------------------------------------------
const MockCloud = {
    init: function() {
        if (!localStorage.getItem('farmSimCloud')) {
            const bots = [
                { name: "TopFarmer99", level: 15, money: 54000, gridSize: 30, buildings: this.genFarm(15, 30) },
                { name: "BarnOwl", level: 12, money: 32000, gridSize: 20, buildings: this.genFarm(12, 20) },
                { name: "GreenThumb", level: 8, money: 15000, gridSize: 20, buildings: this.genFarm(8, 20) },
                { name: "CowBoy", level: 5, money: 8000, gridSize: 20, buildings: this.genFarm(5, 20) },
                { name: "Newbie123", level: 2, money: 500, gridSize: 20, buildings: this.genFarm(2, 20) }
            ];
            localStorage.setItem('farmSimCloud', JSON.stringify(bots));
        }
    },
    
    genFarm: function(level, size) {
        const buildings = [];
        const types = Object.keys(BuildingTypes).filter(t => BuildingTypes[t].level <= level && BuildingTypes[t].category !== 'hidden');
        const count = 10 + level * 2;
        
        // Always add a Main House
        buildings.push({ x: 0, z: 0, type: 'main_house', id: Date.now(), level: 1 });
        
        for(let i=0; i<count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            if(type === 'main_house') continue; // Already added
            
            // Random pos
            const x = (Math.floor(Math.random() * size) - size/2) * TILE_SIZE + TILE_SIZE/2;
            const z = (Math.floor(Math.random() * size) - size/2) * TILE_SIZE + TILE_SIZE/2;
            
            // Simple overlap check
            if (!buildings.some(b => Math.abs(b.x - x) < 1 && Math.abs(b.z - z) < 1)) {
                buildings.push({ x, z, type, id: Date.now() + i, level: 1 });
            }
        }
        return buildings;
    },
    
    getBots: function() {
        try {
            return JSON.parse(localStorage.getItem('farmSimCloud')) || [];
        } catch(e) { return []; }
    }
};

// ------------------------------------------------------------------
// USER AUTHENTICATION & SAVE SYSTEM
// ------------------------------------------------------------------
let currentUser = null;
const USERS_KEY = 'farmSimUsers';

window.gameLogin = function(username, password) {
    try {
        const users = JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
        
        // Special Case: Auto-create/Reset Owner 'Alex' if needed with 'Ampulamare7'
        if (username === 'Alex') {
            // Always ensure Alex has the current password
            users['Alex'] = 'Ampulamare7';
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            
            // Enforce password for Alex
            if (password !== users['Alex']) {
                return { success: false, message: "Incorrect password for Owner" };
            }
        }
        
        // Special Case: Auto-create/Reset Owner 'Developer' if needed with 'Developer123'
        if (username === 'Developer') {
            // Always ensure Developer has the current password
            users['Developer'] = 'Developer123';
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            
            // Enforce password for Developer
            if (password !== users['Developer']) {
                return { success: false, message: "Incorrect password for Owner" };
            }
        }

        if (!users[username]) {
             return { success: false, message: "User not found. Please Create Account." };
        }
        if (users[username] === password) {
            currentUser = username;
            // Set player name before loading save
            gameState.playerName = username;
            console.log('Setting player name to:', username);
            try {
                loadUserSave(username);
            } catch(e) {
                console.error('Error loading user save:', e);
            }
            // Ensure player name is set even if load failed
            gameState.playerName = username;
            console.log('Final player name:', gameState.playerName);
            return { success: true };
        }
        return { success: false, message: "Incorrect password" };
    } catch (e) {
        console.error('Login error:', e);
        return { success: false, message: "Login error: " + e.message };
    }
};

window.gameCreateAccount = function(username, password) {
    try {
        const users = JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
        if (users[username]) {
             return { success: false, message: "Username already exists" };
        }
        users[username] = password;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        
        currentUser = username;
        // Init fresh state for new user
        try {
            initFreshState(username);
            saveGame(); // Save immediately
        } catch(e) {
            console.warn('Could not initialize fresh state:', e);
        }
        
        return { success: true };
    } catch (e) {
        console.error('Creation error:', e);
        return { success: false, message: "Creation error: " + e.message };
    }
};

window.gameResetPassword = function(username, newPassword) {
    try {
        const users = JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
        if (!users[username]) {
             return { success: false, message: "User not found" };
        }
        users[username] = newPassword;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        
        return { success: true, message: "Password reset successful" };
    } catch (e) {
        return { success: false, message: "Reset error" };
    }
};

// Note: Internal functions are called directly in game.js
// No need for window exports as they're handled by gameLogin(), etc.

function loadUserSave(username) {
    const saveKey = 'farmSimSave_' + username;
    if (localStorage.getItem(saveKey)) {
        try {
            const saved = JSON.parse(localStorage.getItem(saveKey));
            gameState = saved;
            // Ensure compatibility
            if (!gameState.missions) gameState.missions = initDefaultMissions();
            if (!gameState.gridSize) gameState.gridSize = GRID_SIZE;
            if (!gameState.inventory) gameState.inventory = {};
            if (gameState.inventory.milk_bottle === undefined) gameState.inventory.milk_bottle = 0;
            if (!gameState.marketListings) gameState.marketListings = [];
            if (gameState.diamonds === undefined) gameState.diamonds = 1000;
            if (!gameState.mainHouseLevel) gameState.mainHouseLevel = 1;
            if (!gameState.barnLevel) gameState.barnLevel = 1;
            if (!gameState.pigPenLevel) gameState.pigPenLevel = 1;
            if (!gameState.coopLevel) gameState.coopLevel = 1;
            if (!gameState.generatorLevel) gameState.generatorLevel = 1;
            if (!gameState.solarLevel) gameState.solarLevel = 1;
            if (!gameState.electricity) gameState.electricity = { produced: 0, consumed: 0 };
            if (!gameState.lastMilkProductionTime) gameState.lastMilkProductionTime = Date.now();
            if (!gameState.lastEggProductionTime) gameState.lastEggProductionTime = Date.now();
            if (!gameState.lastTruffleProductionTime) gameState.lastTruffleProductionTime = Date.now();
            if (!gameState.weather) gameState.weather = 'Sunny';
            if (gameState.zoomLevel) zoomLevel = gameState.zoomLevel;
            if (!gameState.redeemedCodes) gameState.redeemedCodes = [];
        } catch(e) {
            console.error("Save load failed", e);
            initFreshState(username);
        }
    } else {
        initFreshState(username);
    }
    
    // Check Daily Missions (24h Cooldown / Daily Reset)
    const today = new Date().toDateString();
    if (gameState.lastMissionRefreshDate !== today) {
        refreshDailyMissions();
    }
    
    // Update Scene
    rebuildSceneFromState();
}

function initFreshState(username) {
    gameState.playerName = username;
    gameState.money = 1000;
    gameState.diamonds = 1000;
    gameState.day = 1;
    gameState.level = 1;
    gameState.xp = 0;
    gameState.xpToNextLevel = 100;
    gameState.buildings = [];
    gameState.missions = initDefaultMissions();
    gameState.inventory = {
        milk_bottle: 0
    };
    gameState.weather = 'Sunny';
    gameState.mainHouseLevel = 1;
    gameState.siloLevel = 1;
    gameState.warehouseLevel = 1;
    gameState.barnLevel = 1;
    gameState.pigPenLevel = 1;
    gameState.coopLevel = 1;
    gameState.generatorLevel = 1;
    gameState.solarLevel = 1;
    gameState.electricity = { produced: 0, consumed: 0 };
    gameState.lastMilkProductionTime = Date.now();
    gameState.lastEggProductionTime = Date.now();
    gameState.lastTruffleProductionTime = Date.now();
    gameState.gridSize = GRID_SIZE;
    gameState.redeemedCodes = [];
    
    // Add Main House
    gameState.buildings.push({ type: 'main_house', x: 0, z: 0, level: 1 });
}

function rebuildSceneFromState() {
    // Clear existing dynamic objects
    objects.forEach(o => scene.remove(o));
    objects = [];
    
    // Clear NPCs
    if (npcs) npcs.forEach(n => {
        if(n.mesh) scene.remove(n.mesh);
    });
    npcs = [];
    
    // Clear Vehicles
    if (vehicles) vehicles.forEach(v => {
        if(v.mesh) scene.remove(v.mesh);
    });
    vehicles = [];
    
    // Re-populate
    gameState.buildings.forEach(b => {
        const mesh = createDetailedBuilding(b.type, b);
        
        // Calculate Visual Center based on occupied tiles
        const tiles = getOccupiedTiles(b.type, b.x, b.z, b.rotation || 0);
        if (tiles.length > 0) {
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            tiles.forEach(t => {
                minX = Math.min(minX, t.x);
                maxX = Math.max(maxX, t.x);
                minZ = Math.min(minZ, t.z);
                maxZ = Math.max(maxZ, t.z);
            });
            mesh.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
        } else {
            mesh.position.set(b.x, 0, b.z);
        }

        mesh.rotation.y = -(b.rotation || 0) * (Math.PI / 2); // Apply Rotation
        scene.add(mesh);
        objects.push(mesh);
        mesh.userData.scaleProgress = 1;

        if (b.type === 'house') {
            spawnNPC(b.x, b.z);
        }
        const def = BuildingTypes[b.type];
        if (def && def.category === 'vehicle') {
            vehicles.push({ mesh, seed: Math.random()*10, baseX: b.x, baseZ: b.z });
        }
        // Spawn animals for restored animal buildings so they roam on load
        if (def && def.type === 'building_animal') {
            const animalMap = {
                barn: { kinds: ['cow'], count: 6 },
                coop: { kinds: ['chicken'], count: 8 },
                pig_pen: { kinds: ['pig'], count: 6 },
                sheep_pasture: { kinds: ['sheep'], count: 6 },
                goat_yard: { kinds: ['goat'], count: 4 },
                duck_pond: { kinds: ['duck'], count: 4 },
                stable: { kinds: ['horse'], count: 3 }
            };
            const info = animalMap[b.type] || { kinds: ['cow'], count: 4 };
            const kinds = info.kinds;
            const spawnCount = info.count || 4;
            const cx = mesh.position.x;
            const cz = mesh.position.z;
            for (let i = 0; i < spawnCount; i++) {
                const k = kinds[i % kinds.length];
                const ang = Math.random() * Math.PI * 2;
                const dist = TILE_SIZE * (0.6 + Math.random() * 1.9);
                const sx = cx + Math.cos(ang) * dist;
                const sz = cz + Math.sin(ang) * dist;
                spawnAnimal(k, sx, sz);
                const last = animals[animals.length - 1];
                if (last) {
                    last.buildingData = b;
                }
            }
        }
    });

    // Connection Pass
    gameState.buildings.forEach(b => {
        const def = BuildingTypes[b.type];
        if (def && (def.type === 'deco_fence' || b.type.includes('path') || b.type.includes('road'))) {
             if (typeof updateConnections === 'function') updateConnections(b.x, b.z, false);
        }
    });
    
    // Ensure Main House exists in scene if it was somehow missing from buildings
    // (Though initFreshState ensures it's in gameState)
    
    // Update UI
    updateUI();
    updateMissionUI();
    updateBuildMenu();
    if (typeof applyWeatherVisuals === 'function') applyWeatherVisuals();
}

// ------------------------------------------------------------------
// INITIALIZATION
// ------------------------------------------------------------------
window.initGame = function(playerName) {
    MockCloud.init();
    if (typeof window.ensureDefaultAdmins === 'function') window.ensureDefaultAdmins();

    // In Preview Mode (no user logged in), just init a default visual state
    // Do NOT load from save yet.
    
    // Default Preview State
    gameState.playerName = "Farmer";
    gameState.missions = initDefaultMissions();
    gameState.gridSize = GRID_SIZE;
    gameState.inventory = {};
    gameState.mainHouseLevel = 1;
    zoomLevel = 150;
    
    // Ensure Main House exists for preview
    gameState.buildings = [{ type: 'main_house', x: 0, z: 0 }];
    
    // Sync global gridSize
    gridSize = gameState.gridSize;
    
    // Setup Three.js
    const container = document.getElementById('game-container');
    
    // Clear existing if any (re-init safety)
    if (container.firstChild) container.removeChild(container.firstChild);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue

    // Isometric Camera (Orthographic)
    const aspect = window.innerWidth / window.innerHeight;
    const d = zoomLevel;
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    
    // Position camera for isometric view
    camera.position.set(200, 200, 200); 
    camera.lookAt(scene.position);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Sharpness
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    container.appendChild(renderer.domElement);

    // Lights
    // Hemisphere light for natural outdoor lighting - Brighter for "FarmVille" look
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xebf4fa, 0.8); // Higher intensity, bluish ground color
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xfffee0, 1.1); // Warm sunlight, higher intensity
    dirLight.position.set(100, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; // Optimized shadows
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    updateShadowBounds(); // Dynamic shadow bounds
    scene.add(dirLight);

    // Cartoon Moon (appears at evening/night) - crescent + glow sprite for stylized look
    window.moonGroup = new THREE.Group();
    // Main bright sphere (moon body) - toon material for cartoon shading
    const moonMainMat = new THREE.MeshToonMaterial({ color: 0xf8fbff, emissive: 0xeef7ff, emissiveIntensity: 0.9 });
    const moonMainGeo = new THREE.SphereGeometry(6.0, 32, 32);
    const moonMain = new THREE.Mesh(moonMainGeo, moonMainMat);
    moonMain.name = 'moon_main';
    moonMain.castShadow = false; moonMain.receiveShadow = false;

    // Subtractive sphere to create crescent silhouette (overlap slightly offset)
    const moonMaskMat = new THREE.MeshStandardMaterial({ color: 0x0b1030, roughness: 1.0 });
    const moonMask = new THREE.Mesh(new THREE.SphereGeometry(6.2, 32, 32), moonMaskMat);
    moonMask.name = 'moon_mask';
    moonMask.castShadow = false; moonMask.receiveShadow = false;
    // Slightly offset so the visible part becomes a crescent
    moonMask.position.set(2.6, 0.0, 0.6);

    // Glow sprite (radial gradient) for soft halo
    const glowSize = 36;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(64,64,8,64,64,64);
    g.addColorStop(0, 'rgba(230,245,255,0.95)');
    g.addColorStop(0.3, 'rgba(200,230,255,0.55)');
    g.addColorStop(1, 'rgba(200,230,255,0.0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,128,128);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending });
    const glow = new THREE.Sprite(spriteMat);
    glow.scale.set(glowSize, glowSize, 1);
    glow.position.set(0, 0, 0);

    // Group assembly: glow behind, main, mask in front to form crescent silhouette
    const moonVisual = new THREE.Group();
    moonVisual.add(glow);
    moonVisual.add(moonMain);
    moonVisual.add(moonMask);

    // Stylized rim: thin torus for cartoony halo/rim light
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xddeeff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(6.45, 0.18, 8, 64), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0.05, 0, 0);
    moonVisual.add(rim);

    // Small stylized craters: add shallow, darker indents as flattened spheres
    const craterMat = new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 1.0 });
    const craterCount = 6;
    const craterGroup = new THREE.Group();
    for (let i = 0; i < craterCount; i++) {
        const r = 0.6 + Math.random() * 1.0;
        const g = new THREE.SphereGeometry(r, 12, 12);
        const crater = new THREE.Mesh(g, craterMat);
        // Place on sphere surface using spherical coords
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() * 0.8 + 0.2) * Math.PI; // avoid exact poles
        const vx = Math.sin(phi) * Math.cos(theta);
        const vy = Math.cos(phi);
        const vz = Math.sin(phi) * Math.sin(theta);
        // Position slightly inset so it looks recessed
        crater.position.set(vx * 5.6, vy * 5.6, vz * 5.6);
        crater.scale.set(1.0, 0.45, 1.0); // flatten to look like a shallow bowl
        crater.castShadow = false; crater.receiveShadow = false;
        craterGroup.add(crater);
    }
    // Attach craters to the moon main so they move/rotate together
    moonMain.add(craterGroup);

    // Soft cloud puffs around moon (sprites)
    const cloudCanvas = document.createElement('canvas'); cloudCanvas.width = cloudCanvas.height = 128;
    const cctx = cloudCanvas.getContext('2d');
    const cg = cctx.createRadialGradient(64,64,8,64,64,64);
    cg.addColorStop(0, 'rgba(255,255,255,0.85)');
    cg.addColorStop(0.4, 'rgba(240,250,255,0.45)');
    cg.addColorStop(1, 'rgba(240,250,255,0.0)');
    cctx.fillStyle = cg; cctx.fillRect(0,0,128,128);
    const cloudTex = new THREE.CanvasTexture(cloudCanvas);
    const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.65 });
    const cloudGroup = new THREE.Group();
    for (let i=0;i<3;i++){
        const sp = new THREE.Sprite(cloudMat.clone());
        sp.scale.set(28 + Math.random()*16, 18 + Math.random()*10, 1);
        sp.position.set((Math.random()-0.5)*18, (Math.random()-0.1)*8, -2 + Math.random()*2);
        cloudGroup.add(sp);
    }
    moonVisual.add(cloudGroup);

    // Soft point light to simulate moon glow (low intensity)
    const moonLight = new THREE.PointLight(0xcfe8ff, 0.6, 320, 2);
    moonLight.name = 'moon_light';
    moonLight.position.set(0, 0, 0);

    window.moonGroup.add(moonVisual);
    window.moonGroup.add(moonLight);
    window.moonGroup.userData = { main: moonMain, mask: moonMask, glowSprite: glow, light: moonLight, rim: rim, craters: craterGroup, clouds: cloudGroup };
    window.moonGroup.visible = false;
    scene.add(window.moonGroup);

    // Twinkling stars: many small sprites in the sky that pulse at night
    window.starGroup = new THREE.Group();
    const starCanvas = document.createElement('canvas'); starCanvas.width = starCanvas.height = 32;
    const sctx = starCanvas.getContext('2d');
    const sg = sctx.createRadialGradient(16,16,1,16,16,16);
    sg.addColorStop(0,'rgba(255,255,255,1)');
    sg.addColorStop(0.6,'rgba(200,230,255,0.8)');
    sg.addColorStop(1,'rgba(200,230,255,0)');
    sctx.fillStyle = sg; sctx.fillRect(0,0,32,32);
    const starTex = new THREE.CanvasTexture(starCanvas);
    for (let i=0;i<120;i++) {
        const m = new THREE.SpriteMaterial({ map: starTex, transparent: true, opacity: 0.0, depthWrite: false });
        const sp = new THREE.Sprite(m);
        sp.scale.set(2 + Math.random()*4, 2 + Math.random()*4, 1);
        sp.position.set((Math.random()-0.5)*800, 80 + Math.random()*260, -50 - Math.random()*200);
        sp.userData = { seed: Math.random()*10, base: 0.2 + Math.random()*0.6 };
        window.starGroup.add(sp);
    }
    window.starGroup.visible = false;
    scene.add(window.starGroup);

    // Clouds
    initClouds();
    initWeatherFX();
    initBirds();

    // Ground / Grid
    const geometry = new THREE.PlaneGeometry(gridSize * TILE_SIZE, gridSize * TILE_SIZE);
    
    // High Quality Grass Texture
    const grassTexture = createProceduralTexture('grass');
    grassTexture.repeat.set(gridSize, gridSize); // Repeat per tile for high detail
    
    const material = new THREE.MeshStandardMaterial({ 
        map: grassTexture,
        roughness: 1, 
        metalness: 0 
    }); 
    
    groundPlane = new THREE.Mesh(geometry, material);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    gridHelper = new THREE.GridHelper(gridSize * TILE_SIZE, gridSize, 0x000000, 0x000000);
    gridHelper.material.opacity = 0.1;
    gridHelper.material.transparent = true;
    gridHelper.visible = false; // Hide by default - only show when placing/moving
    scene.add(gridHelper);

    // Restore buildings from save
    objects = [];
    npcs = [];
    gameState.buildings.forEach(b => {
        const mesh = createDetailedBuilding(b.type, b);
        mesh.position.set(b.x, 0, b.z); // detailed buildings handle their own Y offset
        scene.add(mesh);
        objects.push(mesh);
        mesh.userData.scaleProgress = 1; // Already built

        if (b.type === 'house') {
            spawnNPC(b.x, b.z);
        }
        const def = BuildingTypes[b.type];
        if (def && def.category === 'vehicle') {
            vehicles.push({ mesh, seed: Math.random()*10, baseX: b.x, baseZ: b.z });
        }
    });

    // Interaction
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Drag Controls
    let isDragging = false;
    let isMouseDown = false;
    let mouseDownPos = { x: 0, y: 0 };
    let previousMousePosition = { x: 0, y: 0 };

    window.addEventListener('resize', onWindowResize, false);
    
    // Attach to renderer only to avoid UI conflicts
    renderer.domElement.addEventListener('pointerdown', (e) => {
        if (!gameStarted) return; // Disable interaction on start screen

        // Check for UI clicks first
        if (e.target.closest('.ui-panel') || 
            e.target.closest('.modal') || 
            e.target.closest('#start-screen') ||
            e.target.closest('#move-btn') ||
            e.target.tagName === 'INPUT') return;

        isMouseDown = true;
        mouseDownPos = { x: e.clientX, y: e.clientY };
        previousMousePosition = { x: e.clientX, y: e.clientY };

        if (e.button === 2 || e.button === 1) { // Right or Middle click
            isDragging = true;
        } else {
            isDragging = false; // Wait for movement to confirm drag
        }
    }, false);

    renderer.domElement.addEventListener('pointerup', (e) => {
        isMouseDown = false;
        
        if (isDragging) {
            isDragging = false;
        } else {
            // It was a click!
            // Only Left Click triggers interactions
            if (e.button === 0) {
                handleInteraction(e);
            }
        }
    }, false);

    renderer.domElement.addEventListener('pointermove', (e) => {
        if (!gameStarted) return;
        
        if (isMouseDown && !isDragging) {
             const dx = e.clientX - mouseDownPos.x;
             const dy = e.clientY - mouseDownPos.y;
             if (Math.sqrt(dx*dx + dy*dy) > 5) { // 5px threshold
                 isDragging = true;
             }
        }

        if (isDragging) {
            const deltaMove = {
                x: e.clientX - previousMousePosition.x,
                y: e.clientY - previousMousePosition.y
            };
            
            // Adjust camera position
            // Isometric mapping: X screen movement affects X and Z world coords
            const speed = 0.5 * (zoomLevel / 100);
            camera.position.x -= (deltaMove.x + deltaMove.y) * speed;
            camera.position.z -= (deltaMove.y - deltaMove.x) * speed;
            
            previousMousePosition = { x: e.clientX, y: e.clientY };
        } else {
            // Drag Logic for Move Mode
            if (moveMode && movingObject) {
                mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObject(groundPlane);
                
                if (intersects.length > 0) {
                    const point = intersects[0].point;
                    // Follow cursor directly (no grid snapping during drag)
                    let cx = point.x;
                    let cz = point.z;
                    
                    // Clamp to grid bounds with 1.5 unit margin
                    const limit = (gameState.gridSize * TILE_SIZE) / 2 - 1.5;
                    cx = Math.max(-limit, Math.min(limit, cx));
                    cz = Math.max(-limit, Math.min(limit, cz));

                    movingObject.position.set(cx, 5, cz);

                    // Collision Check
                    const originalPos = movingObject.userData.originalPos;
                    if (originalPos) {
                        const buildingData = gameState.buildings.find(b => 
                            Math.abs(b.x - originalPos.x) < 0.1 && 
                            Math.abs(b.z - originalPos.z) < 0.1
                        );
                        
                        if (buildingData) {
                            const currentRot = Math.round(-movingObject.rotation.y / (Math.PI/2)) & 3; 
                            const tiles = getOccupiedTiles(buildingData.type, cx, cz, currentRot);

                            const isValid = !checkCollision(tiles, [buildingData]);
                            
                            const color = isValid ? 0x00ff00 : 0xff0000;
                            movingObject.traverse((child) => {
                                if (child.isMesh) {
                                    child.material.emissive.setHex(color);
                                    child.material.emissiveIntensity = 0.5;
                                }
                            });
                        }
                    }
                }
            }

            // Preview Logic for Build Mode
            if (selectedBuildingType && previewMesh) {
                mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObject(groundPlane);
                
                if (intersects.length > 0) {
                    const point = intersects[0].point;
                    const gx = Math.round(point.x / TILE_SIZE) * TILE_SIZE;
                    const gz = Math.round(point.z / TILE_SIZE) * TILE_SIZE;
                    
                    // Clamp with 1.5 unit margin
                    const limit = (gameState.gridSize * TILE_SIZE) / 2 - 1.5;
                    const cx = Math.max(-limit, Math.min(limit, gx));
                    const cz = Math.max(-limit, Math.min(limit, gz));
                    
                    previewMesh.position.set(cx, 0, cz);

                    // Check Collision for Color
                    const tiles = getOccupiedTiles(selectedBuildingType, cx, cz, selectedRotation || 0);
                    let isValid = true;
                    
                    const def = BuildingTypes[selectedBuildingType];
                    if (def.category === 'tree') {
                         // Tree: Can be on PLOT or GROUND
                         for(const t of tiles) {
                            const onTile = gameState.buildings.filter(b => {
                                 const bTiles = getOccupiedTiles(b.type, b.x, b.z, b.rotation || 0);
                                 return bTiles.some(bt => Math.abs(bt.x - t.x) < 1 && Math.abs(bt.z - t.z) < 1);
                            });
                            
                            const hasNonPlot = onTile.some(b => BuildingTypes[b.type].category !== 'plot');
                            
                            if (hasNonPlot) isValid = false;
                        }
                    } else if (def.category === 'crop') {
                         // Crop: Must be on a PLOT
                         for(const t of tiles) {
                            const onTile = gameState.buildings.filter(b => {
                                 const bTiles = getOccupiedTiles(b.type, b.x, b.z, b.rotation || 0);
                                 return bTiles.some(bt => Math.abs(bt.x - t.x) < 1 && Math.abs(bt.z - t.z) < 1);
                            });
                            
                            const hasPlot = onTile.some(b => BuildingTypes[b.type].category === 'plot');
                            const hasCrop = onTile.some(b => BuildingTypes[b.type].category === 'crop' || BuildingTypes[b.type].category === 'tree');
                            
                            if (!hasPlot || hasCrop) isValid = false;
                        }
                    } else {
                         if (checkCollision(tiles)) isValid = false;
                    }

                    const color = isValid ? 0x00ff00 : 0xff0000;
                    previewMesh.traverse((child) => {
                        if (child.isMesh) {
                            child.material.emissive.setHex(color);
                        }
                    });

                    // Update Tile Marker
                    if (tileMarker) {
                        tileMarker.position.set(cx, 0.2, cz);
                        tileMarker.material.color.setHex(color);
                    }
                }
            }

            if (!selectedBuildingType && !sellMode && !moveMode) {
                mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
                raycaster.setFromCamera(mouse, camera);
                const objHits = raycaster.intersectObjects(objects, true);
                if (objHits.length > 0) {
                    let o = objHits[0].object;
                    while (o.parent && o.parent.type !== 'Scene') o = o.parent;

                    // Check if plot has crop
                    if (o.userData && o.userData.isPlot) {
                        const cropObj = objects.find(obj => 
                            obj.userData.isCrop && 
                            Math.abs(obj.position.x - o.position.x) < 0.1 && 
                            Math.abs(obj.position.z - o.position.z) < 0.1
                        );
                        if (cropObj) o = cropObj;
                    }

                    // Per-building Silo/Warehouse upgrade menu
                    // Only handle per-building upgrade menu for silos and warehouses on click, not hover
                    // (moved to handleInteraction)

                    if (o.userData && o.userData.isCrop && o.userData.growth >= 1) {
                        if (hoveredCrop && hoveredCrop !== o) setCropHighlight(hoveredCrop, false);
                        setCropHighlight(o, true);
                        hoveredCrop = o;
                    } else {
                        if (hoveredCrop) setCropHighlight(hoveredCrop, false);
                        hoveredCrop = null;
                    }
                } else {
                    if (hoveredCrop) setCropHighlight(hoveredCrop, false);
                    hoveredCrop = null;
                }
            } else {
                if (hoveredCrop) setCropHighlight(hoveredCrop, false);
                hoveredCrop = null;
            }
        }
    }, false);

    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault()); // Disable context menu
    renderer.domElement.addEventListener('wheel', (e) => {
        if (!gameStarted) return;
        onMouseWheel(e);
    }, { passive: false });
    
    // Create Move Button Dynamically
    const controlGroup = document.querySelector('.control-group');
    if (controlGroup && !document.getElementById('move-btn')) {
        const moveBtn = document.createElement('button');
        moveBtn.id = 'move-btn';
        moveBtn.innerHTML = '✋';
        moveBtn.style.cssText = `
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 0 #1f618d;
            transition: all 0.1s;
            font-size: 24px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
            z-index: 1001;
        `;
        moveBtn.title = 'Move Mode';
        
        // Add event listener directly
        moveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Move button clicked!");
            window.toggleMoveMode();
        }, true); // Use capture phase
        
        controlGroup.appendChild(moveBtn);
        console.log("Move button created dynamically");
    }
    
    // UI
    updateUI();
    updateMissionUI();
    updateBuildMenu();
    applyWeatherVisuals();
    
    // Setup Button Event Listeners (backup for onclick handlers)
    const moveBtn = document.getElementById('move-btn');
    if (moveBtn) {
        moveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Move button clicked via event listener");
            window.toggleMoveMode();
        });
    }
    
    const sellBtn = document.getElementById('sell-btn');
    if (sellBtn) {
        sellBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Sell button clicked via event listener");
            window.toggleSellMode();
        });
    }

    // Ensure sell button has a reliable handler after DOM is ready (fallback)
    document.addEventListener('DOMContentLoaded', function() {
        try {
            const sb = document.getElementById('sell-btn');
            if (sb) {
                sb.removeEventListener('click', window.__sellBtnFallbackHandler);
                window.__sellBtnFallbackHandler = function(e) {
                    console.log('Sell button clicked via DOMContentLoaded fallback');
                    e.preventDefault();
                    e.stopPropagation();
                    window.toggleSellMode();
                };
                sb.addEventListener('click', window.__sellBtnFallbackHandler);
                console.log('sell-btn fallback listener attached');
            }
        } catch (e) { console.error('sell-btn fallback attach error', e); }
    });

    // Deeper instrumentation: inspect/repair sell button and watch for DOM changes
    (function() {
        function inspectSellBtn() {
            try {
                const sb = document.getElementById('sell-btn');
                if (!sb) {
                    console.warn('inspectSellBtn: sell-btn not found');
                    return;
                }
                console.log('inspectSellBtn: sell-btn found', sb);
                try {
                    console.log('sell-btn outerHTML:', sb.outerHTML);
                } catch(e) {}
                const onclickAttr = sb.getAttribute('onclick');
                console.log('sell-btn onclick attribute:', onclickAttr);
                // Remove any inline onclick to avoid silent errors
                if (onclickAttr) {
                    try { sb.removeAttribute('onclick'); console.log('Removed inline onclick from sell-btn'); } catch(e) { console.warn('Failed removing inline onclick', e); }
                }

                // Remove previously attached fallback handler if present
                if (window.__sellBtnFallbackHandler) {
                    try { sb.removeEventListener('click', window.__sellBtnFallbackHandler); } catch(e) {}
                }

                // Attach a robust handler and store reference
                window.__sellBtnRobustHandler = function(e) {
                    console.log('sell-btn robust handler fired');
                    try { e.preventDefault(); e.stopPropagation(); } catch(e) {}
                    try { window.toggleSellMode(); } catch(err) { console.error('toggleSellMode threw', err); }
                };
                sb.addEventListener('click', window.__sellBtnRobustHandler, true);
                console.log('sell-btn robust handler attached');

            } catch (e) {
                console.error('inspectSellBtn error', e);
            }
        }

        // Run immediately in case DOM already ready
        try { inspectSellBtn(); } catch(e) { console.error(e); }

        // Also run on window load
        window.addEventListener('load', function() { inspectSellBtn(); });

        // Watch for DOM mutations that add/remove the sell button
        try {
            const mo = new MutationObserver(function(muts) {
                muts.forEach(m => {
                    m.addedNodes && m.addedNodes.forEach(node => {
                        try {
                            if (node && node.id === 'sell-btn') {
                                console.log('MutationObserver: sell-btn was (re)added to DOM');
                                inspectSellBtn();
                            } else if (node && node.querySelector && node.querySelector('#sell-btn')) {
                                console.log('MutationObserver: sell-btn found inside added node');
                                inspectSellBtn();
                            }
                        } catch(e){ }
                    });
                });
            });
            mo.observe(document.body, { childList: true, subtree: true });
            console.log('sell-btn MutationObserver attached');
        } catch(e) { console.warn('MutationObserver attach failed', e); }
    })();
    
    // Start Loop
    animate(0);

    // Audio Start Interaction
    window.addEventListener('click', () => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        SoundEffects.playBGM();
    }, { once: true });

    // Income Timer
    setInterval(gameTick, 8000);
};

// ------------------------------------------------------------------
// ONLINE CHAT SYSTEM
// ------------------------------------------------------------------
let chatSocket = null;
let isChatOpen = false;
let isOfflineMode = false;

window.toggleChat = function() {
    isChatOpen = !isChatOpen;
    const win = document.getElementById('chat-panel');
    if (win) win.style.display = isChatOpen ? 'flex' : 'none';
    if (isChatOpen && !chatSocket && !isOfflineMode) initChat();
};

window.saveServerSettings = function() {
    const input = document.getElementById('server-url-input');
    let url = input ? input.value.trim() : '';
    if (!url) url = 'http://localhost:3000';
    localStorage.setItem('farmSimServerUrl', url);
    if (chatSocket) chatSocket.disconnect();
    isOfflineMode = false; 
    initChat(url);
    showNotification('Server settings saved. Reconnecting...', 'info');
};

function initChat(overrideUrl) {
    if (typeof io === 'undefined') {
        if (!isOfflineMode) startOfflineChat();
        return;
    }
    let url = overrideUrl;
    if (!url) url = localStorage.getItem('farmSimServerUrl');
    if (!url) url = (location.protocol === 'file:') ? 'http://localhost:3000' : '/';
    
    try {
        chatSocket = io(url, { reconnectionAttempts: 2, timeout: 2000, reconnectionDelay: 1000 });
        
        chatSocket.on('connect', () => {
            isOfflineMode = false;
            addChatMessage({ user: 'System', text: 'Connected to Global Chat!', system: true });
            showNotification('Connected to Online Server!', 'success');
        });
        chatSocket.on('connect_error', () => {
            if (!isOfflineMode) startOfflineChat();
        });
        chatSocket.on('disconnect', () => {
            addChatMessage({ user: 'System', text: 'Disconnected.', system: true });
            startOfflineChat();
        });
        chatSocket.on('onlineCount', (count) => {
            const el = document.getElementById('online-count');
            if (el) el.innerText = count + ' Online';
        });
        chatSocket.on('chatMessage', (msg) => addChatMessage(msg));
        chatSocket.on('chatHistory', (msgs) => {
            const container = document.getElementById('chat-messages');
            if (container) {
                container.innerHTML = ''; 
                msgs.forEach(addChatMessage);
            }
        });
    } catch(e) {
        startOfflineChat();
    }

    const input = document.getElementById('chat-input');
    if (input) {
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    
    // Start NPC Chat Loop
    npcChatLoop();
}

function startOfflineChat() {
    if (isOfflineMode) return;
    isOfflineMode = true;
    addChatMessage({ user: 'System', text: 'Server unavailable. Switched to Offline Simulation Mode.', system: true });
    const el = document.getElementById('online-count');
    if (el) el.innerText = 'Simulated';
    
    // Ensure loop starts
    npcChatLoop();
}

window.sendChatMessage = function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    const user = gameState.playerName || 'Farmer';
    let role = 'user';
    
    // Check Roles
    if (user === 'Alex' || user === 'Developer') role = 'owner';
    else {
        const roles = JSON.parse(localStorage.getItem('farmSimRoles') || '{}');
        if (roles[user] === 'admin') role = 'admin';
    }
    
    if (isOfflineMode) {
        addChatMessage({ user: user, text: text, role: role });
        // Sim response
        if (text.toLowerCase().includes('hello')) {
            setTimeout(() => addChatMessage({ user: 'FarmBot', text: `Hello ${user}!`, role: 'user' }), 1000);
        }
    } else if (chatSocket) {
        chatSocket.emit('chatMessage', { user: user, text: text, role: role });

        // Also forward message to Ably via server proxy for global distribution
        try {
            fetch('/api/ably/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel: 'getting-started-widget', name: user, data: text })
            })
            .then(res => res.json())
            .then(resp => console.log('Ably publish response:', resp))
            .catch(err => console.warn('Ably publish failed:', err));
        } catch (e) {
            console.warn('Ably publish error:', e);
        }
    }
    input.value = '';
};

window.addChatMessage = function(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'chat-msg';
    if (msg.system) div.classList.add('system');
    if (msg.system) {
        div.innerText = msg.text;
        div.style.color = '#bdc3c7';
        div.style.fontStyle = 'italic';
    } else {
        const safeUser = msg.user.replace(/</g, '&lt;');
        const safeText = msg.text.replace(/</g, '&lt;');
        let roleBadge = '';
        let nameColor = '#f1c40f'; 
        let msgStyle = '';

        if (msg.role === 'owner') {
            roleBadge = '<span style="background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 5px; font-weight:bold; border:1px solid #c0392b;">OWNER</span>';
            nameColor = '#e74c3c';
            msgStyle = 'text-shadow: 0 0 5px rgba(231, 76, 60, 0.3);';
        } else if (msg.role === 'admin') {
            roleBadge = '<span style="background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 5px; font-weight:bold; border:1px solid #2980b9;">ADMIN</span>';
            nameColor = '#3498db';
        }
        
        div.innerHTML = `${roleBadge}<span class='user' style="color: ${nameColor}; font-weight:bold;">${safeUser}:</span> <span style="${msgStyle}">${safeText}</span>`;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
};

// --- Smart AI Assistant Backend (local)
window.processAIQuery = function(query) {
    try {
        if (!query) return "💬 Ask me anything about crops, animals, buildings, or tips.";
        const q = query.toLowerCase();

        // Quick context helpers
        const money = gameState.money || 0;
        const diamonds = gameState.diamonds || 0;
        const inv = gameState.inventory || {};
        const houses = (gameState.buildings || []).filter(b => b.type === 'house').length;
        const barns = (gameState.buildings || []).filter(b => b.type === 'barn').length;
        const coops = (gameState.buildings || []).filter(b => b.type === 'coop').length;

        if (q.includes('hello') || q.includes('hi')) return `👋 Hello ${gameState.playerName || 'Farmer'}! You have $${money} and ${diamonds} diamonds. Ask me for tips like 'best crops', 'npc farmers', or 'how to sell'.`;
        if (q.includes('best crop') || q.includes('best crops') || q.includes('profit')) return '🌾 Fast profit: Wheat and Lettuce. High value: Watermelon and Strawberry. Balance quick-harvest and high-value crops.';
        if (q.includes('how to get diamonds') || q.includes('diamonds')) return '💎 Diamonds: complete missions, daily login, special events and high-level achievements. Focus missions for steady diamond income.';
        if (q.includes('sell') || q.includes('selling')) return "💲 Use the Sell button (💲) to enter sell mode, then click objects to sell. You can also open Inventory and press 'Sell' to sell all of one type.";
        if (q.includes('taxi') || q.includes('canberra')) return "🚕 The Canberra Elite Taxis vehicle is available in the shop under Vehicles. Place it to see the vehicle on your farm; it has readable roof and door signage.";
        if (q.includes('time') || q.includes('clock')) return "🕒 The HUD clock shows in-game time (not your PC time). Time affects NPC schedules and day/night events.";
        if (q.includes('npc') || q.includes('farmer') || q.includes('collect')) {
            let resp = '👩‍🌾 NPC Farmers: Place a House to spawn farmers. They will collect eggs, milk and truffles and return them to your inventory. You currently have ' + houses + ' house(s).';
            if (houses === 0) resp += ' Build a House to enable NPC farmers.';
            if (q.includes('truffle')) resp += ' Pigs produce truffles near Pig Pens; NPCs will pick them up when assigned.';
            return resp;
        }
        if (q.includes('inventory') || q.includes('storage')) return `📦 You have ${Object.keys(inv).length} item types in inventory. Use Silos and Warehouses to increase capacity.`;
        if (q.includes('how to play') || q.includes('tutorial')) {
            // Suggest opening the tutorial
            return "🎓 Open the 3D Tutorial (🎓 button) for an interactive walkthrough. If you'd like, I can start a step for you — ask 'start tutorial'.";
        }

        // Fallback: give a helpful generic tip
        return "💬 I can help with: 'best crops', 'how to get diamonds', 'npc farmers', 'sell', 'taxi', 'time', or 'tutorial'. Ask one of these or be specific about a problem.";
    } catch (e) {
        console.error('processAIQuery error', e);
        return "💬 Sorry, I hit a problem processing that. Try a simpler question.";
    }
};

const botNames = ["FarmKing", "CowLover", "TractorTom", "Daisy", "GreenThumb", "HarvestMoon", "ChickenLady", "CornMaster"];
const botMessages = [
    "Anyone have extra corn?", "Just upgraded my barn!", "Rain coming soon?", "Nice farm layout!", 
    "Selling wheat cheap!", "How do I get more diamonds?", "My cows are happy today!", 
    "Looking for a coop partner!", "Can someone help me with water?", "Love this game!"
];

function simulateBotMessage() {
    const name = botNames[Math.floor(Math.random() * botNames.length)];
    const text = botMessages[Math.floor(Math.random() * botMessages.length)];
    window.addChatMessage({ user: name, text: text, role: 'user' });
}

function npcChatLoop() {
    setTimeout(() => {
        if (Math.random() < 0.4) { // 40% chance
            simulateBotMessage();
        }
        npcChatLoop();
    }, 8000 + Math.random() * 5000);
}

window.startGame = function(playerName) {
    if (playerName && playerName !== "Farmer") {
        gameState.playerName = playerName;
    }
    gameStarted = true;
    updateUI();
    
    // Reset Camera to standard isometric view
    // We need to reset the camera projection/position to the default state set in initGame
    // But since we use Orthographic, we just set position and lookAt
    camera.position.set(200, 200, 200); 
    camera.lookAt(scene.position);
    
    // Ensure projection matches current zoomLevel
    updateCamera();
    
    // Enable controls (they are enabled by default but we might have blocked them)
    SoundEffects.playBGM();
};

// ------------------------------------------------------------------
// GAME LOOP
// ------------------------------------------------------------------
function animate(time) {
    requestAnimationFrame(animate);
    
    const delta = time - lastTime;
    lastTime = time;

    // Cinematic Camera for Start Screen
    if (!gameStarted && scene && camera) {
        const radius = 250;
        const speed = 0.0001;
        camera.position.x = Math.sin(time * speed) * radius;
        camera.position.z = Math.cos(time * speed) * radius;
        camera.position.y = 200;
        camera.lookAt(scene.position);
    }

    updateNPCs(delta);
    updateMarket(delta);
    // update market preview canvas if present
    try { if (typeof updateMarketPreview === 'function') updateMarketPreview(delta); } catch(e) {}
    // updateClouds(delta) removed - handled in updateWeatherFX
    updateDayNight(delta);
    updateWeatherFX(delta);
    updatePuddles(delta);
    updateBuildingAnimations(delta);
    updateCropGrowth(delta);
    updateCropTimers();
    updateBarnTimers();
    updateCoopTimers();
    updatePigPenTimers();
    updateVehicles(delta);
    updateAnimals(delta);
    updateBirds(delta);
    updateSpeechBubbles();

    renderer.render(scene, camera);
}

function updateShadowBounds() {
    if (!dirLight) return;
    const size = gridSize * TILE_SIZE;
    const shadowLimit = (size / 2) * 1.5;
    
    dirLight.shadow.camera.left = -shadowLimit;
    dirLight.shadow.camera.right = shadowLimit;
    dirLight.shadow.camera.top = shadowLimit;
    dirLight.shadow.camera.bottom = -shadowLimit;
    dirLight.shadow.camera.updateProjectionMatrix();
}

function initClouds() {
    const cloudGeo = new THREE.SphereGeometry(8, 8, 8);
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, roughness: 0.9 });
    
    const range = gridSize * TILE_SIZE * 1.5;

    for (let i = 0; i < 5; i++) {
        const cloud = new THREE.Group();
        
        // Create blobs
        for (let j = 0; j < 3; j++) {
            const blob = new THREE.Mesh(cloudGeo, cloudMat);
            blob.position.x = (Math.random() - 0.5) * 10;
            blob.position.y = (Math.random() - 0.5) * 5;
            blob.position.z = (Math.random() - 0.5) * 5;
            cloud.add(blob);
        }

        cloud.position.y = 80 + Math.random() * 20;
        cloud.position.x = (Math.random() - 0.5) * range;
        cloud.position.z = (Math.random() - 0.5) * range;
        
        scene.add(cloud);
        clouds.push({ mesh: cloud, speed: (0.02 + Math.random() * 0.03) * 0.2 }); // Slower clouds (20% speed)
    }
}



let weatherFX = { rain: null, snow: null, splashes: null, puddles: [], clouds: [] };
let puddleMap = new Map(); // Track puddles by position for persistence
// Shared puddle texture (soft radial alpha) to make smooth edges and reuse for all puddles
let sharedPuddleTexture = null;
let MAX_PUDDLES = 60; // cap puddles to keep performance
const textureCache = {};

function createParticleTexture(type) {
    if (textureCache[type]) return textureCache[type];
    
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    if (type === 'rain') {
        // Elongated drop
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(32, 0);
        ctx.quadraticCurveTo(40, 40, 32, 64);
        ctx.quadraticCurveTo(24, 40, 32, 0);
        ctx.fill();
    } else if (type === 'snow') {
        // Soft glow
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
    } else if (type === 'splash') {
        // Ripple ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(32, 32, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(32, 32, 12, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    textureCache[type] = texture;
    return texture;
}

function initWeatherFX() {
        // 4. Cartoon Sun (for clear weather) - Redesigned with expressive face
        const sunGroup = new THREE.Group();
        
        // Sun core - larger main body
        const sunCore = new THREE.Mesh(
            new THREE.SphereGeometry(10, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xfff200, emissiveIntensity: 0.8, roughness: 0.3 })
        );
        sunGroup.add(sunCore);
        
        // Left eye
        const leftEye = new THREE.Mesh(
            new THREE.SphereGeometry(1.5, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        leftEye.position.set(-3.5, 3, 9.5);
        sunGroup.add(leftEye);
        
        // Left pupil
        const leftPupil = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x000000 })
        );
        leftPupil.position.set(-3.5, 3, 10.2);
        sunGroup.add(leftPupil);
        
        // Right eye
        const rightEye = new THREE.Mesh(
            new THREE.SphereGeometry(1.5, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        rightEye.position.set(3.5, 3, 9.5);
        sunGroup.add(rightEye);
        
        // Right pupil
        const rightPupil = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x000000 })
        );
        rightPupil.position.set(3.5, 3, 10.2);
        sunGroup.add(rightPupil);
        
        // Left cheek - rosy blush
        const leftCheek = new THREE.Mesh(
            new THREE.SphereGeometry(1.8, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xff6b9d, emissive: 0xff5588, emissiveIntensity: 0.4 })
        );
        leftCheek.position.set(-6, 0, 7);
        sunGroup.add(leftCheek);
        
        // Right cheek - rosy blush
        const rightCheek = new THREE.Mesh(
            new THREE.SphereGeometry(1.8, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xff6b9d, emissive: 0xff5588, emissiveIntensity: 0.4 })
        );
        rightCheek.position.set(6, 0, 7);
        sunGroup.add(rightCheek);
        
        // Nose - round carrot-like
        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(1, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: 0xff8800, emissiveIntensity: 0.3 })
        );
        nose.position.set(0, -1, 9.5);
        sunGroup.add(nose);
        
        // Smile - arc made from small spheres
        for (let i = 0; i < 7; i++) {
            const smilePart = new THREE.Mesh(
                new THREE.SphereGeometry(0.6, 12, 12),
                new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff3333, emissiveIntensity: 0.5 })
            );
            const angle = (i / 6) * Math.PI;
            smilePart.position.x = (i - 3) * 1.2;
            smilePart.position.y = -3.5 + Math.sin(angle) * 2;
            smilePart.position.z = 8.5;
            sunGroup.add(smilePart);
        }
        
        // Dynamic radiating rays (12 rays arranged in circle)
        for (let i = 0; i < 12; i++) {
            // Ray capsule for better visual
            const rayGroup = new THREE.Group();
            
            // Main ray body
            const ray = new THREE.Mesh(
                new THREE.CylinderGeometry(0.6, 0.8, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0xfff200, emissive: 0xffff00, emissiveIntensity: 0.6, roughness: 0.4 })
            );
            ray.position.y = 13;
            rayGroup.add(ray);
            
            // Ray tip - rounded cone
            const rayTip = new THREE.Mesh(
                new THREE.SphereGeometry(0.9, 12, 12),
                new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.7 })
            );
            rayTip.position.y = 17.5;
            rayGroup.add(rayTip);
            
            rayGroup.rotation.z = Math.PI / 2;
            rayGroup.rotation.y = (i / 12) * Math.PI * 2;
            rayGroup.position.applyAxisAngle(new THREE.Vector3(0,1,0), (i / 12) * Math.PI * 2);
            sunGroup.add(rayGroup);
        }
        
        // Sparkle particles around the sun
        const sparkleGeometry = new THREE.BufferGeometry();
        const sparklePositions = new Float32Array(50 * 3);
        for (let i = 0; i < 50; i++) {
            const angle = (i / 50) * Math.PI * 2;
            const distance = 22 + Math.random() * 5;
            sparklePositions[i*3] = Math.cos(angle) * distance;
            sparklePositions[i*3+1] = (Math.random() - 0.5) * 10;
            sparklePositions[i*3+2] = Math.sin(angle) * distance;
        }
        sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
        const sparkleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.5,
            emissive: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
        sunGroup.add(sparkles);
        
        sunGroup.position.set(0, 120, -120);
        sunGroup.visible = false;
        scene.add(sunGroup);
        weatherFX.sun = sunGroup;
    // 1. Rain Particles - Realistic streaking raindrops
    // Real Rain: uses line geometry for elongated falling streaks
    const makeRain = (count) => {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 6); // 2 vertices per raindrop (line)
        const velocities = new Float32Array(count);
        
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * gridSize * TILE_SIZE * 1.5;
            const y = Math.random() * 120;
            const z = (Math.random() - 0.5) * gridSize * TILE_SIZE * 1.5;
            const rainLength = 3 + Math.random() * 2; // Length of rain streak (3-5 units)
            
            // First vertex (top of rain streak)
            positions[i*6] = x;
            positions[i*6+1] = y;
            positions[i*6+2] = z;
            
            // Second vertex (bottom of rain streak)
            positions[i*6+3] = x;
            positions[i*6+4] = y - rainLength;
            positions[i*6+5] = z;
            
            // Velocity: realistic falling speeds (1.2 - 2.0 units per 60fps frame)
            velocities[i] = 1.5 + Math.random() * 0.5;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));
        
        // Use LINE_SEGMENTS to draw actual rain streaks
        const mat = new THREE.LineBasicMaterial({
            color: 0x8ab4f8, // More realistic light grayish-blue
            transparent: true,
            opacity: 0,
            depthWrite: false,
            linewidth: 1.5,
            fog: true
        });
        
        const lines = new THREE.LineSegments(geo, mat);
        lines.renderOrder = 2;
        scene.add(lines);
        lines.visible = false;
        
        return lines;
    };

    // 2. Snow Particles (Fluffy, drifting)
    // Cartoon Snow: big, fluffy, white
    const makeSnow = (count) => {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const params = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i*3] = (Math.random() - 0.5) * gridSize * TILE_SIZE * 1.5;
            positions[i*3+1] = Math.random() * 120;
            positions[i*3+2] = (Math.random() - 0.5) * gridSize * TILE_SIZE * 1.5;
            params[i*3] = Math.random() * Math.PI * 2;
            params[i*3+1] = 0.5 + Math.random() * 0.5;
            params[i*3+2] = 1.2 + Math.random() * 1.8; // Bigger cartoon flakes
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('params', new THREE.BufferAttribute(params, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 4.5,
            map: createParticleTexture('snow'),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const points = new THREE.Points(geo, mat);
        scene.add(points);
        points.visible = false;
        return points;
    };
    
    // 3. Rain Splashes (On ground)
    const makeSplashes = (count) => {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const times = new Float32Array(count); // Lifecycle of splash
        
        for (let i = 0; i < count; i++) {
            positions[i*3] = 0;
            positions[i*3+1] = -1000; // Hide initially
            positions[i*3+2] = 0;
            times[i] = Math.random();
        }
        
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('time', new THREE.BufferAttribute(times, 1));
        
        const mat = new THREE.PointsMaterial({
            color: 0x88ccff,
            size: 3.0, // Larger for texture
            map: createParticleTexture('splash'),
            transparent: true, 
            opacity: 0.6,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        const points = new THREE.Points(geo, mat);
        scene.add(points);
        return points;
    };

    weatherFX.rain = makeRain(4000); // More rain!
    weatherFX.snow = makeSnow(2000); // More snow!
    weatherFX.splashes = makeSplashes(500);
    
    // Lightning
    const lightning = new THREE.PointLight(0xaaddff, 0, 800);
    lightning.position.set(0, 200, 0);
    scene.add(lightning);
    weatherFX.lightning = lightning;
    weatherFX.lightningTimer = 0;
}

function setCloudDensity(target) {
    target = Math.max(0, Math.min(target, 25));
    
    // Create clouds if needed
    while (clouds.length < target) {
        const cloudGroup = new THREE.Group();
        // Cartoon clouds: round, puffy, bright
        const blobs = 5 + Math.floor(Math.random() * 4);
        for(let i=0; i<blobs; i++) {
            const geo = new THREE.SphereGeometry(4.5 + Math.random()*2.5, 16, 16);
            const mat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 1.0,
                transparent: true,
                opacity: 0.0, // Fade in
                flatShading: true
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                (Math.random()-0.5)*15,
                (Math.random()-0.5)*5,
                (Math.random()-0.5)*10
            );
            mesh.scale.setScalar(0.8 + Math.random()*1.2);
            cloudGroup.add(mesh);
        }
        cloudGroup.position.set(
            (Math.random()-0.5) * 500,
            70 + Math.random() * 30,
            (Math.random()-0.5) * 500
        );
        scene.add(cloudGroup);
        clouds.push({
            mesh: cloudGroup,
            speed: 0.05 + Math.random() * 0.1,
            targetOpacity: 0.92,
            life: 0
        });
    }
    
    // Remove clouds
    while (clouds.length > target) {
        const c = clouds.pop();
        scene.remove(c.mesh);
        // Clean up geometry/materials if strictly needed, but JS GC handles most
    }
}
function applyWeatherVisuals() {
    // Visuals are now handled in updateWeatherFX via smooth transition
    SoundEffects.setWeather(gameState.weather);
}

function getTargetWeatherState() {
    const w = gameState.weather;
    const s = {
        fogDensity: 0,
        fogColor: new THREE.Color(0xffffff),
        groundColor: new THREE.Color(0x7CFC00),
        rainOpacity: 0,
        snowOpacity: 0,
        splashOpacity: 0,
        windSpeed: 1.0,
        cloudDensity: 5,
        skyDarkness: 0 // 0 = normal, 1 = pitch black storm
    };

    if (w === 'Rain') {
        s.fogDensity = 0.002; // Reduced from 0.015 to allow visibility
        s.fogColor.setHex(0x607d8b); // Blue-grey
        s.groundColor.setHex(0x558b2f); // Wet darker green
        s.rainOpacity = 0.6; // Slightly more transparent
        s.splashOpacity = 0.5;
        s.windSpeed = 2.5;
        s.cloudDensity = 15;
        s.skyDarkness = 0.4; // Less dark (was 0.6)
    } else if (w === 'Snow') {
        s.fogDensity = 0.0025; // Reduced from 0.02
        s.fogColor.setHex(0xe0e0e0); // White-grey
        s.groundColor.setHex(0xffffff); // White ground
        s.snowOpacity = 0.8;
        s.windSpeed = 1.5;
        s.cloudDensity = 12;
        s.skyDarkness = 0.2; // Less dark (was 0.3)
    } else if (w === 'Cloudy') {
        s.fogDensity = 0.001; // Reduced from 0.005
        s.fogColor.setHex(0xb0bec5);
        s.groundColor.setHex(0x689f38);
        s.windSpeed = 1.2;
        s.cloudDensity = 10;
        s.skyDarkness = 0.3;
    }
    return s;
}

function updateWeatherFX(delta) {
        // Cartoon Sun Animation (Clear weather)
        if (weatherFX.sun) {
            if (gameState.weather === 'Clear' || gameState.weather === 'Sunny') {
                weatherFX.sun.visible = true;
                // Animate sun rays
                let t = Date.now() * 0.001;
                for (let i = 1; i < weatherFX.sun.children.length; i++) {
                    let ray = weatherFX.sun.children[i];
                    ray.rotation.x = Math.sin(t + i) * 0.2;
                }
            } else {
                weatherFX.sun.visible = false;
            }
        }
    if (!weatherFX.rain || !weatherFX.snow) return;

    const gust = 1 + Math.sin(Date.now() * 0.0007) * 0.3;

    // --- TRANSITION LOGIC ---
    const target = getTargetWeatherState();
    const lerpSpeed = delta * 0.0005; // Slower transition (was 0.002)

    // Fog
    if (!scene.fog) scene.fog = new THREE.FogExp2(0xffffff, 0);
    scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, target.fogDensity, lerpSpeed);
    scene.fog.color.lerp(target.fogColor, lerpSpeed);

    // Ground
    if (groundPlane && groundPlane.material) {
        groundPlane.material.color.lerp(target.groundColor, lerpSpeed);
    }

    // Wind
    windSpeed = THREE.MathUtils.lerp(windSpeed, target.windSpeed, lerpSpeed);

    // Clouds
    if (Math.random() < 0.05) {
         if (clouds.length < target.cloudDensity) setCloudDensity(clouds.length + 1);
         else if (clouds.length > target.cloudDensity) setCloudDensity(clouds.length - 1);
    }
    
    // Update Cloud Positions
    clouds.forEach(c => {
        c.mesh.position.x += c.speed * windSpeed * gust * (delta * 0.05); // Slower clouds
        if (c.mesh.position.x > 300) c.mesh.position.x = -300;
        
        // Pulse opacity
        c.life += delta * 0.001;
        c.mesh.children.forEach(blob => {
            if (blob.material) {
                // Fade in/out slightly
                blob.material.opacity = THREE.MathUtils.lerp(blob.material.opacity, c.targetOpacity, delta * 0.001);
            }
        });
    });

    // Rain Opacity
    if (weatherFX.rain) {
        const cur = weatherFX.rain.material.opacity;
        const next = THREE.MathUtils.lerp(cur, target.rainOpacity, lerpSpeed * 2);
        weatherFX.rain.material.opacity = next;
        weatherFX.rain.visible = next > 0.01;
    }
    
    // Splash Opacity
    if (weatherFX.splashes) {
        const cur = weatherFX.splashes.material.opacity;
        const next = THREE.MathUtils.lerp(cur, target.splashOpacity, lerpSpeed * 2);
        weatherFX.splashes.material.opacity = next;
        weatherFX.splashes.visible = next > 0.01;
    }

    // Snow Opacity
    if (weatherFX.snow) {
        const cur = weatherFX.snow.material.opacity;
        const next = THREE.MathUtils.lerp(cur, target.snowOpacity, lerpSpeed * 2);
        weatherFX.snow.material.opacity = next;
        weatherFX.snow.visible = next > 0.01;
    }

    const time = Date.now() * 0.001;
    
    // Animate Rain (with realistic streaking line geometry)
    if (weatherFX.rain.visible) {
        const pos = weatherFX.rain.geometry.getAttribute('position');
        const vel = weatherFX.rain.geometry.getAttribute('velocity');
        const arr = pos.array;
        const vArr = vel.array;
        
        // Process each raindrop (2 vertices per drop = 6 values)
        for (let i = 0; i < arr.length; i += 6) {
            const dropIndex = i / 6;
            const v = vArr[dropIndex];
            
            // Get the base x and z (same for both vertices of the line)
            const baseX = arr[i];
            const baseZ = arr[i+2];
            
            // Raindrop length (from original y to y-length)
            const rainLength = arr[i+1] - arr[i+4];
            
            // Fall down with realistic speed and wind
            const fallSpeed = v * 2.8 * (delta * 0.06);
            const windShift = windSpeed * gust * 1.2 * (delta * 0.06);
            
            // Top vertex (i, i+1, i+2)
            arr[i] = baseX + windShift;
            arr[i+1] -= fallSpeed;
            arr[i+2] = baseZ;
            
            // Bottom vertex (i+3, i+4, i+5)
            arr[i+3] = baseX + windShift;
            arr[i+4] = arr[i+1] - rainLength;
            arr[i+5] = baseZ;
            
            // Reset if top goes below ground
            if (arr[i+1] < 0) {
                const newX = (Math.random() - 0.5) * gridSize * TILE_SIZE * 1.5;
                const newY = 120 + Math.random() * 40;
                const newZ = (Math.random() - 0.5) * gridSize * TILE_SIZE * 1.5;
                
                // Reset both vertices
                arr[i] = newX;
                arr[i+1] = newY;
                arr[i+2] = newZ;
                arr[i+3] = newX;
                arr[i+4] = newY - rainLength;
                arr[i+5] = newZ;
                
                // Trigger splash if visible
                if (weatherFX.splashes && weatherFX.splashes.visible && Math.random() < 0.2) {
                    spawnSplash(newX, newZ);
                }
            }
        }
        pos.needsUpdate = true;
    }
    
    // Animate Splashes
    if (weatherFX.splashes && weatherFX.splashes.visible) {
        const pos = weatherFX.splashes.geometry.getAttribute('position');
        const times = weatherFX.splashes.geometry.getAttribute('time');
        const pArr = pos.array;
        const tArr = times.array;
        
        for (let i = 0; i < tArr.length; i++) {
             if (pArr[i*3+1] > -500) { // Active splash
                 tArr[i] += delta * 0.005;
                 if (tArr[i] > 1) {
                     pArr[i*3+1] = -1000; // Hide
                 }
             }
        }
        // Material shader would handle animation based on 'time', but here we just use it for lifecycle
        // Since we are using standard PointsMaterial, we can't easily animate scale per particle without shader.
        // For now, just flicker them effectively.
        // To make it look real, we'd need a custom shader.
        // Fallback: Randomly reposition active splashes to simulate "hits" is handled in spawnSplash
        
        pos.needsUpdate = true;
        times.needsUpdate = true;
    }

    // Animate Snow
    if (weatherFX.snow.visible) {
        const pos = weatherFX.snow.geometry.getAttribute('position');
        const params = weatherFX.snow.geometry.getAttribute('params');
        const arr = pos.array;
        const pArr = params.array;
        
        for (let i = 0; i < arr.length; i += 3) {
            const driftPhase = pArr[i];
            const speed = pArr[i+1];
            
            arr[i+1] -= speed * 0.5 * (delta * 0.06); // Fall (Faster)
            arr[i] += (Math.sin(time + driftPhase) * 0.1 + windSpeed * gust * 0.2) * (delta * 0.06); // Drift X (Stronger)
            arr[i+2] += Math.cos(time + driftPhase * 0.5) * 0.05 * (delta * 0.06); // Drift Z
            
            if (arr[i+1] < 0) {
                arr[i] = (Math.random() - 0.5) * gridSize * TILE_SIZE * 1.5;
                arr[i+1] = 100 + Math.random() * 40;
                arr[i+2] = (Math.random() - 0.5) * gridSize * TILE_SIZE * 1.5;
            }
        }
        pos.needsUpdate = true;
    }
    
    // Lightning
    if (gameState.weather === 'Rain' || gameState.weather === 'Cloudy') {
        if (weatherFX.lightningTimer <= 0 && Math.random() < 0.002) {
            // Flash
            weatherFX.lightning.intensity = 5 + Math.random() * 5;
            weatherFX.lightningTimer = 100 + Math.random() * 300;
            // Random position
            weatherFX.lightning.position.x = (Math.random() - 0.5) * 500;
            weatherFX.lightning.position.z = (Math.random() - 0.5) * 500;
            SoundEffects.playThunder(); 
        } else if (weatherFX.lightningTimer > 0) {
            weatherFX.lightningTimer -= delta;
            weatherFX.lightning.intensity *= 0.85; // Fast decay
            if (weatherFX.lightningTimer <= 0) {
                weatherFX.lightning.intensity = 0;
            }
        }
    } else if (weatherFX.lightning) {
        weatherFX.lightning.intensity = 0;
        weatherFX.lightningTimer = 0;
    }
}

// Helper to spawn splash
let splashIdx = 0;
function spawnSplash(x, z) {
    if (!weatherFX.splashes) return;
    const pos = weatherFX.splashes.geometry.getAttribute('position');
    const times = weatherFX.splashes.geometry.getAttribute('time');
    
    // Round robin
    splashIdx = (splashIdx + 1) % pos.count;
    
    pos.setXYZ(splashIdx, x, 0.1, z);
    times.setX(splashIdx, 0); // Reset time
    
    pos.needsUpdate = true;
    times.needsUpdate = true;
    
    // Create persistent puddle on terrain
    createPuddle(x, z);
}

function createPuddle(x, z) {
    // Round to grid position to avoid duplicate puddles
    const gridX = Math.round(x);
    const gridZ = Math.round(z);
    const key = `${gridX},${gridZ}`;
    
    // Check if puddle already exists at this location
    if (puddleMap.has(key)) {
        const puddle = puddleMap.get(key);
        puddle.lifespan = 30; // Reset lifespan (30 seconds)
        puddle.opacity = Math.min(1, puddle.opacity + 0.3); // Increase opacity
        return;
    }
    
    // Create new puddle (use shared texture for smooth soft edges)
    if (!sharedPuddleTexture) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const grd = ctx.createRadialGradient(size/2, size/2, 10, size/2, size/2, size/2);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.6, 'rgba(200,220,235,0.6)');
        grd.addColorStop(1, 'rgba(200,220,235,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0,0,size,size);
        sharedPuddleTexture = new THREE.Texture(canvas);
        sharedPuddleTexture.needsUpdate = true;
    }

    // Cap puddles to avoid overcrowding (remove oldest)
    while (weatherFX.puddles.length >= MAX_PUDDLES) {
        const oldest = weatherFX.puddles.shift();
        if (oldest && oldest.mesh) {
            scene.remove(oldest.mesh);
            try { oldest.mesh.geometry.dispose(); oldest.mesh.material.dispose(); } catch(e) {}
            puddleMap.delete(`${oldest.position.x},${oldest.position.z}`);
        }
    }

    const puddleSize = 1.0 + Math.random() * 1.2; // slightly variable
    const puddleGeo = new THREE.CircleGeometry(puddleSize, 12);
    const puddleMat = new THREE.MeshBasicMaterial({
        map: sharedPuddleTexture,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
    });

    const puddleMesh = new THREE.Mesh(puddleGeo, puddleMat);
    puddleMesh.position.set(x, 0.01, z); // nearer to ground to avoid blocking
    puddleMesh.rotation.x = -Math.PI / 2; // Face up
    puddleMesh.receiveShadow = false;
    puddleMesh.castShadow = false;
    puddleMesh.renderOrder = 1; // draw after ground

    scene.add(puddleMesh);

    // Track puddle
    const puddle = {
        mesh: puddleMesh,
        lifespan: 18, // shorter lifespan
        maxLifespan: 18,
        opacity: 0.55,
        position: { x: gridX, z: gridZ }
    };

    puddleMap.set(key, puddle);
    weatherFX.puddles.push(puddle);
}

function updatePuddles(delta) {
    // Update puddles (iterate backward for safe removal)
    for (let i = weatherFX.puddles.length - 1; i >= 0; i--) {
        const puddle = weatherFX.puddles[i];
        // Use seconds
        puddle.lifespan -= delta * 0.001;

        // Smooth fade using ease-out
        const t = Math.max(0, Math.min(1, puddle.lifespan / puddle.maxLifespan));
        const eased = t * t; // quadratic easing
        puddle.mesh.material.opacity = puddle.opacity * eased;

        // Slight gentle shimmer when fresh (scale/pulse)
        const agePct = 1 - t;
        if (agePct < 0.6) {
            const s = 1 + Math.sin(Date.now() * 0.005 + i) * 0.005;
            puddle.mesh.scale.set(s, s, s);
        }

        if (puddle.lifespan <= 0) {
            scene.remove(puddle.mesh);
            try { puddle.mesh.geometry.dispose(); puddle.mesh.material.dispose(); } catch(e) {}
            weatherFX.puddles.splice(i, 1);
            puddleMap.delete(`${puddle.position.x},${puddle.position.z}`);
        }
    }
}

function updateDayNight(delta) {
    gameTime += delta * 0.00005; // Slower days (was 0.00015)
    if (gameTime > 24) gameTime = 0;

    // Update Ambiance based on time
    SoundEffects.updateAmbiance(gameTime);

    // Update UI Day Part
    let currentPart = 'Night';
    if (gameTime >= 5 && gameTime < 8) currentPart = 'Morning';
    else if (gameTime >= 8 && gameTime < 17) currentPart = 'Day';
    else if (gameTime >= 17 && gameTime < 20) currentPart = 'Evening';
    
    // Always update UI to show part
    if (window.lastDayPart !== currentPart) {
        window.lastDayPart = currentPart;
        updateUI();
    }

    // Weather influence
    const weatherTarget = getTargetWeatherState();
    
    let brightness = 1;
    let color = new THREE.Color(0x87CEEB); // Day Blue

    // Calculate Base Day/Night Color
    if (gameTime < 6 || gameTime > 18) {
        // Night
        brightness = 0.2;
        color.setHex(0x000022); // Dark Blue
        if (gameTime > 5 && gameTime < 6) { // Dawn
             const t = gameTime - 5;
             brightness = 0.2 + t * 0.8;
             color.lerp(new THREE.Color(0xFFAA00), t); // To Orange
        } else if (gameTime > 18 && gameTime < 19) { // Dusk
             const t = gameTime - 18;
             brightness = 1.0 - t * 0.8;
             color.lerp(new THREE.Color(0x000022), t); // To Dark
        }
    } else {
        // Day
        if (gameTime < 7) {
             const t = gameTime - 6;
             color.setHex(0xFFAA00);
             color.lerp(new THREE.Color(0x87CEEB), t); // To Blue
        }
    }
    
    // Apply Weather Darkening
    if (weatherTarget.skyDarkness > 0) {
        const darkColor = new THREE.Color(0x2c3e50); // Stormy dark grey
        color.lerp(darkColor, weatherTarget.skyDarkness);
        brightness *= (1.0 - weatherTarget.skyDarkness * 0.6); // Reduce brightness
    }

    // Apply
    if (scene.background && scene.background.isColor) {
        scene.background.lerp(color, delta * 0.005);
    } else {
        scene.background = color;
    }
    
    // Sun visibility: only show sun during morning/noon/afternoon (not evening/night)
    const sunVisible = (gameTime >= 5 && gameTime < 17); // 5:00 - 16:59
    // Target sun intensity is brightness during day, zero at night
    const targetSunIntensity = sunVisible ? brightness : 0;
    if (dirLight) {
        dirLight.intensity = THREE.MathUtils.lerp(dirLight.intensity, targetSunIntensity, delta * 0.01);
        dirLight.visible = dirLight.intensity > 0.01;
    }

    // Moon visibility and positioning for evening/night
    if (window.moonGroup) {
        const moonVisible = !sunVisible;
        window.moonGroup.visible = moonVisible;
        if (moonVisible) {
            // Position moon on a smooth arc across the sky based on time (opposite of sun)
            const angle = ((gameTime / 24) * Math.PI * 2) + Math.PI * 0.5; // offset so moon rises later
            const radius = 220;
            const mx = Math.cos(angle) * radius;
            const mz = Math.sin(angle) * radius * 0.6;
            const my = Math.sin(angle) * 80 + 90; // vertical arc
            window.moonGroup.position.set(mx, my, mz);

            // Animate crescent phase by sliding the mask slightly based on time
            const phaseOffset = Math.sin(angle * 2.0) * 2.6; // small oscillation
            try {
                const ud = window.moonGroup.userData || {};
                if (ud.mask) ud.mask.position.x = 2.6 + phaseOffset;
                if (ud.main) ud.main.rotation.y = (angle % (Math.PI*2)) * 0.07;
                if (ud.glowSprite) ud.glowSprite.scale.set(36 + Math.sin(Date.now()*0.001)*1.5, 36 + Math.sin(Date.now()*0.001)*1.5, 1);
                if (ud.light) ud.light.intensity = 0.45 + Math.abs(Math.sin(Date.now() * 0.0009)) * 0.35;
                // Animate rim, craters and clouds for more life
                const tnow = Date.now() * 0.001;
                if (ud.rim && ud.rim.material) ud.rim.material.opacity = 0.7 + Math.sin(tnow * 0.6) * 0.12;
                if (ud.craters) ud.craters.rotation.y = (tnow * 0.08) % (Math.PI*2);
                if (ud.clouds) {
                    ud.clouds.children.forEach((c, i) => {
                        c.position.x += Math.sin(tnow * (0.2 + i*0.07)) * 0.02;
                        c.material && (c.material.opacity = 0.55 + Math.sin(tnow * (0.4 + i*0.1)) * 0.15);
                    });
                }
                // Stars twinkle
                if (window.starGroup) {
                    window.starGroup.visible = moonVisible;
                    window.starGroup.children.forEach(s => {
                        const seed = (s.userData && s.userData.seed) || 0;
                        const base = (s.userData && s.userData.base) || 0.3;
                        const alpha = Math.max(0, base + Math.sin(tnow * 1.2 + seed) * 0.45);
                        if (s.material) s.material.opacity = alpha;
                    });
                }
            } catch(e) {}
        }
    }
    
    // Windows logic (Night only)
    const night = (gameTime < 6 || gameTime > 18);
    const tw = Date.now() * 0.002;
    objects.forEach(obj => {
        const ws = obj.userData && obj.userData.windows;
        if (ws && ws.length) {
            ws.forEach(w => {
                if (!w.userData) w.userData = {};
                if (w.userData.winSeed === undefined) w.userData.winSeed = Math.random() * 10;
                const m = w.material;
                if (m && m.emissive !== undefined) {
                    if (night) {
                        const r = (Math.sin(tw + w.userData.winSeed) + 1) * 0.5;
                        m.emissive.setHex(r < 0.5 ? 0xffbb55 : 0xffcc66);
                    } else {
                        m.emissive.setHex(0x000000);
                    }
                }
            });
        }
    });
}

function updateBuildingAnimations(delta) {
    const time = Date.now() * 0.001;
    objects.forEach(obj => {
        if (obj.userData.scaleProgress !== undefined && obj.userData.scaleProgress < 1) {
            obj.userData.scaleProgress += delta * 0.005;
            if (obj.userData.scaleProgress > 1) obj.userData.scaleProgress = 1;
            // Cartoon bounce pop-in
            const t = obj.userData.scaleProgress;
            const bounce = Math.sin(Math.PI * t) * (1 - t) * 0.25;
            const scale = t + bounce;
            obj.scale.set(scale, scale, scale);
        }

        // --- GENERIC ANIMATIONS BASED ON CHILD NAMES ---
        
        // Rotating Blades (Mill, etc.)
        const blades = obj.getObjectByName('blades');
        if (blades) {
             // Rotate based on wind speed
             const speed = (windSpeed || 1) * 0.002; 
             blades.rotation.z -= delta * speed;
        }

        // Fan (Silo)
        const fan = obj.getObjectByName('fan');
        if (fan) fan.rotation.z += delta * 0.01;
        const fan2 = obj.getObjectByName('fan2');
        if (fan2) fan2.rotation.z += delta * 0.01;

        // Weather Vane (Barn)
        const vane = obj.getObjectByName('vane');
        if (vane) {
             // Gently sway based on wind
             vane.rotation.y = Math.sin(time * 0.5) * 0.5 + (time * 0.1); 
        }

        // Smoke (House, Bakery, Grill)
        const smoke = obj.getObjectByName('smoke');
        if (smoke) {
            smoke.position.y += delta * 0.003;
            smoke.rotation.y += delta * 0.002;
            smoke.scale.multiplyScalar(1.002);
            smoke.material.opacity -= delta * 0.0005;
            
            const initialY = smoke.userData.initialY || 12; // Default fallback
            
            if (smoke.material.opacity <= 0) {
                smoke.position.y = initialY;
                smoke.scale.set(1, 1, 1);
                smoke.material.opacity = 0.4;
            }
        }

        // Water (Fountain, Pond)
        const water = obj.getObjectByName('water');
        if (water) {
             water.scale.y = 1 + Math.sin(time * 2) * 0.05;
             water.rotation.y += delta * 0.0005;
        }
        
        // Crop Sway Animation
        if (obj.userData.isCrop && !obj.userData.isTree) {
            // Only apply to the crop, not the plot base
            if (!obj.userData.isPlot) {
                const t = time * 3;
                const wind = (windSpeed || 1);
                const offset = obj.position.x * 0.5 + obj.position.z * 0.5;
                // Cartoon sway and squash
                const sway = Math.sin(t + offset) * 0.09 * wind;
                obj.rotation.x = sway;
                obj.rotation.z = sway * 0.5;
                // Squash and stretch
                const squash = 1 + Math.sin(t * 2 + offset) * 0.07 * wind;
                obj.scale.y = squash;
                obj.scale.x = obj.scale.z = 1 / Math.sqrt(squash);
            }
        }
    });
}
function updateCropGrowth(delta) {
    objects.forEach(obj => {
        if (obj.userData.isCrop) {
            const def = BuildingTypes[obj.userData.type];
            const baseTime = (def && def.growthTime) ? def.growthTime : 10;
            const multiplier = gameState.growthRate || 1.0;
            
            // Rate per ms: 1 / (baseTime * 1000)
            // But we multiply by multiplier (growth rate multiplier usually speeds up, so rate increases)
            // If gameState.growthRate is e.g. 2.0 (double speed), then we multiply the rate by 2.
            
            const growthPerMs = (1 / (baseTime * 1000)) * multiplier;
            
            obj.userData.growth = Math.min(1, obj.userData.growth + delta * growthPerMs);
            
            // Handle Fruit Visibility
            if (obj.userData.fruits) {
                const showFruits = obj.userData.growth >= 0.95;
                obj.userData.fruits.forEach((f, idx) => {
                    if (f.visible !== showFruits) f.visible = showFruits;
                    // Animate fruit pop-in when mature
                    if (showFruits) {
                        const t = Math.max(0, Math.min(1, (obj.userData.growth - 0.95) * 20));
                        const pop = 0.2 + t * 0.8 + Math.sin(Date.now() * 0.01 + idx) * 0.08 * t;
                        f.scale.set(pop, pop, pop);
                    } else {
                        f.scale.set(0.01, 0.01, 0.01);
                    }
                });
            }

            // Improved cartoon crop growth animation
            const parts = obj.userData.growParts || [];
            parts.forEach((p, idx) => {
                // More realistic: start small, grow up, then add bounce
                let t = obj.userData.growth;
                let base = 0.2 + t * 1.1;
                // Sway and bounce only after 30% grown
                let sway = t > 0.3 ? Math.sin(Date.now() * 0.008 + idx) * 0.06 * t : 0;
                let squash = t > 0.3 ? 1 + Math.sin(Date.now() * 0.012 + idx) * 0.05 * t : 1;
                if (p.isGroup) {
                    p.scale.set(base + sway, base * squash, base + sway);
                } else {
                    p.scale.set(base + sway, base * squash, base + sway);
                }
            });
            // Add extra details to fully grown crops
            if (obj.userData.growth >= 1 && !obj.userData.extraDetailsAdded) {
                const def = BuildingTypes[obj.userData.type];
                // Add flowers or extra berries/fruits depending on crop type (no highlight)
                if (def && def.type === 'crop_small') {
                    for (let i = 0; i < 4; i++) {
                        const flower = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xffe066, roughness: 0.4 }));
                        flower.position.set((Math.random()-0.5)*2.2, 1.2 + Math.random()*0.3, (Math.random()-0.5)*2.2);
                        obj.add(flower);
                    }
                }
                // No highlight for crop_tall
                else if (def && def.type === 'crop_bush') {
                    for (let i = 0; i < 3; i++) {
                        const berry = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff1744, roughness: 0.4 }));
                        berry.position.set((Math.random()-0.5)*2.0, 1.0 + Math.random()*0.3, (Math.random()-0.5)*2.0);
                        obj.add(berry);
                    }
                } else if (def && def.type === 'crop_ground') {
                    for (let i = 0; i < 2; i++) {
                        const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.35, 5), new THREE.MeshStandardMaterial({ color: 0x81c784, roughness: 0.5 }));
                        leaf.rotation.x = -Math.PI/2;
                        leaf.position.set((Math.random()-0.5)*2.2, 1.2, (Math.random()-0.5)*2.2);
                        obj.add(leaf);
                    }
                }
                obj.userData.extraDetailsAdded = true;
            }
        }
    });
}
function updateCropTimers() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    objects.forEach(obj => {
        // Show timer for crops and for fruit trees (not decoration trees)
        const def = BuildingTypes[obj.userData.type];
        const isCrop = obj.userData.isCrop;
        const isFruitTree = obj.userData.isTree && def && def.type === 'tree_fruit';
        if (!isCrop && !isFruitTree) return;
        if (def && def.category === 'decoration') return;

        // Initialize Timer UI
        if (!obj.userData.timerEl) {
            const el = document.createElement('div');
            el.className = 'crop-timer';
            el.innerHTML = `
                <div class="timer-content">
                    <span class="timer-icon" style="display:none">${isFruitTree ? '🍎' : '🌾'}</span>
                    <span class="timer-text">Wait...</span>
                    <div class="timer-bar-bg"><div class="timer-bar-fill"></div></div>
                </div>
            `;
            document.body.appendChild(el);
            obj.userData.timerEl = el;
            // Cache refs
            obj.userData.timerRefs = {
                container: el,
                text: el.querySelector('.timer-text'),
                fill: el.querySelector('.timer-bar-fill'),
                icon: el.querySelector('.timer-icon')
            };
        }

        const refs = obj.userData.timerRefs;
        const g = obj.userData.growth || 0;

        // Position
        const pos = obj.position.clone();
        pos.y += isFruitTree ? 6 : 4; // Above tree or crop
        pos.project(camera);

        // Check visibility
        const onScreen = pos.x > -1 && pos.x < 1 && pos.y > -1 && pos.y < 1 && pos.z < 1;
        if (!onScreen) {
            refs.container.style.display = 'none';
            return;
        }

        refs.container.style.display = 'flex';
        const x = (pos.x + 1) / 2 * w;
        const y = (1 - pos.y) / 2 * h;
        refs.container.style.left = `${x}px`;
        refs.container.style.top = `${y}px`;

        // --- Staged Water Requests for Crops Only ---
        if (isCrop && !isFruitTree) {
            if (!obj.userData.waterStages) {
                const baseTime = (def && def.growthTime) ? def.growthTime : 10;
                const multiplier = gameState.growthRate || 1.0;
                const totalSeconds = baseTime / multiplier;
                obj.userData.waterStages = [
                    { stage: 0, req: 3, requested: false, fulfilled: false },
                    { stage: 0.5, req: 2, requested: false, fulfilled: false },
                    { stage: Math.max(0, 1 - 10/totalSeconds), req: 2, requested: false, fulfilled: false }
                ];
            }
            let waterNeeded = null;
            obj.userData.waterStages.forEach(ws => {
                if (!ws.requested && g >= ws.stage) {
                    ws.requested = true;
                    ws.fulfilled = false;
                }
                if (ws.requested && !ws.fulfilled && !waterNeeded) waterNeeded = ws;
            });
            if (waterNeeded) {
                refs.container.classList.remove('ripe');
                // Make the icon visually larger and easier to click
                refs.text.innerHTML = `<span style=\"color:#3498db;font-size:32px;line-height:40px;display:inline-block;width:48px;height:48px;vertical-align:middle;animation:pulse-ripe 1.5s infinite;user-select:none;\">💧</span> <span style=\"font-size:16px;vertical-align:middle;\">Water x${waterNeeded.req}</span>`;
                refs.text.style.color = '#3498db';
                refs.fill.style.width = '0%';
                refs.container.style.pointerEvents = 'auto';
                // Enlarge the clickable area (hitbox)
                refs.container.style.minWidth = '64px';
                refs.container.style.minHeight = '64px';
                refs.container.style.padding = '8px 12px';
                refs.container.style.borderRadius = '18px';
                refs.container.style.background = 'rgba(255,255,255,0.12)';
                refs.container.style.cursor = 'pointer';
                refs.container.style.boxShadow = '0 2px 12px 0 rgba(52,152,219,0.18)';
                // Helper to apply watering to crop data
                function fulfillWatering() {
                    if ((gameState.inventory.water_bucket||0) < waterNeeded.req) {
                        window.showNotification('Not enough water buckets!', 'error');
                        return;
                    }
                    gameState.inventory.water_bucket -= waterNeeded.req;
                    window.refreshInventory && window.refreshInventory();
                    waterNeeded.fulfilled = true;
                    // Update crop data: find the crop in gameState.crops by position/type
                    if (gameState.crops) {
                        const found = gameState.crops.find(c => c.x === obj.userData.x && c.z === obj.userData.z && c.type === obj.userData.type);
                        if (found) {
                            if (!found.watered) found.watered = 0;
                            found.watered += waterNeeded.req;
                            found.lastWatered = Date.now();
                            if (found.watered >= 3) found.ready = true;
                        }
                    }
                    refs.container.onclick = null;
                    window.showNotification(`Crop watered (${waterNeeded.req} buckets)`, 'success');
                    saveGame && saveGame();
                }
                refs.container.onclick = function(e) {
                    e.stopPropagation();
                    fulfillWatering();
                };
                // Also allow clicking the crop mesh
                if (!obj.userData._waterClickBound) {
                    obj.userData._waterClickBound = true;
                    obj.traverse(child => {
                        if (child.isMesh) {
                            child.cursor = 'pointer';
                            child.onClick = function() {
                                fulfillWatering();
                            };
                        }
                    });
                }
            } else if (g >= 1) {
                refs.container.classList.add('ripe');
                refs.text.innerText = 'HARVEST';
                refs.text.style.color = '#fff';
                refs.fill.style.width = '100%';
                refs.container.onclick = null;
                refs.container.style.pointerEvents = 'none';
            } else {
                refs.container.classList.remove('ripe');
                const baseTime = (def && def.growthTime) ? def.growthTime : 10;
                const multiplier = gameState.growthRate || 1.0;
                const totalSeconds = baseTime / multiplier;
                const s = Math.max(0, (1 - g) * totalSeconds);
                const pct = Math.floor(g * 100);
                const timeStr = s > 60 ? `${(s/60).toFixed(1)}m` : `${s.toFixed(1)}s`;
                refs.text.innerText = timeStr;
                refs.text.style.color = '#fff';
                refs.fill.style.width = `${pct}%`;
                refs.container.onclick = null;
                refs.container.style.pointerEvents = 'none';
            }
        } else {
            // Trees and others: original timer logic
            if (obj.userData.tempMessage) {
                refs.container.classList.remove('ripe');
                if (refs.text.innerText !== obj.userData.tempMessage) {
                    refs.text.innerText = obj.userData.tempMessage;
                    refs.text.style.color = '#e74c3c';
                }
                refs.fill.style.width = '0%';
            } else if (g >= 1) {
                if (!refs.container.classList.contains('ripe')) {
                    refs.container.classList.add('ripe');
                    refs.text.innerText = 'HARVEST';
                    refs.text.style.color = '#fff';
                }
            } else {
                refs.container.classList.remove('ripe');
                const baseTime = (def && def.growthTime) ? def.growthTime : 10;
                const multiplier = gameState.growthRate || 1.0;
                const totalSeconds = baseTime / multiplier;
                const s = Math.max(0, (1 - g) * totalSeconds);
                const pct = Math.floor(g * 100);
                const timeStr = s > 60 ? `${(s/60).toFixed(1)}m` : `${s.toFixed(1)}s`;
                if (refs.text.innerText !== timeStr) {
                    refs.text.innerText = timeStr;
                    refs.text.style.color = '#fff';
                }
                refs.fill.style.width = `${pct}%`;
            }
        }
    });
}
function updateVehicles(delta) {
    const t = Date.now() * 0.001;
    vehicles.forEach(v => {
        const ax = 0.3;
        const az = 0.3;
        if (v.baseX === undefined) v.baseX = v.mesh.position.x;
        if (v.baseZ === undefined) v.baseZ = v.mesh.position.z;
        v.mesh.position.x = v.baseX + Math.sin(t + v.seed) * ax;
        v.mesh.position.z = v.baseZ + Math.cos(t + v.seed) * az;
        const spin = 0.004 * delta;
        if (v.mesh.userData && v.mesh.userData.wheels) {
            v.mesh.userData.wheels.forEach(w => { w.rotation.x += spin; });
        }
        const a = v.mesh.userData && v.mesh.userData.attachments;
        if (a) {
            if (a.header) a.header.rotation.x += spin * 0.5;
            if (a.discs) a.discs.forEach(d => { d.rotation.x += spin; });
            if (a.boomL && a.boomR) {
                const sway = Math.sin(t * 2 + v.seed) * 0.05;
                a.boomL.rotation.z = sway;
                a.boomR.rotation.z = -sway;
            }
            if (a.blades) {
                const tilt = Math.sin(t * 1.5 + v.seed) * 0.03;
                a.blades.forEach(b => { b.rotation.x = Math.PI/2.8 + tilt; });
            }
        }
    });
}
function createDetailedAnimal(kind, color) {
    const group = new THREE.Group();
    const limbs = { legs: [], head: null, tail: null };
    
    // Detailed cartoon materials with varied finishes
    const matBody = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.0 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
    const matPink = new THREE.MeshStandardMaterial({ color: 0xffb3ba, roughness: 0.4 });
    const matBeak = new THREE.MeshStandardMaterial({ color: 0xffc107, roughness: 0.3 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2 });
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });

    if (kind === 'cow') {
        // Large body
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.95, 2.0), matBody(0xffffff));
        body.position.y = 1.05;
        group.add(body);
        
        // Black spots on body
        for (let i = 0; i < 6; i++) {
            const spot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), matDark);
            spot.position.set(
                (Math.random() - 0.5) * 1.2,
                1.0 + Math.random() * 0.4,
                (Math.random() - 0.5) * 1.4
            );
            spot.scale.set(1 + Math.random() * 0.3, 0.7, 1.2);
            group.add(spot);
        }
        
        // Head - large and blocky
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.6, 1.4);
        group.add(headGroup);
        limbs.head = headGroup;
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.85), matBody(0xffffff));
        headGroup.add(head);
        
        // Large eyes
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), eyeMat);
        eyeL.position.set(-0.25, 0.2, 0.45);
        headGroup.add(eyeL);
        const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), eyeMat);
        eyeR.position.set(0.25, 0.2, 0.45);
        headGroup.add(eyeR);
        
        // Snout - pink nose
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.25), matPink);
        snout.position.set(0, -0.15, 0.5);
        headGroup.add(snout);
        
        // Ears - small and rounded
        const earL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), matBody(0xffffff));
        earL.scale.set(0.8, 1.3, 0.6);
        earL.position.set(-0.45, 0.35, -0.1);
        headGroup.add(earL);
        const earR = earL.clone();
        earR.position.set(0.45, 0.35, -0.1);
        headGroup.add(earR);
        
        // Horns - short and stubby
        const hornGeo = new THREE.ConeGeometry(0.08, 0.3, 8);
        const hornMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5 });
        const hornL = new THREE.Mesh(hornGeo, hornMat);
        hornL.position.set(-0.25, 0.5, -0.05);
        hornL.rotation.z = 0.4;
        headGroup.add(hornL);
        const hornR = hornL.clone();
        hornR.position.set(0.25, 0.5, -0.05);
        hornR.rotation.z = -0.4;
        headGroup.add(hornR);
        
        // Udder - distinctive cow feature
        const udder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.6), matPink);
        udder.position.set(0, 0.55, -0.2);
        group.add(udder);
        
        // Legs - sturdy and thick
        const legGeo = new THREE.BoxGeometry(0.22, 1.0, 0.22);
        [[-0.5, 0.5, 0.6], [0.5, 0.5, 0.6], [-0.5, 0.5, -0.7], [0.5, 0.5, -0.7]].forEach(pos => {
            const leg = new THREE.Mesh(legGeo, matBody(0xffffff));
            leg.position.set(...pos);
            group.add(leg);
            limbs.legs.push(leg);
            // Hooves
            const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), matDark);
            hoof.position.set(pos[0], 0.05, pos[2]);
            group.add(hoof);
        });
        
        // Tail
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 1.0, -1.05);
        group.add(tailGroup);
        limbs.tail = tailGroup;
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 6), matDark);
        tail.rotation.x = 0.5;
        tailGroup.add(tail);
        
    } else if (kind === 'sheep') {
        // Fluffy woolly body - large cloud-like shape
        const bodyGeo = new THREE.IcosahedronGeometry(1.0, 4);
        const body = new THREE.Mesh(bodyGeo, matBody(0xffffff));
        body.scale.set(1.3, 1.1, 1.5);
        body.position.y = 1.15;
        group.add(body);
        
        // Add wool texture with bumps
        for (let i = 0; i < 8; i++) {
            const woolBump = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), matWhite);
            woolBump.position.set(
                (Math.random() - 0.5) * 1.2,
                0.9 + Math.random() * 0.5,
                (Math.random() - 0.5) * 1.2
            );
            group.add(woolBump);
        }
        
        // Head - black/dark
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.75, 1.1);
        group.add(headGroup);
        limbs.head = headGroup;
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.7), matDark);
        headGroup.add(head);
        
        // Eyes - white with black pupil
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), matWhite);
        eyeL.position.set(-0.18, 0.15, 0.4);
        headGroup.add(eyeL);
        const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
        pupilL.position.set(-0.18, 0.15, 0.5);
        headGroup.add(pupilL);
        
        const eyeR = eyeL.clone();
        eyeR.position.set(0.18, 0.15, 0.4);
        headGroup.add(eyeR);
        const pupilR = pupilL.clone();
        pupilR.position.set(0.18, 0.15, 0.5);
        headGroup.add(pupilR);
        
        // Ears - small and pointed
        const earL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), matDark);
        earL.position.set(-0.35, 0.35, 0.1);
        earL.rotation.z = -0.3;
        headGroup.add(earL);
        const earR = earL.clone();
        earR.position.set(0.35, 0.35, 0.1);
        earR.rotation.z = 0.3;
        headGroup.add(earR);
        
        // Legs - thin and dark
        const legGeo = new THREE.BoxGeometry(0.18, 1.0, 0.18);
        [[-0.4, 0.5, 0.5], [0.4, 0.5, 0.5], [-0.4, 0.5, -0.6], [0.4, 0.5, -0.6]].forEach(pos => {
            const leg = new THREE.Mesh(legGeo, matDark);
            leg.position.set(...pos);
            group.add(leg);
            limbs.legs.push(leg);
        });
        
    } else if (kind === 'pig') {
        // Chubby round body - pink
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 12), matBody(0xf48fb1));
        body.scale.set(1.1, 0.85, 1.3);
        body.position.y = 0.95;
        group.add(body);
        
        // Head - boxy pink
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.2, 1.05);
        group.add(headGroup);
        limbs.head = headGroup;
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.7), matBody(0xf48fb1));
        headGroup.add(head);
        
        // Snout - prominent pink nose
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), matPink);
        snout.position.set(0, -0.1, 0.45);
        headGroup.add(snout);
        
        // Snout holes/nostrils
        const nostril1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), matDark);
        nostril1.position.set(-0.12, -0.15, 0.65);
        headGroup.add(nostril1);
        const nostril2 = nostril1.clone();
        nostril2.position.set(0.12, -0.15, 0.65);
        headGroup.add(nostril2);
        
        // Eyes
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
        eyeL.position.set(-0.22, 0.12, 0.4);
        headGroup.add(eyeL);
        const eyeR = eyeL.clone();
        eyeR.position.set(0.22, 0.12, 0.4);
        headGroup.add(eyeR);
        
        // Ears - floppy triangular
        const earL = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.35, 6), matBody(0xf48fb1));
        earL.position.set(-0.4, 0.3, -0.05);
        earL.rotation.z = -0.4;
        headGroup.add(earL);
        const earR = earL.clone();
        earR.position.set(0.4, 0.3, -0.05);
        earR.rotation.z = 0.4;
        headGroup.add(earR);
        
        // Legs - short and stubby
        const legGeo = new THREE.BoxGeometry(0.25, 0.65, 0.25);
        [[-0.35, 0.35, 0.5], [0.35, 0.35, 0.5], [-0.35, 0.35, -0.5], [0.35, 0.35, -0.5]].forEach(pos => {
            const leg = new THREE.Mesh(legGeo, matBody(0xf48fb1));
            leg.position.set(...pos);
            group.add(leg);
            limbs.legs.push(leg);
        });
        
        // Curly tail
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 1.1, -0.95);
        group.add(tailGroup);
        limbs.tail = tailGroup;
        const tail = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 8, 12, Math.PI * 1.7), matDark);
        tail.rotation.x = 1.2;
        tailGroup.add(tail);
        
    } else if (kind === 'chicken') {
        // Fluffy round body - yellowish
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), matBody(0xfff5e1));
        body.scale.set(1.15, 0.95, 1.25);
        body.position.y = 0.58;
        group.add(body);
        
        // Head - rounder
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.02, 0.45);
        group.add(headGroup);
        limbs.head = headGroup;
        
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), matBody(0xfff5e1));
        headGroup.add(head);
        
        // Eyes - beady and black
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
        eyeL.position.set(-0.15, 0.08, 0.2);
        headGroup.add(eyeL);
        const eyeR = eyeL.clone();
        eyeR.position.set(0.15, 0.08, 0.2);
        headGroup.add(eyeR);
        
        // Beak - orange and pointy
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), matBeak);
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, -0.05, 0.32);
        headGroup.add(beak);
        
        // Comb - red on top of head
        const comb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.1), new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.5 }));
        comb.position.set(0, 0.35, 0);
        headGroup.add(comb);
        
        // Legs - thin and orange
        const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6);
        const l1 = new THREE.Mesh(legGeo, matBeak);
        l1.position.set(-0.14, 0.2, 0);
        group.add(l1);
        const l2 = l1.clone();
        l2.position.set(0.14, 0.2, 0);
        group.add(l2);
        limbs.legs.push(l1, l2);
        
        // Tail feathers - pointy
        const tailGeo = new THREE.BoxGeometry(0.15, 0.35, 0.1);
        const tail1 = new THREE.Mesh(tailGeo, matBody(0xfff5e1));
        tail1.position.set(-0.15, 0.65, -0.35);
        tail1.rotation.x = 0.3;
        group.add(tail1);
        
    } else if (kind === 'horse') {
        // Larger body
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 2.6), matBody(0x8d6e63));
        body.position.y = 1.35;
        group.add(body);
        
        // Neck - muscular
        const neck = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.7), matBody(0x8d6e63));
        neck.position.set(0, 2.0, 1.0);
        neck.rotation.x = -0.2;
        group.add(neck);
        
        // Head - horse-shaped
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 2.8, 1.5);
        group.add(headGroup);
        limbs.head = headGroup;
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 1.0), matBody(0x8d6e63));
        headGroup.add(head);
        
        // Eyes - side-facing
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
        eyeL.position.set(-0.35, 0.1, 0.25);
        headGroup.add(eyeL);
        const eyeR = eyeL.clone();
        eyeR.position.set(0.35, 0.1, 0.25);
        headGroup.add(eyeR);
        
        // Mane - dark flowing
        const mane = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.65), matDark);
        mane.position.set(0, 2.8, 1.0);
        mane.rotation.x = -0.2;
        group.add(mane);
        
        // Ears - pointed
        const earL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), matBody(0x8d6e63));
        earL.position.set(-0.22, 0.5, 0.1);
        headGroup.add(earL);
        const earR = earL.clone();
        earR.position.set(0.22, 0.5, 0.1);
        headGroup.add(earR);
        
        // Legs - long and elegant
        const legGeo = new THREE.BoxGeometry(0.3, 1.8, 0.3);
        [[-0.5, 0.9, 1.0], [0.5, 0.9, 1.0], [-0.5, 0.9, -1.0], [0.5, 0.9, -1.0]].forEach(pos => {
            const leg = new THREE.Mesh(legGeo, matBody(0x8d6e63));
            leg.position.set(...pos);
            group.add(leg);
            limbs.legs.push(leg);
            // Hooves
            const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), matDark);
            hoof.position.set(pos[0], -0.1, pos[2]);
            group.add(hoof);
        });
        
        // Tail - long and flowing
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 1.8, -1.35);
        group.add(tailGroup);
        limbs.tail = tailGroup;
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 0.25), matDark);
        tail.position.set(0, -0.5, 0);
        tail.rotation.x = 0.3;
        tailGroup.add(tail);
        
    } else {
        // Generic animal
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.1), matBody(color || 0xffffff));
        body.position.y = 0.75;
        group.add(body);
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.5), matDark);
        head.position.set(0, 1.15, 0.6);
        group.add(head);
        limbs.head = head;
        
        const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.65, 6);
        [[-0.3, 0.35, 0.4], [0.3, 0.35, 0.4], [-0.3, 0.35, -0.4], [0.3, 0.35, -0.4]].forEach(pos => {
            const leg = new THREE.Mesh(legGeo, matBody(color || 0xffffff));
            leg.position.set(...pos);
            group.add(leg);
            limbs.legs.push(leg);
        });
    }

    group.userData.limbs = limbs;
    group.userData.kind = kind;
    group.traverse(o => { if(o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return group;
}

function spawnAnimal(kind, x, z) {
    let color = 0xffffff;
    if (kind === 'cow') color = 0xffffff;

    if (kind === 'chicken') color = 0xfff5e1;
    if (kind === 'pig') color = 0xf48fb1;
    if (kind === 'sheep') color = 0xffffff;
    if (kind === 'goat') color = 0xa1887f;
    if (kind === 'duck') color = 0xffffcc;
    if (kind === 'horse') color = 0x8d6e63; // Brown

    const group = createDetailedAnimal(kind, color);
    group.position.set(x, 0, z);
    
    // Add spot for cow manually if needed, or simple color variance
    if (kind === 'cow') {
         // Add some black spots
         const spot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 1.0), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }));
         spot.position.set(0.2, 2.0, 0);
         group.add(spot);
    }

    scene.add(group);
    group.userData.isAnimal = true;
    group.userData.kind = kind;
    animals.push({ mesh: group, kind, target: null, seed: Math.random()*10, state: 'idle', timer: 0 });
}

function updateAnimals(delta) {
    const limit = (gameState.gridSize * TILE_SIZE) / 2 - 1.5;
    const time = Date.now() * 0.005;

    animals.forEach(a => {
        // Init extended state if needed
        if (!a.actionState) a.actionState = 'standing'; // standing, eating

        // Cartoon tail wag
        if (a.mesh.userData.limbs && a.mesh.userData.limbs.tail) {
            const tail = a.mesh.userData.limbs.tail;
            const speed = a.state === 'walk' ? 16 : 5;
            const amp = a.state === 'walk' ? 0.35 : 0.12;
            tail.rotation.y = Math.sin(time * speed) * amp;
            tail.scale.y = 1 + Math.sin(time * speed * 0.7) * 0.13;
        }

        // Base Head Rotation
        let baseHeadRot = 0;
        if (a.kind === 'horse') baseHeadRot = 0.3;

        // State Machine: Idle <-> Walk
        if (a.state === 'idle') {
            a.timer -= delta;
            
            // Idle Animations
            if (a.actionState === 'eating') {
                if (a.mesh.userData.limbs && a.mesh.userData.limbs.head) {
                    // Cartoon head bob (grazing)
                    const grazeOffset = a.kind === 'horse' ? 0.8 : 0.5;
                    a.mesh.userData.limbs.head.rotation.x = baseHeadRot + grazeOffset + Math.sin(time * 7) * 0.18;
                    a.mesh.userData.limbs.head.scale.y = 1 + Math.sin(time * 8) * 0.08;
                }
            } else {
                if (a.mesh.userData.limbs && a.mesh.userData.limbs.head) {
                    // Gentle cartoon idle
                    a.mesh.userData.limbs.head.rotation.x = baseHeadRot + Math.sin(time * 1.5) * 0.09;
                    a.mesh.userData.limbs.head.scale.y = 1 + Math.sin(time * 2.2) * 0.05;
                }
            }
            
            // Reset Limbs
            if (a.mesh.userData.limbs && a.mesh.userData.limbs.legs) {
                a.mesh.userData.limbs.legs.forEach((l, idx) => {
                    // Gentle cartoon shuffle
                    l.rotation.x = Math.sin(time * 1.2 + idx) * 0.08;
                });
            }
            
            if (a.timer <= 0) {
                        a.state = 'walk';
                        a.actionState = 'standing';

                        // Prefer to roam around the animal's building (barn/coop/pig_pen/etc.)
                        const kindToBuilding = {
                            cow: 'barn',
                            chicken: 'coop',
                            pig: 'pig_pen',
                            sheep: 'sheep_pasture',
                            goat: 'goat_yard',
                            duck: 'duck_pond',
                            horse: 'stable'
                        };

                        function findNearestBuildingForKind(kind) {
                            const btype = kindToBuilding[kind];
                            if (!btype || !gameState.buildings) return null;
                            let best = null; let bestD = Infinity;
                            gameState.buildings.forEach(bb => {
                                if (bb.type !== btype) return;
                                const dx = bb.x - a.mesh.position.x;
                                const dz = bb.z - a.mesh.position.z;
                                const d = Math.sqrt(dx*dx + dz*dz);
                                if (d < bestD) { bestD = d; best = bb; }
                            });
                            return best;
                        }

                        let building = a.buildingData || findNearestBuildingForKind(a.kind);
                        if (building) {
                            a.buildingData = building;
                            // pick a random point around the building center (within 1-3 tiles)
                            const minR = TILE_SIZE * 0.6;
                            const maxR = TILE_SIZE * 2.5;
                            const ang = Math.random() * Math.PI * 2;
                            const dist = minR + Math.random() * (maxR - minR);
                            a.target = { x: building.x + Math.cos(ang) * dist, z: building.z + Math.sin(ang) * dist };
                        } else {
                            // Fallback: roam the map
                            a.target = {
                                x: (Math.random() * limit * 2) - limit,
                                z: (Math.random() * limit * 2) - limit
                            };
                        }
            }
        } else if (a.state === 'walk') {
            // Reset Head while walking
            if (a.mesh.userData.limbs && a.mesh.userData.limbs.head) {
                a.mesh.userData.limbs.head.rotation.x = baseHeadRot;
            }

            const dx = a.target.x - a.mesh.position.x;
            const dz = a.target.z - a.mesh.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            const speed = 0.015 * delta; // Faster movement

            if (dist < 1) {
                a.state = 'idle';
                a.timer = 2000 + Math.random() * 3000; // Pause for 2-5 seconds
                
                // Pick an idle action
                const r = Math.random();
                // Animals that graze
                if (r < 0.6 && ['cow', 'sheep', 'horse', 'goat', 'pig'].includes(a.kind)) {
                    a.actionState = 'eating';
                } else {
                    a.actionState = 'standing';
                }

            } else {
                // Apply terrain collision boundary
                const margin = 1.5; // Buffer from edge
                const maxBound = limit - margin;
                const minBound = -limit + margin;
                
                let newX = a.mesh.position.x + (dx / dist) * speed;
                let newZ = a.mesh.position.z + (dz / dist) * speed;
                
                // Clamp to terrain bounds
                newX = Math.max(minBound, Math.min(maxBound, newX));
                newZ = Math.max(minBound, Math.min(maxBound, newZ));
                
                // If hit boundary, pick new target
                if ((newX !== a.mesh.position.x + (dx / dist) * speed) || (newZ !== a.mesh.position.z + (dz / dist) * speed)) {
                    a.state = 'idle';
                    a.timer = 1000 + Math.random() * 2000;
                }
                
                a.mesh.position.x = newX;
                a.mesh.position.z = newZ;
                a.mesh.lookAt(a.target.x, a.mesh.position.y, a.target.z);
                
                // Animation
                if (a.mesh.userData.limbs && a.mesh.userData.limbs.legs) {
                    const legs = a.mesh.userData.limbs.legs;
                    legs.forEach((l, i) => {
                        // Alternate legs
                        const offset = i % 2 === 0 ? 0 : Math.PI;
                        l.rotation.x = Math.sin(time * 8 + offset) * 0.6; // Increased leg swing
                    });
                }
                
                // Hop for chickens/ducks
                if (a.kind === 'chicken' || a.kind === 'duck') {
                     a.mesh.position.y = Math.abs(Math.sin(time * 10)) * 0.2;
                }
            }
        }
    });
}

// ------------------------------------------------------------------
// SAVING
// ------------------------------------------------------------------
function saveGame() {
    if (isVisiting) return;
    if (!currentUser) return; // Don't save preview state
    try {
        gameState.zoomLevel = zoomLevel;
        localStorage.setItem('farmSimSave_' + currentUser, JSON.stringify(gameState));
    } catch (e) {
        console.error("Save failed", e);
    }
}

function gameTick() {
    if (isVisiting) return; // Don't earn money while visiting

    checkMilkProduction();
    checkEggProduction();
    checkTruffleProduction();
    // Let NPC farmers patrol and collect any pending items if houses exist
    updateNPCFarmers && updateNPCFarmers();
    // Update NPC visuals after logic
    updateNPCVisuals && updateNPCVisuals();

    gameState.day++;
    
    // Power Calculation
    let produced = 0;
    let consumed = 0;
    
    gameState.buildings.forEach(b => {
        const def = BuildingTypes[b.type];
        if (def) {
            let p = def.power || 0;
            
            // Check levels for generators
            if (b.type === 'generator') {
                const lvl = gameState.generatorLevel || 1;
                const info = GeneratorLevels[lvl];
                if (info) p = info.power;
            } else if (b.type === 'solar') {
                const lvl = b.level || 1;
                const info = SolarLevels[lvl];
                if (info) p = info.power;
            }
            
            if (p > 0) produced += p;
            else if (p < 0) consumed += Math.abs(p);
        }
    });
    
    // Update State
    if (!gameState.electricity) gameState.electricity = { produced: 0, consumed: 0 };
    gameState.electricity.produced = produced;
    gameState.electricity.consumed = consumed;
    
    // Power Balance Check
    const isPowered = produced >= consumed;

    let totalIncome = 0;
    gameState.buildings.forEach(b => {
        const def = BuildingTypes[b.type];
        if (def) {
            // If building needs power and we are short, no income
            if (def.power < 0 && !isPowered) {
                // No income
            } else {
                totalIncome += def.income;
            }
        }
    });

    if (totalIncome > 0) {
        addMoney(totalIncome);
        addXP(Math.floor(totalIncome / 10));
        SoundEffects.playClick(); // Small coin sound
        checkMissions('money', null);
    }
    
    // Notification for blackout (once per state change?)
    if (!isPowered && consumed > 0 && gameState.wasPowered !== false) {
        showNotification("⚡ BLACKOUT! Not enough electricity!", "error");
        gameState.wasPowered = false;
    } else if (isPowered && gameState.wasPowered === false) {
        showNotification("⚡ Power Restored!", "success");
        gameState.wasPowered = true;
    }
    
    // Change weather every 8 days (64 seconds) instead of every 4 days
    if (gameState.day % 8 === 0) {
        const seasonIdx = Math.floor(((gameState.day-1)%120)/30);
        const season = ['Spring','Summer','Autumn','Winter'][seasonIdx];
        const r = Math.random();
        let w = 'Sunny';
        if (season === 'Spring') {
            w = r < 0.6 ? 'Sunny' : r < 0.85 ? 'Rain' : 'Cloudy';
        } else if (season === 'Summer') {
            w = r < 0.7 ? 'Sunny' : r < 0.85 ? 'Cloudy' : 'Rain';
        } else if (season === 'Autumn') {
            w = r < 0.5 ? 'Cloudy' : r < 0.8 ? 'Sunny' : 'Rain';
        } else {
            w = r < 0.5 ? 'Snow' : r < 0.8 ? 'Cloudy' : 'Sunny';
        }
        gameState.weather = w;
        applyWeatherVisuals();
    }
    
    updateUI();
    saveGame(); // Auto-save on tick
}

// ------------------------------------------------------------------
// INTERACTION
// ------------------------------------------------------------------
function onWindowResize() {
    updateCamera();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateCamera() {
    if (!camera) return;
    const aspect = window.innerWidth / window.innerHeight;
    const d = zoomLevel;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
}

function onMouseWheel(event) {
    event.preventDefault();
    
    // Zoom sensitivity
    // Use sign to ensure consistent steps across different devices (mouse vs trackpad)
    const direction = Math.sign(event.deltaY);
    const step = 20;
    
    zoomLevel += direction * step;
    
    // Clamp zoom limits
    // Smaller zoomLevel = closer (Zoom In), Larger = further (Zoom Out)
    zoomLevel = Math.max(50, Math.min(zoomLevel, 300));
    
    updateCamera();
}

window.zoomIn = function() {
    zoomLevel -= 20;
    zoomLevel = Math.max(50, Math.min(zoomLevel, 300));
    updateCamera();
};

window.zoomOut = function() {
    zoomLevel += 20;
    zoomLevel = Math.max(50, Math.min(zoomLevel, 300));
    updateCamera();
};

function tryHarvest(cropObj) {
    if (!cropObj || !cropObj.userData.isCrop) return false;

    // Decoration Trees (Oak/Pine) should NOT be harvestable (they are permanent)
    const def = BuildingTypes[cropObj.userData.type];
    if (def && def.category === 'decoration') return false;

    // Only allow harvest if crop is ready
    if (cropObj.userData.growth >= 1) {
        // Calculate Yield
        let amount = 1;
        if (def && def.category === 'crop') {
             // Crops yield 2-4 items to ensure profit
             amount = Math.floor(Math.random() * 3) + 2;
        }

        // Determine Product
        const product = (def && def.product) ? def.product : cropObj.userData.type;

        if (!addInventoryItem(product, amount)) {
            showNotification("Inventory Full!", "error");
            return;
        }

        // Visuals
        showFloatingText(cropObj.position, `+${amount} ${BuildingTypes[product].name || product}`, '#33ff33');
        SoundEffects.playHarvest();
        checkMissions('harvest', cropObj.userData.type); // Check against CROP type (e.g. wheat), not product

        // Handle Trees (Regrow instead of destroy)
        if (cropObj.userData.isTree) {
            cropObj.userData.growth = 0;
            // Update visuals immediately
            const parts = cropObj.userData.growParts || [];
            parts.forEach(p => {
                p.scale.set(0.5, 0.5, 0.5); // Reset fruit size
            });
            // Hide fruits
            if (cropObj.userData.fruits) {
                cropObj.userData.fruits.forEach(f => f.visible = false);
            }
        } else {
            // Normal Crop (Destroy)
            removeObjectFromScene(cropObj);
            gameState.buildings = gameState.buildings.filter(b => !(b.x === cropObj.position.x && b.z === cropObj.position.z && b.type === cropObj.userData.type));
        }

        updateUI();
        saveGame();
        return true;
    } else {
        // Not ripe, show indicator
        showFloatingText(cropObj.position, 'Not Ready!', '#ff3333');
        SoundEffects.playClick();
        return false;
    }
// Simple floating text indicator for crop feedback
function showFloatingText(position, text, color = '#fff') {
    // If using 3D, create a DOM element at screen position
    const div = document.createElement('div');
    div.textContent = text;
    div.style.position = 'absolute';
    div.style.left = ((position.x / camera.position.z) * window.innerWidth / 2 + window.innerWidth / 2) + 'px';
    div.style.top = ((-position.y / camera.position.z) * window.innerHeight / 2 + window.innerHeight / 2) + 'px';
    div.style.color = color;
    div.style.fontWeight = 'bold';
    div.style.fontSize = '18px';
    div.style.pointerEvents = 'none';
    div.style.zIndex = 9999;
    div.style.textShadow = '0 0 4px #000';
    document.body.appendChild(div);
    setTimeout(() => { div.remove(); }, 900);
}
}

function generateNpcOffers() {
    const goods = [
        { id: 'wheat', name: 'Wheat', countRange: [3,8], basePrice: 20 },
        { id: 'egg', name: 'Egg', countRange: [1,4], basePrice: 15 },
        { id: 'strawberry', name: 'Strawberry', countRange: [2,6], basePrice: 25 },
        { id: 'milk', name: 'Milk', countRange: [1,3], basePrice: 30 }
    ];

    const g = goods[Math.floor(Math.random() * goods.length)];
    const count = Math.floor(g.countRange[0] + Math.random() * (g.countRange[1] - g.countRange[0] + 1));

    const coinPrice = Math.max(5, Math.floor(g.basePrice * count * (0.8 + Math.random() * 0.6)));
    const diamondPrice = Math.max(1, Math.floor( Math.max(1, coinPrice / 150) ));

    return {
        item: { id: g.id, name: g.name, count },
        offers: [
            { payWith: 'coins', price: coinPrice },
            { payWith: 'diamonds', price: diamondPrice }
        ]
    };
}

function showNPCTrade(npc) {
    // Remove existing modal
    const existing = document.getElementById('npc-trade-modal');
    if (existing) existing.remove();

    const data = generateNpcOffers();
    const modal = document.createElement('div');
    modal.id = 'npc-trade-modal';
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="width:320px; text-align:center;">
            <h3 style="margin:8px 0;">Villager Trade</h3>
            <p>"I can offer you ${data.item.count} ${data.item.name}(s)."</p>
            <div style="display:flex; justify-content:space-around; gap:8px; margin:10px 0;">
                <button id="npc-offer-coins" class="btn">Pay $${data.offers[0].price}</button>
                <button id="npc-offer-diamonds" class="btn">Pay ${data.offers[1].price}💎</button>
            </div>
            <div style="margin-top:8px;">
                <button id="npc-offer-cancel" class="btn">Close</button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    document.getElementById('npc-offer-coins').addEventListener('click', () => {
        // Coins purchase
        const offer = data.offers[0];
        if ((gameState.money || 0) < offer.price) {
            showNotification(`Not enough coins ($${offer.price})`, 'error');
            return;
        }
        gameState.money -= offer.price;
        addInventoryItem(data.item.id, data.item.count);
        updateUI(); saveGame();
        showNotification(`Bought ${data.item.count} ${data.item.name}(s) for $${offer.price}`, 'success');
        modal.remove();
    });

    document.getElementById('npc-offer-diamonds').addEventListener('click', () => {
        const offer = data.offers[1];
        if (!spendDiamonds(offer.price)) {
            showNotification(`Not enough diamonds (${offer.price})`, 'error');
            return;
        }
        addInventoryItem(data.item.id, data.item.count);
        updateUI(); saveGame();
        showNotification(`Bought ${data.item.count} ${data.item.name}(s) for ${offer.price}💎`, 'success');
        modal.remove();
    });

    document.getElementById('npc-offer-cancel').addEventListener('click', () => modal.remove());
}


function handleInteraction(event) {
    if (event.target.closest('.ui-panel') || 
        event.target.closest('.modal') || 
        event.target.closest('#start-screen') ||
        event.target.tagName === 'INPUT') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check NPC hits first (allow interaction with villagers)
    if (typeof npcs !== 'undefined' && npcs.length > 0) {
        const npcMeshes = npcs.map(n => n.mesh);
        const npcHits = raycaster.intersectObjects(npcMeshes, true);
        if (npcHits.length > 0) {
            let o = npcHits[0].object;
            while (o.parent && o.parent.type !== 'Scene') o = o.parent;
            const found = npcs.find(n => n.mesh === o);
            if (found) {
                showNPCTrade(found);
                return;
            }
        }
    }

    let objHits = raycaster.intersectObjects(objects, true);
    
    // Filter out the moving object so we can click "through" it to place it on the ground
    if (moveMode && movingObject) {
        objHits = objHits.filter(h => {
             let o = h.object;
             while (o.parent && o.parent.type !== 'Scene') o = o.parent;
             return o !== movingObject;
        });
    }
    
    // SMART HARVEST: Check if we clicked ANY part of a crop, or a plot with a crop
    if (!selectedBuildingType && !sellMode && !moveMode && objHits.length > 0) {
        for (let i = 0; i < objHits.length; i++) {
            let o = objHits[i].object;
            while (o.parent && o.parent.type !== 'Scene') o = o.parent;
            
            // If we hit a crop directly
            if (o.userData && o.userData.isCrop) {
                // Always show indicator if not ready
                if (o.userData.growth < 1) {
                    showFloatingText(o.position, 'Not Ready!', '#ff3333');
                    SoundEffects.playClick();
                    return;
                }
                tryHarvest(o);
                return;
            }
            
            // If we hit a plot, check if there's a crop on it
            if (o.userData && o.userData.isPlot) {
                 const cropObj = objects.find(c => 
                    c.userData.isCrop && 
                    Math.abs(c.position.x - o.position.x) < 0.1 && 
                    Math.abs(c.position.z - o.position.z) < 0.1
                );
                if (cropObj) {
                    if (cropObj.userData.growth < 1) {
                        showFloatingText(cropObj.position, 'Not Ready!', '#ff3333');
                        SoundEffects.playClick();
                        return;
                    }
                    tryHarvest(cropObj);
                    return;
                }
            }
        }
    }

    if (objHits.length > 0) {
        let o = objHits[0].object;
        while (o.parent && o.parent.type !== 'Scene') o = o.parent;

        // Per-building Silo/Warehouse upgrade menu (on click only)
        if (o.userData && (o.userData.type === 'silo' || o.userData.type === 'warehouse')) {
            const buildingObj = gameState.buildings.find(b => b.x === o.position.x && b.z === o.position.z && b.type === o.userData.type && (b.id === o.userData.id || typeof o.userData.id === 'undefined' || typeof b.id === 'undefined'));
            if (o.userData.type === 'silo' && window.showSiloUpgradeMenu && buildingObj) {
                window.showSiloUpgradeMenu(buildingObj);
                return;
            }
            if (o.userData.type === 'warehouse' && window.showWarehouseUpgradeMenu && buildingObj) {
                window.showWarehouseUpgradeMenu(buildingObj);
                return;
            }
        }

        // If in move mode, pass the object directly for moving
        if (moveMode) {
            handleObjectClick(o);
            return;
        }
        
        handleObjectClick(o);
        return;
    }
    const intersects = raycaster.intersectObject(groundPlane);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        
        // Handle Move Mode Placement
        if (moveMode && movingObject) {
            // Use exact cursor position (no snapping)
            let gx = point.x;
            let gz = point.z;
            
            // Clamp to bounds with 1.5 unit margin
            const limit = (gameState.gridSize * TILE_SIZE) / 2 - 1.5;
            gx = Math.max(-limit, Math.min(limit, gx));
            gz = Math.max(-limit, Math.min(limit, gz));
            
            // Calculate occupied tiles at new position
            const type = movingObject.userData.type;
            const rot = Math.round(-movingObject.rotation.y / (Math.PI/2)) & 3; 
            const newTiles = getOccupiedTiles(type, gx, gz, rot);

            // Check collision (ignore self)
            // Find the building entry in gameState to ignore
            const oldX = movingObject.userData.baseX !== undefined ? movingObject.userData.baseX : movingObject.position.x; // userData.baseX tracks original pos? 
            // Actually, gameState.buildings should have it.
            // But we might have moved it visually already? 
            // Wait, movingObject is the mesh. It's position changes every frame in drag logic?
            // No, in drag logic we update movingObject.position.
            // So to find it in gameState, we need to know where it WAS before we started dragging.
            // Or we just search for the building that matches the ID if we had one.
            // We added ID to buildings recently: gameState.buildings.push({ ..., id: Date.now() });
            // But old saves might not have ID.
            
            // Let's assume we can match by type and position, but position is changing?
            // Ah, when we start move mode, we should store the original position or reference.
            // But here we are in handleInteraction. 
            // Let's assume the user clicked to PLACE it.
            
            // Wait, movingObject.position is updated in 'pointermove'.
            // Here in 'handleInteraction' (click), we want to finalize it.
            // The position in gameState is still the OLD position.
            
            // We need to find the building in gameState that corresponds to movingObject.
            // We can search for one that matches type and IS NOT at the new position? 
            // No, that's risky.
            
            // Let's rely on finding the building that is currently at the location where we picked it up?
            // We don't have that info easily here unless we stored it.
            // But wait, `movingObject` is the mesh.
            // When we clicked "Move", we set `movingObject = obj`.
            // We can search gameState for a building at `obj.position.x, obj.position.z` AT THAT TIME.
            // But `obj.position` changes as we drag.
            
            // Better approach: When starting move, store the gameState building reference on the object.
            // But I can't change "Start Move" logic right now easily (it's in UI handlers I think).
            
            // Workaround: The building in gameState has not moved yet.
            // So we can check collision against ALL buildings.
            // If we collide with *ourselves* (the old position), that's fine?
            // No, we want to move AWAY from old position.
            // If we overlap with old position, that's valid (we are just shifting).
            // So we need to ignore the building at the old position.
            
            // But which one is it?
            // We can iterate all buildings, and if `checkCollision` fails, we check if the collision is ONLY with the building we are moving.
            
            // Let's find the building that we are moving.
            // It should be the one closest to the `movingObject` before we started dragging?
            // No.
            
            // Let's look at `window.startMoveMode` if it exists.
            // Or `selectBuilding`.
            
            // Assume we can't easily find it.
            // Let's just find the building in gameState that matches type and rotation?
            // And maybe is close?
            
            // Actually, let's look at `pointermove` logic again.
            // `movingObject.position.set(cx, 0, cz);`
            
            // The `handleInteraction` logic for move mode:
            // It finds `gx, gz` from raycast.
            // It checks bounds.
            // It checks collision.
            
            // Current code:
            // const exists = gameState.buildings.some(b => 
            //    b.x === gx && b.z === gz && 
            //    !(b.x === movingObject.position.x && b.z === movingObject.position.z)
            // );
            
            // The `!(b.x === movingObject.position.x ...)` part tries to ignore self.
            // BUT `movingObject.position` is already updated to `gx, gz` in the drag handler!
            // So `b.x === gx` matches the NEW position.
            // `movingObject.position.x` matches the NEW position.
            // So `exists` checks if there is a building at `gx, gz` that is NOT at `gx, gz`?
            // That condition `!(b.x === ...)` is `!(true) = false`.
            // So it effectively ignores any building at `gx, gz`.
            // This logic relies on the fact that the OLD building is still in `gameState` at the OLD position.
            // If `gx, gz` is different from OLD position, then `exists` will find the OLD building if we overlap it?
            // No.
            
            // If we move to a new empty spot:
            // `gameState` has building at OldX.
            // `gx` is NewX.
            // `exists` checks if any building is at NewX.
            // The building at OldX is NOT at NewX.
            // So `exists` is false. OK.
            
            // If we move to overlap the OldX (e.g. shift 1 tile):
            // `gx` is NewX.
            // `gameState` has building at OldX.
            // `exists` checks if any building is at NewX.
            // Is building at OldX at NewX? No (unless OldX == NewX).
            // So `exists` is false.
            // So we can place it overlapping itself?
            // If we have a 2x2 building. OldX=0. NewX=10.
            // Tiles at OldX: 0, 10.
            // Tiles at NewX: 10, 20.
            // Overlap at 10.
            // We need to ignore the building at OldX.
            
            // So we need to identify the building at OldX.
            // We don't know OldX.
            
            // FIX: We need to store OldX/OldZ on `movingObject` when we start moving.
            // I'll search for `window.startMove` or where `moveMode` is set.
            // If I can't find it, I will infer it.
            // Wait, I can't infer it easily.
            
            // Let's assume for now that we can accept a small limitation: 
            // If I can't find the source, I might block valid moves that overlap self.
            // BUT, `movingObject` is the actual mesh from `objects`.
            // `objects` matches `gameState.buildings`.
            // We can find the index of `movingObject` in `objects`.
            // The corresponding index in `gameState.buildings` is the one we want!
            // (Assuming they are synced 1:1 and order is preserved).
            // `rebuildSceneFromState` clears `objects` and pushes in order of `gameState.buildings`.
            // `tryBuild` pushes to both.
            // `removeObjectFromScene` removes from both.
            // So indices SHOULD match.
            
            const index = objects.indexOf(movingObject);
            const selfBuilding = (index !== -1) ? gameState.buildings[index] : null;

            // Temporarily update building position to check collision at new location
            let prevX, prevZ, prevRot;
            if (selfBuilding) {
                prevX = selfBuilding.x;
                prevZ = selfBuilding.z;
                prevRot = selfBuilding.rotation || 0;
                selfBuilding.x = gx;
                selfBuilding.z = gz;
                selfBuilding.rotation = rot;
            }

            if (checkCollision(newTiles, selfBuilding ? [selfBuilding] : [])) {
                // Collision detected - restore old position and return
                if (selfBuilding) {
                    selfBuilding.x = prevX;
                    selfBuilding.z = prevZ;
                    selfBuilding.rotation = prevRot;
                }
                showNotification("This space is already occupied!", "warning");
                return;
            }
            
            // Collision check passed - building position already updated
            
            // Update Visuals
            // Place at the grid-snapped position (cursor click location)
            movingObject.position.set(gx, 0, gz);
            
            if (movingObject.userData.type === 'house') {
                // Keep NPCs near house if needed, or let them wander
            }
            
            // Reset Highlight
            setCropHighlight(movingObject, false);
            
            // Reset Visuals
            movingObject.position.y = 0;
            movingObject.traverse(c => {
                if (c.isMesh && c.material) {
                    c.material.transparent = false;
                    c.material.opacity = 1.0;
                    if (c.material.emissive) c.material.emissive.setHex(0x000000);
                }
            });

            movingObject = null;
            updateBuildMenu();
            
            const rBtn = document.getElementById('rotate-btn');
            if (rBtn) rBtn.style.display = 'none';

            SoundEffects.playBuild();
            saveGame();
            return;
        }

        handleGridClick(point);
    }
}

function setCropHighlight(group, on) {
    if (!group || !group.userData || !group.userData.growParts) return;
    if (group.userData.highlighted === on) return;
    group.userData.highlighted = on;
    
    group.userData.growParts.forEach(p => {
        if (p.isGroup) {
            p.traverse(child => {
                if (child.isMesh && child.material) {
                     if (child.material.emissive) {
                         child.material.emissive.setHex(on ? 0xffff66 : 0x000000);
                     }
                }
            });
        } else {
            const m = p.material;
            if (m && m.emissive !== undefined) {
                m.emissive.setHex(on ? 0xffff66 : 0x000000);
            }
        }
    });
}

function handleObjectClick(obj) {
    const type = obj.userData && obj.userData.type;
    const cat = obj.userData && obj.userData.category;
    if (!type) {
        if (!moveMode && !sellMode && obj.userData && obj.userData.isAnimal) {
            const idx = animals.findIndex(a => a.mesh === obj);
            if (idx !== -1 && typeof window.showAnimalMenu === 'function') {
                window.showAnimalMenu(idx);
                return;
            }
        }
        return;
    }

    // Vehicle Interaction (Honk/Jump)
    if (cat === 'vehicle' && !moveMode && !sellMode) {
        SoundEffects.playBuild(); // Honk sound
        
        // Jump Animation
        const initialY = 0; // Vehicles are usually at y=0 or close
        let jumpTime = 0;
        
        // Simple manual animation loop since we don't have a tween library
        const jumpAnim = () => {
             jumpTime += 0.2;
             obj.position.y = initialY + Math.sin(jumpTime) * 1.5;
             if (jumpTime < Math.PI) {
                 requestAnimationFrame(jumpAnim);
             } else {
                 obj.position.y = initialY;
             }
        };
        jumpAnim();

        showNotification(`${BuildingTypes[type].name} is ready to work!`, 'info');
        
        // Speed Boost
        const v = vehicles.find(v => v.mesh === obj);
        if (v) {
            v.speedBoost = 3.0;
            v.state = 'driving'; // Force drive
            v.timer = 0; // Reset idle timer
            setTimeout(() => { v.speedBoost = 1.0; }, 5000);
        }
        return;
    }

    if (type === 'main_house' && !moveMode && !sellMode) {
        showHouseUpgradeMenu();
        return;
    }

    if (type === 'market' && !moveMode && !sellMode) {
        window.showMarketModal();
        return;
    }

    if (type === 'barn' && !moveMode && !sellMode) {
        const buildingObj = gameState.buildings.find(b => b.x === obj.position.x && b.z === obj.position.z && b.type === 'barn');
        showBarnUpgradeMenu(buildingObj);
        return;
    }

    if (type === 'coop' && !moveMode && !sellMode) {
        const buildingObj = gameState.buildings.find(b => b.x === obj.position.x && b.z === obj.position.z && b.type === 'coop');
        showCoopUpgradeMenu(buildingObj);
        return;
    }

    if (type === 'pig_pen' && !moveMode && !sellMode) {
        const buildingObj = gameState.buildings.find(b => b.x === obj.position.x && b.z === obj.position.z && b.type === 'pig_pen');
        showPigPenUpgradeMenu(buildingObj);
        return;
    }

    if (type === 'silo' && !moveMode && !sellMode) {
        if(window.showSiloUpgradeMenu) {
            const buildingObj = gameState.buildings.find(b => b.x === obj.position.x && b.z === obj.position.z && b.type === 'silo');
            window.showSiloUpgradeMenu(buildingObj);
        }
        return;
    }
    
    if (type === 'warehouse' && !moveMode && !sellMode) {
        if(window.showWarehouseUpgradeMenu) {
            const buildingObj = gameState.buildings.find(b => b.x === obj.position.x && b.z === obj.position.z && b.type === 'warehouse');
            window.showWarehouseUpgradeMenu(buildingObj);
        }
        return;
    }

    if ((type === 'generator' || type === 'solar') && !moveMode && !sellMode) {
        if (type === 'solar') {
            // Find the building object for this solar panel
            const buildingObj = gameState.buildings.find(b => b.x === obj.position.x && b.z === obj.position.z && b.type === 'solar' && (b.id === obj.userData.id || typeof obj.userData.id === 'undefined' || typeof b.id === 'undefined'));
            showPowerUpgradeMenu(type, buildingObj);
        } else {
            showPowerUpgradeMenu(type);
        }
        return;
    }

    if (moveMode) {
        console.log("Move mode - clicked object type:", obj.userData?.type);
        if (movingObject === obj) {
            // Cancel move
            console.log("Cancelling move for object");
            setCropHighlight(obj, false);
            
            // Reset Visuals
            obj.position.y = 0;
            obj.traverse(c => {
                if (c.isMesh && c.material) {
                    c.material.transparent = false;
                    c.material.opacity = 1.0;
                    if (c.material.emissive) c.material.emissive.setHex(0x000000);
                }
            });
            
            movingObject = null;
            updateBuildMenu();
            
            const rBtn = document.getElementById('rotate-btn');
            if (rBtn) rBtn.style.display = 'none';
        } else {
            // Select new object
            if (movingObject) {
                setCropHighlight(movingObject, false);
                // Reset prev object if switching
                movingObject.position.y = 0;
                movingObject.traverse(c => {
                    if (c.isMesh && c.material) {
                        c.material.transparent = false;
                        c.material.opacity = 1.0;
                        if (c.material.emissive) c.material.emissive.setHex(0x000000);
                    }
                });
            }
            
            movingObject = obj;
            console.log("Selected object for moving:", obj.userData?.type, "at position", obj.position.x, obj.position.z);
            movingObject.userData.originalPos = { x: obj.position.x, z: obj.position.z };
            updateBuildMenu();
            setCropHighlight(obj, true);
            
            // Set Visuals for Moving
            obj.position.y = 5;
            obj.traverse(c => {
                if (c.isMesh && c.material) {
                    c.material.transparent = true;
                    c.material.opacity = 0.6;
                }
            });

            // Sync rotation with selected object
            const b = gameState.buildings.find(b => b.x === obj.position.x && b.z === obj.position.z && b.type === obj.userData.type);
            if (b) {
                selectedRotation = b.rotation || 0;
                const btn = document.getElementById('rotate-btn');
                if(btn) {
                    btn.style.transform = `rotate(${selectedRotation * 90}deg)`;
                    btn.style.display = 'block';
                }
            }
        }
        return;
    }

    if (sellMode) {
        const def = BuildingTypes[type];
        const refund = Math.floor(def.cost * 0.5);
        addMoney(refund);
        removeObjectFromScene(obj);
        gameState.buildings = gameState.buildings.filter(b => !(b.x === obj.position.x && b.z === obj.position.z && b.type === type));
        if (cat === 'vehicle') {
            vehicles = vehicles.filter(v => v.mesh !== obj);
        }
        updateUI();
        saveGame();
        return;
    }

    // Allow building/planting on top of existing objects (e.g. seeds on plots)
    if (selectedBuildingType) {
        if (isVisiting) {
            showNotification("You are visiting! You cannot build here.", "warning");
            return;
        }
        tryBuild(selectedBuildingType, obj.position.x, obj.position.z);
        return;
    }

    // Default: Check if we clicked a crop (fallback if onPointerDown missed it somehow)
    if (obj.userData.isCrop) {
        tryHarvest(obj);
        return;
    }
}

function removeObjectFromScene(obj) {
    scene.remove(obj);
    objects = objects.filter(o => o !== obj);
    if (obj.userData && obj.userData.timerEl && obj.userData.timerEl.parentNode) {
        obj.userData.timerEl.parentNode.removeChild(obj.userData.timerEl);
        obj.userData.timerEl = null;
    }
}

function handleGridClick(point) {
    if (isVisiting) {
        showNotification("You are visiting! You cannot build here.", "warning");
        return;
    }

    // Snap to grid
    const x = Math.floor(point.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const z = Math.floor(point.z / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;

    // Check bounds with margin (1.5 units from edge prevents buildings from going outside)
    const limit = (gameState.gridSize * TILE_SIZE) / 2 - 1.5;
    if (Math.abs(x) > limit || Math.abs(z) > limit) {
        showNotification("Cannot place too close to boundary!", "warning");
        return;
    }

    // Support Harvest on Grid Click (missed object or clicked gap)
    if (!selectedBuildingType && !sellMode) {
        const crop = objects.find(o => 
            o.userData.isCrop && 
            Math.abs(o.position.x - x) < 0.1 && 
            Math.abs(o.position.z - z) < 0.1
        );
        if (crop) {
            tryHarvest(crop);
            return;
        }
    }

    if (selectedBuildingType) {
        tryBuild(selectedBuildingType, x, z);
    }
}

// ------------------------------------------------------------------
// BUILDING LOGIC
// ------------------------------------------------------------------
window.rotateBuilding = function() {
    selectedRotation = (selectedRotation + 1) % 4;
    const btn = document.getElementById('rotate-btn');
    if(btn) {
        btn.style.transform = `rotate(${selectedRotation * 90}deg)`;
    }

    if (previewMesh) {
        previewMesh.rotation.y = -(selectedRotation) * (Math.PI / 2);
    }

    if (tileMarker) {
        // Rotate the marker to match building orientation
        tileMarker.rotation.z = -(selectedRotation) * (Math.PI / 2);
    }

    // Apply rotation immediately if moving an object
    if (moveMode && movingObject) {
        movingObject.rotation.y = -(selectedRotation) * (Math.PI / 2);
        
        // Update Game State
        const b = gameState.buildings.find(b => b.x === movingObject.position.x && b.z === movingObject.position.z);
        if (b) {
            b.rotation = selectedRotation;
            saveGame();
        }
    }
};

window.selectBuilding = function(type) {
    // Reset rotation on new selection
    selectedRotation = 0;
    const btn = document.getElementById('rotate-btn');
    if(btn) btn.style.transform = 'rotate(0deg)';

    // Cleanup old preview
    if (previewMesh) {
        scene.remove(previewMesh);
        previewMesh = null;
    }
    if (tileMarker) {
        scene.remove(tileMarker);
        tileMarker = null;
    }

    // Toggle selection
    if (selectedBuildingType === type) {
        selectedBuildingType = null;
        gridHelper.visible = false; // Hide grid when deselected
        if (renderer && renderer.domElement) {
            renderer.domElement.style.cursor = 'default';
        }
    } else {
        selectedBuildingType = type;
        gridHelper.visible = true; // Show grid when placing
        
        // Disable Sell Mode if building is selected
        if (sellMode) {
            sellMode = false;
            const sb = Array.from(document.querySelectorAll('.action-btn')).filter(b => b.innerText.includes('Sell Mode'));
            if (sb[0]) sb[0].style.background = '#9b59b6';
        }

        // Create new preview
        if (selectedBuildingType) {
            const defPrev = BuildingTypes[selectedBuildingType];
            if (defPrev && defPrev.category === 'animal') {
                const color = defPrev.color || 0xffffff;
                previewMesh = createDetailedAnimal(defPrev.kind, color);
            } else {
                previewMesh = createDetailedBuilding(selectedBuildingType);
            }
            
            // Make transparent
            previewMesh.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.transparent = true;
                    child.material.opacity = 0.5;
                    child.material.emissive = new THREE.Color(0x00ff00); // Default valid
                    child.material.emissiveIntensity = 0.5;
                }
            });
            
            // Initial position (off-screen)
            previewMesh.position.set(0, -100, 0); 
            scene.add(previewMesh);

            // Create Tile Marker (Grid Footprint)
            const def = BuildingTypes[selectedBuildingType];
            const w = (def.width || 1) * TILE_SIZE;
            const d = (def.depth || 1) * TILE_SIZE;
            
            // Swap width/depth if rotated (initial rotation is 0, so no swap needed yet)
            // But we will handle rotation in rotateBuilding
            
            if (!(def && def.category === 'animal')) {
                const geo = new THREE.PlaneGeometry(w, d);
                const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
                tileMarker = new THREE.Mesh(geo, mat);
                tileMarker.rotation.x = -Math.PI / 2;
                tileMarker.position.set(0, 0.2, 0);
                scene.add(tileMarker);
            }
            
            if (renderer && renderer.domElement) {
                renderer.domElement.style.cursor = 'cell'; // Cell cursor for placement
            }
        }
    }
    updateBuildMenu(); // To highlight selection
};

function tryBuild(type, x, z) {
    const def = BuildingTypes[type];
    
    if (def && def.category === 'animal') {
        const lvl = gameState.level || 1;
        if (lvl < def.level) {
            showNotification("Level too low", "error");
            return;
        }
        if (!payWithDiamonds) {
            if (gameState.money < def.cost) {
                showNotification("Not enough money!", "error");
                return;
            }
        } else {
            const diamondPrice = Math.max(1, Math.ceil(def.cost / 10));
            if (!spendDiamonds(diamondPrice)) {
                showNotification(`Not enough diamonds (${diamondPrice} needed)`, "error");
                return;
            }
        }
        if (!payWithDiamonds) gameState.money -= def.cost;
        addXP(def.cost / 2);
        const kind = def.kind;
        const near = gameState.buildings.find(b => b.type === 'breeding_center' && Math.hypot((b.x - x), (b.z - z)) <= TILE_SIZE * 4);
        if (!near) {
            showNotification("Place animals near a Breeding Center", "warning");
        }
        spawnAnimal(kind, x, z);
        const last = animals[animals.length - 1];
        if (last && near) {
            last.buildingData = near;
            if (!near.animals) near.animals = [];
            near.animals.push(kind);
        }
        SoundEffects.playBuild();
        updateUI();
        saveGame();
        return;
    }
    const lvl = gameState.level || 1;
    const getCap = (t, l) => {
        if (t === 'silo' || t === 'windmill') {
            if (l < 5) return 3;
            if (l < 10) return 6;
            if (l < 15) return 9;
            if (l < 20) return 12;
            return 15;
        }
        if (t === 'generator') {
            if (l < 5) return 2;
            if (l < 10) return 4;
            if (l < 15) return 6;
            if (l < 20) return 8;
            return 10;
        }
        if (t === 'solar') {
            if (l < 5) return 4;
            if (l < 10) return 8;
            if (l < 15) return 12;
            if (l < 20) return 16;
            return 20;
        }
        if (t === 'barn' || t === 'coop' || t === 'pig_pen' || t === 'warehouse') {
            if (l < 5) return 2;
            if (l < 10) return 4;
            if (l < 15) return 6;
            if (l < 20) return 8;
            return 10;
        }
        return Infinity;
    };
    const cap = getCap(type, lvl);
    if (cap !== Infinity) {
        const count = gameState.buildings.filter(b => b.type === type).length;
        if (count >= cap) {
            showNotification(`Limit reached: ${def.name} max ${cap}`, "error");
            return;
        }
    }

    // Check cost
    if (!payWithDiamonds) {
        if (gameState.money < def.cost) {
            showNotification("Not enough money!", "error");
            return;
        }
    } else {
        const diamondPrice = Math.max(1, Math.ceil(def.cost / 10));
        if (!spendDiamonds(diamondPrice)) {
            showNotification(`Not enough diamonds (${diamondPrice} needed)`, "error");
            return;
        }
    }

    // Limit Main House to 2
    if (type === 'main_house') {
        const houseCount = gameState.buildings.filter(b => b.type === 'main_house').length;
        if (houseCount >= 2) {
            showNotification("Limit reached: Max 2 Main Houses!", "error");
            return;
        }
    }

    // Check collision and plot rules
    const tiles = getOccupiedTiles(type, x, z, selectedRotation || 0);
    
    // Ensure we have valid tiles
    if (!tiles || tiles.length === 0) {
        showNotification("Invalid placement!", "warning");
        return;
    }

    if (def.category === 'plot') {
        // Plot: must be empty of OTHER plots. Can overlap nothing? 
        // Actually, in this game, everything goes on ground.
        // But if we put a plot, it shouldn't overlap existing buildings or plots.
        if (checkCollision(tiles)) {
            showNotification("Space occupied!", "warning");
            return;
        }
    } else if (def.category === 'tree') {
        // Tree: Can be on PLOT or GROUND, but not overlapping other buildings/crops.
        for(const t of tiles) {
            const onTile = gameState.buildings.filter(b => {
                 const bTiles = getOccupiedTiles(b.type, b.x, b.z, b.rotation || 0);
                 return bTiles.some(bt => Math.abs(bt.x - t.x) < 1 && Math.abs(bt.z - t.z) < 1);
            });
            
            const hasNonPlot = onTile.some(b => BuildingTypes[b.type].category !== 'plot');
            
            if (hasNonPlot) {
                showNotification("Space occupied!", "warning");
                return;
            }
        }
    } else if (def.category === 'crop') {
        // Crop: Must be on a PLOT, and NO OTHER CROP.
        for(const t of tiles) {
            const onTile = gameState.buildings.filter(b => {
                 const bTiles = getOccupiedTiles(b.type, b.x, b.z, b.rotation || 0);
                 return bTiles.some(bt => Math.abs(bt.x - t.x) < 1 && Math.abs(bt.z - t.z) < 1);
            });
            
            const hasPlot = onTile.some(b => BuildingTypes[b.type].category === 'plot');
            const hasCrop = onTile.some(b => BuildingTypes[b.type].category === 'crop' || BuildingTypes[b.type].category === 'tree' || BuildingTypes[b.type].type === 'deco_tree');
            
            if (!hasPlot) {
                showNotification("Seeds must be planted on a plot!", "warning");
                return;
            }
            if (hasCrop) {
                showNotification("Plot already planted!", "warning");
                return;
            }
        }
    } else {
        // Normal Building
        if (checkCollision(tiles)) {
            showNotification("Space occupied!", "warning");
            return;
        }
    }

    // Deduct cost
    if (!payWithDiamonds) {
        gameState.money -= def.cost;
    }
    addXP(def.cost / 2); // XP for building
    
    // Create Visuals
    const mesh = createDetailedBuilding(type);
    
    // Calculate Visual Center
    if (tiles.length > 0) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        tiles.forEach(t => {
            minX = Math.min(minX, t.x);
            maxX = Math.max(maxX, t.x);
            minZ = Math.min(minZ, t.z);
            maxZ = Math.max(maxZ, t.z);
        });
        mesh.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    } else {
        mesh.position.set(x, 0, z);
    }

    mesh.rotation.y = -(selectedRotation || 0) * (Math.PI / 2); // Apply Rotation
    // Crops should appear at full size immediately (no tiny pop-in). Other buildings keep pop-in animation.
    if (def && def.category === 'crop') {
        mesh.scale.set(1, 1, 1);
        mesh.userData.scaleProgress = 1;
    } else {
        mesh.scale.set(0.1, 0.1, 0.1);
        mesh.userData.scaleProgress = 0;
    }
    
    // Remove soil visual if we are planting on a plot (handled by crop visual now usually, but keep for safety)
    if (def.category === 'crop') {
         // Logic to remove soil from plot is tricky with multi-tile. 
         // But usually plots are single tile. 
         // If we plant a multi-tile crop, it might span multiple plots.
         // We won't remove soil from all plots, just let it be.
    }
    
    scene.add(mesh);
    objects.push(mesh);

    // Audio
    SoundEffects.playBuild();
    
    // Mission Check
    checkMissions('build', type);
    checkMissions('money', null); // Check if money dropped below something (unlikely but safe)

    // Update State
    const newBuilding = { x, z, type, rotation: selectedRotation, id: Date.now(), level: 1 };
    // Initialize production timer for pig pens
    if (type === 'pig_pen') {
        newBuilding.lastTruffleProductionTime = Date.now();
    }
    gameState.buildings.push(newBuilding);

    // Handle Connections (Fences/Walls)
    if (def.type === 'deco_fence' || type.includes('path') || type.includes('road')) {
        updateConnections(x, z);
    }

    // Side Effects
    if (type === 'house') {
        spawnNPC(x, z);
    }
    if (def.category === 'vehicle') {
        vehicles.push({ mesh, seed: Math.random()*10, baseX: x, baseZ: z });
    }
    if (def.type === 'building_animal') {
        const animalMap = {
            barn: { kinds: ['cow'], count: 6 },
            coop: { kinds: ['chicken'], count: 8 },
            pig_pen: { kinds: ['pig'], count: 6 },
            sheep_pasture: { kinds: ['sheep'], count: 6 },
            goat_yard: { kinds: ['goat'], count: 4 },
            duck_pond: { kinds: ['duck'], count: 4 },
            stable: { kinds: ['horse'], count: 3 }
        };
        const info = animalMap[type] || { kinds: ['cow','chicken'], count: 4 };
        const kinds = info.kinds;
        const spawnCount = info.count || 4;
        // Spawn animals near the building center, more densely
        const cx = mesh.position.x;
        const cz = mesh.position.z;
        for (let i = 0; i < spawnCount; i++) {
            const k = kinds[i % kinds.length];
            // random offset within 0.6 to 2.5 tiles
            const ang = Math.random() * Math.PI * 2;
            const dist = TILE_SIZE * (0.6 + Math.random() * 1.9);
            const sx = cx + Math.cos(ang) * dist;
            const sz = cz + Math.sin(ang) * dist;
            spawnAnimal(k, sx, sz);
            const last = animals[animals.length - 1];
            if (last) {
                const buildingEntry = gameState.buildings.find(b => Math.abs(b.x - cx) < 0.1 && Math.abs(b.z - cz) < 0.1 && b.type === type);
                last.buildingData = buildingEntry || { type, x: cx, z: cz };
            }
        }
    }

    updateUI();
    saveGame();
}

// --- NEW MODERN GRAPHICS IMPLEMENTATION ---
const getStandardMaterials = () => ({
    concrete: new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.9, metalness: 0.1 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 1.0, metalness: 0.1 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 0.8, metalness: 0.0 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9, metalness: 0.0 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x81d4fa, roughness: 0.0, metalness: 0.9, transparent: true, opacity: 0.5 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.4, metalness: 0.6 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.5, metalness: 0.7 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 1.0 }),
    paintWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.0 }),
    paintRed: new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.6, metalness: 0.1 }),
    emissive: new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0xffeb3b, emissiveIntensity: 0.6 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1.0, metalness: 0.0 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 1.0, metalness: 0.0 }),
    // Farmville 2 style: bright, cartoonish, reflective water
    water: new THREE.MeshPhysicalMaterial({
        color: 0x4fc3f7,
        roughness: 0.08,
        metalness: 0.4,
        transmission: 0.7,
        thickness: 0.7,
        ior: 1.33,
        transparent: true,
        opacity: 0.92,
        reflectivity: 0.85,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        sheen: 0.5,
        sheenColor: new THREE.Color(0xb3e5fc)
    }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1.0, metalness: 0.0 }),
    fruit: new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5, metalness: 0.0 }),
    smoke: new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.4, roughness: 1.0 })
});

function createDetailedBuilding(type, building) {
    const group = new THREE.Group();
    const def = BuildingTypes[type];
    if (!def) return group;

    group.userData.type = type;
    group.userData.category = def.category;

    // --- HIGH QUALITY MODERN MATERIALS ---
    const mats = {
        concrete: new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.9, metalness: 0.1 }),
        concreteDark: new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 1.0, metalness: 0.1 }),
        wood: new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 0.8, metalness: 0.0 }),
        woodDark: new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9, metalness: 0.0 }),
        glass: new THREE.MeshStandardMaterial({ color: 0x81d4fa, roughness: 0.0, metalness: 0.9, transparent: true, opacity: 0.5 }),
        metal: new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.4, metalness: 0.6 }),
        metalDark: new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.5, metalness: 0.7 }),
        chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 1.0 }),
        paintWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.0 }),
        paintRed: new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.6, metalness: 0.1 }),
        emissive: new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0xffeb3b, emissiveIntensity: 0.6 }),
        dirt: new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1.0, metalness: 0.0 }),
        grass: new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 1.0, metalness: 0.0 }),
        water: new THREE.MeshStandardMaterial({ color: 0x29b6f6, roughness: 0.0, metalness: 0.1, transparent: true, opacity: 0.8 }),
        leaves: new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1.0, metalness: 0.0 }),
        fruit: new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5, metalness: 0.0 }),
        smoke: new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.4, roughness: 1.0 })
    };

    // Helper to create cartoon/toon crop materials (falls back to standard when unavailable)
    const createCartoonMat = (color, opts = {}) => {
        try {
            if (THREE && THREE.MeshToonMaterial) {
                return new THREE.MeshToonMaterial(Object.assign({ color: color }, opts));
            }
        } catch(e) {}
        return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.45 }, opts));
    };

    const getColorMat = (color) => new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, metalness: 0.1 });

    const enableShadows = (g) => {
        g.traverse(o => {
            if(o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });
    };

    if (def.category === 'plot') {
        if (!window.sharedSoilTexture) window.sharedSoilTexture = createProceduralTexture('soil');
        // Farmville 2 style: clean, vibrant, sunlit plots
        const soilMat = new THREE.MeshStandardMaterial({ 
            map: window.sharedSoilTexture, 
            color: 0xe2a86b, // bright, sunlit reddish-brown
            roughness: 0.85 
        });
        // Main soil base (flat)
        const soil = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE * 0.85, 0.18, TILE_SIZE * 0.85), soilMat);
        soil.position.y = 0.32;
        group.add(soil);
        // Add soft furrow lines (visual only, not raised)
        for (let i = -2; i <= 2; i++) {
            const furrow = new THREE.Mesh(
                new THREE.BoxGeometry(TILE_SIZE * 0.75, 0.008, 0.045),
                new THREE.MeshStandardMaterial({ color: 0xc97a4b, roughness: 1.0 })
            );
            furrow.position.set(0, 0.41, i * 0.22);
            group.add(furrow);
        }
        // Subtle yellow highlight for sunlit look
        const highlightMat = new THREE.MeshStandardMaterial({ color: 0xffe7a3, transparent: true, opacity: 0.18 });
        const highlight = new THREE.Mesh(new THREE.CircleGeometry(TILE_SIZE * 0.38, 18), highlightMat);
        highlight.position.y = 0.43;
        highlight.rotation.x = -Math.PI/2;
        group.add(highlight);
        // Minimal border/frame
        const borderMat = new THREE.MeshStandardMaterial({ color: 0xb97a56, roughness: 1.0 });
        const border = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE * 0.97, 0.05, TILE_SIZE * 0.97), borderMat);
        border.position.y = 0.44;
        group.add(border);
        // Soft shadow under plot
        const shadowMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.10 });
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(TILE_SIZE * 0.5, 20), shadowMat);
        shadow.position.y = 0.22;
        shadow.rotation.x = -Math.PI/2;
        group.add(shadow);
        group.userData.isPlot = true;
    }
    else if (def.category === 'crop') {
        group.userData.isCrop = true;
        group.userData.growth = 0;
        group.userData.growParts = [];
        if (!window.sharedSoilTexture) window.sharedSoilTexture = createProceduralTexture('soil');
        // Cartoon soil base (unchanged)
        const soil = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE * 0.9, 0.5, TILE_SIZE * 0.9),
            new THREE.MeshStandardMaterial({ map: window.sharedSoilTexture, roughness: 1.0 })
        );
        soil.position.y = 0.25;
        group.add(soil);
        group.userData.soil = soil;
        // Increase crop scale so models are clearly visible in the world
        group.scale.set(6.0, 6.0, 6.0);

        const cropSpread = 1.1; // tighter spread for per-plot detail

        // CARROT: long tapered root + leafy top (visible)
        if (type === 'carrot') {
            for (let i = 0; i < 6; i++) {
                const x = (Math.random() - 0.5) * cropSpread;
                const z = (Math.random() - 0.5) * cropSpread;
                const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.6 });
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 1.0, 8), bodyMat);
                body.rotation.x = Math.PI / 2;
                body.position.set(x, 1.0, z);
                group.add(body);
                group.userData.growParts.push(body);
                // leafy top - 3 thin planes
                const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
                for (let l = 0; l < 3; l++) {
                    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.6), leafMat);
                    leaf.position.set(x + (l - 1) * 0.06, 1.4, z);
                    leaf.rotation.x = -Math.PI / 2.8;
                    leaf.rotation.z = (l - 1) * 0.35;
                    group.add(leaf);
                    group.userData.growParts.push(leaf);
                }
            }
        }
        // WHEAT: thin stalks with stacked seed clusters
        else if (type === 'wheat') {
            for (let i = 0; i < 10; i++) {
                const x = (Math.random() - 0.5) * cropSpread;
                const z = (Math.random() - 0.5) * cropSpread;
                const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0xd7b36a }));
                stalk.position.set(x, 1.1, z);
                group.add(stalk);
                group.userData.growParts.push(stalk);
                // seed clusters: small flattened spheres along top
                for (let s = 0; s < 4; s++) {
                    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffe066 }));
                    seed.position.set(x, 1.35 + s * 0.08, z - s * 0.02);
                    seed.scale.y = 0.6;
                    group.add(seed);
                    group.userData.growParts.push(seed);
                }
            }
        }
        // TOMATO: leafy bush with multiple red fruits attached
        else if (type === 'tomato') {
            for (let i = 0; i < 4; i++) {
                const x = (Math.random() - 0.5) * cropSpread;
                const z = (Math.random() - 0.5) * cropSpread;
                const bush = new THREE.Group();
                bush.position.set(x, 0.9, z);
                for (let b = 0; b < 3; b++) {
                    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
                    leaf.position.set((b - 1) * 0.15, 0.1, (Math.random() - 0.5) * 0.12);
                    bush.add(leaf);
                }
                // fruits
                for (let f = 0; f < 3 + Math.floor(Math.random()*2); f++) {
                    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff4d4d }));
                    fruit.position.set((Math.random()-0.5)*0.35, 0.25 + Math.random()*0.2, (Math.random()-0.5)*0.35);
                    bush.add(fruit);
                }
                group.add(bush);
                bush.traverse(n => { if (n.isMesh) group.userData.growParts.push(n); });
            }
        }
        // CORN: tall stalks with long leaves and visible cob
        else if (type === 'corn') {
            for (let i = 0; i < 5; i++) {
                const x = (Math.random() - 0.5) * cropSpread;
                const z = (Math.random() - 0.5) * cropSpread;
                const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.9, 8), new THREE.MeshStandardMaterial({ color: 0x68b34a }));
                stalk.position.set(x, 1.05, z);
                group.add(stalk);
                group.userData.growParts.push(stalk);
                // leaves
                for (let l = 0; l < 3; l++) {
                    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.12), new THREE.MeshStandardMaterial({ color: 0x7ed957 }));
                    leaf.position.set(x + (l - 1) * 0.06, 1.05 - l * 0.18, z + 0.12);
                    leaf.rotation.z = (l - 1) * 0.5;
                    group.add(leaf);
                    group.userData.growParts.push(leaf);
                }
                // cob
                const cob = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xffd24d }));
                cob.rotation.x = Math.PI/2;
                cob.position.set(x, 1.05, z + 0.25);
                group.add(cob);
                group.userData.growParts.push(cob);
            }
        }
        // POTATO: clusters of small rounded tubers partially in soil
        else if (type === 'potato') {
            for (let i = 0; i < 5; i++) {
                const x = (Math.random() - 0.5) * cropSpread;
                const z = (Math.random() - 0.5) * cropSpread;
                const tub = new THREE.Mesh(new THREE.SphereGeometry(0.14 + Math.random()*0.06, 8, 8), new THREE.MeshStandardMaterial({ color: 0x8b5a3c }));
                tub.position.set(x, 0.6 + Math.random()*0.12, z);
                group.add(tub);
                group.userData.growParts.push(tub);
            }
        }
        // STRAWBERRY: small red cones with seeds and green top
        else if (type === 'strawberry') {
            for (let i = 0; i < 6; i++) {
                const x = (Math.random() - 0.5) * cropSpread;
                const z = (Math.random() - 0.5) * cropSpread;
                const berry = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0xff2b6b }));
                berry.rotation.x = Math.PI;
                berry.position.set(x, 0.7, z);
                group.add(berry);
                group.userData.growParts.push(berry);
                // seeds (tiny dots)
                for (let s = 0; s < 5; s++) {
                    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffe066 }));
                    seed.position.set(x + (Math.random()-0.5)*0.06, 0.72 + Math.random()*0.03, z + (Math.random()-0.5)*0.06);
                    group.add(seed);
                    group.userData.growParts.push(seed);
                }
            }
        }
        // PUMPKIN: keep larger pumpkin but add vine leaves
        else if (type === 'pumpkin') {
            const pm = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd35400 })); pm.scale.set(1.05, 0.8, 1.05); pm.position.set(0, 0.95, 0); group.add(pm); group.userData.growParts.push(pm);
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.28, 8), new THREE.MeshStandardMaterial({ color: 0x2e7d32 })); stem.position.set(0, 1.35, 0); group.add(stem); group.userData.growParts.push(stem);
            for (let l = 0; l < 3; l++) {
                const vine = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ color: 0x3aa33a })); vine.position.set(Math.cos(l/3*Math.PI*2)*0.6, 0.9, Math.sin(l/3*Math.PI*2)*0.6); vine.rotation.x = -Math.PI/2.4; group.add(vine); group.userData.growParts.push(vine);
            }
        }
        // LETTUCE: layered flattened leaves
        else if (type === 'lettuce') {
            for (let l = 0; l < 6; l++) {
                const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22 + l*0.02, 10, 8), new THREE.MeshStandardMaterial({ color: 0x7dd26b }));
                leaf.scale.y = 0.45; leaf.position.set((Math.random()-0.5)*0.2, 0.6 + l*0.02, (Math.random()-0.5)*0.2); group.add(leaf); group.userData.growParts.push(leaf);
            }
        }
        // ONION: white bulb + slender leaves
        else if (type === 'onion') {
            for (let i = 0; i < 4; i++) {
                const x = (Math.random() - 0.5) * cropSpread; const z = (Math.random() - 0.5) * cropSpread;
                const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0xfefefe })); bulb.position.set(x, 0.6, z); group.add(bulb); group.userData.growParts.push(bulb);
                const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x2e7d32 })); leaf.position.set(x, 1.0, z); group.add(leaf); group.userData.growParts.push(leaf);
            }
        }
        // EGGPLANT / PEPPER / DEFAULT: simplified distinct fruits
        else if (type === 'eggplant' || type === 'pepper' || type === 'pepper_red' || type === 'pepper_yellow') {
            const col = type === 'eggplant' ? 0x8e44ad : (type === 'pepper' || type === 'pepper_yellow' ? 0xf1c40f : 0xff4d4d);
            for (let i = 0; i < 4; i++) {
                const x = (Math.random() - 0.5) * cropSpread; const z = (Math.random() - 0.5) * cropSpread;
                const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), new THREE.MeshStandardMaterial({ color: col })); fruit.position.set(x, 0.8 + Math.random()*0.15, z); group.add(fruit); group.userData.growParts.push(fruit);
                const cap = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x2e7d32 })); cap.position.set(x, 0.93, z); group.add(cap); group.userData.growParts.push(cap);
            }
        }
        // RICE: thin short panicles
        else if (type === 'rice') {
            for (let i = 0; i < 8; i++) {
                const x = (Math.random() - 0.5) * cropSpread; const z = (Math.random() - 0.5) * cropSpread;
                const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0xdfe6e3 })); stalk.position.set(x, 0.85, z); group.add(stalk); group.userData.growParts.push(stalk);
                for (let s = 0; s < 3; s++) { const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffe066 })); head.position.set(x, 0.95 + s*0.06, z - s*0.02); head.scale.y = 0.6; group.add(head); group.userData.growParts.push(head); }
            }
        }
        else {
            // Generic stylized bush fallback
            const bushColors = [def.color || 0x6ecb3c, 0x7ed957, 0xa8e063];
            for (let i = 0; i < 6; i++) {
                const col = bushColors[Math.floor(Math.random() * bushColors.length)];
                const bush = new THREE.Mesh(new THREE.SphereGeometry(0.26 + Math.random() * 0.12, 10, 10), new THREE.MeshStandardMaterial({ color: col }));
                bush.position.set((Math.random() - 0.5) * 0.9, 0.6 + Math.random()*0.12, (Math.random() - 0.5) * 0.9);
                group.add(bush); group.userData.growParts.push(bush);
            }
        }
    }
    // Convert all crop grow parts to cartoon/toon materials for a consistent stylized look
    if (def.category === 'crop') {
        if (group.userData && group.userData.growParts && group.userData.growParts.length) {
            group.userData.growParts.forEach(part => {
                if (part && part.isMesh) {
                    const col = (part.material && part.material.color) ? part.material.color.getHex() : def.color;
                    try { if (part.material && part.material.dispose) part.material.dispose(); } catch(e) {}
                    part.material = createCartoonMat(col);
                    part.castShadow = true;
                    part.receiveShadow = true;
                }
            });
        }
    }

    else if (def.category === 'tree') {
        // Farmville 2 style: round, lush, bright trees with visible fruit
        group.userData.isTree = true;
        group.userData.growParts = [];
        // Trunk
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0xb97a56, roughness: 0.7 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 4.5, 12), trunkMat);
        trunk.position.y = 2.25;
        group.add(trunk);
        // Lush, round canopy (more spheres, brighter greens)
        const leafColors = [0x7ed957, 0xa8e063, 0x6ecb3c, 0x4caf50];
        for (let i = 0; i < 7; i++) {
            const leafMat = new THREE.MeshStandardMaterial({ color: leafColors[Math.floor(Math.random()*leafColors.length)], roughness: 0.5 });
            const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.7 + Math.random() * 0.7, 18, 18), leafMat);
            canopy.position.set((Math.random()-0.5)*2.2, 4.2 + Math.random()*1.1, (Math.random()-0.5)*2.2);
            group.add(canopy);
        }
        // Branches (cartoon, chunky, lighter brown)
        const branchMat = new THREE.MeshStandardMaterial({ color: 0xe2a86b, roughness: 0.6 });
        for (let i = 0; i < 4; i++) {
            const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.2 + Math.random()*0.7, 8), branchMat);
            branch.position.set((Math.random()-0.5)*2.1, 3.2 + Math.random()*1.2, (Math.random()-0.5)*2.1);
            branch.rotation.z = Math.random() * Math.PI * 2;
            group.add(branch);
        }
        // Fruits (bigger, more saturated, visible)
        const fruitColors = [def.color, 0xffe066, 0xff1744, 0xffb347, 0xffffff];
        group.userData.fruits = [];
        for (let i = 0; i < 10; i++) {
            const fruitMat = new THREE.MeshStandardMaterial({ color: fruitColors[Math.floor(Math.random()*fruitColors.length)], roughness: 0.3 });
            const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.33 + Math.random()*0.09, 12, 12), fruitMat);
            fruit.position.set((Math.random()-0.5)*2.5, 4.6 + Math.random()*0.8, (Math.random()-0.5)*2.5);
            fruit.visible = false; // Start hidden, will show when mature
            fruit.scale.set(0.01, 0.01, 0.01);
            group.add(fruit);
            group.userData.fruits.push(fruit);
        }
        // Only fruits grow (scaling handled in updateCropGrowth)
    }
    else if (def.category === 'building') {
        const w = def.width ? def.width * TILE_SIZE : TILE_SIZE;
        const d = def.depth ? def.depth * TILE_SIZE : TILE_SIZE;

        // Helper for standard building base
        const createStandardBase = (mat, height=6) => {
            const body = new THREE.Mesh(new THREE.BoxGeometry(w*0.8, height, d*0.8), mat);
            body.position.y = height/2;
            return body;
        };

        if (type === 'silo') {
            // Per-level silo design
            let siloLevel = 1;
            // Use the level from the building object if available
            if (building && building.level) {
                siloLevel = building.level;
            } else if (window.gameState && window.gameState.buildings) {
                // fallback for preview/legacy
                const siloObj = window.gameState.buildings.find(b => b.type === 'silo');
                if (siloObj && siloObj.level) siloLevel = siloObj.level;
            }
            // Level-based color and features
            let tankColor = 0xA9A9A9, domeColor = 0xb0bec5, outlineColor = 0xffffff, highlightColor = 0xfff9c4;
            let hasLadder = true, hasFan = true, hasFlag = false, tankHeight = 10, domeShape = 'sphere';
            if (siloLevel === 2) {
                tankColor = 0x607d8b; domeColor = 0xff7043; outlineColor = 0xffe082; highlightColor = 0x90caf9; tankHeight = 12; domeShape = 'cone';
            } else if (siloLevel === 3) {
                tankColor = 0x388e3c; domeColor = 0xffd600; outlineColor = 0x512da8; highlightColor = 0xfff176; tankHeight = 14; hasFlag = true; domeShape = 'sphere';
            } else if (siloLevel >= 4) {
                tankColor = 0x512da8; domeColor = 0xffd600; outlineColor = 0xffffff; highlightColor = 0xffeb3b; tankHeight = 16; hasFlag = true; domeShape = 'cone';
            }
            // Tank
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, tankHeight, 32), new THREE.MeshStandardMaterial({ color: tankColor, roughness: 0.7 }));
            tank.position.y = tankHeight/2;
            group.add(tank);
            // Highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: highlightColor, transparent: true, opacity: 0.16 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(1.7, 18), highlightMat);
            highlight.position.set(0, tankHeight+0.1, 1.1);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // Outline
            const outline = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, tankHeight+0.1, 32, 1, true), new THREE.MeshStandardMaterial({ color: outlineColor, transparent: true, opacity: 0.13 }));
            outline.position.y = tankHeight/2;
            group.add(outline);
            // Dome
            let dome;
            if (domeShape === 'sphere') {
                dome = new THREE.Mesh(new THREE.SphereGeometry(2.5, 32, 16, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: domeColor, roughness: 0.7 }));
                dome.position.y = tankHeight;
            } else {
                dome = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2.5, 32), new THREE.MeshStandardMaterial({ color: domeColor, roughness: 0.7 }));
                dome.position.y = tankHeight+1.25;
            }
            group.add(dome);
            // Ladder
            if (hasLadder) {
                const ladder = new THREE.Group();
                ladder.position.set(2.6, tankHeight/2, 0);
                const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, tankHeight, 8), mats.metalDark); r1.position.z = -0.5;
                const r2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, tankHeight, 8), mats.metalDark); r2.position.z = 0.5;
                ladder.add(r1); ladder.add(r2);
                for(let i=0; i<Math.floor(tankHeight); i++) {
                    const step = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1), mats.metalDark);
                    step.rotation.z = Math.PI/2;
                    step.position.y = -tankHeight/2 + i + 0.5;
                    ladder.add(step);
                }
                group.add(ladder);
            }
            // Fan
            if (hasFan) {
                const fanBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.5), mats.metalDark);
                fanBox.position.set(0, tankHeight*0.6, 2.6);
                group.add(fanBox);
                const fan = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.1), mats.chrome);
                fan.position.set(0, tankHeight*0.6, 2.95);
                fan.name = 'fan';
                group.add(fan);
                const fan2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.1), mats.chrome);
                fan2.position.set(0, tankHeight*0.6, 2.96);
                fan2.name = 'fan2';
                group.add(fan2);
            }
            // Flag (level 3+)
            if (hasFlag) {
                const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 8), mats.metal);
                flagPole.position.set(-2.2, tankHeight+2, 0);
                group.add(flagPole);
                const flag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: 0xff1744, roughness: 0.5 }));
                flag.position.set(-2.2, tankHeight+2.8, 0.3);
                group.add(flag);
            }
        }
        else if (type === 'barn') {
            // Per-level barn design
            let barnLevel = 1;
            if (building && building.level) {
                barnLevel = building.level;
            }
            // Level-based color and features
            let barnColor = 0xd32f2f, roofColor = 0x4e342e, trimColor = 0xffffff, doorColor = 0xa1887f;
            let roofShape = 'cylinder', hasVane = true, hasSideShed = false, hasHay = false, barnHeight = 6, hasLoft = false, hasGutter = false, hasWindow2 = false;
            if (barnLevel === 2) {
                barnColor = 0x8d5524; // brown
                roofColor = 0x607d8b; // blue-gray
                trimColor = 0xffe082; // yellow trim
                doorColor = 0x6d4c41;
                roofShape = 'cone';
                hasSideShed = true;
                barnHeight = 7;
                hasGutter = true;
            } else if (barnLevel === 3) {
                barnColor = 0x388e3c; // green
                roofColor = 0xff7043; // orange
                trimColor = 0x90caf9; // blue trim
                doorColor = 0x795548;
                roofShape = 'cylinder';
                hasVane = false;
                hasHay = true;
                barnHeight = 8;
                hasLoft = true;
                hasGutter = true;
                hasWindow2 = true;
            } else if (barnLevel >= 4) {
                barnColor = 0x512da8; // purple
                roofColor = 0xffd600; // gold
                trimColor = 0xffffff;
                doorColor = 0x212121;
                roofShape = 'cone';
                hasVane = true;
                hasSideShed = true;
                hasHay = true;
                barnHeight = 9;
                hasLoft = true;
                hasGutter = true;
                hasWindow2 = true;
            }
            // Main body
            const body = new THREE.Mesh(new THREE.BoxGeometry(8, barnHeight, 8), new THREE.MeshStandardMaterial({ color: barnColor, roughness: 0.6 }));
            body.position.y = barnHeight/2;
            group.add(body);
            // Highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.18 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(3.5, 24), highlightMat);
            highlight.position.set(0, barnHeight+0.1, 2.5);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // Trim
            const trim1 = new THREE.Mesh(new THREE.BoxGeometry(8.15, 0.55, 8.15), new THREE.MeshStandardMaterial({ color: trimColor })); trim1.position.y = barnHeight/2; group.add(trim1);
            const trim2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, barnHeight+0.1, 0.55), new THREE.MeshStandardMaterial({ color: trimColor })); trim2.position.set(3.93, barnHeight/2, 3.93); group.add(trim2);
            const trim3 = new THREE.Mesh(new THREE.BoxGeometry(0.55, barnHeight+0.1, 0.55), new THREE.MeshStandardMaterial({ color: trimColor })); trim3.position.set(-3.93, barnHeight/2, 3.93); group.add(trim3);
            const trim4 = new THREE.Mesh(new THREE.BoxGeometry(0.55, barnHeight+0.1, 0.55), new THREE.MeshStandardMaterial({ color: trimColor })); trim4.position.set(3.93, barnHeight/2, -3.93); group.add(trim4);
            const trim5 = new THREE.Mesh(new THREE.BoxGeometry(0.55, barnHeight+0.1, 0.55), new THREE.MeshStandardMaterial({ color: trimColor })); trim5.position.set(-3.93, barnHeight/2, -3.93); group.add(trim5);
            // Roof
            const roof = new THREE.Group();
            roof.position.y = barnHeight;
            if (roofShape === 'cylinder') {
                const r1 = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 3, 12, 1, false, Math.PI/4), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.7 }));
                r1.position.y = 1.5; r1.scale.x = 1.2;
                roof.add(r1);
                const r2 = new THREE.Mesh(new THREE.ConeGeometry(4, 2, 12, 1, false, Math.PI/4), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.7 }));
                r2.position.y = 4; r2.scale.x = 1.2;
                roof.add(r2);
            } else {
                const r2 = new THREE.Mesh(new THREE.ConeGeometry(4, 5, 12, 1, false, Math.PI/4), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.7 }));
                r2.position.y = 2.5; r2.scale.x = 1.2;
                roof.add(r2);
            }
            group.add(roof);
            // Door
            const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(4.1, 5.1, 0.55), new THREE.MeshStandardMaterial({ color: trimColor }));
            doorFrame.position.set(0, barnHeight/2-0.5, 4.1);
            group.add(doorFrame);
            const door = new THREE.Mesh(new THREE.BoxGeometry(3.7, 4.7, 0.22), new THREE.MeshStandardMaterial({ color: doorColor }));
            door.position.set(0, barnHeight/2-0.5, 4.3);
            group.add(door);
            // X on door
            const x1 = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.33, 0.33), new THREE.MeshStandardMaterial({ color: trimColor })); x1.position.set(0, barnHeight/2-0.5, 4.55); x1.rotation.z = 0.9; group.add(x1);
            const x2 = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.33, 0.33), new THREE.MeshStandardMaterial({ color: trimColor })); x2.position.set(0, barnHeight/2-0.5, 4.55); x2.rotation.z = -0.9; group.add(x2);
            // Weather Vane
            if (hasVane) {
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.1), mats.metal);
                pole.position.y = barnHeight + 3;
                group.add(pole);
                const vane = new THREE.Group();
                vane.position.y = barnHeight + 4;
                vane.name = 'vane';
                const arrow = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.22, 0.11), mats.chrome);
                vane.add(arrow);
                const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 6), mats.chrome);
                tail.rotation.z = -Math.PI/2; tail.position.x = -1;
                vane.add(tail);
                group.add(vane);
            }
            // Gutter (level 2+)
            if (hasGutter) {
                const gutter = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.5, metalness: 0.6 }));
                gutter.position.set(0, barnHeight, 4.3);
                group.add(gutter);
            }
            // Loft window (level 3+)
            if (hasLoft) {
                const loftWin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x90caf9, roughness: 0.2, transparent: true, opacity: 0.6 }));
                loftWin.position.set(-2.5, barnHeight-1.5, 4.1);
                group.add(loftWin);
            }
            // Side window (level 3+)
            if (hasWindow2) {
                const sideWin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.2), new THREE.MeshStandardMaterial({ color: 0x90caf9, roughness: 0.2, transparent: true, opacity: 0.6 }));
                sideWin.position.set(4.1, barnHeight/2, 2);
                group.add(sideWin);
            }
            // Side shed (level 2+)
            if (hasSideShed) {
                const shed = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 4), new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.7 }));
                shed.position.set(-5.5, 1, 0);
                group.add(shed);
            }
            // Hay bales (level 3+)
            if (hasHay) {
                for (let i = 0; i < 2; i++) {
                    const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2, 12), new THREE.MeshStandardMaterial({ color: 0xffe082, roughness: 0.8 }));
                    hay.position.set(3.5, 0.7 + i * 1.2, -3.5);
                    hay.rotation.z = Math.PI/2;
                    group.add(hay);
                }
            }
        }
        else if (type === 'coop') {
            // Per-level coop design
            let coopLevel = 1;
            if (building && building.level) {
                coopLevel = building.level;
            }
            // Level-based color and features
            let legColor = 0x4e342e, bodyColor = 0xa1887f, trimColor = 0xffffff, roofColor = 0x4e342e, rampColor = 0xa1887f;
            let hasNest = false, hasEggs = false, hasWindow = false, roofShape = 'cone', coopSize = 5, hasPerch = false, hasDoor = false, hasPaint = false;
            if (coopLevel === 2) {
                legColor = 0xffd600; bodyColor = 0xff7043; trimColor = 0x90caf9; roofColor = 0x607d8b; rampColor = 0xffd600; hasNest = true; hasWindow = true; coopSize = 6; hasPerch = true; hasDoor = true;
            } else if (coopLevel === 3) {
                legColor = 0x388e3c; bodyColor = 0x388e3c; trimColor = 0xffe082; roofColor = 0xff7043; rampColor = 0x388e3c; hasNest = true; hasEggs = true; hasWindow = true; roofShape = 'cylinder'; coopSize = 7; hasPerch = true; hasDoor = true; hasPaint = true;
            } else if (coopLevel >= 4) {
                legColor = 0x512da8; bodyColor = 0x512da8; trimColor = 0xffffff; roofColor = 0xffd600; rampColor = 0x512da8; hasNest = true; hasEggs = true; hasWindow = true; roofShape = 'cone'; coopSize = 8; hasPerch = true; hasDoor = true; hasPaint = true;
            }
            // Legs
            const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.1), new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.8 })); leg1.position.set(2, 1, 2); group.add(leg1);
            const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.1), new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.8 })); leg2.position.set(-2, 1, 2); group.add(leg2);
            const leg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.1), new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.8 })); leg3.position.set(2, 1, -2); group.add(leg3);
            const leg4 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.1), new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.8 })); leg4.position.set(-2, 1, -2); group.add(leg4);
            // Body
            const body = new THREE.Mesh(new THREE.BoxGeometry(coopSize, 4, coopSize), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 }));
            body.position.y = 4;
            group.add(body);
            // Highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.16 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(2.1, 18), highlightMat);
            highlight.position.set(0, 6.1, 1.7);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // Trim
            const trim = new THREE.Mesh(new THREE.BoxGeometry(coopSize+0.1, 4.1, coopSize+0.1), new THREE.MeshStandardMaterial({ color: trimColor, transparent: true, opacity: 0.18 }));
            trim.position.y = 4;
            group.add(trim);
            // Roof
            let roof;
            if (roofShape === 'cone') {
                roof = new THREE.Mesh(new THREE.ConeGeometry(coopSize*0.8, 2, 12), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.8 }));
                roof.position.y = 7; roof.rotation.y = Math.PI/4;
            } else {
                roof = new THREE.Mesh(new THREE.CylinderGeometry(coopSize*0.7, coopSize*0.7, 1.5, 12), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.8 }));
                roof.position.y = 7.5;
            }
            group.add(roof);
            // Ramp
            const ramp = new THREE.Mesh(new THREE.BoxGeometry(2, 0.22, 4), new THREE.MeshStandardMaterial({ color: rampColor, roughness: 0.7 }));
            ramp.position.set(0, 1, 3.5);
            ramp.rotation.x = -Math.PI/4;
            group.add(ramp);
            const rampTrim = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.25, 4.1), new THREE.MeshStandardMaterial({ color: trimColor, transparent: true, opacity: 0.13 }));
            rampTrim.position.set(0, 1.01, 3.5);
            group.add(rampTrim);
            // Window (level 2+)
            if (hasWindow) {
                const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x90caf9, roughness: 0.2, transparent: true, opacity: 0.7 }));
                win.position.set(0, 5, coopSize/2+0.11);
                group.add(win);
            }
            // Nest (level 2+)
            if (hasNest) {
                const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xffe082, roughness: 0.8 }));
                nest.position.set(-1.5, 2.2, 0);
                group.add(nest);
            }
            // Eggs (level 3+)
            if (hasEggs) {
                for (let i = 0; i < 3; i++) {
                    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
                    egg.position.set(-1.5 + i*0.5, 2.5, 0.3);
                    group.add(egg);
                }
            }
            // Perch (level 2+)
            if (hasPerch) {
                const perch = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 0.3), new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.8 }));
                perch.position.set(0, 3, -2);
                group.add(perch);
            }
            // Door (level 2+)
            if (hasDoor) {
                const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.2), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 }));
                door.position.set(0, 2.5, coopSize/2+0.12);
                group.add(door);
            }
            // Paint (level 3+) - Add colorful stripe
            if (hasPaint) {
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(coopSize-0.5, 0.3, 0.15), new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 0.6 }));
                stripe.position.set(0, 5.5, coopSize/2+0.1);
                group.add(stripe);
            }
        }
        else if (["pig_pen", "sheep_pasture", "goat_yard", "duck_pond"].includes(type)) {
            // Per-level pig pen design
            let penLevel = 1;
            if (type === 'pig_pen' && building && building.level) {
                penLevel = building.level;
            }
            const fenceW = w * 0.9;
            const fenceD = d * 0.9;
            // Fence color and style by level
            let postColor = 0x4e342e, railColor = 0xa1887f, mudColor = 0x5d4037, shelterColor = 0xa1887f;
            let hasRoof = false, hasTrough = false, hasMud = true, hasFlowers = false, fenceHeight = 0.2;
            if (type === 'pig_pen') {
                if (penLevel === 2) {
                    postColor = 0x795548; railColor = 0xffe082; mudColor = 0x8d5524; shelterColor = 0xff7043; hasRoof = true; fenceHeight = 0.25;
                } else if (penLevel === 3) {
                    postColor = 0x607d8b; railColor = 0x388e3c; mudColor = 0x388e3c; shelterColor = 0x607d8b; hasTrough = true; hasRoof = true; fenceHeight = 0.3;
                } else if (penLevel >= 4) {
                    postColor = 0xffd600; railColor = 0x512da8; mudColor = 0xffe082; shelterColor = 0x512da8; hasTrough = true; hasRoof = true; hasFlowers = true; fenceHeight = 0.35;
                }
            }
            // Posts
            for(let dx of [-1, 1]) {
                for(let dz of [-1, 1]) {
                    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 0.5), new THREE.MeshStandardMaterial({ color: postColor, roughness: 0.8 }));
                    post.position.set(dx * fenceW/2, 1, dz * fenceD/2);
                    group.add(post);
                }
            }
            // Rails
            const r1 = new THREE.Mesh(new THREE.BoxGeometry(fenceW, fenceHeight, 0.2), new THREE.MeshStandardMaterial({ color: railColor, roughness: 0.7 })); r1.position.set(0, 1.5, fenceD/2); group.add(r1);
            const r2 = new THREE.Mesh(new THREE.BoxGeometry(fenceW, fenceHeight, 0.2), new THREE.MeshStandardMaterial({ color: railColor, roughness: 0.7 })); r2.position.set(0, 1.5, -fenceD/2); group.add(r2);
            const r3 = new THREE.Mesh(new THREE.BoxGeometry(0.2, fenceHeight, fenceD), new THREE.MeshStandardMaterial({ color: railColor, roughness: 0.7 })); r3.position.set(fenceW/2, 1.5, 0); group.add(r3);
            const r4 = new THREE.Mesh(new THREE.BoxGeometry(0.2, fenceHeight, fenceD), new THREE.MeshStandardMaterial({ color: railColor, roughness: 0.7 })); r4.position.set(-fenceW/2, 1.5, 0); group.add(r4);
            // Ground/Interior
            if (type === 'pig_pen') {
                if (hasMud) {
                    const mud = new THREE.Mesh(new THREE.BoxGeometry(fenceW-0.5, 0.2, fenceD-0.5), new THREE.MeshStandardMaterial({ color: mudColor, roughness: 1.0 }));
                    mud.position.y = 0.1;
                    group.add(mud);
                }
                // Shelter
                const shelter = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: shelterColor, roughness: 0.7 }));
                shelter.position.set(-2, 1, -2);
                group.add(shelter);
                // Roof (level 2+)
                if (hasRoof) {
                    const roof = new THREE.Mesh(new THREE.ConeGeometry(2, 1, 8), new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.8 }));
                    roof.position.set(-2, 2.7, -2);
                    group.add(roof);
                }
                // Trough (level 3+)
                if (hasTrough) {
                    const trough = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0xff6f00, roughness: 0.5 }));
                    trough.position.set(1.5, 0.35, 1.5);
                    group.add(trough);
                    // Water inside trough
                    const water = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.5), new THREE.MeshStandardMaterial({ color: 0x29b6f6, roughness: 0.1, metalness: 0.3 }));
                    water.position.set(1.5, 0.55, 1.5);
                    group.add(water);
                }
                // Flowers/decorations (level 4+)
                if (hasFlowers) {
                    const flowerColors = [0xff69b4, 0xffb300, 0xff6b9d, 0xffd54f];
                    for (let i = 0; i < 4; i++) {
                        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: flowerColors[i], roughness: 0.3 }));
                        flower.position.set(-1.2 + i*0.7, 0.3, -1.5);
                        group.add(flower);
                    }
                }
                // Flowers (level 4+)
                if (hasFlowers) {
                    for (let i = 0; i < 3; i++) {
                        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), new THREE.MeshStandardMaterial({ color: [0xff69b4,0xfff176,0x81c784][i], roughness: 0.2 }));
                        flower.position.set(-2 + i*1.2, 0.25, -1.5);
                        group.add(flower);
                    }
                }
            } else if (type === 'duck_pond') {
                // ...existing code...
                const water = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 24), mats.water);
                water.position.y = 0.25;
                water.name = 'water';
                group.add(water);
                // ...existing code...
                const highlight = new THREE.Mesh(new THREE.CircleGeometry(0.9, 18), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }));
                highlight.position.set(0, 0.51, 0.7);
                highlight.rotation.x = -Math.PI/2.1;
                group.add(highlight);
                for(let i=0; i<5; i++) {
                    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5), mats.leaves);
                    reed.position.set(2 + Math.random(), 0.75, Math.random()*2);
                    group.add(reed);
                }
            } else {
                // ...existing code...
                const grass = new THREE.Mesh(new THREE.BoxGeometry(fenceW-0.5, 0.1, fenceD-0.5), mats.grass);
                grass.position.y = 0.05;
                group.add(grass);
                if (type === 'goat_yard') {
                    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5), mats.concreteDark);
                    rock.position.set(2, 1, 1);
                    group.add(rock);
                }
            }
        }
        else if (type === 'stable') {
            const body = createStandardBase(mats.wood, 5);
            group.add(body);
            const roof = new THREE.Mesh(new THREE.CylinderGeometry(w*0.5, w*0.5, d*0.9, 3, 1, false, Math.PI/2), mats.woodDark);
            roof.rotation.z = Math.PI/2;
            roof.position.y = 6;
            group.add(roof);
            
            // Stalls
            for(let i=0; i<3; i++) {
                const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.2), mats.woodDark);
                door.position.set(-3 + i*3, 1.5, d*0.4 + 0.15);
                group.add(door);
            }
        }
        else if (type === 'mill') {
            // Cartoon mill: vibrant, outlined, sunlit
            const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 10, 16), mats.paintWhite);
            base.position.y = 5;
            group.add(base);
            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.15 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(2.1, 18), highlightMat);
            highlight.position.set(0, 10.1, 1.1);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // White outline trim
            const outline = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 4.05, 10.1, 16, 1, true), mats.paintWhite);
            outline.position.y = 5;
            outline.material.transparent = true;
            outline.material.opacity = 0.13;
            group.add(outline);
            // Roof (brighter, more segments)
            const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 3, 16), mats.woodDark);
            roof.position.y = 11.5;
            group.add(roof);
            // Blades
            const blades = new THREE.Group();
            blades.name = 'blades'; 
            blades.position.set(0, 10, 2);
            for(let i=0; i<4; i++) {
                const b = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 0.2), mats.wood);
                b.position.y = 4;
                const pivot = new THREE.Group();
                pivot.add(b);
                pivot.rotation.z = i * Math.PI/2;
                blades.add(pivot);
            }
            group.add(blades);
        }
        else if (['house', 'main_house', 'cottage', 'mansion', 'guest_house'].includes(type)) {
            // Modern, cozy, detailed house/cottage/mansion/guest_house
            const isMansion = type === 'mansion';
            const isCottage = type === 'cottage';
            const isMain = type === 'main_house';
            const baseHeight = isMansion ? 8 : (isMain ? 7 : 6);
            const bodyColor = isCottage ? 0xcabfa3 : (isMansion ? 0xfff8e1 : (isMain ? 0xadd8e6 : 0xf5f5dc));
            const outlineColor = 0xffffff;
            const roofColor = isCottage ? 0x6d4c41 : (isMansion ? 0x607d8b : 0xff7043);
            const doorColor = 0x8d5524;
            const windowColor = 0x90caf9;
            const shutterColor = 0x388e3c;
            const flowerBoxColor = 0xffb347;
            const highlightColor = 0xfff9c4;

            // Main body
            const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.38 });
            const body = createStandardBase(bodyMat, baseHeight);
            group.add(body);

            // Porch
            const porchMat = new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.5 });
            const porch = new THREE.Mesh(new THREE.BoxGeometry(w*0.7, 1.1, d*0.45), porchMat);
            porch.position.set(0, 0.55, d*0.22);
            group.add(porch);
            // Porch steps
            for(let i=0;i<2;i++) {
                const step = new THREE.Mesh(new THREE.BoxGeometry(w*0.6-0.2*i, 0.18, d*0.18), porchMat);
                step.position.set(0, 0.09+i*0.18, d*0.45+0.09*i);
                group.add(step);
            }
            // Porch columns
            const colMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
            for(let dx of [-w*0.28, w*0.28]) {
                const col = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 8), colMat);
                col.position.set(dx, 0.55, d*0.38);
                group.add(col);
            }

            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: highlightColor, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(w*0.7, 18), highlightMat);
            highlight.position.set(0, baseHeight+0.1, 1.1);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);

            // Roof (cartoonish, vibrant, with chimney)
            const roofH = isMansion ? 5 : (isMain ? 4.5 : 4);
            const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.32 });
            const roof = new THREE.Mesh(new THREE.ConeGeometry(w*0.6, roofH, 4), roofMat);
            roof.position.y = baseHeight + roofH/2;
            roof.rotation.y = Math.PI/4;
            group.add(roof);
            // Roof outline
            const roofOutlineMat = new THREE.MeshStandardMaterial({ color: outlineColor, roughness: 0.2 });
            const roofOutline = new THREE.Mesh(new THREE.ConeGeometry(w*0.6*1.04, roofH*1.04, 4), roofOutlineMat);
            roofOutline.position.copy(roof.position);
            roofOutline.rotation.copy(roof.rotation);
            group.add(roofOutline);
            // Chimney
            const houseChimneyMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.5 });
            const houseChimneyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 0.6), houseChimneyMat);
            houseChimneyMesh.position.set(w*0.18, baseHeight+roofH*0.6, -d*0.18);
            group.add(houseChimneyMesh);

            // Door (cartoonish, outlined)
            const doorMat = new THREE.MeshStandardMaterial({ color: doorColor, roughness: 0.4 });
            const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.2, 0.5), doorMat);
            door.position.set(0, 1.6, d*0.4 + 0.1);
            group.add(door);
            // Door outline
            const doorOutlineMat = new THREE.MeshStandardMaterial({ color: outlineColor });
            const doorOutline = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.3, 0.55), doorOutlineMat);
            doorOutline.position.copy(door.position);
            group.add(doorOutline);

            // Windows (cartoonish, outlined, blue glass, with shutters and flower boxes)
            const winMat = new THREE.MeshStandardMaterial({ color: windowColor, roughness: 0.13, metalness: 0.2, transparent: true, opacity: 0.88 });
            const winY = 3.7;
            const winZ = d*0.4+0.1;
            for(let wx of [-3, 3]) {
                const wbox = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.3), winMat); wbox.position.set(wx, winY, winZ); group.add(wbox);
                // Window outline
                const wboxOutline = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.1, 0.35), doorOutlineMat); wboxOutline.position.copy(wbox.position); group.add(wboxOutline);
                // Shutters
                const shutterMat = new THREE.MeshStandardMaterial({ color: shutterColor, roughness: 0.25 });
                for(let sx of [-1.25, 1.25]) {
                    const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2, 0.18), shutterMat);
                    shutter.position.set(wx+sx, winY, winZ+0.01);
                    group.add(shutter);
                }
                // Flower box
                const flowerBoxMat = new THREE.MeshStandardMaterial({ color: flowerBoxColor, roughness: 0.3 });
                const flowerBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.28), flowerBoxMat);
                flowerBox.position.set(wx, winY-1.1, winZ+0.13);
                group.add(flowerBox);
                // Flowers (simple spheres)
                for(let f=0;f<3;f++) {
                    const flowerMat = new THREE.MeshStandardMaterial({ color: [0xff69b4,0xfff176,0x81c784][f], roughness: 0.2 });
                    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), flowerMat);
                    flower.position.set(wx-0.4+f*0.4, winY-1.1, winZ+0.22);
                    group.add(flower);
                }
            }

            // Fence/garden detail in front
            const fenceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
            for(let fx=-w*0.32;fx<=w*0.32;fx+=w*0.16) {
                const fencePost = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.7, 0.13), fenceMat);
                fencePost.position.set(fx, 0.35, d*0.55);
                group.add(fencePost);
            }
            for(let fx=-w*0.32;fx<w*0.32;fx+=w*0.16) {
                const rail = new THREE.Mesh(new THREE.BoxGeometry(w*0.16, 0.09, 0.13), fenceMat);
                rail.position.set(fx+0.5*w*0.16, 0.55, d*0.55);
                group.add(rail);
            }

            // Mansion extras
            if (isMansion) {
                const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 });
                const pillar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8), pillarMat); pillar1.position.set(-2, 4, d*0.4+1); group.add(pillar1);
                const pillar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8), pillarMat); pillar2.position.set(2, 4, d*0.4+1); group.add(pillar2);
                const balconyMat = new THREE.MeshStandardMaterial({ color: 0xfff8e1 });
                const balcony = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 2), balconyMat); balcony.position.set(0, 8, d*0.4+1); group.add(balcony);
                // Balcony outline
                const balconyOutlineMat = new THREE.MeshStandardMaterial({ color: outlineColor });
                const balconyOutline = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.6, 2.1), balconyOutlineMat); balconyOutline.position.copy(balcony.position); group.add(balconyOutline);
            }

            // Chimney & Smoke (cartoonish)
            const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41 });
            const chimney = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 1), chimneyMat);
            chimney.position.set(w*0.2, isMansion?10:8, d*0.2);
            group.add(chimney);
            // Chimney outline
            const chimneyOutlineMat = new THREE.MeshStandardMaterial({ color: outlineColor });
            const chimneyOutline = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.1, 1.1), chimneyOutlineMat);
            chimneyOutline.position.copy(chimney.position);
            group.add(chimneyOutline);

            const smoke = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), mats.smoke);
            smoke.position.set(w*0.2, isMansion?12:10, d*0.2);
            smoke.name = 'smoke';
            smoke.userData.initialY = isMansion?12:10;
            group.add(smoke);
        }
        else if (type === 'bakery') {
            // Cartoon bakery: vibrant, outlined, sunlit
            const body = createStandardBase(mats.dirt, 6);
            group.add(body);
            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(2.1, 18), highlightMat);
            highlight.position.set(0, 6.1, 1.1);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // Awning (brighter)
            const awning = new THREE.Mesh(new THREE.BoxGeometry(w*0.8, 0.5, 2), mats.paintRed);
            awning.position.set(0, 4, d*0.4+1.05);
            awning.rotation.x = 0.2;
            group.add(awning);
            // White outline trim
            const trim = new THREE.Mesh(new THREE.BoxGeometry(w*0.82, 0.55, 2.1), mats.paintWhite);
            trim.position.set(0, 4, d*0.4+1.05);
            trim.rotation.x = 0.2;
            trim.material.transparent = true;
            trim.material.opacity = 0.13;
            group.add(trim);
            // Window
            const windowL = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.2), mats.glass);
            windowL.position.set(0, 2.5, d*0.4+0.15);
            group.add(windowL);
            
            // Bread Sign
            const sign = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 8), mats.emissive);
            sign.rotation.x = Math.PI/2;
            sign.position.set(0, 5, d*0.4+0.2);
            group.add(sign);
        }
        else if (type === 'dairy') {
            // Vibrant, cartoonish, outlined dairy
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfff8e1, roughness: 0.35 });
            const body = createStandardBase(bodyMat, 6);
            group.add(body);

            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(w*0.7, 18), highlightMat);
            highlight.position.set(0, 6.1, 1.1);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);

            // Churn (cartoonish, metallic, outlined)
            const churnMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.5, roughness: 0.3 });
            const churn = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 2), churnMat);
            churn.position.set(3, 1, d*0.4+1);
            group.add(churn);
            // Churn outline
            const churnOutlineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const churnOutline = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.02, 2.05), churnOutlineMat);
            churnOutline.position.copy(churn.position);
            group.add(churnOutline);

            // Red stripe (cartoonish, vibrant)
            const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff5252 });
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(w*0.82, 1, d*0.82), stripeMat);
            stripe.position.y = 4;
            group.add(stripe);
            // Stripe outline
            const stripeOutlineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const stripeOutline = new THREE.Mesh(new THREE.BoxGeometry(w*0.84, 1.1, d*0.84), stripeOutlineMat);
            stripeOutline.position.copy(stripe.position);
            group.add(stripeOutline);
        }
        else if (type === 'sugar_mill' || type === 'textile_mill') {
            // Vibrant, cartoonish, outlined sugar/textile mill
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.35 });
            const body = createStandardBase(bodyMat, 8);
            group.add(body);

            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(w*0.7, 18), highlightMat);
            highlight.position.set(0, 8.1, 1.1);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);

            // Industrial Pipe (cartoonish, metallic, outlined)
            const pipeMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.5, roughness: 0.3 });
            const pipe = new THREE.Mesh(new THREE.TorusGeometry(2, 0.5, 8, 16), pipeMat);
            pipe.position.set(0, 8, 0);
            pipe.rotation.x = Math.PI/2;
            group.add(pipe);
            // Pipe outline
            const pipeOutlineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const pipeOutline = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.55, 8, 16), pipeOutlineMat);
            pipeOutline.position.copy(pipe.position);
            pipeOutline.rotation.copy(pipe.rotation);
            group.add(pipeOutline);

            // Stack (chimney, cartoonish, outlined)
            const stackMat = new THREE.MeshStandardMaterial({ color: 0x757575 });
            const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 4), stackMat);
            stack.position.set(3, 9, -3);
            group.add(stack);
            // Stack outline
            const stackOutlineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const stackOutline = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 4.1), stackOutlineMat);
            stackOutline.position.copy(stack.position);
            group.add(stackOutline);

            // Smoke
            const smoke = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), mats.smoke);
            smoke.position.set(3, 12, -3);
            smoke.name = 'smoke';
            smoke.userData.initialY = 12;
            group.add(smoke);
        }
        else if (type === 'water_tower') {
            // Vibrant, cartoonish, outlined water tower
            const legMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.5, roughness: 0.3 });
            const outlineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), legMat); leg1.position.set(2, 4, 2); group.add(leg1);
            const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), legMat); leg2.position.set(-2, 4, 2); group.add(leg2);
            const leg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), legMat); leg3.position.set(2, 4, -2); group.add(leg3);
            const leg4 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), legMat); leg4.position.set(-2, 4, -2); group.add(leg4);
            // Leg outlines
            const leg1o = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 8.1), outlineMat); leg1o.position.copy(leg1.position); group.add(leg1o);
            const leg2o = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 8.1), outlineMat); leg2o.position.copy(leg2.position); group.add(leg2o);
            const leg3o = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 8.1), outlineMat); leg3o.position.copy(leg3.position); group.add(leg3o);
            const leg4o = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 8.1), outlineMat); leg4o.position.copy(leg4.position); group.add(leg4o);

            // Tank (cartoonish, blue, outlined)
            const tankMat = new THREE.MeshStandardMaterial({ color: 0x90caf9, metalness: 0.3, roughness: 0.25 });
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 4, 16), tankMat);
            tank.position.y = 10;
            group.add(tank);
            // Tank outline
            const tankOutline = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 4.1, 16), outlineMat);
            tankOutline.position.copy(tank.position);
            group.add(tankOutline);

            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(3.2, 18), highlightMat);
            highlight.position.set(0, 12.1, 0);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);

            // Roof (cartoonish, vibrant, outlined)
            const roofMat = new THREE.MeshStandardMaterial({ color: 0xff7043 });
            const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2, 16), roofMat);
            roof.position.y = 13;
            group.add(roof);
            // Roof outline
            const roofOutline = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.1, 16), outlineMat);
            roofOutline.position.copy(roof.position);
            group.add(roofOutline);
        }
        else if (type === 'solar') {
            // Per-level solar panel design
            let solarLevel = 1;
            // Use the level from the building object if available
            if (building && building.level) {
                solarLevel = building.level;
            } else if (window.gameState && window.gameState.buildings) {
                // fallback for preview/legacy
                const solarObj = window.gameState.buildings.find(b => b.type === 'solar');
                if (solarObj && solarObj.level) solarLevel = solarObj.level;
            }
            // Level-based color and features
            let poleColor = 0x90a4ae, panelColor = 0x90caf9, outlineColor = 0xffffff, highlightColor = 0xfff9c4;
            let panelW = 8, panelD = 5, poleH = 4, hasSun = false, hasBattery = false, hasFlower = false;
            if (solarLevel === 2) {
                poleColor = 0xffd600; panelColor = 0x388e3c; outlineColor = 0xffe082; highlightColor = 0x90caf9; panelW = 10; panelD = 6; poleH = 5; hasSun = true;
            } else if (solarLevel === 3) {
                poleColor = 0x388e3c; panelColor = 0xff7043; outlineColor = 0x512da8; highlightColor = 0xfff176; panelW = 12; panelD = 7; poleH = 6; hasSun = true; hasBattery = true;
            } else if (solarLevel >= 4) {
                poleColor = 0x512da8; panelColor = 0xffd600; outlineColor = 0xffffff; highlightColor = 0xffeb3b; panelW = 14; panelD = 8; poleH = 7; hasSun = true; hasBattery = true; hasFlower = true;
            }
            // Pole
            const poleMat = new THREE.MeshStandardMaterial({ color: poleColor, metalness: 0.5, roughness: 0.3 });
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, poleH), poleMat);
            pole.position.y = poleH/2;
            group.add(pole);
            // Pole outline
            const outlineMat = new THREE.MeshStandardMaterial({ color: outlineColor });
            const poleOutline = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, poleH+0.1), outlineMat);
            poleOutline.position.copy(pole.position);
            group.add(poleOutline);
            // Panel
            const panelMat = new THREE.MeshStandardMaterial({ color: panelColor, metalness: 0.3, roughness: 0.25 });
            const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, 0.2, panelD), panelMat);
            panel.position.set(0, poleH, 0);
            panel.rotation.x = -Math.PI/6;
            group.add(panel);
            // Panel outline
            const panelOutline = new THREE.Mesh(new THREE.BoxGeometry(panelW+0.1, 0.25, panelD+0.1), outlineMat);
            panelOutline.position.copy(panel.position);
            panelOutline.rotation.copy(panel.rotation);
            group.add(panelOutline);
            // Highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: highlightColor, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(panelD/2, 18), highlightMat);
            highlight.position.set(0, poleH+0.2, panelD/4);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // Sun (level 2+)
            if (hasSun) {
                const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 0.5 }));
                sun.position.set(panelW/2+1, poleH+2, 0);
                group.add(sun);
            }
            // Battery (level 3+)
            if (hasBattery) {
                const battery = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 1.2), new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.7 }));
                battery.position.set(-panelW/2-1, 1, 0);
                group.add(battery);
            }
            // Flower (level 4+)
            if (hasFlower) {
                const flower = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 8), new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.7 }));
                flower.position.set(0, 0.5, panelD/2+1);
                group.add(flower);
            }
        }
        else if (type === 'market') {
            // Cartoon market: vibrant, outlined, sunlit
            const stall = createStandardBase(mats.wood, 3);
            group.add(stall);
            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(2.1, 18), highlightMat);
            highlight.position.set(0, 4.7, 1.1);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // Striped Canopy (brighter, more segments)
            const canopy = new THREE.Mesh(new THREE.ConeGeometry(5, 2, 12), mats.paintRed);
            canopy.position.y = 4.5;
            canopy.rotation.y = Math.PI/4;
            group.add(canopy);
            // White outline trim
            const trim = new THREE.Mesh(new THREE.ConeGeometry(5.1, 2.1, 12), mats.paintWhite);
            trim.position.y = 4.5;
            trim.rotation.y = Math.PI/4;
            trim.material.transparent = true;
            trim.material.opacity = 0.13;
            group.add(trim);
            // Crates
            const c1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.woodDark); c1.position.set(2, 1, 3); group.add(c1);
            const c2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.woodDark); c2.position.set(-2, 1, 3); group.add(c2);
        }

        else if (type === 'florist') {
            // Cartoon florist: vibrant, outlined, sunlit
            const body = createStandardBase(mats.paintWhite, 5);
            group.add(body);
            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(1.2, 18), highlightMat);
            highlight.position.set(0, 5.1, 0.7);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // White outline trim
            const trim = new THREE.Mesh(new THREE.BoxGeometry(w*0.82, 0.15, d*0.82), mats.paintWhite);
            trim.position.y = 5.01;
            trim.material.transparent = true;
            trim.material.opacity = 0.13;
            group.add(trim);
             const awning = new THREE.Mesh(new THREE.BoxGeometry(w*0.8, 0.2, 2), new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.9 }));
             awning.position.set(0, 3.5, d*0.4+1.05);
             awning.rotation.x = 0.2;
             group.add(awning);
             
             // Flowers in front
             for(let i=-1; i<=1; i+=2) {
                 const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.5), mats.dirt);
                 pot.position.set(i*1.5, 0.25, d*0.4+1);
                 group.add(pot);
                 const flower = new THREE.Mesh(new THREE.SphereGeometry(0.3), getColorMat(0xe91e63));
                 flower.position.set(i*1.5, 0.7, d*0.4+1);
                 group.add(flower);
             }
        }
        else if (type === 'tool_shed') {
            // Cartoon tool shed: vibrant, outlined, sunlit
            const body = createStandardBase(mats.wood, 4);
            group.add(body);
            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(1.2, 18), highlightMat);
            highlight.position.set(0, 4.8, 0.7);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // Roof (brighter, more segments)
            const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 1.5, 12), mats.woodDark);
            roof.position.y = 4.75;
            roof.rotation.y = Math.PI/4;
            group.add(roof);
            // White outline trim
            const trim = new THREE.Mesh(new THREE.ConeGeometry(3.1, 1.6, 12), mats.paintWhite);
            trim.position.y = 4.75;
            trim.rotation.y = Math.PI/4;
            trim.material.transparent = true;
            trim.material.opacity = 0.13;
            group.add(trim);
            // Tools on wall
            const shovel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.2), mats.metal);
            shovel.position.set(1.5, 2, d*0.4+0.15);
            group.add(shovel);
        }
        else if (type === 'garage') {
             const body = createStandardBase(mats.concrete, 5);
             group.add(body);
             // Roll-up door
             const door = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.2), mats.metalDark);
             door.position.set(0, 1.5, d*0.4+0.15);
             group.add(door);
             // Corrugated texture simulation (stripes)
             for(let i=0; i<6; i++) {
                 const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 0.05), mats.metal);
                 stripe.position.set(0, 0.5 + i*0.5, 0.15);
                 door.add(stripe);
             }
             
             // Tires
             const tire = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.2, 8, 16), mats.concreteDark);
             tire.rotation.x = Math.PI/2;
             tire.position.set(2.5, 0.2, 2.5);
             group.add(tire);
        }
        else if (type === 'jam_maker') {
             const body = createStandardBase(mats.paintRed, 6);
             group.add(body);
             // Giant Jar
             const jar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.5, 16), mats.glass);
             jar.position.y = 7.25;
             group.add(jar);
             const jam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2, 16), getColorMat(0xe91e63));
             jam.position.y = 7.25;
             group.add(jam);
             const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.2, 16), mats.metal);
             lid.position.y = 8.55;
             group.add(lid);
        }
        else if (type === 'juice_press') {
            // Cartoon juice press: vibrant, outlined, sunlit
            const body = createStandardBase(mats.wood, 6);
            group.add(body);
            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(1.2, 18), highlightMat);
            highlight.position.set(0, 6.1, 0.7);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // White outline trim
            const trim = new THREE.Mesh(new THREE.BoxGeometry(w*0.82, 0.15, d*0.82), mats.paintWhite);
            trim.position.y = 6.01;
            trim.material.transparent = true;
            trim.material.opacity = 0.13;
            group.add(trim);
            // Giant Orange
            const orange = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), getColorMat(0xff9800));
            orange.position.y = 8;
            group.add(orange);
            // Leaf
            const leaf = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.5), mats.leaves);
            leaf.position.set(0.5, 9.3, 0);
            leaf.rotation.z = Math.PI/4;
            group.add(leaf);
        }
        else if (type === 'popcorn') {
            // Cartoon popcorn: vibrant, outlined, sunlit
            const body = createStandardBase(mats.paintWhite, 5);
            group.add(body);
            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(1.2, 18), highlightMat);
            highlight.position.set(0, 5.1, 0.7);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // Stripes (brighter)
            const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, d*0.81), mats.paintRed); s1.position.set(-2, 2.5, 0); group.add(s1);
            const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, d*0.81), mats.paintRed); s2.position.set(0, 2.5, 0); group.add(s2);
            const s3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, d*0.81), mats.paintRed); s3.position.set(2, 2.5, 0); group.add(s3);
            // White outline trim
            const trim = new THREE.Mesh(new THREE.BoxGeometry(w*0.82, 0.15, d*0.82), mats.paintWhite);
            trim.position.y = 5.01;
            trim.material.transparent = true;
            trim.material.opacity = 0.13;
            group.add(trim);
            // Popcorn Bucket
            const bucket = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 2, 8), mats.paintWhite);
            bucket.position.y = 6;
            group.add(bucket);
            // Kernels
            for(let i=0; i<8; i++) {
                const k = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), mats.emissive); // Butter color
                k.position.set((Math.random()-0.5), 7.2, (Math.random()-0.5));
                group.add(k);
            }
        }
        else if (type === 'warehouse') {
            // Per-level warehouse design
            let warehouseLevel = 1;
            if (building && building.level) {
                warehouseLevel = building.level;
            }
            // Level-based color and features
            let bodyColor = 0x607d8b, bayColor = 0x37474f, crateColor = 0xa1887f, roofColor = 0x607d8b, outlineColor = 0xffffff;
            let whHeight = 8, hasRoof = false, hasForklift = false, hasSign = false, crateCount = 2, hasWindow = false, hasExtension = false, hasLights = false;
            if (warehouseLevel === 2) {
                bodyColor = 0xff7043; bayColor = 0x388e3c; crateColor = 0xffd600; roofColor = 0x388e3c; outlineColor = 0xffe082; whHeight = 10; hasRoof = true; crateCount = 3; hasWindow = true; hasLights = true;
            } else if (warehouseLevel === 3) {
                bodyColor = 0x388e3c; bayColor = 0x512da8; crateColor = 0xff7043; roofColor = 0xffd600; outlineColor = 0x512da8; whHeight = 12; hasRoof = true; hasForklift = true; crateCount = 4; hasWindow = true; hasExtension = true; hasLights = true;
            } else if (warehouseLevel >= 4) {
                bodyColor = 0x512da8; bayColor = 0xffd600; crateColor = 0xffffff; roofColor = 0xffd600; outlineColor = 0xffffff; whHeight = 14; hasRoof = true; hasForklift = true; hasSign = true; crateCount = 5; hasWindow = true; hasExtension = true; hasLights = true;
            }
            // Body
            const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(w*0.8, whHeight, d*0.8), bodyMat);
            body.position.y = whHeight/2;
            group.add(body);
            // Outline
            const outlineMat = new THREE.MeshStandardMaterial({ color: outlineColor, roughness: 0.2 });
            const outline = new THREE.Mesh(new THREE.BoxGeometry(w*0.82, whHeight+0.1, d*0.82), outlineMat);
            outline.position.y = whHeight/2;
            outline.material.transparent = true;
            outline.material.opacity = 0.13;
            group.add(outline);
            // Loading Bay
            const bay = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 1), new THREE.MeshStandardMaterial({ color: bayColor, roughness: 0.6 }));
            bay.position.set(0, 2.5, d*0.4+0.15);
            group.add(bay);
            // Roof (level 2+)
            if (hasRoof) {
                const roof = new THREE.Mesh(new THREE.BoxGeometry(w*0.82, 1.2, d*0.82), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.4 }));
                roof.position.y = whHeight+0.6;
                group.add(roof);
            }
            // Crates
            for (let i = 0; i < crateCount; i++) {
                const crate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshStandardMaterial({ color: crateColor, roughness: 0.7 }));
                crate.position.set(3, 0.75 + i*1.5, 3);
                group.add(crate);
            }
            // Forklift (level 3+)
            if (hasForklift) {
                const lift = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 0.6 }));
                lift.position.set(-3, 1, 3);
                group.add(lift);
                const fork = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.7 }));
                fork.position.set(-3, 0.3, 2.2);
                group.add(fork);
            }
            // Sign (level 4+)
            if (hasSign) {
                const sign = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 0.2), new THREE.MeshStandardMaterial({ color: 0xff1744, roughness: 0.5 }));
                sign.position.set(0, whHeight+1, d*0.4+0.2);
                group.add(sign);
            }
            // Window (level 2+)
            if (hasWindow) {
                const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x90caf9, roughness: 0.2, transparent: true, opacity: 0.6 }));
                win.position.set(w*0.35, whHeight/2, d*0.4+0.2);
                group.add(win);
            }
            // Extension shed (level 3+)
            if (hasExtension) {
                const ext = new THREE.Mesh(new THREE.BoxGeometry(w*0.4, whHeight*0.6, d*0.5), new THREE.MeshStandardMaterial({ color: bayColor, roughness: 0.6 }));
                ext.position.set(-w*0.5, whHeight*0.3, d*0.3);
                group.add(ext);
            }
            // Lights (level 2+)
            if (hasLights) {
                const light1 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0xffeb3b, emissiveIntensity: 0.8 }));
                light1.position.set(-w*0.3, whHeight-0.5, d*0.3);
                group.add(light1);
                const light2 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0xffeb3b, emissiveIntensity: 0.8 }));
                light2.position.set(w*0.3, whHeight-0.5, d*0.3);
                group.add(light2);
            }
        }
        else if (type === 'generator') {
            // Per-level generator design
            let genLevel = 1;
            if (building && building.level) {
                genLevel = building.level;
            }
            // Level-based color and features
            let bodyColor = 0xe74c3c, ventColor = 0xb0bec5, boltColor = 0xffeb3b, outlineColor = 0xffffff;
            let genHeight = 5, hasOutline = false, hasFan = false, hasPanel = false, hasSpark = false;
            if (genLevel === 2) {
                bodyColor = 0x607d8b; ventColor = 0xffd600; boltColor = 0x388e3c; outlineColor = 0xffe082; genHeight = 6; hasOutline = true; hasFan = true;
            } else if (genLevel === 3) {
                bodyColor = 0x388e3c; ventColor = 0xff7043; boltColor = 0x512da8; outlineColor = 0x512da8; genHeight = 7; hasOutline = true; hasFan = true; hasPanel = true;
            } else if (genLevel >= 4) {
                bodyColor = 0x512da8; ventColor = 0xffd600; boltColor = 0xffffff; outlineColor = 0xffffff; genHeight = 8; hasOutline = true; hasFan = true; hasPanel = true; hasSpark = true;
            }
            // Body
            const body = new THREE.Mesh(new THREE.BoxGeometry(w*0.8, genHeight, d*0.8), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 }));
            body.position.y = genHeight/2;
            group.add(body);
            // Outline (level 2+)
            if (hasOutline) {
                const outline = new THREE.Mesh(new THREE.BoxGeometry(w*0.82, genHeight+0.1, d*0.82), new THREE.MeshStandardMaterial({ color: outlineColor, transparent: true, opacity: 0.13 }));
                outline.position.y = genHeight/2;
                group.add(outline);
            }
            // Vents
            const vent = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), new THREE.MeshStandardMaterial({ color: ventColor, roughness: 0.7 }));
            vent.rotation.x = Math.PI/2;
            vent.position.set(0, 3, d*0.4+0.15);
            group.add(vent);
            // Lightning Bolt
            const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 0.5), new THREE.MeshStandardMaterial({ color: boltColor, emissive: boltColor, emissiveIntensity: 0.7 }));
            bolt.position.set(0, genHeight+2, 0);
            bolt.rotation.z = 0.5;
            group.add(bolt);
            // Fan (level 2+)
            if (hasFan) {
                const fan = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6 }));
                fan.position.set(2, genHeight/2, 0);
                group.add(fan);
            }
            // Panel (level 3+)
            if (hasPanel) {
                const panel = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.2), new THREE.MeshStandardMaterial({ color: 0x90caf9, roughness: 0.4 }));
                panel.position.set(-2, genHeight/2, 0);
                group.add(panel);
            }
            // Spark (level 4+)
            if (hasSpark) {
                const spark = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0xffeb3b, emissiveIntensity: 1.0 }));
                spark.position.set(0, genHeight+3, 0);
                group.add(spark);
            }
        }
        else if (type === 'breeding_center') {
            // Cartoon breeding center: vibrant, outlined, sunlit
            const body = createStandardBase(getColorMat(0xe91e63), 6);
            group.add(body);
            // Sunlit highlight
            const highlightMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.13 });
            const highlight = new THREE.Mesh(new THREE.CircleGeometry(1.2, 18), highlightMat);
            highlight.position.set(0, 7.7, 0.7);
            highlight.rotation.x = -Math.PI/2.1;
            group.add(highlight);
            // White outline trim
            const trim = new THREE.Mesh(new THREE.BoxGeometry(w*0.82, 0.15, d*0.82), mats.paintWhite);
            trim.position.y = 6.01;
            trim.material.transparent = true;
            trim.material.opacity = 0.13;
            group.add(trim);
            const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), mats.glass);
            dome.position.y = 7.5;
            group.add(dome);
            const sign = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 12), mats.emissive);
            sign.rotation.x = Math.PI/2;
            sign.position.set(0, 5.5, d*0.4 + 0.2);
            group.add(sign);
            const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.5, 0.2), mats.paintWhite);
            door.position.set(0, 1.8, d*0.4 + 0.15);
            group.add(door);
        }
        else {
            // GENERIC FALLBACK (Factories/Shops)
            const color = def.color || 0xcccccc;
            const body = new THREE.Mesh(new THREE.BoxGeometry(w*0.8, 6, d*0.8), getColorMat(color));
            body.position.y = 3;
            group.add(body);
            
            // Roof / Topper
            const topper = new THREE.Mesh(new THREE.BoxGeometry(w*0.6, 1, d*0.6), mats.concreteDark);
            topper.position.y = 6.5;
            group.add(topper);

            const glass = new THREE.Mesh(new THREE.BoxGeometry(w*0.4, 2, 0.2), mats.glass);
            glass.position.set(0, 4, d*0.4 + 0.15);
            group.add(glass);
            
            // Specialized Props
            if (type === 'ice_cream') {
                 const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 8), mats.emissive);
                 cone.rotation.z = Math.PI; cone.position.y = 8;
                 group.add(cone);
                 const scoop = new THREE.Mesh(new THREE.SphereGeometry(1), mats.paintWhite);
                 scoop.position.y = 9.5;
                 group.add(scoop);
            } else if (type === 'coffee_kiosk') {
                const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1, 1.5), mats.woodDark);
                cup.position.y = 7.75;
                group.add(cup);
            } else if (type === 'grill') {
                const grill = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2), mats.metalDark);
                grill.rotation.z = Math.PI/2;
                grill.position.set(0, 7, 0);
                group.add(grill);
                 const smoke = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5), mats.smoke);
                smoke.position.set(0, 9, 0);
                smoke.name = 'smoke';
                smoke.userData.initialY = 9;
                group.add(smoke);
            }
        }
    }
    else if (def.category === 'tree') {
        group.userData.isCrop = true;
        group.userData.isTree = true;
        group.userData.growth = 0;
        group.userData.growParts = [];

        // Tree Group
        const treeGroup = new THREE.Group();
        
        // Random Seed for this tree instance
        const seed = Math.random();

        // 1. Trunk (More natural shape)
        const trunkGeo = new THREE.CylinderGeometry(0.2 + seed * 0.15, 0.35 + seed * 0.15, 2.5, 7);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.25; 
        // Slight lean
        trunk.rotation.x = (Math.random() - 0.5) * 0.15;
        trunk.rotation.z = (Math.random() - 0.5) * 0.15;
        treeGroup.add(trunk);
        
        // 2. Branches
        const branchGeo = new THREE.CylinderGeometry(0.08, 0.12, 1.0, 5);
        for(let k=0; k<2; k++) {
            const branch = new THREE.Mesh(branchGeo, trunkMat);
            const side = Math.random() > 0.5 ? 1 : -1;
            branch.position.set(0, 1.5 + Math.random() * 0.6, 0);
            branch.rotation.z = side * (Math.PI / 3 + Math.random() * 0.2);
            branch.rotation.y = Math.random() * Math.PI * 2;
            treeGroup.add(branch);
        }

        // 3. Foliage (Cluster of shapes)
        const foliageGroup = new THREE.Group();
        foliageGroup.position.y = 2.4; // Top of trunk
        
        // Base green color
        const baseGreen = new THREE.Color(0x4caf50);
        
        // Create 5-8 foliage blobs
        const numBlobs = 5 + Math.floor(Math.random() * 4);
        const foliageGeo = new THREE.DodecahedronGeometry(1.0); // Base geometry
        
        for (let j = 0; j < numBlobs; j++) {
            // Vary color slightly
            const blobColor = baseGreen.clone();
            blobColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15); // Lightness variation
            
            const blob = new THREE.Mesh(foliageGeo, new THREE.MeshStandardMaterial({ color: blobColor, roughness: 0.8 }));
            
            // Randomize scale
            const s = 0.6 + Math.random() * 0.6;
            blob.scale.set(s, s, s);
            
            // Randomize position in a sphere-like cluster
            blob.position.set(
                (Math.random() - 0.5) * 1.8,
                (Math.random() - 0.1) * 1.5 + 0.5, 
                (Math.random() - 0.5) * 1.8
            );
            
            // Random rotation
            blob.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            
            foliageGroup.add(blob);
        }
        treeGroup.add(foliageGroup);

        // 4. Fruits (Scattered on foliage)
        if (def.type === 'tree_fruit') {
            const fruitColor = def.color || 0xd32f2f;
            const fruitGeo = new THREE.SphereGeometry(0.2, 8, 8);
            const fruitMat = new THREE.MeshStandardMaterial({ color: fruitColor, roughness: 0.5 });
            
            const numFruits = 5 + Math.floor(Math.random() * 4);
            group.userData.fruits = [];
            
            for(let i=0; i < numFruits; i++) {
                const fruit = new THREE.Mesh(fruitGeo, fruitMat);
                
                // Place randomly within the foliage volume, but push outwards
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = 1.2 + Math.random() * 0.6; // Distance from center of foliage group
                
                // Foliage center is around y=2.4 + 1.0 = 3.4
                fruit.position.set(
                    r * Math.sin(phi) * Math.cos(theta),
                    r * Math.sin(phi) * Math.sin(theta) + 3.2, 
                    r * Math.cos(phi)
                );
                
                fruit.visible = false; // Start hidden until grown
                treeGroup.add(fruit);
                group.userData.fruits.push(fruit);
            }
        } else if (def.type === 'deco_tree') {
             // If it's a deco tree but in the tree category block (mistake?), handle it or do nothing.
             // Actually, this block is 'else if (def.category === 'tree')'.
             // deco_tree is usually category 'decoration'.
             // But if we ever moved them, this logic would be here.
             // For now, let's just make sure they have consistent scaling if we want them to "grow" visually on placement
             // even if they don't produce fruit.
        }

        group.add(treeGroup);
        // Add the entire tree to growParts so it scales from sapling to full tree
        group.userData.growParts.push(treeGroup);
    }
    else if (def.category === 'vehicle') {
        group.userData.isVehicle = true;
        group.userData.wheels = [];
        group.userData.attachments = {}; // header, discs, boomL, boomR, blades

        const bodyColor = def.color;
        
        // Chassis
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), getColorMat(0x333333));
        chassis.position.y = 1;
        group.add(chassis);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const hubMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 });
        
        const createWheel = (x, z, big=false) => {
            const wGroup = new THREE.Group();
            wGroup.position.set(x, 0.8, z);
            
            const tire = new THREE.Mesh(big ? new THREE.CylinderGeometry(1.2, 1.2, 0.8, 16) : wheelGeo, wheelMat);
            tire.rotation.z = Math.PI/2;
            wGroup.add(tire);
            
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(big?0.6:0.4, big?0.6:0.4, big?0.85:0.65, 8), hubMat);
            hub.rotation.z = Math.PI/2;
            wGroup.add(hub);
            
            group.add(wGroup);
            group.userData.wheels.push(wGroup);
        };

        if (type === 'tractor' || type === 'harvester') {
             createWheel(1.4, -1.2, true);
             createWheel(-1.4, -1.2, true);
             createWheel(1.4, 1.5, false);
             createWheel(-1.4, 1.5, false);
             
             // Cab
             const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, 2), getColorMat(bodyColor));
             cab.position.set(0, 2.5, -0.5);
             group.add(cab);
             
             // Window
             const win = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1, 1.5), mats.glass);
             win.position.set(0, 3, -0.5);
             group.add(win);
             
             // Exhaust
             const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5), mats.metalDark);
             pipe.position.set(0.8, 3.5, 1.2);
             group.add(pipe);
             
             // Smoke
             const smoke = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), mats.smoke);
             smoke.position.set(0.8, 4.5, 1.2);
             smoke.name = 'smoke';
             smoke.userData.initialY = 4.5;
             group.add(smoke);

             if (type === 'harvester') {
                 // Header
                 const header = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 1), mats.metal);
                 header.position.set(0, 0.5, 2.5);
                 group.add(header);
                 
                 const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 4.8, 8), mats.paintRed);
                 reel.rotation.z = Math.PI/2;
                 reel.position.set(0, 0.8, 2.8);
                 group.add(reel);
                 group.userData.attachments.header = reel;
             }
        } else if (type === 'pickup_truck') {
             createWheel(1.2, -1.2);
             createWheel(-1.2, -1.2);
             createWheel(1.2, 1.5);
             createWheel(-1.2, 1.5);
             
             const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 4.5), getColorMat(bodyColor));
             body.position.y = 1.2;
             group.add(body);
             
             const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 2), getColorMat(bodyColor));
             cab.position.set(0, 2.2, 0.5);
             group.add(cab);
         } else if (type === 'taxi') {
            // Realistic Taxi Model: more detailed body, windows, lights, mirrors, hubcaps
            createWheel(1.3, -1.3);
            createWheel(-1.3, -1.3);
            createWheel(1.3, 1.6);
            createWheel(-1.3, 1.6);

            // Main body - base platform
            const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.32, 4.6), getColorMat(0x222222));
            base.position.y = 0.9;
            group.add(base);

            // Cabin/body panels (white paint)
            const paintMat = new THREE.MeshStandardMaterial({ color: bodyColor || 0xffffff, roughness: 0.5, metalness: 0.05 });
            const bodyLower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 4.2), paintMat);
            bodyLower.position.y = 1.3;
            group.add(bodyLower);

            // Slight roof raised section
            const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 2.2), paintMat);
            roof.position.set(0, 2.2, -0.2);
            group.add(roof);

            // Windows - front, back, and side windows using glass material
            const glassMat = mats.glass || new THREE.MeshStandardMaterial({ color: 0x81d4fa, roughness: 0.0, metalness: 0.9, transparent: true, opacity: 0.5 });
            const frontWin = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), glassMat);
            frontWin.position.set(0, 2.0, -1.8);
            frontWin.rotation.x = -0.15;
            group.add(frontWin);

            const rearWin = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), glassMat);
            rearWin.position.set(0, 1.9, 1.9);
            rearWin.rotation.x = 0.12;
            group.add(rearWin);

            // Side windows as slightly inset planes
            const sideWinL = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), glassMat);
            sideWinL.position.set(-0.9, 2.0, -0.4);
            sideWinL.rotation.y = Math.PI/2;
            group.add(sideWinL);
            const sideWinR = sideWinL.clone();
            sideWinR.position.x = 0.9; sideWinR.rotation.y = -Math.PI/2;
            group.add(sideWinR);

            // Door handles (small cylinders)
            const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
            const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.25,8), handleMat);
            handleL.rotation.z = Math.PI/2; handleL.position.set(-1.05, 1.55, -0.5); group.add(handleL);
            const handleR = handleL.clone(); handleR.position.set(1.05, 1.55, -0.5); group.add(handleR);

            // Mirrors
            const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4 });
            const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.12,0.02), mirrorMat); mirrorL.position.set(-1.4,2.05,-1.0); group.add(mirrorL);
            const mirrorR = mirrorL.clone(); mirrorR.position.set(1.4,2.05,-1.0); group.add(mirrorR);

            // Headlights (emissive)
            const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 0.9 });
            const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.18), headMat); hl.position.set(-0.6,1.45,-2.35); hl.rotation.y = 0.05; group.add(hl);
            const hr = hl.clone(); hr.position.set(0.6,1.45,-2.35); group.add(hr);

            // Taillights
            const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2b2b, emissive: 0xff2b2b, emissiveIntensity: 0.6 });
            const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.25,0.14), tailMat); tl.position.set(-0.6,1.45,2.35); group.add(tl);
            const tr = tl.clone(); tr.position.set(0.6,1.45,2.35); group.add(tr);

            // Roof sign as a small 3D box with higher-res canvas texture for readability
            try {
                const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
                const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width, canvas.height);
                ctx.fillStyle = '#000000'; ctx.font = 'bold 56px Arial'; ctx.textAlign = 'center';
                ctx.fillText((def && def.signText) ? def.signText : 'Canberra Elite Taxis', canvas.width/2, canvas.height/2 + 16);
                const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true;
                const signBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.28), new THREE.MeshStandardMaterial({ map: tex }));
                signBox.position.set(0, 2.55, -0.2);
                group.add(signBox);
            } catch (e) { console.warn('Taxi roof sign failed', e); }

            // Side door text (on door panels) - larger canvas and geometry for readability
            try {
                const sideCanvas = document.createElement('canvas'); sideCanvas.width = 1024; sideCanvas.height = 256;
                const sctx = sideCanvas.getContext('2d'); sctx.clearRect(0,0,1024,256); sctx.fillStyle = '#000'; sctx.font = 'bold 48px Arial'; sctx.textAlign = 'center';
                sctx.fillText((def && def.signText) ? def.signText : 'Canberra Elite Taxis', 512, 140);
                const sideTex = new THREE.CanvasTexture(sideCanvas); sideTex.needsUpdate = true;
                const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, transparent: true, side: THREE.DoubleSide });
                const doorL = new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.36), sideMat); doorL.position.set(-1.05,1.5,-0.6); doorL.rotation.y = Math.PI/2; group.add(doorL);
                const doorR = doorL.clone(); doorR.rotation.y = -Math.PI/2; doorR.position.x = 1.05; group.add(doorR);
            } catch (e) { console.warn('Taxi door text failed', e); }

            // Checker stripe under windows for taxi look
            const stripeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.6 });
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.15), stripeMat); stripe.position.set(0,1.4,0.6); group.add(stripe);

            // Decorative hubcaps for wheels
            if (group.userData.wheels) {
                group.userData.wheels.forEach(w => {
                    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.05,16), new THREE.MeshStandardMaterial({ color:0xdddddd, metalness:0.8 }));
                    hub.rotation.z = Math.PI/2; hub.position.y = 0.8; w.add(hub);
                });
            }

            group.userData.wheels = group.userData.wheels || [];

            // Make taxi model larger for readability in-game
            try {
                group.scale.set(1.35, 1.35, 1.35);
                group.position.y -= 0.22; // lower slightly to keep wheels near ground after scaling
            } catch (e) { /* ignore if grouping not supported */ }
         } else {
             // Implements, Plows, etc.
             createWheel(1.2, 0);
             createWheel(-1.2, 0);
             
             const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 3), getColorMat(bodyColor));
             frame.position.y = 1.2;
             group.add(frame);
         }
    }
    else if (def.category === 'decoration') {
        if (def.type === 'deco_tree') {
             group.userData.isCrop = true;
             group.userData.isTree = true;
             group.userData.growth = 0;
             group.userData.growParts = [];

             // Tree Group
             const treeGroup = new THREE.Group();
             
             // Random Seed for this tree instance
             const seed = Math.random();
     
             // 1. Trunk (More natural shape)
             const trunkGeo = new THREE.CylinderGeometry(0.2 + seed * 0.15, 0.35 + seed * 0.15, 2.5, 7);
             const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
             const trunk = new THREE.Mesh(trunkGeo, trunkMat);
             trunk.position.y = 1.25; 
             // Slight lean
             trunk.rotation.x = (Math.random() - 0.5) * 0.15;
             trunk.rotation.z = (Math.random() - 0.5) * 0.15;
             treeGroup.add(trunk);
             
             // 2. Branches
             const branchGeo = new THREE.CylinderGeometry(0.08, 0.12, 1.0, 5);
             for(let k=0; k<2; k++) {
                 const branch = new THREE.Mesh(branchGeo, trunkMat);
                 const side = Math.random() > 0.5 ? 1 : -1;
                 branch.position.set(0, 1.5 + Math.random() * 0.6, 0);
                 branch.rotation.z = side * (Math.PI / 3 + Math.random() * 0.2);
                 branch.rotation.y = Math.random() * Math.PI * 2;
                 treeGroup.add(branch);
             }
     
             // 3. Foliage (Cluster of shapes)
             const foliageGroup = new THREE.Group();
             foliageGroup.position.y = 2.4; // Top of trunk
             
             // Color based on type (Pine vs Oak)
             const baseColor = def.name.includes('Pine') ? 0x2e7d32 : 0x4caf50;
             const baseGreen = new THREE.Color(baseColor);
             
             // Create 5-8 foliage blobs
             const numBlobs = 5 + Math.floor(Math.random() * 4);
             const foliageGeo = def.name.includes('Pine') 
                 ? new THREE.ConeGeometry(1.0, 2.0, 7) // Pine shape
                 : new THREE.DodecahedronGeometry(1.0); // Oak shape
             
             for (let j = 0; j < numBlobs; j++) {
                 const blobColor = baseGreen.clone();
                 blobColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
                 
                 const blob = new THREE.Mesh(foliageGeo, new THREE.MeshStandardMaterial({ color: blobColor, roughness: 0.8 }));
                 
                 const s = 0.6 + Math.random() * 0.6;
                 blob.scale.set(s, s, s);
                 
                 if (def.name.includes('Pine')) {
                     // Pine arrangement: Stacked cones
                     blob.position.set(
                         (Math.random() - 0.5) * 0.5,
                         j * 0.8, 
                         (Math.random() - 0.5) * 0.5
                     );
                 } else {
                     // Oak arrangement: Sphere cluster
                     blob.position.set(
                         (Math.random() - 0.5) * 1.8,
                         (Math.random() - 0.1) * 1.5 + 0.5, 
                         (Math.random() - 0.5) * 1.8
                     );
                 }
                 
                 blob.rotation.set(Math.random()*0.2, Math.random()*Math.PI, Math.random()*0.2);
                 foliageGroup.add(blob);
             }
             treeGroup.add(foliageGroup);
             group.add(treeGroup);
             group.userData.growParts.push(treeGroup);
        } else if (def.type === 'deco_fence') {
             // Basic post - detailed version handled by updateConnections
             const pole = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), mats.wood);
             pole.position.y = 2;
             group.add(pole);
        } else if (def.type === 'deco_path' || def.type === 'deco_road') {
            if (!window.sharedStoneTexture) window.sharedStoneTexture = createProceduralTexture('stone');
            const pathMat = new THREE.MeshStandardMaterial({ map: window.sharedStoneTexture, roughness: 0.9, color: def.color });
            const path = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 0.2, TILE_SIZE), pathMat);
            path.position.y = 0.1;
            path.receiveShadow = true;
            group.add(path);
        } else if (def.type === 'deco_water' || type === 'fountain') {
            const basin = new THREE.Mesh(new THREE.CylinderGeometry(4, 3.5, 2, 8), mats.concrete);
            basin.position.y = 1;
            group.add(basin);
            const water = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 1.8, 8), mats.water);
            water.position.y = 1.2;
            water.name = 'water';
            group.add(water);
            if (type === 'fountain') {
                const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 8), mats.concrete);
                spout.position.y = 2;
                group.add(spout);
                // Water spray
                const spray = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshStandardMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.4 }));
                spray.position.y = 4;
                spray.scale.set(1, 0.5, 1);
                group.add(spray);
            } else {
                // Lily pads
                for(let k=0; k<3; k++) {
                     const pad = new THREE.Mesh(new THREE.CircleGeometry(0.6, 5), mats.leaves);
                     pad.rotation.x = -Math.PI/2;
                     pad.position.set((Math.random()-0.5)*3, 2.15, (Math.random()-0.5)*3);
                     group.add(pad);
                }
            }
        } else if (def.type === 'deco_bush') {
             const bush = new THREE.Group();
             const leafMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 1.0 });
             
             // Foliage Clouds
             for(let b=0; b<5; b++) {
                 const blob = new THREE.Mesh(new THREE.SphereGeometry(1.2, 7, 7), leafMat);
                 blob.position.set((Math.random()-0.5)*1.5, 1.0 + Math.random()*0.5, (Math.random()-0.5)*1.5);
                 blob.scale.set(1 + Math.random()*0.5, 0.8 + Math.random()*0.4, 1 + Math.random()*0.5);
                 bush.add(blob);
             }
             group.add(bush);
         } else if (def.type === 'deco_pole') {
             // Streetlight
             const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7, 8), mats.metalDark);
             pole.position.y = 3.5;
             group.add(pole);
             
             const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 0.2), mats.metalDark);
             arm.position.set(0.5, 6.5, 0);
             group.add(arm);
             
             const light = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 8, 1, true), mats.metalDark);
             light.position.set(1.5, 6, 0);
             group.add(light);
             
             const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3), mats.emissive);
             bulb.position.set(1.5, 5.8, 0);
             group.add(bulb);
             
             // PointLight for effect (optional, might be heavy)
             // const pl = new THREE.PointLight(0xffaa00, 0.5, 10);
             // pl.position.set(1.5, 5.5, 0);
             // group.add(pl);
             
         } else if (def.type === 'deco_prop') {
             if (type === 'bench') {
                 const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 2), mats.woodDark);
                 leg1.position.set(-1.5, 0.75, 0);
                 group.add(leg1);
                 const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 2), mats.woodDark);
                 leg2.position.set(1.5, 0.75, 0);
                 group.add(leg2);
                 const seat = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 2), mats.wood);
                 seat.position.set(0, 1.5, 0);
                 group.add(seat);
                 const back = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1, 0.2), mats.wood);
                 back.position.set(0, 2.5, -0.9);
                 back.rotation.x = -0.2;
                 group.add(back);
             } else if (type === 'flower_pot') {
                 const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 1.5, 8), mats.concreteDark);
                 pot.position.y = 0.75;
                 group.add(pot);
                 const soil = new THREE.Mesh(new THREE.CircleGeometry(0.7), mats.dirt);
                 soil.position.set(0, 1.4, 0);
                 soil.rotation.x = -Math.PI/2;
                 group.add(soil);
                 const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), getColorMat(0xe91e63));
                 flower.position.y = 2;
                 group.add(flower);
             } else if (type === 'statue') {
                const base = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mats.concrete);
                base.position.y = 1;
                group.add(base);
                const fig = new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.2, 64, 8), mats.chrome);
                fig.position.y = 3.5;
                fig.rotation.x = -Math.PI/2;
                group.add(fig);
            } else if (type === 'scarecrow') {
                 const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 6), mats.wood);
                 pole.position.y = 3;
                 group.add(pole);
                 
                 const swayPart = new THREE.Group();
                 swayPart.position.y = 4;
                 swayPart.name = 'vane'; // Reuse sway animation
                 
                 const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.8), mats.paintRed); 
                 swayPart.add(body);
                 
                 const arms = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 0.3), mats.wood);
                 arms.position.y = 0.5;
                 swayPart.add(arms);
                 
                 const head = new THREE.Mesh(new THREE.SphereGeometry(0.8), getColorMat(0xd35400));
                 head.position.y = 1.8;
                 swayPart.add(head);

                 // Straw Hat
                 const hatGroup = new THREE.Group();
                 hatGroup.position.y = 2.4;
                 
                 const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16), mats.woodDark);
                 hatGroup.add(brim);
                 
                 const dome = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1, 16), mats.woodDark);
                 dome.position.y = 0.5;
                 hatGroup.add(dome);
                 
                 swayPart.add(hatGroup);
                 
                 group.add(swayPart);
            } else if (type === 'gnome') {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.2, 8), getColorMat(0x3498db));
                body.position.y = 0.6;
                group.add(body);
                
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.35), getColorMat(0xffccaa));
                head.position.y = 1.3;
                group.add(head);
                
                const hat = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.0, 16), getColorMat(0xe74c3c));
                hat.position.y = 1.8;
                group.add(hat);
                
                const beard = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8, 0, Math.PI), getColorMat(0xffffff));
                beard.position.set(0, 1.2, 0.15);
                beard.rotation.x = -0.5;
                group.add(beard);
            } else if (type === 'rock_cluster') {
                for(let k=0; k<3; k++) {
                    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + Math.random()*0.5), mats.concreteDark);
                    r.position.set((Math.random()-0.5)*2, 0.5, (Math.random()-0.5)*2);
                    r.rotation.set(Math.random(), Math.random(), Math.random());
                    group.add(r);
                }
            } else if (type === 'flower_bed') {
                const bed = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 4), mats.dirt);
                bed.position.y = 0.5;
                group.add(bed);
                
                const border = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.2, 4.4), mats.wood);
                border.position.y = 0.4;
                group.add(border);
                
                // Flowers
                for(let k=0; k<10; k++) {
                    const f = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4), getColorMat(Math.random()>0.5 ? 0xff69b4 : 0xffeb3b));
                    f.position.set((Math.random()-0.5)*7, 1.2, (Math.random()-0.5)*3);
                    group.add(f);
                }
            } else if (type === 'golden_cow') {
                const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.2 });
                const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 4), goldMat);
                body.position.y = 2; // On pedestal
                group.add(body);
                
                const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), goldMat);
                head.position.set(0, 3.5, 2.2);
                group.add(head);
                
                const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 2, 8), mats.concrete);
                pedestal.position.y = 1;
                group.add(pedestal);
            } else {
                 // Generic Prop
                 const prop = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), getColorMat(def.color));
                 prop.position.y = 1;
                 group.add(prop);
             }
         } else if (def.type === 'deco_fire') {
            const logs = new THREE.Group();
            for(let k=0; k<3; k++) {
                const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 5), mats.woodDark);
                log.rotation.z = Math.PI/2;
                log.rotation.y = k * (Math.PI/3);
                log.position.y = 0.3;
                logs.add(log);
            }
            group.add(logs);
            
            const fire = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 8), new THREE.MeshStandardMaterial({ color: 0xff5722, emissive: 0xff5722, emissiveIntensity: 2, transparent: true, opacity: 0.8 }));
            fire.position.y = 1.5;
            
            // Simple animation hook
            const anim = new THREE.Group();
            anim.add(fire);
            anim.name = 'fire_anim'; // We can animate scale in render loop if we want
            group.add(anim);
            
            // Light
            const light = new THREE.PointLight(0xff5722, 1, 20);
            light.position.y = 3;
            group.add(light);
         } else if (def.type === 'deco_structure') {
             // Gazebo
             if (type === 'gazebo') {
                 const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.5, 8), mats.wood);
                 floor.position.y = 0.25;
                 group.add(floor);
                 
                 // Pillars
                 for(let k=0; k<8; k++) {
                     const angle = k * (Math.PI/4);
                     const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 8), mats.woodDark);
                     p.position.set(Math.sin(angle)*8, 3, Math.cos(angle)*8);
                     group.add(p);
                 }
                 
                 const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 4, 8), mats.paintRed);
                 roof.position.y = 8;
                 group.add(roof);
             }
         } else if (def.type === 'deco_block') {
              if (type === 'hedge') {
                  const hedge = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 2), mats.leaves);
                  hedge.position.y = 1.5;
                  group.add(hedge);
              } else if (type === 'hay_bale') {
                   const hayMat = new THREE.MeshStandardMaterial({ color: 0xffe082, roughness: 1.0 }); // Corrected hay color
                   const bale = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3, 8), hayMat);
                   bale.rotation.z = Math.PI/2;
                   bale.position.y = 1.5; // Fix: Raise hay bale above ground
                   group.add(bale);
                   
                   // Straps
                   const strap1 = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.05, 4, 8), mats.concreteDark);
                   strap1.rotation.y = Math.PI/2;
                   strap1.position.x = -0.8;
                   strap1.position.y = 1.5;
                   group.add(strap1);
                   const strap2 = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.05, 4, 8), mats.concreteDark);
                   strap2.rotation.y = Math.PI/2;
                   strap2.position.x = 0.8;
                   strap2.position.y = 1.5;
                   group.add(strap2);
              } else {
                  const block = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE*0.9, TILE_SIZE*0.9, TILE_SIZE*0.9), getColorMat(def.color));
                  block.position.y = TILE_SIZE/2;
                  group.add(block);
              }
         } else {
            const prop = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), getColorMat(def.color));
            prop.position.y = 2;
            group.add(prop);
        }
    }

    enableShadows(group);
    return group;
}

function createDetailedBuildingLegacy(type) {
    const group = new THREE.Group();
    const def = BuildingTypes[type];
    group.userData.type = type;
    group.userData.category = def.category;
    
    // Cast shadows for all children helper
    const enableShadows = (g) => {
        g.traverse(o => {
            if(o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });
    };

    if (def.category === 'plot') {
        if (!window.sharedSoilTexture) window.sharedSoilTexture = createProceduralTexture('soil');

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1.0 }); // Darker frame
        const soilMat = new THREE.MeshStandardMaterial({ map: window.sharedSoilTexture, roughness: 1.0 });
        
        const frame = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE * 0.95, 0.6, TILE_SIZE * 0.95), frameMat);
        frame.position.y = 0.3;
        group.add(frame);
        
        const soil = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE * 0.85, 0.4, TILE_SIZE * 0.85), soilMat);
        soil.position.y = 0.5;
        group.add(soil);
        group.userData.isPlot = true;
    } else if (def.category === 'crop' || def.category === 'hidden') {
        group.userData.isCrop = true;
        group.userData.growth = 0;
        group.userData.growParts = [];
        
        if (!window.sharedSoilTexture) window.sharedSoilTexture = createProceduralTexture('soil');

        // Soil Base
        const soil = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE * 0.9, 0.5, TILE_SIZE * 0.9),
            new THREE.MeshStandardMaterial({ map: window.sharedSoilTexture, roughness: 1.0 })
        );
        soil.position.y = 0.25;
        group.add(soil);
        group.userData.soil = soil;

        // Crop Variations - MODERN & HIGH QUALITY
        if (def.type === 'crop_small') {
            // WHEAT / GRASS STYLE
            const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 4);
            const headGeo = new THREE.ConeGeometry(0.15, 0.6, 4);
            const stemMat = new THREE.MeshStandardMaterial({ color: 0x8bc34a, roughness: 1.0 }); // Light Green
            const headMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 1.0 }); // Golden/Orange
            
            for(let i=0; i<12; i++) {
                const cluster = new THREE.Group();
                const x = (Math.random()-0.5)*7;
                const z = (Math.random()-0.5)*7;
                cluster.position.set(x, 0, z);
                
                // Tilt
                cluster.rotation.z = (Math.random()-0.5)*0.5;
                cluster.rotation.x = (Math.random()-0.5)*0.5;

                const stem = new THREE.Mesh(stemGeo, stemMat);
                stem.position.y = 0.75;
                cluster.add(stem);
                
                const head = new THREE.Mesh(headGeo, headMat);
                head.position.y = 1.6;
                cluster.add(head);

                group.add(cluster);
                group.userData.growParts.push(cluster);
            }
        } else if (def.type === 'crop_tall') {
            // CORN STYLE
            const stalkGeo = new THREE.CylinderGeometry(0.1, 0.15, 3.5, 6);
            const leafGeo = new THREE.BoxGeometry(0.8, 0.05, 0.2);
            // r128 doesn't have CapsuleGeometry, use scaled Sphere
            const fruitGeo = new THREE.SphereGeometry(0.3, 8, 8); 
            
            const stalkMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1.0 }); // Dark Green
            const fruitMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 1.0 }); // Yellow/Color
            
            for(let i=0; i<4; i++) {
                const plant = new THREE.Group();
                const x = (Math.random()-0.5)*6;
                const z = (Math.random()-0.5)*6;
                plant.position.set(x, 0, z);

                // Stalk
                const stalk = new THREE.Mesh(stalkGeo, stalkMat);
                stalk.position.y = 1.75;
                plant.add(stalk);

                // Leaves
                for(let j=0; j<4; j++) {
                    const leaf = new THREE.Mesh(leafGeo, stalkMat);
                    leaf.position.y = 1 + j*0.6;
                    leaf.rotation.y = Math.random() * Math.PI;
                    leaf.rotation.z = Math.PI/4;
                    leaf.position.x = 0.2; 
                    plant.add(leaf);
                }

                // Fruit (Cob)
                const fruit = new THREE.Mesh(fruitGeo, fruitMat);
                fruit.scale.y = 2.5; // Elongate to look like a cob
                fruit.position.set(0.2, 2.2, 0);
                fruit.rotation.z = -Math.PI/6;
                plant.add(fruit);

                group.add(plant);
                group.userData.growParts.push(plant);
            }
        } else if (def.type === 'crop_bush') {
            // BERRY BUSH STYLE
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 1.0 });
            const berryMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 1.0 });
            
            for(let i=0; i<3; i++) {
                const bush = new THREE.Group();
                bush.position.set((Math.random()-0.5)*5, 0, (Math.random()-0.5)*5);
                
                // Foliage Clouds
                for(let b=0; b<4; b++) {
                    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.8, 7, 7), leafMat);
                    blob.position.set((Math.random()-0.5)*1, 0.8 + Math.random()*0.8, (Math.random()-0.5)*1);
                    bush.add(blob);
                }

                // Berries
                for(let f=0; f<6; f++) {
                    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.15, 4, 4), berryMat);
                    // Position on surface of a rough sphere
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.random() * Math.PI;
                    const r = 1.1;
                    berry.position.set(
                        r * Math.sin(phi) * Math.cos(theta),
                        1 + r * Math.cos(phi), // Offset y center
                        r * Math.sin(phi) * Math.sin(theta)
                    );
                    bush.add(berry);
                }

                group.add(bush);
                group.userData.growParts.push(bush);
            }
        } else if (def.type === 'crop_ground') {
            // PUMPKIN / MELON STYLE
            const fruitMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 1.0 });
            const stemMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 1.0 });
            
            // Main Fruit
            const fruit = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), fruitMat);
            fruit.scale.set(1, 0.75, 1); // Flatten
            fruit.position.set(0, 1.0, 0);
            group.add(fruit);
            group.userData.growParts.push(fruit);

            // Stem/Vine
            const vinePoints = [];
            for(let v=0; v<=10; v++) {
                vinePoints.push(new THREE.Vector3(Math.sin(v*0.5)*2, 0.1, Math.cos(v*0.5)*2));
            }
            const vineCurve = new THREE.CatmullRomCurve3(vinePoints);
            const vineGeo = new THREE.TubeGeometry(vineCurve, 10, 0.08, 4, false);
            const vine = new THREE.Mesh(vineGeo, stemMat);
            group.add(vine);
            group.userData.growParts.push(vine);

            // Leaves on ground
            const leafGeo = new THREE.CircleGeometry(0.4, 5);
            for(let l=0; l<3; l++) {
                const leaf = new THREE.Mesh(leafGeo, stemMat);
                leaf.rotation.x = -Math.PI/2;
                leaf.position.set((Math.random()-0.5)*3, 0.05, (Math.random()-0.5)*3);
                group.add(leaf);
                group.userData.growParts.push(leaf);
            }
        }

    } else if (def.category === 'tree') {
        group.userData.isCrop = true;
        group.userData.isTree = true;
        group.userData.growth = 0;
        group.userData.growParts = [];

        if (!window.sharedSoilTexture) window.sharedSoilTexture = createProceduralTexture('soil');

        // Tree Group
        const treeGroup = new THREE.Group();
        
        // Random Seed for this tree instance
        const seed = Math.random();

        // 1. Trunk (More natural shape)
        const trunkGeo = new THREE.CylinderGeometry(0.2 + seed * 0.15, 0.35 + seed * 0.15, 2.5, 7);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.25; 
        // Slight lean
        trunk.rotation.x = (Math.random() - 0.5) * 0.15;
        trunk.rotation.z = (Math.random() - 0.5) * 0.15;
        treeGroup.add(trunk);
        
        // 2. Branches
        const branchGeo = new THREE.CylinderGeometry(0.08, 0.12, 1.0, 5);
        for(let k=0; k<2; k++) {
            const branch = new THREE.Mesh(branchGeo, trunkMat);
            const side = Math.random() > 0.5 ? 1 : -1;
            branch.position.set(0, 1.5 + Math.random() * 0.6, 0);
            branch.rotation.z = side * (Math.PI / 3 + Math.random() * 0.2);
            branch.rotation.y = Math.random() * Math.PI * 2;
            treeGroup.add(branch);
        }

        // 3. Foliage (Cluster of shapes)
        const foliageGroup = new THREE.Group();
        foliageGroup.position.y = 2.4; // Top of trunk
        
        // Base green color
        const baseGreen = new THREE.Color(0x4caf50);
        
        // Create 5-8 foliage blobs
        const numBlobs = 5 + Math.floor(Math.random() * 4);
        const foliageGeo = new THREE.DodecahedronGeometry(1.0); // Base geometry
        
        for (let j = 0; j < numBlobs; j++) {
            // Vary color slightly
            const blobColor = baseGreen.clone();
            blobColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15); // Lightness variation
            
            const blob = new THREE.Mesh(foliageGeo, new THREE.MeshStandardMaterial({ color: blobColor, roughness: 0.8 }));
            
            // Randomize scale
            const s = 0.6 + Math.random() * 0.6;
            blob.scale.set(s, s, s);
            
            // Randomize position in a sphere-like cluster
            blob.position.set(
                (Math.random() - 0.5) * 1.8,
                (Math.random() - 0.1) * 1.5 + 0.5, 
                (Math.random() - 0.5) * 1.8
            );
            
            // Random rotation
            blob.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            
            foliageGroup.add(blob);
        }
        treeGroup.add(foliageGroup);

        // 4. Fruits (Scattered on foliage)
        const fruitColor = def.color || 0xd32f2f;
        const fruitGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const fruitMat = new THREE.MeshStandardMaterial({ color: fruitColor, roughness: 0.5 });
        
        const numFruits = 5 + Math.floor(Math.random() * 4);
        
        for(let i=0; i < numFruits; i++) {
            const fruit = new THREE.Mesh(fruitGeo, fruitMat);
            
            // Place randomly within the foliage volume, but push outwards
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 1.2 + Math.random() * 0.6; // Distance from center of foliage group
            
            // Foliage center is around y=2.4 + 1.0 = 3.4
            fruit.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta) + 3.2, 
                r * Math.cos(phi)
            );
            
            // Add to treeGroup
            treeGroup.add(fruit);
            group.userData.growParts.push(fruit);
        }

        group.add(treeGroup);

    } else if (def.category === 'building') {
        if (def.type === 'building_animal') {
            if (type === 'duck_pond') {
                 // Pond visual
                 const pond = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x3498db, roughness: 0.1, metalness: 0.1 }));
                 pond.position.y = 0.2;
                 group.add(pond);
                 // Reeds
                 for(let i=0; i<8; i++) {
                     const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5), new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 1.0 }));
                     reed.position.set(Math.cos(i)*4, 0.75, Math.sin(i)*4);
                     group.add(reed);
                     const top = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5), new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 1.0 }));
                     top.position.set(Math.cos(i)*4, 1.5, Math.sin(i)*4);
                     group.add(top);
                 }
                 // Small duck house
                 const hut = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 }));
                 hut.position.set(0, 1, -2);
                 group.add(hut);
                 const roof = new THREE.Mesh(new THREE.ConeGeometry(2, 1.5, 4), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 }));
                 roof.position.set(0, 2.75, -2);
                 roof.rotation.y = Math.PI/4;
                 group.add(roof);
                 return group; 
            } else if (type === 'barn') {
                // Classic Red Barn
                const barnWidth = 7;
                const barnDepth = 7;
                const barnHeight = 5;
                
                // Main Body
                const body = new THREE.Mesh(new THREE.BoxGeometry(barnWidth, barnHeight, barnDepth), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7 })); // Red
                body.position.y = barnHeight / 2;
                group.add(body);
                
                // Roof (Gambrel-ish approximation using scaling)
                const roof = new THREE.Mesh(new THREE.CylinderGeometry(barnWidth/2, barnWidth/2, barnDepth, 3), new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 })); // Dark Brown
                roof.rotation.z = Math.PI/2;
                roof.scale.y = 0.6; // Flatten
                roof.position.y = barnHeight + 1.5;
                group.add(roof);

                // Big Doors
                const door = new THREE.Mesh(new THREE.BoxGeometry(3, 3.5, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
                door.position.set(0, 1.75, barnDepth/2 + 0.1);
                
                // Cross beams on door
                const x1 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xbdc3c7, roughness: 0.5 }));
                x1.rotation.z = Math.PI/4;
                const x2 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xbdc3c7, roughness: 0.5 }));
                x2.rotation.z = -Math.PI/4;
                door.add(x1); door.add(x2);
                group.add(door);

                // Hay Loft Window
                const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.2 }));
                win.position.set(0, barnHeight + 1, barnDepth/2 + 0.1);
                group.add(win);
                
                return group;
            } else if (type === 'coop') {
                // Raised Chicken Coop
                // Legs
                const legGeo = new THREE.BoxGeometry(0.2, 2, 0.2);
                const legMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 1.0 });
                const l1 = new THREE.Mesh(legGeo, legMat); l1.position.set(-2, 1, -2); group.add(l1);
                const l2 = new THREE.Mesh(legGeo, legMat); l2.position.set(2, 1, -2); group.add(l2);
                const l3 = new THREE.Mesh(legGeo, legMat); l3.position.set(-2, 1, 2); group.add(l3);
                const l4 = new THREE.Mesh(legGeo, legMat); l4.position.set(2, 1, 2); group.add(l4);
                
                // House
                const house = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 5), new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.6 })); // Yellowish
                house.position.y = 4;
                group.add(house);
                
                // Roof
                const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 2, 4), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.8 }));
                roof.position.y = 7;
                roof.rotation.y = Math.PI/4;
                group.add(roof);
                
                // Ramp
                const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 4), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 1.0 }));
                ramp.position.set(0, 2, 3.5);
                ramp.rotation.x = -Math.PI/4;
                group.add(ramp);
                
                return group;
            } else if (type === 'stable') {
                // Long Stable Building
                const body = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 6), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 }));
                body.position.y = 2;
                group.add(body);
                
                const roof = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 8.5, 3), new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 }));
                roof.rotation.z = Math.PI/2;
                roof.position.y = 4.5;
                roof.scale.y = 0.5;
                group.add(roof);
                
                // Stall Doors
                const doorGeo = new THREE.BoxGeometry(1.5, 2.5, 0.1);
                const doorMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8 }); // Dark
                
                const d1 = new THREE.Mesh(doorGeo, doorMat); d1.position.set(-2, 1.25, 3.1); group.add(d1);
                const d2 = new THREE.Mesh(doorGeo, doorMat); d2.position.set(2, 1.25, 3.1); group.add(d2);
                
                // Horseshoes above doors?
                const shoe = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.4, metalness: 0.8 }));
                shoe.rotation.z = Math.PI;
                
                const s1 = shoe.clone(); s1.position.set(-2, 3, 3.1); group.add(s1);
                const s2 = shoe.clone(); s2.position.set(2, 3, 3.1); group.add(s2);
                
                return group;
            }

            const fenceColor = (type === 'sheep_pasture') ? 0xffffff : 0x8b4513;
            const fenceMat = new THREE.MeshStandardMaterial({ color: fenceColor, roughness: 0.9 });
            const postGeo = new THREE.BoxGeometry(0.5, 3, 0.5);
            for(let x=-4; x<=4; x+=2) {
                const post1 = new THREE.Mesh(postGeo, fenceMat); post1.position.set(x, 1.5, -4); group.add(post1);
                const post2 = new THREE.Mesh(postGeo, fenceMat); post2.position.set(x, 1.5, 4); group.add(post2);
            }
            for(let z=-4; z<=4; z+=2) {
                const post1 = new THREE.Mesh(postGeo, fenceMat); post1.position.set(-4, 1.5, z); group.add(post1);
                const post2 = new THREE.Mesh(postGeo, fenceMat); post2.position.set(4, 1.5, z); group.add(post2);
            }
            const railGeo = new THREE.BoxGeometry(8, 0.3, 0.3);
            const rail1 = new THREE.Mesh(railGeo, fenceMat); rail1.position.set(0, 2.4, -4); group.add(rail1);
            const rail2 = new THREE.Mesh(railGeo, fenceMat); rail2.position.set(0, 1.4, -4); group.add(rail2);
            const rail3 = new THREE.Mesh(railGeo, fenceMat); rail3.position.set(0, 2.4, 4); group.add(rail3);
            const rail4 = new THREE.Mesh(railGeo, fenceMat); rail4.position.set(0, 1.4, 4); group.add(rail4);
            const railSideGeo = new THREE.BoxGeometry(0.3, 0.3, 8);
            const rail5 = new THREE.Mesh(railSideGeo, fenceMat); rail5.position.set(-4, 2.4, 0); group.add(rail5);
            const rail6 = new THREE.Mesh(railSideGeo, fenceMat); rail6.position.set(-4, 1.4, 0); group.add(rail6);
            const rail7 = new THREE.Mesh(railSideGeo, fenceMat); rail7.position.set(4, 2.4, 0); group.add(rail7);
            const rail8 = new THREE.Mesh(railSideGeo, fenceMat); rail8.position.set(4, 1.4, 0); group.add(rail8);
            
            if (type === 'pig_pen') {
                 // Mud
                 const mud = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 7), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1.0 }));
                 mud.position.y = 0.1;
                 group.add(mud);
            } else if (type === 'goat_yard') {
                // Climbing Rocks
                const rockGeo = new THREE.DodecahedronGeometry(1);
                const rockMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 1.0 });
                
                const r1 = new THREE.Mesh(rockGeo, rockMat); r1.position.set(2, 0.5, 2); group.add(r1);
                const r2 = new THREE.Mesh(rockGeo, rockMat); r2.position.set(2.5, 1, 1.5); r2.scale.set(0.8, 0.8, 0.8); group.add(r2);
                const r3 = new THREE.Mesh(rockGeo, rockMat); r3.position.set(-2, 0.8, -2); r3.scale.set(1.2, 0.6, 1.2); group.add(r3);
            }

            const hut = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 }));
            hut.position.set(0, 2.5, 0);
            group.add(hut);
            const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 }));
            roof.position.set(0, 6.5, 0);
            roof.rotation.y = Math.PI/4;
            group.add(roof);

        } else if (def.type === 'building_factory' || def.type === 'building_shop') {
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(8, 8, 8),
                new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.2 })
            );
            body.position.y = 4;
            group.add(body);

            const roof = new THREE.Mesh(
                new THREE.CylinderGeometry(0, 6, 4, 4, 1),
                new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.5, metalness: 0.2 })
            );
            roof.rotation.y = Math.PI/4;
            roof.position.y = 9;
            group.add(roof);

            if (def.type === 'building_factory' && type !== 'warehouse') {
                const chim = new THREE.Mesh(new THREE.CylinderGeometry(1,1,6), new THREE.MeshStandardMaterial({color:0x7f8c8d, roughness: 0.8}));
                chim.position.set(3, 8, 3);
                group.add(chim);
                
                // Smoke for factories
                const smoke = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8), new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.5, roughness: 1.0 }));
                smoke.position.set(3, 11.5, 3);
                group.add(smoke);

                for (let i=-3; i<=3; i+=2) {
                    const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.2, metalness: 0.8 }));
                    win.position.set(i, 5, 4.1);
                    group.add(win);
                }
            } else if (type === 'warehouse') {
                 // Warehouse specific
                 // No chimney, maybe large garage door
                 const door = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.2), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 }));
                 door.position.set(0, 2, 4.1);
                 group.add(door);
                 
                 // Crates stacked outside
                 const crateGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
                 const crateMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
                 
                 const c1 = new THREE.Mesh(crateGeo, crateMat); c1.position.set(3, 0.75, 4.5); group.add(c1);
                 const c2 = new THREE.Mesh(crateGeo, crateMat); c2.position.set(3, 2.25, 4.5); group.add(c2);
                 const c3 = new THREE.Mesh(crateGeo, crateMat); c3.position.set(1.5, 0.75, 5); c3.rotation.y=0.5; group.add(c3);
            } else {
                const awning = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 3), new THREE.MeshStandardMaterial({color:0xe74c3c, roughness: 0.9}));
                awning.position.set(0, 5, 4);
                awning.rotation.x = 0.5;
                group.add(awning);
                for (let i=-3; i<=3; i+=2) {
                    const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.2, metalness: 0.8 }));
                    win.position.set(i, 4, 4.1);
                    group.add(win);
                }
                const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 }));
                pole.position.set(-3, 3.2, 4.2);
                const signColors = {
                    market: 0xf1c40f,
                    bakery: 0xe67e22,
                    dairy: 0x3498db,
                    grill: 0xe74c3c,
                    florist: 0xe91e63,
                    jam_maker: 0xe91e63,
                    sugar_mill: 0x95a5a6,
                    textile_mill: 0x8e44ad
                };
                const sign = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.2), new THREE.MeshStandardMaterial({ color: signColors[type] || 0xf1c40f, roughness: 0.6 }));
                sign.position.set(-1.5, 4.1, 4.3);
                group.add(pole); group.add(sign);
            }

            // --- SPECIALIZED PROPS BASED ON NAME ---
            if (type === 'bakery') {
                // Giant Baguette Sign
                const bread = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.4 }));
                bread.rotation.z = Math.PI / 4;
                bread.position.set(0, 7, 4.3);
                group.add(bread);
                // Bread Racks
                const rack = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 }));
                rack.position.set(3, 1, 4.5);
                group.add(rack);
            } else if (type === 'dairy') {
                // Milk Cans
                const canGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 8);
                const canMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.3, metalness: 0.3 });
                const can1 = new THREE.Mesh(canGeo, canMat); can1.position.set(3, 0.75, 4.5); group.add(can1);
                const can2 = new THREE.Mesh(canGeo, canMat); can2.position.set(1.5, 0.75, 4.8); group.add(can2);
                // Cow pattern spots on roof?
                // Maybe just a milk bottle on top
                const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }));
                bottle.position.set(0, 11, 0);
                group.add(bottle);
            } else if (type === 'popcorn') {
                // Popcorn Bucket on Roof
                const bucket = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1, 2, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
                bucket.position.set(0, 11, 0);
                group.add(bucket);
                // Stripes
                for(let i=0; i<4; i++) {
                    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.2), new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.5 }));
                    stripe.position.set(Math.cos(i*Math.PI/2)*1.2, 11, Math.sin(i*Math.PI/2)*1.2);
                    group.add(stripe);
                }
                // Popcorn kernels
                for(let i=0; i<10; i++) {
                    const corn = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.8 }));
                    corn.position.set((Math.random()-0.5)*1.5, 12.2, (Math.random()-0.5)*1.5);
                    group.add(corn);
                }
            } else if (type === 'ice_cream') {
                // Giant Cone
                const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 8), new THREE.MeshStandardMaterial({ color: 0xf39c12, roughness: 0.6 }));
                cone.rotation.z = Math.PI;
                cone.position.set(0, 11, 0);
                group.add(cone);
                const scoop = new THREE.Mesh(new THREE.SphereGeometry(1.2), new THREE.MeshStandardMaterial({ color: 0xffcdd2, roughness: 0.4 })); // Pink
                scoop.position.set(0, 12.5, 0);
                group.add(scoop);
            } else if (type === 'grill') {
                // Grill Unit
                const grill = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.5, 16), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.6 }));
                grill.position.set(2.5, 0.75, 4.5);
                group.add(grill);
                const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.3, metalness: 0.7 }));
                lid.position.set(2.5, 1.5, 4.5);
                group.add(lid);
                // Smoke
                const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshStandardMaterial({ color: 0x95a5a6, transparent:true, opacity:0.5, roughness: 1.0 }));
                smoke.position.set(2.5, 2.5, 4.5);
                group.add(smoke);
            } else if (type === 'sugar_mill') {
                // Sugar Cane Stacks
                const caneGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 6);
                const caneMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.6 });
                for(let i=0; i<5; i++) {
                    const cane = new THREE.Mesh(caneGeo, caneMat);
                    cane.position.set(3 + (Math.random()-0.5), 1, 4 + (Math.random()-0.5));
                    cane.rotation.z = (Math.random()-0.5)*0.2;
                    group.add(cane);
                }
            } else if (type === 'textile_mill') {
                // Fabric Rolls
                const rollGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.5, 12);
                const colors = [0xe74c3c, 0x3498db, 0xf1c40f];
                for(let i=0; i<3; i++) {
                    const roll = new THREE.Mesh(rollGeo, new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.8 }));
                    roll.rotation.z = Math.PI/2;
                    roll.position.set(2, 0.4 + i*0.5, 4.5);
                    group.add(roll);
                }
            } else if (type === 'coffee_kiosk') {
                 // Giant Cup
                 const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1, 1.5, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
                 cup.position.set(0, 11, 0);
                 group.add(cup);
                 const coffee = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 }));
                 coffee.position.set(0, 11.6, 0);
                 group.add(coffee);
                 // Steam
                 const steam = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5), new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent:true, opacity:0.4, roughness: 1.0 }));
                 steam.position.set(0, 12.5, 0);
                 group.add(steam);
            } else if (type === 'juice_press') {
                // Giant Orange
                const orange = new THREE.Mesh(new THREE.SphereGeometry(1.5), new THREE.MeshStandardMaterial({ color: 0xff9800, roughness: 0.4 }));
                orange.position.set(0, 11, 0);
                group.add(orange);
                const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1), new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.6 }));
                leaf.position.set(0.5, 12.3, 0);
                leaf.rotation.z = 0.5;
                group.add(leaf);
            } else if (type === 'florist') {
                // Flowers in front
                for(let i=-2; i<=2; i+=2) {
                    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.9 }));
                    pot.position.set(i, 0.25, 5);
                    group.add(pot);
                    const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), new THREE.MeshStandardMaterial({ color: Math.random()>0.5?0xe91e63:0xf1c40f, roughness: 0.5 }));
                    flower.position.set(i, 0.6, 5);
                    group.add(flower);
                }
            } else if (type === 'jam_maker') {
                // Giant Jam Jar
                const jar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.5, 12), new THREE.MeshStandardMaterial({ color: 0xe91e63, transparent: true, opacity: 0.8, roughness: 0.1 }));
                jar.position.set(0, 11, 0);
                group.add(jar);
                const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
                lid.position.set(0, 11.8, 0);
                group.add(lid);
            } else if (type === 'market') {
                // Veggie Crates
                const crateGeo = new THREE.BoxGeometry(1.2, 0.8, 1.2);
                const wood = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
                
                const c1 = new THREE.Mesh(crateGeo, wood); c1.position.set(2, 0.5, 4.5); group.add(c1);
                const c2 = new THREE.Mesh(crateGeo, wood); c2.position.set(-2, 0.5, 4.5); group.add(c2);
                
                // Carrot Sign
                const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.6 }));
                carrot.rotation.x = Math.PI; carrot.position.set(0, 7, 4.3); group.add(carrot);
                const greens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0, 0.5), new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.8 }));
                greens.position.set(0, 7.8, 4.3); group.add(greens);
            }
        } else if (type === 'main_house') {
            // Use building.level when available (upgrade uses building data), else fallback to global state
            let level = 1;
            if (building && building.level) level = building.level;
            else if (gameState && gameState.mainHouseLevel) level = gameState.mainHouseLevel;

            const isMansion = level >= 5;

            // Base Config (tweak per-level colors/sizes)
            const baseSize = isMansion ? 12 : (level >= 3 ? 11 : 10);
            const floorHeight = 5;
            const roofColor = isMansion ? 0x8e44ad : (level >= 4 ? 0x34495e : 0x2c3e50);
            const bodyColor = isMansion ? 0xfff8e1 : (level === 2 ? 0xfffbe6 : (level >= 4 ? 0xf0e68c : 0xffffff));

            // Foundation
            const foundation = new THREE.Mesh(new THREE.BoxGeometry(baseSize + 1, 1, baseSize + 1), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.9 }));
            foundation.position.y = 0.5;
            group.add(foundation);

            // First and second floors
            const floor1 = new THREE.Mesh(new THREE.BoxGeometry(baseSize, floorHeight, baseSize), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6 }));
            floor1.position.y = 1 + floorHeight/2; group.add(floor1);
            const floor2 = new THREE.Mesh(new THREE.BoxGeometry(baseSize * (level >= 4 ? 0.95 : 0.9), floorHeight, baseSize * (level >=4 ? 0.95 : 0.9)), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6 }));
            floor2.position.y = 1 + floorHeight + floorHeight/2; group.add(floor2);

            // Roof (shape varies by level)
            const roofHeight = isMansion ? 6 : (level >= 3 ? 5.5 : 5);
            let roof;
            if (level >= 6) {
                roof = new THREE.Mesh(new THREE.BoxGeometry(baseSize * 0.9, roofHeight, baseSize * 0.9), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.6 }));
                roof.rotation.x = 0.2;
            } else {
                const roofGeo = new THREE.ConeGeometry(baseSize * 0.8, roofHeight, 4);
                roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.6 }));
                roof.rotation.y = Math.PI/4;
            }
            roof.position.y = 1 + floorHeight * 2 + roofHeight/2; group.add(roof);

            // Porch (level >=2 adds more elaborate porch)
            if (level >= 2) {
                const porchDepth = 3 + (level >= 4 ? 1 : 0);
                const porch = new THREE.Mesh(new THREE.BoxGeometry(baseSize + 2, 0.5, porchDepth), new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 }));
                porch.position.set(0, 1, baseSize/2 + porchDepth/2 - 0.5); group.add(porch);
                const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(baseSize + 2.2, 0.3, porchDepth + 0.5), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.6 }));
                porchRoof.position.set(0, 4, baseSize/2 + porchDepth/2); porchRoof.rotation.x = 0.1; group.add(porchRoof);

                // Pillars and rail for nicer porch on higher levels
                for (let i = -1; i <= 1; i += 2) {
                    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
                    pillar.position.set(i * baseSize/2, 2.5, baseSize/2 + porchDepth/2); group.add(pillar);
                }
                if (level >= 4) {
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(baseSize + 1.2, 0.15, 0.15), new THREE.MeshStandardMaterial({ color: 0xffffff }));
                    rail.position.set(0, 3.2, baseSize/2 + porchDepth/2 - 0.35); group.add(rail);
                }
            }

            // Turret / Tower for level 3+
            if (level >= 3 && level < 5) {
                const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 8, 10), new THREE.MeshStandardMaterial({ color: bodyColor }));
                turret.position.set(-baseSize/2 - 1.5, 4.5, -baseSize/4); group.add(turret);
                const tRoof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.5, 10), new THREE.MeshStandardMaterial({ color: roofColor }));
                tRoof.position.set(-baseSize/2 - 1.5, 9.2, -baseSize/4); group.add(tRoof);
            }

            // Mansion Extras: Side Wings (level 5+ keeps original mansion extras)
            if (isMansion) {
                const wingL = new THREE.Mesh(new THREE.BoxGeometry(5, 8, 6), new THREE.MeshStandardMaterial({ color: bodyColor }));
                wingL.position.set(-baseSize/2 - 2.5, 5, 0); group.add(wingL);
                const wingRoofL = new THREE.Mesh(new THREE.ConeGeometry(4, 4, 4), new THREE.MeshStandardMaterial({ color: roofColor }));
                wingRoofL.position.set(-baseSize/2 - 2.5, 11, 0); wingRoofL.rotation.y = Math.PI/4; group.add(wingRoofL);
                const wingR = new THREE.Mesh(new THREE.BoxGeometry(5, 8, 6), new THREE.MeshStandardMaterial({ color: bodyColor }));
                wingR.position.set(baseSize/2 + 2.5, 5, 0); group.add(wingR);
                const wingRoofR = new THREE.Mesh(new THREE.ConeGeometry(4, 4, 4), new THREE.MeshStandardMaterial({ color: roofColor }));
                wingRoofR.position.set(baseSize/2 + 2.5, 11, 0); wingRoofR.rotation.y = Math.PI/4; group.add(wingRoofR);
            }

            // Windows and door (tint varies slightly by level)
            const winMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, metalness: 0.5, roughness: 0.2 });
            const winGeo = new THREE.BoxGeometry(1.5, 2, 0.2);
            const winCountOffset = level >= 4 ? 0.5 : 0;
            const w1 = new THREE.Mesh(winGeo, winMat); w1.position.set(-2.5, 3.5, baseSize/2 + 0.1); group.add(w1);
            const w2 = new THREE.Mesh(winGeo, winMat); w2.position.set(2.5, 3.5, baseSize/2 + 0.1); group.add(w2);
            const w3 = new THREE.Mesh(winGeo, winMat); w3.position.set(-2 + winCountOffset, 1 + floorHeight + 2.5, baseSize/2 * 0.9 + 0.1); group.add(w3);
            const w4 = new THREE.Mesh(winGeo, winMat); w4.position.set(2 - winCountOffset, 1 + floorHeight + 2.5, baseSize/2 * 0.9 + 0.1); group.add(w4);
            const w5 = new THREE.Mesh(winGeo, winMat); w5.position.set(0, 1 + floorHeight + 2.5, baseSize/2 * 0.9 + 0.1); group.add(w5);

            const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.2), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
            door.position.set(0, 2.5, baseSize/2 + 0.1); group.add(door);

            // Chimney + smoke on most levels
            const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5, 1.5), new THREE.MeshStandardMaterial({ color: 0x7f8c8d }));
            chimney.position.set(3, 1 + floorHeight * 2 + 2, -2); group.add(chimney);
            const smoke = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8), new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.6 }));
            smoke.position.set(3, 1 + floorHeight * 2 + 5, -2); group.add(smoke);

            // Level Badge
            if (level > 1) {
                const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 5), new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.8 }));
                badge.rotation.x = Math.PI/2;
                badge.position.set(0, 1 + floorHeight + 3, baseSize/2 * 0.9 + 0.15); group.add(badge);
            }

            // Level 6+ garden/fence decorations
            if (level >= 6) {
                const fence = new THREE.Group();
                for (let i = -1; i <= 1; i++) {
                    const f = new THREE.Mesh(new THREE.BoxGeometry(baseSize + 3, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
                    f.position.set(0, 0.6, i * (baseSize/2 + 1.2)); fence.add(f);
                }
                fence.position.y = 0; group.add(fence);
                for (let i = 0; i < 4; i++) {
                    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 6), new THREE.MeshStandardMaterial({ color: 0xeeeeaa }));
                    lamp.position.set((i - 1.5) * 2, 1.1, baseSize/2 + 1.8); group.add(lamp);
                }
            }

            // Keep a modest overall scale so it fits existing layout
            group.scale.set(1.5, 1.5, 1.5);


        } else if (def.type === 'building_tower') {
            const tower = new THREE.Mesh(
                new THREE.CylinderGeometry(3, 3, 12, 8),
                new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 })
            );
            tower.position.y = 6;
            group.add(tower);
            const top = new THREE.Mesh(
                new THREE.ConeGeometry(3.5, 4, 8),
                new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.6 })
            );
            top.position.y = 14;
            group.add(top);

            if (type === 'mill') {
                 // Windmill Blades
                 const bladeGroup = new THREE.Group();
                 bladeGroup.name = 'blades';
                 bladeGroup.position.set(0, 12, 6); // Moved further out (z=6) to ensure no clipping
                 
                 // Hub/Shaft (Thicker and longer to reach building)
                 const center = new THREE.Mesh(
                     new THREE.CylinderGeometry(0.8, 0.8, 4.5, 8), 
                     new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 })
                 );
                 center.rotation.x = Math.PI/2;
                 center.position.z = -1.5; // Push back towards tower to connect
                 bladeGroup.add(center);

                 const bladeGeo = new THREE.BoxGeometry(1.5, 11, 0.2); // Longer blades
                 const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
                 
                 for(let i=0; i<4; i++) {
                     const blade = new THREE.Mesh(bladeGeo, bladeMat);
                     blade.rotation.z = i * (Math.PI/2);
                     blade.position.z = 0.8; // In front of hub
                     bladeGroup.add(blade);
                 }
                 group.add(bladeGroup);
            } else if (type === 'water_tower') {
                 // Pipe
                 const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 12, 8), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.5, metalness: 0.5 }));
                 pipe.position.set(2.5, 6, 0);
                 group.add(pipe);
            } else if (type === 'silo') {
                 // Ladder
                 const ladder = new THREE.Mesh(new THREE.BoxGeometry(1.5, 11, 0.2), new THREE.MeshStandardMaterial({ color: 0x555555, transparent: true, opacity: 0.5, roughness: 0.5, metalness: 0.6 }));
                 ladder.position.set(0, 6, 3.1);
                 
                 // Rungs
                 for(let i=0; i<10; i++) {
                     const rung = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.7 }));
                     rung.position.set(0, 1 + i, 3.1);
                     group.add(rung);
                 }
            } else {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.08, 8, 24), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 }));
                ring.position.y = 8;
                ring.rotation.x = Math.PI/2;
                group.add(ring);
            }
        } else if (def.type === 'building_tech') {
            if (type === 'solar') {
                // Per-level solar panel design
                let solarLevel = 1;
                if (building && building.level) {
                    solarLevel = building.level;
                }
                let panelWidth = 6, panelLength = 4, hasFrame = false, hasInverter = false, panelCount = 1, hasMonitor = false;
                let poleColor = 0x7f8c8d, panelColor = 0x2c3e50, cellColor = 0x3498db;
                if (solarLevel === 2) {
                    panelWidth = 7; panelLength = 5; hasFrame = true; hasInverter = true; panelCount = 1;
                    poleColor = 0xff7043; panelColor = 0xff7043; cellColor = 0x81c784;
                } else if (solarLevel === 3) {
                    panelWidth = 8; panelLength = 6; hasFrame = true; hasInverter = true; panelCount = 2; hasMonitor = true;
                    poleColor = 0x388e3c; panelColor = 0x388e3c; cellColor = 0xffeb3b;
                } else if (solarLevel >= 4) {
                    panelWidth = 9; panelLength = 7; hasFrame = true; hasInverter = true; panelCount = 3; hasMonitor = true;
                    poleColor = 0x512da8; panelColor = 0x512da8; cellColor = 0xffc107;
                }
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 8), new THREE.MeshStandardMaterial({ color: poleColor, roughness: 0.5, metalness: 0.5 }));
                pole.position.y = 1.5;
                group.add(pole);
                
                // Main panel
                const panel = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, 0.2, panelLength), new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.2, metalness: 0.8 }));
                panel.position.set(0, 3, 0);
                panel.rotation.x = -Math.PI/6;
                group.add(panel);
                
                // Cells visual
                const cells = new THREE.Mesh(new THREE.BoxGeometry(panelWidth-0.4, 0.25, panelLength-0.4), new THREE.MeshStandardMaterial({ color: cellColor, roughness: 0.1, metalness: 0.9 }));
                cells.position.set(0, 3, 0);
                cells.rotation.x = -Math.PI/6;
                group.add(cells);
                
                // Additional panels (level 3+)
                if (panelCount >= 2) {
                    const panel2 = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, 0.2, panelLength), new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.2, metalness: 0.8 }));
                    panel2.position.set(-panelWidth-0.5, 3, 0);
                    panel2.rotation.x = -Math.PI/6;
                    group.add(panel2);
                    const cells2 = new THREE.Mesh(new THREE.BoxGeometry(panelWidth-0.4, 0.25, panelLength-0.4), new THREE.MeshStandardMaterial({ color: cellColor, roughness: 0.1, metalness: 0.9 }));
                    cells2.position.set(-panelWidth-0.5, 3, 0);
                    cells2.rotation.x = -Math.PI/6;
                    group.add(cells2);
                }
                // Third panel (level 4+)
                if (panelCount >= 3) {
                    const panel3 = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, 0.2, panelLength), new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.2, metalness: 0.8 }));
                    panel3.position.set(panelWidth+0.5, 3, 0);
                    panel3.rotation.x = -Math.PI/6;
                    group.add(panel3);
                    const cells3 = new THREE.Mesh(new THREE.BoxGeometry(panelWidth-0.4, 0.25, panelLength-0.4), new THREE.MeshStandardMaterial({ color: cellColor, roughness: 0.1, metalness: 0.9 }));
                    cells3.position.set(panelWidth+0.5, 3, 0);
                    cells3.rotation.x = -Math.PI/6;
                    group.add(cells3);
                }
                
                // Frame (level 2+)
                if (hasFrame) {
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(panelWidth+0.2, 0.15, panelLength+0.2), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.4 }));
                    frame.position.set(0, 3.1, 0);
                    frame.rotation.x = -Math.PI/6;
                    group.add(frame);
                }
                
                // Inverter box (level 2+)
                if (hasInverter) {
                    const inverter = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.5, metalness: 0.3 }));
                    inverter.position.set(0, 0.5, panelLength/2+1);
                    group.add(inverter);
                }
                
                // Monitor screen (level 3+)
                if (hasMonitor) {
                    const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x2196f3, roughness: 0.2, transparent: true, opacity: 0.7 }));
                    monitor.position.set(-panelWidth/2-1, 1.5, panelLength/2+1);
                    group.add(monitor);
                }
                
            } else if (type === 'generator') {
                // Per-level generator design
                let genLevel = 1;
                if (building && building.level) {
                    genLevel = building.level;
                }
                let baseSize = 4, baseHeight = 3, hasExpansion = false, hasMuffler = false, hasControl = false, fanCount = 1;
                let baseColor = 0xe74c3c, panelColor = 0x2196f3;
                if (genLevel === 2) {
                    baseSize = 5; baseHeight = 4; hasExpansion = true; baseColor = 0xff7043; panelColor = 0x81c784;
                } else if (genLevel === 3) {
                    baseSize = 6; baseHeight = 5; hasExpansion = true; hasMuffler = true; hasControl = true; fanCount = 2; baseColor = 0x388e3c; panelColor = 0xffd54f;
                } else if (genLevel >= 4) {
                    baseSize = 7; baseHeight = 6; hasExpansion = true; hasMuffler = true; hasControl = true; fanCount = 3; baseColor = 0x512da8; panelColor = 0xffeb3b;
                }
                const base = new THREE.Mesh(new THREE.BoxGeometry(baseSize, baseHeight, 3), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.7 }));
                base.position.y = baseHeight/2;
                group.add(base);
                
                // Front Fan/Vent
                const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 }));
                vent.rotation.x = Math.PI/2;
                vent.position.set(0, baseHeight/2, 1.6);
                group.add(vent);
                
                // Exhaust Pipe
                const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 8), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.5, metalness: 0.7 }));
                pipe.position.set(1, baseHeight+1.5, -0.5);
                group.add(pipe);
                
                // Smoke Puff
                const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4), new THREE.MeshStandardMaterial({ color: 0x555555, transparent:true, opacity:0.6, roughness: 1.0 }));
                puff.position.set(1.2, baseHeight+2.5, -0.5);
                group.add(puff);
                
                // Additional vent (level 3+)
                if (fanCount >= 2) {
                    const vent2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 }));
                    vent2.rotation.x = Math.PI/2;
                    vent2.position.set(-1.5, baseHeight/2, 1.6);
                    group.add(vent2);
                }
                // Third vent (level 4+)
                if (fanCount >= 3) {
                    const vent3 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 }));
                    vent3.rotation.x = Math.PI/2;
                    vent3.position.set(1.5, baseHeight/2, 1.6);
                    group.add(vent3);
                }
                
                // Expansion chamber (level 2+)
                if (hasExpansion) {
                    const expansion = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, baseHeight*0.8, 8), new THREE.MeshStandardMaterial({ color: 0x607d8b, roughness: 0.6, metalness: 0.4 }));
                    expansion.position.set(-baseSize/2-1.5, baseHeight/2, 0);
                    group.add(expansion);
                }
                
                // Muffler (level 3+)
                if (hasMuffler) {
                    const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.5, metalness: 0.6 }));
                    muffler.position.set(baseSize/2+0.5, baseHeight-0.8, -0.5);
                    muffler.rotation.z = Math.PI/6;
                    group.add(muffler);
                }
                
                // Control panel (level 3+)
                if (hasControl) {
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.3), new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.3 }));
                    panel.position.set(-baseSize/2+0.5, baseHeight-0.8, -1.2);
                    group.add(panel);
                    // Button indicators
                    for (let i = 0; i < 3; i++) {
                        const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff5722, emissive: 0xff5722, emissiveIntensity: 0.6 }));
                        indicator.position.set(-baseSize/2+0.2, baseHeight-0.2, -1.2+i*0.5);
                        group.add(indicator);
                    }
                }
            }
        } else {
            // Detailed House / Generic Building Logic
            
            if (type === 'house') {
                 // Basic Farmhouse
                 const body = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.8 })); 
                 body.position.y = 2;
                 group.add(body);
                 
                 const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 3.5, 4), new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.7 })); // Dark roof
                 roof.position.y = 5.75;
                 roof.rotation.y = Math.PI/4;
                 group.add(roof);
                 
                 const chim = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.8), new THREE.MeshStandardMaterial({ color: 0xbf360c, roughness: 0.9 })); // Brick
                 chim.position.set(1.5, 5, -1.5);
                 group.add(chim);
                 
                 const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 }));
                 door.position.set(0, 1.1, 3.1);
                 group.add(door);
                 
                 return group;
            } else if (type === 'guest_house') {
                 // Two story narrow building
                 const body = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 5), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.8 }));
                 body.position.y = 3;
                 group.add(body);
                 
                 const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.7 }));
                 roof.position.y = 7.5;
                 roof.rotation.y = Math.PI/4;
                 group.add(roof);
                 
                 // Balcony
                 const balcony = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
                 balcony.position.set(0, 3, 2.6);
                 group.add(balcony);
                 
                 const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 }));
                 door.position.set(0, 1.1, 2.55);
                 group.add(door);
                 return group;
            } else if (type === 'cottage') {
                 // Small, cozy, thatch roof
                 const body = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.9 }));
                 body.position.y = 2;
                 group.add(body);
                 
                 const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 4, 4), new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 1.0 })); // Thatch color
                 roof.position.y = 6;
                 roof.rotation.y = Math.PI/4;
                 group.add(roof);
                 
                 const chim = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.8), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.9 }));
                 chim.position.set(1.5, 5, -1.5);
                 group.add(chim);
                 
                 const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 }));
                 door.position.set(0, 1.1, 3.1);
                 group.add(door);
                 
                 const win = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.3 }));
                 win.position.set(1.5, 2.5, 3.1); group.add(win);
                 const win2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.3 }));
                 win2.position.set(-1.5, 2.5, 3.1); group.add(win2);
                 return group;
            } else if (type === 'mansion') {
                 // Big, wide, wings
                 const body = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.6 }));
                 body.position.y = 4;
                 group.add(body);
                 
                 const wingL = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 6), new THREE.MeshStandardMaterial({ color: 0xbdc3c7, roughness: 0.7 }));
                 wingL.position.set(-6.5, 3, 0);
                 group.add(wingL);
                 const wingR = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 6), new THREE.MeshStandardMaterial({ color: 0xbdc3c7, roughness: 0.7 }));
                 wingR.position.set(6.5, 3, 0);
                 group.add(wingR);
                 
                 // Main Roof
                 const roof = new THREE.Mesh(new THREE.ConeGeometry(6, 4, 4), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.6 }));
                 roof.position.y = 10;
                 roof.rotation.y = Math.PI/4;
                 group.add(roof);
                 
                 // Wing Roofs
                 const roofL = new THREE.Mesh(new THREE.ConeGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.6 }));
                 roofL.position.set(-6.5, 7.5, 0); roofL.rotation.y = Math.PI/4; group.add(roofL);
                 const roofR = new THREE.Mesh(new THREE.ConeGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.6 }));
                 roofR.position.set(6.5, 7.5, 0); roofR.rotation.y = Math.PI/4; group.add(roofR);
                 
                 // Columns
                 const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
                 const c1 = col.clone(); c1.position.set(-2, 4, 4.2); group.add(c1);
                 const c2 = col.clone(); c2.position.set(2, 4, 4.2); group.add(c2);
                 
                 return group;
            } else if (type === 'garage') {
                 // Wide, garage door
                 const body = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 8), new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.8 }));
                 body.position.y = 2.5;
                 group.add(body);
                 const door = new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.5 }));
                 door.position.set(0, 1.75, 4.1);
                 group.add(door);
                 const roof = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.5, 8.5), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.6 }));
                 roof.position.y = 5.25;
                 group.add(roof);
                 return group;
            } else if (type === 'tool_shed') {
                 // Small shed
                 const body = new THREE.Mesh(new THREE.BoxGeometry(4, 3.5, 4), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.9 }));
                 body.position.y = 1.75;
                 group.add(body);
                 const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2, 4), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 }));
                 roof.position.y = 4.5;
                 roof.rotation.y = Math.PI/4;
                 group.add(roof);
                 const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 }));
                 door.position.set(0, 1.25, 2.1);
                 group.add(door);
                 return group;
            }

            const isBarn = type.includes('barn') || type.includes('shed');
            
            // Foundation
            const foundation = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1, 7.2), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.9 }));
            foundation.position.y = 0.5;
            group.add(foundation);

            // Main Body
            const body = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.8 }));
            body.position.y = 3.5;
            group.add(body);

            // Wood Planks Detail (Horizontal lines visual)
            for(let i=0; i<5; i++) {
                const plank = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.05, 7.1), new THREE.MeshStandardMaterial({ color: 0x000000, opacity: 0.1, transparent: true, roughness: 1.0 }));
                plank.position.y = 1.5 + i * 1.0;
                group.add(plank);
            }

            // Roof Group
            const roofGroup = new THREE.Group();
            
            // Main Roof Pyramid
            const roofGeo = new THREE.ConeGeometry(5.5, 4.5, 4);
            const roofMat = new THREE.MeshStandardMaterial({ color: isBarn ? 0x8b0000 : 0x3e2723, roughness: 0.7 });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.rotation.y = Math.PI/4;
            roofGroup.position.y = 8.25;
            roofGroup.add(roof);

            // Roof Ridge
            const ridge = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.6 }));
            ridge.position.set(0, 8.5, 0); // Approximate top
            ridge.rotation.y = Math.PI/4;
            // group.add(ridge); // Hard to place perfectly on cone without math, skip for now

            group.add(roofGroup);

            // Entrance / Door Area
            const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
            doorFrame.position.set(0, 2.5, 3.55);
            group.add(doorFrame);
            
            const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 0.35), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 }));
            door.position.set(0, 2.3, 3.6);
            group.add(door);

            // Door Knob
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.8 }));
            knob.position.set(0.6, 2.5, 3.8);
            group.add(knob);

            // Front Windows
            const createFrontWindow = (x, y) => {
                const wFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
                wFrame.position.set(x, y, 3.55);
                group.add(wFrame);
                const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.25), new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.1, metalness: 0.9 }));
                glass.position.set(x, y, 3.55);
                group.add(glass);
                // Crossbars
                const barV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
                barV.position.set(x, y, 3.55);
                group.add(barV);
                const barH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
                barH.position.set(x, y, 3.55);
                group.add(barH);

                // Flower Box
                const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 }));
                box.position.set(x, y - 0.9, 3.7);
                group.add(box);
                
                // Flowers
                const flowerColor = Math.random() > 0.5 ? 0xe91e63 : 0xf1c40f;
                const flowers = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: flowerColor, roughness: 0.6 }));
                flowers.position.set(x, y - 0.8, 3.7);
                group.add(flowers);
            };

            createFrontWindow(-2, 4);
            createFrontWindow(2, 4);
            
            // Side Windows (Simpler)
            const wSideL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
            wSideL.position.set(-3.55, 4, 0);
            group.add(wSideL);
            const wGlassL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.1, metalness: 0.9 }));
            wGlassL.position.set(-3.55, 4, 0);
            group.add(wGlassL);

            const wSideR = wSideL.clone();
            wSideR.position.set(3.55, 4, 0);
            group.add(wSideR);
            const wGlassR = wGlassL.clone();
            wGlassR.position.set(3.55, 4, 0);
            group.add(wGlassR);

            // Chimney
            const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.9 }));
            chimney.position.set(-2, 7.5, -1.5);
            group.add(chimney);
            
            // Smoke (Static puff)
            const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.8, roughness: 1.0 }));
            smoke.position.set(-2, 9.5, -1.5);
            group.add(smoke);
            const smoke2 = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.6, roughness: 1.0 }));
            smoke2.position.set(-1.7, 10.3, -1.3);
            group.add(smoke2);

            // Porch Steps
            const step1 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 1), new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.8 }));
            step1.position.set(0, 0.15, 4);
            group.add(step1);
            
            // Corner Pillars
            const pillarGeo = new THREE.BoxGeometry(0.6, 5, 0.6);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }); // White corners
            const p1 = new THREE.Mesh(pillarGeo, pillarMat); p1.position.set(-3.55, 3.5, -3.55); group.add(p1);
            const p2 = new THREE.Mesh(pillarGeo, pillarMat); p2.position.set(3.55, 3.5, -3.55); group.add(p2);
            const p3 = new THREE.Mesh(pillarGeo, pillarMat); p3.position.set(-3.55, 3.5, 3.55); group.add(p3);
            const p4 = new THREE.Mesh(pillarGeo, pillarMat); p4.position.set(3.55, 3.5, 3.55); group.add(p4);
        }

    } else if (def.category === 'decoration') {
        if (type === 'tree_oak') {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2.5, 7), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 }));
            trunk.position.y = 1.25; group.add(trunk);
            const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8), new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 }));
            foliage.position.y = 3.5; group.add(foliage);
            const f2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3), new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 }));
            f2.position.set(0.8, 3.2, 0.8); group.add(f2);
            const f3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1), new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.8 }));
            f3.position.set(-0.8, 3.8, -0.4); group.add(f3);
        } else if (type === 'tree_pine') {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 7), new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 }));
            trunk.position.y = 1.1; group.add(trunk);
            const l1 = new THREE.Mesh(new THREE.ConeGeometry(2.0, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.8 }));
            l1.position.y = 2.5; group.add(l1);
            const l2 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 }));
            l2.position.y = 3.8; group.add(l2);
            const l3 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.8 }));
            l3.position.y = 5.0; group.add(l3);
        } else if (type === 'tree_apple') {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2.5, 7), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 }));
            trunk.position.y = 1.25; group.add(trunk);
            const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8), new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.8 }));
            foliage.position.y = 3.5; group.add(foliage);
            const appleGeo = new THREE.SphereGeometry(0.2, 8, 8);
            const appleMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.4 });
            for(let i=0; i<6; i++) {
                const apple = new THREE.Mesh(appleGeo, appleMat);
                apple.position.set((Math.random()-0.5)*2.2, 2.8+Math.random()*1.5, (Math.random()-0.5)*2.2);
                group.add(apple);
            }
        } else if (type === 'bush') {
            const b1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.8 }));
            b1.position.y = 1.0; group.add(b1);
            const b2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0), new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.8 }));
            b2.position.set(0.8, 0.8, 0.5); group.add(b2);
            const b3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9), new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.8 }));
            b3.position.set(-0.7, 0.9, -0.4); group.add(b3);
        } else if (type === 'hedge') {
            const hedge = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 1), new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.8 }));
            hedge.position.y = 1; group.add(hedge);
            for(let i=0; i<6; i++) {
                const bump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5), new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.8 }));
                bump.position.set((Math.random()-0.5)*2.8, 1.8, (Math.random()-0.5)*0.8);
                group.add(bump);
            }
        } else if (type === 'hay_bale') {
            const bale = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.5, 16), new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 1.0 }));
            bale.rotation.z = Math.PI/2;
            bale.position.y = 1.25; group.add(bale);
            const bandMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
            const b1 = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.05, 4, 24), bandMat);
            b1.rotation.y = Math.PI/2; b1.position.set(-0.8, 1.25, 0); group.add(b1);
            const b2 = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.05, 4, 24), bandMat);
            b2.rotation.y = Math.PI/2; b2.position.set(0.8, 1.25, 0); group.add(b2);
        } else if (type === 'fountain') {
            const base = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.6 }));
            base.position.y = 0.25; group.add(base);
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 8), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.6 }));
            col.position.y = 1.5; group.add(col);
            const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.2, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.6 }));
            tier1.position.y = 2.5; group.add(tier1);
            const water = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x3498db, roughness: 0.1, metalness: 0.1 }));
            water.position.y = 0.5; group.add(water);
            const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), new THREE.MeshStandardMaterial({ color: 0x81d4fa, roughness: 0.1, metalness: 0.1 }));
            stream.position.y = 3; group.add(stream);
        } else if (type === 'pond') {
            const water = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x03a9f4, roughness: 0.1, metalness: 0.1 }));
            water.position.y = 0.05; water.scale.x = 1.2; water.scale.z = 0.8; group.add(water);
            const rockMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.9 });
            for(let i=0; i<8; i++) {
                const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4), rockMat);
                const angle = (i/8)*Math.PI*2;
                rock.position.set(Math.cos(angle)*3.2, 0.2, Math.sin(angle)*2.6);
                group.add(rock);
            }
        } else if (type === 'bench') {
            const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 }));
            seat.position.y = 1.0; group.add(seat);
            const back = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.2), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 }));
            back.position.set(0, 1.8, -0.4); group.add(back);
            const legGeo = new THREE.BoxGeometry(0.2, 1, 1);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.8 });
            const l1 = new THREE.Mesh(legGeo, legMat); l1.position.set(-1.3, 0.5, 0); group.add(l1);
            const l2 = new THREE.Mesh(legGeo, legMat); l2.position.set(1.3, 0.5, 0); group.add(l2);
        } else if (type === 'streetlight') {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 5, 8), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.6 }));
            pole.position.y = 2.5; group.add(pole);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 0.15), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.6 }));
            arm.position.set(0.5, 4.8, 0); group.add(arm);
            const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0xf1c40f, emissive: 0xf1c40f, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.8 }));
            lamp.position.set(1.2, 4.4, 0); group.add(lamp);
        } else if (type === 'scarecrow') {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 8), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 }));
            pole.position.y = 2; group.add(pole);
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 }));
            arm.position.set(0, 2.8, 0); arm.rotation.z = Math.PI/2; group.add(arm);
            const shirt = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.8 }));
            shirt.position.y = 2.8; group.add(shirt);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.8 }));
            head.position.y = 3.8; group.add(head);
            const hat = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 }));
            hat.position.y = 4.3; group.add(hat);
        } else if (type === 'flower_pot') {
            const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 1, 12), new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.7 }));
            pot.position.y = 0.5; group.add(pot);
            const plant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0xe91e63, roughness: 0.8 }));
            plant.position.y = 1.2; group.add(plant);
        } else if (type === 'statue') {
            const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.5), new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.8 }));
            base.position.y = 0.5; group.add(base);
            const figure = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2, 8), new THREE.MeshStandardMaterial({ color: 0xbdc3c7, roughness: 0.4, metalness: 0.3 }));
            figure.position.y = 2; group.add(figure);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), new THREE.MeshStandardMaterial({ color: 0xbdc3c7, roughness: 0.4, metalness: 0.3 }));
            head.position.y = 3.3; group.add(head);
        } else if (type === 'fence_white') {
            const postGeo = new THREE.BoxGeometry(0.8, 4, 0.8);
            const railGeo = new THREE.BoxGeometry(8, 0.4, 0.2);
            const picketGeo = new THREE.BoxGeometry(0.5, 3.5, 0.2);
            const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
            const p1 = new THREE.Mesh(postGeo, mat); p1.position.set(-3.5, 2, 0); group.add(p1);
            const p2 = new THREE.Mesh(postGeo, mat); p2.position.set(3.5, 2, 0); group.add(p2);
            const r1 = new THREE.Mesh(railGeo, mat); r1.position.set(0, 3, 0); group.add(r1);
            const r2 = new THREE.Mesh(railGeo, mat); r2.position.set(0, 1.5, 0); group.add(r2);
            for(let i=0; i<5; i++) {
                const pic = new THREE.Mesh(picketGeo, mat);
                pic.position.set(-2.5 + i * 1.25, 2, 0.2); group.add(pic);
            }
        } else if (type === 'fence_stone') {
            const stoneColors = [0x7f8c8d, 0x95a5a6, 0xbdc3c7];
            for(let i=0; i<6; i++) {
                for(let j=0; j<3; j++) {
                    const w = 1.3 + Math.random()*0.4;
                    const h = 0.8 + Math.random()*0.4;
                    const d = 1.0 + Math.random()*0.4;
                    const stone = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: stoneColors[(i+j)%3], roughness: 0.9 }));
                    stone.position.set(-3.5 + i*1.4, 0.4 + j*0.9, (Math.random()-0.5)*0.3);
                    stone.rotation.z = (Math.random()-0.5)*0.2;
                    stone.rotation.y = (Math.random()-0.5)*0.2;
                    group.add(stone);
                }
            }
        } else if (type === 'fence_wood') {
            const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
            const postGeo = new THREE.CylinderGeometry(0.5, 0.6, 4, 6);
            const p1 = new THREE.Mesh(postGeo, woodMat); p1.position.set(-3, 2, 0); group.add(p1);
            const p2 = new THREE.Mesh(postGeo, woodMat); p2.position.set(3, 2, 0); group.add(p2);
            const beamGeo = new THREE.BoxGeometry(7, 0.4, 0.3);
            const b1 = new THREE.Mesh(beamGeo, woodMat); b1.position.set(0, 2.5, 0); b1.rotation.z = 0.1; group.add(b1);
            const b2 = new THREE.Mesh(beamGeo, woodMat); b2.position.set(0, 2.5, 0); b2.rotation.z = -0.1; group.add(b2);
        } else if (type === 'path_stone') {
            const stoneGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.2, 7);
            const stoneMat = new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.9 });
            const s1 = new THREE.Mesh(stoneGeo, stoneMat); s1.position.set(-2, 0.1, -2); group.add(s1);
            const s2 = new THREE.Mesh(stoneGeo, stoneMat); s2.position.set(1, 0.1, 0); group.add(s2);
            const s3 = new THREE.Mesh(stoneGeo, stoneMat); s3.position.set(-1.5, 0.1, 2.5); group.add(s3);
            const s4 = new THREE.Mesh(stoneGeo, stoneMat); s4.position.set(2.5, 0.1, -1.5); group.add(s4);
        } else if (type === 'path_brick') {
            const brickGeo = new THREE.BoxGeometry(1.8, 0.15, 0.9);
            const brickMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.8 });
            for(let x=-1; x<=1; x++) {
                for(let z=-1; z<=1; z++) {
                    const b = new THREE.Mesh(brickGeo, brickMat); b.position.set(x * 2.1, 0.08, z * 2.1); group.add(b);
                    if (x < 1 && z < 1) {
                         const b2 = new THREE.Mesh(brickGeo, brickMat); b2.rotation.y = Math.PI/2; b2.position.set(x * 2.1 + 1.0, 0.08, z * 2.1 + 1.0); group.add(b2);
                    }
                }
            }
        } else if (type === 'road') {
            if (!window.sharedAsphaltTexture) window.sharedAsphaltTexture = createProceduralTexture('asphalt');
            
            const roadMat = new THREE.MeshStandardMaterial({ map: window.sharedAsphaltTexture, roughness: 0.9 });
            const road = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE), roadMat);
            road.rotation.x = -Math.PI/2;
            road.position.y = 0.05;
            group.add(road);
        } else if (type === 'path_dirt') {
            const path = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE), new THREE.MeshStandardMaterial({ color: def.color, roughness: 1.0 }));
            path.rotation.x = -Math.PI/2; path.position.y = 0.05; group.add(path);
            for(let i=0; i<10; i++) {
                const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2), new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.9 }));
                pebble.position.set((Math.random()-0.5)*6, 0.1, (Math.random()-0.5)*6); group.add(pebble);
            }
        } else {
             // Generic fallback
             const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.8 }));
             box.position.y = 1; group.add(box);
        }
    } else if (def.category === 'vehicle') {
        group.userData.isVehicle = true;
        group.userData.wheels = [];
        group.userData.attachments = {};
        if (type === 'tractor') {
            const body = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 3), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.7 }));
            body.position.y = 1.5;
            group.add(body);
            const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.5 }));
            cab.position.set(1.6, 2.6, 0);
            group.add(cab);
            const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.8 }));
            exhaust.position.set(-2.4, 2.7, -0.8);
            group.add(exhaust);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
            const rearGeo = new THREE.CylinderGeometry(1.2, 1.2, 1.2, 16);
            const frontGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.8, 12);
            const w1 = new THREE.Mesh(rearGeo, wheelMat); w1.rotation.z = Math.PI/2; w1.position.set(-2.6, 0.8, -1.5);
            const w2 = new THREE.Mesh(rearGeo, wheelMat); w2.rotation.z = Math.PI/2; w2.position.set(-2.6, 0.8, 1.5);
            const w3 = new THREE.Mesh(frontGeo, wheelMat); w3.rotation.z = Math.PI/2; w3.position.set(2.6, 0.6, -1.5);
            const w4 = new THREE.Mesh(frontGeo, wheelMat); w4.rotation.z = Math.PI/2; w4.position.set(2.6, 0.6, 1.5);
            [w1,w2,w3,w4].forEach(w => { group.add(w); group.userData.wheels.push(w); });
        } else if (type === 'harvester') {
            const body = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 4), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.7 }));
            body.position.y = 1.8;
            group.add(body);
            const bin = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 3), new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 0.5 }));
            bin.position.set(0, 3, 0);
            group.add(bin);
            const header = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 7, 16), new THREE.MeshStandardMaterial({ color: 0xaaaa00, roughness: 0.4, metalness: 0.6 }));
            header.rotation.z = Math.PI/2;
            header.position.set(4.8, 1.2, 0);
            group.add(header);
            group.userData.attachments.header = header;
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
            const bigGeo = new THREE.CylinderGeometry(1.1, 1.1, 1.2, 16);
            const w1 = new THREE.Mesh(bigGeo, wheelMat); w1.rotation.z = Math.PI/2; w1.position.set(-3.2, 0.9, -1.8);
            const w2 = new THREE.Mesh(bigGeo, wheelMat); w2.rotation.z = Math.PI/2; w2.position.set(-3.2, 0.9, 1.8);
            const w3 = new THREE.Mesh(bigGeo, wheelMat); w3.rotation.z = Math.PI/2; w3.position.set(2.8, 0.9, -1.8);
            const w4 = new THREE.Mesh(bigGeo, wheelMat); w4.rotation.z = Math.PI/2; w4.position.set(2.8, 0.9, 1.8);
            [w1,w2,w3,w4].forEach(w => { group.add(w); group.userData.wheels.push(w); });
        } else if (type === 'pickup_truck') {
            const body = new THREE.Mesh(new THREE.BoxGeometry(7, 2.5, 3), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.4, metalness: 0.6 }));
            body.position.y = 1.3;
            group.add(body);
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 3), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.5 }));
            cabin.position.set(-2.0, 2.3, 0);
            group.add(cabin);
            const bed = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 2.8), new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.6 }));
            bed.position.set(2.0, 1.5, 0);
            group.add(bed);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
            const wheelGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.8, 16);
            const pos = [-2.8, 2.8];
            const zpos = [-1.5, 1.5];
            pos.forEach(px => zpos.forEach(pz => {
                const w = new THREE.Mesh(wheelGeo, wheelMat);
                w.rotation.z = Math.PI/2;
                w.position.set(px, 0.7, pz);
                group.add(w);
                group.userData.wheels.push(w);
            }));
        } else if (type === 'sprayer') {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 2.5), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.7 }));
            frame.position.y = 1.0;
            group.add(frame);
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.5, 16), new THREE.MeshStandardMaterial({ color: 0x1abc9c, roughness: 0.3 }));
            tank.rotation.z = Math.PI/2;
            tank.position.set(0, 1.8, 0);
            group.add(tank);
            const boomL = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.4, metalness: 0.5 }));
            const boomR = boomL.clone();
            boomL.position.set(-3.5, 1.8, 0);
            boomR.position.set(3.5, 1.8, 0);
            group.add(boomL); group.add(boomR);
            group.userData.attachments.boomL = boomL;
            group.userData.attachments.boomR = boomR;
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
            const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.8, 12);
            const w1 = new THREE.Mesh(wheelGeo, wheelMat); w1.rotation.z = Math.PI/2; w1.position.set(-2.3, 0.6, -1.2);
            const w2 = new THREE.Mesh(wheelGeo, wheelMat); w2.rotation.z = Math.PI/2; w2.position.set(-2.3, 0.6, 1.2);
            const w3 = new THREE.Mesh(wheelGeo, wheelMat); w3.rotation.z = Math.PI/2; w3.position.set(2.3, 0.6, -1.2);
            const w4 = new THREE.Mesh(wheelGeo, wheelMat); w4.rotation.z = Math.PI/2; w4.position.set(2.3, 0.6, 1.2);
            [w1,w2,w3,w4].forEach(w => { group.add(w); group.userData.wheels.push(w); });
        } else if (type === 'seed_drill') {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 2.5), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.7 }));
            frame.position.y = 1.0;
            group.add(frame);
            const discs = [];
            for (let i=0;i<6;i++) {
                const d = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.4, metalness: 0.8 }));
                d.rotation.z = Math.PI/2;
                d.position.set(-2.5 + i*1.0, 0.4, 1.2);
                group.add(d);
                discs.push(d);
            }
            group.userData.attachments.discs = discs;
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
            const wheelGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.8, 16);
            const w1 = new THREE.Mesh(wheelGeo, wheelMat); w1.rotation.z = Math.PI/2; w1.position.set(-2.8, 0.7, -1.2);
            const w2 = new THREE.Mesh(wheelGeo, wheelMat); w2.rotation.z = Math.PI/2; w2.position.set(2.8, 0.7, -1.2);
            [w1,w2].forEach(w => { group.add(w); group.userData.wheels.push(w); });
        } else if (type === 'plow') {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2.2), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, metalness: 0.1 }));
            frame.position.y = 0.9;
            group.add(frame);
            const blades = [];
            for (let i=0;i<4;i++) {
                const blade = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 }));
                blade.rotation.x = Math.PI/2.8;
                blade.position.set(-2.5 + i*1.6, 0.6, 0.9);
                group.add(blade);
                blades.push(blade);
            }
            group.userData.attachments.blades = blades;
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
            const wheelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.8, 14);
            const w1 = new THREE.Mesh(wheelGeo, wheelMat); w1.rotation.z = Math.PI/2; w1.position.set(-2.6, 0.7, -1.2);
            const w2 = new THREE.Mesh(wheelGeo, wheelMat); w2.rotation.z = Math.PI/2; w2.position.set(2.6, 0.7, -1.2);
            [w1,w2].forEach(w => { group.add(w); group.userData.wheels.push(w); });
        } else {
            const body = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 3), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.1 }));
            body.position.y = 1.5;
            group.add(body);
            const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 1, 12);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
            for (let i=0;i<4;i++) {
                const w = new THREE.Mesh(wheelGeo, wheelMat);
                w.rotation.z = Math.PI/2;
                w.position.set(i<2?-2.5:2.5, 0.5, i%2?-1.5:1.5);
                group.add(w);
                group.userData.wheels.push(w);
            }
        }
    }

    enableShadows(group);
    return group;
}

function createBuildingMesh(type, x, z) {
    const building = gameState.buildings && gameState.buildings.find(b => b.x === x && b.z === z && b.type === type);
    const mesh = createDetailedBuilding(type, building);
    mesh.position.set(x, 0, z);
    mesh.userData.scaleProgress = 1;
    scene.add(mesh);
    objects.push(mesh);
    const def = BuildingTypes[type];
    if (def && def.category === 'vehicle') {
        vehicles.push({ mesh, seed: Math.random()*10, baseX: x, baseZ: z });
    }
    return mesh;
}

// ------------------------------------------------------------------
// NPC SYSTEM
// ------------------------------------------------------------------
function spawnNPC(homeX, homeZ) {
    const group = new THREE.Group();
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const skinColor = 0xF4A460; // Sandy skin
    const shirtColor = Math.random() < 0.5 ? 0xd32f2f : 0x388e3c; // Red or Green flannel
    const pantsColor = 0x8B7355; // Brown denim
    const shoesColor = 0x5D4E37; // Dark Brown Boots
    
    // --- TORSO (Parent for upper body and legs) ---
    // Main Body (Shirt) - Slightly wider and rounder for cartoon look
    const torsoGeo = new THREE.CylinderGeometry(1.0, 0.95, 2.2, 6);
    const torsoMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 3.6;
    group.add(torso);

    // Belly/Stomach (Round belly for cartoon farmer)
    const bellyGeo = new THREE.SphereGeometry(0.75, 8, 8, 0, Math.PI * 2, 0, Math.PI);
    const bellyMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, 3.2, 0);
    belly.scale.y = 0.8;
    group.add(belly);

    // Overalls (Bib) - Bigger and more visible
    const bibGeo = new THREE.BoxGeometry(1.4, 1.5, 0.15);
    const bibMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
    const bib = new THREE.Mesh(bibGeo, bibMat);
    bib.position.set(0, 3.0, 0.5);
    group.add(bib);

    // Overalls (Straps) - Thicker and more prominent
    const strapGeo = new THREE.BoxGeometry(0.4, 2.8, 0.15); 
    const strapL = new THREE.Mesh(strapGeo, bibMat);
    strapL.position.set(-0.6, 3.5, 0.5);
    group.add(strapL);
    const strapR = new THREE.Mesh(strapGeo, bibMat);
    strapR.position.set(0.6, 3.5, 0.5);
    group.add(strapR);

    // Overalls (Metal buckles)
    const buckleGeo = new THREE.BoxGeometry(0.2, 0.25, 0.1);
    const buckleMat = new THREE.MeshStandardMaterial({ color: 0xFAD5A5, metalness: 0.8, roughness: 0.2 });
    const buckleL = new THREE.Mesh(buckleGeo, buckleMat);
    buckleL.position.set(-0.55, 3.7, 0.55);
    group.add(buckleL);
    const buckleR = new THREE.Mesh(buckleGeo, buckleMat);
    buckleR.position.set(0.55, 3.7, 0.55);
    group.add(buckleR);

    // --- HEAD ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 5.2, 0);
    group.add(headGroup);

    // Neck (shorter and sturdier)
    const neckGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.5);
    const neckMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.5 });
    const neck = new THREE.Mesh(neckGeo, neckMat);
    neck.position.y = 0;
    headGroup.add(neck);

    // Face/Head - Round and big (cartoon style)
    const headGeo = new THREE.SphereGeometry(0.65, 8, 8);
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.5 }));
    head.position.y = 0.7;
    headGroup.add(head);

    // Cheeks (round rosy cheeks)
    const cheekGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const cheekMat = new THREE.MeshStandardMaterial({ color: 0xFF9999, roughness: 0.6 });
    const cheekL = new THREE.Mesh(cheekGeo, cheekMat);
    cheekL.position.set(-0.35, 0.5, 0.5);
    headGroup.add(cheekL);
    const cheekR = new THREE.Mesh(cheekGeo, cheekMat);
    cheekR.position.set(0.35, 0.5, 0.5);
    headGroup.add(cheekR);

    // Eyes (big and expressive)
    const eyeGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x4A90E2, roughness: 0.3 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.2, 1.0, 0.65);
    headGroup.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.2, 1.0, 0.65);
    headGroup.add(eyeR);

    // Pupils (darker eyes)
    const pupilGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.position.set(-0.2, 1.0, 0.75);
    headGroup.add(pupilL);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.position.set(0.2, 1.0, 0.75);
    headGroup.add(pupilR);

    // Nose (big cartoony nose)
    const noseGeo = new THREE.ConeGeometry(0.15, 0.35, 6);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xE0AC90, roughness: 0.6 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, 0.6, 0.7);
    nose.rotation.x = -0.3;
    headGroup.add(nose);

    // Mouth (big smile)
    const mouthGeo = new THREE.BoxGeometry(0.4, 0.15, 0.05);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xFF6B6B, roughness: 0.7 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 0.35, 0.7);
    headGroup.add(mouth);

    // Hat (Big straw hat for cartoon farmer)
    const hatGroup = new THREE.Group();
    hatGroup.position.y = 1.4;
    headGroup.add(hatGroup);
    
    // Hat brim (wider and more prominent)
    const brimGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.12, 12);
    const straw = new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 1.0, flatShading: true });
    const brim = new THREE.Mesh(brimGeo, straw);
    hatGroup.add(brim);
    
    // Hat dome (taller crown)
    const domeGeo = new THREE.ConeGeometry(0.85, 0.9, 12);
    const dome = new THREE.Mesh(domeGeo, straw);
    dome.position.y = 0.5;
    hatGroup.add(dome);
    
    // Hat band (with different color)
    const bandGeo = new THREE.CylinderGeometry(0.87, 0.87, 0.2, 12);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xD32F2F, roughness: 0.8 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 0.2;
    hatGroup.add(band);

    // Hair (visible on sides for female)
    if (gender === 'female') {
        const hairL = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 }));
        hairL.position.set(-0.5, 0.6, -0.2);
        hairL.scale.set(0.6, 1, 0.8);
        headGroup.add(hairL);
        const hairR = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 }));
        hairR.position.set(0.5, 0.6, -0.2);
        hairR.scale.set(0.6, 1, 0.8);
        headGroup.add(hairR);
    }

    // --- ARMS ---
    // Left Arm Group (Pivot at shoulder)
    const leftArm = new THREE.Group();
    leftArm.position.set(-1.1, 4.2, 0); 
    group.add(leftArm);
    
    const lArmGeo = new THREE.CylinderGeometry(0.35, 0.3, 1.6, 6);
    const armMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const lArmMesh = new THREE.Mesh(lArmGeo, armMat);
    lArmMesh.position.y = -0.8;
    leftArm.add(lArmMesh);
    
    const lHandGeo = new THREE.SphereGeometry(0.3, 6, 6);
    const handMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.5 });
    const lHand = new THREE.Mesh(lHandGeo, handMat);
    lHand.position.y = -1.7;
    leftArm.add(lHand);

    // Right Arm Group
    const rightArm = new THREE.Group();
    rightArm.position.set(1.1, 4.2, 0);
    group.add(rightArm);
    
    const rArmMesh = new THREE.Mesh(lArmGeo, armMat);
    rArmMesh.position.y = -0.8;
    rightArm.add(rArmMesh);
    
    const rHand = new THREE.Mesh(lHandGeo, handMat);
    rHand.position.y = -1.7;
    rightArm.add(rHand);

    // --- LEGS ---
    // Left Leg Group
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.5, 2.3, 0);
    group.add(leftLeg);
    
    const legGeo = new THREE.CylinderGeometry(0.4, 0.4, 2.0, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
    const lLegMesh = new THREE.Mesh(legGeo, legMat);
    lLegMesh.position.y = -1.0;
    leftLeg.add(lLegMesh);
    
    const bootGeo = new THREE.SphereGeometry(0.45, 6, 6);
    const bootMat = new THREE.MeshStandardMaterial({ color: shoesColor, roughness: 0.7 });
    bootGeo.scale(1, 0.6, 1.2);
    const lBoot = new THREE.Mesh(bootGeo, bootMat);
    lBoot.position.y = -2.15;
    leftLeg.add(lBoot);

    // Right Leg Group
    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.5, 2.3, 0);
    group.add(rightLeg);
    
    const rLegMesh = new THREE.Mesh(legGeo, legMat);
    rLegMesh.position.y = -1.0;
    rightLeg.add(rLegMesh);
    
    const rBoot = new THREE.Mesh(bootGeo, bootMat);
    rBoot.position.y = -2.15;
    rightLeg.add(rBoot);

    group.position.set(homeX, 0, homeZ);
    
    // Shadow helper
    group.traverse(o => { if(o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    
    scene.add(group);
    
    // Per-NPC properties for more natural behaviour
    npcs.push({
        mesh: group,
        target: null,
        state: 'idle',
        timer: 0,
        limbs: { leftLeg, rightLeg, leftArm, rightArm },
        gender,
        bubbleEl: null,
        bubbleExpire: 0,
        nextSpeak: Date.now() + 3000 + Math.random() * 6000,
        // Behavioural params
        // Slight jitter so villagers don't all share the exact house origin
        homeX: homeX + (Math.random() - 0.5) * (TILE_SIZE || 4),
        homeZ: homeZ + (Math.random() - 0.5) * (TILE_SIZE || 4),
        wanderRadius: 12 + Math.random() * 40,
        // Movement: npc.speed is units-per-ms; will be multiplied by frame delta
        // increased defaults so NPCs traverse the map more noticeably
        speed: 0.004 + Math.random() * 0.01,
        walkOffset: Math.random() * Math.PI * 2,
        lookOffset: Math.random() * 1000,
        head: headGroup,
        eyeL: eyeL,
        eyeR: eyeR,
        pupilL: pupilL,
        pupilR: pupilR,
        blinkNext: Date.now() + 2000 + Math.random() * 5000,
        blinkUntil: 0
    });
}

function updateNPCs(delta) {
    const limit = (gameState.gridSize * TILE_SIZE) / 2 - 1.5;
    const now = Date.now();
    const t = now * 0.001;

    npcs.forEach(npc => {
        // Blinking
        if (now > npc.blinkNext) {
            npc.blinkUntil = now + 80 + Math.random() * 160;
            npc.blinkNext = now + 2000 + Math.random() * 5000;
        }
        const blinking = now < npc.blinkUntil;
        if (npc.eyeL) npc.eyeL.scale.y = blinking ? 0.15 : 1;
        if (npc.eyeR) npc.eyeR.scale.y = blinking ? 0.15 : 1;

        // Determine target within home area
        if (!npc.target) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * npc.wanderRadius;
            const tx = npc.homeX + Math.cos(angle) * r;
            const tz = npc.homeZ + Math.sin(angle) * r;
            // clamp to map
            npc.target = { x: Math.max(-limit, Math.min(limit, tx)), z: Math.max(-limit, Math.min(limit, tz)) };
            // Occasionally pause instead of walking
            if (Math.random() < 0.25) {
                npc.state = 'idle';
                npc.timer = 800 + Math.random() * 3200;
            } else {
                npc.state = 'walking';
            }
        }

        // Movement and state handling
        if (npc.state === 'walking' && npc.target) {
            const dx = npc.target.x - npc.mesh.position.x;
            const dz = npc.target.z - npc.mesh.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz) || 1;
            const step = npc.speed * delta;
            if (dist < 0.6) {
                npc.target = null; // reached
                npc.state = 'idle';
                npc.timer = 600 + Math.random() * 3000;
            } else {
                npc.mesh.position.x += (dx / dist) * step;
                npc.mesh.position.z += (dz / dist) * step;
                npc.mesh.lookAt(npc.target.x, npc.mesh.position.y, npc.target.z);

                // Walk Animation (swing limbs with per-npc offset)
                const phase = t * 8 + npc.walkOffset;
                const amp = Math.min(0.7, npc.speed * 28);
                npc.limbs.leftLeg.rotation.x = Math.sin(phase) * amp;
                npc.limbs.rightLeg.rotation.x = Math.sin(phase + Math.PI) * amp;
                npc.limbs.leftArm.rotation.x = Math.sin(phase + Math.PI) * (amp * 0.9);
                npc.limbs.rightArm.rotation.x = Math.sin(phase) * (amp * 0.9);
            }
        } else {
            // Idle behaviour: look around, small breathing, slow limb relax
            if (npc.timer > 0) {
                npc.timer -= delta;
            } else {
                // decide next action
                npc.target = null;
                if (Math.random() < 0.6) {
                    npc.state = 'walking';
                } else {
                    npc.state = 'idle';
                    npc.timer = 800 + Math.random() * 3000;
                }
            }

            // Relax limbs gradually toward neutral
            npc.limbs.leftLeg.rotation.x += (0 - npc.limbs.leftLeg.rotation.x) * 0.12;
            npc.limbs.rightLeg.rotation.x += (0 - npc.limbs.rightLeg.rotation.x) * 0.12;
            npc.limbs.leftArm.rotation.x += (0 - npc.limbs.leftArm.rotation.x) * 0.12;
            npc.limbs.rightArm.rotation.x += (0 - npc.limbs.rightArm.rotation.x) * 0.12;

            // Head and eye movement while idle
            if (npc.head) {
                npc.head.rotation.y = Math.sin(t * 0.6 + npc.lookOffset) * 0.45;
                npc.head.rotation.x = Math.sin(t * 0.3 + npc.lookOffset * 0.01) * 0.08;
            }
        }

        // Keep NPCs within map bounds
        if (npc.mesh.position.x > limit) npc.mesh.position.x = limit;
        if (npc.mesh.position.x < -limit) npc.mesh.position.x = -limit;
        if (npc.mesh.position.z > limit) npc.mesh.position.z = limit;
        if (npc.mesh.position.z < -limit) npc.mesh.position.z = -limit;
    });
}

// ------------------------------------------------------------------
// PROGRESSION & UI
// ------------------------------------------------------------------
window.showSettings = function() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'block';
};

window.logout = function() {
    // Simple reload to reset state and return to login screen
    window.location.reload();
};

window.setGraphicsQuality = function(quality, btn) {
    // Update active button state
    if (btn) {
        const parent = btn.parentElement;
        Array.from(parent.children).forEach(c => {
             c.style.transform = 'scale(1)';
             c.style.border = 'none';
        });
        btn.style.border = '2px solid white';
        btn.style.transform = 'scale(1.1)';
    }

    if (!renderer) return;

    // Apply Quality Settings
    if (quality === 'low') {
        renderer.shadowMap.enabled = false;
        renderer.setPixelRatio(1);
    } else if (quality === 'medium') {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        if (dirLight) {
            dirLight.shadow.mapSize.width = 1024;
            dirLight.shadow.mapSize.height = 1024;
        }
        renderer.setPixelRatio(window.devicePixelRatio > 1.5 ? 1.5 : window.devicePixelRatio);
    } else if (quality === 'high') {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        if (dirLight) {
            dirLight.shadow.mapSize.width = 2048;
            dirLight.shadow.mapSize.height = 2048;
        }
        renderer.setPixelRatio(window.devicePixelRatio);
    } else if (quality === 'ultra') {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        if (dirLight) {
            dirLight.shadow.mapSize.width = 4096;
            dirLight.shadow.mapSize.height = 4096;
            dirLight.shadow.bias = -0.00005; // Finer bias for high res
        }
        // Force high pixel ratio for sharpness
        renderer.setPixelRatio(Math.max(window.devicePixelRatio, 2.0));
    }
    
    // Refresh materials
    scene.traverse(obj => {
        if (obj.isMesh) {
            obj.castShadow = renderer.shadowMap.enabled;
            obj.receiveShadow = renderer.shadowMap.enabled;
        }
    });
};

window.setShopCategory = function(cat) {
    currentShopCategory = cat;
    
    // Update tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const txt = btn.innerText;
        const match = 
            (cat === 'crop' && (txt === 'Seeds' || txt === 'Crops')) ||
            (cat === 'plot' && txt === 'Plots') ||
            (cat === 'tree' && txt === 'Trees') ||
            (cat === 'building' && txt === 'Buildings') ||
            (cat === 'decoration' && txt === 'Decorations') ||
            (cat === 'vehicle' && txt === 'Vehicles') ||
            (cat === 'animal' && txt === 'Animals');
        if (match) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    updateBuildMenu();
};

function addMoney(amount) {
    gameState.money += amount;
    updateUI();
    checkMissions('money', null);
}

function addXP(amount) {
    gameState.xp += amount;
    checkMissions('xp', null, amount);
    if (gameState.xp >= gameState.xpToNextLevel) {
        gameState.level++;
        gameState.xp -= gameState.xpToNextLevel;
        gameState.xpToNextLevel = Math.floor(gameState.xpToNextLevel * 1.5);
        
        // Use new modal instead of alert
        showLevelUpModal(gameState.level);
        
        updateBuildMenu(); // Unlock new items
        checkMissions('level', null);
    }
    updateUI();
}

function addDiamonds(amount) {
    const val = Math.max(0, Math.floor(amount || 0));
    gameState.diamonds = (gameState.diamonds || 0) + val;
    updateUI();
    saveGame();
}

window.giveDiamondsToPlayer = function(username, amount) {
    // Store gift in localStorage for the target player
    const GIFTS_KEY = 'farmSimDiamondGifts';
    const gifts = JSON.parse(localStorage.getItem(GIFTS_KEY) || '{}');
    if (!gifts[username]) gifts[username] = 0;
    gifts[username] += amount;
    localStorage.setItem(GIFTS_KEY, JSON.stringify(gifts));
    
    showNotification(`Gifted ${amount} diamonds to ${username}!`, 'success');
};

window.showLevelUpModal = function(level) {
    const modal = document.getElementById('level-up-modal');
    const content = document.getElementById('level-up-content');
    
    // Find what's unlocked at this level
    const unlockedItems = [];
    for (const [key, def] of Object.entries(BuildingTypes)) {
        if (def.level === level) {
            unlockedItems.push(def.name);
        }
    }
    
    let unlockText = "";
    if (unlockedItems.length > 0) {
        unlockText = `<div style="margin-top: 15px; font-size: 16px;">
            <p style="margin-bottom: 5px; color: #ecf0f1;">Unlocked:</p>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 5px;">
                ${unlockedItems.map(item => `<span style="background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 15px;">${item}</span>`).join('')}
            </div>
        </div>`;
    }

    if (modal && content) {
        content.innerHTML = `
            <p>You are now Level <strong style="font-size: 28px; color: #f1c40f;">${level}</strong></p>
            ${unlockText}
        `;
        modal.style.display = 'block';
        
        // Play success sound if available
        if (typeof SoundEffects !== 'undefined' && SoundEffects.playHarvest) {
            SoundEffects.playHarvest(); 
        }
    }
};

window.showNotification = function(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `notification-toast ${type}`;
    
    let icon = 'ℹ️';
    let title = 'Info';
    
    if (type === 'error') { icon = '⛔'; title = 'Error'; }
    else if (type === 'success') { icon = '✅'; title = 'Success'; }
    else if (type === 'warning') { icon = '⚠️'; title = 'Warning'; }
    
    div.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-msg">${msg}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        <div class="notification-progress">
            <div class="notification-progress-bar" style="animation-duration: ${duration}ms"></div>
        </div>
    `;

    container.appendChild(div);

    // Animate In
    requestAnimationFrame(() => {
        div.classList.add('show');
        
        // Play sound based on type
        if (typeof SoundEffects !== 'undefined') {
            if (type === 'error') SoundEffects.playTone(150, 'sawtooth', 0.1, 0.2);
            else if (type === 'success') SoundEffects.playTone(800, 'sine', 0.1, 0.1);
        }
    });

    // Auto Remove
    setTimeout(() => {
        div.classList.remove('show');
        setTimeout(() => {
            if (div.parentNode) div.parentNode.removeChild(div);
        }, 400); // Wait for transition
    }, duration);
};

window.showConfirmation = function(title, message, onConfirm) {
    const modal = document.getElementById('confirmation-modal');
    const titleEl = document.getElementById('confirmation-title');
    const contentEl = document.getElementById('confirmation-content');
    const okBtn = document.getElementById('confirmation-ok-btn');
    const cancelBtn = document.getElementById('confirmation-cancel-btn');

    if (!modal) return;

    titleEl.innerText = title;
    contentEl.innerText = message;

    // Remove old listeners to prevent stacking by cloning
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.onclick = function() {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    };

    newCancel.onclick = function() {
        modal.style.display = 'none';
    };

    modal.style.display = 'block';
};

function updateUI() {
    document.getElementById('money-display').innerText = gameState.money;
    const dEl = document.getElementById('diamonds-display');
    if (dEl) dEl.innerText = gameState.diamonds || 0;
    
    let dayPart = 'Day';
    let iconPath = '';
    
    // Sun Icon
    const sunPath = "M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z";
    // Moon Icon
    const moonPath = "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z";
    // Sunset/Cloud Icon
    const sunsetPath = "M20 18H4v-2h16v2zm0-5h-4v2h4v-2zm-6 0h-4v2h4v-2zm-6 0H4v2h4v-2zm-1.65-2.26l1.41-1.41 2.12 2.12-1.41 1.41-2.12-2.12zM12 6c-2.21 0-4 1.79-4 4h8c0-2.21-1.79-4-4-4zm6.65 4.74l1.41-1.41-2.12-2.12-1.41 1.41 2.12 2.12z";

    if (gameTime >= 5 && gameTime < 8) {
        dayPart = 'Morning';
        iconPath = "🌅"; // Emoji as fallback or icon
    } else if (gameTime >= 8 && gameTime < 17) {
        dayPart = 'Afternoon'; // Changed Day to Afternoon for variety
        iconPath = "☀️";
    } else if (gameTime >= 17 && gameTime < 20) {
        dayPart = 'Evening';
        iconPath = "🌇";
    } else {
        dayPart = 'Night';
        iconPath = "🌙";
    }

    const dayDisplay = document.getElementById('day-display');
    const dayIconSpan = document.getElementById('day-icon-span');
    
    if (dayDisplay) dayDisplay.innerText = dayPart;
    if (dayIconSpan) dayIconSpan.innerText = iconPath;

    document.getElementById('level-display').innerText = gameState.level;
    document.getElementById('player-name-display').innerText = gameState.playerName;
    
    const xpPercent = (gameState.xp / gameState.xpToNextLevel) * 100;
    document.getElementById('xp-bar').style.width = `${xpPercent}%`;
    document.getElementById('xp-text').innerText = `${Math.floor(gameState.xp)} / ${gameState.xpToNextLevel} XP`;
    const seasonNames = ['Spring','Summer','Autumn','Winter'];
    const idx = Math.floor(((gameState.day-1)%120)/30);
    const season = seasonNames[idx];
    const sd = document.getElementById('season-display');
    const wd = document.getElementById('weather-display');
    if (sd) sd.innerText = season;
    if (wd) wd.innerText = gameState.weather;

    // Power UI Update
    const elec = gameState.electricity || { produced: 0, consumed: 0 };
    const powerBar = document.getElementById('power-bar');
    const powerText = document.getElementById('power-text');
    
    if (powerBar && powerText) {
        const total = Math.max(elec.produced, elec.consumed, 1);
        const percent = Math.min(100, (elec.consumed / elec.produced) * 100);
        
        // If we are consuming more than producing, bar is full and red
        if (elec.consumed > elec.produced) {
             powerBar.style.width = '100%';
             powerBar.style.background = '#e74c3c'; // Red
             powerText.innerText = `⚡ ${elec.consumed} / ${elec.produced} KW (OVERLOAD)`;
             powerText.style.color = '#e74c3c';
        } else {
             powerBar.style.width = `${percent}%`;
             powerBar.style.background = '#f1c40f'; // Yellow/Electric
             powerText.innerText = `⚡ ${elec.consumed} / ${elec.produced} KW`;
             powerText.style.color = '#fff';
        }
    }

    // Admin/Owner Button Visibility
    const ownerBtn = document.getElementById('owner-btn');
    const adminBtn = document.getElementById('admin-btn');
    
    // Check Owner (Alex or Developer)
    const isOwner = (gameState.playerName === 'Alex' || gameState.playerName === 'Developer');
    if (ownerBtn) ownerBtn.style.display = isOwner ? 'flex' : 'none';
    
    // Check Admin (Role or Owner)
    const roles = JSON.parse(localStorage.getItem('farmSimRoles') || '{}');
    const isAdmin = roles[gameState.playerName] === 'admin';
    if (adminBtn) adminBtn.style.display = (isAdmin || isOwner) ? 'flex' : 'none';

        // VIP Panel Button Visibility
        const vipBtn = document.getElementById('vip-panel-btn');
        if (vipBtn) {
            if (roles[gameState.playerName] === 'vip' || isOwner || roles[gameState.playerName] === 'owner') {
                vipBtn.style.display = 'inline-flex';
                vipBtn.style.pointerEvents = 'auto';
                vipBtn.style.opacity = '1';
            } else {
                vipBtn.style.display = 'none';
                vipBtn.style.pointerEvents = 'none';
                vipBtn.style.opacity = '0.5';
            }
        }
}

// Export updateUI to window so HTML can call it
window.updateUI = updateUI;

// Clock updater: updates `#clock-display` every second with in-game time (`gameTime` 0..24)
function startClock() {
    if (window._clockStarted) return;
    window._clockStarted = true;
    setInterval(() => {
        try {
            const el = document.getElementById('clock-display');
            if (!el) return;
            // gameTime is 0..24. Convert to H:M:S
            const gt = (typeof gameTime === 'number') ? (gameTime % 24) : 0;
            const totalSeconds = Math.floor(gt * 3600);
            const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            const ss = String(totalSeconds % 60).padStart(2, '0');
            el.innerText = `${hh}:${mm}:${ss}`;
        } catch (e) {}
    }, 1000);
}

startClock();

// Note: removed system-clock updater so HUD uses in-game `gameTime` via startClock()

window.showCatalogue = function() {
    const modal = document.getElementById('catalogue-modal');
    const content = document.getElementById('catalogue-content');
    if (!modal || !content) return;
    modal.style.display = 'block';
    content.innerHTML = '';
    const cats = ['crop','tree','plot','building','decoration','vehicle','animal'];
    cats.forEach(c => {
        const section = document.createElement('div');
        section.style.margin = '10px 0';
        const title = document.createElement('h3');
        title.innerText = c.charAt(0).toUpperCase() + c.slice(1);
        section.appendChild(title);
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
        grid.style.gap = '8px';
        Object.entries(BuildingTypes).forEach(([key, def]) => {
            if (def.category !== c) return;
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.innerHTML = `
                <div class="shop-icon">${def.icon || '❓'}</div>
                <div class="shop-info">
                    <div class="shop-name">${def.name}</div>
                    <div class="shop-cost">$${def.cost || 0}</div>
                </div>
            `;
            grid.appendChild(card);
        });
        section.appendChild(grid);
        content.appendChild(section);
    });
};
function updateBuildMenu() {
    const menu = document.getElementById('build-menu');
    const rotateBtn = document.getElementById('rotate-btn');
    menu.innerHTML = '';
    
    // Diamonds exchange removed from shop

    if (isVisiting) {
        menu.innerHTML = '<div style="color:white; font-weight:bold; padding:10px;">Visiting Mode - Cannot Build</div>';
        if (rotateBtn) rotateBtn.style.display = 'none';
        return;
    }

    // Show/Hide Rotate Button
    if (rotateBtn) {
        if (selectedBuildingType || (moveMode && movingObject)) {
            rotateBtn.style.display = 'block';
        } else {
            rotateBtn.style.display = 'none';
        }
    }

    const items = Object.entries(BuildingTypes)
        .filter(([k, d]) => k !== 'main_house' && d.category === currentShopCategory)
        .filter(([k, d]) => {
            if (!currentShopSearchTerm) return true;
            const n = (d.name || '').toLowerCase();
            return n.includes(currentShopSearchTerm);
        });
    items.sort((a, b) => {
        const da = a[1], db = b[1];
        if (currentShopSort === 'price_asc') return (da.cost || 0) - (db.cost || 0);
        if (currentShopSort === 'price_desc') return (db.cost || 0) - (da.cost || 0);
        if (currentShopSort === 'level_asc') return (da.level || 0) - (db.level || 0);
        return (da.name || '').localeCompare(db.name || '');
    });
    items.forEach(([key, def]) => {
        const card = document.createElement('div');
        const isSelected = selectedBuildingType === key;
        const isLocked = gameState.level < def.level;
        card.className = `shop-card ${isSelected ? 'active' : ''} ${isLocked ? 'locked' : ''}`;
        if (isLocked) {
            card.innerHTML = `<div class="shop-icon">🔒</div><div class="shop-info"><div class="shop-name">${def.name}</div><div class="shop-cost">Lvl ${def.level}</div></div>`;
        } else {
            card.onclick = () => window.selectBuilding(key);
            const tag = def.category === 'animal' ? 'Animal' : def.category.charAt(0).toUpperCase() + def.category.slice(1);
            card.innerHTML = `<div class="shop-icon">${def.icon || '❓'}</div><div class="shop-info"><div class="shop-name">${def.name}</div><div class="shop-cost">$${def.cost}</div><div class="shop-desc">${def.desc || ''}</div><div class="shop-tag">${tag}</div></div>`;
        }
        menu.appendChild(card);
    });
    
    // Cancel button
    const cancelCard = document.createElement('div');
    cancelCard.className = 'shop-card';
    cancelCard.style.background = 'linear-gradient(to bottom, #e74c3c, #c0392b)';
    cancelCard.style.borderColor = '#e74c3c';
    cancelCard.onclick = () => window.selectBuilding(null);
    cancelCard.innerHTML = `
        <div class="shop-icon">❌</div>
        <div class="shop-info">
            <div class="shop-name">Cancel</div>
        </div>
    `;
    menu.appendChild(cancelCard);
}

// ------------------------------------------------------------------
// REDEEM CODES SYSTEM
// ------------------------------------------------------------------
const GameCodes = {
    "WELCOME": { money: 500, xp: 50 },
    "FARM2025": { money: 1000, xp: 100 },
    "HARVEST": { money: 200, xp: 200 },
    "RICH": { money: 5000, xp: 500 }, // Secret code
    "COWBOY": { money: 300, xp: 150 },
    "LEVEL5": { money: 1000, xp: 500 },
    "CARROT20": { money: 500, xp: 200 },
    "BARN": { money: 2000, xp: 300 },
    "TYCOON": { money: 5000, xp: 1000 }
};

window.showRedeemModal = function() {
    const modal = document.getElementById('redeem-modal');
    if (modal) {
        modal.style.display = 'block';
        const input = document.getElementById('redeem-input');
        if (input) input.value = '';
        const msg = document.getElementById('redeem-msg');
        if (msg) msg.innerText = '';
    }
}

window.redeemCodeAction = function() {
    const input = document.getElementById('redeem-input');
    const msg = document.getElementById('redeem-msg');
    
    if (!input || !msg) return;
    
    const code = input.value.trim().toUpperCase();
    
    if (!code) {
        msg.innerText = "Please enter a code";
        msg.style.color = "red";
        return;
    }
    
    if (!gameState.redeemedCodes) gameState.redeemedCodes = [];
    
    if (gameState.redeemedCodes.includes(code)) {
        msg.innerText = "Code already redeemed!";
        msg.style.color = "#e74c3c"; // Red
        return;
    }
    
    if (GameCodes[code]) {
        const reward = GameCodes[code];
        addMoney(reward.money);
        addXP(reward.xp);
        gameState.redeemedCodes.push(code);
        saveGame();
        
        msg.innerText = `Success! +$${reward.money}, +${reward.xp} XP`;
        msg.style.color = "#2ecc71"; // Green
        SoundEffects.playHarvest();
        
        // Close after a delay
        setTimeout(() => {
            if (msg.innerText.includes("Success")) {
                 closeModal('redeem-modal');
            }
        }, 1500);
    } else {
        msg.innerText = "Invalid Code";
        msg.style.color = "#e74c3c";
    }
};

window.showGuide = function() {
    const modal = document.getElementById('guide-modal');
    if (modal) {
        modal.style.display = 'block';
        // Reset to first tab if not already active
        const firstBtn = modal.querySelector('.tab-btn');
        if (firstBtn && !modal.querySelector('.tab-btn.active')) {
             switchGuideTab('basics', firstBtn);
        }
    }
};

// Diamonds utility
window.togglePayWithDiamonds = function(on) {
    payWithDiamonds = !!on;
};
function spendDiamonds(amount) {
    amount = Math.max(0, Math.floor(amount));
    if ((gameState.diamonds || 0) < amount) return false;
    gameState.diamonds -= amount;
    updateUI();
    saveGame();
    return true;
}
window.buyCoinsWithDiamonds = function(diamondCost, coins) {
    if (spendDiamonds(diamondCost)) {
        addMoney(coins);
        showNotification(`Exchanged ${diamondCost} 💎 for $${coins}`, 'success');
        if (typeof SoundEffects !== 'undefined') SoundEffects.playMoney();
    }
};
window.switchGuideTab = function(tabName, btnElement) {
    // Hide all sections
    document.querySelectorAll('.guide-section').forEach(el => el.style.display = 'none');
    
    // Show selected section
    const target = document.getElementById('guide-content-' + tabName);
    if (target) target.style.display = 'block';
    
    // Update buttons
    const guideModal = document.getElementById('guide-modal');
    if (guideModal) {
        guideModal.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    }
    if (btnElement) btnElement.classList.add('active');
};

// ------------------------------------------------------------------
// MISSION UI
// ------------------------------------------------------------------
function updateMissionUI() {
    const container = document.getElementById('mission-list');
    if (!container) return; // Should be added to HTML first
    
    container.innerHTML = '<h3>Missions</h3>';
    
    if (!gameState.missions) return;

    const available = gameState.missions.filter(m => !m.claimed).slice(0, 3); // Show top 3
    
    if (available.length === 0) {
        container.innerHTML += '<p>All missions complete!</p>';
        return;
    }

    available.forEach(m => {
        const div = document.createElement('div');
        div.className = 'mission-card';
        div.style.background = 'rgba(0,0,0,0.5)';
        div.style.padding = '5px';
        div.style.margin = '5px 0';
        div.style.borderRadius = '5px';
        div.style.fontSize = '12px';
        
        div.innerHTML = `
            <strong>${m.name}</strong><br>
            ${m.desc}<br>
            <span style="color:#f1c40f">Reward: $${m.reward}</span>
        `;
        container.appendChild(div);
    });
}
window.refreshLeaderboard = function() {
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    
    // Real Data from Cloud + Local
    const bots = MockCloud.getBots();
    const players = [
        { name: gameState.playerName, level: gameState.level, money: gameState.money },
        ...bots
    ];

    players.sort((a, b) => b.money - a.money);

    players.forEach((p, i) => {
        const tr = document.createElement('tr');
        if (p.name === gameState.playerName) tr.style.fontWeight = 'bold';
        tr.innerHTML = `<td>#${i+1}</td><td>${p.name}</td><td>${p.level}</td><td>$${p.money}</td>`;
        tbody.appendChild(tr);
    });
};

window.refreshFarmList = function() {
    const list = document.getElementById('farm-list');
    list.innerHTML = '';
    
    const farms = MockCloud.getBots();

    farms.forEach(f => {
        const div = document.createElement('div');
        div.className = 'farm-card';
        div.innerHTML = `
            <div>
                <strong>${f.name}'s Farm</strong><br>
                <small>Lvl: ${f.level} | $${f.money}</small>
            </div>
            <button class="action-btn" style="padding:5px 10px; font-size:12px;" onclick="visitFarm('${f.name}')">Visit</button>
        `;
        list.appendChild(div);
    });
};

window.expandFarm = function() {
    const cost = gameState.gridSize * 100;
    if (gameState.money >= cost) {
        showConfirmation("Expand Farm", `Expand Farm for $${cost}?`, () => {
            gameState.money -= cost;
            gameState.gridSize += 10;
            gridSize = gameState.gridSize; // Update global var
            
            // Rebuild Ground and Grid
            scene.remove(groundPlane);
            scene.remove(gridHelper);
            
            const geometry = new THREE.PlaneGeometry(gameState.gridSize * TILE_SIZE, gameState.gridSize * TILE_SIZE);
            const material = new THREE.MeshStandardMaterial({ color: 0x7CFC00, roughness: 1, metalness: 0 }); 
            groundPlane = new THREE.Mesh(geometry, material);
            groundPlane.rotation.x = -Math.PI / 2;
            groundPlane.receiveShadow = true;
            scene.add(groundPlane);
            
            gridHelper = new THREE.GridHelper(gameState.gridSize * TILE_SIZE, gameState.gridSize, 0x000000, 0x000000);
            gridHelper.material.opacity = 0.1;
            gridHelper.material.transparent = true;
            scene.add(gridHelper);
            
            // Re-apply weather visuals to ensure ground color matches weather
            applyWeatherVisuals();
            updateShadowBounds();

            updateUI();
            window.refreshProfile(); // Update button cost
            saveGame();
            SoundEffects.playBuild();
            showNotification("Farm Expanded!", "success");
        });
    } else {
        showNotification("Not enough money to expand! Cost: $" + cost, "error");
    }
};

window.refreshProfile = function() {
    const pc = document.getElementById('profile-content');
    if (!pc) return;
    const counts = {};
    gameState.buildings.forEach(b => {
        counts[b.type] = (counts[b.type] || 0) + 1;
    });
    const totalBuildings = gameState.buildings.length;
    const expandCost = gameState.gridSize * 100;

        // Role detection
        const roles = JSON.parse(localStorage.getItem('farmSimRoles') || '{}');
        let roleBadge = '';
        let roleClass = '';
        if (gameState.playerName === 'Alex' || gameState.playerName === 'Developer' || roles[gameState.playerName] === 'owner') {
            roleBadge = '<span style="background: linear-gradient(135deg, #f1c40f, #e67e22); color: #fff; padding: 4px 10px; border-radius: 8px; font-weight: bold; margin-left: 10px;">👑 OWNER</span>';
            roleClass = 'profile-owner';
        } else if (roles[gameState.playerName] === 'admin') {
            roleBadge = '<span style="background: linear-gradient(135deg, #3498db, #2980b9); color: #fff; padding: 4px 10px; border-radius: 8px; font-weight: bold; margin-left: 10px;">🛡️ ADMIN</span>';
            roleClass = 'profile-admin';
        } else if (roles[gameState.playerName] === 'vip') {
            roleBadge = '<span style="background: linear-gradient(135deg, #e91e63, #f1c40f); color: #fff; padding: 4px 10px; border-radius: 8px; font-weight: bold; margin-left: 10px;">💎 VIP</span>';
            roleClass = 'profile-vip';
        }

    pc.innerHTML = `
            <div class="profile-container ${roleClass}">
                <div class="profile-header">
                    <div class="profile-avatar-large">👤</div>
                    <div class="profile-title">
                        <h3>${gameState.playerName} ${roleBadge}</h3>
                        <div class="profile-subtitle">Farmer Level ${gameState.level}</div>
                    </div>
                </div>
            <div class="profile-stats-grid">
                <div class="profile-stat-box">
                    <div class="profile-stat-value">$${gameState.money}</div>
                    <div class="profile-stat-label">Money</div>
                </div>
                <div class="profile-stat-box">
                    <div class="profile-stat-value">${gameState.day}</div>
                    <div class="profile-stat-label">Day</div>
                </div>
                <div class="profile-stat-box">
                    <div class="profile-stat-value">${gameState.gridSize}x${gameState.gridSize}</div>
                    <div class="profile-stat-label">Farm Size</div>
                </div>
                <div class="profile-stat-box">
                    <div class="profile-stat-value">${totalBuildings}</div>
                    <div class="profile-stat-label">Total Buildings</div>
                </div>
            </div>
            <div class="profile-actions">
                <button class="expand-btn-modern" onclick="expandFarm()">
                   📐 Expand Farm ($${expandCost})
                </button>
            </div>
        </div>
    `;
};
const npcDialogs = [
    "Beautiful day on the farm!",
    "Have you harvested the corn?",
    "The animals look happy today.",
    "I love fresh strawberries.",
    "Time for a break!",
    "Clouds are moving fast.",
    "That barn looks sturdy.",
    "We should plant more wheat.",
    "Check the market prices."
];
function showNPCBubble(npc) {
    const el = document.createElement('div');
    el.className = 'speech-bubble';
    el.innerText = npcDialogs[Math.floor(Math.random() * npcDialogs.length)];
    document.body.appendChild(el);
    npc.bubbleEl = el;
    npc.bubbleExpire = Date.now() + 3000 + Math.random() * 2000;
    npc.nextSpeak = Date.now() + 8000 + Math.random() * 8000;
}
function updateSpeechBubbles() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    npcs.forEach(npc => {
        if (!npc.bubbleEl && Date.now() > npc.nextSpeak) {
            showNPCBubble(npc);
        }
        if (npc.bubbleEl) {
            const pos = npc.mesh.position.clone();
            pos.y += 7;
            pos.project(camera);
            const x = (pos.x + 1) / 2 * w;
            const y = (1 - pos.y) / 2 * h;
            npc.bubbleEl.style.left = `${x}px`;
            npc.bubbleEl.style.top = `${y}px`;
            if (Date.now() > npc.bubbleExpire) {
                if (npc.bubbleEl.parentNode) npc.bubbleEl.parentNode.removeChild(npc.bubbleEl);
                npc.bubbleEl = null;
            }
        }
    });
}
window.getInventoryLimit = function() {
    const sL = gameState.siloLevel || 1;
    const wL = gameState.warehouseLevel || 1;
    const siloCount = (gameState.buildings || []).filter(b => b.type === 'silo').length;
    const warehouseCount = (gameState.buildings || []).filter(b => b.type === 'warehouse').length;
    return 50 + (siloCount * sL * 50) + (warehouseCount * wL * 100);
};

function addInventoryItem(type, count) {
    const currentTotal = Object.values(gameState.inventory).reduce((a, b) => a + b, 0);
    const limit = window.getInventoryLimit();
    
    if (currentTotal + count > limit) {
        return false;
    }

    if (!gameState.inventory[type]) gameState.inventory[type] = 0;
    gameState.inventory[type] += count;
    return true;
}
// Forcefully add to inventory ignoring capacity limits (used for NPC collection)
function forceAddInventoryItem(type, count) {
    if (!gameState.inventory[type]) gameState.inventory[type] = 0;
    gameState.inventory[type] += count;
    window.refreshInventory && window.refreshInventory();
    return true;
}
window.refreshInventory = function() {
    const ic = document.getElementById('inventory-content');
    if (!ic) return;
    ic.innerHTML = '';
    const entries = Object.entries(gameState.inventory);
    
    // Capacity & Total Value
    const currentTotal = Object.values(gameState.inventory).reduce((a, b) => a + b, 0);
    const limit = window.getInventoryLimit();
    
    let total = 0;
    entries.forEach(([type, qty]) => {
        const def = BuildingTypes[type];
        const price = Math.floor((def ? def.cost : 10) * 0.6);
        total += price * qty;
    });

    // Update total display (Capacity + Value)
    let totalDisplay = document.getElementById('inventory-total');
    if (!totalDisplay) {
        totalDisplay = document.createElement('div');
        totalDisplay.id = 'inventory-total';
        ic.parentNode.insertBefore(totalDisplay, ic.nextSibling); 
    }
    
    const capColor = currentTotal >= limit ? '#e74c3c' : '#2c3e50';
    totalDisplay.innerHTML = `
        <div style="display:flex; justify-content:space-around;">
            <span style="color:${capColor}">📦 ${currentTotal} / ${limit}</span>
            <span>💰 $${total}</span>
        </div>
    `;
    
    if (entries.length === 0) {
        ic.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #7f8c8d;">Inventory is empty</div>';
        return;
    }

    entries.forEach(([type, qty]) => {
        const def = BuildingTypes[type];
        const price = Math.floor((def ? def.cost : 10) * 0.6);
        
        const div = document.createElement('div');
        div.className = 'inventory-card';
        div.innerHTML = `
            <div class="inventory-count">${qty}</div>
            <div class="inventory-icon">${def ? def.icon : '📦'}</div>
            <div class="inventory-name">${def ? def.name : type}</div>
            <div class="inventory-value">$${price}</div>
               <button class="action-btn" style="margin-top:8px;" onclick="window.sellInventoryItem('${type}')">Sell</button>
        `;
        ic.appendChild(div);
    });
};
window.sellInventory = function() {
    let total = 0;
    Object.entries(gameState.inventory).forEach(([type, qty]) => {
        const def = BuildingTypes[type];
        const price = Math.floor((def ? def.cost : 10) * 0.6);
        total += price * qty;
        checkMissions('sell', type, qty);
    });
    if (total > 0) {
        addMoney(total);
        SoundEffects.playHarvest();
        gameState.inventory = {};
        saveGame();
        window.refreshInventory();
    }
};
window.toggleSellMode = function() {
    console.log('toggleSellMode called. previous sellMode:', sellMode);
    sellMode = !sellMode;
    console.log('toggleSellMode changed. new sellMode:', sellMode);
    
    // Disable Move Mode if active - directly set, don't call toggleMoveMode to avoid recursion
    if (sellMode && moveMode) {
        moveMode = false;
        const moveBtn = document.getElementById('move-btn');
        if (moveBtn) moveBtn.classList.remove('active-move');
        
        if (movingObject) {
            setCropHighlight(movingObject, false);
            movingObject.position.y = 0;
            movingObject.traverse(c => {
                if (c.isMesh && c.material) {
                    c.material.transparent = false;
                    c.material.opacity = 1.0;
                    if (c.material.emissive) c.material.emissive.setHex(0x000000);
                }
            });
            movingObject = null;
        }
        const rBtn = document.getElementById('rotate-btn');
        if (rBtn) rBtn.style.display = 'none';
        if (gridHelper) gridHelper.visible = false;
    }

    const btn = document.getElementById('sell-btn');
    if (btn) {
        if (sellMode) btn.classList.add('active-sell');
        else btn.classList.remove('active-sell');
    }
    
    if (sellMode) {
        // Deselect any active building/seed
        if (selectedBuildingType) {
            window.selectBuilding(null);
        }
    }

    if (renderer && renderer.domElement) {
        renderer.domElement.style.cursor = sellMode ? 'crosshair' : 'default';
    }
};

window.toggleMoveMode = function() {
    console.log("toggleMoveMode called, moveMode was:", moveMode);
    moveMode = !moveMode;
    console.log("moveMode is now:", moveMode);
    
    // Disable Sell Mode if active - directly set, don't call toggleSellMode to avoid recursion
    if (moveMode && sellMode) {
        sellMode = false;
        const sellBtn = document.getElementById('sell-btn');
        if (sellBtn) sellBtn.classList.remove('active-sell');
    }

    const btn = document.getElementById('move-btn');
    if (btn) {
        if (moveMode) {
            btn.classList.add('active-move');
            console.log("Move mode activated - button class updated");
        }
        else {
            btn.classList.remove('active-move');
            console.log("Move mode deactivated - button class removed");
        }
    }
    
    if (!moveMode && movingObject) {
        setCropHighlight(movingObject, false);
        
        // Reset Visuals
        movingObject.position.y = 0;
        movingObject.traverse(c => {
            if (c.isMesh && c.material) {
                c.material.transparent = false;
                c.material.opacity = 1.0;
                if (c.material.emissive) c.material.emissive.setHex(0x000000);
            }
        });
        
        movingObject = null;
        
        const rBtn = document.getElementById('rotate-btn');
        if (rBtn) rBtn.style.display = 'none';
        
        if (gridHelper) gridHelper.visible = false; // Hide grid when move mode disabled
    }

    if (moveMode) {
        if (selectedBuildingType) {
            window.selectBuilding(null);
        }
        if (gridHelper) gridHelper.visible = false; // Will show when object is selected
    }
    
    if (renderer && renderer.domElement) {
        renderer.domElement.style.cursor = moveMode ? 'move' : 'default';
    }
};

window.visitFarm = function(ownerName) {
    document.getElementById('world-map-modal').style.display = 'none';
    
    if (isVisiting && ownerName === gameState.playerName) {
        returnHome();
        return;
    }
    
    enterVisitMode(ownerName);
};

function enterVisitMode(ownerName) {
    window.selectBuilding(null); // Clear any selection
    isVisiting = true;
    document.getElementById('return-home-btn').style.display = 'block';
    
    // Clear current scene objects (except ground/lights)
    clearSceneBuildings();

    // Load farm from Cloud
    const bots = MockCloud.getBots();
    const target = bots.find(b => b.name === ownerName);
    
    if (target) {
        // Render target farm buildings
        target.buildings.forEach(b => {
            // Only render if type exists (safety check)
            if (BuildingTypes[b.type]) {
                createBuildingMesh(b.type, b.x, b.z);
            }
        });
        showNotification(`Arrived at ${ownerName}'s Farm!`, "success");
    } else {
        showNotification("Farm not found! Returning home...", "error");
        returnHome();
    }
    
    updateBuildMenu(); // Disable building
}

window.loadHomeFarm = function() {
    window.selectBuilding(null); // Clear any selection
    isVisiting = false;
    document.getElementById('return-home-btn').style.display = 'none';
    
    clearSceneBuildings();
    
    // Restore home buildings
    gameState.buildings.forEach(b => {
        createBuildingMesh(b.type, b.x, b.z);
    });
    
    updateBuildMenu();
};

function clearSceneBuildings() {
    objects.forEach(obj => scene.remove(obj));
    objects.forEach(obj => {
        if (obj.userData && obj.userData.timerEl && obj.userData.timerEl.parentNode) {
            obj.userData.timerEl.parentNode.removeChild(obj.userData.timerEl);
            obj.userData.timerEl = null;
        }
    });
    objects = [];
    
    npcs.forEach(npc => scene.remove(npc.mesh));
    npcs.forEach(npc => { if (npc.bubbleEl && npc.bubbleEl.parentNode) npc.bubbleEl.parentNode.removeChild(npc.bubbleEl); });
    npcs = [];
    animals.forEach(a => scene.remove(a.mesh));
    animals = [];
}

// ------------------------------------------------------------------
// HOUSE UPGRADE SYSTEM
// ------------------------------------------------------------------
window.showHouseUpgradeMenu = function() {
    const modal = document.getElementById('house-upgrade-modal');
    const content = document.getElementById('house-upgrade-content');
    const btn = document.getElementById('house-upgrade-btn');
    
    modal.style.display = 'block';
    
    const currentLevel = gameState.mainHouseLevel || 1;
    const nextLevel = currentLevel + 1;
    
    let html = `<p style="font-size: 16px; margin-bottom: 20px;">Current Level: <strong style="color:#f1c40f">${currentLevel}</strong></p>`;
    
    if (currentLevel >= 15) {
        html += `<p style="font-size: 18px; color: #2ecc71;">Maximum Level Reached!</p>`;
        btn.style.display = 'none';
    } else {
        const reqs = MainHouseLevels[nextLevel];
        if (!reqs) {
             html += `<p>Coming Soon...</p>`;
             btn.style.display = 'none';
        } else {
            btn.style.display = 'block';
            html += `<h3 style="margin-bottom: 15px;">Upgrade to Level ${nextLevel}</h3>`;
            
            // Cost Display
            const canAfford = gameState.money >= reqs.cost;
            html += `
                <div class="upgrade-cost-display" style="border: 1px solid ${canAfford ? '#2ecc71' : '#e74c3c'}">
                    <span>💰 Cost:</span>
                    <span style="color:${canAfford ? '#2ecc71' : '#e74c3c'}">$${reqs.cost}</span>
                </div>
            `;
            
            html += `<h4 style="text-align: left; margin-bottom: 10px;">Requirements:</h4>`;
            html += `<ul class="upgrade-req-list">`;
            
            let canUpgrade = true;
            if (!canAfford) canUpgrade = false;
            
            for (const [crop, amount] of Object.entries(reqs.crops)) {
                const have = gameState.inventory[crop] || 0;
                const ok = have >= amount;
                if (!ok) canUpgrade = false;
                
                const cropDef = BuildingTypes[crop];
                const cropName = cropDef ? cropDef.name : crop;
                const icon = cropDef ? cropDef.icon : '❓';
                
                html += `
                    <li class="upgrade-req-item" style="border-left: 4px solid ${ok ? '#2ecc71' : '#e74c3c'}">
                        <span class="upgrade-req-icon">${icon}</span>
                        <div class="upgrade-req-info">
                            <span class="upgrade-req-name">${cropName}</span>
                            <span class="upgrade-req-count" style="color:${ok ? '#2ecc71' : '#e74c3c'}">
                                ${have} / ${amount}
                            </span>
                        </div>
                        <span class="upgrade-status-icon" style="color:${ok ? '#2ecc71' : '#e74c3c'}">
                            ${ok ? '✔' : '✖'}
                        </span>
                    </li>
                `;
            }
            html += `</ul>`;
            
            btn.disabled = !canUpgrade;
            if (!canUpgrade) {
                btn.style.background = '#95a5a6';
                btn.style.cursor = 'not-allowed';
                btn.innerText = "Requirements Not Met";
            } else {
                btn.style.background = ''; // Reset to default CSS
                btn.style.cursor = 'pointer';
                btn.innerText = "Upgrade House";
            }
        }
    }
    
    content.innerHTML = html;
};

window.upgradeHouseAction = function() {
    const currentLevel = gameState.mainHouseLevel || 1;
    const nextLevel = currentLevel + 1;
    const reqs = MainHouseLevels[nextLevel];
    
    if (!reqs) return;
    
    // Validate again
    if (gameState.money < reqs.cost) return;
    for (const [crop, amount] of Object.entries(reqs.crops)) {
        if ((gameState.inventory[crop] || 0) < amount) return;
    }
    
    // Deduct
    addMoney(-reqs.cost);
    for (const [crop, amount] of Object.entries(reqs.crops)) {
        gameState.inventory[crop] -= amount;
    }
    
    // Level Up
    gameState.mainHouseLevel = nextLevel;
    if (reqs.growthRate) {
        gameState.growthRate = reqs.growthRate;
        showNotification(`Upgraded to Level ${nextLevel}! Growth Rate x${reqs.growthRate}`, "success");
    }
    SoundEffects.playBuild();
    
    // Refresh Scene Object
    // Update ALL main house instances
    const houses = objects.filter(o => o.userData.type === 'main_house');
    houses.forEach(h => {
        const x = h.position.x;
        const z = h.position.z;
        removeObjectFromScene(h);
        createBuildingMesh('main_house', x, z);
    });
    
    // Refresh UI
    showHouseUpgradeMenu();
    saveGame();
    
    // Check if max level reached
    if (nextLevel === 15) {
        showNotification("Congratulations! You have fully upgraded your Main House!", "success");
    }
};

// ------------------------------------------------------------------
// MARKET / PLAYER SELL + NPC BUYER
// ------------------------------------------------------------------
window.showMarketModal = function() {
    let modal = document.getElementById('market-modal');
    if (!modal) {
        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'market-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.left = 0; backdrop.style.top = 0; backdrop.style.right = 0; backdrop.style.bottom = 0;
        backdrop.style.background = 'rgba(10,12,18,0.45)';
        backdrop.style.zIndex = 9998;
        document.body.appendChild(backdrop);

        modal = document.createElement('div');
        modal.id = 'market-modal';
        modal.style.position = 'fixed';
        modal.style.left = '50%';
        modal.style.top = '50%';
        modal.style.transform = 'translate(-50%,-50%)';
        modal.style.background = 'linear-gradient(180deg,#ffffff,#f7fafc)';
        modal.style.padding = '18px';
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 12px 40px rgba(7,14,28,0.5)';
        modal.style.zIndex = 9999;
        modal.style.maxHeight = '78vh';
        modal.style.overflow = 'auto';
        modal.style.display = 'flex';
        modal.style.gap = '16px';
        modal.style.width = '760px';
        modal.style.maxWidth = '92%';

        modal.innerHTML = `
            <div style="width:320px; min-width:260px; display:flex; flex-direction:column; align-items:center; gap:8px">
                <div style="width:100%; display:flex; justify-content:space-between; align-items:center">
                    <h3 style="margin:0">Market</h3>
                    <button id="market-close-btn" style="background:transparent; border:none; font-size:18px; cursor:pointer">✕</button>
                </div>
                <canvas id="market-preview-canvas" width="320" height="240" style="border-radius:8px; background:#eef3f7; box-shadow: 0 8px 18px rgba(20,30,40,0.12)"></canvas>
                <div id="market-preview-label" style="font-size:14px; color:#333;">Select an item to preview</div>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:8px">
                <div id="market-form" style="display:flex; gap:8px; align-items:center"></div>
                <div id="market-status" style="min-height:24px; color:#2c3e50; font-size:13px;"></div>
                <div id="market-listings" style="display:block; overflow:auto; max-height:46vh; padding-top:6px"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    // Build form
    const form = document.getElementById('market-form');
    form.innerHTML = '';
    const select = document.createElement('select');
    select.id = 'market-item-select';
    // Build a combined set of possible sellable items: known BuildingTypes plus anything in player's inventory
    const itemsSet = new Set([...Object.keys(BuildingTypes || {}), ...Object.keys(gameState.inventory || {})]);
    itemsSet.forEach(key => {
        const def = BuildingTypes[key];
        const haveQty = (gameState.inventory && gameState.inventory[key]) ? gameState.inventory[key] : 0;
        const opt = document.createElement('option');
        opt.value = key;
        opt.text = (def && def.name) ? def.name : key;
        if (haveQty > 0) opt.text += ` (${haveQty})`;
        select.appendChild(opt);
    });
    // Update qty input max when selection changes
    select.onchange = () => {
        const selectedKey = select.value;
        const have = (gameState.inventory && gameState.inventory[selectedKey]) ? gameState.inventory[selectedKey] : 0;
        const qtyEl = document.getElementById('market-qty');
        if (qtyEl) {
            qtyEl.max = have > 0 ? have : 9999;
            qtyEl.value = Math.min(Math.max(1, qtyEl.value || 1), qtyEl.max);
        }
        // update preview label and preview mesh
        try { setPreviewItem(selectedKey); } catch(e) {}
        const labelEl = document.getElementById('market-preview-label');
        if (labelEl) labelEl.innerText = (BuildingTypes[selectedKey] && BuildingTypes[selectedKey].name) ? BuildingTypes[selectedKey].name : selectedKey;
    };
    const qty = document.createElement('input'); qty.type = 'number'; qty.min = 1; qty.value = 1; qty.style.width = '60px'; qty.id = 'market-qty';
    const price = document.createElement('input'); price.type = 'number'; price.min = 1; price.value = 10; price.style.width = '80px'; price.id = 'market-price';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerText = 'List Item';
    btn.onclick = () => {
        try {
            const itemEl = document.getElementById('market-item-select');
            const qtyEl = document.getElementById('market-qty');
            const priceEl = document.getElementById('market-price');
            const statusEl = document.getElementById('market-status');
            if (!itemEl || !qtyEl || !priceEl) {
                if (statusEl) statusEl.innerText = 'Market form elements missing';
                showNotification('Market form elements missing', 'error');
                console.error('Market: missing form elements', { itemEl, qtyEl, priceEl });
                return;
            }
            const item = itemEl.value;
            const q = parseInt(qtyEl.value) || 0;
            const p = parseInt(priceEl.value) || 0;
            console.log('Market: attempting to list', { item, q, p, inventory: gameState.inventory });
            const ok = addMarketListing(item, q, p);
            if (ok) {
                if (statusEl) statusEl.innerText = `Listed ${q} x ${item} for $${p}`;
                qtyEl.value = 1;
                try { if (window.updateMarketSelect) window.updateMarketSelect(); } catch(e) { console.warn('updateMarketSelect failed', e); }
                try { if (typeof renderMarketListings === 'function') renderMarketListings(); } catch(e) { console.warn('renderMarketListings failed', e); }
            } else {
                // Do not overwrite a detailed status message set by addMarketListing.
                if (statusEl && (!statusEl.innerText || statusEl.innerText.trim() === '')) {
                    statusEl.innerText = 'Failed to list item';
                }
            }
        } catch (err) {
            console.error('Market list error', err);
            showNotification('Failed to list item', 'error');
            const statusEl = document.getElementById('market-status'); if (statusEl) statusEl.innerText = 'Failed to list item';
        }
    };
    form.appendChild(select); form.appendChild(qty); form.appendChild(price); form.appendChild(btn);

    // wire preview: initialize preview renderer once
    const canvas = document.getElementById('market-preview-canvas');
    try {
        initMarketPreview(canvas);
    } catch(e) { console.warn('Preview init failed', e); }
    // Initialize selection state (qty max + preview)
    try { if (typeof select.onchange === 'function') select.onchange(); } catch(e) {}


// Update market select options (used after listings change)
window.updateMarketSelect = function() {
    const select = document.getElementById('market-item-select');
    const qtyEl = document.getElementById('market-qty');
    if (!select) return;
    const prev = select.value;
    // Rebuild options from BuildingTypes and current inventory
    select.innerHTML = '';
    const itemsSet = new Set([...Object.keys(BuildingTypes || {}), ...Object.keys(gameState.inventory || {})]);
    itemsSet.forEach(key => {
        const def = BuildingTypes[key];
        const haveQty = (gameState.inventory && gameState.inventory[key]) ? gameState.inventory[key] : 0;
        const opt = document.createElement('option');
        opt.value = key;
        opt.text = (def && def.name) ? def.name : key;
        if (haveQty > 0) opt.text += ` (${haveQty})`;
        select.appendChild(opt);
    });
    // restore previous selection where possible
    try { select.value = prev; } catch(e) {}
    // trigger onchange to update qty and preview
    try { if (typeof select.onchange === 'function') select.onchange(); } catch(e) {}
};
    renderMarketListings();
    modal.style.display = 'flex';

    // close handler should teardown preview
    const closeBtn = document.getElementById('market-close-btn');
    if (closeBtn) closeBtn.onclick = () => { document.getElementById('market-modal').style.display = 'none'; const bd = document.getElementById('market-backdrop'); if (bd) bd.parentNode.removeChild(bd); disposeMarketPreview(); };
};

window.addMarketListing = function(item, qty, price) {
    console.log('addMarketListing called', { item, qty, price, inventory: gameState.inventory });
    try {
        if (!item || qty <= 0 || price <= 0) {
            const st = document.getElementById('market-status');
            if (st) st.innerText = 'Invalid listing parameters (check quantity and price)';
            showNotification('Invalid listing parameters', 'error');
            console.warn('Market: invalid listing params', { item, qty, price });
            return false;
        }
        // Robust lookup: prefer exact key, else try case-insensitive or name match
        let actualKey = item;
        const inv = gameState.inventory || {};
        if (inv[actualKey] === undefined) {
            const lower = actualKey.toLowerCase();
            const matchKey = Object.keys(inv).find(k => k.toLowerCase() === lower);
            if (matchKey) actualKey = matchKey;
            else {
                // Try matching by BuildingTypes name -> inventory key
                const byName = Object.keys(inv).find(k => (BuildingTypes[k] && BuildingTypes[k].name && BuildingTypes[k].name.toLowerCase() === lower));
                if (byName) actualKey = byName;
            }
        }

        // If we still don't have a matching inventory key, surface diagnostics so the UI shows why
        if (inv[actualKey] === undefined) {
            const st = document.getElementById('market-status');
            const available = Object.keys(inv).join(', ') || '(none)';
            const msg = `Unknown item key "${item}". Resolved: "${actualKey}". Inventory keys: ${available}`;
            if (st) st.innerText = msg;
            showNotification(msg, 'error');
            console.warn('Market: unknown inventory key', { item, actualKey, inventoryKeys: Object.keys(inv) });
            return false;
        }

        const have = gameState.inventory[actualKey] || 0;
        if (have < qty) {
            const st = document.getElementById('market-status');
            if (st) st.innerText = `Not enough ${actualKey} in inventory (have ${have})`;
            showNotification('Not enough items in inventory to list', 'error');
            console.warn('Market: insufficient inventory', { actualKey, have, qty });
            return false;
        }
        // remove from inventory (placed for sale)
        gameState.inventory[actualKey] = have - qty;
        const id = Date.now() + Math.floor(Math.random()*999);
        gameState.marketListings.push({ id, item: actualKey, qty, price });
        if (typeof saveGame === 'function') saveGame();
        showNotification(`Listed ${qty} x ${actualKey} for $${price} each`, 'success');
        const st = document.getElementById('market-status');
        if (st) st.innerText = `Listed ${qty} x ${actualKey} for $${price} each`;
        // Refresh market UI (select counts + listings)
        try { if (window.updateMarketSelect) window.updateMarketSelect(); } catch(e) { console.warn('updateMarketSelect failed', e); }
        try { if (typeof renderMarketListings === 'function') renderMarketListings(); } catch(e) { console.warn('renderMarketListings failed', e); }
        return true;
    } catch (err) {
        const st = document.getElementById('market-status');
        const msg = `Exception listing item: ${err && err.message ? err.message : String(err)}`;
        if (st) st.innerText = msg;
        showNotification(msg, 'error');
        console.error('Market: addMarketListing exception', err);
        return false;
    }
};

function renderMarketListings() {
    const el = document.getElementById('market-listings');
    if (!el) return;
    el.innerHTML = '';
    if (!gameState.marketListings || gameState.marketListings.length === 0) {
        el.innerHTML = '<p>No listings</p>';
        return;
    }
    gameState.marketListings.forEach(list => {
        const row = document.createElement('div');
        row.style.borderBottom = '1px solid #ddd';
        row.style.padding = '6px 0';
        const def = BuildingTypes[list.item] || { name: list.item };
        row.innerHTML = `<strong>${def.name}</strong> — ${list.qty} @ $${list.price}`;
        const buyBtn = document.createElement('button'); buyBtn.style.float = 'right'; buyBtn.innerText = 'Cancel';
        buyBtn.onclick = () => {
            // return unsold items to inventory
            gameState.inventory[list.item] = (gameState.inventory[list.item] || 0) + list.qty;
            gameState.marketListings = gameState.marketListings.filter(l => l.id !== list.id);
            renderMarketListings();
            try { window.updateMarketSelect && window.updateMarketSelect(); } catch(e) {}
            saveGame();
        };
        row.appendChild(buyBtn);
        el.appendChild(row);
    });
}

let _marketTimer = 0;
function updateMarket(delta) {
    // delta is ms between frames
    _marketTimer += delta || 100;
    if (_marketTimer < 4000) return; // every ~4s try a purchase
    _marketTimer = 0;
    if (!gameState.marketListings || gameState.marketListings.length === 0) return;
    // NPC buyer: pick a random listing and buy 1 unit
    const idx = Math.floor(Math.random() * gameState.marketListings.length);
    const listing = gameState.marketListings[idx];
    if (!listing) return;
    // Simulate NPC coin pool (they always have money)
    // Transfer price to player, decrement qty
    const pay = listing.price;
    addMoney(pay);
    listing.qty -= 1;
    showNotification(`A farmer bought 1 x ${listing.item} for $${pay}`, 'info');
    if (listing.qty <= 0) {
        gameState.marketListings.splice(idx, 1);
    }
    saveGame();
    // If market modal is open, refresh it
    if (document.getElementById('market-modal') && document.getElementById('market-modal').style.display !== 'none') {
        renderMarketListings();
        try { window.updateMarketSelect && window.updateMarketSelect(); } catch(e) {}
    }
}

// ------------------ Market Preview 3D (small scene in modal) ------------------
let marketPreviewScene = null;
let marketPreviewCamera = null;
let marketPreviewRenderer = null;
let marketPreviewMesh = null;
let marketPreviewLastResize = 0;

function createPreviewGeometryFor(key) {
    const def = BuildingTypes[key] || {};
    // map categories to simple representative geometry
    if (def.category === 'crop') {
        // variety: carrot, tomato, corn, etc.
        if (key.includes('carrot')) return new THREE.ConeGeometry(0.2, 0.6, 10);
        if (key.includes('wheat')) return new THREE.CylinderGeometry(0.04, 0.06, 0.7, 6);
        if (key.includes('tomato')) return new THREE.SphereGeometry(0.22, 12, 12);
        if (key.includes('corn')) return new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8);
        if (key.includes('pumpkin')) return new THREE.SphereGeometry(0.35, 12, 12);
        if (key.includes('strawberry')) return new THREE.ConeGeometry(0.12, 0.24, 8);
        return new THREE.BoxGeometry(0.28, 0.28, 0.28);
    }
    if (def.category === 'tree') return new THREE.SphereGeometry(0.5, 18, 12);
    if (def.category === 'building') return new THREE.BoxGeometry(0.6, 0.6, 0.6);
    // Try mapping some common inventory-only keys to friendlier preview geometry
    const lower = (key || '').toLowerCase();
    if (lower.includes('milk') || lower.includes('bottle')) return new THREE.CylinderGeometry(0.15, 0.15, 0.38, 10);
    if (lower.includes('egg')) return new THREE.SphereGeometry(0.12, 10, 10);
    if (lower.includes('water') || lower.includes('bucket')) return new THREE.CylinderGeometry(0.18, 0.18, 0.25, 10);
    if (lower.includes('seed') || lower.includes('seeds')) return new THREE.BoxGeometry(0.18, 0.12, 0.18);
    if (lower.includes('egg') || lower.includes('yolk')) return new THREE.SphereGeometry(0.12, 10, 10);
    if (lower.includes('coin') || lower.includes('gold') || lower.includes('money')) return new THREE.TorusGeometry(0.12, 0.04, 8, 24);
    return new THREE.BoxGeometry(0.3, 0.3, 0.3);
}

function initMarketPreview(canvas) {
    if (!canvas) return;
    // create lightweight scene
    marketPreviewScene = new THREE.Scene();
    marketPreviewCamera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 100);
    marketPreviewCamera.position.set(1.2, 0.8, 1.2);
    marketPreviewCamera.lookAt(0, 0.2, 0);
    marketPreviewRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    marketPreviewRenderer.setPixelRatio(window.devicePixelRatio || 1);
    marketPreviewRenderer.setSize(canvas.width, canvas.height);
    // lights
    const amb = new THREE.AmbientLight(0xffffff, 0.7); marketPreviewScene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6); dir.position.set(2, 3, 1); marketPreviewScene.add(dir);
    // ground
    const ground = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshStandardMaterial({ color: 0xf3f5f6 })); ground.rotation.x = -Math.PI/2; ground.position.y = 0; marketPreviewScene.add(ground);
}

function setPreviewItem(key) {
    if (!marketPreviewScene) return;
    if (marketPreviewMesh) { marketPreviewScene.remove(marketPreviewMesh); marketPreviewMesh.geometry && marketPreviewMesh.geometry.dispose(); marketPreviewMesh.material && marketPreviewMesh.material.dispose(); marketPreviewMesh = null; }
    const geo = createPreviewGeometryFor(key);
    // Pick a sensible color: prefer BuildingTypes color, else map common inventory names
    let color = (BuildingTypes[key] && BuildingTypes[key].color) ? BuildingTypes[key].color : 0x8bc34a;
    const lk = (key || '').toLowerCase();
    if (! (BuildingTypes[key] && BuildingTypes[key].color)) {
        if (lk.includes('milk') || lk.includes('bottle')) color = 0xffffff;
        else if (lk.includes('egg')) color = 0xfff1a8;
        else if (lk.includes('water') || lk.includes('bucket')) color = 0x74b9ff;
        else if (lk.includes('seed')) color = 0x9ccc65;
        else if (lk.includes('coin') || lk.includes('gold') || lk.includes('money')) color = 0xffd54f;
    }
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.05 });
    marketPreviewMesh = new THREE.Mesh(geo, mat);
    marketPreviewMesh.position.y = 0.2;
    marketPreviewScene.add(marketPreviewMesh);
}

function updateMarketPreview(delta) {
    if (!marketPreviewRenderer || !marketPreviewScene || !marketPreviewCamera) return;
    // animate mesh
    if (marketPreviewMesh) marketPreviewMesh.rotation.y += 0.002 * (delta || 16);
    // handle resize
    const canvas = marketPreviewRenderer.domElement;
    const now = Date.now();
    if (now - marketPreviewLastResize > 500) {
        const w = canvas.clientWidth || canvas.width;
        const h = canvas.clientHeight || canvas.height;
        if (canvas.width !== w || canvas.height !== h) {
            marketPreviewRenderer.setSize(w, h);
            marketPreviewCamera.aspect = w / h; marketPreviewCamera.updateProjectionMatrix();
        }
        marketPreviewLastResize = now;
    }
    marketPreviewRenderer.render(marketPreviewScene, marketPreviewCamera);
}

function disposeMarketPreview() {
    try {
        if (marketPreviewRenderer) {
            marketPreviewRenderer.dispose();
            marketPreviewRenderer.forceContextLoss && marketPreviewRenderer.forceContextLoss();
        }
    } catch(e) {}
    marketPreviewScene = marketPreviewCamera = marketPreviewRenderer = marketPreviewMesh = null;
}


// ------------------------------------------------------------------
// BARN UPGRADE SYSTEM
// ------------------------------------------------------------------
window.showBarnUpgradeMenu = function(selectedBuilding) {
    const modal = document.getElementById('animal-building-modal');
    const content = document.getElementById('animal-modal-content');
    const btn = document.getElementById('animal-upgrade-btn');
    const collectBtn = document.getElementById('animal-collect-btn');
    
    modal.style.display = 'block';
    collectBtn.style.display = 'none'; // Auto-collection via checkMilkProduction for now
    
    // Find the barn building if not provided
    let building = selectedBuilding || (gameState.buildings && gameState.buildings.find(b => b.type === 'barn'));
    if (!building) {
        alert('No Barn found!');
        return;
    }
    if (!building.level) building.level = 1;
    
    // Ensure correct handler with the building
    btn.onclick = () => window.upgradeAnimalBuilding(building);

    const currentLevel = building.level;
    const nextLevel = currentLevel + 1;
    
    const currentInfo = BarnLevels[currentLevel];
    
    let html = `<p style="font-size: 16px; margin-bottom: 20px;">Current Level: <strong style="color:#f1c40f">${currentLevel}</strong></p>`;
    html += `<p style="font-size: 14px; margin-bottom: 20px;">Produces: <strong>${currentInfo.milkBottles} Milk Bottles</strong> every <strong>${currentInfo.productionTime / 60000} mins</strong></p>`;
    
    if (currentLevel >= 5) {
        html += `<p style="font-size: 18px; color: #2ecc71;">Maximum Level Reached!</p>`;
        btn.style.display = 'none';
    } else {
        const reqs = BarnLevels[nextLevel];
        if (!reqs) {
             html += `<p>Coming Soon...</p>`;
             btn.style.display = 'none';
        } else {
            btn.style.display = 'block';
            html += `<h3 style="margin-bottom: 15px;">Upgrade to Level ${nextLevel}</h3>`;
            html += `<p style="font-size: 14px; margin-bottom: 10px;">New Production: <strong>${reqs.milkBottles} Milk Bottles</strong> every <strong>${reqs.productionTime / 60000} mins</strong></p>`;
            
            // Cost Display
            const canAfford = gameState.money >= reqs.cost;
            html += `
                <div class="upgrade-cost-display" style="border: 1px solid ${canAfford ? '#2ecc71' : '#e74c3c'}">
                    <span>💰 Cost:</span>
                    <span style="color:${canAfford ? '#2ecc71' : '#e74c3c'}">$${reqs.cost}</span>
                </div>
            `;
            
            html += `<h4 style="text-align: left; margin-bottom: 10px;">Requirements:</h4>`;
            html += `<ul class="upgrade-req-list">`;
            
            let canUpgrade = true;
            if (!canAfford) canUpgrade = false;
            
            if (reqs.req) {
                for (const [crop, amount] of Object.entries(reqs.req)) {
                    const have = gameState.inventory[crop] || 0;
                    const ok = have >= amount;
                    if (!ok) canUpgrade = false;
                    
                    const cropDef = BuildingTypes[crop];
                    const cropName = cropDef ? cropDef.name : crop;
                    const icon = cropDef ? cropDef.icon : '❓';
                    
                    html += `
                        <li class="upgrade-req-item" style="border-left: 4px solid ${ok ? '#2ecc71' : '#e74c3c'}">
                            <span class="upgrade-req-icon">${icon}</span>
                            <div class="upgrade-req-info">
                                <span class="upgrade-req-name">${cropName}</span>
                                <span class="upgrade-req-count" style="color:${ok ? '#2ecc71' : '#e74c3c'}">
                                    ${have} / ${amount}
                                </span>
                            </div>
                            <span class="upgrade-status-icon" style="color:${ok ? '#2ecc71' : '#e74c3c'}">
                                ${ok ? '✔' : '✖'}
                            </span>
                        </li>
                    `;
                }
            }
            html += `</ul>`;
            
            btn.disabled = !canUpgrade;
            if (!canUpgrade) {
                btn.style.background = '#95a5a6';
                btn.style.cursor = 'not-allowed';
                btn.innerText = "Requirements Not Met";
            } else {
                btn.style.background = ''; // Reset to default CSS
                btn.style.cursor = 'pointer';
                btn.innerText = "Upgrade Barn";
            }
        }
    }
    
    content.innerHTML = html;
};

window.upgradeAnimalBuilding = function(selectedBuilding) {
    // Find the barn building if not provided
    let building = selectedBuilding || (gameState.buildings && gameState.buildings.find(b => b.type === 'barn'));
    if (!building) {
        alert('No Barn found!');
        return;
    }
    
    if (!building.level) building.level = 1;
    const currentLevel = building.level;
    const nextLevel = currentLevel + 1;
    const reqs = BarnLevels[nextLevel];
    
    if (!reqs) return;
    
    // Validate again
    if (gameState.money < reqs.cost) return;
    if (reqs.req) {
        for (const [crop, amount] of Object.entries(reqs.req)) {
            if ((gameState.inventory[crop] || 0) < amount) return;
        }
    }
    
    // Deduct
    addMoney(-reqs.cost);
    if (reqs.req) {
        for (const [crop, amount] of Object.entries(reqs.req)) {
            gameState.inventory[crop] -= amount;
        }
    }
    
    // Level Up
    building.level = nextLevel;
    showNotification(`Upgraded Barn to Level ${nextLevel}!`, "success");
    SoundEffects.playBuild();

    // Immediately update the 3D model for the barn
    const mesh = objects.find(o => o.userData.type === 'barn' && o.position.x === building.x && o.position.z === building.z);
    if (mesh) {
        scene.remove(mesh);
        const idx = objects.indexOf(mesh);
        if (idx !== -1) objects.splice(idx, 1);
        const newMesh = createDetailedBuilding('barn', building);
        newMesh.position.copy(mesh.position);
        scene.add(newMesh);
        objects.push(newMesh);
    }
    
    // Refresh UI with the specific building
    showBarnUpgradeMenu(building);
    saveGame();
    
    if (nextLevel === 5) {
        showNotification("Congratulations! You have fully upgraded your Barn!", "success");
    }
};

window.checkMilkProduction = function() {
    if (!gameState.barnLevel) return;
    
    // Check if player has a Barn building
    const hasBarn = gameState.buildings && gameState.buildings.some(b => b.type === 'barn');
    if (!hasBarn) return;
    
    // Check power
    if (gameState.electricity) {
        const isPowered = gameState.electricity.produced >= gameState.electricity.consumed;
        if (!isPowered) return;
    }
    
    const level = gameState.barnLevel;
    const info = BarnLevels[level];
    if (!info) return;

    const now = Date.now();
    const elapsed = now - (gameState.lastMilkProductionTime || now);

    if (elapsed >= info.productionTime) {
        // Produce milk
        const amount = info.milkBottles;
        // Create pending collection for NPC farmers
        const barnObj = objects.find(o => o.userData.type === 'barn');
        const pos = barnObj ? barnObj.position.clone() : null;
        const pending = {
            id: 'pending_milk_' + Date.now() + '_' + Math.floor(Math.random()*9999),
            type: 'milk_bottle',
            amount: amount,
            producedAt: now,
            buildingType: 'barn',
            pos: pos,
            collected: false
        };
        gameState.pendingCollections = gameState.pendingCollections || [];
        gameState.pendingCollections.push(pending);
        gameState.lastMilkProductionTime = now;

        if (barnObj) playMilkCollectionAnimation(barnObj.position);
        showNotification(`${amount} Milk Bottles are ready for pickup by farmers.`, 'info');
        saveGame();
    }
};

function playMilkCollectionAnimation(position) {
    const el = document.createElement('div');
    el.innerHTML = '<img src="data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'64\' height=\'64\' viewBox=\'0 0 64 64\'><path d=\'M22 4 L42 4 L42 14 L50 24 L50 60 L14 60 L14 24 L22 14 Z\' fill=\'%23ffffff\' stroke=\'%23333\' stroke-width=\'2\'/><rect x=\'14\' y=\'32\' width=\'36\' height=\'16\' fill=\'%233498db\'/><text x=\'32\' y=\'44\' font-family=\'sans-serif\' font-size=\'10\' fill=\'white\' text-anchor=\'middle\'>MILK</text></svg>" width="48" height="48">';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '2000';
    el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
    el.style.transition = 'all 1.5s ease-out';
    el.style.opacity = '1';
    
    // Project position
    const pos = position.clone();
    pos.y += 5; // Start above barn
    pos.project(camera);
    
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = (pos.x + 1) / 2 * w;
    const y = (1 - pos.y) / 2 * h;
    
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    
    document.body.appendChild(el);
    
    // Animate
    requestAnimationFrame(() => {
        el.style.transform = 'translateY(-100px) scale(1.5)';
        el.style.opacity = '0';
    });
    
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, 1500);
}

function updateBarnTimers() {
    if (!gameState.barnLevel) return;
    const level = gameState.barnLevel;
    const info = BarnLevels[level];
    if (!info) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    objects.forEach(obj => {
        if (obj.userData.type !== 'barn') return;

        // Create UI if missing
        if (!obj.userData.timerEl) {
            const el = document.createElement('div');
            el.className = 'crop-timer'; // Reuse crop timer styling
            el.innerHTML = `
                <div class="timer-content">
                    <span class="timer-icon" style="display:none"><img src="data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'64\' height=\'64\' viewBox=\'0 0 64 64\'><path d=\'M22 4 L42 4 L42 14 L50 24 L50 60 L14 60 L14 24 L22 14 Z\' fill=\'%23ffffff\' stroke=\'%23333\' stroke-width=\'2\'/><rect x=\'14\' y=\'32\' width=\'36\' height=\'16\' fill=\'%233498db\'/><text x=\'32\' y=\'44\' font-family=\'sans-serif\' font-size=\'10\' fill=\'white\' text-anchor=\'middle\'>MILK</text></svg>" width="16" height="16"></span>
                    <span class="timer-text">Wait...</span>
                    <div class="timer-bar-bg"><div class="timer-bar-fill"></div></div>
                </div>
            `;
            
            document.body.appendChild(el);
            obj.userData.timerEl = el;
            
            // Cache refs
            obj.userData.timerRefs = {
                container: el,
                text: el.querySelector('.timer-text'),
                fill: el.querySelector('.timer-bar-fill'),
                icon: el.querySelector('.timer-icon')
            };
        }
        
        const refs = obj.userData.timerRefs;
        
        // Position
        const pos = obj.position.clone();
        pos.y += 6; // Higher than crops
        pos.project(camera);
        
        // Check visibility
        const onScreen = pos.x > -1 && pos.x < 1 && pos.y > -1 && pos.y < 1 && pos.z < 1;
        if (!onScreen) {
            refs.container.style.display = 'none';
            return;
        }
        
        refs.container.style.display = 'flex';
        const screenX = (pos.x + 1) / 2 * w;
        const screenY = (1 - pos.y) / 2 * h;
        refs.container.style.left = `${screenX}px`;
        refs.container.style.top = `${screenY}px`;

        // Calculate Time
        const now = Date.now();
        const elapsed = now - (gameState.lastMilkProductionTime || now);
        const totalTime = info.productionTime;
        
        // If ready (should be collected by gameTick soon, but show READY meanwhile)
        if (elapsed >= totalTime) {
            if (!refs.container.classList.contains('ripe')) {
                refs.container.classList.add('ripe');
                refs.text.innerText = 'COLLECTING...';
                refs.text.style.color = '#fff';
            }
        } else {
            // Growing
            refs.container.classList.remove('ripe');
            
            const remaining = totalTime - elapsed;
            const pct = Math.min(100, (elapsed / totalTime) * 100);
            
            const seconds = remaining / 1000;
            const timeStr = seconds > 60 ? `${(seconds/60).toFixed(1)}m` : `${seconds.toFixed(0)}s`;
            
            if (refs.text.innerText !== timeStr) {
                refs.text.innerText = timeStr;
                refs.text.style.color = '#fff';
            }
            refs.fill.style.width = `${pct}%`;
        }
    });
}

window.toggleShop = function() {
    const shop = document.getElementById('controls-area');
    if (!shop) return;
    
    if (shop.style.display === 'none' || shop.style.display === '') {
        shop.style.display = 'flex';
        // Select first category by default if none
        if (!currentShopCategory) setShopCategory('crop');
    } else {
        shop.style.display = 'none';
        // Also cancel placement if active
        if (selectedBuildingType) {
            window.selectBuilding(null);
        }
    }
};

// ------------------------------------------------------------------
// ADMIN / OWNER PANEL OPENERS (Role-Gated)
// ------------------------------------------------------------------
window.openAdminPanel = function() {
    if (typeof window.ensureDefaultAdmins === 'function') window.ensureDefaultAdmins();
    const user = gameState.playerName || 'Farmer';
    const ROLES_KEY = 'farmSimRoles';
    const roles = JSON.parse(localStorage.getItem(ROLES_KEY) || '{}');
    const isOwner = (user === 'Alex' || user === 'Developer');
    const isAdmin = roles[user] === 'admin';
    if (isOwner || isAdmin) {
        if (typeof showAdminPanel === 'function') showAdminPanel();
    } else {
        showNotification('Admins only', 'error');
    }
};

window.openOwnerPanel = function() {
    const user = gameState.playerName || 'Farmer';
    const isOwner = (user === 'Alex' || user === 'Developer');
    if (isOwner) {
        if (typeof showOwnerPanel === 'function') showOwnerPanel();
    } else {
        showNotification('Owner only', 'error');
    }
};

window.ensureDefaultAdmins = function() {
    const ROLES_KEY = 'farmSimRoles';
    const roles = JSON.parse(localStorage.getItem(ROLES_KEY) || '{}');
    
    // Set Alex and Developer as Owners
    roles['Alex'] = 'owner';
    roles['Developer'] = 'owner';
    
    // Set Eka as Admin
    ['Eka'].forEach(name => {
        if (roles[name] !== 'admin') roles[name] = 'admin';
    });

    // Add Adi, Iqbal and Ichsan as VIP (no admin access)
    roles['Adi'] = 'vip';
    roles['Iqbal'] = 'vip';
    roles['Ichsan'] = 'vip';

    localStorage.setItem(ROLES_KEY, JSON.stringify(roles));

    // Also ensure the users exist in the users database
    const USERS_KEY = 'farmSimUsers';
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '{}');

    // Create default users if they don't exist
    if (!users['Alex']) users['Alex'] = 'Ampulamare5';
    if (!users['Adi']) users['Adi'] = 'password123';
    if (!users['Eka']) users['Eka'] = 'password123';
    if (!users['Iqbal']) users['Iqbal'] = 'password123';
    if (!users['Ichsan']) users['Ichsan'] = 'password123'; // Default password for Ichsan

    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

// ------------------------------------------------------------------
// PIG PEN UPGRADE SYSTEM
// ------------------------------------------------------------------
window.showPigPenUpgradeMenu = function(selectedBuilding) {
    const modal = document.getElementById('animal-building-modal');
    const content = document.getElementById('animal-modal-content');
    const btn = document.getElementById('animal-upgrade-btn');
    const collectBtn = document.getElementById('animal-collect-btn');
    
    modal.style.display = 'block';
    collectBtn.style.display = 'none'; 
    
    // Find the pig pen building if not provided
    let building = selectedBuilding || (gameState.buildings && gameState.buildings.find(b => b.type === 'pig_pen'));
    if (!building) {
        alert('No Pig Pen found!');
        return;
    }
    if (!building.level) building.level = 1;
    
    // Ensure correct handler with the building
    btn.onclick = () => window.upgradePigPen(building);

    const currentLevel = building.level;
    const nextLevel = currentLevel + 1;
    
    const currentInfo = PigPenLevels[currentLevel];
    
    let html = '<p style="font-size: 16px; margin-bottom: 20px;">Current Level: <strong style="color:#f1c40f">' + currentLevel + '</strong></p>';
    html += '<p style="font-size: 14px; margin-bottom: 20px;">Produces: <strong>' + currentInfo.truffles + ' Truffles</strong> every <strong>' + (currentInfo.productionTime / 60000) + ' mins</strong></p>';
    
    if (currentLevel >= 5) {
        html += '<p style="font-size: 18px; color: #2ecc71;">Maximum Level Reached!</p>';
        btn.style.display = 'none';
    } else {
        const reqs = PigPenLevels[nextLevel];
        if (!reqs) {
             html += '<p>Coming Soon...</p>';
             btn.style.display = 'none';
        } else {
            btn.style.display = 'block';
            html += '<h3 style="margin-bottom: 15px;">Upgrade to Level ' + nextLevel + '</h3>';
            html += '<p style="font-size: 14px; margin-bottom: 10px;">New Production: <strong>' + reqs.truffles + ' Truffles</strong> every <strong>' + (reqs.productionTime / 60000) + ' mins</strong></p>';
            
            // Cost Display
            const canAfford = gameState.money >= reqs.cost;
            html += '<div class="upgrade-cost-display" style="border: 1px solid ' + (canAfford ? '#2ecc71' : '#e74c3c') + '">';
            html += '<span> Cost:</span>';
            html += '<span style="color:' + (canAfford ? '#2ecc71' : '#e74c3c') + '">$' + reqs.cost + '</span>';
            html += '</div>';
            
            html += '<h4 style="text-align: left; margin-bottom: 10px;">Requirements:</h4>';
            html += '<ul class="upgrade-req-list">';
            
            let canUpgrade = true;
            if (!canAfford) canUpgrade = false;
            
            if (reqs.req) {
                for (const [crop, amount] of Object.entries(reqs.req)) {
                    const have = gameState.inventory[crop] || 0;
                    const ok = have >= amount;
                    if (!ok) canUpgrade = false;
                    
                    const cropDef = BuildingTypes[crop];
                    const cropName = cropDef ? cropDef.name : crop;
                    const icon = cropDef ? cropDef.icon : '';
                    
                    html += '<li class="upgrade-req-item" style="border-left: 4px solid ' + (ok ? '#2ecc71' : '#e74c3c') + '">';
                    html += '<span class="upgrade-req-icon">' + icon + '</span>';
                    html += '<div class="upgrade-req-info">';
                    html += '<span class="upgrade-req-name">' + cropName + '</span>';
                    html += '<span class="upgrade-req-count" style="color:' + (ok ? '#2ecc71' : '#e74c3c') + '">' + have + ' / ' + amount + '</span>';
                    html += '</div>';
                    html += '<span class="upgrade-status-icon" style="color:' + (ok ? '#2ecc71' : '#e74c3c') + '">' + (ok ? '' : '') + '</span>';
                    html += '</li>';
                }
            }
            html += '</ul>';
            
            btn.disabled = !canUpgrade;
            if (!canUpgrade) {
                btn.style.background = '#95a5a6';
                btn.style.cursor = 'not-allowed';
                btn.innerText = 'Requirements Not Met';
            } else {
                btn.style.background = ''; 
                btn.style.cursor = 'pointer';
                btn.innerText = 'Upgrade Pig Pen';
            }
        }
    }
    
    content.innerHTML = html;
};

window.upgradePigPen = function(selectedBuilding) {
    // Find the pig pen building if not provided
    let building = selectedBuilding || (gameState.buildings && gameState.buildings.find(b => b.type === 'pig_pen'));
    if (!building) {
        alert('No Pig Pen found!');
        return;
    }
    
    if (!building.level) building.level = 1;
    const currentLevel = building.level;
    const nextLevel = currentLevel + 1;
    const reqs = PigPenLevels[nextLevel];
    
    if (!reqs) return;
    
    // Validate again
    if (gameState.money < reqs.cost) return;
    if (reqs.req) {
        for (const [crop, amount] of Object.entries(reqs.req)) {
            if ((gameState.inventory[crop] || 0) < amount) return;
        }
    }
    
    // Deduct
    addMoney(-reqs.cost);
    if (reqs.req) {
        for (const [crop, amount] of Object.entries(reqs.req)) {
            gameState.inventory[crop] -= amount;
        }
    }
    
    // Level Up
    building.level = nextLevel;
    showNotification('Upgraded Pig Pen to Level ' + nextLevel + '!', 'success');
    SoundEffects.playBuild();

    // Immediately update the 3D model for the pig pen
    const mesh = objects.find(o => o.userData.type === 'pig_pen' && o.position.x === building.x && o.position.z === building.z);
    if (mesh) {
        scene.remove(mesh);
        const idx = objects.indexOf(mesh);
        if (idx !== -1) objects.splice(idx, 1);
        const newMesh = createDetailedBuilding('pig_pen', building);
        newMesh.position.copy(mesh.position);
        scene.add(newMesh);
        objects.push(newMesh);
    }
    
    // Refresh UI with the specific building
    showPigPenUpgradeMenu(building);
    saveGame();
    
    if (nextLevel === 5) {
        showNotification('Congratulations! You have fully upgraded your Pig Pen!', 'success');
    }
};

window.checkTruffleProduction = function() {
    // Check if player has a Pig Pen building
    const pigPens = gameState.buildings && gameState.buildings.filter(b => b.type === 'pig_pen');
    if (!pigPens || pigPens.length === 0) return;
    
    // Check power
    if (gameState.electricity) {
        const isPowered = gameState.electricity.produced >= gameState.electricity.consumed;
        if (!isPowered) return;
    }
    
    // Process each pig pen independently
    pigPens.forEach(pen => {
        if (!pen.level) pen.level = 1;
        const level = pen.level;
        const info = PigPenLevels[level];
        if (!info) return;

        const now = Date.now();
        if (!pen.lastTruffleProductionTime) pen.lastTruffleProductionTime = now;
        const elapsed = now - pen.lastTruffleProductionTime;

        if (elapsed >= info.productionTime) {
            // Produce truffles
            const amount = info.truffles;
            // Create pending collection for this pig pen (NPCs will collect)
            const penObj = objects.find(o => o.userData.type === 'pig_pen' && o.position.x === pen.x && o.position.z === pen.z);
            const pos = penObj ? penObj.position.clone() : null;
            const pending = {
                id: 'pending_truffle_' + Date.now() + '_' + Math.floor(Math.random()*9999),
                type: 'truffle',
                amount: amount,
                producedAt: now,
                buildingType: 'pig_pen',
                pos: pos,
                collected: false
            };
            gameState.pendingCollections = gameState.pendingCollections || [];
            gameState.pendingCollections.push(pending);
            pen.lastTruffleProductionTime = now;

            if (penObj) playTruffleCollectionAnimation(penObj.position);
            showNotification('Truffles are ready for pickup by farmers!', 'info');
            saveGame();
        }
    });
};

function playTruffleCollectionAnimation(position) {
    const el = document.createElement('div');
    el.innerHTML = '<span style="font-size:48px">🍄</span><div style="font-weight:bold; color:white; text-shadow:0 1px 2px black">TRUFFLES</div>';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '2000';
    el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
    el.style.transition = 'all 1.5s ease-out';
    el.style.opacity = '1';
    el.style.textAlign = 'center';
    
    // Project position
    const pos = position.clone();
    pos.y += 5; 
    pos.project(camera);
    
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = (pos.x + 1) / 2 * w;
    const y = (1 - pos.y) / 2 * h;
    
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    
    document.body.appendChild(el);
    
    // Animate
    requestAnimationFrame(() => {
        el.style.transform = 'translateY(-100px) scale(1.5)';
        el.style.opacity = '0';
    });
    
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, 1500);
}

function updatePigPenTimers() {
    const pigPens = gameState.buildings && gameState.buildings.filter(b => b.type === 'pig_pen');
    if (!pigPens || pigPens.length === 0) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    
    console.log('Updating pig pen timers. Found', pigPens.length, 'pig pens. Objects with pig_pen:', objects.filter(o => o.userData.type === 'pig_pen').length);

    objects.forEach(obj => {
        if (obj.userData.type !== 'pig_pen') return;
        
        console.log('Found pig pen object at', obj.position.x, obj.position.z);
        
        // Find the pig pen building - use any pig pen since each 3D object corresponds to one building
        // The building is already passed through createDetailedBuilding in the mesh creation
        let pen = null;
        
        // Try to find by position match first (for new buildings)
        for (let b of pigPens) {
            const tiles = getOccupiedTiles('pig_pen', b.x, b.z, b.rotation || 0);
            if (tiles.length > 0) {
                let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
                tiles.forEach(t => {
                    minX = Math.min(minX, t.x);
                    maxX = Math.max(maxX, t.x);
                    minZ = Math.min(minZ, t.z);
                    maxZ = Math.max(maxZ, t.z);
                });
                const centerX = (minX + maxX) / 2;
                const centerZ = (minZ + maxZ) / 2;
                if (Math.abs(obj.position.x - centerX) < 0.1 && Math.abs(obj.position.z - centerZ) < 0.1) {
                    pen = b;
                    break;
                }
            } else {
                if (Math.abs(obj.position.x - b.x) < 0.1 && Math.abs(obj.position.z - b.z) < 0.1) {
                    pen = b;
                    break;
                }
            }
        }
        
        if (!pen) {
            console.log('No matching building found for pig pen at', obj.position.x, obj.position.z);
            return;
        }
        
        console.log('Matched pig pen building');
        
        if (!pen.level) pen.level = 1;
        // Initialize production timer if missing
        if (!pen.lastTruffleProductionTime) {
            pen.lastTruffleProductionTime = Date.now();
        }
        
        const level = pen.level;
        const info = PigPenLevels[level];
        if (!info) return;

        // Create UI if missing
        if (!obj.userData.timerEl) {
            console.log('Creating timer for pig pen');
            const el = document.createElement('div');
            el.className = 'crop-timer'; 
            el.innerHTML = '<div class="timer-content">' +
                    '<span class="timer-icon">🍄</span>' +
                    '<span class="timer-text">Wait...</span>' +
                    '<div class="timer-bar-bg"><div class="timer-bar-fill" style="background: #8e44ad;"></div></div>' +
                '</div>';
            document.body.appendChild(el);
            obj.userData.timerEl = el;
            
            obj.userData.timerRefs = {
                container: el,
                text: el.querySelector('.timer-text'),
                fill: el.querySelector('.timer-bar-fill')
            };
        }

        const refs = obj.userData.timerRefs;
        if (!refs || !refs.container) {
            console.log('Timer refs not found');
            return;
        }

        // Project position
        const pos = obj.position.clone();
        pos.y += 6; // Above building
        pos.project(camera);
        
        // Check visibility
        const onScreen = pos.x > -1 && pos.x < 1 && pos.y > -1 && pos.y < 1 && pos.z < 1;
        if (!onScreen) {
            refs.container.style.display = 'none';
            return;
        }

        refs.container.style.display = 'flex';
        const screenX = (pos.x + 1) / 2 * w;
        const screenY = (1 - pos.y) / 2 * h;
        refs.container.style.left = screenX + 'px';
        refs.container.style.top = screenY + 'px';
        
        console.log('Timer positioned at', screenX, screenY);

        const now = Date.now();
        const elapsed = now - pen.lastTruffleProductionTime;
        const totalTime = info.productionTime;
        
        if (elapsed >= totalTime) {
            if (!refs.container.classList.contains('ripe')) {
                refs.container.classList.add('ripe');
                refs.text.innerText = 'COLLECTING...';
                refs.text.style.color = '#fff';
            }
        } else {
            refs.container.classList.remove('ripe');
            
            const remaining = totalTime - elapsed;
            const pct = Math.min(100, (elapsed / totalTime) * 100);
            
            const seconds = remaining / 1000;
            const timeStr = seconds > 60 ? (seconds/60).toFixed(1) + 'm' : seconds.toFixed(0) + 's';
            
            if (refs.text.innerText !== timeStr) {
                refs.text.innerText = timeStr;
                refs.text.style.color = '#fff';
            }
            refs.fill.style.width = pct + '%';
        }
    });
}

// NPC Farmer system: spawns one farmer per house (building_house types) who will collect pending items
function updateNPCFarmers() {
    gameState.pendingCollections = gameState.pendingCollections || [];
    gameState.npcs = gameState.npcs || [];

    // Find house buildings (any building whose BuildingTypes entry has type 'building_house')
    const houses = (gameState.buildings || []).filter(b => {
        const def = BuildingTypes[b.type];
        return def && def.type === 'building_house';
    });

    // Ensure one NPC per house (simple mapping)
    while (gameState.npcs.length < houses.length) {
        const idx = gameState.npcs.length;
        const house = houses[idx] || houses[houses.length - 1];
        const npc = {
            id: 'npc_farmer_' + Date.now() + '_' + Math.floor(Math.random()*9999),
            houseIndex: idx,
            status: 'idle',
            target: null,
            arrivalTime: 0
        };
        gameState.npcs.push(npc);
    }
    if (gameState.npcs.length > houses.length) {
        gameState.npcs = gameState.npcs.slice(0, houses.length);
    }

    // For each NPC, assign nearest pending collection if idle
    gameState.npcs.forEach(npc => {
        // Ensure NPC has a visual mesh
        if (!npc.mesh) {
            // Find house object for this npc
            const houseDef = houses[npc.houseIndex] || houses[0];
            const houseObj = houseDef ? getBuildingObject(houseDef) : null;
            const startPos = houseObj ? houseObj.position.clone() : new THREE.Vector3( (houseDef && houseDef.x) || 0, 0, (houseDef && houseDef.z) || 0 );
            npc.mesh = createNPCMesh();
            npc.mesh.position.copy(startPos);
            scene.add(npc.mesh);
        }

        if (npc.status === 'idle' || !npc.target) {
            const pending = gameState.pendingCollections.find(p => !p.collected && !p.assigned);
            if (pending) {
                pending.assigned = true;
                npc.target = pending.id;
                npc.status = 'walking';
                let pendingPos = pending.pos ? pending.pos.clone() : getBuildingCenterByType(pending.buildingType) || npc.mesh.position.clone();
                // Avoid collisions by nudging to nearest free offset
                pendingPos = findNonCollidingPoint(pendingPos);
                const startPos = npc.mesh.position.clone();
                const travelMs = 3000 + Math.floor(Math.random() * 4000); // 3-7s visual travel
                npc.startTime = Date.now();
                npc.endTime = Date.now() + travelMs;
                npc.startPos = startPos;
                // Clamp end position to terrain bounds
                const terrainLimit = (gridSize * TILE_SIZE) / 2 - 2;
                const margin = 1.5;
                const maxBound = terrainLimit - margin;
                const minBound = -terrainLimit + margin;
                pendingPos.x = Math.max(minBound, Math.min(maxBound, pendingPos.x));
                pendingPos.z = Math.max(minBound, Math.min(maxBound, pendingPos.z));
                npc.endPos = pendingPos;
                console.debug('Assigned NPC', npc.id, 'to', pending.id, 'from', startPos, 'to', pendingPos);
            }
        }
    });

    // Clean up very old collected entries (keep small history for 1 minute)
    const now = Date.now();
    gameState.pendingCollections = gameState.pendingCollections.filter(p => !p.collected || (now - (p.collectedAt || now) < 60000));
    // Update the UI panel showing pending pickups and NPC status
    try { updateNPCPanel && updateNPCPanel(); } catch (e) { /* ignore */ }
}

function playGenericCollectionAnimation(position, type) {
    if (!position) return;
    if (type === 'egg') return playEggCollectionAnimation(position);
    if (type === 'milk_bottle') return playMilkCollectionAnimation(position);
    if (type === 'truffle') return playTruffleCollectionAnimation(position);
    // Fallback minimal animation
    const el = document.createElement('div');
    el.innerText = 'Picked';
    el.style.position = 'absolute'; el.style.pointerEvents = 'none'; el.style.zIndex = '2000'; el.style.color = '#fff';
    const pos = position.clone(); pos.y += 5; pos.project(camera);
    const w = window.innerWidth; const h = window.innerHeight;
    el.style.left = ((pos.x + 1) / 2 * w) + 'px';
    el.style.top = ((1 - pos.y) / 2 * h) + 'px';
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translateY(-80px)'; el.style.opacity = '0'; });
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1200);
}

// Helper: find 3D object for a building entry (by matching type and position)
function getBuildingObject(building) {
    if (!building) return null;
    // Try to find corresponding mesh in objects array
    for (let o of objects) {
        if (!o.userData) continue;
        if (o.userData.type === building.type) {
            // If building has x/z coords, try to match
            if (typeof building.x === 'number' && typeof building.z === 'number') {
                if (Math.abs(o.position.x - building.x) < 0.2 && Math.abs(o.position.z - building.z) < 0.2) return o;
            } else {
                return o;
            }
        }
    }
    return null;
}

// Helper: approximate center by finding any object of that building type
function getBuildingCenterByType(type) {
    const o = objects.find(x => x.userData && x.userData.type === type);
    return o ? o.position.clone() : null;
}

// Create a simple NPC farmer mesh (small stylized character)
function createNPCMesh() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.9 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), bodyMat); body.position.y = 0.4; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), headMat); head.position.y = 0.95; g.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.18, 8), hatMat); hat.position.y = 1.08; hat.rotation.x = Math.PI; g.add(hat);
    // Legs for simple walking animation
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.9 });
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), legMat); leftLeg.position.set(-0.16, 0.15, 0); g.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), legMat); rightLeg.position.set(0.16, 0.15, 0); g.add(rightLeg);
    // Store references for animation
    g.userData.legs = { left: leftLeg, right: rightLeg };
    g.scale.set(0.9,0.9,0.9);
    g.userData.isNPC = true;
    return g;
}

// Find a nearby non-colliding point (very simple nudging) to avoid overlapping building meshes
function findNonCollidingPoint(pos) {
    if (!pos) return pos;
    const out = pos.clone();
    const tryOffsets = [ [0,0], [1,0], [-1,0], [0,1], [0,-1], [1,1], [-1,1], [1,-1], [-1,-1], [2,0], [-2,0] ];
    for (let off of tryOffsets) {
        const test = pos.clone(); test.x += off[0]; test.z += off[1];
        let collides = false;
        for (let o of objects) {
            if (!o.userData) continue;
            const dx = Math.abs(o.position.x - test.x);
            const dz = Math.abs(o.position.z - test.z);
            if (dx < 1.2 && dz < 1.2) { collides = true; break; }
        }
        if (!collides) { out.x = test.x; out.z = test.z; return out; }
    }
    return out; // fallback original
}

// Animate NPC meshes each tick (interpolate between start and end positions)
function updateNPCVisuals() {
    if (!gameState.npcs) return;
    const now = Date.now();
    gameState.npcs.forEach(npc => {
        if (!npc.mesh) return;
        if (npc.status === 'walking' && npc.startTime && npc.endTime && npc.startPos && npc.endPos) {
            const t = Math.min(1, (now - npc.startTime) / Math.max(1, (npc.endTime - npc.startTime)));
            const sx = npc.startPos.x, sy = npc.startPos.y, sz = npc.startPos.z;
            const ex = npc.endPos.x, ey = npc.endPos.y, ez = npc.endPos.z;
            // Face direction
            const dirX = ex - sx; const dirZ = ez - sz;
            const angle = Math.atan2(dirZ, dirX) - Math.PI/2;
            npc.mesh.rotation.y = angle;

            npc.mesh.position.set(
                sx + (ex - sx) * t,
                sy + (ey - sy) * t + 0.2 * Math.sin(t * Math.PI), // small bob
                sz + (ez - sz) * t
            );
            // Leg swing based on time and progress
            if (npc.mesh.userData && npc.mesh.userData.legs) {
                const speed = 6; // swing speed
                const swing = Math.sin((now / 100) * speed) * 0.6 * Math.max(0.2, 1 - Math.abs(0.5 - t) * 2);
                npc.mesh.userData.legs.left.rotation.x = swing;
                npc.mesh.userData.legs.right.rotation.x = -swing;
            }
            // Check proximity arrival in case timing or coordinate mismatch prevents exact end-time match
            const pending = gameState.pendingCollections && npc.target ? gameState.pendingCollections.find(p => p.id === npc.target) : null;
            const isNear = pending && pending.pos && npc.mesh.position.distanceTo(pending.pos) <= 0.9;
            if (t >= 1 || isNear) {
                // When visual arrival (or close), trigger collection if pending still exists
                if (pending && !pending.collected) {
                    let added = addInventoryItem(pending.type, pending.amount);
                    if (!added) {
                        added = forceAddInventoryItem(pending.type, pending.amount);
                    }
                    if (added) {
                        pending.collected = true;
                        pending.collectedBy = npc.id;
                        pending.collectedAt = Date.now();
                        showNotification(`Farmer collected ${pending.amount} ${BuildingTypes[pending.type] ? BuildingTypes[pending.type].name : pending.type}`, 'success');
                        if (pending.pos) {
                            playGenericCollectionAnimation(pending.pos, pending.type);
                            playCollectionParticles(pending.pos, pending.type, Math.min(8, pending.amount));
                        }
                        saveGame && saveGame();
                        console.debug('Pending collected', pending.id, 'by', npc.id);
                    } else {
                        pending.assigned = false;
                    }
                }
                // Start return to house
                const houseDef = (gameState.buildings || [])[npc.houseIndex] || null;
                const houseObj = houseDef ? getBuildingObject(houseDef) : null;
                const housePos = houseObj ? houseObj.position.clone() : npc.mesh.position.clone();
                npc.startPos = npc.mesh.position.clone();
                npc.endPos = housePos;
                npc.startTime = now;
                npc.endTime = now + 1500; // return quicker
                npc.status = 'returning';
            }
        } else if (npc.status === 'returning' && npc.startTime && npc.endTime && npc.startPos && npc.endPos) {
            const t = Math.min(1, (now - npc.startTime) / Math.max(1, (npc.endTime - npc.startTime)));
            npc.mesh.position.lerpVectors(npc.startPos, npc.endPos, t);
            // simple leg animation returning
            if (npc.mesh.userData && npc.mesh.userData.legs) {
                const swing = Math.sin((now / 100) * 5) * 0.35 * (1 - t);
                npc.mesh.userData.legs.left.rotation.x = swing;
                npc.mesh.userData.legs.right.rotation.x = -swing;
            }
            if (t >= 1) {
                npc.status = 'idle';
                npc.target = null;
                npc.startTime = npc.endTime = null;
            }
        }
    });
}

// Create simple floating particle DOM sprites on collection
function playCollectionParticles(position, type, count) {
    if (!position) return;
    const pos = position.clone(); pos.y += 5; pos.project(camera);
    const w = window.innerWidth; const h = window.innerHeight;
    const x = (pos.x + 1) / 2 * w; const y = (1 - pos.y) / 2 * h;
    for (let i=0;i<(count||6);i++) {
        const el = document.createElement('div');
        el.style.position = 'absolute'; el.style.left = x + 'px'; el.style.top = y + 'px';
        el.style.pointerEvents = 'none'; el.style.zIndex = 2500;
        el.style.width = '18px'; el.style.height = '18px'; el.style.borderRadius = '50%';
        el.style.opacity = '1'; el.style.transform = 'translate(-50%,-50%)';
        el.style.background = '#fff'; el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
        if (type === 'egg') el.innerText = '🥚';
        if (type === 'milk_bottle') el.innerText = '🥛';
        if (type === 'truffle') el.innerText = '🍄';
        el.style.fontSize = '14px'; el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
        document.body.appendChild(el);
        const dx = (Math.random()-0.5)*120; const dy = -100 - Math.random()*80;
        el.animate([
            { transform: 'translate(-50%,-50%) translate(0px,0px)', opacity: 1 },
            { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px)`, opacity: 0 }
        ], { duration: 900 + Math.random()*600, easing: 'ease-out' });
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1600);
    }
}

// Update / render NPC panel in the DOM
function updateNPCPanel() {
    // Ensure panel exists and is visible
    let panel = document.getElementById('npc-panel');
    if (!panel) return;
    panel.style.display = 'block';

    const pendingList = document.getElementById('pending-list');
    const npcList = document.getElementById('npc-list');
    if (!pendingList || !npcList) return;

    // Clear
    pendingList.innerHTML = '';
    npcList.innerHTML = '';

    (gameState.pendingCollections || []).forEach(p => {
        const def = BuildingTypes[p.type] || { name: p.type, icon: '📦' };
        const el = document.createElement('div');
        el.className = 'npc-pending-item';
        el.style.display = 'flex'; el.style.justifyContent = 'space-between'; el.style.alignItems = 'center'; el.style.padding = '6px'; el.style.borderRadius = '8px';
        el.style.background = p.collected ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
        el.innerHTML = `<div style="display:flex; gap:8px; align-items:center;"><div style="width:28px;height:28px;border-radius:6px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">${def.icon || '📦'}</div><div style="font-size:13px">${def.name} <small style='color:#ccc'>x${p.amount}</small></div></div><div style='font-size:12px;color:#ddd'>${p.collected ? 'Collected' : (p.assigned ? 'Assigned' : 'Ready')}</div>`;
        pendingList.appendChild(el);
    });

    (gameState.npcs || []).forEach((n,i) => {
        const el = document.createElement('div');
        el.style.display = 'flex'; el.style.justifyContent = 'space-between'; el.style.alignItems = 'center'; el.style.padding = '6px'; el.style.borderRadius = '8px';
        el.style.background = 'rgba(255,255,255,0.03)'; el.style.marginBottom = '4px';
        const status = n.status === 'walking' ? `Walking → ${n.target || ''}` : (n.status || 'idle');
        let eta = '';
        if (n.status === 'walking' && n.arrivalTime) {
            const t = Math.max(0, Math.round((n.arrivalTime - Date.now())/1000));
            eta = `ETA ${t}s`;
        }
        el.innerHTML = `<div style='font-size:13px'>Farmer ${i+1}</div><div style='font-size:12px;color:#ddd'>${status} ${eta}</div>`;
        npcList.appendChild(el);
    });

    // Toggle button
    const toggle = document.getElementById('npc-panel-toggle');
    if (toggle && !toggle._bound) {
        toggle.addEventListener('click', () => {
            const listVisible = pendingList.style.display !== 'none';
            pendingList.style.display = listVisible ? 'none' : 'flex';
            npcList.style.display = listVisible ? 'none' : 'flex';
            toggle.innerText = listVisible ? '▴' : '▾';
        });
        toggle._bound = true;
    }

    // Bind demo and clear buttons once
    const demoBtn = document.getElementById('npc-demo-btn');
    const clearBtn = document.getElementById('npc-clear-btn');
    if (demoBtn && !demoBtn._bound) {
        demoBtn.addEventListener('click', () => {
            spawnDemoPickups();
        });
        demoBtn._bound = true;
    }
    if (clearBtn && !clearBtn._bound) {
        clearBtn.addEventListener('click', () => {
            gameState.pendingCollections = [];
            updateNPCPanel();
        });
        clearBtn._bound = true;
    }
}

// Create a few demo pending items at the first house/main house to test NPC pickup
function spawnDemoPickups() {
    const houses = (gameState.buildings || []).filter(b => {
        const def = BuildingTypes[b.type];
        return def && def.type === 'building_house';
    });
    let basePos = null;
    if (houses.length > 0) {
        const obj = getBuildingObject(houses[0]);
        basePos = obj ? obj.position.clone() : (houses[0].x !== undefined ? new THREE.Vector3(houses[0].x, 0, houses[0].z) : null);
    }
    if (!basePos) {
        // fallback to main_house or scene center
        const mainObj = objects.find(o => o.userData && o.userData.type === 'main_house');
        basePos = mainObj ? mainObj.position.clone() : new THREE.Vector3(0,0,0);
    }
    const now = Date.now();
    gameState.pendingCollections = gameState.pendingCollections || [];
    const types = ['milk_bottle','egg','truffle'];
    types.forEach((t,i) => {
        const pending = {
            id: 'demo_pending_' + t + '_' + now + '_' + i,
            type: t,
            amount: 3 + i*2,
            producedAt: now,
            buildingType: t === 'egg' ? 'coop' : (t === 'milk_bottle' ? 'barn' : 'pig_pen'),
            pos: basePos.clone().add(new THREE.Vector3(i*1.2,0,0)),
            collected: false
        };
        gameState.pendingCollections.push(pending);
    });
    saveGame && saveGame();
    updateNPCPanel();
}

// ------------------------------------------------------------------
// FEEDBACK & SUPPORT SYSTEM
// ------------------------------------------------------------------
window.showFeedbackModal = function() {
    const modal = document.getElementById('feedback-modal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('feedback-text').focus();
    }
};

window.showBugReportModal = function() {
    const modal = document.getElementById('bug-report-modal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('bug-title').focus();
    }
};

window.submitFeedback = function(event) {
    event.preventDefault();
    const type = document.getElementById('feedback-type').value;
    const text = document.getElementById('feedback-text').value;
    const playerName = gameState.playerName || 'Unknown';
    
    if (!text.trim()) {
        showNotification('Please enter your feedback', 'error');
        return;
    }
    
    // Store feedback locally
    const feedbacks = JSON.parse(localStorage.getItem('farmSimFeedbacks') || '[]');
    feedbacks.push({
        player: playerName,
        type: type,
        text: text,
        timestamp: new Date().toISOString(),
        level: gameState.level,
        money: gameState.money
    });
    localStorage.setItem('farmSimFeedbacks', JSON.stringify(feedbacks.slice(-50))); // Keep last 50
    
    // Clear form
    document.getElementById('feedback-text').value = '';
    
    // Close modal
    closeModal('feedback-modal');
    
    // Show confirmation
    showNotification('Thank you! Your feedback has been sent! 💌', 'success');
    
    // Log to console for dev
    console.log('Feedback submitted:', { player: playerName, type, text });
};

window.submitBugReport = function(event) {
    event.preventDefault();
    const title = document.getElementById('bug-title').value;
    const steps = document.getElementById('bug-steps').value;
    const expected = document.getElementById('bug-expected').value;
    const playerName = gameState.playerName || 'Unknown';
    
    if (!title.trim() || !steps.trim()) {
        showNotification('Please fill in required fields', 'error');
        return;
    }
    
    // Store bug report locally
    const reports = JSON.parse(localStorage.getItem('farmSimBugReports') || '[]');
    reports.push({
        player: playerName,
        title: title,
        steps: steps,
        expected: expected,
        timestamp: new Date().toISOString(),
        level: gameState.level,
        browser: navigator.userAgent
    });
    localStorage.setItem('farmSimBugReports', JSON.stringify(reports.slice(-50))); // Keep last 50
    
    // Clear form
    document.getElementById('bug-title').value = '';
    document.getElementById('bug-steps').value = '';
    document.getElementById('bug-expected').value = '';
    
    // Close modal
    closeModal('bug-report-modal');
    
    // Show confirmation
    showNotification('Bug report submitted! Thank you for helping! 🐛', 'success');
    
    // Log to console for dev
    console.log('Bug report submitted:', { player: playerName, title, steps, expected });
};

// ------------------------------------------------------------------
// MULTIPLAYER & SOCIAL FEATURES
// ------------------------------------------------------------------
let isConnectedOnline = false;
let currentCoopSession = null;

window.showMultiplayerOptions = function() {
    const modal = document.getElementById('multiplayer-modal');
    if (modal) {
        modal.style.display = 'block';
        updateMultiplayerStatus();
    }
};

window.updateMultiplayerStatus = function() {
    const statusEl = document.getElementById('mp-status');
    if (statusEl) {
        if (isConnectedOnline) {
            statusEl.innerHTML = '🟢 Online - Connected!';
            statusEl.style.color = '#2ecc71';
        } else {
            statusEl.innerHTML = '🔴 Offline - Tap to connect';
            statusEl.style.color = '#e74c3c';
        }
    }
};

window.connectToServer = function() {
    if (isConnectedOnline) {
        isConnectedOnline = false;
        showNotification('Disconnected from online', 'info');
    } else {
        // Simulate connection
        isConnectedOnline = true;
        showNotification('Connected to FarmCloud! 🌐', 'success');
        updateMultiplayerStatus();
    }
};

window.showFriendsList = function() {
    const friends = [
        { name: 'TopFarmer99', level: 15, online: true },
        { name: 'BarnOwl', level: 12, online: false },
        { name: 'GreenThumb', level: 8, online: true },
        { name: 'CowBoy', level: 5, online: false }
    ];
    
    let html = '<div style="display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto;">';
    friends.forEach(f => {
        const statusColor = f.online ? '#2ecc71' : '#95a5a6';
        const statusText = f.online ? 'Online' : 'Offline';
        html += `
            <div style="background: rgba(52, 152, 219, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid ${statusColor}; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <p style="margin: 0 0 5px 0; font-weight: bold;">${f.name}</p>
                    <p style="margin: 0; font-size: 12px; color: #aaa;">Level ${f.level} • <span style="color: ${statusColor};">${statusText}</span></p>
                </div>
                <button class="action-btn" onclick="visitFarm('${f.name}')" style="background: #3498db; padding: 8px 16px; font-size: 12px;">👥 Visit</button>
            </div>
        `;
    });
    html += '</div>';
    
    const modal = document.createElement('div');
    modal.id = 'friends-list-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <button class="modal-close" onclick="closeModal('friends-list-modal')">&times;</button>
        <h2 style="color: #e91e63;">👥 Friends List</h2>
        ${html}
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
};

window.showGlobalLeaderboard = function() {
    const leaderboard = [
        { rank: 1, name: 'TopFarmer99', level: 15, money: 54000, buildings: 87 },
        { rank: 2, name: 'BarnOwl', level: 12, money: 32000, buildings: 65 },
        { rank: 3, name: 'GreenThumb', level: 8, money: 15000, buildings: 42 },
        { rank: 4, name: 'CowBoy', level: 5, money: 8000, buildings: 28 },
        { rank: 5, name: gameState.playerName, level: gameState.level, money: gameState.money, buildings: gameState.buildings.length }
    ];
    
    // Sort by level desc
    leaderboard.sort((a, b) => b.level - a.level);
    
    let html = '<div style="max-height: 450px; overflow-y: auto;">';
    leaderboard.forEach((p, i) => {
        const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎖️';
        const isPlayer = p.name === gameState.playerName;
        const bgColor = isPlayer ? 'rgba(241, 196, 15, 0.2)' : 'rgba(52, 152, 219, 0.1)';
        const borderColor = isPlayer ? '#f1c40f' : '#3498db';
        
        html += `
            <div style="background: ${bgColor}; padding: 12px; border-radius: 8px; border-left: 4px solid ${borderColor}; margin-bottom: 8px; display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 24px; min-width: 30px;">${medalEmoji}</div>
                <div style="flex: 1;">
                    <p style="margin: 0 0 5px 0; font-weight: bold;">#${p.rank} ${p.name}</p>
                    <p style="margin: 0; font-size: 12px; color: #aaa;">Lvl ${p.level} • 💰$${p.money.toLocaleString()} • 🏢${p.buildings}</p>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    const modal = document.createElement('div');
    modal.id = 'leaderboard-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <button class="modal-close" onclick="closeModal('leaderboard-modal')">&times;</button>
        <h2 style="color: #f1c40f;">🏆 Global Leaderboard</h2>
        ${html}
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
};

window.showVisitFarmUI = function() {
    showNotification('Friend visit feature coming soon! 👥', 'info');
};

window.visitFarm = function(friendName) {
    closeModal('friends-list-modal');
    showNotification(`Visiting ${friendName}'s farm...`, 'success');
    // Implement actual farm visiting
};

window.toggleCoop = function() {
    if (currentCoopSession) {
        currentCoopSession = null;
        showNotification('Co-op session ended', 'info');
    } else {
        currentCoopSession = { started: Date.now(), players: [gameState.playerName] };
        showNotification('Co-op mode started! Ready for multiplayer 🤝', 'success');
    }
};
