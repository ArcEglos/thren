import { FLOW_GROUPS, ARCANE_SYLLABLES } from '../data/catalog.js';

// Generate a random tile with flow lines and optional syllables
// groups: array of valid group names for this item (e.g., ['ember', 'stone'])
export function generateRandomTile(groups) {
  if (!groups || groups.length === 0) {
    groups = Object.keys(FLOW_GROUPS);
  }

  // Get valid syllables for these groups
  const activeGroupSet = new Set(groups);
  let validSyllables = ARCANE_SYLLABLES.map(syllable => {
    const validReps = syllable.representations.filter(rep =>
      rep.every(groupName => activeGroupSet.has(groupName))
    );
    if (validReps.length === 0) return null;
    return { ...syllable, validRepresentations: validReps };
  }).filter(Boolean);

  // Fallback if no valid syllables
  if (validSyllables.length === 0) {
    validSyllables = ARCANE_SYLLABLES.map(s => ({
      ...s,
      validRepresentations: s.representations.filter(r => r.length === 1)
    })).filter(s => s.validRepresentations.length > 0);
  }

  // Roll for syllable count: 20% none, 72% one, 8% two
  const syllableRoll = Math.random();
  let syllableCount;
  if (syllableRoll < 0.20) syllableCount = 0;
  else if (syllableRoll < 0.92) syllableCount = 1;
  else syllableCount = 2;

  if (validSyllables.length === 0) syllableCount = 0;

  const syllables = [];
  let combinedRep = [];

  for (let s = 0; s < syllableCount; s++) {
    const syllable = validSyllables[Math.floor(Math.random() * validSyllables.length)];
    const validReps = syllable.validRepresentations || syllable.representations || [[]];
    const chosenRep = validReps[Math.floor(Math.random() * validReps.length)];
    syllables.push({ syllable, chosenRep });
    combinedRep = [...combinedRep, ...chosenRep];
  }

  // For empty tiles, add pass-through lines
  if (syllableCount === 0 && Math.random() < 0.85) {
    const numPassThrough = Math.random() < 0.7 ? 1 : 2;
    for (let p = 0; p < numPassThrough; p++) {
      const randomGroup = groups[Math.floor(Math.random() * groups.length)];
      if (!combinedRep.includes(randomGroup)) {
        combinedRep.push(randomGroup);
      }
    }
  }

  combinedRep = [...new Set(combinedRep)];

  // Generate flow lines
  const flowLines = [];
  const usedEdges = new Set();
  let hasMultiWayJunction = false;

  for (const groupName of combinedRep) {
    if (hasMultiWayJunction) break;

    // Roll for flow line type
    const typeRoll = Math.random();
    let flowType;
    if (typeRoll < 0.12) flowType = 'dead-end';
    else if (typeRoll < 0.94) flowType = '2-way';
    else if (typeRoll < 0.98) flowType = '3-way';
    else flowType = '4-way';

    const availableEdges = [];
    for (let e = 0; e < 6; e++) {
      if (!usedEdges.has(e)) availableEdges.push(e);
    }

    if (flowType === 'dead-end' && availableEdges.length >= 1) {
      const edge1 = availableEdges[Math.floor(Math.random() * availableEdges.length)];
      usedEdges.add(edge1);
      flowLines.push({ group: groupName, edge1, edge2: null, color: FLOW_GROUPS[groupName].color });

    } else if (flowType === '2-way' && availableEdges.length >= 2) {
      const edge1 = availableEdges[Math.floor(Math.random() * availableEdges.length)];
      const remaining = availableEdges.filter(e => e !== edge1);

      // Random offset for variety
      const offsetRoll = Math.random();
      let preferredOffset;
      if (offsetRoll < 0.15) preferredOffset = 1;
      else if (offsetRoll < 0.35) preferredOffset = 2;
      else if (offsetRoll < 0.65) preferredOffset = 3;
      else if (offsetRoll < 0.85) preferredOffset = 4;
      else preferredOffset = 5;

      let edge2;
      const candidate = (edge1 + preferredOffset) % 6;
      if (remaining.includes(candidate)) {
        edge2 = candidate;
      } else {
        edge2 = remaining[Math.floor(Math.random() * remaining.length)];
      }

      usedEdges.add(edge1);
      usedEdges.add(edge2);
      flowLines.push({ group: groupName, edge1, edge2, color: FLOW_GROUPS[groupName].color });

    } else if (flowType === '3-way' && availableEdges.length >= 3) {
      const shuffled = [...availableEdges].sort(() => Math.random() - 0.5);
      const edges = shuffled.slice(0, 3).sort((a, b) => a - b);
      edges.forEach(e => usedEdges.add(e));
      flowLines.push({ group: groupName, edges, color: FLOW_GROUPS[groupName].color, isJunction: true });
      hasMultiWayJunction = true;

    } else if (flowType === '4-way' && availableEdges.length >= 4) {
      const shuffled = [...availableEdges].sort(() => Math.random() - 0.5);
      const edges = shuffled.slice(0, 4).sort((a, b) => a - b);
      edges.forEach(e => usedEdges.add(e));
      flowLines.push({ group: groupName, edges, color: FLOW_GROUPS[groupName].color, isJunction: true });
      hasMultiWayJunction = true;

    } else if (availableEdges.length >= 2) {
      const edge1 = availableEdges[0];
      const edge2 = availableEdges[1];
      usedEdges.add(edge1);
      usedEdges.add(edge2);
      flowLines.push({ group: groupName, edge1, edge2, color: FLOW_GROUPS[groupName].color });

    } else if (availableEdges.length >= 1) {
      const edge1 = availableEdges[0];
      usedEdges.add(edge1);
      flowLines.push({ group: groupName, edge1, edge2: null, color: FLOW_GROUPS[groupName].color });
    }
  }

  return {
    id: `tile-${Math.random().toString(36).substr(2, 9)}`,
    flowLines,
    syllables,
    edgeColors: buildEdgeColors(flowLines),
    rotation: 0
  };
}

// Build a map of edge -> group for a tile's flow lines
export function buildEdgeColors(flowLines) {
  const edgeColors = {};
  for (const flow of flowLines) {
    if (flow.isJunction && flow.edges) {
      for (const edge of flow.edges) {
        edgeColors[edge] = flow.group;
      }
    } else {
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

// Rotate flow lines by rotation steps (each step = 60 degrees)
export function getRotatedFlowLines(flowLines, rotation) {
  if (!rotation || rotation === 0) return flowLines;
  return flowLines.map(flow => {
    if (flow.isJunction && flow.edges) {
      return {
        ...flow,
        edges: flow.edges.map(e => (e + rotation) % 6)
      };
    } else {
      return {
        ...flow,
        edge1: (flow.edge1 + rotation) % 6,
        edge2: flow.edge2 !== null ? (flow.edge2 + rotation) % 6 : null
      };
    }
  });
}

// Rotate edge colors by rotation steps
export function getRotatedEdgeColors(edgeColors, rotation) {
  if (!rotation || rotation === 0) return edgeColors;
  const rotated = {};
  for (const [edge, group] of Object.entries(edgeColors)) {
    const newEdge = (parseInt(edge) + rotation) % 6;
    rotated[newEdge] = group;
  }
  return rotated;
}
