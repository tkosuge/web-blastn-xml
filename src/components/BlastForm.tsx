import { FormEvent, useState, useRef } from 'react';
import { Play, AlertCircle } from 'lucide-react';

interface BlastFormProps {
  onSubmit: (formData: FormData) => void;
  isLoading: boolean;
}

export function BlastForm({ onSubmit, isLoading }: BlastFormProps) {
  const [sequence, setSequence] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.currentTarget);
    const size = file ? file.size : new Blob([sequence]).size;
    if (size === 0) {
      setError('Please enter a sequence or upload a file.');
      return;
    }
    if (size > 20 * 1024 * 1024) {
      setError('Sequence exceeds the 20MB limit.');
      return;
    }

    onSubmit(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setSequence('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Query Sequence</label>
        <textarea
          name="sequenceText"
          className="w-full h-32 p-2 text-xs font-mono border border-slate-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          placeholder=">Query_Name&#10;ATGCATGCATGC..."
          value={sequence}
          onChange={(e) => {
             setSequence(e.target.value);
             if (e.target.value) setFile(null);
             if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          disabled={!!file || isLoading}
        ></textarea>
        <div className="mt-2 flex justify-between items-center relative">
          <span className="text-[10px] text-slate-400">Limit: 20MB</span>
          <input
            type="file"
            name="sequenceFile"
            accept=".fa,.fasta,.txt"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            disabled={isLoading}
          />
          <label htmlFor="file-upload" className="text-[10px] font-bold text-orange-600 hover:underline cursor-pointer">
            {file ? file.name : 'Upload File'}
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="flex items-center text-red-600 bg-red-50 p-2 rounded text-[11px]">
             <AlertCircle size={14} className="mr-1 shrink-0" />
             {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Task</label>
            <select name="task" className="w-full text-xs border border-slate-200 p-1.5 rounded bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              <option value="megablast">megablast</option>
              <option value="blastn">blastn</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-Value</label>
            <select name="evalue" defaultValue="1e-5" className="w-full text-xs border border-slate-200 p-1.5 rounded bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              <option value="1e-5">1e-5</option>
              <option value="10">10</option>
              <option value="1">1</option>
              <option value="1e-50">1e-50</option>
              <option value="1e-100">1e-100</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Database</label>
          <select name="db" className="w-full text-xs border border-slate-200 p-1.5 rounded bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20">
            <option value="core_nt">core_nt</option>
            <option value="16S_ribosomal_RNA">16S_ribosomal_RNA</option>
          </select>
        </div>

        <div>
           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Entrez Taxid</label>
           <input type="text" name="taxid" className="w-full text-xs border border-slate-200 p-1.5 rounded focus:outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="e.g. 9606, 10090" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alignments</label>
            <input type="number" name="num_alignments" className="w-full text-xs border border-slate-200 p-1.5 rounded focus:outline-none focus:ring-2 focus:ring-orange-500/20" defaultValue="10" min="1" max="500" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Align Width</label>
            <select name="align_width" defaultValue="60" className="w-full text-xs border border-slate-200 p-1.5 rounded bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              <option value="60">60</option>
              <option value="90">90</option>
              <option value="120">120</option>
              <option value="150">150</option>
              <option value="180">180</option>
              <option value="210">210</option>
              <option value="240">240</option>
              <option value="270">270</option>
              <option value="300">300</option>
            </select>
          </div>
        </div>

        <div className="p-3 bg-orange-50 border border-orange-100 rounded">
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" name="downloadOnly" value="true" className="rounded border-orange-400 text-orange-600 focus:ring-orange-500 mt-0.5 shrink-0" />
            <span className="text-[11px] text-orange-800 font-medium leading-tight">Download results only (Disable screen, 1GB limit)</span>
          </label>
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 shrink-0 bg-white">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
          ) : (
             <Play size={16} className="shrink-0" />
          )}
          <span>{isLoading ? 'RUNNING...' : 'RUN BLASTN'}</span>
        </button>
      </div>
    </form>
  );
}
