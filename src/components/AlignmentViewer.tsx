export function AlignmentViewer({ qseq, hseq, midline, queryFrom, hitFrom, isPlus, alignWidth }: { qseq: string, hseq: string, midline: string, queryFrom: number, hitFrom: number, isPlus: boolean, alignWidth: number }) {
  const chunks = [];
  
  let qPos = queryFrom;
  let hPos = hitFrom;

  for (let i = 0; i < qseq.length; i += alignWidth) {
    const qChunk = qseq.slice(i, i + alignWidth);
    const hChunk = hseq.slice(i, i + alignWidth);
    const mChunk = midline.slice(i, i + alignWidth);

    const qGaps = (qChunk.match(/-/g) || []).length;
    const hGaps = (hChunk.match(/-/g) || []).length;
    
    const qStart = qPos;
    const qEnd = qPos + qChunk.length - qGaps - 1;
    qPos = qEnd + 1;

    const hStart = hPos;
    let hEnd;
    if (isPlus) {
       hEnd = hPos + hChunk.length - hGaps - 1;
       hPos = hEnd + 1;
    } else {
       hEnd = hPos - (hChunk.length - hGaps) + 1;
       hPos = hEnd - 1;
    }

    chunks.push({ qChunk, hChunk, mChunk, qStart, qEnd, hStart, hEnd });
  }

  return (
    <div className="font-mono text-[11px] leading-relaxed space-y-4 overflow-x-auto pb-2">
      {chunks.map((chunk, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-right w-24 shrink-0">Query {chunk.qStart}</span>
            <div className="bg-slate-100 px-2 py-1 rounded font-bold tracking-[0.2em] text-slate-800 break-all whitespace-pre-wrap">{chunk.qChunk}</div>
            <span className="text-slate-400 w-16 shrink-0">{chunk.qEnd}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="w-24 shrink-0"></span>
            <div className="px-2 py-1 tracking-[0.2em] text-slate-400 font-bold break-all whitespace-pre-wrap">{chunk.mChunk}</div>
            <span className="w-16 shrink-0"></span>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-slate-400 text-right w-24 shrink-0">Sbjct {chunk.hStart}</span>
             <div className="bg-slate-100 px-2 py-1 rounded font-bold tracking-[0.2em] text-slate-800 break-all whitespace-pre-wrap">{chunk.hChunk}</div>
             <span className="text-slate-400 w-16 shrink-0">{chunk.hEnd}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
