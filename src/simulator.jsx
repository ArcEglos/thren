import React, { useState, useCallback, useMemo } from 'react';

const CELL_SIZE = 80;
const HEX_SIZE = 26;
const HEX_ROTATION_RANGE = 30;

// Flow groups - magical affinities
// All lines connect at edge midpoint (0.5) for simpler matching
const FLOW_GROUPS = {
  growth: { color: '#4a9c5b' },   // green - nature/life
  stone:  { color: '#7a6b5c' },   // brown/gray - earth/stability  
  tide:   { color: '#4a7c9c' },   // blue - water/flow
  ember:  { color: '#9c5c4a' },   // red/orange - fire/energy
  void:   { color: '#6b5c7c' },   // purple - arcane/mystery
};

const GROUP_NAMES = Object.keys(FLOW_GROUPS);

// Item catalog - defines all item types, their possible shapes, and valid group combinations
// Shapes are defined as cell coordinate arrays
// Group combos define thematically appropriate magic types for each shape
const ITEM_CATALOG = {
  // === WEAPONS ===
  dagger: {
    name: "Dagger",
    category: "weapon",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:0, y:1}],  // 2x1 vertical
        groupCombos: [['ember'], ['void'], ['stone'], ['ember', 'void'], ['stone', 'ember']]
      }
    ]
  },
  sword: {
    name: "Sword",
    category: "weapon",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:0, y:1}, {x:0, y:2}],  // 3x1 vertical
        groupCombos: [['ember'], ['stone'], ['ember', 'stone'], ['ember', 'void']]
      },
      {
        cells: [{x:0, y:0}, {x:0, y:1}, {x:1, y:0}],  // L-shape (sword + crossguard)
        groupCombos: [['ember', 'stone'], ['stone', 'void'], ['ember', 'stone', 'void']]
      }
    ]
  },
  axe: {
    name: "Axe",
    category: "weapon",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:0, y:1}, {x:1, y:0}],  // L-shape
        groupCombos: [['ember'], ['stone'], ['ember', 'stone']]
      }
    ]
  },
  staff: {
    name: "Staff",
    category: "weapon",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:0, y:1}, {x:0, y:2}],  // 3x1 vertical
        groupCombos: [['void'], ['growth'], ['tide'], ['void', 'growth'], ['void', 'tide']]
      },
      {
        cells: [{x:0, y:0}, {x:0, y:1}, {x:0, y:2}, {x:0, y:3}],  // 4x1 vertical
        groupCombos: [['void', 'tide'], ['void', 'growth'], ['void', 'ember'], ['void', 'tide', 'growth']]
      }
    ]
  },
  bow: {
    name: "Bow",
    category: "weapon",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:1, y:1}, {x:0, y:2}],  // curved shape
        groupCombos: [['growth'], ['tide'], ['growth', 'tide'], ['growth', 'ember']]
      }
    ]
  },
  
  // === ARMOR ===
  helmet: {
    name: "Helmet",
    category: "armor",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:1, y:0}],  // 2x1 horizontal
        groupCombos: [['stone'], ['stone', 'ember'], ['stone', 'void']]
      },
      {
        cells: [{x:0, y:0}, {x:1, y:0}, {x:0, y:1}],  // L-shape
        groupCombos: [['stone', 'void'], ['stone', 'ember'], ['stone', 'tide']]
      }
    ]
  },
  shield: {
    name: "Shield",
    category: "armor",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:1, y:0}, {x:0, y:1}, {x:1, y:1}],  // 2x2 square
        groupCombos: [['stone'], ['stone', 'ember'], ['stone', 'growth'], ['stone', 'tide']]
      },
      {
        cells: [{x:0, y:0}, {x:1, y:0}, {x:2, y:0}],  // 3x1 horizontal
        groupCombos: [['stone'], ['stone', 'void']]
      }
    ]
  },
  boots: {
    name: "Boots",
    category: "armor",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:1, y:0}],  // 2x1 (pair)
        groupCombos: [['tide'], ['growth'], ['tide', 'growth'], ['ember', 'tide']]
      }
    ]
  },
  gloves: {
    name: "Gloves",
    category: "armor",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:1, y:0}],  // 2x1 (pair)
        groupCombos: [['ember'], ['void'], ['ember', 'void'], ['stone', 'ember']]
      }
    ]
  },
  cloak: {
    name: "Cloak",
    category: "armor",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:1, y:0}, {x:0, y:1}, {x:1, y:1}, {x:0, y:2}],  // flowing shape
        groupCombos: [['void'], ['tide'], ['void', 'tide'], ['void', 'growth']]
      },
      {
        cells: [{x:0, y:0}, {x:1, y:0}, {x:0, y:1}],  // smaller cloak
        groupCombos: [['void'], ['tide', 'void']]
      }
    ]
  },
  
  // === ACCESSORIES ===
  ring: {
    name: "Ring",
    category: "accessory",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['void'], ['ember'], ['tide'], ['growth'], ['stone'], 
                      ['void', 'ember'], ['void', 'tide'], ['ember', 'stone']]
      }
    ]
  },
  amulet: {
    name: "Amulet",
    category: "accessory",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['void'], ['growth'], ['tide'], ['void', 'growth'], ['void', 'tide']]
      },
      {
        cells: [{x:0, y:0}, {x:0, y:1}],  // 2x1 (with chain)
        groupCombos: [['void', 'stone'], ['void', 'ember'], ['growth', 'tide']]
      }
    ]
  },
  belt: {
    name: "Belt",
    category: "accessory",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:1, y:0}, {x:2, y:0}],  // 3x1 horizontal
        groupCombos: [['stone'], ['growth'], ['stone', 'growth'], ['stone', 'ember']]
      }
    ]
  },
  
  // === CONSUMABLES ===
  potion: {
    name: "Potion",
    category: "consumable",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['tide'], ['growth'], ['ember'], ['tide', 'growth'], ['tide', 'ember'], ['growth', 'void']]
      }
    ]
  },
  scroll: {
    name: "Scroll",
    category: "consumable",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['void'], ['void', 'ember'], ['void', 'tide'], ['void', 'growth']]
      },
      {
        cells: [{x:0, y:0}, {x:1, y:0}],  // 2x1 (larger scroll)
        groupCombos: [['void', 'tide'], ['void', 'ember'], ['void', 'growth', 'tide']]
      }
    ]
  },
  
  // === TOOLS ===
  lantern: {
    name: "Lantern",
    category: "tool",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['ember'], ['ember', 'void'], ['ember', 'tide']]
      }
    ]
  },
  compass: {
    name: "Compass",
    category: "tool",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['stone'], ['tide'], ['stone', 'tide'], ['void', 'stone']]
      }
    ]
  },
  key: {
    name: "Key",
    category: "tool",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['stone'], ['void'], ['stone', 'void'], ['ember', 'stone']]
      }
    ]
  },
  rope: {
    name: "Rope",
    category: "tool",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:1, y:0}],  // 2x1
        groupCombos: [['growth'], ['stone'], ['growth', 'stone']]
      }
    ]
  },
  
  // === MAGICAL ITEMS ===
  orb: {
    name: "Orb",
    category: "magical",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['void'], ['tide'], ['ember'], ['void', 'tide'], ['void', 'ember'], ['tide', 'ember']]
      }
    ]
  },
  tome: {
    name: "Tome",
    category: "magical",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:1, y:0}],  // 2x1
        groupCombos: [['void'], ['void', 'growth'], ['void', 'tide'], ['void', 'ember']]
      },
      {
        cells: [{x:0, y:0}, {x:1, y:0}, {x:0, y:1}],  // L-shape (thick tome)
        groupCombos: [['void', 'stone'], ['void', 'growth', 'tide']]
      }
    ]
  },
  crystal: {
    name: "Crystal",
    category: "magical",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1 small crystal
        groupCombos: [['tide'], ['void'], ['ember'], ['growth']]
      },
      {
        cells: [{x:0, y:0}, {x:0, y:1}],  // 2x1 vertical crystal
        groupCombos: [['tide', 'void'], ['ember', 'void'], ['growth', 'tide']]
      },
      {
        cells: [{x:0, y:0}, {x:1, y:0}, {x:0, y:1}],  // L-shape cluster
        groupCombos: [['void', 'tide', 'ember'], ['tide', 'growth', 'void']]
      }
    ]
  },
  gem: {
    name: "Gem",
    category: "magical",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['stone'], ['ember'], ['tide'], ['void'], ['growth'],
                      ['stone', 'ember'], ['stone', 'tide'], ['ember', 'void']]
      }
    ]
  },
  mirror: {
    name: "Mirror",
    category: "magical",
    shapes: [
      {
        cells: [{x:0, y:0}, {x:1, y:0}],  // 2x1
        groupCombos: [['void'], ['tide'], ['void', 'tide']]
      }
    ]
  },
  
  // === NATURE ITEMS ===
  herb: {
    name: "Herb",
    category: "nature",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['growth'], ['growth', 'tide'], ['growth', 'stone']]
      }
    ]
  },
  flower: {
    name: "Flower",
    category: "nature",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['growth'], ['growth', 'tide'], ['growth', 'ember']]
      }
    ]
  },
  feather: {
    name: "Feather",
    category: "nature",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['tide'], ['growth'], ['tide', 'growth'], ['tide', 'void']]
      }
    ]
  },
  bone: {
    name: "Bone",
    category: "nature",
    shapes: [
      {
        cells: [{x:0, y:0}],  // 1x1
        groupCombos: [['stone'], ['void'], ['stone', 'void']]
      },
      {
        cells: [{x:0, y:0}, {x:1, y:0}],  // 2x1
        groupCombos: [['stone', 'void'], ['void', 'ember']]
      }
    ]
  },
  
  // === CONTAINERS ===
  // Containers have solidCells (with hex slots) attached to hollowCells (storage)
  // Solid cells grow from attachment points adjacent to hollow - they don't need to surround
  pouch: {
    name: "Pouch",
    category: "container",
    isContainer: true,
    shapes: [
      {
        // Tiny pouch: 2 solid attached to 1 hollow
        solidCells: [{x:0, y:0}, {x:1, y:1}],
        hollowCells: [{x:1, y:0}],
        groupCombos: [['growth'], ['stone'], ['growth', 'stone']]
      },
      {
        // Small pouch: 3 solid attached to 2 hollow
        solidCells: [{x:0, y:0}, {x:0, y:1}, {x:0, y:2}],
        hollowCells: [{x:1, y:0}, {x:1, y:1}],
        groupCombos: [['growth'], ['stone'], ['growth', 'stone']]
      }
    ]
  },
  coinPurse: {
    name: "Coin Purse",
    category: "container",
    isContainer: true,
    shapes: [
      {
        // Tiny purse: 1 solid + 1 hollow
        solidCells: [{x:0, y:0}],
        hollowCells: [{x:1, y:0}],
        groupCombos: [['stone'], ['growth'], ['stone', 'ember']]
      },
      {
        // Small purse: 2 solid + 2 hollow in L
        solidCells: [{x:0, y:0}, {x:0, y:1}],
        hollowCells: [{x:1, y:0}, {x:1, y:1}],
        groupCombos: [['stone'], ['growth', 'stone']]
      }
    ]
  },
  bag: {
    name: "Bag",
    category: "container",
    isContainer: true,
    shapes: [
      {
        // Small bag: 2 solid + 2 hollow
        solidCells: [{x:0, y:0}, {x:1, y:0}],
        hollowCells: [{x:2, y:0}, {x:0, y:1}],
        groupCombos: [['growth'], ['stone'], ['growth', 'stone']]
      },
      {
        // Medium bag: 3 solid + 3 hollow
        solidCells: [{x:0, y:0}, {x:1, y:0}, {x:2, y:0}],
        hollowCells: [{x:0, y:1}, {x:1, y:1}, {x:2, y:1}],
        groupCombos: [['growth', 'stone'], ['growth', 'tide']]
      }
    ]
  },
  satchel: {
    name: "Satchel",
    category: "container",
    isContainer: true,
    shapes: [
      {
        // Satchel: L-shaped solid with hollow pocket
        solidCells: [{x:0, y:0}, {x:1, y:0}, {x:0, y:1}],
        hollowCells: [{x:2, y:0}, {x:1, y:1}],
        groupCombos: [['growth'], ['stone'], ['growth', 'stone'], ['growth', 'tide']]
      }
    ]
  },
  chest: {
    name: "Chest",
    category: "container",
    isContainer: true,
    shapes: [
      {
        // Small chest: 2 solid + 4 hollow
        solidCells: [{x:0, y:0}, {x:0, y:1}],
        hollowCells: [{x:1, y:0}, {x:2, y:0}, {x:1, y:1}, {x:2, y:1}],
        groupCombos: [['stone'], ['stone', 'ember'], ['stone', 'void']]
      },
      {
        // Medium chest: 3 solid + 6 hollow
        solidCells: [{x:0, y:0}, {x:0, y:1}, {x:0, y:2}],
        hollowCells: [{x:1, y:0}, {x:2, y:0}, {x:1, y:1}, {x:2, y:1}, {x:1, y:2}, {x:2, y:2}],
        groupCombos: [['stone'], ['stone', 'ember'], ['stone', 'void'], ['stone', 'growth']]
      }
    ]
  },
  box: {
    name: "Box",
    category: "container",
    isContainer: true,
    shapes: [
      {
        // Simple box: 2 solid + 2 hollow square
        solidCells: [{x:0, y:0}, {x:1, y:0}],
        hollowCells: [{x:0, y:1}, {x:1, y:1}],
        groupCombos: [['stone'], ['growth'], ['stone', 'growth']]
      }
    ]
  },
  quiver: {
    name: "Quiver",
    category: "container",
    isContainer: true,
    shapes: [
      {
        // Tall quiver: vertical solid + hollow
        solidCells: [{x:0, y:0}, {x:0, y:1}],
        hollowCells: [{x:1, y:0}, {x:1, y:1}],
        groupCombos: [['growth'], ['stone'], ['growth', 'ember']]
      },
      {
        // Larger quiver
        solidCells: [{x:0, y:0}, {x:0, y:1}, {x:0, y:2}],
        hollowCells: [{x:1, y:0}, {x:1, y:1}, {x:1, y:2}],
        groupCombos: [['growth', 'stone'], ['growth', 'ember']]
      }
    ]
  },
  barrel: {
    name: "Barrel",
    category: "container",
    isContainer: true,
    shapes: [
      {
        // Small barrel: 2 solid + 4 hollow
        solidCells: [{x:0, y:0}, {x:0, y:1}],
        hollowCells: [{x:1, y:0}, {x:1, y:1}, {x:2, y:0}, {x:2, y:1}],
        groupCombos: [['growth'], ['stone'], ['growth', 'tide']]
      }
    ]
  },
  crate: {
    name: "Crate",
    category: "container",
    isContainer: true,
    shapes: [
      {
        // Square crate: L solid + 3 hollow
        solidCells: [{x:0, y:0}, {x:1, y:0}, {x:0, y:1}],
        hollowCells: [{x:1, y:1}, {x:2, y:0}, {x:2, y:1}],
        groupCombos: [['growth'], ['stone'], ['growth', 'stone']]
      }
    ]
  },
  backpack: {
    name: "Backpack",
    category: "container",
    isContainer: true,
    shapes: [
      {
        // Backpack: vertical solid + large hollow
        solidCells: [{x:0, y:0}, {x:0, y:1}, {x:0, y:2}],
        hollowCells: [{x:1, y:0}, {x:1, y:1}, {x:1, y:2}, {x:2, y:1}],
        groupCombos: [['growth'], ['stone'], ['growth', 'stone'], ['growth', 'tide']]
      }
    ]
  },
  trunk: {
    name: "Trunk",
    category: "container", 
    isContainer: true,
    shapes: [
      {
        // Large trunk: 3 solid + 6 hollow
        solidCells: [{x:0, y:0}, {x:1, y:0}, {x:2, y:0}],
        hollowCells: [{x:0, y:1}, {x:1, y:1}, {x:2, y:1}, {x:0, y:2}, {x:1, y:2}, {x:2, y:2}],
        groupCombos: [['stone'], ['stone', 'void'], ['stone', 'ember']]
      }
    ]
  }
};

// Helper to pick a random item from catalog
function pickRandomItem(options = {}) {
  const { category, isContainer, minCells, maxCells } = options;
  
  let candidates = Object.entries(ITEM_CATALOG);
  
  // Filter by category if specified
  if (category) {
    candidates = candidates.filter(([_, item]) => item.category === category);
  }
  
  // Filter by container status if specified
  if (isContainer !== undefined) {
    candidates = candidates.filter(([_, item]) => !!item.isContainer === isContainer);
  }
  
  // Helper to get solid cell count from a shape
  const getSolidCellCount = (shape) => {
    return shape.solidCells ? shape.solidCells.length : shape.cells.length;
  };
  
  // Filter by cell count if specified (counts solid cells only)
  if (minCells !== undefined || maxCells !== undefined) {
    candidates = candidates.filter(([_, item]) => {
      return item.shapes.some(shape => {
        const cellCount = getSolidCellCount(shape);
        if (minCells !== undefined && cellCount < minCells) return false;
        if (maxCells !== undefined && cellCount > maxCells) return false;
        return true;
      });
    });
  }
  
  if (candidates.length === 0) return null;
  
  // Pick random item
  const [itemKey, item] = candidates[Math.floor(Math.random() * candidates.length)];
  
  // Pick random shape (filtered by cell count if needed)
  let validShapes = item.shapes;
  if (minCells !== undefined || maxCells !== undefined) {
    validShapes = item.shapes.filter(shape => {
      const cellCount = getSolidCellCount(shape);
      if (minCells !== undefined && cellCount < minCells) return false;
      if (maxCells !== undefined && cellCount > maxCells) return false;
      return true;
    });
  }
  
  const shape = validShapes[Math.floor(Math.random() * validShapes.length)];
  
  // Pick random group combo for this shape
  const groupCombo = shape.groupCombos[Math.floor(Math.random() * shape.groupCombos.length)];
  
  // Handle container vs non-container shapes
  if (shape.solidCells) {
    // Container shape with solid and hollow cells
    return {
      key: itemKey,
      name: item.name,
      category: item.category,
      isContainer: true,
      cells: shape.solidCells,  // Solid cells for hex placement
      hollowCells: shape.hollowCells,  // Hollow cells for storage display
      groups: groupCombo
    };
  } else {
    // Regular item shape
    return {
      key: itemKey,
      name: item.name,
      category: item.category,
      isContainer: false,
      cells: shape.cells,
      hollowCells: null,
      groups: groupCombo
    };
  }
}

// Syllables with multiple representations (different group combinations)
// Each representation is a valid way to "channel" that syllable
const ARCANE_SYLLABLES = [
  { name: "Aqua", symbol: "≋", representations: [['tide'], ['tide', 'growth'], ['tide', 'stone'], ['tide', 'growth', 'stone']] },
  { name: "Terra", symbol: "▲", representations: [['stone'], ['stone', 'growth'], ['stone', 'ember'], ['stone', 'growth', 'ember']] },
  { name: "Ignis", symbol: "♦", representations: [['ember'], ['ember', 'void'], ['ember', 'stone'], ['ember', 'void', 'stone']] },
  { name: "Ventus", symbol: "◎", representations: [['tide', 'void'], ['void'], ['tide'], ['tide', 'void', 'growth']] },
  { name: "Petra", symbol: "◇", representations: [['stone'], ['stone', 'void'], ['stone', 'tide'], ['stone', 'void', 'tide']] },
  { name: "Molli", symbol: "○", representations: [['growth'], ['growth', 'tide'], ['growth', 'void'], ['growth', 'tide', 'void']] },
  { name: "Motus", symbol: "➤", representations: [['ember', 'tide'], ['ember'], ['tide'], ['ember', 'tide', 'void']] },
  { name: "Quies", symbol: "◈", representations: [['stone', 'void'], ['void'], ['stone'], ['stone', 'void', 'growth']] },
  { name: "Lux", symbol: "✦", representations: [['ember', 'growth'], ['ember'], ['growth'], ['ember', 'growth', 'tide']] },
  { name: "Umbra", symbol: "◐", representations: [['void'], ['void', 'tide'], ['void', 'growth'], ['void', 'tide', 'ember']] },
  { name: "Vita", symbol: "❋", representations: [['growth'], ['growth', 'ember'], ['growth', 'stone'], ['growth', 'ember', 'void']] },
  { name: "Mortis", symbol: "✕", representations: [['void', 'stone'], ['void'], ['stone'], ['void', 'stone', 'ember']] },
  { name: "Tempus", symbol: "⧗", representations: [['void', 'tide'], ['tide'], ['void'], ['void', 'tide', 'stone']] },
  { name: "Anima", symbol: "✧", representations: [['growth', 'ember'], ['growth'], ['ember'], ['growth', 'ember', 'stone']] },
];

// Find external edges of the hex cluster (true perimeter only)
// Returns array of { hexIdx, edgeIdx } for edges on the outer boundary
function findExternalHexEdges(hexes, hexSize, rotationDeg) {
  const externalEdges = [];
  const rotRad = (rotationDeg * Math.PI) / 180;
  
  // For each hex, check each edge
  for (let hexIdx = 0; hexIdx < hexes.length; hexIdx++) {
    const hex = hexes[hexIdx];
    
    for (let edgeIdx = 0; edgeIdx < 6; edgeIdx++) {
      // Get edge corners
      const angle1 = (Math.PI / 3) * edgeIdx + rotRad;
      const angle2 = (Math.PI / 3) * ((edgeIdx + 1) % 6) + rotRad;
      
      const corner1x = hex.center.x + hexSize * Math.cos(angle1);
      const corner1y = hex.center.y + hexSize * Math.sin(angle1);
      const corner2x = hex.center.x + hexSize * Math.cos(angle2);
      const corner2y = hex.center.y + hexSize * Math.sin(angle2);
      
      // Edge midpoint
      const edgeMidX = (corner1x + corner2x) / 2;
      const edgeMidY = (corner1y + corner2y) / 2;
      
      // Check if any OTHER hex has its center close to this edge midpoint
      // If a neighbor shares this edge, its center would be ~hexSize away from the midpoint
      const hasNeighbor = hexes.some((other, otherIdx) => {
        if (otherIdx === hexIdx) return false;
        const distToMid = Math.sqrt(
          Math.pow(other.center.x - edgeMidX, 2) + 
          Math.pow(other.center.y - edgeMidY, 2)
        );
        // Neighbor center should be about hexSize * 0.866 away from edge midpoint
        // Use generous threshold to catch all neighbors
        return distToMid < hexSize * 1.5;
      });
      
      if (!hasNeighbor) {
        externalEdges.push({ hexIdx, edgeIdx });
      }
    }
  }
  
  return externalEdges;
}

// Generate stability markers only for external edges
// Assign stability markers: balanced or slightly skewed toward volatility


function createHexagon(cx, cy, size, rotationDeg = 0) {
  const points = [];
  const rotationRad = (rotationDeg * Math.PI) / 180;
  
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + rotationRad;
    points.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle)
    });
  }
  return points;
}

function generateHexGrid(boundingWidth, boundingHeight, hexSize, offsetX = 0, offsetY = 0, rotation = 0) {
  const hexagons = [];
  
  const hexWidth = hexSize * 2;
  const hexHeight = hexSize * Math.sqrt(3);
  const horizSpacing = hexWidth * 0.75;
  const vertSpacing = hexHeight;
  
  const rotRad = (rotation * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  
  for (let row = -3; row < Math.ceil(boundingHeight / vertSpacing) + 3; row++) {
    for (let col = -3; col < Math.ceil(boundingWidth / horizSpacing) + 3; col++) {
      let bx = col * horizSpacing;
      let by = row * vertSpacing + (col % 2 === 1 ? vertSpacing / 2 : 0);
      
      const rx = bx * cosR - by * sinR - offsetX;
      const ry = bx * sinR + by * cosR - offsetY;
      
      hexagons.push({
        center: { x: rx, y: ry },
        points: createHexagon(rx, ry, hexSize, rotation)
      });
    }
  }
  
  return hexagons;
}

// Check if a point is inside the unified solid region
// The region is the union of all solid cells, with margin only on external edges
function isPointInSolidRegion(px, py, solidCells, cellSet, margin = 8) {
  // First, find which cell this point would be in
  const cellX = Math.floor(px / CELL_SIZE);
  const cellY = Math.floor(py / CELL_SIZE);
  const cellKey = `${cellX},${cellY}`;
  
  // If the point's cell isn't in our solid region, it's outside
  if (!cellSet.has(cellKey)) return false;
  
  // Now check margins - but only against EXTERNAL edges
  const localX = px - cellX * CELL_SIZE;
  const localY = py - cellY * CELL_SIZE;
  
  // Check each edge - only apply margin if it's an external edge
  const hasTop = cellSet.has(`${cellX},${cellY - 1}`);
  const hasBottom = cellSet.has(`${cellX},${cellY + 1}`);
  const hasLeft = cellSet.has(`${cellX - 1},${cellY}`);
  const hasRight = cellSet.has(`${cellX + 1},${cellY}`);
  
  if (!hasTop && localY < margin) return false;
  if (!hasBottom && localY > CELL_SIZE - margin) return false;
  if (!hasLeft && localX < margin) return false;
  if (!hasRight && localX > CELL_SIZE - margin) return false;
  
  return true;
}

function isHexInSolidRegion(hex, solidCells, cellSet, margin = 4) {
  return hex.points.every(point => 
    isPointInSolidRegion(point.x, point.y, solidCells, cellSet, margin)
  );
}

function hexDistance(hex1, hex2) {
  const dx = hex1.center.x - hex2.center.x;
  const dy = hex1.center.y - hex2.center.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function areHexesAdjacent(hex1, hex2, hexSize) {
  const maxAdjacentDist = hexSize * 1.8;
  return hexDistance(hex1, hex2) < maxAdjacentDist;
}

// Check if two hex edges share the same position (for merging)
function hexesShareEdge(hex1, hex2) {
  // Two hexes share an edge if they have two vertices very close together
  const threshold = 1;
  let sharedCount = 0;
  let sharedVertices = [];
  
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const dx = hex1.points[i].x - hex2.points[j].x;
      const dy = hex1.points[i].y - hex2.points[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        sharedCount++;
        sharedVertices.push({ i, j });
      }
    }
  }
  
  return sharedCount >= 2 ? sharedVertices : null;
}

// Compute the merged boundary path for a group of hexes
function computeMergedBoundary(hexes) {
  if (hexes.length === 1) {
    return {
      path: hexToPath(hexes[0].points),
      externalEdges: hexes[0].points.map((p, i) => ({
        p1: p,
        p2: hexes[0].points[(i + 1) % 6],
        edgeIdx: i
      }))
    };
  }
  
  // Find all edges and mark which are internal (shared) vs external
  const allEdges = [];
  const edgeKey = (p1, p2) => {
    // Create a key that's the same regardless of direction
    const minX = Math.min(p1.x, p2.x).toFixed(1);
    const maxX = Math.max(p1.x, p2.x).toFixed(1);
    const minY = Math.min(p1.y, p2.y).toFixed(1);
    const maxY = Math.max(p1.y, p2.y).toFixed(1);
    return `${minX},${minY}-${maxX},${maxY}`;
  };
  
  const edgeCounts = new Map();
  
  hexes.forEach((hex, hexIdx) => {
    for (let i = 0; i < 6; i++) {
      const p1 = hex.points[i];
      const p2 = hex.points[(i + 1) % 6];
      const key = edgeKey(p1, p2);
      
      if (!edgeCounts.has(key)) {
        edgeCounts.set(key, { count: 0, edges: [] });
      }
      edgeCounts.get(key).count++;
      edgeCounts.get(key).edges.push({ hexIdx, edgeIdx: i, p1, p2 });
    }
  });
  
  // External edges appear only once
  const externalEdges = [];
  edgeCounts.forEach((data, key) => {
    if (data.count === 1) {
      externalEdges.push(data.edges[0]);
    }
  });
  
  // Build path by walking around external edges
  // Start with first external edge
  if (externalEdges.length === 0) return { path: '', externalEdges: [] };
  
  const orderedPoints = [];
  const used = new Set();
  let current = externalEdges[0];
  orderedPoints.push(current.p1);
  orderedPoints.push(current.p2);
  used.add(0);
  
  // Keep finding next connected edge
  while (used.size < externalEdges.length) {
    const lastPoint = orderedPoints[orderedPoints.length - 1];
    let foundNext = false;
    
    for (let i = 0; i < externalEdges.length; i++) {
      if (used.has(i)) continue;
      const edge = externalEdges[i];
      const threshold = 0.5;
      
      // Check if this edge starts where we left off
      if (Math.abs(edge.p1.x - lastPoint.x) < threshold && 
          Math.abs(edge.p1.y - lastPoint.y) < threshold) {
        orderedPoints.push(edge.p2);
        used.add(i);
        foundNext = true;
        break;
      }
      // Or if it's reversed
      if (Math.abs(edge.p2.x - lastPoint.x) < threshold && 
          Math.abs(edge.p2.y - lastPoint.y) < threshold) {
        orderedPoints.push(edge.p1);
        used.add(i);
        foundNext = true;
        break;
      }
    }
    
    if (!foundNext) break;
  }
  
  // Create SVG path
  const path = `M ${orderedPoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')} Z`;
  
  return { path, externalEdges, orderedPoints };
}

// Find a good position for syllable icons within a tile (use centroid)
function findIconPosition(hexes) {
  const centroidX = hexes.reduce((sum, h) => sum + h.center.x, 0) / hexes.length;
  const centroidY = hexes.reduce((sum, h) => sum + h.center.y, 0) / hexes.length;
  return { x: centroidX, y: centroidY };
}

// Find which edge of hexA faces hexB (0-5)
function findFacingEdge(hexA, hexB, hexRotation) {
  const dx = hexB.center.x - hexA.center.x;
  const dy = hexB.center.y - hexA.center.y;
  const angle = Math.atan2(dy, dx);
  const rotRad = (hexRotation * Math.PI) / 180;
  
  // Normalize angle relative to hex rotation
  let normalizedAngle = angle - rotRad;
  while (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
  while (normalizedAngle >= Math.PI * 2) normalizedAngle -= Math.PI * 2;
  
  // Each edge spans 60 degrees (PI/3), centered on its outward direction
  // Edge 0 points at angle 0 (right), edge 1 at PI/3, etc.
  const edgeIndex = Math.round(normalizedAngle / (Math.PI / 3)) % 6;
  return edgeIndex;
}

// Connect flow lines at shared edges within multi-hex tiles
function connectFlowLinesInTile(tile, hexRotation) {
  if (tile.hexes.length < 2) return;
  
  // Find all pairs of adjacent hexes and their shared edges
  const adjacencies = [];
  for (let i = 0; i < tile.hexes.length; i++) {
    for (let j = i + 1; j < tile.hexes.length; j++) {
      const dist = hexDistance(tile.hexes[i], tile.hexes[j]);
      if (dist < HEX_SIZE * 1.8) {
        const edgeA = findFacingEdge(tile.hexes[i], tile.hexes[j], hexRotation);
        const edgeB = findFacingEdge(tile.hexes[j], tile.hexes[i], hexRotation);
        adjacencies.push({ hexIdxA: i, hexIdxB: j, edgeA, edgeB });
      }
    }
  }
  
  // Helper: get all edges used by flow lines in a hex
  const getUsedEdges = (hex) => {
    const used = new Map(); // edge -> flowLine
    for (const flow of hex.flowLines) {
      if (flow.edge1 !== null) used.set(flow.edge1, flow);
      if (flow.edge2 !== null) used.set(flow.edge2, flow);
    }
    return used;
  };
  
  // Helper: find an unused edge to swap to
  const findFreeEdge = (hex, usedEdges, excludeEdge) => {
    for (let e = 0; e < 6; e++) {
      if (!usedEdges.has(e) && e !== excludeEdge) return e;
    }
    return null;
  };
  
  // For each adjacency, find matching groups and connect them
  for (const adj of adjacencies) {
    const hexA = tile.hexes[adj.hexIdxA];
    const hexB = tile.hexes[adj.hexIdxB];
    
    // Find groups that exist in both hexes (excluding dead-end lines)
    const flowsA = hexA.flowLines.filter(f => f.edge2 !== null);
    const flowsB = hexB.flowLines.filter(f => f.edge2 !== null);
    
    for (const flowA of flowsA) {
      const flowB = flowsB.find(f => f.group === flowA.group);
      if (!flowB) continue;
      
      // Check if flowA already touches the shared edge
      const aAtShared = flowA.edge1 === adj.edgeA || flowA.edge2 === adj.edgeA;
      // Check if flowB already touches the shared edge
      const bAtShared = flowB.edge1 === adj.edgeB || flowB.edge2 === adj.edgeB;
      
      if (aAtShared && bAtShared) continue; // Already connected
      
      // Try to connect A to shared edge
      if (!aAtShared) {
        const usedA = getUsedEdges(hexA);
        const blockerA = usedA.get(adj.edgeA);
        
        if (!blockerA) {
          // Shared edge is free, just move edge2 there
          flowA.edge2 = adj.edgeA;
        } else if (blockerA !== flowA) {
          // Another flow line is blocking - try to move it
          const freeEdge = findFreeEdge(hexA, usedA, adj.edgeA);
          if (freeEdge !== null) {
            // Move blocker's endpoint to free edge
            if (blockerA.edge1 === adj.edgeA) blockerA.edge1 = freeEdge;
            else blockerA.edge2 = freeEdge;
            // Now assign shared edge to our flow
            flowA.edge2 = adj.edgeA;
          }
        }
      }
      
      // Try to connect B to shared edge
      if (!bAtShared) {
        const usedB = getUsedEdges(hexB);
        const blockerB = usedB.get(adj.edgeB);
        
        if (!blockerB) {
          // Shared edge is free, just move edge2 there
          flowB.edge2 = adj.edgeB;
        } else if (blockerB !== flowB) {
          // Another flow line is blocking - try to move it
          const freeEdge = findFreeEdge(hexB, usedB, adj.edgeB);
          if (freeEdge !== null) {
            // Move blocker's endpoint to free edge
            if (blockerB.edge1 === adj.edgeB) blockerB.edge1 = freeEdge;
            else blockerB.edge2 = freeEdge;
            // Now assign shared edge to our flow
            flowB.edge2 = adj.edgeB;
          }
        }
      }
    }
  }
}

// Group hexes into tiles (single, double, or triple hex tiles)
function groupHexesIntoTiles(hexes, hexRotation, skipHexIndices = []) {
  if (hexes.length === 0) return [];
  
  const tiles = [];
  const assigned = new Set();
  
  // Mark cutout hexes as already assigned so they're skipped
  for (const idx of skipHexIndices) {
    assigned.add(idx);
  }
  
  // Shuffle for randomness
  const indices = hexes.map((_, i) => i).sort(() => Math.random() - 0.5);
  
  // Leave some hexes uncovered (20-40% empty)
  const coverageTarget = 0.6 + Math.random() * 0.2; // 60-80% coverage
  const maxToCover = Math.floor(hexes.length * coverageTarget);
  let covered = 0;
  
  for (const idx of indices) {
    if (assigned.has(idx)) continue;
    if (covered >= maxToCover) break; // Stop if we've covered enough
    
    // Decide tile size: 60% single, 30% double, 10% triple
    const roll = Math.random();
    let targetSize = 1;
    if (roll > 0.9) targetSize = 3;
    else if (roll > 0.6) targetSize = 2;
    
    // Find adjacent unassigned hexes
    const tileHexes = [hexes[idx]];
    const tileIndices = [idx];
    assigned.add(idx);
    covered++;
    
    if (targetSize > 1) {
      for (let i = 0; i < hexes.length && tileHexes.length < targetSize; i++) {
        if (assigned.has(i)) continue;
        if (covered >= maxToCover) break;
        
        // Check if adjacent to any hex in current tile
        const isAdjacent = tileHexes.some(th => 
          hexDistance(th, hexes[i]) < HEX_SIZE * 1.8
        );
        
        if (isAdjacent) {
          tileHexes.push(hexes[i]);
          tileIndices.push(i);
          assigned.add(i);
          covered++;
        }
      }
    }
    
    // Compute merged boundary
    const { path, externalEdges, orderedPoints } = computeMergedBoundary(tileHexes);
    
    // Collect syllables from all hexes in tile (each hex now has array of syllables)
    const syllables = tileHexes.map(h => h.syllables || []);
    
    // Find icon position (centroid of tile)
    const iconPos = findIconPosition(tileHexes);
    
    tiles.push({
      hexes: tileHexes,
      hexIndices: tileIndices,
      path,
      externalEdges,
      orderedPoints,
      iconPos,
      syllables,
      size: tileHexes.length
    });
  }
  
  return tiles;
}

// Grow connected hexes from a random seed, up to maxCount
function growHexCluster(hexagons, hexSize, maxCount) {
  if (hexagons.length === 0 || maxCount === 0) return [];
  
  // Pick a random starting hex
  const seedIdx = Math.floor(Math.random() * hexagons.length);
  const cluster = [hexagons[seedIdx]];
  const visited = new Set([seedIdx]);
  const frontier = [seedIdx];
  
  while (cluster.length < maxCount && frontier.length > 0) {
    const currentIdx = frontier.shift();
    
    // Find adjacent unvisited hexes
    for (let j = 0; j < hexagons.length; j++) {
      if (visited.has(j)) continue;
      if (areHexesAdjacent(hexagons[currentIdx], hexagons[j], hexSize)) {
        visited.add(j);
        cluster.push(hexagons[j]);
        frontier.push(j);
        
        if (cluster.length >= maxCount) break;
      }
    }
  }
  
  return cluster;
}

function getValidHexagons(hexagons, solidCells, hexSize, maxCount) {
  const cellSet = new Set(solidCells.map(c => `${c.x},${c.y}`));
  const validHexes = hexagons.filter(hex => isHexInSolidRegion(hex, solidCells, cellSet));
  const cluster = growHexCluster(validHexes, hexSize, maxCount);
  return { validHexes, cluster };
}

// Test how many hexes fit with a given tiling configuration
function testHexPlacement(cells, width, height, tilingOffset, hexRotation, maxHexSlots) {
  const cellSet = new Set(cells.map(c => `${c.x},${c.y}`));
  const allHexagons = generateHexGrid(
    width * CELL_SIZE,
    height * CELL_SIZE,
    HEX_SIZE,
    tilingOffset.x,
    tilingOffset.y,
    hexRotation
  );
  const validHexes = allHexagons.filter(hex => isHexInSolidRegion(hex, cells, cellSet));
  const cluster = growHexCluster(validHexes, HEX_SIZE, maxHexSlots);
  return cluster.length;
}

// Find the best tiling offset/rotation for small items
function findBestTilingConfig(cells, width, height, maxHexSlots, attempts = 10) {
  let bestConfig = { 
    tilingOffset: { x: Math.random() * 40, y: Math.random() * 40 },
    hexRotation: (Math.random() - 0.5) * HEX_ROTATION_RANGE
  };
  let bestCount = testHexPlacement(cells, width, height, bestConfig.tilingOffset, bestConfig.hexRotation, maxHexSlots);
  
  for (let i = 1; i < attempts; i++) {
    const config = {
      tilingOffset: { x: Math.random() * 40, y: Math.random() * 40 },
      hexRotation: (Math.random() - 0.5) * HEX_ROTATION_RANGE
    };
    const count = testHexPlacement(cells, width, height, config.tilingOffset, config.hexRotation, maxHexSlots);
    
    if (count > bestCount) {
      bestCount = count;
      bestConfig = config;
    }
    
    // If we hit the target, stop early
    if (bestCount >= maxHexSlots) break;
  }
  
  return bestConfig;
}

function hexToPath(points) {
  return `M ${points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')} Z`;
}

// Create a smaller hexagon at the same center
function createInnerHexagon(cx, cy, size, rotationDeg = 0, scale = 0.45) {
  return createHexagon(cx, cy, size * scale, rotationDeg);
}

// Get adjacent cell keys for a given cell key
function getAdjacentCells(cellKey, validCells) {
  const [x, y] = cellKey.split(',').map(Number);
  const adjacent = [];
  const deltas = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [dx, dy] of deltas) {
    const neighborKey = `${x + dx},${y + dy}`;
    if (validCells.has(neighborKey)) {
      adjacent.push(neighborKey);
    }
  }
  return adjacent;
}

// Grow connected regions from seed cells
function growConnectedRegions(hollowCellSet, numRegions, colors) {
  const hollowCellArray = Array.from(hollowCellSet);
  if (hollowCellArray.length === 0) return new Map();
  
  const cellColors = new Map();
  const unassigned = new Set(hollowCellArray);
  
  // Pick random seed cells for each region
  const shuffledCells = [...hollowCellArray].sort(() => Math.random() - 0.5);
  const seeds = shuffledCells.slice(0, Math.min(numRegions, shuffledCells.length));
  
  // Initialize frontiers for each region
  const frontiers = seeds.map((seed, i) => {
    unassigned.delete(seed);
    cellColors.set(seed, colors[i % colors.length]);
    return [seed];
  });
  
  // Grow regions simultaneously until all cells assigned
  while (unassigned.size > 0) {
    let anyGrew = false;
    
    for (let i = 0; i < frontiers.length; i++) {
      if (frontiers[i].length === 0) continue;
      
      const newFrontier = [];
      for (const cellKey of frontiers[i]) {
        const neighbors = getAdjacentCells(cellKey, hollowCellSet);
        for (const neighbor of neighbors) {
          if (unassigned.has(neighbor)) {
            unassigned.delete(neighbor);
            cellColors.set(neighbor, colors[i % colors.length]);
            newFrontier.push(neighbor);
            anyGrew = true;
          }
        }
      }
      frontiers[i] = newFrontier;
    }
    
    // If no region can grow (disconnected cells), assign remaining randomly
    if (!anyGrew && unassigned.size > 0) {
      const remaining = Array.from(unassigned);
      for (const cellKey of remaining) {
        unassigned.delete(cellKey);
        cellColors.set(cellKey, colors[Math.floor(Math.random() * colors.length)]);
      }
    }
  }
  
  return cellColors;
}

// Generate container modifiers - which cells have which colors (connected regions)
// Color complexity tied to solid/hollow ratio: more hexes + smaller hollow = fancier
function generateContainerModifiers(activeGroups, hollowCells, solidCount = 2, hollowCount = 4) {
  const shuffled = [...activeGroups].sort(() => Math.random() - 0.5);
  const hollowCellSet = new Set(hollowCells);
  
  // Fanciness score: higher = more color complexity allowed
  // solidCount contributes positively, hollowCount negatively
  // Range roughly: 0.25 (1 solid, 4 hollow) to 2.0 (4 solid, 2 hollow)
  const fanciness = solidCount / Math.max(hollowCount, 1);
  
  // Adjust probabilities based on fanciness:
  // Low fanciness (<0.5): mostly neutral/uniform, no multicolor
  // Medium fanciness (0.5-1.0): standard distribution
  // High fanciness (>1.0): more patchy/multicolor possible
  
  let probNeutral, probPatchy, probUniform, probMulti;
  
  if (fanciness < 0.4) {
    // Very low: big hollow, tiny solid frame - mostly neutral
    probNeutral = 0.40;
    probPatchy = 0.10;
    probUniform = 0.50;
    probMulti = 0.00;
  } else if (fanciness < 0.7) {
    // Low: lean toward simple
    probNeutral = 0.25;
    probPatchy = 0.15;
    probUniform = 0.58;
    probMulti = 0.02;
  } else if (fanciness < 1.0) {
    // Medium: standard distribution
    probNeutral = 0.12;
    probPatchy = 0.20;
    probUniform = 0.60;
    probMulti = 0.08;
  } else if (fanciness < 1.5) {
    // High: can get fancy
    probNeutral = 0.05;
    probPatchy = 0.25;
    probUniform = 0.55;
    probMulti = 0.15;
  } else {
    // Very high: small hollow, lots of solid - very fancy allowed
    probNeutral = 0.02;
    probPatchy = 0.28;
    probUniform = 0.45;
    probMulti = 0.25;
  }
  
  const roll = Math.random();
  let hollowCellColors = new Map();
  
  if (roll < probNeutral) {
    // All neutral - no colors
  } else if (roll < probNeutral + probPatchy) {
    // Patchy: one colored region, one neutral region
    const color = shuffled[0];
    const regionColors = [color, null];
    hollowCellColors = growConnectedRegions(hollowCellSet, 2, regionColors);
    // Remove null entries (neutral cells)
    for (const [key, value] of hollowCellColors) {
      if (value === null) hollowCellColors.delete(key);
    }
  } else if (roll < probNeutral + probPatchy + probUniform) {
    // All cells same color
    const color = shuffled[0];
    for (const cellKey of hollowCells) {
      hollowCellColors.set(cellKey, color);
    }
  } else {
    // Multiple colors! - 2-3 connected regions
    const numColors = Math.min(2 + Math.floor(Math.random() * 2), shuffled.length);
    const colors = shuffled.slice(0, numColors);
    hollowCellColors = growConnectedRegions(hollowCellSet, numColors, colors);
  }
  
  // Keep stabilizes for backwards compat (first color or empty)
  const uniqueColors = [...new Set(hollowCellColors.values())].filter(c => c !== null);
  const stabilizes = uniqueColors.length > 0 ? [uniqueColors[0]] : [];
  
  return { stabilizes, hollowCellColors };
}
function SyllableReference() {
  return (
    <div className="mb-8 p-4 bg-white rounded-lg shadow-sm border border-stone-200">
      <h2 className="text-lg font-bold text-stone-800 mb-4">Arcane Reference</h2>
      
      {/* Flow Groups */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-stone-600 mb-2">Flow Groups</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(FLOW_GROUPS).map(([name, { color }]) => (
            <div key={name} className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 rounded-full">
              <div 
                className="w-4 h-4 rounded-full border-2"
                style={{ backgroundColor: color, borderColor: color }}
              />
              <span className="text-sm font-medium text-stone-700 capitalize">{name}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Syllables */}
      <div>
        <h3 className="text-sm font-semibold text-stone-600 mb-3">Syllables & Representations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {ARCANE_SYLLABLES.map(syllable => (
            <div key={syllable.name} className="p-3 bg-stone-50 rounded-lg border border-stone-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl" style={{ color: '#4a4540' }}>{syllable.symbol}</span>
                <span className="font-semibold text-stone-800">{syllable.name}</span>
              </div>
              <div className="space-y-1">
                {syllable.representations.map((rep, idx) => (
                  <div key={idx} className="flex items-center gap-1 flex-wrap">
                    {rep.map((groupName, gIdx) => (
                      <span 
                        key={gIdx}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: FLOW_GROUPS[groupName]?.color || '#888' }}
                      >
                        {groupName}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Generate a puzzle from an item - extract tiles as puzzle pieces
function generatePuzzle() {
  // Pick a random item from catalog (puzzles use 1-4 solid cells)
  let catalogItem = pickRandomItem({ minCells: 1, maxCells: 4 });
  
  // Fallback if no item found (shouldn't happen, but safety first)
  if (!catalogItem) {
    catalogItem = {
      name: "Unknown",
      isContainer: false,
      cells: [{x:0, y:0}, {x:1, y:0}],
      hollowCells: null,
      groups: ['stone', 'ember']
    };
  }
  
  // Use catalog item's cells and groups
  const cells = catalogItem.cells;  // Solid cells for hex placement
  const hollowCells = catalogItem.hollowCells || [];  // Hollow cells for containers
  const activeGroups = catalogItem.groups;
  const itemName = catalogItem.name;
  const isContainer = catalogItem.isContainer;
  
  // Combine solid and hollow cells for dimensions
  const allCells = [...cells, ...hollowCells];
  const width = Math.max(...allCells.map(c => c.x)) + 1;
  const height = Math.max(...allCells.map(c => c.y)) + 1;
  
  // Generate hollow cell colors for containers
  let hollowCellColors = new Map();
  if (isContainer && hollowCells.length > 0) {
    const hollowSet = new Set(hollowCells.map(c => `${c.x},${c.y}`));
    const result = generateContainerModifiers(activeGroups, hollowSet, cells.length, hollowCells.length);
    hollowCellColors = result.hollowCellColors;
  }
  
  // Get valid syllables for these groups
  const activeGroupSet = new Set(activeGroups);
  let validSyllables = ARCANE_SYLLABLES.map(syllable => {
    const validReps = syllable.representations.filter(rep =>
      rep.every(groupName => activeGroupSet.has(groupName))
    );
    if (validReps.length === 0) return null;
    return { ...syllable, validRepresentations: validReps };
  }).filter(Boolean);
  
  // Fallback if no valid syllables (use all with single-group reps)
  if (validSyllables.length === 0) {
    validSyllables = ARCANE_SYLLABLES.map(s => ({
      ...s,
      validRepresentations: s.representations.filter(r => r.length === 1)
    })).filter(s => s.validRepresentations.length > 0);
  }
  
  // Generate hex grid (only for solid cells)
  const solidCount = cells.length;
  const estimatedCapacity = solidCount * 5;
  const maxHexSlots = Math.max(3, Math.round(estimatedCapacity * 0.85));
  
  // Find best tiling config
  const bestConfig = findBestTilingConfig(cells, width, height, maxHexSlots, 15);
  const { tilingOffset, hexRotation } = bestConfig;
  
  const allHexagons = generateHexGrid(
    width * CELL_SIZE,
    height * CELL_SIZE,
    HEX_SIZE,
    tilingOffset.x,
    tilingOffset.y,
    hexRotation
  );
  
  const cellSet = new Set(cells.map(c => `${c.x},${c.y}`));
  const validHexes = allHexagons.filter(hex => isHexInSolidRegion(hex, cells, cellSet));
  const hexSlots = growHexCluster(validHexes, HEX_SIZE, maxHexSlots);
  
  // Find external edges FIRST (needed for cutout port constraints)
  const externalEdges = findExternalEdges(hexSlots, HEX_SIZE, hexRotation);
  
  // Generate ports on some external edges (roughly 40-55% of external edges)
  const numPorts = Math.max(3, Math.floor(externalEdges.length * (0.40 + Math.random() * 0.15)));
  const shuffledExternalEdges = [...externalEdges].sort(() => Math.random() - 0.5);
  const ports = shuffledExternalEdges.slice(0, numPorts);
  
  // Create a set for quick port lookup: "hexIdx-edge"
  const portSet = new Set(ports.map(p => `${p.hexIdx}-${p.edge}`));
  
  // Build neighbor info for each hex
  const rotRad = (hexRotation * Math.PI) / 180;
  const hexNeighborInfo = hexSlots.map((hex, idx) => {
    const neighborEdges = [];
    const externalEdgesForHex = [];
    
    for (let e = 0; e < 6; e++) {
      const edgeAngle = (Math.PI / 3) * e + Math.PI / 6 + rotRad;
      const neighborDist = HEX_SIZE * Math.sqrt(3);
      const neighborX = hex.center.x + neighborDist * Math.cos(edgeAngle);
      const neighborY = hex.center.y + neighborDist * Math.sin(edgeAngle);
      
      let hasNeighbor = false;
      for (const other of hexSlots) {
        if (other === hex) continue;
        const dx = other.center.x - neighborX;
        const dy = other.center.y - neighborY;
        if (Math.sqrt(dx * dx + dy * dy) < HEX_SIZE * 0.5) {
          hasNeighbor = true;
          neighborEdges.push(e);
          break;
        }
      }
      
      if (!hasNeighbor) {
        externalEdgesForHex.push(e);
      }
    }
    
    return { idx, neighborEdges, externalEdges: externalEdgesForHex };
  });
  
  // Decide cutouts: allow on any hex with at least one neighbor, starting at 2 hexes
  const cutoutSlots = [];
  if (hexSlots.length >= 2) {
    // 60% chance of having cutouts
    if (Math.random() < 0.6) {
      // Find candidate hexes (need at least 1 neighbor to have a flow line destination)
      const candidateIndices = hexNeighborInfo
        .filter(info => info.neighborEdges.length >= 1)
        .map(info => info.idx);
      
      if (candidateIndices.length > 0) {
        // Usually 1 cutout, rarely 2
        const numCutouts = Math.random() < 0.85 ? 1 : Math.min(2, candidateIndices.length);
        const shuffled = [...candidateIndices].sort(() => Math.random() - 0.5);
        
        for (let c = 0; c < numCutouts; c++) {
          const cutoutIdx = shuffled[c];
          const hex = hexSlots[cutoutIdx];
          const info = hexNeighborInfo[cutoutIdx];
          
          // Collect valid edges for flow line endpoints:
          // - Neighbor edges (internal) are always valid
          // - External edges are only valid if they have a port
          const validEdges = [...info.neighborEdges];
          for (const extEdge of info.externalEdges) {
            if (portSet.has(`${cutoutIdx}-${extEdge}`)) {
              validEdges.push(extEdge);
            }
          }
          
          // Generate cutout flow line
          let flowLines = [];
          if (validEdges.length >= 2) {
            // Pick two edges to connect (prefer some separation)
            const e1 = validEdges[Math.floor(Math.random() * validEdges.length)];
            const remaining = validEdges.filter(e => e !== e1);
            // Prefer opposite-ish edge
            let e2 = remaining[0];
            for (const candidate of remaining) {
              const dist = Math.min(Math.abs(candidate - e1), 6 - Math.abs(candidate - e1));
              const bestDist = Math.min(Math.abs(e2 - e1), 6 - Math.abs(e2 - e1));
              if (dist > bestDist) e2 = candidate;
            }
            flowLines.push({
              group: 'cutout',
              edge1: e1,
              edge2: e2,
              color: '#888',
              isCutout: true
            });
          } else if (validEdges.length === 1) {
            // Dead-end flow line
            flowLines.push({
              group: 'cutout',
              edge1: validEdges[0],
              edge2: null,
              color: '#888',
              isCutout: true
            });
          }
          
          if (flowLines.length > 0) {
            cutoutSlots.push({
              hexIdx: cutoutIdx,
              flowLines,
              edgeColors: buildEdgeColors(flowLines)
            });
          }
        }
      }
    }
  }
  
  const cutoutIndices = new Set(cutoutSlots.map(c => c.hexIdx));
  
  // Assign flow lines to each hex slot (these define the "solution"), skip cutouts
  const itemSyllables = validSyllables || ARCANE_SYLLABLES;
  
  const solutionHexes = hexSlots.map((hex, idx) => {
    // Skip cutout hexes - they're pre-filled
    if (cutoutIndices.has(idx)) {
      return null;
    }
    
    // Use precomputed neighbor info
    const info = hexNeighborInfo[idx];
    const hexExternalEdges = info.externalEdges;
    const hexPortEdges = hexExternalEdges.filter(e => portSet.has(`${idx}-${e}`));
    
    // Roll for syllable count
    const syllableRoll = Math.random();
    let syllableCount;
    if (syllableRoll < 0.20) syllableCount = 0;
    else if (syllableRoll < 0.92) syllableCount = 1;
    else syllableCount = 2;
    
    // Skip syllables if none available
    if (itemSyllables.length === 0) syllableCount = 0;
    
    const syllables = [];
    let combinedRep = [];
    
    for (let s = 0; s < syllableCount; s++) {
      const syllable = itemSyllables[Math.floor(Math.random() * itemSyllables.length)];
      const validReps = syllable.validRepresentations || syllable.representations || [[]];
      const chosenRep = validReps[Math.floor(Math.random() * validReps.length)];
      syllables.push({ syllable, chosenRep });
      combinedRep = [...combinedRep, ...chosenRep];
    }
    
    // For empty hexes, add pass-through lines
    if (syllableCount === 0 && Math.random() < 0.85) {
      const numPassThrough = Math.random() < 0.7 ? 1 : 2;
      for (let p = 0; p < numPassThrough; p++) {
        const randomGroup = activeGroups[Math.floor(Math.random() * activeGroups.length)];
        if (!combinedRep.includes(randomGroup)) {
          combinedRep.push(randomGroup);
        }
      }
    }
    
    combinedRep = [...new Set(combinedRep)];
    
    // Generate flow lines - respecting port constraints
    const flowLines = [];
    const usedEdges = new Set();
    
    // Helper: check if an edge is valid to use
    const canUseEdge = (edge) => {
      if (usedEdges.has(edge)) return false;
      // If external and not a port, can't use it
      if (hexExternalEdges.includes(edge) && !hexPortEdges.includes(edge)) return false;
      return true;
    };
    
    // Get list of valid edges
    const getValidEdges = () => {
      const valid = [];
      for (let e = 0; e < 6; e++) {
        if (canUseEdge(e)) valid.push(e);
      }
      return valid;
    };
    
    for (const groupName of combinedRep) {
      const validEdges = getValidEdges();
      if (validEdges.length === 0) continue;
      
      const isDeadEnd = Math.random() < 0.15;
      
      if (isDeadEnd) {
        const edge1 = validEdges[Math.floor(Math.random() * validEdges.length)];
        usedEdges.add(edge1);
        flowLines.push({ group: groupName, edge1, edge2: null, color: FLOW_GROUPS[groupName].color });
      } else {
        if (validEdges.length < 2) {
          // Only one edge available, make it a dead end
          const edge1 = validEdges[0];
          usedEdges.add(edge1);
          flowLines.push({ group: groupName, edge1, edge2: null, color: FLOW_GROUPS[groupName].color });
        } else {
          // Pick two edges with some spread preference
          const edge1 = validEdges[Math.floor(Math.random() * validEdges.length)];
          const remainingEdges = validEdges.filter(e => e !== edge1);
          
          // Prefer edges with some angular separation
          let edge2;
          const preferredOffsets = [3, 2, 4, 1, 5]; // opposite first, then nearby
          for (const offset of preferredOffsets) {
            const candidate = (edge1 + offset) % 6;
            if (remainingEdges.includes(candidate)) {
              edge2 = candidate;
              break;
            }
          }
          if (edge2 === undefined) {
            edge2 = remainingEdges[0];
          }
          
          usedEdges.add(edge1);
          usedEdges.add(edge2);
          flowLines.push({ group: groupName, edge1, edge2, color: FLOW_GROUPS[groupName].color });
        }
      }
    }
    
    return {
      ...hex,
      slotIndex: idx,
      syllables,
      flowLines,
      externalEdges: hexExternalEdges,
      portEdges: hexPortEdges,
      edgeColors: buildEdgeColors(flowLines)
    };
  }).filter(h => h !== null);  // Remove cutout slots
  
  // Create random puzzle tiles (like drawing from a bag)
  // Generate more tiles than placeable slots for push-your-luck drawing
  const placeableSlotCount = hexSlots.length - cutoutSlots.length;
  const numTiles = placeableSlotCount + 3; // Extra tiles in the bag
  const tiles = [];
  
  for (let idx = 0; idx < numTiles; idx++) {
    // Roll for syllable count (same distribution as before)
    const syllableRoll = Math.random();
    let syllableCount;
    if (syllableRoll < 0.20) syllableCount = 0;
    else if (syllableRoll < 0.92) syllableCount = 1;
    else syllableCount = 2;
    
    // Skip syllables if none available
    if (itemSyllables.length === 0) syllableCount = 0;
    
    const syllables = [];
    let combinedRep = [];
    
    for (let s = 0; s < syllableCount; s++) {
      const syllable = itemSyllables[Math.floor(Math.random() * itemSyllables.length)];
      const validReps = syllable.validRepresentations || syllable.representations || [[]];
      const chosenRep = validReps[Math.floor(Math.random() * validReps.length)];
      syllables.push({ syllable, chosenRep });
      combinedRep = [...combinedRep, ...chosenRep];
    }
    
    // For empty hexes, add pass-through lines
    if (syllableCount === 0 && Math.random() < 0.85) {
      const numPassThrough = Math.random() < 0.7 ? 1 : 2;
      for (let p = 0; p < numPassThrough; p++) {
        const randomGroup = activeGroups[Math.floor(Math.random() * activeGroups.length)];
        if (!combinedRep.includes(randomGroup)) {
          combinedRep.push(randomGroup);
        }
      }
    }
    
    combinedRep = [...new Set(combinedRep)];
    
    // Generate flow lines randomly (no port constraints - tiles don't know where they'll go)
    const flowLines = [];
    const usedEdges = new Set();
    let hasMultiWayJunction = false;  // Track if we have a 3+ way junction
    
    for (const groupName of combinedRep) {
      // If we already have a 3-way or 4-way, don't add more colors - too brutal
      if (hasMultiWayJunction) break;
      
      // Roll for flow line type: dead-end, 2-way, 3-way junction, 4-way junction
      const typeRoll = Math.random();
      let flowType;
      if (typeRoll < 0.12) flowType = 'dead-end';
      else if (typeRoll < 0.94) flowType = '2-way';
      else if (typeRoll < 0.98) flowType = '3-way';  // ~4% - rare
      else flowType = '4-way';                        // ~2% - very rare
      
      // Get available edges
      const availableEdges = [];
      for (let e = 0; e < 6; e++) {
        if (!usedEdges.has(e)) availableEdges.push(e);
      }
      
      if (flowType === 'dead-end' && availableEdges.length >= 1) {
        const edge1 = availableEdges[Math.floor(Math.random() * availableEdges.length)];
        usedEdges.add(edge1);
        flowLines.push({ group: groupName, edge1, edge2: null, color: FLOW_GROUPS[groupName].color });
        
      } else if (flowType === '2-way' && availableEdges.length >= 2) {
        // Pick two edges with random spread
        const edge1 = availableEdges[Math.floor(Math.random() * availableEdges.length)];
        const remaining = availableEdges.filter(e => e !== edge1);
        
        // Random offset for variety (1=sharp bend, 2=medium, 3=straight, 4=medium, 5=sharp)
        const offsetRoll = Math.random();
        let preferredOffset;
        if (offsetRoll < 0.15) preferredOffset = 1;       // sharp bend
        else if (offsetRoll < 0.35) preferredOffset = 2;  // medium bend
        else if (offsetRoll < 0.65) preferredOffset = 3;  // straight across
        else if (offsetRoll < 0.85) preferredOffset = 4;  // medium bend
        else preferredOffset = 5;                          // sharp bend
        
        let edge2;
        const candidate = (edge1 + preferredOffset) % 6;
        if (remaining.includes(candidate)) {
          edge2 = candidate;
        } else {
          // Fallback to any available
          edge2 = remaining[Math.floor(Math.random() * remaining.length)];
        }
        
        usedEdges.add(edge1);
        usedEdges.add(edge2);
        flowLines.push({ group: groupName, edge1, edge2, color: FLOW_GROUPS[groupName].color });
        
      } else if (flowType === '3-way' && availableEdges.length >= 3) {
        // Pick 3 edges - try for even spacing
        const shuffled = [...availableEdges].sort(() => Math.random() - 0.5);
        const edges = shuffled.slice(0, 3).sort((a, b) => a - b);
        edges.forEach(e => usedEdges.add(e));
        flowLines.push({ group: groupName, edges, color: FLOW_GROUPS[groupName].color, isJunction: true });
        hasMultiWayJunction = true;
        
      } else if (flowType === '4-way' && availableEdges.length >= 4) {
        // Pick 4 edges
        const shuffled = [...availableEdges].sort(() => Math.random() - 0.5);
        const edges = shuffled.slice(0, 4).sort((a, b) => a - b);
        edges.forEach(e => usedEdges.add(e));
        flowLines.push({ group: groupName, edges, color: FLOW_GROUPS[groupName].color, isJunction: true });
        hasMultiWayJunction = true;
        
      } else if (availableEdges.length >= 2) {
        // Fallback to 2-way if not enough edges
        const edge1 = availableEdges[0];
        const edge2 = availableEdges[1];
        usedEdges.add(edge1);
        usedEdges.add(edge2);
        flowLines.push({ group: groupName, edge1, edge2, color: FLOW_GROUPS[groupName].color });
        
      } else if (availableEdges.length >= 1) {
        // Fallback to dead-end
        const edge1 = availableEdges[0];
        usedEdges.add(edge1);
        flowLines.push({ group: groupName, edge1, edge2: null, color: FLOW_GROUPS[groupName].color });
      }
    }
    
    tiles.push({
      id: `tile-${idx}`,
      hex: {
        syllables,
        flowLines,
        edgeColors: buildEdgeColors(flowLines)
      },
      isPlaced: false,
      placedAtSlot: null
    });
  }
  
  // Shuffle tile rotations randomly for initial state
  const initialRotations = {};
  tiles.forEach(tile => {
    initialRotations[tile.id] = Math.floor(Math.random() * 6);
  });
  
  // Mark cutout info and external edges on hexSlots for rendering and validation
  hexSlots.forEach((slot, idx) => {
    const cutout = cutoutSlots.find(c => c.hexIdx === idx);
    if (cutout) {
      slot.isCutout = true;
      slot.cutoutFlowLines = cutout.flowLines;
      slot.cutoutEdgeColors = cutout.edgeColors;
    }
    // Add external edges info for validation
    slot.externalEdges = hexNeighborInfo[idx].externalEdges;
  });
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    itemName,
    isContainer,
    cells,
    hollowCells,
    hollowCellColors,
    width,
    height,
    hexSlots,  // All slots including cutouts
    placeableSlots: solutionHexes,  // Only placeable slots (for tile count etc)
    cutoutSlots,  // Cutout slot info
    hexRotation,
    tilingOffset,
    tiles,
    activeGroups,
    ports,
    initialRotations
  };
}

// Find all external edges (edges of hexes that don't have a neighbor)
function findExternalEdges(hexSlots, hexSize, hexRotation) {
  const externalEdges = [];
  const rotRad = (hexRotation * Math.PI) / 180;
  
  for (let i = 0; i < hexSlots.length; i++) {
    const hex = hexSlots[i];
    
    for (let edge = 0; edge < 6; edge++) {
      // Calculate direction to neighbor for this edge
      const edgeAngle = (Math.PI / 3) * edge + rotRad + Math.PI / 6;
      const neighborDist = hexSize * Math.sqrt(3);
      const expectedNeighborX = hex.center.x + neighborDist * Math.cos(edgeAngle);
      const expectedNeighborY = hex.center.y + neighborDist * Math.sin(edgeAngle);
      
      // Check if there's a hex at this position
      const hasNeighbor = hexSlots.some((other, j) => {
        if (i === j) return false;
        const dist = Math.sqrt(
          Math.pow(other.center.x - expectedNeighborX, 2) +
          Math.pow(other.center.y - expectedNeighborY, 2)
        );
        return dist < hexSize * 0.5;
      });
      
      if (!hasNeighbor) {
        externalEdges.push({ hexIdx: i, edge, hex });
      }
    }
  }
  
  return externalEdges;
}

// Build a map of edge -> color for a hex's flow lines
function buildEdgeColors(flowLines) {
  const edgeColors = {};
  for (const flow of flowLines) {
    if (flow.isJunction && flow.edges) {
      // Multi-way junction
      for (const edge of flow.edges) {
        edgeColors[edge] = flow.group;
      }
    } else {
      // Standard 2-way or dead-end
      if (flow.edge1 !== undefined && flow.edge1 !== null) {
        edgeColors[flow.edge1] = flow.group;
      }
      if (flow.edge2 !== undefined && flow.edge2 !== null) {
        edgeColors[flow.edge2] = flow.group;
      }
    }
  }
  return edgeColors;
}

// Check if two hexes have compatible edges (for adjacency)
function getOppositeEdge(edge) {
  return (edge + 3) % 6;
}

// Find which edge of hex A faces hex B (if adjacent)
function findFacingEdgeBetweenHexes(hexA, hexB, hexRotation) {
  const dx = hexB.center.x - hexA.center.x;
  const dy = hexB.center.y - hexA.center.y;
  const angle = Math.atan2(dy, dx);
  const rotRad = (hexRotation * Math.PI) / 180;
  const adjustedAngle = angle - rotRad + Math.PI / 6;
  const normalized = ((adjustedAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.floor(normalized / (Math.PI / 3)) % 6;
}

// Check if edges match between two adjacent hexes
function edgesMatch(hexA, hexB, hexRotation) {
  const edgeA = findFacingEdgeBetweenHexes(hexA, hexB, hexRotation);
  const edgeB = getOppositeEdge(edgeA);
  
  const colorA = hexA.edgeColors?.[edgeA];
  const colorB = hexB.edgeColors?.[edgeB];
  
  // Rules:
  // - Empty ↔ Empty = OK
  // - Color ↔ Color (same or different) = OK (different = volatility)
  // - Color ↔ Empty = INVALID (flow line going nowhere)
  if (!colorA && !colorB) return true;  // Both empty = OK
  if (colorA && colorB) return true;    // Both have color = OK (even if different)
  return false;                          // One empty, one not = INVALID
}

// Check if a hex at a slot is compatible with all neighbors (including cutouts)
function checkSlotCompatibility(slotIndex, hex, allSlots, placedTiles, hexRotation, allSlotEdgeColors = {}) {
  const slot = allSlots[slotIndex];
  
  for (let i = 0; i < allSlots.length; i++) {
    if (i === slotIndex) continue;
    
    const otherSlot = allSlots[i];
    const dist = Math.sqrt(
      Math.pow(slot.center.x - otherSlot.center.x, 2) +
      Math.pow(slot.center.y - otherSlot.center.y, 2)
    );
    
    // Check if adjacent (within ~1.8 hex sizes)
    if (dist < HEX_SIZE * 1.8) {
      // Get edge colors from placed tile or cutout
      let otherEdgeColors = null;
      if (otherSlot.isCutout) {
        otherEdgeColors = otherSlot.cutoutEdgeColors || {};
      } else {
        const placedTile = placedTiles[i];
        if (placedTile) {
          otherEdgeColors = placedTile.hex.edgeColors;
        }
      }
      
      if (otherEdgeColors) {
        // Check edge compatibility
        const placedHex = { ...otherSlot, edgeColors: otherEdgeColors };
        const currentHex = { ...slot, edgeColors: hex.edgeColors };
        
        if (!edgesMatch(currentHex, placedHex, hexRotation)) {
          return false;
        }
      }
    }
  }
  return true;
}

// Puzzle Mode Component
function PuzzleMode() {
  // Initialize puzzle and rotations together
  const [puzzleState, setPuzzleState] = useState(() => {
    try {
      const p = generatePuzzle();
      return { puzzle: p, rotations: p.initialRotations || {}, error: null };
    } catch (e) {
      console.error('Puzzle generation failed:', e);
      return { puzzle: null, rotations: {}, error: e.message };
    }
  });
  const puzzle = puzzleState.puzzle;
  
  // If puzzle failed to generate, show error
  if (!puzzle) {
    return (
      <div className="p-6 min-h-screen bg-stone-100">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Puzzle Generation Error</h1>
        <p className="text-stone-600 mb-4">{puzzleState.error || 'Unknown error'}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-stone-500 text-white rounded hover:bg-stone-600"
        >
          Reload
        </button>
      </div>
    );
  }
  
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [placedTiles, setPlacedTiles] = useState({}); // tileId -> { tile, placedAtSlot }
  const [tileRotations, setTileRotations] = useState(puzzleState.rotations);
  const [showReference, setShowReference] = useState(false);
  
  // Drawing mechanic state
  const [drawnTileIds, setDrawnTileIds] = useState([]); // tiles drawn from deck (must use all)
  const [closedOut, setClosedOut] = useState(false); // stopped drawing
  
  // Derived state
  const deckTiles = puzzle.tiles.filter(t => !drawnTileIds.includes(t.id));
  const handTiles = puzzle.tiles.filter(t => drawnTileIds.includes(t.id) && !placedTiles[t.id]);
  const placedTilesList = Object.values(placedTiles);
  const selectedTile = puzzle.tiles.find(t => t.id === selectedTileId);
  
  // Count only placeable slots (exclude cutouts)
  const placeableSlotCount = puzzle.hexSlots.filter(s => !s.isCutout).length;
  const allSlotsPlaced = placedTilesList.length === placeableSlotCount;
  const allDrawnUsed = handTiles.length === 0;
  
  // Rotate edge colors by rotation steps (each step = 60°)
  const getRotatedEdgeColors = (edgeColors, rotation) => {
    if (!rotation || rotation === 0) return edgeColors;
    const rotated = {};
    for (const [edge, color] of Object.entries(edgeColors)) {
      const newEdge = (parseInt(edge) + rotation) % 6;
      rotated[newEdge] = color;
    }
    return rotated;
  };
  
  // Rotate flow lines by rotation steps
  const getRotatedFlowLines = (flowLines, rotation) => {
    if (!rotation || rotation === 0) return flowLines;
    return flowLines.map(flow => {
      if (flow.isJunction && flow.edges) {
        // Multi-way junction
        return {
          ...flow,
          edges: flow.edges.map(e => (e + rotation) % 6)
        };
      } else {
        // Standard 2-way or dead-end
        return {
          ...flow,
          edge1: (flow.edge1 + rotation) % 6,
          edge2: flow.edge2 !== null ? (flow.edge2 + rotation) % 6 : null
        };
      }
    });
  };
  
  // Check if all connections are valid
  const allValid = useMemo(() => {
    if (!allSlotsPlaced) return false;
    if (!allDrawnUsed) return false; // Must use all drawn tiles
    
    // Build port set for quick lookup
    const portSet = new Set(puzzle.ports.map(p => `${p.hexIdx}-${p.edge}`));
    
    // Build a map of all edge colors including cutouts
    const allSlotEdgeColors = {};
    for (let i = 0; i < puzzle.hexSlots.length; i++) {
      const slot = puzzle.hexSlots[i];
      if (slot.isCutout) {
        allSlotEdgeColors[i] = slot.cutoutEdgeColors || {};
      } else {
        const tile = Object.values(placedTiles).find(t => t.placedAtSlot === i);
        if (tile) {
          const rotation = tileRotations[tile.id] || 0;
          allSlotEdgeColors[i] = getRotatedEdgeColors(tile.hex.edgeColors, rotation);
        }
      }
    }
    
    for (let i = 0; i < puzzle.hexSlots.length; i++) {
      const slot = puzzle.hexSlots[i];
      
      // Skip cutout slots - they're pre-filled
      if (slot.isCutout) continue;
      
      const tile = Object.values(placedTiles).find(t => t.placedAtSlot === i);
      if (!tile) return false;
      
      const rotation = tileRotations[tile.id] || 0;
      const rotatedEdgeColors = getRotatedEdgeColors(tile.hex.edgeColors, rotation);
      
      // Check port constraints: flow lines at external edges must hit ports
      for (const [edgeStr, group] of Object.entries(rotatedEdgeColors)) {
        const edge = parseInt(edgeStr);
        const isExternal = slot.externalEdges?.includes(edge);
        if (isExternal) {
          const hasPort = portSet.has(`${i}-${edge}`);
          if (!hasPort) {
            return false; // Flow line pointing at external non-port edge = leak!
          }
        }
      }
      
      // Check neighbor compatibility (including cutouts)
      if (!checkSlotCompatibility(i, { ...tile.hex, edgeColors: rotatedEdgeColors }, puzzle.hexSlots, 
        Object.fromEntries(Object.entries(placedTiles).map(([id, t]) => {
          const rot = tileRotations[t.id] || 0;
          return [t.placedAtSlot, { ...t, hex: { ...t.hex, edgeColors: getRotatedEdgeColors(t.hex.edgeColors, rot) } }];
        })),
        puzzle.hexRotation,
        allSlotEdgeColors)) {
        return false;
      }
    }
    return true;
  }, [placedTiles, allSlotsPlaced, allDrawnUsed, puzzle, tileRotations]);
  
  const handleSlotClick = (slotIndex) => {
    const slot = puzzle.hexSlots[slotIndex];
    
    // Can't place on cutout slots
    if (slot.isCutout) return;
    
    const existingTile = Object.values(placedTiles).find(t => t.placedAtSlot === slotIndex);
    
    if (existingTile) {
      // Remove tile from slot (back to hand)
      setPlacedTiles(prev => {
        const next = { ...prev };
        delete next[existingTile.id];
        return next;
      });
      setSelectedTileId(existingTile.id);
    } else if (selectedTile && drawnTileIds.includes(selectedTile.id)) {
      // Place selected tile (must be from hand)
      setPlacedTiles(prev => ({
        ...prev,
        [selectedTile.id]: { ...selectedTile, placedAtSlot: slotIndex }
      }));
      setSelectedTileId(null);
    }
  };
  
  const handleTileClick = (tileId) => {
    // Only interact with tiles in hand (drawn but not placed)
    if (!drawnTileIds.includes(tileId)) return;
    
    if (placedTiles[tileId]) {
      // Tile is placed, remove it back to hand
      setPlacedTiles(prev => {
        const next = { ...prev };
        delete next[tileId];
        return next;
      });
      setSelectedTileId(tileId);
    } else if (selectedTileId === tileId) {
      // Already selected - rotate it!
      setTileRotations(prev => ({
        ...prev,
        [tileId]: ((prev[tileId] || 0) + 1) % 6
      }));
    } else {
      // Select from hand
      setSelectedTileId(tileId);
    }
  };
  
  const drawTile = () => {
    if (deckTiles.length === 0 || closedOut) return;
    const randomIndex = Math.floor(Math.random() * deckTiles.length);
    const drawnTile = deckTiles[randomIndex];
    setDrawnTileIds(prev => [...prev, drawnTile.id]);
  };
  
  const closeOut = () => {
    setClosedOut(true);
  };
  
  const newPuzzle = () => {
    try {
      const newP = generatePuzzle();
      setPuzzleState({ puzzle: newP, rotations: newP.initialRotations || {}, error: null });
      setPlacedTiles({});
      setTileRotations(newP.initialRotations || {});
      setSelectedTileId(null);
      setDrawnTileIds([]);
      setClosedOut(false);
    } catch (e) {
      console.error('Puzzle generation failed:', e);
      setPuzzleState({ puzzle: null, rotations: {}, error: e.message });
    }
  };
  
  const arcaneHue = 45;
  
  // Calculate status
  const slotsRemaining = placeableSlotCount - placedTilesList.length;
  const canStillWin = handTiles.length <= slotsRemaining && (handTiles.length + deckTiles.length) >= slotsRemaining;
  
  return (
    <div className="p-6 min-h-screen bg-stone-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 mb-2">
          🧩 Puzzle Mode
        </h1>
        <p className="text-stone-600 text-sm mb-4">
          Draw tiles from the bag, place them all. Flow lines must connect (or exit through ports)!
        </p>
        
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={newPuzzle}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            New Puzzle
          </button>
          <button
            onClick={() => setShowReference(r => !r)}
            className={`px-4 py-2 rounded transition-colors ${showReference ? 'bg-indigo-600 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'}`}
          >
            {showReference ? 'Hide' : 'Show'} Reference
          </button>
        </div>
        
        {/* Victory / Failure state */}
        {closedOut && allSlotsPlaced && allDrawnUsed && (
          <div className={`p-3 rounded-lg mb-4 ${allValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {allValid ? '✅ Puzzle Complete! All connections valid!' : '❌ Some connections don\'t match. Keep trying!'}
          </div>
        )}
        
        {closedOut && !allDrawnUsed && (
          <div className="p-3 rounded-lg mb-4 bg-amber-100 text-amber-800">
            ⚠️ You must place all drawn tiles! ({handTiles.length} remaining in hand)
          </div>
        )}
        
        {closedOut && allDrawnUsed && !allSlotsPlaced && (
          <div className="p-3 rounded-lg mb-4 bg-red-100 text-red-800">
            ❌ Not enough tiles to fill all slots! ({slotsRemaining} slots empty)
          </div>
        )}
        
        <div className="flex items-center gap-2 text-sm text-stone-600 mb-4">
          <span>Active groups:</span>
          {puzzle.activeGroups.map(group => (
            <span
              key={group}
              className="px-2 py-0.5 rounded text-white text-xs"
              style={{ backgroundColor: FLOW_GROUPS[group]?.color }}
            >
              {group}
            </span>
          ))}
        </div>
      </div>
      
      {showReference && <SyllableReference />}
      
      {/* Puzzle Area */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Item with slots */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200">
          <h3 className="text-sm font-semibold text-stone-600 mb-1">
            {puzzle.itemName} {puzzle.isContainer && <span className="text-purple-600">(Container - {puzzle.hollowCells?.length || 0} storage)</span>}
          </h3>
          <p className="text-xs text-stone-500 mb-3">
            {puzzle.cells.length} cells, {placeableSlotCount} slots to fill{puzzle.cutoutSlots.length > 0 ? `, ${puzzle.cutoutSlots.length} cutout${puzzle.cutoutSlots.length > 1 ? 's' : ''}` : ''}
          </p>
          <div 
            className="relative"
            style={{ 
              width: puzzle.width * CELL_SIZE,
              height: puzzle.height * CELL_SIZE
            }}
          >
            {/* Solid cell backgrounds */}
            {puzzle.cells.map((cell, i) => (
              <div
                key={`solid-${i}`}
                style={{
                  position: 'absolute',
                  left: cell.x * CELL_SIZE,
                  top: cell.y * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  backgroundColor: '#f5f2ed',
                  border: '2px solid #8b8680',
                  boxSizing: 'border-box'
                }}
              />
            ))}
            
            {/* Hollow cell backgrounds (for containers) */}
            {puzzle.hollowCells && puzzle.hollowCells.map((cell, i) => {
              const cellKey = `${cell.x},${cell.y}`;
              const cellGroup = puzzle.hollowCellColors && puzzle.hollowCellColors.get(cellKey);
              
              // Calculate colors
              let bgColor = 'hsl(45, 15%, 90%)';  // Default arcane hue
              let borderColor = 'hsl(45, 50%, 35%)';
              
              if (cellGroup && FLOW_GROUPS[cellGroup]) {
                const groupColor = FLOW_GROUPS[cellGroup].color;
                // Parse hex to rgb and lighten
                const r = parseInt(groupColor.slice(1, 3), 16);
                const g = parseInt(groupColor.slice(3, 5), 16);
                const b = parseInt(groupColor.slice(5, 7), 16);
                // Mix with white for lighter shade
                const lightR = Math.round(r * 0.3 + 255 * 0.7);
                const lightG = Math.round(g * 0.3 + 255 * 0.7);
                const lightB = Math.round(b * 0.3 + 255 * 0.7);
                bgColor = `rgb(${lightR}, ${lightG}, ${lightB})`;
                borderColor = groupColor;
              }
              
              // Check for external edges (edges that border solid cells)
              const solidSet = new Set(puzzle.cells.map(c => `${c.x},${c.y}`));
              const hollowSet = new Set(puzzle.hollowCells.map(c => `${c.x},${c.y}`));
              
              const hasTopSolid = solidSet.has(`${cell.x},${cell.y - 1}`);
              const hasBottomSolid = solidSet.has(`${cell.x},${cell.y + 1}`);
              const hasLeftSolid = solidSet.has(`${cell.x - 1},${cell.y}`);
              const hasRightSolid = solidSet.has(`${cell.x + 1},${cell.y}`);
              
              const isTopExternal = !solidSet.has(`${cell.x},${cell.y - 1}`) && !hollowSet.has(`${cell.x},${cell.y - 1}`);
              const isBottomExternal = !solidSet.has(`${cell.x},${cell.y + 1}`) && !hollowSet.has(`${cell.x},${cell.y + 1}`);
              const isLeftExternal = !solidSet.has(`${cell.x - 1},${cell.y}`) && !hollowSet.has(`${cell.x - 1},${cell.y}`);
              const isRightExternal = !solidSet.has(`${cell.x + 1},${cell.y}`) && !hollowSet.has(`${cell.x + 1},${cell.y}`);
              
              return (
                <div
                  key={`hollow-${i}`}
                  style={{
                    position: 'absolute',
                    left: cell.x * CELL_SIZE,
                    top: cell.y * CELL_SIZE,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    backgroundColor: bgColor,
                    borderTop: isTopExternal ? `4px solid ${borderColor}` : `2px solid ${borderColor}`,
                    borderBottom: isBottomExternal ? `4px solid ${borderColor}` : `2px solid ${borderColor}`,
                    borderLeft: isLeftExternal ? `4px solid ${borderColor}` : `2px solid ${borderColor}`,
                    borderRight: isRightExternal ? `4px solid ${borderColor}` : `2px solid ${borderColor}`,
                    boxSizing: 'border-box'
                  }}
                />
              );
            })}
            
            {/* SVG for hex slots */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: puzzle.width * CELL_SIZE,
                height: puzzle.height * CELL_SIZE
              }}
            >
              {/* Cutout pattern definition */}
              <defs>
                <pattern id="cutout-pattern" width="6" height="6" patternUnits="userSpaceOnUse">
                  <rect width="6" height="6" fill="#ccc" />
                  <rect width="3" height="3" fill="#999" />
                  <rect x="3" y="3" width="3" height="3" fill="#999" />
                </pattern>
              </defs>
              
              {puzzle.hexSlots.map((slot, slotIdx) => {
                const isCutout = slot.isCutout;
                const placedTile = isCutout ? null : Object.values(placedTiles).find(t => t.placedAtSlot === slotIdx);
                const isSlotSelected = selectedTile && !placedTile && !isCutout;
                const tileRotation = placedTile ? (tileRotations[placedTile.id] || 0) : 0;
                const rotatedFlowLines = placedTile ? getRotatedFlowLines(placedTile.hex.flowLines, tileRotation) : [];
                
                return (
                  <g 
                    key={slotIdx} 
                    onClick={() => handleSlotClick(slotIdx)}
                    style={{ cursor: isCutout ? 'default' : 'pointer' }}
                  >
                    {/* Slot outline */}
                    <path
                      d={hexToPath(slot.points)}
                      fill={isCutout ? 'rgba(0,0,0,0.08)' : (placedTile ? `hsl(${arcaneHue}, 25%, 88%)` : (isSlotSelected ? 'rgba(147, 51, 234, 0.1)' : 'rgba(0,0,0,0.03)'))}
                      stroke={isCutout ? '#888' : (isSlotSelected ? '#9333ea' : '#bbb')}
                      strokeWidth={isSlotSelected ? 2 : 1}
                      strokeDasharray={placedTile || isCutout ? 'none' : '4,2'}
                    />
                    
                    {/* Render cutout flow lines */}
                    {isCutout && slot.cutoutFlowLines && slot.cutoutFlowLines.map((flow, flowIdx) => {
                      const rotRad = (puzzle.hexRotation * Math.PI) / 180;
                      const getEdgePoint = (edgeIdx) => {
                        const angle1 = (Math.PI / 3) * edgeIdx + rotRad;
                        const angle2 = (Math.PI / 3) * ((edgeIdx + 1) % 6) + rotRad;
                        const c1x = slot.center.x + HEX_SIZE * Math.cos(angle1);
                        const c1y = slot.center.y + HEX_SIZE * Math.sin(angle1);
                        const c2x = slot.center.x + HEX_SIZE * Math.cos(angle2);
                        const c2y = slot.center.y + HEX_SIZE * Math.sin(angle2);
                        return { x: (c1x + c2x) / 2, y: (c1y + c2y) / 2 };
                      };
                      
                      const p1 = getEdgePoint(flow.edge1);
                      
                      if (flow.edge2 === null) {
                        return (
                          <g key={flowIdx}>
                            <line
                              x1={p1.x} y1={p1.y}
                              x2={slot.center.x} y2={slot.center.y}
                              stroke="url(#cutout-pattern)"
                              strokeWidth="6"
                              strokeLinecap="round"
                            />
                            <circle cx={slot.center.x} cy={slot.center.y} r="5" fill="url(#cutout-pattern)" />
                          </g>
                        );
                      }
                      
                      const p2 = getEdgePoint(flow.edge2);
                      return (
                        <path
                          key={flowIdx}
                          d={`M ${p1.x} ${p1.y} Q ${slot.center.x} ${slot.center.y} ${p2.x} ${p2.y}`}
                          fill="none"
                          stroke="url(#cutout-pattern)"
                          strokeWidth="6"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    
                    {/* Render placed tile */}
                    {placedTile && (
                      <g>
                        {/* Flow lines (rotated) */}
                        {rotatedFlowLines.map((flow, flowIdx) => {
                          const rotRad = (puzzle.hexRotation * Math.PI) / 180;
                          const getEdgePoint = (edgeIdx) => {
                            const angle1 = (Math.PI / 3) * edgeIdx + rotRad;
                            const angle2 = (Math.PI / 3) * ((edgeIdx + 1) % 6) + rotRad;
                            const c1x = slot.center.x + HEX_SIZE * Math.cos(angle1);
                            const c1y = slot.center.y + HEX_SIZE * Math.sin(angle1);
                            const c2x = slot.center.x + HEX_SIZE * Math.cos(angle2);
                            const c2y = slot.center.y + HEX_SIZE * Math.sin(angle2);
                            return { x: (c1x + c2x) / 2, y: (c1y + c2y) / 2 };
                          };
                          
                          // Multi-way junction
                          if (flow.isJunction && flow.edges) {
                            return (
                              <g key={flowIdx}>
                                {flow.edges.map((edge, eIdx) => {
                                  const p = getEdgePoint(edge);
                                  return (
                                    <line
                                      key={eIdx}
                                      x1={p.x} y1={p.y}
                                      x2={slot.center.x} y2={slot.center.y}
                                      stroke={flow.color}
                                      strokeWidth="6"
                                      strokeLinecap="round"
                                    />
                                  );
                                })}
                                <circle cx={slot.center.x} cy={slot.center.y} r="6" fill={flow.color} />
                              </g>
                            );
                          }
                          
                          const p1 = getEdgePoint(flow.edge1);
                          
                          // Dead end
                          if (flow.edge2 === null) {
                            return (
                              <g key={flowIdx}>
                                <line
                                  x1={p1.x} y1={p1.y}
                                  x2={slot.center.x} y2={slot.center.y}
                                  stroke={flow.color}
                                  strokeWidth="6"
                                  strokeLinecap="round"
                                />
                                <circle cx={slot.center.x} cy={slot.center.y} r="5" fill={flow.color} />
                              </g>
                            );
                          }
                          
                          // 2-way
                          const p2 = getEdgePoint(flow.edge2);
                          return (
                            <path
                              key={flowIdx}
                              d={`M ${p1.x} ${p1.y} Q ${slot.center.x} ${slot.center.y} ${p2.x} ${p2.y}`}
                              fill="none"
                              stroke={flow.color}
                              strokeWidth="6"
                              strokeLinecap="round"
                            />
                          );
                        })}
                        
                        {/* Inner hex with syllables */}
                        {placedTile.hex.syllables.length > 0 && (
                          <g>
                            <path
                              d={hexToPath(createInnerHexagon(slot.center.x, slot.center.y, HEX_SIZE, puzzle.hexRotation, 0.38))}
                              fill={`hsl(${arcaneHue}, 30%, 35%)`}
                              stroke={`hsl(${arcaneHue}, 35%, 45%)`}
                              strokeWidth="1.5"
                            />
                            {placedTile.hex.syllables.length === 1 ? (
                              <text
                                x={slot.center.x}
                                y={slot.center.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize="12"
                                fontWeight="bold"
                                fill="#e8e4de"
                              >
                                {placedTile.hex.syllables[0].syllable.symbol}
                              </text>
                            ) : (
                              <>
                                <text x={slot.center.x} y={slot.center.y - 5} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="bold" fill="#e8e4de">
                                  {placedTile.hex.syllables[0].syllable.symbol}
                                </text>
                                <text x={slot.center.x} y={slot.center.y + 5} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="bold" fill="#e8e4de">
                                  {placedTile.hex.syllables[1].syllable.symbol}
                                </text>
                              </>
                            )}
                          </g>
                        )}
                      </g>
                    )}
                    
                    {/* Slot number for empty slots */}
                    {!placedTile && (
                      <text
                        x={slot.center.x}
                        y={slot.center.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="10"
                        fill="#aaa"
                      >
                        {slotIdx + 1}
                      </text>
                    )}
                  </g>
                );
              })}
              
              {/* Render grounding ports */}
              {puzzle.ports.map((port, portIdx) => {
                const slot = puzzle.hexSlots[port.hexIdx];
                const rotRad = (puzzle.hexRotation * Math.PI) / 180;
                
                // Calculate edge midpoint
                const angle1 = (Math.PI / 3) * port.edge + rotRad;
                const angle2 = (Math.PI / 3) * ((port.edge + 1) % 6) + rotRad;
                const c1x = slot.center.x + HEX_SIZE * Math.cos(angle1);
                const c1y = slot.center.y + HEX_SIZE * Math.sin(angle1);
                const c2x = slot.center.x + HEX_SIZE * Math.cos(angle2);
                const c2y = slot.center.y + HEX_SIZE * Math.sin(angle2);
                const edgeMidX = (c1x + c2x) / 2;
                const edgeMidY = (c1y + c2y) / 2;
                
                // Direction pointing outward from hex center
                const outAngle = Math.atan2(edgeMidY - slot.center.y, edgeMidX - slot.center.x);
                const lineLen = 8;
                const circleRadius = 5;
                
                const lineEndX = edgeMidX + lineLen * Math.cos(outAngle);
                const lineEndY = edgeMidY + lineLen * Math.sin(outAngle);
                const circleX = lineEndX + circleRadius * Math.cos(outAngle);
                const circleY = lineEndY + circleRadius * Math.sin(outAngle);
                
                return (
                  <g key={`port-${portIdx}`}>
                    <line
                      x1={edgeMidX}
                      y1={edgeMidY}
                      x2={lineEndX}
                      y2={lineEndY}
                      stroke="#333"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={circleX}
                      cy={circleY}
                      r={circleRadius}
                      fill="#333"
                      stroke="#555"
                      strokeWidth="1"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
        
        {/* Deck and Hand */}
        <div className="flex-1 space-y-4">
          {/* Deck */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200">
            <h3 className="text-sm font-semibold text-stone-600 mb-3">
              🎴 Deck ({deckTiles.length} tiles)
            </h3>
            <div className="flex gap-2 items-center">
              <button
                onClick={drawTile}
                disabled={deckTiles.length === 0 || closedOut}
                className={`px-4 py-2 rounded transition-colors ${
                  deckTiles.length === 0 || closedOut
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                Draw Tile
              </button>
              <button
                onClick={closeOut}
                disabled={closedOut || drawnTileIds.length === 0}
                className={`px-4 py-2 rounded transition-colors ${
                  closedOut || drawnTileIds.length === 0
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                {closedOut ? 'Closed Out' : 'Close Out'}
              </button>
              {!closedOut && (
                <span className="text-sm text-stone-500">
                  {slotsRemaining} slots to fill
                </span>
              )}
            </div>
          </div>
          
          {/* Hand */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200">
            <h3 className="text-sm font-semibold text-stone-600 mb-3">
              ✋ Hand ({handTiles.length} tiles)
              <span className="font-normal text-stone-400 ml-2">Click selected tile to rotate</span>
            </h3>
            <div className="flex flex-wrap gap-3">
              {handTiles.map(tile => {
                const isSelected = selectedTileId === tile.id;
                const tileRotation = tileRotations[tile.id] || 0;
                const rotatedFlowLines = getRotatedFlowLines(tile.hex.flowLines, tileRotation);
                
                return (
                  <div
                    key={tile.id}
                    onClick={() => handleTileClick(tile.id)}
                    className={`relative cursor-pointer transition-all ${isSelected ? 'ring-2 ring-purple-500 ring-offset-2' : 'hover:scale-105'}`}
                    style={{
                      width: HEX_SIZE * 2.5,
                      height: HEX_SIZE * 2.5,
                      opacity: isSelected ? 1 : 0.9
                    }}
                  >
                    <svg width={HEX_SIZE * 2.5} height={HEX_SIZE * 2.5}>
                      <g transform={`translate(${HEX_SIZE * 1.25}, ${HEX_SIZE * 1.25})`}>
                        {/* Hex background */}
                        <path
                          d={hexToPath(createHexagon(0, 0, HEX_SIZE * 0.9, puzzle.hexRotation))}
                          fill={`hsl(${arcaneHue}, 25%, 88%)`}
                          stroke={isSelected ? '#9333ea' : `hsl(${arcaneHue}, 30%, 70%)`}
                          strokeWidth={isSelected ? 2 : 1.5}
                        />
                        
                        {/* Flow lines (rotated) */}
                        {rotatedFlowLines.map((flow, flowIdx) => {
                          const rotRad = (puzzle.hexRotation * Math.PI) / 180;
                          const scale = 0.9;
                          const getEdgePoint = (edgeIdx) => {
                            const angle1 = (Math.PI / 3) * edgeIdx + rotRad;
                            const angle2 = (Math.PI / 3) * ((edgeIdx + 1) % 6) + rotRad;
                            const c1x = HEX_SIZE * scale * Math.cos(angle1);
                            const c1y = HEX_SIZE * scale * Math.sin(angle1);
                            const c2x = HEX_SIZE * scale * Math.cos(angle2);
                            const c2y = HEX_SIZE * scale * Math.sin(angle2);
                            return { x: (c1x + c2x) / 2, y: (c1y + c2y) / 2 };
                          };
                          
                          // Multi-way junction
                          if (flow.isJunction && flow.edges) {
                            return (
                              <g key={flowIdx}>
                                {flow.edges.map((edge, eIdx) => {
                                  const p = getEdgePoint(edge);
                                  return (
                                    <line
                                      key={eIdx}
                                      x1={p.x} y1={p.y}
                                      x2={0} y2={0}
                                      stroke={flow.color}
                                      strokeWidth="4"
                                      strokeLinecap="round"
                                    />
                                  );
                                })}
                                <circle cx={0} cy={0} r="4" fill={flow.color} />
                              </g>
                            );
                          }
                          
                          const p1 = getEdgePoint(flow.edge1);
                          
                          // Dead end
                          if (flow.edge2 === null) {
                            return (
                              <g key={flowIdx}>
                                <line x1={p1.x} y1={p1.y} x2={0} y2={0} stroke={flow.color} strokeWidth="4" strokeLinecap="round" />
                                <circle cx={0} cy={0} r="3" fill={flow.color} />
                              </g>
                            );
                          }
                          
                          // 2-way
                          const p2 = getEdgePoint(flow.edge2);
                          return (
                            <path
                              key={flowIdx}
                              d={`M ${p1.x} ${p1.y} Q 0 0 ${p2.x} ${p2.y}`}
                              fill="none"
                              stroke={flow.color}
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                          );
                        })}
                        
                        {/* Inner hex with syllables */}
                        {tile.hex.syllables.length > 0 && (
                          <g>
                            <path
                              d={hexToPath(createHexagon(0, 0, HEX_SIZE * 0.35, puzzle.hexRotation))}
                              fill={`hsl(${arcaneHue}, 30%, 35%)`}
                              stroke={`hsl(${arcaneHue}, 35%, 45%)`}
                              strokeWidth="1"
                            />
                            {tile.hex.syllables.length === 1 ? (
                              <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="bold" fill="#e8e4de">
                                {tile.hex.syllables[0].syllable.symbol}
                              </text>
                            ) : (
                              <>
                                <text x={0} y={-4} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="bold" fill="#e8e4de">
                                  {tile.hex.syllables[0].syllable.symbol}
                                </text>
                                <text x={0} y={4} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="bold" fill="#e8e4de">
                                  {tile.hex.syllables[1].syllable.symbol}
                                </text>
                              </>
                            )}
                          </g>
                        )}
                      </g>
                    </svg>
                  </div>
                );
              })}
            </div>
            
            {handTiles.length === 0 && drawnTileIds.length > 0 && (
              <p className="text-stone-400 text-sm italic">All drawn tiles placed!</p>
            )}
            {drawnTileIds.length === 0 && (
              <p className="text-stone-400 text-sm italic">Draw tiles from the deck to begin</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// INVENTORY MODE
// ============================================

const INVENTORY_CELL_SIZE = 60; // Slightly smaller cells for inventory view

// Generate a complete item from catalog with all rendering data
function generateInventoryItem() {
  const catalogItem = pickRandomItem({});
  if (!catalogItem) return null;
  
  const cells = catalogItem.cells;
  const hollowCells = catalogItem.hollowCells || [];
  const allCells = [...cells, ...hollowCells];
  
  const width = Math.max(...allCells.map(c => c.x)) + 1;
  const height = Math.max(...allCells.map(c => c.y)) + 1;
  
  // Generate hollow cell colors for containers
  let hollowCellColors = new Map();
  if (catalogItem.isContainer && hollowCells.length > 0) {
    const hollowSet = new Set(hollowCells.map(c => `${c.x},${c.y}`));
    const result = generateContainerModifiers(catalogItem.groups, hollowSet, cells.length, hollowCells.length);
    hollowCellColors = result.hollowCellColors;
  }
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: catalogItem.name,
    category: catalogItem.category,
    isContainer: catalogItem.isContainer,
    cells: cells,  // Solid cells
    hollowCells: hollowCells,  // Storage cells (for containers)
    hollowCellColors: hollowCellColors,
    width,
    height,
    groups: catalogItem.groups
  };
}

// Check if an item can be placed at a position in the inventory grid
function canPlaceItem(item, position, gridWidth, gridHeight, placedItems, ignoredItemId = null) {
  const allCells = [...item.cells, ...(item.hollowCells || [])];
  
  // Check grid bounds
  for (const cell of allCells) {
    const gx = position.x + cell.x;
    const gy = position.y + cell.y;
    if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) {
      return false;
    }
  }
  
  // Check collision with other placed items (in main grid, not in containers)
  for (const placed of placedItems) {
    if (placed.id === ignoredItemId) continue;
    if (placed.containedIn) continue; // Skip items inside containers
    
    // Apply rotation to get actual cell positions
    const rotation = placed.rotation || 0;
    const { cells: placedCells, hollowCells: placedHollow } = rotateItemCells(
      placed.item.cells, placed.item.hollowCells || [], rotation
    );
    const placedAllCells = [...placedCells, ...placedHollow];
    
    for (const placedCell of placedAllCells) {
      const px = placed.position.x + placedCell.x;
      const py = placed.position.y + placedCell.y;
      
      for (const itemCell of allCells) {
        const ix = position.x + itemCell.x;
        const iy = position.y + itemCell.y;
        
        if (px === ix && py === iy) {
          return false; // Collision
        }
      }
    }
  }
  
  return true;
}

// Check if an item can be placed inside a container's hollow cells
function canPlaceInContainer(item, localPosition, container, containedItems) {
  const hollowSet = new Set((container.item.hollowCells || []).map(c => `${c.x},${c.y}`));
  const itemCells = [...item.cells, ...(item.hollowCells || [])];
  
  // All item cells must fit within hollow cells
  for (const cell of itemCells) {
    const lx = localPosition.x + cell.x;
    const ly = localPosition.y + cell.y;
    if (!hollowSet.has(`${lx},${ly}`)) {
      return false;
    }
  }
  
  // Check collision with other items in this container
  for (const contained of containedItems) {
    const containedCells = [...contained.item.cells, ...(contained.item.hollowCells || [])];
    for (const cc of containedCells) {
      const cx = contained.localPosition.x + cc.x;
      const cy = contained.localPosition.y + cc.y;
      
      for (const ic of itemCells) {
        const ix = localPosition.x + ic.x;
        const iy = localPosition.y + ic.y;
        
        if (cx === ix && cy === iy) {
          return false;
        }
      }
    }
  }
  
  return true;
}

// Rotate cells 90 degrees clockwise, n times (n = 0, 1, 2, 3 for 0°, 90°, 180°, 270°)
// Returns raw rotated cells WITHOUT normalization
function rotateCellsRaw(cells, rotations) {
  if (!cells || cells.length === 0) return cells;
  const n = ((rotations % 4) + 4) % 4;
  if (n === 0) return cells.map(c => ({ ...c })); // Return copy
  
  let rotated = cells;
  for (let r = 0; r < n; r++) {
    // 90° clockwise in screen coords: (x, y) -> (-y, x)
    rotated = rotated.map(c => ({ x: -c.y, y: c.x }));
  }
  return rotated;
}

// Normalize cells to start at (0,0)
function normalizeCells(cells) {
  if (!cells || cells.length === 0) return cells;
  const minX = Math.min(...cells.map(c => c.x));
  const minY = Math.min(...cells.map(c => c.y));
  return cells.map(c => ({ x: c.x - minX, y: c.y - minY }));
}

// Rotate cells and normalize
function rotateCells(cells, rotations) {
  return normalizeCells(rotateCellsRaw(cells, rotations));
}

// Rotate both solid and hollow cells together, normalizing as a unit
function rotateItemCells(solidCells, hollowCells, rotations) {
  const n = ((rotations % 4) + 4) % 4;
  if (n === 0) {
    return {
      cells: solidCells.map(c => ({ ...c })),
      hollowCells: (hollowCells || []).map(c => ({ ...c }))
    };
  }
  
  const rotatedSolid = rotateCellsRaw(solidCells, rotations);
  const rotatedHollow = rotateCellsRaw(hollowCells || [], rotations);
  
  // Normalize together using combined bounds
  const allRotated = [...rotatedSolid, ...rotatedHollow];
  if (allRotated.length === 0) {
    return { cells: [], hollowCells: [] };
  }
  
  const minX = Math.min(...allRotated.map(c => c.x));
  const minY = Math.min(...allRotated.map(c => c.y));
  
  return {
    cells: rotatedSolid.map(c => ({ x: c.x - minX, y: c.y - minY })),
    hollowCells: rotatedHollow.map(c => ({ x: c.x - minX, y: c.y - minY }))
  };
}

// Get rotated dimensions
function getRotatedDimensions(width, height, rotations) {
  const n = ((rotations % 4) + 4) % 4;
  if (n === 1 || n === 3) return { width: height, height: width };
  return { width, height };
}

// Rotate hollow cell colors map to match rotated cells
// Needs solidCells to properly normalize with the full item shape
function rotateHollowCellColors(hollowCellColors, solidCells, hollowCells, rotations) {
  if (!hollowCellColors || hollowCellColors.size === 0) return hollowCellColors;
  if (!hollowCells || hollowCells.length === 0) return new Map();
  
  const { hollowCells: rotatedHollow } = rotateItemCells(solidCells, hollowCells, rotations);
  
  const newColors = new Map();
  for (let i = 0; i < hollowCells.length; i++) {
    const origKey = `${hollowCells[i].x},${hollowCells[i].y}`;
    const rotKey = `${rotatedHollow[i].x},${rotatedHollow[i].y}`;
    if (hollowCellColors.has(origKey)) {
      newColors.set(rotKey, hollowCellColors.get(origKey));
    }
  }
  return newColors;
}

function InventoryMode() {
  const [gridSize] = useState({ width: 10, height: 7 });
  
  // Available items to place (the "stash")
  const [availableItems, setAvailableItems] = useState(() => 
    Array.from({ length: 8 }, () => generateInventoryItem()).filter(Boolean)
  );
  
  // Placed items in the inventory grid
  const [placedItems, setPlacedItems] = useState([]);
  
  // Currently selected item (from stash) or placed item being moved
  const [selectedItem, setSelectedItem] = useState(null);
  const [isMovingPlaced, setIsMovingPlaced] = useState(false);
  const [selectedRotation, setSelectedRotation] = useState(0); // 0, 1, 2, 3 for 0°, 90°, 180°, 270°
  
  // Hover position for placement preview
  const [hoverPos, setHoverPos] = useState(null);
  
  // Generate more items
  const addMoreItems = useCallback(() => {
    const newItems = Array.from({ length: 4 }, () => generateInventoryItem()).filter(Boolean);
    setAvailableItems(prev => [...prev, ...newItems]);
  }, []);
  
  // Select an item from stash
  const selectFromStash = useCallback((item) => {
    setSelectedItem(item);
    setIsMovingPlaced(false);
    setSelectedRotation(0);
  }, []);
  
  // Select a placed item to move it
  const selectPlacedItem = useCallback((placedItem) => {
    if (placedItem.containedIn) return; // Can't directly select items inside containers
    setSelectedItem(placedItem);
    setIsMovingPlaced(true);
    setSelectedRotation(placedItem.rotation || 0);
  }, []);
  
  // Rotate selected item
  const rotateSelected = useCallback(() => {
    if (selectedItem) {
      setSelectedRotation(r => (r + 1) % 4);
    }
  }, [selectedItem]);
  
  // Keyboard handler for rotation
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        rotateSelected();
      } else if (e.key === 'Escape') {
        setSelectedItem(null);
        setIsMovingPlaced(false);
        setSelectedRotation(0);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rotateSelected]);
  
  // Get rotated cells for the selected item
  const getSelectedCells = useCallback(() => {
    if (!selectedItem) return { cells: [], hollowCells: [], width: 0, height: 0 };
    
    const item = isMovingPlaced ? selectedItem.item : selectedItem;
    const { cells, hollowCells } = rotateItemCells(item.cells, item.hollowCells || [], selectedRotation);
    const dims = getRotatedDimensions(item.width, item.height, selectedRotation);
    
    return {
      cells,
      hollowCells,
      width: dims.width,
      height: dims.height
    };
  }, [selectedItem, isMovingPlaced, selectedRotation]);
  
  // Place or move item
  const handleGridClick = useCallback((gridX, gridY) => {
    if (!selectedItem) return;
    
    const item = isMovingPlaced ? selectedItem.item : selectedItem;
    const position = { x: gridX, y: gridY };
    const { cells: rotatedCells, hollowCells: rotatedHollow } = rotateItemCells(item.cells, item.hollowCells || [], selectedRotation);
    
    // Create a temporary rotated item for placement check
    const rotatedItem = {
      ...item,
      cells: rotatedCells,
      hollowCells: rotatedHollow
    };
    
    if (canPlaceItem(rotatedItem, position, gridSize.width, gridSize.height, placedItems, isMovingPlaced ? selectedItem.id : null)) {
      if (isMovingPlaced) {
        // Move existing item (update position and rotation)
        setPlacedItems(prev => prev.map(p => 
          p.id === selectedItem.id ? { ...p, position, rotation: selectedRotation } : p
        ));
      } else {
        // Place new item from stash
        setPlacedItems(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          item: selectedItem,
          position,
          rotation: selectedRotation,
          containedIn: null
        }]);
        setAvailableItems(prev => prev.filter(i => i.id !== selectedItem.id));
      }
      setSelectedItem(null);
      setIsMovingPlaced(false);
      setSelectedRotation(0);
    }
  }, [selectedItem, isMovingPlaced, selectedRotation, gridSize, placedItems]);
  
  // Return item to stash
  const returnToStash = useCallback((placedItem) => {
    // Also return any items contained in it
    const containedItems = placedItems.filter(p => p.containedIn === placedItem.id);
    
    setPlacedItems(prev => prev.filter(p => p.id !== placedItem.id && p.containedIn !== placedItem.id));
    setAvailableItems(prev => [...prev, placedItem.item, ...containedItems.map(c => c.item)]);
    setSelectedItem(null);
    setIsMovingPlaced(false);
    setSelectedRotation(0);
  }, [placedItems]);
  
  // Cancel selection
  const cancelSelection = useCallback(() => {
    setSelectedItem(null);
    setIsMovingPlaced(false);
    setSelectedRotation(0);
  }, []);
  
  // Get cell occupation map for rendering
  const cellOccupation = useMemo(() => {
    const map = new Map(); // "x,y" -> { placedItem, cellType: 'solid' | 'hollow', localCell }
    
    for (const placed of placedItems) {
      if (placed.containedIn) continue; // Skip contained items for main grid
      
      const rotation = placed.rotation || 0;
      const { cells: rotatedCells, hollowCells: rotatedHollow } = rotateItemCells(
        placed.item.cells, placed.item.hollowCells || [], rotation
      );
      
      for (let i = 0; i < rotatedCells.length; i++) {
        const cell = rotatedCells[i];
        const key = `${placed.position.x + cell.x},${placed.position.y + cell.y}`;
        map.set(key, { placedItem: placed, cellType: 'solid', localCell: cell, originalIndex: i });
      }
      
      for (let i = 0; i < rotatedHollow.length; i++) {
        const cell = rotatedHollow[i];
        const key = `${placed.position.x + cell.x},${placed.position.y + cell.y}`;
        map.set(key, { placedItem: placed, cellType: 'hollow', localCell: cell, originalIndex: i });
      }
    }
    
    return map;
  }, [placedItems]);
  
  // Preview cells for current selection
  const previewCells = useMemo(() => {
    if (!selectedItem || !hoverPos) return { cells: [], valid: false };
    
    const item = isMovingPlaced ? selectedItem.item : selectedItem;
    const { cells: rotatedCells, hollowCells: rotatedHollow } = rotateItemCells(
      item.cells, item.hollowCells || [], selectedRotation
    );
    const allCells = [...rotatedCells, ...rotatedHollow];
    
    // Create rotated item for placement check
    const rotatedItem = { ...item, cells: rotatedCells, hollowCells: rotatedHollow };
    const valid = canPlaceItem(rotatedItem, hoverPos, gridSize.width, gridSize.height, placedItems, isMovingPlaced ? selectedItem.id : null);
    
    return {
      cells: allCells.map(c => ({ x: hoverPos.x + c.x, y: hoverPos.y + c.y })),
      valid
    };
  }, [selectedItem, isMovingPlaced, selectedRotation, hoverPos, gridSize, placedItems]);
  
  return (
    <div className="p-6 min-h-screen bg-stone-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 mb-2">
          Inventory System
        </h1>
        <p className="text-stone-600 text-sm mb-4">
          Click items to select, click grid to place. Press R to rotate. Click placed items to move them.
        </p>
        
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={addMoreItems}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
          >
            + Add Items
          </button>
          {selectedItem && (
            <>
              <button
                onClick={rotateSelected}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                ↻ Rotate (R)
              </button>
              <button
                onClick={cancelSelection}
                className="px-4 py-2 bg-stone-500 text-white rounded hover:bg-stone-600 transition-colors"
              >
                Cancel (Esc)
              </button>
              <span className="px-3 py-2 text-stone-600 text-sm">
                {selectedRotation * 90}°
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Inventory Grid */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-stone-200">
          <h3 className="text-sm font-semibold text-stone-600 mb-2">Inventory</h3>
          <div 
            className="relative bg-stone-50 border-2 border-stone-300 rounded"
            style={{ 
              width: gridSize.width * INVENTORY_CELL_SIZE,
              height: gridSize.height * INVENTORY_CELL_SIZE
            }}
            onMouseLeave={() => setHoverPos(null)}
          >
            {/* Grid lines */}
            {Array.from({ length: gridSize.height }, (_, y) => 
              Array.from({ length: gridSize.width }, (_, x) => {
                const key = `${x},${y}`;
                const occupation = cellOccupation.get(key);
                const isPreview = previewCells.cells.some(c => c.x === x && c.y === y);
                
                return (
                  <div
                    key={key}
                    className="absolute border border-stone-200 cursor-pointer hover:bg-stone-100 transition-colors"
                    style={{
                      left: x * INVENTORY_CELL_SIZE,
                      top: y * INVENTORY_CELL_SIZE,
                      width: INVENTORY_CELL_SIZE,
                      height: INVENTORY_CELL_SIZE,
                      backgroundColor: isPreview 
                        ? (previewCells.valid ? 'rgba(74, 156, 91, 0.3)' : 'rgba(220, 38, 38, 0.3)')
                        : undefined
                    }}
                    onMouseEnter={() => setHoverPos({ x, y })}
                    onClick={() => handleGridClick(x, y)}
                  />
                );
              })
            )}
            
            {/* Placed items */}
            {placedItems.filter(p => !p.containedIn).map(placed => {
              const rotation = placed.rotation || 0;
              const { cells: rotatedCells, hollowCells: rotatedHollow } = rotateItemCells(
                placed.item.cells, placed.item.hollowCells || [], rotation
              );
              const rotatedHollowColors = rotateHollowCellColors(
                placed.item.hollowCellColors,
                placed.item.cells,
                placed.item.hollowCells || [], 
                rotation
              );
              
              return (
                <div
                  key={placed.id}
                  className={`absolute pointer-events-none ${selectedItem?.id === placed.id ? 'opacity-50' : ''}`}
                  style={{
                    left: placed.position.x * INVENTORY_CELL_SIZE,
                    top: placed.position.y * INVENTORY_CELL_SIZE
                  }}
                >
                  {/* Solid cells */}
                  {rotatedCells.map((cell, i) => (
                    <div
                      key={`solid-${i}`}
                      className="absolute pointer-events-auto cursor-pointer"
                      style={{
                        left: cell.x * INVENTORY_CELL_SIZE,
                        top: cell.y * INVENTORY_CELL_SIZE,
                        width: INVENTORY_CELL_SIZE,
                        height: INVENTORY_CELL_SIZE,
                        backgroundColor: '#f5f2ed',
                        border: '2px solid #8b8680',
                        boxSizing: 'border-box'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectPlacedItem(placed);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        returnToStash(placed);
                      }}
                    />
                  ))}
                  
                  {/* Hollow cells (container storage) */}
                  {rotatedHollow.map((cell, i) => {
                    const cellKey = `${cell.x},${cell.y}`;
                    const cellGroup = rotatedHollowColors?.get(cellKey);
                    
                    let bgColor = 'hsl(45, 15%, 90%)';
                    let borderColor = 'hsl(45, 50%, 35%)';
                    
                    if (cellGroup && FLOW_GROUPS[cellGroup]) {
                      const groupColor = FLOW_GROUPS[cellGroup].color;
                      const r = parseInt(groupColor.slice(1, 3), 16);
                      const g = parseInt(groupColor.slice(3, 5), 16);
                      const b = parseInt(groupColor.slice(5, 7), 16);
                      const lightR = Math.round(r * 0.3 + 255 * 0.7);
                      const lightG = Math.round(g * 0.3 + 255 * 0.7);
                      const lightB = Math.round(b * 0.3 + 255 * 0.7);
                      bgColor = `rgb(${lightR}, ${lightG}, ${lightB})`;
                      borderColor = groupColor;
                    }
                    
                    return (
                      <div
                        key={`hollow-${i}`}
                        className="absolute pointer-events-auto cursor-pointer"
                        style={{
                          left: cell.x * INVENTORY_CELL_SIZE,
                          top: cell.y * INVENTORY_CELL_SIZE,
                          width: INVENTORY_CELL_SIZE,
                          height: INVENTORY_CELL_SIZE,
                          backgroundColor: bgColor,
                          border: `2px solid ${borderColor}`,
                          boxSizing: 'border-box'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectPlacedItem(placed);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          returnToStash(placed);
                        }}
                      />
                    );
                  })}
                  
                  {/* Item label */}
                  <div 
                    className="absolute text-xs font-medium text-stone-700 bg-white/80 px-1 rounded pointer-events-none"
                    style={{
                      left: 2,
                      top: 2
                    }}
                  >
                    {placed.item.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Item Stash */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-stone-200 flex-1">
          <h3 className="text-sm font-semibold text-stone-600 mb-2">
            Items ({availableItems.length})
          </h3>
          <div className="flex flex-wrap gap-4">
            {availableItems.map(item => (
              <div
                key={item.id}
                className={`relative cursor-pointer rounded-lg p-2 transition-all ${
                  selectedItem?.id === item.id 
                    ? 'ring-2 ring-purple-500 bg-purple-50' 
                    : 'hover:bg-stone-50 border border-stone-200'
                }`}
                onClick={() => selectFromStash(item)}
              >
                <div 
                  className="relative"
                  style={{ 
                    width: item.width * 24,
                    height: item.height * 24
                  }}
                >
                  {/* Mini solid cells */}
                  {item.cells.map((cell, i) => (
                    <div
                      key={`solid-${i}`}
                      className="absolute"
                      style={{
                        left: cell.x * 24,
                        top: cell.y * 24,
                        width: 24,
                        height: 24,
                        backgroundColor: '#f5f2ed',
                        border: '1px solid #8b8680',
                        boxSizing: 'border-box'
                      }}
                    />
                  ))}
                  {/* Mini hollow cells */}
                  {(item.hollowCells || []).map((cell, i) => {
                    const cellKey = `${cell.x},${cell.y}`;
                    const cellGroup = item.hollowCellColors?.get(cellKey);
                    let bgColor = 'hsl(45, 15%, 90%)';
                    if (cellGroup && FLOW_GROUPS[cellGroup]) {
                      const groupColor = FLOW_GROUPS[cellGroup].color;
                      const r = parseInt(groupColor.slice(1, 3), 16);
                      const g = parseInt(groupColor.slice(3, 5), 16);
                      const b = parseInt(groupColor.slice(5, 7), 16);
                      bgColor = `rgb(${Math.round(r * 0.3 + 255 * 0.7)}, ${Math.round(g * 0.3 + 255 * 0.7)}, ${Math.round(b * 0.3 + 255 * 0.7)})`;
                    }
                    return (
                      <div
                        key={`hollow-${i}`}
                        className="absolute"
                        style={{
                          left: cell.x * 24,
                          top: cell.y * 24,
                          width: 24,
                          height: 24,
                          backgroundColor: bgColor,
                          border: '1px dashed #a0a0a0',
                          boxSizing: 'border-box'
                        }}
                      />
                    );
                  })}
                </div>
                <div className="text-xs text-stone-600 mt-1 text-center">
                  {item.name}
                  {item.isContainer && <span className="text-purple-600 ml-1">📦</span>}
                </div>
              </div>
            ))}
            
            {availableItems.length === 0 && (
              <p className="text-stone-400 text-sm italic">No items - click "Add Items" to generate more</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="mt-6 text-sm text-stone-500">
        <p><strong>Controls:</strong> Left-click to select/place • R to rotate • Right-click to return to stash • Esc to cancel</p>
      </div>
    </div>
  );
}

// Main export - mode selection
export default function ItemBlockGenerator() {
  const [mode, setMode] = useState('inventory'); // 'puzzle' or 'inventory'
  
  if (mode === 'puzzle') {
    return (
      <div>
        <div className="p-4 bg-stone-200 flex gap-2">
          <button 
            onClick={() => setMode('inventory')}
            className="px-3 py-1 bg-stone-500 text-white rounded hover:bg-stone-600"
          >
            ← Inventory
          </button>
        </div>
        <PuzzleMode />
      </div>
    );
  }
  
  return (
    <div>
      <div className="p-4 bg-stone-200 flex gap-2">
        <button 
          onClick={() => setMode('puzzle')}
          className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          🧩 Puzzle Mode
        </button>
      </div>
      <InventoryMode />
    </div>
  );
}