import React, { useState, useCallback, useMemo } from 'react';
import { INVENTORY_CELL_SIZE } from '../constants.js';
import { FLOW_GROUPS } from '../data/catalog.js';
import { generateInventoryItem } from '../utils/items.js';
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
        // Move existing item (update position and rotation, clear container reference if any)
        setPlacedItems(prev => prev.map(p =>
          p.id === selectedItem.id
            ? { ...p, position, rotation: selectedRotation, containedIn: null, localPosition: null }
            : p
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
              const solidBg = isContained ? '#e8e4de' : '#f5f2ed';
              const solidBorder = isContained ? '#6b6560' : '#8b8680';

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

                  {/* Item label */}
                  <div
                    className={`absolute text-xs font-medium bg-white/80 px-1 rounded pointer-events-none ${isContained ? 'text-stone-600 bg-white/70' : 'text-stone-700'}`}
                    style={{
                      left: (absolutePosition.x + minX) * INVENTORY_CELL_SIZE + 2,
                      top: (absolutePosition.y + minY) * INVENTORY_CELL_SIZE + 2,
                      zIndex: depth + 1
                    }}
                  >
                    {matItem.item.name}
                  </div>
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
                          // Place new item from stash into container
                          setPlacedItems(prev => [...prev, {
                            id: Math.random().toString(36).substr(2, 9),
                            item: selectedItem,
                            position: null,
                            rotation: relativeRotation,
                            containedIn: container.id,
                            localPosition: containerHover.localPosition
                          }]);
                          setAvailableItems(prev => prev.filter(i => i.id !== selectedItem.id));
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
      
      {/* Instructions */}
      <div className="mt-6 text-sm text-stone-500">
        <p><strong>Controls:</strong> Left-click to select/place • R to rotate • Right-click to return to stash • Esc to cancel</p>
      </div>
    </div>
  );
}

export { InventoryMode };
