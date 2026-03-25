import { useState } from 'react';
import { motion } from 'motion/react';
import { Search } from 'lucide-react';

interface DashboardProps {
  onScanComplete?: (data: any) => void;
}

export function Dashboard({ onScanComplete }: DashboardProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeUrl = async (urlToCheck: string) => {
    // Use Flask backend instead of Claude API
    try {
      const response = await fetch('http://localhost:5000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToCheck })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `API error ${response.status}`);
      }

      const data = await response.json();
      return {
        is_phishing: data.is_phishing,
        confidence: data.confidence,
        reasons: data.is_phishing 
          ? ['URL matched phishing indicators in ML model']
          : ['URL appears to be legitimate'],
        url: urlToCheck
      };
    } catch (err) {
      console.error('Backend error:', err);
      // Fallback error message
      throw new Error(err instanceof Error ? err.message : 'Failed to connect to analysis server');
    }
  };

  const handleAnalysis = async () => {
    if (!url.trim()) {
      setError('Please enter a URL to check.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await analyzeUrl(url.trim());
      if (onScanComplete) onScanComplete(data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed. Please check the URL format and try again.');
    } finally {
      setLoading(false);
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

        <h2 className="text-2xl font-bold mb-1 text-white">Phishing Link Detector</h2>
        <p className="text-sm text-gray-400 mb-8">
          AI-powered · Accurate · Zero false positives on real sites
        </p>

        <div className="w-full mb-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalysis()}
            placeholder="https://example.com"
            className="w-full px-4 py-3 rounded-lg bg-background/50 border border-neon-blue/30 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue focus:ring-2 focus:ring-neon-blue/20 transition-colors"
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
          className="px-8 py-3 rounded-lg bg-neon-blue text-background font-bold hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all btn-slide disabled:opacity-50 disabled:cursor-not-allowed w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
              Analyzing with AI...
            </span>
          ) : (
            'Analyze URL'
          )}
        </button>

        <div className="mt-8 pt-6 border-t border-neon-blue/20 w-full">
          <p className="text-gray-500 text-sm">
            Or{' '}
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent('navigate', { detail: 'upload' }))
              }
              className="text-neon-blue hover:underline transition-colors"
            >
              upload a CSV dataset
            </button>{' '}
            for bulk poisoning detection
          </p>
        </div>
      </motion.div>
    </div>
  );
}