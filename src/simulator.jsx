import React, { useState } from 'react';
import { PuzzleMode } from './components/PuzzleMode.jsx';
import { InventoryMode } from './components/InventoryMode.jsx';

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
          Puzzle Mode
        </button>
      </div>
      <InventoryMode />
    </div>
  );
}
