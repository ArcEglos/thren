// Rotation utilities for inventory items

// Rotate cells by 90 degrees clockwise (raw, doesn't normalize)
export function rotateCellsRaw(cells, rotations) {
  const n = ((rotations % 4) + 4) % 4;
  if (n === 0) return cells;

  let result = [...cells];
  for (let r = 0; r < n; r++) {
    result = result.map(c => ({ x: -c.y, y: c.x }));
  }
  return result;
}

// Normalize cells to start at 0,0
export function normalizeCells(cells) {
  const minX = Math.min(...cells.map(c => c.x));
  const minY = Math.min(...cells.map(c => c.y));
  return cells.map(c => ({ x: c.x - minX, y: c.y - minY }));
}

// Rotate and normalize cells
export function rotateCells(cells, rotations) {
  return normalizeCells(rotateCellsRaw(cells, rotations));
}

// Rotate both solid and hollow cells together, maintaining relative positions
export function rotateItemCells(solidCells, hollowCells, rotations) {
  const n = ((rotations % 4) + 4) % 4;
  if (n === 0) return { cells: solidCells, hollowCells: hollowCells || [] };

  // Combine all cells
  const allCells = [...solidCells, ...(hollowCells || [])];
  const rotatedAll = rotateCellsRaw(allCells, n);

  // Normalize together
  const minX = Math.min(...rotatedAll.map(c => c.x));
  const minY = Math.min(...rotatedAll.map(c => c.y));

  const rotatedSolid = rotatedAll.slice(0, solidCells.length).map(c => ({ x: c.x - minX, y: c.y - minY }));
  const rotatedHollow = rotatedAll.slice(solidCells.length).map(c => ({ x: c.x - minX, y: c.y - minY }));

  return {
    cells: rotatedSolid,
    hollowCells: rotatedHollow
  };
}

// Get rotated dimensions
export function getRotatedDimensions(width, height, rotations) {
  const n = ((rotations % 4) + 4) % 4;
  if (n === 1 || n === 3) return { width: height, height: width };
  return { width, height };
}

// Rotate hollow cell colors map to match rotated cells
// Needs solidCells to properly normalize with the full item shape
export function rotateHollowCellColors(hollowCellColors, solidCells, hollowCells, rotations) {
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

// Check if an item can be placed at a position in the inventory grid
export function canPlaceItem(item, position, gridWidth, gridHeight, placedItems, ignoredItemId = null) {
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
          return false; // Collision!
        }
      }
    }
  }

  return true;
}

// Check if an item can be placed inside a container at a local position
// localPosition is in UNROTATED container coordinates
export function canPlaceInContainer(item, localPosition, container, containedItems, itemRotation = 0, ignoredItemId = null) {
  // Use container's UNROTATED hollow cells (since localPosition is unrotated)
  const containerStorage = container.item.hollowCells || [];
  const storageSet = new Set(containerStorage.map(c => `${c.x},${c.y}`));

  // Get ALL item's cells (solid + hollow for containers), rotated by itemRotation
  const { cells: rotatedSolid, hollowCells: rotatedHollow } = rotateItemCells(
    item.cells, item.hollowCells || [], itemRotation
  );
  const itemCells = [...rotatedSolid, ...rotatedHollow];

  // Check all item cells fit within container storage (unrotated coords)
  for (const cell of itemCells) {
    const cx = localPosition.x + cell.x;
    const cy = localPosition.y + cell.y;
    if (!storageSet.has(`${cx},${cy}`)) {
      return false; // Cell is outside storage area
    }
  }

  // Check collision with other contained items
  // Their localPosition is also in unrotated coords
  for (const contained of containedItems) {
    if (contained.containerId !== container.id) continue;
    if (contained.id === ignoredItemId) continue; // Skip self when moving

    // Get contained item's rotated cells
    const containedRotation = contained.rotation || 0;
    const { cells: containedSolid, hollowCells: containedHollow } = rotateItemCells(
      contained.item.cells, contained.item.hollowCells || [], containedRotation
    );
    const containedAllCells = [...containedSolid, ...containedHollow];

    for (const containedCell of containedAllCells) {
      const ccx = contained.localPosition.x + containedCell.x;
      const ccy = contained.localPosition.y + containedCell.y;

      for (const itemCell of itemCells) {
        const ix = localPosition.x + itemCell.x;
        const iy = localPosition.y + itemCell.y;

        if (ccx === ix && ccy === iy) {
          return false; // Collision with existing contained item
        }
      }
    }
  }

  return true;
}

// ===========================================
// Recursive container utilities
// ===========================================

// Get direct children of a container (or grid if containerId is null)
export function getChildren(containerId, placedItems) {
  return placedItems.filter(item => item.containedIn === containerId);
}

// Get the position of an item (works for both grid and contained items)
export function getItemLocalPosition(item) {
  return item.containedIn ? item.localPosition : item.position;
}

// Get rotated cells for an item (convenience wrapper)
export function getRotatedItemCells(item) {
  const rotation = item.rotation || 0;
  return rotateItemCells(item.item.cells, item.item.hollowCells || [], rotation);
}

// Build a cell occupation map for a container's local coordinate space
// Returns Map of "x,y" -> { item: placedItem, cellType: 'solid' | 'hollow', localCell }
export function getContainerCellOccupation(containerId, placedItems) {
  const map = new Map();
  const children = getChildren(containerId, placedItems);

  for (const child of children) {
    const pos = getItemLocalPosition(child);
    const { cells: rotatedCells, hollowCells: rotatedHollow } = getRotatedItemCells(child);

    for (const cell of rotatedCells) {
      const key = `${pos.x + cell.x},${pos.y + cell.y}`;
      map.set(key, { item: child, cellType: 'solid', localCell: cell });
    }

    for (const cell of rotatedHollow) {
      const key = `${pos.x + cell.x},${pos.y + cell.y}`;
      map.set(key, { item: child, cellType: 'hollow', localCell: cell });
    }
  }

  return map;
}

// Find the deepest container hollow cell at a grid position
// Returns { container, localX, localY } or null
// This recursively checks nested containers
export function findDeepestContainerAtPosition(gridX, gridY, placedItems) {
  // Start with grid-level items
  const gridOccupation = getContainerCellOccupation(null, placedItems);
  const key = `${gridX},${gridY}`;
  const occupation = gridOccupation.get(key);

  if (!occupation) return null;
  if (occupation.cellType !== 'hollow') return null;

  // Found a container hollow cell - check if there's a nested container inside
  const container = occupation.item;
  const containerPos = getItemLocalPosition(container);
  const localX = gridX - containerPos.x;
  const localY = gridY - containerPos.y;

  // Recursively check for nested containers
  const nested = findDeepestContainerAtLocalPosition(
    localX, localY, container.id, placedItems
  );

  if (nested) return nested;

  // No nested container, return this one
  return { container, localX, localY };
}

// Helper: find deepest container at a local position within a parent container
function findDeepestContainerAtLocalPosition(localX, localY, parentContainerId, placedItems) {
  const occupation = getContainerCellOccupation(parentContainerId, placedItems);
  const key = `${localX},${localY}`;
  const cell = occupation.get(key);

  if (!cell) return null;
  if (cell.cellType !== 'hollow') return null;

  // Found a nested container's hollow cell
  const container = cell.item;
  const containerPos = getItemLocalPosition(container);
  const nestedLocalX = localX - containerPos.x;
  const nestedLocalY = localY - containerPos.y;

  // Keep recursing
  const deeper = findDeepestContainerAtLocalPosition(
    nestedLocalX, nestedLocalY, container.id, placedItems
  );

  if (deeper) return deeper;

  return { container, localX: nestedLocalX, localY: nestedLocalY };
}

// Get absolute grid position of an item (walks up parent chain)
export function getAbsolutePosition(item, placedItems) {
  if (!item.containedIn) {
    return item.position;
  }

  let pos = { ...item.localPosition };
  let currentContainerId = item.containedIn;

  while (currentContainerId) {
    const parent = placedItems.find(p => p.id === currentContainerId);
    if (!parent) break;

    const parentPos = getItemLocalPosition(parent);
    // TODO: apply parent's rotation transformation to pos
    pos = { x: pos.x + parentPos.x, y: pos.y + parentPos.y };

    currentContainerId = parent.containedIn;
  }

  return pos;
}

// ===========================================
// Coordinate transformation utilities
// ===========================================

// Get the bounding box of a container's ALL cells (solid + hollow)
// This must match what rotateItemCells uses for normalization
// Returns both dimensions and min offsets for proper coordinate transformation
export function getContainerBounds(containerItem) {
  const allCells = [...(containerItem.cells || []), ...(containerItem.hollowCells || [])];
  if (allCells.length === 0) return { width: 1, height: 1, minX: 0, minY: 0 };

  const minX = Math.min(...allCells.map(c => c.x));
  const maxX = Math.max(...allCells.map(c => c.x));
  const minY = Math.min(...allCells.map(c => c.y));
  const maxY = Math.max(...allCells.map(c => c.y));
  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    minX,
    minY
  };
}

// Transform a position from unrotated container coords to rotated container coords
// Used during materialization: localPosition (unrotated) -> rendered position (rotated)
export function unrotatedToRotated(pos, rotation, bounds) {
  const n = ((rotation % 4) + 4) % 4;
  if (n === 0) return { ...pos };

  const { width, height } = bounds;

  // When container rotates CW, a point at (x,y) in unrotated space
  // appears at a transformed position in rotated space
  switch (n) {
    case 1: // 90° CW
      return { x: height - 1 - pos.y, y: pos.x };
    case 2: // 180°
      return { x: width - 1 - pos.x, y: height - 1 - pos.y };
    case 3: // 270° CW
      return { x: pos.y, y: width - 1 - pos.x };
    default:
      return { ...pos };
  }
}

// Transform a position from rotated container coords to unrotated container coords
// Used during placement: clicked position (rotated) -> localPosition (unrotated)
export function rotatedToUnrotated(pos, rotation, bounds) {
  const n = ((rotation % 4) + 4) % 4;
  if (n === 0) return { ...pos };

  // Inverse of unrotatedToRotated: apply rotation in opposite direction
  // Rotating by -n is same as rotating by (4-n)
  const inverseN = (4 - n) % 4;

  // After inverse rotation, bounds swap for 90° and 270°
  const { width, height } = bounds;
  const invBounds = (n === 1 || n === 3) ? { width: height, height: width } : bounds;

  return unrotatedToRotated(pos, inverseN, invBounds);
}

// ===========================================
// Materialization - compute absolute positions
// ===========================================

// Materialize all items with absolute positions, rotations, and depth
// localPosition is stored in UNROTATED parent coordinates
// We transform it to rotated coordinates during materialization
export function materializeItems(placedItems) {
  const result = [];

  // Cell lookup table: grid "x,y" -> { container, unrotatedLocalX, unrotatedLocalY, depth }
  const cellLookup = new Map();

  // Build a map for quick parent lookup
  const itemsById = new Map(placedItems.map(p => [p.id, p]));

  function processItem(item, parentAbsPos, parentAbsRot, parentItem, depth) {
    let absolutePosition, absoluteRotation;

    if (!item.containedIn) {
      // Grid-level item
      absolutePosition = { ...item.position };
      absoluteRotation = item.rotation || 0;
    } else {
      // Contained item
      // localPosition is in parent's UNROTATED coordinate system
      // The item's cells (at its own rotation) occupy physical positions starting at localPosition
      // We need to transform ALL those physical positions, then find the new origin

      const parentBounds = getContainerBounds(parentItem.item);
      const itemRotation = item.rotation || 0;

      // Get item's cells at its current rotation
      const { cells: itemCellsRotated, hollowCells: itemHollowRotated } = rotateItemCells(
        item.item.cells, item.item.hollowCells || [], itemRotation
      );
      const allItemCells = [...itemCellsRotated, ...itemHollowRotated];

      // Compute physical positions in unrotated container coords
      const physicalCells = allItemCells.map(c => ({
        x: item.localPosition.x + c.x,
        y: item.localPosition.y + c.y
      }));

      // Transform all physical cells to rotated container coords
      const transformedCells = physicalCells.map(c =>
        unrotatedToRotated(c, parentAbsRot, parentBounds)
      );

      // The new origin is the minimum of the transformed cells
      // This aligns with how rotateItemCells normalizes cells
      const newMinX = Math.min(...transformedCells.map(c => c.x));
      const newMinY = Math.min(...transformedCells.map(c => c.y));

      absolutePosition = {
        x: parentAbsPos.x + newMinX,
        y: parentAbsPos.y + newMinY
      };
      // Accumulate rotation
      absoluteRotation = (parentAbsRot + (item.rotation || 0)) % 4;
    }

    // Get this item's rotated cells for rendering info
    const { cells: rotatedCells, hollowCells: rotatedHollow } = rotateItemCells(
      item.item.cells, item.item.hollowCells || [], absoluteRotation
    );

    const matItem = {
      ...item,
      absolutePosition,
      absoluteRotation,
      rotatedCells,
      rotatedHollow,
      depth
    };

    result.push(matItem);

    // Add hollow cells to lookup table (for container placement detection)
    // Store with UNROTATED local coordinates for placement
    if (item.item.isContainer && item.item.hollowCells) {
      const unrotatedHollow = item.item.hollowCells;
      for (let i = 0; i < rotatedHollow.length; i++) {
        const rotCell = rotatedHollow[i];
        const unrotCell = unrotatedHollow[i];
        const gridX = absolutePosition.x + rotCell.x;
        const gridY = absolutePosition.y + rotCell.y;
        const key = `${gridX},${gridY}`;

        // Only add if not already occupied by a deeper container
        if (!cellLookup.has(key) || cellLookup.get(key).depth < depth) {
          cellLookup.set(key, {
            container: matItem,
            unrotatedLocalX: unrotCell.x,
            unrotatedLocalY: unrotCell.y,
            depth
          });
        }
      }
    }

    // Process children
    const children = placedItems.filter(p => p.containedIn === item.id);
    for (const child of children) {
      processItem(child, absolutePosition, absoluteRotation, item, depth + 1);
    }
  }

  // Start with grid-level items
  const gridItems = placedItems.filter(p => !p.containedIn);
  for (const item of gridItems) {
    processItem(item, null, 0, null, 0);
  }

  // Sort by depth so parents render before children
  result.sort((a, b) => a.depth - b.depth);

  return { items: result, cellLookup };
}
