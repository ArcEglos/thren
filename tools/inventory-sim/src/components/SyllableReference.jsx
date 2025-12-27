import React from 'react';
import { FLOW_GROUPS, ARCANE_SYLLABLES } from '../data/catalog.js';

export function SyllableReference() {
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
