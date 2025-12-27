import React, { useState, useCallback, useMemo, useReducer } from 'react';
import { INVENTORY_CELL_SIZE, CELL_SIZE, HEX_SIZE } from '../constants.js';
import { FLOW_GROUPS } from '../data/catalog.js';
import { hexToPath, createHexagon, createInnerHexagon } from '../utils/hex.js';
import { generateInventoryItem } from '../utils/items.js';
import { generateRandomTile, getRotatedFlowLines, getRotatedEdgeColors } from '../utils/tiles.js';
import {
  rotateItemCells,
  getRotatedDimensions,
  rotateHollowCellColors,
  canPlaceItem,
  canPlaceInContainer,
  findDeepestContainerAtPosition,
  materializeItems,
  rotatedToUnrotated,
  unrotatedToRotated,
  getContainerBounds
} from '../utils/inventory.js';

// Action mode reducer for investigating/studying/extracting items
const initialActionState = {
  mode: 'idle',  // 'idle' | 'investigating' | 'studying' | 'extracting'
  targetItemId: null,
  drawnTiles: [],  // Tiles in hand during action
  selectedTileId: null,  // Which tile from hand is selected
};

function actionReducer(state, action) {
  switch (action.type) {
    case 'START_INVESTIGATING':
      return {
        mode: 'investigating',
        targetItemId: action.itemId,
        drawnTiles: [],
        selectedTileId: null,
      };

    case 'START_STUDYING':
      return {
        mode: 'studying',
        targetItemId: action.itemId,
        drawnTiles: [],
        selectedTileId: null,
      };

    case 'START_EXTRACTING':
      return {
        mode: 'extracting',
        targetItemId: action.itemId,
        drawnTiles: [],
        selectedTileId: null,
      };

    case 'DRAW_TILE':
      return {
        ...state,
        drawnTiles: [...state.drawnTiles, action.tile],
      };

    case 'SELECT_TILE':
      return {
        ...state,
        selectedTileId: action.tileId,
      };

    case 'DESELECT_TILE':
      return {
        ...state,
        selectedTileId: null,
      };

    case 'ROTATE_TILE':
      return {
        ...state,
        drawnTiles: state.drawnTiles.map(t =>
          t.id === action.tileId
            ? { ...t, rotation: ((t.rotation || 0) + 1) % 6 }
            : t
        ),
      };

    case 'REMOVE_TILE_FROM_HAND':
      return {
        ...state,
        drawnTiles: state.drawnTiles.filter(t => t.id !== action.tileId),
        selectedTileId: state.selectedTileId === action.tileId ? null : state.selectedTileId,
      };

    case 'ADD_TILE_TO_HAND':
      return {
        ...state,
        drawnTiles: [...state.drawnTiles, action.tile],
      };

    case 'FINISH':
    case 'ABANDON':
      return initialActionState;

    default:
      return state;
  }
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

  // Container hover state - when hovering over a container's hollow cell
  // { containerId, localPosition: {x, y} } or null
  const [containerHover, setContainerHover] = useState(null);

  // Hex slot hover state
  const [hoveredSlot, setHoveredSlot] = useState(null);    // { itemId, slotIndex }

  // Item hover state (for showing action buttons)
  const [hoveredItemId, setHoveredItemId] = useState(null);

  // Error/feedback message state
  const [actionError, setActionError] = useState(null);  // { message: string, type: 'error' | 'warning' }

  // Syllable inventory - collected from extracted tiles
  const [syllableInventory, setSyllableInventory] = useState([]);

  // Action mode state (investigating, studying, extracting)
  const [actionState, dispatch] = useReducer(actionReducer, initialActionState);
  const { mode: actionMode, targetItemId, drawnTiles, selectedTileId } = actionState;
  const isInActionMode = actionMode !== 'idle';

  // Get the selected tile object from drawnTiles
  const selectedTile = useMemo(() =>
    drawnTiles.find(t => t.id === selectedTileId) || null,
    [drawnTiles, selectedTileId]
  );

  // Get the target item (the one being investigated/studied/extracted)
  const targetItem = useMemo(() =>
    placedItems.find(p => p.id === targetItemId) || null,
    [placedItems, targetItemId]
  );

  // Generate more items
  const addMoreItems = useCallback(() => {
    const newItems = Array.from({ length: 4 }, () => generateInventoryItem()).filter(Boolean);
    setAvailableItems(prev => [...prev, ...newItems]);
  }, []);

  // Draw a tile during action mode (uses target item's groups)
  const drawTile = useCallback(() => {
    if (!isInActionMode || !targetItem) return;

    // Clear any error when taking action
    setActionError(null);

    // Use the target item's groups for tile generation
    const groups = targetItem.item.groups || Object.keys(FLOW_GROUPS);
    const tile = generateRandomTile(groups);
    dispatch({ type: 'DRAW_TILE', tile });
  }, [isInActionMode, targetItem]);

  // Select a tile from hand
  const selectTileFromHand = useCallback((tile) => {
    if (selectedTileId === tile.id) {
      // Already selected - rotate it
      dispatch({ type: 'ROTATE_TILE', tileId: tile.id });
    } else {
      dispatch({ type: 'SELECT_TILE', tileId: tile.id });
    }
  }, [selectedTileId]);

  // Start investigating an uninvestigated item
  const startInvestigating = useCallback((placedItemId) => {
    dispatch({ type: 'START_INVESTIGATING', itemId: placedItemId });
  }, []);

  // Start studying an investigated item (must have empty slots)
  const startStudying = useCallback((placedItemId) => {
    dispatch({ type: 'START_STUDYING', itemId: placedItemId });
  }, []);

  // Check if an item has empty hex slots
  const getEmptySlotCount = useCallback((item) => {
    const hexSlots = item.hexSlots || [];
    const placedTiles = item.placedTiles || {};
    return hexSlots.filter((_, idx) => !placedTiles[idx]).length;
  }, []);

  // Check if an item has tiles with syllables (for extraction)
  const hasSyllableTiles = useCallback((item) => {
    const placedTiles = item.placedTiles || {};
    return Object.values(placedTiles).some(tile =>
      tile && !tile.isFlipped && tile.syllables && tile.syllables.length > 0
    );
  }, []);

  // Start extracting from an investigated item
  const startExtracting = useCallback((placedItemId) => {
    dispatch({ type: 'START_EXTRACTING', itemId: placedItemId });
  }, []);

  // Flip a tile for extraction - collects syllables immediately
  const flipTileForExtraction = useCallback((itemId, slotIndex) => {
    if (actionMode !== 'extracting') return;
    if (itemId !== targetItemId) return;

    const placedItem = placedItems.find(p => p.id === itemId);
    if (!placedItem) return;

    const tile = placedItem.item.placedTiles?.[slotIndex];
    if (!tile || tile.isFlipped) return;
    if (!tile.syllables || tile.syllables.length === 0) return;

    // Collect syllables immediately
    setSyllableInventory(prev => [...prev, ...tile.syllables]);

    // Flip the tile (preserve original state, clear flow lines)
    setPlacedItems(prev => prev.map(p => {
      if (p.id !== itemId) return p;
      return {
        ...p,
        item: {
          ...p.item,
          placedTiles: {
            ...p.item.placedTiles,
            [slotIndex]: {
              ...tile,
              isFlipped: true,
              originalState: {
                flowLines: tile.flowLines,
                syllables: tile.syllables,
                edgeColors: tile.edgeColors
              },
              // Flipped tile has no flow lines
              flowLines: [],
              syllables: [],
              edgeColors: {}
            }
          }
        }
      };
    }));

    setActionError(null);
  }, [actionMode, targetItemId, placedItems]);

  // Abandon current action (destroys item and tiles)
  const abandonAction = useCallback(() => {
    if (!isInActionMode || !targetItemId) return;

    // Remove the target item from placed items
    setPlacedItems(prev => prev.filter(p => p.id !== targetItemId));

    // Clear error and reset action state
    setActionError(null);
    dispatch({ type: 'ABANDON' });
  }, [isInActionMode, targetItemId]);

  // Validate that all flow lines are closed
  // Returns { valid: boolean, errors: string[] }
  const validateFlowLines = useCallback(() => {
    if (!targetItem) return { valid: false, errors: ['No target item'] };

    const item = targetItem.item;
    const hexSlots = item.hexSlots || [];
    const placedTiles = item.placedTiles || {};
    const hexRotation = item.hexRotation || 0;
    const errors = [];

    // Build a map of slot index -> edge colors (after rotation)
    const slotEdgeColors = {};
    for (let slotIdx = 0; slotIdx < hexSlots.length; slotIdx++) {
      const tile = placedTiles[slotIdx];
      if (tile) {
        slotEdgeColors[slotIdx] = getRotatedEdgeColors(tile.edgeColors, tile.rotation || 0);
      } else {
        slotEdgeColors[slotIdx] = {};  // Empty slot
      }
    }

    // Build neighbor map for each slot
    const rotRad = (hexRotation * Math.PI) / 180;
    const neighborMap = {};  // slotIdx -> { edge: neighborSlotIdx }

    for (let i = 0; i < hexSlots.length; i++) {
      neighborMap[i] = {};
      const slot = hexSlots[i];

      for (let edge = 0; edge < 6; edge++) {
        // Calculate expected neighbor position
        const edgeAngle = (Math.PI / 3) * edge + rotRad + Math.PI / 6;
        const neighborDist = HEX_SIZE * Math.sqrt(3);
        const expectedX = slot.center.x + neighborDist * Math.cos(edgeAngle);
        const expectedY = slot.center.y + neighborDist * Math.sin(edgeAngle);

        // Find neighbor at this position
        for (let j = 0; j < hexSlots.length; j++) {
          if (i === j) continue;
          const other = hexSlots[j];
          const dist = Math.sqrt(
            Math.pow(other.center.x - expectedX, 2) +
            Math.pow(other.center.y - expectedY, 2)
          );
          if (dist < HEX_SIZE * 0.5) {
            neighborMap[i][edge] = j;
            break;
          }
        }
      }
    }

    // Check each slot's flow line endpoints
    for (let slotIdx = 0; slotIdx < hexSlots.length; slotIdx++) {
      const slot = hexSlots[slotIdx];
      const edgeColors = slotEdgeColors[slotIdx];
      const portEdges = new Set(slot.portEdges || []);

      for (const [edgeStr, group] of Object.entries(edgeColors)) {
        const edge = parseInt(edgeStr);
        const neighborSlotIdx = neighborMap[slotIdx][edge];

        if (neighborSlotIdx !== undefined) {
          // Has a neighbor - check if neighbor has something on the opposite edge
          const oppositeEdge = (edge + 3) % 6;
          const neighborEdgeColors = slotEdgeColors[neighborSlotIdx];
          const neighborHasLine = neighborEdgeColors[oppositeEdge] !== undefined;

          if (!neighborHasLine) {
            errors.push(`Slot ${slotIdx + 1}: ${group} line on edge ${edge} connects to empty slot`);
          }
          // Note: colors don't have to match, just need something there
        } else {
          // External edge - must have a port
          if (!portEdges.has(edge)) {
            errors.push(`Slot ${slotIdx + 1}: ${group} line on edge ${edge} has no port (flow leak!)`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }, [targetItem]);

  // Finish current action (validates and completes)
  const finishAction = useCallback(() => {
    if (!isInActionMode || !targetItemId) return;

    // Clear any previous error
    setActionError(null);

    // Check that all drawn tiles are placed
    if (drawnTiles.length > 0) {
      setActionError({
        message: `You must place all drawn tiles! (${drawnTiles.length} remaining in hand)`,
        type: 'warning'
      });
      return;
    }

    // Validate flow lines
    const { valid, errors } = validateFlowLines();
    if (!valid) {
      setActionError({
        message: `Flow lines not closed: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ''}`,
        type: 'error'
      });
      return;
    }

    // Mark item as investigated
    setPlacedItems(prev => prev.map(p => {
      if (p.id !== targetItemId) return p;
      return {
        ...p,
        item: {
          ...p.item,
          investigated: true
        }
      };
    }));

    // Reset action state
    dispatch({ type: 'FINISH' });
  }, [isInActionMode, targetItemId, drawnTiles, validateFlowLines]);

  // Place tile in a hex slot (only works on target item during action mode)
  const placeTileInSlot = useCallback((itemId, slotIndex) => {
    if (!selectedTile || !isInActionMode) return;
    if (itemId !== targetItemId) return;  // Can only place on target item

    // Find the placed item
    const placedItem = placedItems.find(p => p.id === itemId);
    if (!placedItem) return;

    // Get the tile with current rotation from hand
    const tileFromHand = drawnTiles.find(t => t.id === selectedTile.id);
    if (!tileFromHand) return;

    // Check if slot already has a tile
    const existingTile = placedItem.item.placedTiles?.[slotIndex];
    if (existingTile) {
      // Pick up existing tile and put back in hand
      dispatch({ type: 'ADD_TILE_TO_HAND', tile: existingTile });
    }

    // Update the item with the placed tile
    setPlacedItems(prev => prev.map(p => {
      if (p.id !== itemId) return p;
      return {
        ...p,
        item: {
          ...p.item,
          placedTiles: {
            ...(p.item.placedTiles || {}),
            [slotIndex]: {
              ...tileFromHand,
              rotation: tileFromHand.rotation || 0
            }
          }
        }
      };
    }));

    // Remove tile from hand
    dispatch({ type: 'REMOVE_TILE_FROM_HAND', tileId: selectedTile.id });
  }, [selectedTile, isInActionMode, targetItemId, placedItems, drawnTiles]);

  // Pick up a placed tile back to hand (only works on target item during action mode)
  const pickUpTileFromSlot = useCallback((itemId, slotIndex) => {
    if (!isInActionMode) return;
    if (itemId !== targetItemId) return;  // Can only pick up from target item

    const placedItem = placedItems.find(p => p.id === itemId);
    if (!placedItem) return;

    const tile = placedItem.item.placedTiles?.[slotIndex];
    if (!tile) return;

    // Add tile back to hand
    dispatch({ type: 'ADD_TILE_TO_HAND', tile });

    // Remove tile from item
    setPlacedItems(prev => prev.map(p => {
      if (p.id !== itemId) return p;
      const newPlacedTiles = { ...p.item.placedTiles };
      delete newPlacedTiles[slotIndex];
      return {
        ...p,
        item: {
          ...p.item,
          placedTiles: newPlacedTiles
        }
      };
    }));
  }, [isInActionMode, targetItemId, placedItems]);

  // Handle hex slot click
  const handleHexSlotClick = useCallback((e, itemId, slotIndex) => {
    e.stopPropagation();

    // Only allow interaction with target item during action mode
    if (!isInActionMode) return;
    if (itemId !== targetItemId) return;

    const placedItem = placedItems.find(p => p.id === itemId);
    if (!placedItem) return;

    const existingTile = placedItem.item.placedTiles?.[slotIndex];

    // Extraction mode: clicking a syllable tile flips it
    if (actionMode === 'extracting' && existingTile && !existingTile.isFlipped &&
        existingTile.syllables && existingTile.syllables.length > 0) {
      flipTileForExtraction(itemId, slotIndex);
      return;
    }

    if (selectedTile) {
      // Place selected tile
      placeTileInSlot(itemId, slotIndex);
    } else if (existingTile && !existingTile.isFlipped) {
      // Pick up existing tile (can't pick up flipped tiles)
      pickUpTileFromSlot(itemId, slotIndex);
    }
  }, [selectedTile, isInActionMode, targetItemId, actionMode, placedItems, placeTileInSlot, pickUpTileFromSlot, flipTileForExtraction]);
  
  // Select an item from stash
  const selectFromStash = useCallback((item) => {
    setSelectedItem(item);
    setIsMovingPlaced(false);
    setSelectedRotation(0);
  }, []);
  
  // Select a placed item to move it (uses absoluteRotation from materialized data)
  const selectPlacedItem = useCallback((placedItem) => {
    if (placedItem.containedIn) return; // Can't directly select items inside containers
    setSelectedItem(placedItem);
    setIsMovingPlaced(true);
    // Use absoluteRotation if available (from materialized data), otherwise fall back to rotation
    setSelectedRotation(placedItem.absoluteRotation ?? placedItem.rotation ?? 0);
  }, []);
  
  // Rotate selected item
  const rotateSelected = useCallback(() => {
    if (selectedItem) {
      setSelectedRotation(r => (r + 1) % 4);
    }
  }, [selectedItem]);
  
  // Keyboard handler for rotation and cancel
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        if (selectedTile) {
          // Rotate selected tile in hand
          dispatch({ type: 'ROTATE_TILE', tileId: selectedTile.id });
        } else if (selectedItem) {
          rotateSelected();
        }
      } else if (e.key === 'Escape') {
        if (selectedTile) {
          dispatch({ type: 'DESELECT_TILE' });
        } else if (selectedItem) {
          setSelectedItem(null);
          setIsMovingPlaced(false);
          setSelectedRotation(0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rotateSelected, selectedTile, selectedItem]);
  
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
        // Move existing item (update position and rotation, clear container reference if any)
        setPlacedItems(prev => prev.map(p =>
          p.id === selectedItem.id
            ? { ...p, position, rotation: selectedRotation, containedIn: null, localPosition: null }
            : p
        ));
      } else {
        // Place new item from stash and auto-start investigating
        const newItemId = Math.random().toString(36).substr(2, 9);
        setPlacedItems(prev => [...prev, {
          id: newItemId,
          item: selectedItem,
          position,
          rotation: selectedRotation,
          containedIn: null
        }]);
        setAvailableItems(prev => prev.filter(i => i.id !== selectedItem.id));

        // Auto-start investigation for newly placed items
        dispatch({ type: 'START_INVESTIGATING', itemId: newItemId });
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

  // Materialize all items with absolute positions and rotations
  const { items: materializedItems, cellLookup } = useMemo(() => {
    return materializeItems(placedItems);
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

  // Preview for placing inside a container
  const containerPreview = useMemo(() => {
    if (!selectedItem || !containerHover) return null;

    const item = isMovingPlaced ? selectedItem.item : selectedItem;

    const container = placedItems.find(p => p.id === containerHover.containerId);
    if (!container) return null;

    // Get contained items for collision check
    const containedItems = placedItems
      .filter(p => p.containedIn === container.id)
      .map(p => ({ ...p, containerId: container.id }));

    // Compute relative rotation (selectedRotation is absolute)
    const containerAbsRot = materializedItems.find(m => m.id === container.id)?.absoluteRotation || 0;
    const relativeRotation = ((selectedRotation - containerAbsRot) % 4 + 4) % 4;

    // Validate using relative rotation in unrotated container coords
    // When moving an existing item, ignore self for collision detection
    const ignoredId = isMovingPlaced ? selectedItem.id : null;
    const valid = canPlaceInContainer(item, containerHover.localPosition, container, containedItems, relativeRotation, ignoredId);

    // Get item's cells at relative rotation (for placement in container's local space)
    const { cells: rotatedSolid, hollowCells: rotatedHollow } = rotateItemCells(
      item.cells, item.hollowCells || [], relativeRotation
    );
    const allCells = [...rotatedSolid, ...rotatedHollow];

    // Compute preview cells in unrotated container coords
    const unrotatedLocalCells = allCells.map(c => ({
      x: containerHover.localPosition.x + c.x,
      y: containerHover.localPosition.y + c.y
    }));

    // Transform to rotated coords for display (so preview aligns with rendered container)
    const containerBounds = getContainerBounds(container.item);
    const rotatedLocalCells = unrotatedLocalCells.map(c =>
      unrotatedToRotated(c, containerAbsRot, containerBounds)
    );

    return {
      container,
      localCells: rotatedLocalCells,
      valid
    };
  }, [selectedItem, isMovingPlaced, containerHover, placedItems, selectedRotation, materializedItems]);

  return (
    <div className="p-6 min-h-screen bg-stone-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 mb-2">
          Inventory System
        </h1>

        {/* Action Mode Header */}
        {isInActionMode && targetItem && (
          <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-400 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-amber-800 font-semibold text-lg">
                  {actionMode === 'investigating' && '🔍 Investigating: '}
                  {actionMode === 'studying' && '📚 Studying: '}
                  {actionMode === 'extracting' && '⚗️ Extracting: '}
                </span>
                <span className="text-amber-900 font-bold">{targetItem.item.name}</span>
                <span className="text-amber-700 ml-2 text-sm">
                  ({targetItem.item.hexSlots?.length || 0} slots, groups: {targetItem.item.groups?.join(', ') || 'none'})
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={drawTile}
                  className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                >
                  🎴 Draw Tile
                </button>
                <button
                  onClick={finishAction}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  ✓ Finish
                </button>
                <button
                  onClick={abandonAction}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  ✕ Abandon
                </button>
              </div>
            </div>

            {/* Hand display */}
            <div className="flex items-center gap-2">
              <span className="text-amber-800 text-sm font-medium">Hand ({drawnTiles.length}):</span>
              {drawnTiles.length === 0 ? (
                <span className="text-amber-600 text-sm italic">Draw tiles to begin</span>
              ) : (
                <div className="flex gap-2">
                  {drawnTiles.map(tile => {
                    const isSelected = selectedTileId === tile.id;
                    const tileRotation = tile.rotation || 0;
                    const rotatedFlowLines = getRotatedFlowLines(tile.flowLines, tileRotation);

                    return (
                      <div
                        key={tile.id}
                        onClick={() => selectTileFromHand(tile)}
                        className={`cursor-pointer transition-all rounded ${
                          isSelected
                            ? 'ring-2 ring-purple-500 ring-offset-1 bg-purple-50'
                            : 'hover:scale-105'
                        }`}
                        style={{ width: HEX_SIZE * 2, height: HEX_SIZE * 2 }}
                        title={isSelected ? 'Click again to rotate' : 'Click to select'}
                      >
                        <svg width={HEX_SIZE * 2} height={HEX_SIZE * 2}>
                          <g transform={`translate(${HEX_SIZE}, ${HEX_SIZE})`}>
                            <path
                              d={hexToPath(createHexagon(0, 0, HEX_SIZE * 0.85, 0))}
                              fill="hsl(45, 25%, 88%)"
                              stroke={isSelected ? '#9333ea' : 'hsl(45, 30%, 70%)'}
                              strokeWidth={isSelected ? 2 : 1}
                            />
                            {rotatedFlowLines.map((flow, flowIdx) => {
                              const scale = 0.85;
                              const getEdgePoint = (edgeIdx) => {
                                const angle1 = (Math.PI / 3) * edgeIdx;
                                const angle2 = (Math.PI / 3) * ((edgeIdx + 1) % 6);
                                return {
                                  x: (HEX_SIZE * scale * (Math.cos(angle1) + Math.cos(angle2))) / 2,
                                  y: (HEX_SIZE * scale * (Math.sin(angle1) + Math.sin(angle2))) / 2
                                };
                              };

                              if (flow.isJunction && flow.edges) {
                                return (
                                  <g key={flowIdx}>
                                    {flow.edges.map((edge, eIdx) => {
                                      const p = getEdgePoint(edge);
                                      return <line key={eIdx} x1={p.x} y1={p.y} x2={0} y2={0} stroke={flow.color} strokeWidth="3" strokeLinecap="round" />;
                                    })}
                                    <circle cx={0} cy={0} r="3" fill={flow.color} />
                                  </g>
                                );
                              }

                              const p1 = getEdgePoint(flow.edge1);
                              if (flow.edge2 === null) {
                                return (
                                  <g key={flowIdx}>
                                    <line x1={p1.x} y1={p1.y} x2={0} y2={0} stroke={flow.color} strokeWidth="3" strokeLinecap="round" />
                                    <circle cx={0} cy={0} r="2" fill={flow.color} />
                                  </g>
                                );
                              }

                              const p2 = getEdgePoint(flow.edge2);
                              return <path key={flowIdx} d={`M ${p1.x} ${p1.y} Q 0 0 ${p2.x} ${p2.y}`} fill="none" stroke={flow.color} strokeWidth="3" strokeLinecap="round" />;
                            })}

                            {tile.syllables?.length > 0 && (
                              <g>
                                <path d={hexToPath(createHexagon(0, 0, HEX_SIZE * 0.3, 0))} fill="hsl(45, 30%, 35%)" stroke="hsl(45, 35%, 45%)" strokeWidth="1" />
                                <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="bold" fill="#e8e4de">
                                  {tile.syllables[0].syllable.symbol}
                                </text>
                              </g>
                            )}
                          </g>
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedTile && (
                <span className="text-purple-600 text-sm ml-2">Click hex slot to place</span>
              )}
            </div>

            {/* Error/warning message */}
            {actionError && (
              <div className={`mt-2 p-2 rounded text-sm ${
                actionError.type === 'error'
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {actionError.type === 'error' ? '❌ ' : '⚠️ '}
                {actionError.message}
                <button
                  onClick={() => setActionError(null)}
                  className="ml-2 text-stone-500 hover:text-stone-700"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {/* Normal mode header */}
        {!isInActionMode && (
          <p className="text-stone-600 text-sm mb-4">
            Click items to select, click grid to place. Press R to rotate. Click uninvestigated items to investigate.
          </p>
        )}

        {!isInActionMode && (
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
        )}
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
                // Only show grid preview when not hovering over a container
                const isPreview = !containerHover && previewCells.cells.some(c => c.x === x && c.y === y);

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
            
            {/* Placed items - using materialized absolute positions */}
            {materializedItems.map(matItem => {
              const { absolutePosition, absoluteRotation, rotatedCells, rotatedHollow, depth } = matItem;

              // Get rotated hollow cell colors
              const rotatedHollowColors = rotateHollowCellColors(
                matItem.item.hollowCellColors,
                matItem.item.cells,
                matItem.item.hollowCells || [],
                absoluteRotation
              );

              // Different styling for contained items (depth > 0)
              const isContained = depth > 0;
              const isInvestigated = matItem.item.investigated === true;
              const isTargetItem = targetItemId === matItem.id;

              // Styling based on state
              let solidBg = isContained ? '#e8e4de' : '#f5f2ed';
              let solidBorder = isContained ? '#6b6560' : '#8b8680';

              // Uninvestigated items get a different look
              if (!isInvestigated && !isContained) {
                solidBg = '#ede9e0';  // Slightly more muted
                solidBorder = '#9c8c7c';  // Warmer border
              }

              // Target item during action gets highlighted
              if (isTargetItem && isInActionMode) {
                solidBorder = '#d97706';  // Amber border
              }

              // Find top-left solid cell for label
              const minY = Math.min(...rotatedCells.map(c => c.y));
              const topRowCells = rotatedCells.filter(c => c.y === minY);
              const minX = Math.min(...topRowCells.map(c => c.x));

              // Build cell sets for neighbor checking
              const solidSet = new Set(rotatedCells.map(c => `${c.x},${c.y}`));
              const hollowSet = new Set(rotatedHollow.map(c => `${c.x},${c.y}`));

              // Helper to get border style for a cell (only show border on outer edges)
              const getCellBorders = (cell, sameTypeSet, borderColor) => {
                const hasTop = sameTypeSet.has(`${cell.x},${cell.y - 1}`);
                const hasBottom = sameTypeSet.has(`${cell.x},${cell.y + 1}`);
                const hasLeft = sameTypeSet.has(`${cell.x - 1},${cell.y}`);
                const hasRight = sameTypeSet.has(`${cell.x + 1},${cell.y}`);
                return {
                  borderTop: hasTop ? 'none' : `2px solid ${borderColor}`,
                  borderBottom: hasBottom ? 'none' : `2px solid ${borderColor}`,
                  borderLeft: hasLeft ? 'none' : `2px solid ${borderColor}`,
                  borderRight: hasRight ? 'none' : `2px solid ${borderColor}`,
                };
              };

              return (
                <React.Fragment key={matItem.id}>
                  {/* Solid cells */}
                  {rotatedCells.map((cell, i) => (
                    <div
                      key={`${matItem.id}-solid-${i}`}
                      className={`absolute pointer-events-auto cursor-pointer ${selectedItem?.id === matItem.id ? 'opacity-50' : ''}`}
                      style={{
                        left: (absolutePosition.x + cell.x) * INVENTORY_CELL_SIZE,
                        top: (absolutePosition.y + cell.y) * INVENTORY_CELL_SIZE,
                        width: INVENTORY_CELL_SIZE,
                        height: INVENTORY_CELL_SIZE,
                        backgroundColor: solidBg,
                        ...getCellBorders(cell, solidSet, solidBorder),
                        boxSizing: 'border-box',
                        zIndex: depth
                      }}
                      onMouseEnter={() => !isInActionMode && setHoveredItemId(matItem.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      onClick={(e) => {
                        e.stopPropagation();

                        // During action mode, ignore clicks on non-target items
                        if (isInActionMode && !isTargetItem) return;

                        if (selectedItem && selectedItem.id !== matItem.id) {
                          handleGridClick(absolutePosition.x + cell.x, absolutePosition.y + cell.y);
                        } else if (!isInActionMode && !isContained && !isInvestigated) {
                          // Click uninvestigated item to start investigating
                          startInvestigating(matItem.id);
                        } else if (!isContained) {
                          selectPlacedItem(matItem);
                        } else {
                          // Pick up from container - use absoluteRotation to preserve visual orientation
                          setSelectedItem(matItem);
                          setIsMovingPlaced(true);
                          setSelectedRotation(matItem.absoluteRotation ?? 0);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!isContained) {
                          returnToStash(matItem);
                        } else {
                          setPlacedItems(prev => prev.filter(p => p.id !== matItem.id));
                          setAvailableItems(prev => [...prev, matItem.item]);
                        }
                      }}
                    />
                  ))}

                  {/* Hollow cells (container storage) */}
                  {rotatedHollow.map((cell, i) => {
                    const cellKey = `${cell.x},${cell.y}`;
                    const cellGroup = rotatedHollowColors?.get(cellKey);

                    let bgColor = isContained ? 'hsl(45, 15%, 85%)' : 'hsl(45, 15%, 90%)';
                    let borderColor = isContained ? 'hsl(45, 50%, 40%)' : 'hsl(45, 50%, 35%)';

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
                        key={`${matItem.id}-hollow-${i}`}
                        className={`absolute pointer-events-auto cursor-pointer ${selectedItem?.id === matItem.id ? 'opacity-50' : ''}`}
                        style={{
                          left: (absolutePosition.x + cell.x) * INVENTORY_CELL_SIZE,
                          top: (absolutePosition.y + cell.y) * INVENTORY_CELL_SIZE,
                          width: INVENTORY_CELL_SIZE,
                          height: INVENTORY_CELL_SIZE,
                          backgroundColor: bgColor,
                          ...getCellBorders(cell, hollowSet, borderColor),
                          boxSizing: 'border-box',
                          zIndex: depth
                        }}
                        onMouseEnter={() => !isInActionMode && setHoveredItemId(matItem.id)}
                        onMouseLeave={() => setHoveredItemId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedItem && selectedItem.id !== matItem.id) {
                            handleGridClick(absolutePosition.x + cell.x, absolutePosition.y + cell.y);
                          } else if (!isContained) {
                            selectPlacedItem(matItem);
                          } else {
                            // Pick up from container - use absoluteRotation to preserve visual orientation
                            setSelectedItem(matItem);
                            setIsMovingPlaced(true);
                            setSelectedRotation(matItem.absoluteRotation ?? 0);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (!isContained) {
                            returnToStash(matItem);
                          } else {
                            setPlacedItems(prev => prev.filter(p => p.id !== matItem.id));
                            setAvailableItems(prev => [...prev, matItem.item]);
                          }
                        }}
                      />
                    );
                  })}

                  {/* Container preview - show where item would be placed */}
                  {containerPreview && containerPreview.container.id === matItem.id && (
                    containerPreview.localCells.map((cell, i) => (
                      <div
                        key={`preview-${matItem.id}-${i}`}
                        className="absolute pointer-events-none"
                        style={{
                          left: (absolutePosition.x + cell.x) * INVENTORY_CELL_SIZE,
                          top: (absolutePosition.y + cell.y) * INVENTORY_CELL_SIZE,
                          width: INVENTORY_CELL_SIZE,
                          height: INVENTORY_CELL_SIZE,
                          backgroundColor: containerPreview.valid
                            ? 'rgba(74, 156, 91, 0.5)'
                            : 'rgba(220, 38, 38, 0.5)',
                          boxSizing: 'border-box',
                          zIndex: depth + 10
                        }}
                      />
                    ))
                  )}

                  {/* Hex grid overlay with interactive slots and placed tiles */}
                  {matItem.item.hexSlots && matItem.item.hexSlots.length > 0 && (() => {
                    const scale = INVENTORY_CELL_SIZE / CELL_SIZE;
                    const origW = matItem.item.width * CELL_SIZE;
                    const origH = matItem.item.height * CELL_SIZE;
                    const itemRot = absoluteRotation || 0;
                    const rotDeg = itemRot * 90;

                    // Rotated dimensions (for SVG sizing)
                    const isSwapped = itemRot === 1 || itemRot === 3;
                    const rotW = isSwapped ? origH : origW;
                    const rotH = isSwapped ? origW : origH;

                    // SVG transform: rotate around center, then translate to keep origin at top-left
                    let tx = 0, ty = 0;
                    if (itemRot === 1) { tx = origH; ty = 0; }
                    else if (itemRot === 2) { tx = origW; ty = origH; }
                    else if (itemRot === 3) { tx = 0; ty = origW; }

                    const hexRotation = matItem.item.hexRotation || 0;
                    const rotRad = (hexRotation * Math.PI) / 180;
                    const placedTiles = matItem.item.placedTiles || {};
                    const arcaneHue = 45;

                    // Helper to get edge midpoint
                    const getEdgePoint = (center, edgeIdx) => {
                      const angle1 = (Math.PI / 3) * edgeIdx + rotRad;
                      const angle2 = (Math.PI / 3) * ((edgeIdx + 1) % 6) + rotRad;
                      const c1x = center.x + HEX_SIZE * Math.cos(angle1);
                      const c1y = center.y + HEX_SIZE * Math.sin(angle1);
                      const c2x = center.x + HEX_SIZE * Math.cos(angle2);
                      const c2y = center.y + HEX_SIZE * Math.sin(angle2);
                      return { x: (c1x + c2x) / 2, y: (c1y + c2y) / 2 };
                    };

                    return (
                      <svg
                        className="absolute"
                        style={{
                          left: absolutePosition.x * INVENTORY_CELL_SIZE,
                          top: absolutePosition.y * INVENTORY_CELL_SIZE,
                          width: rotW,
                          height: rotH,
                          zIndex: (depth + 1) * 10,
                          overflow: 'visible',
                          transform: `scale(${scale})`,
                          transformOrigin: '0 0',
                          pointerEvents: 'none'
                        }}
                      >
                        {/* Rotate entire hex content as a group */}
                        <g transform={`translate(${tx}, ${ty}) rotate(${rotDeg})`}>
                          {matItem.item.hexSlots.map((slot, slotIdx) => {
                            const placedTile = placedTiles[slotIdx];
                            const isSlotHovered = hoveredSlot?.itemId === matItem.id && hoveredSlot?.slotIndex === slotIdx;
                            const hasSelectedTile = !!selectedTile;
                            const isFlipped = placedTile?.isFlipped;

                            // Slots are only interactive during action mode on target item
                            const isInteractive = isTargetItem && isInActionMode;
                            const showHoverEffect = isInteractive && isSlotHovered && hasSelectedTile;

                            // In extraction mode, show hover effect on syllable tiles
                            const canExtract = actionMode === 'extracting' && placedTile && !isFlipped &&
                                              placedTile.syllables && placedTile.syllables.length > 0;
                            const showExtractHover = isInteractive && isSlotHovered && canExtract;

                            // Get rotated flow lines if tile is placed (and not flipped)
                            const rotatedFlowLines = (placedTile && !isFlipped)
                              ? getRotatedFlowLines(placedTile.flowLines, placedTile.rotation || 0)
                              : [];

                            // Determine fill color
                            let slotFill;
                            if (isFlipped) {
                              slotFill = 'hsl(0, 0%, 75%)';  // Gray for flipped
                            } else if (placedTile) {
                              slotFill = `hsl(${arcaneHue}, 25%, 88%)`;
                            } else if (showHoverEffect) {
                              slotFill = 'rgba(147, 51, 234, 0.15)';
                            } else if (showExtractHover) {
                              slotFill = 'rgba(147, 51, 234, 0.2)';
                            } else {
                              slotFill = 'rgba(0,0,0,0.02)';
                            }

                            return (
                              <g key={slotIdx}>
                                {/* Clickable hex slot */}
                                <path
                                  d={hexToPath(slot.points)}
                                  fill={slotFill}
                                  stroke={showHoverEffect || showExtractHover ? '#9333ea' : (isTargetItem && isInActionMode ? '#d97706' : '#bbb')}
                                  strokeWidth={showHoverEffect || showExtractHover ? 2 : 1}
                                  strokeDasharray={placedTile && !isFlipped ? 'none' : '3,2'}
                                  style={{
                                    pointerEvents: isInteractive ? 'auto' : 'none',
                                    cursor: isInteractive && (hasSelectedTile || placedTile) ? 'pointer' : 'default'
                                  }}
                                  onClick={(e) => handleHexSlotClick(e, matItem.id, slotIdx)}
                                  onMouseEnter={() => setHoveredSlot({ itemId: matItem.id, slotIndex: slotIdx })}
                                  onMouseLeave={() => setHoveredSlot(null)}
                                />

                                {/* Port markers on external edges */}
                                {slot.portEdges?.map((edge) => {
                                  const angle1 = (Math.PI / 3) * edge + rotRad;
                                  const angle2 = (Math.PI / 3) * ((edge + 1) % 6) + rotRad;
                                  const c1x = slot.center.x + HEX_SIZE * Math.cos(angle1);
                                  const c1y = slot.center.y + HEX_SIZE * Math.sin(angle1);
                                  const c2x = slot.center.x + HEX_SIZE * Math.cos(angle2);
                                  const c2y = slot.center.y + HEX_SIZE * Math.sin(angle2);
                                  const midX = (c1x + c2x) / 2;
                                  const midY = (c1y + c2y) / 2;
                                  const outAngle = (Math.PI / 3) * edge + rotRad + Math.PI / 6;
                                  const portX = midX + 6 * Math.cos(outAngle);
                                  const portY = midY + 6 * Math.sin(outAngle);

                                  return (
                                    <g key={`port-${edge}`}>
                                      <line
                                        x1={midX} y1={midY}
                                        x2={portX} y2={portY}
                                        stroke="#666"
                                        strokeWidth={1.5}
                                      />
                                      <circle
                                        cx={portX + 3 * Math.cos(outAngle)}
                                        cy={portY + 3 * Math.sin(outAngle)}
                                        r={3}
                                        fill="#666"
                                      />
                                    </g>
                                  );
                                })}

                                {/* Render placed tile flow lines */}
                                {placedTile && rotatedFlowLines.map((flow, flowIdx) => {
                                  // Multi-way junction
                                  if (flow.isJunction && flow.edges) {
                                    return (
                                      <g key={flowIdx}>
                                        {flow.edges.map((edge, eIdx) => {
                                          const p = getEdgePoint(slot.center, edge);
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

                                  const p1 = getEdgePoint(slot.center, flow.edge1);

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

                                  // 2-way flow line
                                  const p2 = getEdgePoint(slot.center, flow.edge2);
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

                                {/* Flipped tile indicator */}
                                {isFlipped && (
                                  <g>
                                    <path
                                      d={hexToPath(createInnerHexagon(slot.center.x, slot.center.y, HEX_SIZE, hexRotation, 0.35))}
                                      fill="hsl(0, 0%, 60%)"
                                      stroke="hsl(0, 0%, 50%)"
                                      strokeWidth="1"
                                      strokeDasharray="2,2"
                                    />
                                    <text
                                      x={slot.center.x}
                                      y={slot.center.y}
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      fontSize="10"
                                      fill="#666"
                                    >
                                      ∅
                                    </text>
                                  </g>
                                )}

                                {/* Render syllables in placed tiles */}
                                {placedTile && !isFlipped && placedTile.syllables && placedTile.syllables.length > 0 && (
                                  <g>
                                    <path
                                      d={hexToPath(createInnerHexagon(slot.center.x, slot.center.y, HEX_SIZE, hexRotation, 0.38))}
                                      fill={`hsl(${arcaneHue}, 30%, 35%)`}
                                      stroke={`hsl(${arcaneHue}, 35%, 45%)`}
                                      strokeWidth="1.5"
                                    />
                                    {placedTile.syllables.length === 1 ? (
                                      <text
                                        x={slot.center.x}
                                        y={slot.center.y}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fontSize="12"
                                        fontWeight="bold"
                                        fill="#e8e4de"
                                      >
                                        {placedTile.syllables[0].syllable.symbol}
                                      </text>
                                    ) : (
                                      <>
                                        <text x={slot.center.x} y={slot.center.y - 5} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="bold" fill="#e8e4de">
                                          {placedTile.syllables[0].syllable.symbol}
                                        </text>
                                        <text x={slot.center.x} y={slot.center.y + 5} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="bold" fill="#e8e4de">
                                          {placedTile.syllables[1].syllable.symbol}
                                        </text>
                                      </>
                                    )}
                                  </g>
                                )}
                              </g>
                            );
                          })}
                        </g>
                      </svg>
                    );
                  })()}

                  {/* Item label */}
                  <div
                    className={`absolute text-xs font-medium px-1 rounded pointer-events-none ${
                      isContained
                        ? 'text-stone-600 bg-white/70'
                        : isTargetItem && isInActionMode
                          ? 'text-amber-800 bg-amber-100/90'
                          : isInvestigated
                            ? 'text-stone-700 bg-white/80'
                            : 'text-amber-700 bg-amber-50/90'
                    }`}
                    style={{
                      left: (absolutePosition.x + minX) * INVENTORY_CELL_SIZE + 2,
                      top: (absolutePosition.y + minY) * INVENTORY_CELL_SIZE + 2,
                      zIndex: depth + 1
                    }}
                  >
                    {!isInvestigated && !isContained && '🔍 '}
                    {matItem.item.name}
                    {isInvestigated && !isContained && ' ✓'}
                  </div>

                  {/* Action buttons - appear on hover for investigated items */}
                  {!isInActionMode && !isContained && isInvestigated && hoveredItemId === matItem.id && (
                    <div
                      className="absolute flex gap-1 pointer-events-auto"
                      style={{
                        left: (absolutePosition.x + minX) * INVENTORY_CELL_SIZE + 2,
                        top: (absolutePosition.y + minY) * INVENTORY_CELL_SIZE + 18,
                        zIndex: depth + 100
                      }}
                      onMouseEnter={() => setHoveredItemId(matItem.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                    >
                      {/* Study button - for items with empty slots */}
                      {getEmptySlotCount(matItem.item) > 0 && (
                        <button
                          className="px-2 py-1 text-xs font-medium bg-indigo-600 text-white rounded shadow-lg hover:bg-indigo-700 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            startStudying(matItem.id);
                          }}
                        >
                          📚 Study
                        </button>
                      )}
                      {/* Extract button - for items with syllable tiles */}
                      {hasSyllableTiles(matItem.item) && (
                        <button
                          className="px-2 py-1 text-xs font-medium bg-purple-600 text-white rounded shadow-lg hover:bg-purple-700 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            startExtracting(matItem.id);
                          }}
                        >
                          ⚗️ Extract
                        </button>
                      )}
                      {/* Destroy button */}
                      <button
                        className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded shadow-lg hover:bg-red-700 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlacedItems(prev => prev.filter(p => p.id !== matItem.id));
                          setHoveredItemId(null);
                        }}
                      >
                        🗑️ Destroy
                      </button>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Placement overlay - captures all mouse events during item placement */}
            {selectedItem && (
              <div
                className="absolute inset-0 cursor-pointer"
                style={{ zIndex: 100 }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.floor((e.clientX - rect.left) / INVENTORY_CELL_SIZE);
                  const y = Math.floor((e.clientY - rect.top) / INVENTORY_CELL_SIZE);
                  if (x >= 0 && x < gridSize.width && y >= 0 && y < gridSize.height) {
                    setHoverPos({ x, y });

                    // Use lookup table to find container at this position
                    const key = `${x},${y}`;
                    const containerInfo = cellLookup.get(key);

                    if (containerInfo) {
                      setContainerHover({
                        containerId: containerInfo.container.id,
                        // localPosition is already in UNROTATED coordinates from lookup
                        localPosition: { x: containerInfo.unrotatedLocalX, y: containerInfo.unrotatedLocalY }
                      });
                    } else {
                      setContainerHover(null);
                    }
                  }
                }}
                onMouseLeave={() => {
                  setHoverPos(null);
                  setContainerHover(null);
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.floor((e.clientX - rect.left) / INVENTORY_CELL_SIZE);
                  const y = Math.floor((e.clientY - rect.top) / INVENTORY_CELL_SIZE);
                  if (x >= 0 && x < gridSize.width && y >= 0 && y < gridSize.height) {
                    // Check if placing inside container
                    if (containerHover && containerPreview?.valid) {
                      const item = isMovingPlaced ? selectedItem.item : selectedItem;
                      const container = placedItems.find(p => p.id === containerHover.containerId);

                      if (container) {
                        // selectedRotation is absolute, compute relative rotation for storage
                        const containerMatItem = materializedItems.find(m => m.id === container.id);
                        const containerAbsRot = containerMatItem?.absoluteRotation ?? 0;
                        const relativeRotation = ((selectedRotation - containerAbsRot) % 4 + 4) % 4;

                        if (isMovingPlaced) {
                          // Move item into container
                          setPlacedItems(prev => prev.map(p =>
                            p.id === selectedItem.id
                              ? { ...p, containedIn: container.id, localPosition: containerHover.localPosition, position: null, rotation: relativeRotation }
                              : p
                          ));
                        } else {
                          // Place new item from stash into container and auto-start investigating
                          const newItemId = Math.random().toString(36).substr(2, 9);
                          setPlacedItems(prev => [...prev, {
                            id: newItemId,
                            item: selectedItem,
                            position: null,
                            rotation: relativeRotation,
                            containedIn: container.id,
                            localPosition: containerHover.localPosition
                          }]);
                          setAvailableItems(prev => prev.filter(i => i.id !== selectedItem.id));

                          // Auto-start investigation for newly placed items
                          dispatch({ type: 'START_INVESTIGATING', itemId: newItemId });
                        }
                        setSelectedItem(null);
                        setIsMovingPlaced(false);
                        setSelectedRotation(0);
                        setContainerHover(null);
                        return;
                      }
                    }
                    // Normal grid placement
                    handleGridClick(x, y);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  cancelSelection();
                }}
              />
            )}
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
      
      {/* Syllable Inventory */}
      {syllableInventory.length > 0 && (
        <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-stone-200">
          <h3 className="text-sm font-semibold text-stone-600 mb-2">
            Collected Syllables ({syllableInventory.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {syllableInventory.map((syl, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm"
                title={syl.syllable.name}
              >
                <span className="font-bold">{syl.syllable.symbol}</span>
                <span className="text-xs text-purple-600">{syl.syllable.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 text-sm text-stone-500">
        <p><strong>Items:</strong> Left-click to select/place • R to rotate • Right-click to return to stash • Esc to cancel</p>
        <p><strong>Investigation:</strong> Click 🔍 items to investigate • Draw tiles, place them, close all flow lines • Finish to complete</p>
        <p><strong>Actions:</strong> Hover investigated items for Study/Extract • Extraction flips tiles, collecting syllables</p>
      </div>
    </div>
  );
}

export { InventoryMode };
