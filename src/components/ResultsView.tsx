import React, { useState, useEffect } from 'react';
import { Download, Activity } from 'lucide-react';
import { Job, Query, Hit, QueryWithHits, HSP } from '../types';
import { GraphicViewer } from './GraphicViewer';
import { AlignmentViewer } from './AlignmentViewer';

interface ResultsViewProps {
  jobId: string;
  alignWidth: number;
}

export function ResultsView({ jobId, alignWidth }: ResultsViewProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<QueryWithHits | null>(null);
  const [selectedHspId, setSelectedHspId] = useState<number | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        setJob(data);

        if (data.status === 'completed') {
           clearInterval(interval);
           fetchQueries();
        } else if (data.status === 'error' || data.status === 'download_ready') {
           clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchJob();
    interval = setInterval(fetchJob, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  const fetchQueries = async () => {
    const res = await fetch(`/api/jobs/${jobId}/queries`);
    const data = await res.json();
    setQueries(data);
    if (data.length > 0) {
      handleQueryClick(data[0]);
    }
  };

  const handleQueryClick = async (query: Query) => {
    const res = await fetch(`/api/queries/${query.id}/hits`);
    const data = await res.json();
    setSelectedQuery({ ...query, hits: data.hits });
    setSelectedHspId(null);
  };

  const handleDownload = () => {
    window.open(`/api/jobs/${jobId}/download`, '_blank');
  };

  if (!job) return <div className="flex-1 flex items-center justify-center text-slate-400">Loading job status...</div>;

  if (job.status === 'running') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <div className="animate-spin text-orange-500 mb-4">
          <Activity size={48} />
        </div>
        <h2 className="text-xl font-medium text-slate-800">BLAST is running...</h2>
        <p className="text-slate-500 mt-2">Please wait while your sequence is being analyzed.</p>
      </div>
    );
  }

  if (job.status === 'error') {
    return (
      <div className="m-6 bg-red-50 p-6 rounded-xl border border-red-200">
         <h2 className="text-lg font-bold text-red-700 mb-2">Error Processing BLAST Job</h2>
         <p className="text-red-600">{job.error}</p>
      </div>
    );
  }

  if (job.status === 'download_ready') {
    return (
      <div className="m-6 bg-green-50 p-6 rounded-xl border border-green-200 text-center">
         <h2 className="text-xl font-bold text-green-800 mb-4">BLAST processing completed</h2>
         <p className="text-slate-700 mb-6">The result is ready for download. Display is skipped due to the "Download Only" setting.</p>
         <button onClick={handleDownload} className="inline-flex items-center px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-md transition-all">
            <Download size={18} className="mr-2" />
            Download Result XML
         </button>
      </div>
    );
  }

  return (
    <>
      <div className="h-12 border-b border-slate-200 bg-white flex items-center px-6 gap-6 shrink-0 overflow-x-auto">
        {queries.map((q) => (
          <div
            key={q.id}
            onClick={() => handleQueryClick(q)}
            className={`flex items-center h-full text-xs cursor-pointer border-b-2 ${
              selectedQuery?.id === q.id 
                ? 'border-orange-500 text-orange-600 font-bold' 
                : 'border-transparent text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <span className="px-2 truncate max-w-[200px]" title={q.query_def}>{q.query_def || `Query_${q.id}`} ({q.query_len}bp)</span>
          </div>
        ))}
        {queries.length > 0 && (
          <div className="ml-auto sticky right-0 bg-white pl-4">
            <button onClick={handleDownload} className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded flex items-center gap-1 border border-slate-200 shadow-sm">
              <Download size={14} />
              <span>Export XML</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {selectedQuery ? (
          <>
            <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
               <div className="flex items-center justify-between mb-4">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Graphic Summary</h2>
                 <span className="text-[10px] text-slate-400">{selectedQuery.hits.reduce((acc, h) => acc + h.hsps.length, 0)} Alignments found</span>
               </div>
               <GraphicViewer 
                   queryLen={selectedQuery.query_len} 
                   hsps={selectedQuery.hits.flatMap(h => h.hsps)} 
                   onHspClick={(hsp) => setSelectedHspId(selectedHspId === hsp.id ? null : hsp.id)}
                   selectedHspId={selectedHspId}
               />
            </section>

            <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">E-Value</th>
                        <th className="px-4 py-3">Identity</th>
                        <th className="px-4 py-3">Strand</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-100">
                       {selectedQuery.hits.flatMap((hit) => 
                          hit.hsps.map(hsp => {
                            const isOpen = selectedHspId === hsp.id;
                            return (
                              <React.Fragment key={hsp.id}>
                                <tr 
                                  onClick={() => setSelectedHspId(isOpen ? null : hsp.id)}
                                  className={`cursor-pointer transition-colors ${isOpen ? 'bg-orange-50/50' : 'hover:bg-slate-50'}`}
                                >
                                  <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[200px] xl:max-w-md" title={hit.hit_def}>{hit.hit_def || hit.hit_id}</td>
                                  <td className="px-4 py-3">{hsp.bit_score}</td>
                                  <td className="px-4 py-3 text-orange-600 font-bold">{hsp.evalue}</td>
                                  <td className="px-4 py-3">{hsp.identity}/{hsp.align_len} ({Math.round(hsp.identity/hsp.align_len*100)}%)</td>
                                  <td className="px-4 py-3">
                                     <span className={hsp.is_plus ? 'text-blue-600 font-bold' : 'text-red-600 font-bold'}>
                                        {hsp.is_plus ? 'Plus' : 'Minus'}
                                     </span>
                                  </td>
                                </tr>
                                {isOpen && (
                                  <tr className="bg-orange-50/30 border-l-2 border-l-orange-500">
                                     <td colSpan={5} className="px-4 py-4">
                                        <div className="mb-3 flex justify-between items-center">
                                           <span className="text-[10px] font-bold text-slate-400 uppercase">Alignment Details (Width: {alignWidth}bp)</span>
                                           <span className="text-[10px] font-mono text-slate-400">Identity: {(hsp.identity/hsp.align_len*100).toFixed(1)}% | Gaps: {hsp.align_len - hsp.identity}/{hsp.align_len}</span>
                                        </div>
                                        <AlignmentViewer 
                                            qseq={hsp.qseq}
                                            hseq={hsp.hseq}
                                            midline={hsp.midline}
                                            queryFrom={hsp.query_from}
                                            hitFrom={hsp.hit_from}
                                            isPlus={hsp.is_plus === 1}
                                            alignWidth={alignWidth}
                                        />
                                     </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                       )}
                    </tbody>
                 </table>
               </div>
               {selectedQuery.hits.length === 0 && (
                 <div className="p-8 text-center text-slate-500">No significant similarities found.</div>
               )}
            </section>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
             No queries loaded.
          </div>
        )}
      </div>

      <footer className="h-8 bg-slate-100 border-t border-slate-200 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Local BLAST Command Ready
          </span>
        </div>
        <div className="text-[10px] text-slate-400">
          SQLite Registry: blast_results.sqlite
        </div>
      </footer>
    </>
  );
}
