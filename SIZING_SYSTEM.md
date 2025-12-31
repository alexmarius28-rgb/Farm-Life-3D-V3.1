# Game Object Sizing System

## Core Constants
- **TILE_SIZE**: 10 units (grid spacing)
- **GRID_SIZE**: 20x20 tiles (total map is 200x200 units)
- **Snap Interval**: Buildings snap to grid centers every 10 units

---

## Grid Coordinate System
- **Grid Position**: Stored as `x, z` coordinates (center of grid cell)
- **Snap Formula**: 
  - Position = `Math.floor(clickX / TILE_SIZE) * TILE_SIZE + TILE_SIZE/2`
  - This places building at center of a 10x10 grid cell
  - For example: Clicking at x=15 snaps to x=15, clicking at x=8 snaps to x=5

---

## Building Sizes (in tiles)

### Standard 1x1 Buildings (10x10 units)
- **Width**: 0.85 × TILE_SIZE = 8.5 units
- **Depth**: 0.85 × TILE_SIZE = 8.5 units
- **Visual Size**: ~85% of grid cell
- **Examples**: Plot, Bench, Flower Pot, Scarecrow

### Standard 2x2 Buildings (20x20 units)
- **Barn**: 2×2 grid cells = 20×20 units
- **House**: 2×2 grid cells = 20×20 units  
- **Coop**: 2×2 grid cells (multi-animal house)
- **Pig Pen, Sheep Pen, Duck Pond**: 2×2 grid cells
- **Market, Warehouse**: 2×2 grid cells
- **Sugar Mill, Textile Mill, Jam Maker**: 2×2 grid cells
- **Gazebo**: 2×2 grid cells (decoration)

### Large Buildings (3x3 or bigger)
- **Mansion**: 3×3 grid cells = 30×30 units
- **Stable**: 3×2 grid cells = 30×20 units
- **Main House**: 3×3 grid cells = 30×30 units

### Single-Tile Wide Buildings (1x2 or 2x1)
- **Silo**: 1×1 (but tall, tower type)
- **Mill**: 1×1 (but tall, tower type)
- **Water Tower**: 1×1 (tower type)

---

## Animal Sizes (relative to TILE_SIZE)
All animals are scaled to fit within a single tile (10 units) but are visually distinct:

- **Cow**: 1.6×0.95×2.0 units (occupies ~1 grid tile)
- **Sheep**: 1.3×1.1×1.5 units (scaled with wool bumps)
- **Pig**: Sphere body 0.9→1.1×0.85×1.3 units
- **Chicken**: Small, ~0.8×0.8×0.8 units
- **Horse**: Larger, 1.5×1.1×2.6 units (occupies ~1-1.5 tile width)
- **Duck**: Small bird, ~0.7×0.7×0.7 units

### Roaming Behavior
- Animals spawn within building boundaries
- Wander within map boundaries (with 1.5-unit margin)
- Can occupy same visual space but are separate entities

---

## NPC Farmer Sizes
- **Total Height**: ~6-7 units
  - Hat: +0.9 units
  - Head: ~0.65 radius = 1.3 units
  - Torso: ~2.2 units
  - Legs: ~2.0 units
- **Width**: ~1.0 unit
- **Occupies**: ~1 grid tile (fit within 10×10 units)

---

## Crop/Plant Sizes (TILE_SIZE-based)

### Crop Growth Stages (on PLOT)
- **Seed Stage (Growth 0-0.33)**
  - Geometry: Small sphere 0.2-0.3 units
  - 10% of tile height

- **Growth Stage (0.33-0.66)**
  - Geometry: Small box 0.4-0.6 units wide
  - 20-40% of tile height

- **Mature/Ready (0.66-1.0)**
  - Geometry: Box ~0.9×0.9 base, 1.5-3.0 height
  - 50-80% of tile height
  - Varies by crop type (tall corn vs short lettuce)

### Crop Types by Height (when mature)
- **crop_small** (Wheat, Lettuce, Carrot): Height 0.8-1.2 units
- **crop_bush** (Tomato, Pepper, Rose): Height 1.5-2.0 units
- **crop_tall** (Corn, Sunflower, Grapes): Height 2.5-3.5 units
- **crop_ground** (Pumpkin, Watermelon): Spread 1.2-1.8 units wide

### Trees (Decorative)
- **Oak/Pine (decoration)**: ~3-4 units tall, 2-2.5 units wide
- **Fruit Trees**: ~4-5 units tall, 2.5-3 units wide (apple, orange, lemon, cherry)
- All fit within 1 grid tile footprint (vertically can exceed tile)

---

## Vehicle Sizes

### Vehicles (on TILE_SIZE grid)
- **Tractor**: ~1.2×1.5×2.5 units (fits in 1 tile)
- **Harvester**: ~1.3×1.6×2.8 units
- **Pickup Truck**: ~1.1×1.4×2.4 units
- **Taxi**: ~1.0×1.2×2.2 units (white Canberra Elite Taxis)
- **Sprayer**: ~1.2×1.4×2.6 units
- **Seed Drill**: ~1.3×1.5×2.7 units
- **Plow**: ~1.2×1.3×2.5 units

All vehicles occupy ~1 grid tile footprint.

---

## Decoration Sizes

### Small Decorations (fit in 1 tile)
- **Fence Post**: 0.25 × 0.8 height
- **Path Tile**: 8.5 × 8.5 units (like plot)
- **Bench**: ~0.8 × 1.5 units
- **Hay Bale**: ~0.9 × 0.9 × 0.6 units
- **Flower Pot**: ~0.5 × 0.6 height
- **Streetlight**: ~0.3 wide, ~3.0 height
- **Gnome**: ~0.4 × 0.4 × 0.8 height
- **Rock Cluster**: ~0.9 × 0.9 × 0.6 units

### Medium Decorations (2×2)
- **Gazebo**: 2×2 grid cells = 20×20 units

### Large/Special Decorations
- **Statue**: 1×1 tile, ~2.5 height
- **Fountain**: 1×1 tile, ~2.0 height
- **Bonfire**: 1×1 tile, ~1.5 height

---

## Collision & Placement Rules

### Snap-to-Grid Behavior
- **All buildings snap to nearest grid center**
- **Grid cell centers**: ...-5, 5, 15, 25, 35... (spaced 10 units apart)
- **Collision is checked at tile level**: If any tile of new building overlaps existing building's tiles, placement is blocked

### Boundary Margins
- **Map Boundary**: gridSize = 20, so map extends ±100 units
- **Collision margin for entities**: 1.5 units from edge
  - Animals clamp to: ±(100 - 1.5) = ±98.5 units
  - NPCs clamp to: ±98.5 units

### Move Mode Placement
1. User clicks at world position (px, pz)
2. System calculates grid snap: `Math.floor(px / 10) * 10 + 5`
3. Building position updates to snapped coordinate
4. Collision check validates against all OTHER buildings
5. If valid, building moves; if invalid, reverts to previous position

---

## Example Placements

### Single Tile (1×1)
Click at x=8, z=12:
- Snaps to x=5, z=15
- Placed at grid center

### Two Tile (2×2)
Click at x=14, z=24:
- Snaps to x=15, z=25
- Occupies tiles: 
  - (5-15, 15-25)
  - Centered at x=10, z=20

---

## References
- Fence connection distance: TILE_SIZE (10 units)
- Fence post size: 0.25 × TILE_SIZE = 2.5 units wide, 8 units tall
- Fence rail length: 0.5 × TILE_SIZE = 5 units (connects to neighbor center)
- Plot soil base: 0.85 × TILE_SIZE = 8.5 units

