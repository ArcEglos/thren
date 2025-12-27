// Flow groups - magical affinities
// All lines connect at edge midpoint (0.5) for simpler matching
export const FLOW_GROUPS = {
  growth: { color: '#4a9c5b' },   // green - nature/life
  stone:  { color: '#7a6b5c' },   // brown/gray - earth/stability  
  tide:   { color: '#4a7c9c' },   // blue - water/flow
  ember:  { color: '#9c5c4a' },   // red/orange - fire/energy
  void:   { color: '#6b5c7c' },   // purple - arcane/mystery
};

export const GROUP_NAMES = Object.keys(FLOW_GROUPS);

// Item catalog - defines all item types, their possible shapes, and valid group combinations
// Shapes are defined as cell coordinate arrays
// Group combos define thematically appropriate magic types for each shape
export const ITEM_CATALOG = {
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

// Syllables with multiple representations (different group combinations)
// Each representation is a valid way to "channel" that syllable
export const ARCANE_SYLLABLES = [
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
