import { CELL_SIZE, HEX_SIZE, HEX_ROTATION_RANGE } from '../constants.js';

// Find external edges of the hex cluster (true perimeter only)
// Returns array of { hexIdx, edgeIdx } for edges on the outer boundary
export function findExternalHexEdges(hexes, hexSize, rotationDeg) {
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

export function createHexagon(cx, cy, size, rotationDeg = 0) {
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

export function generateHexGrid(boundingWidth, boundingHeight, hexSize, offsetX = 0, offsetY = 0, rotation = 0) {
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
export function isPointInSolidRegion(px, py, solidCells, cellSet, margin = 8) {
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

export function isHexInSolidRegion(hex, solidCells, cellSet, margin = 4) {
  return hex.points.every(point =>
    isPointInSolidRegion(point.x, point.y, solidCells, cellSet, margin)
  );
}

export function hexDistance(hex1, hex2) {
  const dx = hex1.center.x - hex2.center.x;
  const dy = hex1.center.y - hex2.center.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function areHexesAdjacent(hex1, hex2, hexSize) {
  const maxAdjacentDist = hexSize * 1.8;
  return hexDistance(hex1, hex2) < maxAdjacentDist;
}

// Check if two hex edges share the same position (for merging)
export function hexesShareEdge(hex1, hex2) {
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

export function hexToPath(points) {
  return `M ${points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')} Z`;
}

// Compute the merged boundary path for a group of hexes
export function computeMergedBoundary(hexes) {
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
export function findIconPosition(hexes) {
  const centroidX = hexes.reduce((sum, h) => sum + h.center.x, 0) / hexes.length;
  const centroidY = hexes.reduce((sum, h) => sum + h.center.y, 0) / hexes.length;
  return { x: centroidX, y: centroidY };
}

// Find which edge of hexA faces hexB (0-5)
export function findFacingEdge(hexA, hexB, hexRotation) {
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
export function connectFlowLinesInTile(tile, hexRotation) {
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
export function groupHexesIntoTiles(hexes, hexRotation, skipHexIndices = []) {
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
export function growHexCluster(hexagons, hexSize, maxCount) {
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

export function getValidHexagons(hexagons, solidCells, hexSize, maxCount) {
  const cellSet = new Set(solidCells.map(c => `${c.x},${c.y}`));
  const validHexes = hexagons.filter(hex => isHexInSolidRegion(hex, solidCells, cellSet));
  const cluster = growHexCluster(validHexes, hexSize, maxCount);
  return { validHexes, cluster };
}

// Test how many hexes fit with a given tiling configuration
export function testHexPlacement(cells, width, height, tilingOffset, hexRotation, maxHexSlots) {
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
export function findBestTilingConfig(cells, width, height, maxHexSlots, attempts = 10) {
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

// Create a smaller hexagon at the same center
export function createInnerHexagon(cx, cy, size, rotationDeg = 0, scale = 0.45) {
  return createHexagon(cx, cy, size * scale, rotationDeg);
}
