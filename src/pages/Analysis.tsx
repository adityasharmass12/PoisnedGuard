import { motion } from 'motion/react';
import { Cpu } from 'lucide-react';

export function Analysis() {
  return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel p-12 max-w-lg w-full flex flex-col items-center"
      >
        <div className="p-6 rounded-full bg-neon-purple/10 mb-6">
          <Cpu size={48} className="text-neon-purple text-glow-purple" />
        </div>
        <h2 className="text-2xl font-bold mb-4 text-white">Analysis Pending</h2>
        <p className="text-gray-400 mb-8">
          Upload a dataset to begin deep scanning and anomaly detection.
        </p>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'upload' }))}
          className="px-8 py-3 rounded-lg bg-neon-purple text-white font-bold hover:shadow-[0_0_20px_rgba(176,38,255,0.4)] transition-all btn-slide"
        >
          Upload Dataset
        </button>
      </motion.div>
    </div>
  );
}
