import { useState, useCallback } from 'react';
import { type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, FileText, Image as ImageIcon, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';

export function Upload() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setUploadState('uploading');
    setProgress(20);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Clean fetch call - no extra characters at the start
      const response = await fetch('http://127.0.0.1:5000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Server rejected the file");

      const data = await response.json();
      console.log("AI Analysis Complete:", data);

      setProgress(100);
      setTimeout(() => setUploadState('success'), 500);

    } catch (error) {
      console.error("Upload failed:", error);
      setUploadState('error');
    }
  };

  const resetUpload = () => {
    setUploadState('idle');
    setProgress(0);
    setFile(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold font-display text-white tracking-wide mb-2">Upload Dataset</h1>
        <p className="text-gray-400">Securely upload your data for poisoning analysis</p>
      </header>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-panel p-8 relative overflow-hidden"
      >
        {/* Animated Border Glow */}
        <div className={`absolute inset-0 border-2 rounded-xl transition-colors duration-300 pointer-events-none ${
          isDragging ? 'border-neon-blue shadow-[inset_0_0_30px_rgba(0,240,255,0.2)]' : 'border-transparent'
        }`} />

        <AnimatePresence mode="wait">
          {uploadState === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-16"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className={`p-6 rounded-full mb-6 transition-all duration-300 ${
                isDragging ? 'bg-neon-blue/20 scale-110' : 'bg-surface border border-border'
              }`}>
                <UploadCloud size={48} className={isDragging ? 'text-neon-blue text-glow-blue' : 'text-gray-400'} />
              </div>
              
              <h3 className="text-xl font-semibold mb-2">Drag & Drop your dataset here</h3>
              <p className="text-gray-400 mb-8">or click to browse from your computer</p>
              
              <label className="cursor-pointer relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-500"></div>
                <div className="relative px-8 py-3 bg-background rounded-lg border border-border hover:border-neon-blue/50 transition-colors flex items-center gap-2">
                  <span className="font-medium text-white">Select File</span>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                  accept=".csv,.json,.txt,image/*"
                />
              </label>

              <div className="flex gap-6 mt-12 text-sm text-gray-500">
                <div className="flex items-center gap-2"><FileSpreadsheet size={16} /> CSV / JSON</div>
                <div className="flex items-center gap-2"><ImageIcon size={16} /> Images</div>
                <div className="flex items-center gap-2"><FileText size={16} /> Text</div>
              </div>
            </motion.div>
          )}

          {uploadState === 'uploading' && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="relative w-32 h-32 mb-8">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(50,50,80,0.5)" strokeWidth="8" />
                  <motion.circle 
                    cx="50" cy="50" r="45" fill="none" 
                    stroke="#00f0ff" strokeWidth="8" 
                    strokeDasharray="283"
                    strokeDashoffset={283 - (283 * progress) / 100}
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-2xl font-bold font-mono text-neon-blue">{progress}%</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Uploading Dataset...</h3>
              <p className="text-gray-400 font-mono text-sm">{file?.name || 'dataset.csv'}</p>
              
              {/* Matrix-like data stream effect */}
              <div className="mt-8 flex gap-1 overflow-hidden h-10 w-64 opacity-30">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 bg-neon-blue rounded-full"
                    animate={{ height: ['20%', '100%', '20%'] }}
                    transition={{ duration: 1 + Math.random(), repeat: Infinity, delay: Math.random() }}
                  />
                ))}
              </div>
            </motion.div>
          )}
          {uploadState === 'success' && (
  <motion.div
    key="success"
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-16"
  >
    <div className="p-4 rounded-full bg-neon-blue/20 mb-6">
      <CheckCircle size={64} className="text-neon-blue text-glow-blue" />
    </div>
    <h3 className="text-2xl font-bold mb-2 text-white">Analysis Complete</h3>
    <p className="text-gray-400 mb-8 text-center max-w-md">
      Your dataset has been processed by the XGBoost Engine. 
      Check the console or your results dashboard for the full threat report.
    </p>
    
    <button 
      onClick={resetUpload}
      className="px-8 py-3 bg-neon-blue/20 border border-neon-blue text-neon-blue rounded-lg hover:bg-neon-blue/30 transition-all"
    >
      Scan Another Dataset
    </button>
  </motion.div>
)}

          {uploadState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="p-4 rounded-full bg-neon-red/20 mb-6"
              >
                <AlertCircle size={64} className="text-neon-red text-glow-red" />
              </motion.div>
              <h3 className="text-2xl font-bold mb-2 text-white">Service Unavailable</h3>
              <p className="text-gray-400 mb-8 text-center max-w-md">
                The deep scanning analysis engine is currently offline. Please try again later or contact support.
              </p>
              
              <div className="flex gap-4">
                <button 
                  onClick={resetUpload}
                  className="px-6 py-3 rounded-lg border border-border hover:bg-surface-hover transition-colors text-gray-300"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
