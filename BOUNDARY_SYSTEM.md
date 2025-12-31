# Terrain Boundary System

## Overview
All buildings, crops, animals, NPCs, objects, plots, trees, and vehicles are constrained within a consistent margin from the terrain edges. This margin **dynamically scales** when the terrain is expanded.

## Boundary Calculation

**Formula:**
```javascript
const limit = (gameState.gridSize * TILE_SIZE) / 2 - 1.5;
```

**Components:**
- `gameState.gridSize`: Current grid size (default 20, expands by +10 each expansion)
- `TILE_SIZE`: 10 units (constant)
- `/ 2`: Half the terrain size (from center to edge)
- `- 1.5`: Margin buffer in units

**Examples:**
- Default grid (20×20): limit = (20 × 10) / 2 - 1.5 = **98.5 units**
- Expanded once (30×30): limit = (30 × 10) / 2 - 1.5 = **148.5 units**
- Expanded twice (40×40): limit = (40 × 10) / 2 - 1.5 = **198.5 units**

## Protected Areas (where nothing can be placed)

- **X-axis**: Beyond ±98.5 units (default)
- **Y-axis**: Beyond ±98.5 units (default)
- **Automatically expands** when terrain is expanded

## Applied To

All these systems check the same boundary with 1.5-unit margin:

1. **Building Placement** (Build Mode)
   - `handleGridClick()` - Line 5861
   - Prevents placing buildings within margin

2. **Building Moving** (Move Mode - Drag)
   - Drag handler - Line 2573
   - Real-time cursor following with boundary clamping

3. **Building Placement Finalization** (Move Mode - Release)
   - Move finalize handler - Line 5426
   - Final position respects boundary

4. **Grid Preview**
   - Build mode preview - Line 2618
   - Shows where building will snap

5. **Collision Detection**
   - `checkCollision()` - Line 1171
   - Validates building footprints within bounds

6. **Animal Movement** (`updateAnimals()`)
   - Line 4840
   - Animals roam but stay within margin

7. **NPC Movement** (`updateNPCs()`)
   - Line 10375
   - Farmers stay within margin during pathfinding

## Key Features

✅ **Unified Margin**: All systems use same 1.5-unit margin
✅ **Dynamic Scaling**: Automatically recalculates when `gameState.gridSize` changes
✅ **Uses GameState**: All calculations reference `gameState.gridSize`, not static `gridSize` variable
✅ **Consistent Formula**: Every boundary check uses identical calculation
✅ **Prevents Clipping**: Nothing extends beyond terrain edges
✅ **User Feedback**: Build mode shows "Cannot place too close to boundary!" warning

## Terrain Expansion Integration

When `expandFarm()` is called:
1. `gameState.gridSize` increases by 10
2. Terrain plane is rebuilt with new size
3. All boundary checks automatically use new gridSize
4. Margin moves outward proportionally
5. All placement systems inherit new limits

**No code changes needed** - margins scale automatically!

## Margin Purpose

The **1.5-unit margin** ensures:
- Visual objects don't clip through terrain edges
- Camera view stays clear of boundary artifacts
- Smooth user experience at map edges
- Consistent behavior across all object types

