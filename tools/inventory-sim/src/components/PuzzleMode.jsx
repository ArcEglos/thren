import React, { useState, useMemo } from 'react';
import { CELL_SIZE, HEX_SIZE, HEX_ROTATION_RANGE } from '../constants.js';
import { FLOW_GROUPS, ARCANE_SYLLABLES } from '../data/catalog.js';
import { pickRandomItem, generateContainerModifiers } from '../utils/items.js';
import {
  createHexagon,
  generateHexGrid,
  isHexInSolidRegion,
  growHexCluster,
  findBestTilingConfig,
  hexToPath,
  createInnerHexagon
} from '../utils/hex.js';
import { SyllableReference } from './SyllableReference.jsx';

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

export { PuzzleMode };
