import { useState } from 'react';
import { BlastForm } from './components/BlastForm';
import { ResultsView } from './components/ResultsView';

export default function App() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [alignWidth, setAlignWidth] = useState<number>(60);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setAlignWidth(Number(formData.get('align_width') || '60'));
    
    try {
      const res = await fetch('/api/blast', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit BLAST job');
      }
      
      setCurrentJobId(data.jobId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#fafaf9] overflow-hidden selection:bg-orange-200">
      <header className="h-14 bg-orange-600 flex items-center justify-between px-6 shadow-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-orange-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h1 className="text-white font-bold text-lg tracking-tight">
            BioBLAST Engine <span className="font-mono font-normal text-sm opacity-80">v2.4.0-build</span>
          </h1>
        </div>
        <div className="flex gap-4">
          {currentJobId && (
            <button
              onClick={() => setCurrentJobId(null)}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
            >
              New Search
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
           <BlastForm onSubmit={handleSubmit} isLoading={isLoading} />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          {!currentJobId ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-400 font-medium">
               Select sequence parameters and run BLASTN from the sidebar.
            </div>
          ) : (
            <ResultsView jobId={currentJobId} alignWidth={alignWidth} />
          )}
        </main>
      </div>
    </div>
  );
}
