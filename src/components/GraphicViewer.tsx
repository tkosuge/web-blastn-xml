import { useMemo, useState } from 'react';
import { HSP } from '../types';

export function GraphicViewer({ queryLen, hsps, onHspClick, selectedHspId }: { queryLen: number, hsps: HSP[], onHspClick: (hsp: HSP) => void, selectedHspId: number | null }) {
  const maxQuery = queryLen || Math.max(...hsps.map(h => Math.max(h.query_from, h.query_to)));
  
  if (!maxQuery) return null;

  return (
    <div className="relative h-48 bg-slate-50 border border-slate-100 rounded overflow-hidden p-2 pb-6">
       {/* Query Bar */}
       <div className="h-1 bg-slate-300 w-full mb-4 relative rounded-full">
         <span className="absolute -top-3 left-0 text-[9px] text-slate-400 font-bold uppercase">Query</span>
       </div>

       {/* HSP Bars */}
       <div className="space-y-2 overflow-y-auto h-full pb-8">
          {hsps.map((hsp) => {
            const start = Math.min(hsp.query_from, hsp.query_to);
            const end = Math.max(hsp.query_from, hsp.query_to);
            const left = (start / maxQuery) * 100;
            const width = ((end - start) / maxQuery) * 100;
            const selected = hsp.id === selectedHspId;

            let color = 'bg-red-500';
            if (hsp.bit_score < 40) color = 'bg-slate-800';
            else if (hsp.bit_score < 50) color = 'bg-blue-500';
            else if (hsp.bit_score < 80) color = 'bg-green-500';
            else if (hsp.bit_score < 200) color = 'bg-pink-500';

            return (
              <div key={hsp.id} className="relative h-2 w-full">
                <div
                  onClick={() => onHspClick(hsp)}
                  className={`absolute h-2 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-slate-400 ${color} ${selected ? 'ring-2 ring-orange-500 z-10' : ''}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`Score: ${hsp.bit_score}, E-val: ${hsp.evalue}`}
                />
              </div>
            );
          })}
       </div>

       {/* Axis */}
       <div className="absolute bottom-1 left-0 w-full flex justify-between px-2 text-[9px] font-mono text-slate-400 pointer-events-none">
          {[0, 0.25, 0.5, 0.75, 1].map(frac => (
            <span key={frac}>{Math.floor(maxQuery * frac)}</span>
          ))}
       </div>
    </div>
  );
}
