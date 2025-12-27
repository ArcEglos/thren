import { ITEM_CATALOG, FLOW_GROUPS } from '../data/catalog.js';
import { CELL_SIZE, HEX_SIZE } from '../constants.js';
import {
  generateHexGrid,
  isHexInSolidRegion,
  growHexCluster,
  findBestTilingConfig
} from './hex.js';

// Helper to pick a random item from catalog
export function pickRandomItem(options = {}) {
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

// Get adjacent cell keys for a given cell key
export function getAdjacentCells(cellKey, validCells) {
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
export function growConnectedRegions(hollowCellSet, numRegions, colors) {
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
export function generateContainerModifiers(activeGroups, hollowCells, solidCount = 2, hollowCount = 4) {
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

// Generate a complete item from catalog with all rendering data (for inventory)
export function generateInventoryItem() {
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

  // Generate hex grid infrastructure on solid cells
  const hexData = generateItemHexGrid(cells, width, height);

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
    groups: catalogItem.groups,
    // Hex grid data
    hexSlots: hexData.hexSlots,
    hexRotation: hexData.hexRotation,
    tilingOffset: hexData.tilingOffset,
    ports: hexData.ports,
    externalEdges: hexData.externalEdges
  };
}

// Generate hex grid infrastructure for an item's solid cells
// Returns empty hex slots (no flow lines/syllables) ready for tile placement
function generateItemHexGrid(solidCells, width, height) {
  if (solidCells.length === 0) {
    return { hexSlots: [], hexRotation: 0, tilingOffset: { x: 0, y: 0 }, ports: [], externalEdges: [] };
  }

  // Estimate capacity and find best tiling configuration
  const solidCount = solidCells.length;
  const estimatedCapacity = solidCount * 5;
  const maxHexSlots = Math.max(3, Math.round(estimatedCapacity * 0.85));

  const bestConfig = findBestTilingConfig(solidCells, width, height, maxHexSlots, 15);
  const { tilingOffset, hexRotation } = bestConfig;

  // Generate hex grid and filter to solid region
  const allHexagons = generateHexGrid(
    width * CELL_SIZE,
    height * CELL_SIZE,
    HEX_SIZE,
    tilingOffset.x,
    tilingOffset.y,
    hexRotation
  );

  const cellSet = new Set(solidCells.map(c => `${c.x},${c.y}`));
  const validHexes = allHexagons.filter(hex => isHexInSolidRegion(hex, solidCells, cellSet));
  const hexSlots = growHexCluster(validHexes, HEX_SIZE, maxHexSlots);

  // Find external edges (edges without neighbors)
  const externalEdges = findHexExternalEdges(hexSlots, HEX_SIZE, hexRotation);

  // Generate ports on 40-55% of external edges
  const numPorts = Math.max(3, Math.floor(externalEdges.length * (0.40 + Math.random() * 0.15)));
  const shuffledExternalEdges = [...externalEdges].sort(() => Math.random() - 0.5);
  const ports = shuffledExternalEdges.slice(0, numPorts);

  // Add empty slot data to each hex (ready for tile placement)
  const slotsWithData = hexSlots.map((hex, idx) => ({
    ...hex,
    slotIndex: idx,
    tile: null,  // No tile placed yet
    // Precompute which edges are external and which have ports
    externalEdges: externalEdges.filter(e => e.hexIdx === idx).map(e => e.edge),
    portEdges: ports.filter(p => p.hexIdx === idx).map(p => p.edge)
  }));

  return {
    hexSlots: slotsWithData,
    hexRotation,
    tilingOffset,
    ports,
    externalEdges
  };
}

// Find external edges of hex cluster (edges without neighbors)
function findHexExternalEdges(hexSlots, hexSize, hexRotation) {
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
