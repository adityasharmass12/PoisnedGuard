import { useState } from 'react';
import { motion } from 'motion/react';
import { Database, Search } from 'lucide-react';

interface DashboardProps {
  onScanComplete?: (data: any) => void;
}

export function Dashboard({ onScanComplete }: DashboardProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalysis = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:5000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        throw new Error('Backend error');
      }

      const data = await response.json();
      
      // Call the callback if provided
      if (onScanComplete) {
        onScanComplete(data);
      }
    } catch (err) {
      console.error("Backend error:", err);
      setError("Failed to analyze URL. Is the backend running on port 5000?");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAnalysis();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel p-12 max-w-lg w-full flex flex-col items-center"
      >
        <div className="p-6 rounded-full bg-neon-blue/10 mb-6">
          <Search size={48} className="text-neon-blue text-glow-blue" />
        </div>
        <h2 className="text-2xl font-bold mb-4 text-white">Phishing Link Detector</h2>
        <p className="text-gray-400 mb-8">
          Enter a URL to check if it's a phishing link
        </p>
        
        <div className="w-full mb-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="https://example.com"
            className="w-full px-4 py-3 rounded-lg bg-background/50 border border-neon-blue/30 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue focus:ring-2 focus:ring-neon-blue/50"
          />
        </div>

        {error && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-neon-red mb-4 text-sm"
          >
            {error}
          </motion.p>
        )}

        <button 
          onClick={handleAnalysis}
          disabled={loading}
          className="px-8 py-3 rounded-lg bg-neon-blue text-background font-bold hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all btn-slide disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Analyzing..." : "Check Link"}
        </button>

        <div className="mt-8 pt-8 border-t border-neon-blue/20">
          <p className="text-gray-500 text-sm">
            Or{' '}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'upload' }))}
              className="text-neon-blue hover:text-neon-cyan transition-colors underline"
            >
              upload a dataset
            </button>
            {' '}to initialize the dashboard
          </p>
        </div>
      </motion.div>
    </div>
  );
}