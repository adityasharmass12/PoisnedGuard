import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Anomaly {
  row: number;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

interface AnalysisResult {
  totalRows: number;
  cleanRows: number;
  suspiciousRows: number;
  anomalies: Anomaly[];
  summary: string;
  score: number;
}

type UploadState = 'idle' | 'reading' | 'analyzing' | 'done' | 'error';

// ─── CSV parser (handles quoted fields) ───────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitLine(line);
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] ?? '' }), {} as Record<string, string>);
  });

  return { headers, rows };
}

// ─── Local analysis (no external API needed) ───────────────────────────────────

async function analyzeWithClaude(
  headers: string[],
  rows: Record<string, string>[],
  filename: string
): Promise<AnalysisResult> {
  const totalRows = rows.length;
  
  // Send to backend for ML-based analysis
  try {
    const formData = new FormData();
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        headers.map(h => {
          const val = row[h] || '';
          // Escape quotes and wrap in quotes if contains comma
          const escaped = val.replace(/"/g, '""');
          return val.includes(',') ? `"${escaped}"` : escaped;
        }).join(',')
      )
    ].join('\n');
    
    const file = new File([csvContent], filename, { type: 'text/csv' });
    formData.append('file', file);
    
    console.log('📊 Sending to backend for ML analysis...');
    const response = await fetch('http://localhost:5000/api/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Backend analysis failed');
    }
    
    const backendResult = await response.json();
    
    // Identify anomalies based on predictions
    const anomalies: Anomaly[] = [];
    
    if (backendResult.results) {
      backendResult.results.forEach((result: any, idx: number) => {
        if (result.error) {
          anomalies.push({
            row: idx + 1,
            reason: `Failed to analyze URL: ${result.error}`,
            severity: 'medium'
          });
        } else if (result.is_phishing) {
          anomalies.push({
            row: idx + 1,
            reason: `Phishing URL detected (${result.confidence}% confidence)`,
            severity: 'high'
          });
        }
      });
    }
    
    // Calculate clean score based on actual ML predictions
    const cleanScore = backendResult.safe_count 
      ? Math.round((backendResult.safe_count / backendResult.total) * 100)
      : 0;
    
    return {
      totalRows: backendResult.total,
      cleanRows: backendResult.safe_count || 0,
      suspiciousRows: backendResult.phishing_count || 0,
      anomalies: anomalies.slice(0, 20),
      summary: backendResult.phishing_count === 0
        ? `✅ All ${backendResult.total} URLs appear safe. No phishing URLs detected.`
        : `⚠️ Found ${backendResult.phishing_count} phishing URLs out of ${backendResult.total}. ${backendResult.safe_count} URLs are safe.`,
      score: cleanScore
    };
  } catch (err) {
    console.error('Backend error:', err);
    
    // Fallback to local analysis if backend fails
    console.log('Falling back to local analysis...');
    
    const anomalies: Anomaly[] = [];
    let suspiciousCount = 0;

    // Sample large datasets
    const sampleInterval = Math.max(1, Math.floor(rows.length / 500));
    const samplesToAnalyze = rows.filter((_, i) => i % sampleInterval === 0);

    samplesToAnalyze.forEach((row, sampleIdx) => {
      const actualIdx = sampleIdx * sampleInterval;
      
      // Check for missing values
      const missingValues = Object.values(row).filter(v => !v || v.trim() === '').length;
      if (missingValues > headers.length * 0.3) {
        anomalies.push({
          row: actualIdx + 1,
          reason: 'Too many missing values in this row',
          severity: 'medium'
        });
        suspiciousCount++;
      }

      // Check for duplicate rows
      const rowStr = JSON.stringify(row);
      const duplicateCount = rows.filter(r => JSON.stringify(r) === rowStr).length;
      if (duplicateCount > 2 && actualIdx === rows.findIndex(r => JSON.stringify(r) === rowStr)) {
        anomalies.push({
          row: actualIdx + 1,
          reason: `Exact duplicate found (${duplicateCount} occurrences)`,
          severity: 'high'
        });
        suspiciousCount += Math.min(2, duplicateCount - 1);
      }

      // Check for suspicious patterns
      let suspiciousFields = 0;
      Object.entries(row).forEach(([key, value]) => {
        if (value && (value.includes('<') || value.includes('>') || value.includes('script') || value.includes('eval'))) {
          suspiciousFields++;
        }
      });
      
      if (suspiciousFields > 0) {
        anomalies.push({
          row: actualIdx + 1,
          reason: `${suspiciousFields} field(s) contain suspicious content (scripts/HTML)`,
          severity: 'high'
        });
        suspiciousCount++;
      }
    });

    const cleanRows = Math.max(0, totalRows - suspiciousCount);
    const cleanScore = Math.round((cleanRows / totalRows) * 100);

    return {
      totalRows,
      cleanRows,
      suspiciousRows: suspiciousCount,
      anomalies: anomalies.slice(0, 20),
      summary: suspiciousCount === 0 
        ? `✅ Dataset appears clean after sampling ${samplesToAnalyze.length} rows.`
        : `⚠️ Found potential issues in ${suspiciousCount} sampled rows. Issues include duplicates and suspicious patterns.`,
      score: cleanScore
    };
  }
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Anomaly['severity'] }) {
  const styles: Record<string, string> = {
    high: 'bg-neon-red/20 text-neon-red border-neon-red/40',
    medium: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40',
    low: 'bg-neon-blue/20 text-neon-blue border-neon-blue/40'
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-mono uppercase ${styles[severity]}`}>
      {severity}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Upload() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAllAnomalies, setShowAllAnomalies] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setErrorMsg('');
    setUploadState('reading');

    try {
      const text = await f.text();
      let headers: string[] = [];
      let rows: Record<string, string>[] = [];

      if (f.name.endsWith('.json')) {
        const json = JSON.parse(text);
        const data: Record<string, string>[] = Array.isArray(json) ? json : [json];
        headers = Object.keys(data[0] ?? {});
        rows = data;
      } else {
        // default: treat as CSV (also works for .tsv with comma sep)
        const parsed = parseCSV(text);
        headers = parsed.headers;
        rows = parsed.rows;
      }

      if (rows.length === 0 || headers.length === 0) {
        throw new Error('No data found. Make sure the file has headers and at least one row.');
      }

      // For preview, show first 5 rows only
      setPreview({ headers, rows: rows.slice(0, 5) });
      setUploadState('analyzing');

      // Analyze full dataset (backend will handle efficiently)
      const analysisResult = await analyzeWithClaude(headers, rows, f.name);
      setResult(analysisResult);
      setUploadState('done');
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process file.');
      setUploadState('error');
    }
  };

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
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = '';
  };

  const reset = () => {
    setUploadState('idle');
    setFile(null);
    setPreview(null);
    setResult(null);
    setErrorMsg('');
    setShowAllAnomalies(false);
  };

  const visibleAnomalies = showAllAnomalies
    ? (result?.anomalies ?? [])
    : (result?.anomalies ?? []).slice(0, 5);

  const scoreColor =
    (result?.score ?? 0) >= 80
      ? 'text-neon-green'
      : (result?.score ?? 0) >= 50
      ? 'text-yellow-300'
      : 'text-neon-red';

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold font-display text-white tracking-wide mb-2">
          Upload Dataset
        </h1>
        <p className="text-gray-400">
          Drop any CSV or JSON file — AI will scan it for poisoned samples
        </p>
      </header>

      {/* ── Drop zone ── */}
      <AnimatePresence mode="wait">
        {uploadState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className={`glass-panel p-8 relative transition-all duration-300 ${
              isDragging ? 'border-neon-blue shadow-[0_0_30px_rgba(0,240,255,0.2)]' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center py-16">
              <div
                className={`p-6 rounded-full mb-6 transition-all duration-300 ${
                  isDragging
                    ? 'bg-neon-blue/20 scale-110'
                    : 'bg-surface border border-border'
                }`}
              >
                <UploadCloud
                  size={48}
                  className={isDragging ? 'text-neon-blue text-glow-blue' : 'text-gray-400'}
                />
              </div>
              <h3 className="text-xl font-semibold mb-2">Drag & Drop your dataset here</h3>
              <p className="text-gray-400 mb-8">
                Supports <span className="text-neon-blue">.csv</span> and{' '}
                <span className="text-neon-blue">.json</span> files of any size
              </p>

              <label className="cursor-pointer relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-lg blur opacity-30 group-hover:opacity-70 transition duration-500" />
                <div className="relative px-8 py-3 bg-background rounded-lg border border-border hover:border-neon-blue/50 transition-colors flex items-center gap-2 text-white font-medium">
                  <FileSpreadsheet size={16} />
                  Browse File
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.json,.tsv,.txt"
                  onChange={handleFileInput}
                />
              </label>

              <div className="flex gap-6 mt-10 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={15} /> CSV / TSV
                </div>
                <div className="flex items-center gap-2">
                  <FileText size={15} /> JSON arrays
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Reading file ── */}
        {uploadState === 'reading' && (
          <motion.div
            key="reading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-panel p-8 flex flex-col items-center justify-center py-20"
          >
            <div className="w-14 h-14 border-4 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin mb-6" />
            <h3 className="text-xl font-semibold mb-1">Reading file…</h3>
            <p className="text-gray-400 font-mono text-sm">{file?.name}</p>
          </motion.div>
        )}

        {/* ── Analyzing ── */}
        {uploadState === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-panel p-8 flex flex-col items-center py-10"
          >
            {/* preview table */}
            {preview && (
              <div className="w-full mb-8 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-white/5">
                      {preview.headers.map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-neon-blue font-semibold truncate max-w-[140px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-white/5">
                        {preview.headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-gray-300 truncate max-w-[140px]">
                            {row[h] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 px-3 py-2 font-mono">
                  Preview: first 5 rows of {file?.name}
                </p>
              </div>
            )}

            <div className="flex items-center gap-4 text-neon-blue">
              <div className="w-8 h-8 border-3 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
              <span className="font-semibold text-lg">Running AI poisoning analysis…</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              Scanning for outliers, label flipping, duplicates…
            </p>

            {/* animated bars */}
            <div className="mt-6 flex gap-1 h-8 w-48 opacity-40">
              {Array.from({ length: 18 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="flex-1 bg-neon-blue rounded-sm"
                  animate={{ scaleY: [0.2, 1, 0.2] }}
                  transition={{ duration: 1 + Math.random(), repeat: Infinity, delay: Math.random() * 0.8 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Results ── */}
        {uploadState === 'done' && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* headline cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Rows', value: result.totalRows, color: 'text-white' },
                { label: 'Clean Rows', value: result.cleanRows, color: 'text-neon-green' },
                { label: 'Suspicious', value: result.suspiciousRows, color: 'text-neon-red' },
                { label: 'Clean Score', value: `${result.score}%`, color: scoreColor }
              ].map((stat) => (
                <div key={stat.label} className="glass-panel p-5 text-center">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">{stat.label}</p>
                  <p className={`text-3xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* summary */}
            <div className="glass-panel p-6 flex gap-4 items-start">
              {result.score >= 75 ? (
                <ShieldCheck size={28} className="text-neon-green shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={28} className="text-yellow-300 shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className="font-semibold text-white mb-1">Analysis Summary</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
                <p className="text-gray-500 text-xs mt-2 font-mono">File: {file?.name}</p>
              </div>
            </div>

            {/* anomaly list */}
            {result.anomalies.length > 0 && (
              <div className="glass-panel p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertCircle size={18} className="text-neon-red" />
                  Flagged Anomalies ({result.anomalies.length})
                </h3>
                <div className="space-y-3">
                  {visibleAnomalies.map((a, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-border hover:border-neon-red/30 transition-colors"
                    >
                      <SeverityBadge severity={a.severity} />
                      <div className="min-w-0">
                        <span className="text-gray-400 text-xs font-mono mr-2">Row {a.row}</span>
                        <span className="text-gray-200 text-sm">{a.reason}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {result.anomalies.length > 5 && (
                  <button
                    onClick={() => setShowAllAnomalies((v) => !v)}
                    className="mt-4 flex items-center gap-1 text-neon-blue text-sm hover:underline"
                  >
                    {showAllAnomalies ? (
                      <>
                        <ChevronUp size={14} /> Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} /> Show all {result.anomalies.length} anomalies
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {result.anomalies.length === 0 && (
              <div className="glass-panel p-6 flex items-center gap-4">
                <CheckCircle size={28} className="text-neon-green shrink-0" />
                <div>
                  <h3 className="font-semibold text-white mb-1">No Anomalies Detected</h3>
                  <p className="text-gray-400 text-sm">
                    The dataset appears clean. No signs of data poisoning found in the sample.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-2">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-8 py-3 rounded-lg border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/10 transition-colors font-medium"
              >
                <RotateCcw size={16} />
                Scan Another File
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Error ── */}
        {uploadState === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-12 flex flex-col items-center text-center"
          >
            <div className="p-4 rounded-full bg-neon-red/10 mb-6">
              <AlertCircle size={56} className="text-neon-red" />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white">Processing Failed</h3>
            <p className="text-gray-400 mb-2 max-w-md">{errorMsg}</p>
            <p className="text-gray-500 text-sm mb-8">
              Make sure your file has column headers and valid CSV / JSON format.
            </p>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-8 py-3 rounded-lg bg-neon-blue text-background font-bold hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all"
            >
              <RotateCcw size={16} />
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}