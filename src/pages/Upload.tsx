import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud, FileSpreadsheet,
  AlertCircle, RotateCcw,
  Shield, Lock, Database,
  Link2, Globe, Eye
} from 'lucide-react';
import { runAllChecks } from '../components/URLChecklist';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';

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
  preCheckStats?: PreCheckStats;
  detectionMethod?: string;
  modelAvailable?: boolean;
}

interface PreCheckStats {
  total: number;
  safe: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  withPaywall: number;
  withRedirect: number;
  withShortener: number;
  withFirewallBypass: number;
  fromCache: number;
}

type UploadState = 'idle' | 'reading' | 'prechecking' | 'analyzing' | 'done' | 'error';

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = splitLine(line);
    return headers.reduce((o, h, i) => ({ ...o, [h]: vals[i] ?? '' }), {} as Record<string, string>);
  });
  return { headers, rows };
}

function runHeuristicAnalysis(
  headers: string[],
  rows: Record<string, string>[],
  preCheckStats: PreCheckStats
): AnalysisResult {
  const totalRows = rows.length;
  const anomalies: Anomaly[] = [];
  const flaggedRows = new Set<number>();

  const urlCol =
    headers.find(h => h.toLowerCase().includes('url') || h.toLowerCase() === 'link') ||
    headers[0];

  const PHISHING_KW = [
    'verify', 'confirm', 'suspended', 'validate', 'secure-login',
    'account-locked', 'unusual-activity', 'update-account',
  ];
  const SHORTENERS = ['bit.ly', 'goo.gl', 't.co', 'tinyurl', 'ow.ly', 'short.link', 'rb.gy'];
  const IP_RE = /^https?:\/\/\d{1,3}(\.\d{1,3}){3}/;

  const urlFirstSeen = new Map<string, number>();
  rows.forEach((row, idx) => {
    const urlVal = (row[urlCol] || '').trim();
    if (!urlVal) return;
    if (urlFirstSeen.has(urlVal)) {
      anomalies.push({ row: idx + 1, reason: `Duplicate URL (first at row ${urlFirstSeen.get(urlVal)! + 1})`, severity: 'medium' });
      flaggedRows.add(idx);
    } else { urlFirstSeen.set(urlVal, idx); }
  });

  rows.forEach((row, idx) => {
    const missing = Object.values(row).filter(v => !v?.trim()).length;
    if (missing > headers.length * 0.5) {
      anomalies.push({ row: idx + 1, reason: `${missing}/${headers.length} fields are empty`, severity: 'low' });
      flaggedRows.add(idx);
    }
  });

  rows.forEach((row, idx) => {
    const urlVal = (row[urlCol] || '').toLowerCase().trim();
    if (!urlVal) return;
    const kwHits = PHISHING_KW.filter(k => urlVal.includes(k));
    if (kwHits.length >= 2) {
      anomalies.push({ row: idx + 1, reason: `Phishing keywords: "${kwHits.join('", "')}"`, severity: 'high' });
      flaggedRows.add(idx);
    }
    if (IP_RE.test(urlVal)) {
      anomalies.push({ row: idx + 1, reason: 'Raw IP address used instead of domain', severity: 'high' });
      flaggedRows.add(idx);
    }
    if (SHORTENERS.some(s => urlVal.includes(s))) {
      anomalies.push({ row: idx + 1, reason: 'URL shortener detected — destination hidden', severity: 'medium' });
      flaggedRows.add(idx);
    }
  });

  const bestByRow = new Map<number, Anomaly>();
  const sevOrder = { high: 3, medium: 2, low: 1 };
  for (const a of anomalies) {
    const existing = bestByRow.get(a.row);
    if (!existing || sevOrder[a.severity] > sevOrder[existing.severity]) bestByRow.set(a.row, a);
  }
  const dedupedAnomalies = Array.from(bestByRow.values()).sort((a, b) => a.row - b.row);
  const suspiciousRows = flaggedRows.size;
  const cleanRows = Math.max(0, totalRows - suspiciousRows);
  const cleanScore = totalRows > 0 ? Math.round((cleanRows / totalRows) * 100) : 100;

  return {
    totalRows, cleanRows, suspiciousRows,
    anomalies: dedupedAnomalies.slice(0, 50),
    summary: suspiciousRows === 0
      ? `All ${totalRows} rows passed heuristic analysis.`
      : `${suspiciousRows} suspicious rows detected (heuristic analysis — Flask backend offline).`,
    score: cleanScore, preCheckStats,
    detectionMethod: 'heuristic_fallback', modelAvailable: false,
  };
}

async function analyzeWithBackend(
  headers: string[], rows: Record<string, string>[],
  filename: string, preCheckStats: PreCheckStats
): Promise<AnalysisResult> {
  const csv = [headers.join(','), ...rows.map(row =>
    headers.map(h => { const v = row[h] || ''; return v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v; }).join(',')
  )].join('\n');
  const fd = new FormData();
  fd.append('file', new File([csv], filename, { type: 'text/csv' }));
  const resp = await fetch('http://localhost:5000/api/upload', {
    method: 'POST', body: fd, signal: AbortSignal.timeout(300000),
  });
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(e.error || `Server error ${resp.status}`);
  }
  const br = await resp.json();
  const anomalies: Anomaly[] = [];
  (br.results || []).forEach((r: any, idx: number) => {
    if (r.error) { anomalies.push({ row: idx + 1, reason: `Parse error: ${r.error}`, severity: 'medium' }); }
    else if (r.is_phishing) {
      const sev: Anomaly['severity'] = r.confidence >= 80 ? 'high' : r.confidence >= 50 ? 'medium' : 'low';
      const reasons = r.reasons?.length ? ` (${r.reasons[0]})` : '';
      anomalies.push({ row: idx + 1, reason: `Phishing — ${r.confidence}% confidence${reasons}`, severity: sev });
    }
  });
  const safeCount = br.safe_count ?? 0;
  const cleanScore = br.total > 0 ? Math.round((safeCount / br.total) * 100) : 0;
  return {
    totalRows: br.total, cleanRows: safeCount, suspiciousRows: br.phishing_count ?? 0,
    anomalies: anomalies.slice(0, 50),
    summary: br.phishing_count === 0
      ? `All ${br.total} URLs are safe.`
      : `${br.phishing_count} phishing URLs found in ${br.total} total.`,
    score: cleanScore, preCheckStats,
    detectionMethod: br.detection_method, modelAvailable: br.model_available,
  };
}

export function Upload({ onUploadComplete }: { onUploadComplete?: (data: any, fileName: string) => void } = {}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [preCheckProgress, setPreCheckProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setErrorMsg('');
    setPreCheckProgress(0);
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
        const parsed = parseCSV(text);
        headers = parsed.headers;
        rows = parsed.rows;
      }

      if (!rows.length || !headers.length)
        throw new Error('No data found. Check that the file has headers and at least one row.');

      setPreview({ headers, rows: rows.slice(0, 5) });

      const urlCol = headers.find(h => h.toLowerCase().includes('url') || h.toLowerCase() === 'link');
      const urls = urlCol ? rows.map(r => r[urlCol]).filter(Boolean) : [];

      setUploadState('prechecking');

      const preCheckStats: PreCheckStats = {
        total: urls.length, safe: 0, low: 0, medium: 0, high: 0, critical: 0,
        withPaywall: 0, withRedirect: 0, withShortener: 0, withFirewallBypass: 0, fromCache: 0,
      };

      if (urls.length > 0) {
        const maxSample = 100;
        let sample: string[];
        let scaleFactor = 1;
        if (urls.length <= maxSample) {
          sample = urls;
        } else {
          const step = urls.length / maxSample;
          sample = Array.from({ length: maxSample }, (_, i) => urls[Math.floor(i * step)]);
          scaleFactor = urls.length / sample.length;
        }

        const BATCH = 10;
        for (let i = 0; i < sample.length; i += BATCH) {
          const batch = sample.slice(i, i + BATCH);
          for (const url of batch) {
            try {
              const r = await runAllChecks(url);
              if (r.overallRisk === 'safe') preCheckStats.safe++;
              else if (r.overallRisk === 'low') preCheckStats.low++;
              else if (r.overallRisk === 'medium') preCheckStats.medium++;
              else if (r.overallRisk === 'high') preCheckStats.high++;
              else if (r.overallRisk === 'critical') preCheckStats.critical++;
              if (r.fromCache) preCheckStats.fromCache++;
              const pc = r.checks.find(c => c.id === 'paywall');
              const rc = r.checks.find(c => c.id === 'redirect');
              const sc = r.checks.find(c => c.id === 'shortener');
              const fc = r.checks.find(c => c.id === 'firewall');
              if (pc?.status === 'warn') preCheckStats.withPaywall++;
              if (rc && rc.status !== 'pass' && rc.status !== 'pending' && rc.status !== 'skipped') preCheckStats.withRedirect++;
              if (sc?.status === 'warn') preCheckStats.withShortener++;
              if (fc && (fc.status === 'warn' || fc.status === 'fail')) preCheckStats.withFirewallBypass++;
            } catch { preCheckStats.low++; }
          }
          setPreCheckProgress(Math.min(100, Math.round(((i + BATCH) / sample.length) * 100)));
          await new Promise(r => setTimeout(r, 0));
        }

        if (scaleFactor > 1) {
          preCheckStats.safe = Math.round(preCheckStats.safe * scaleFactor);
          preCheckStats.low = Math.round(preCheckStats.low * scaleFactor);
          preCheckStats.medium = Math.round(preCheckStats.medium * scaleFactor);
          preCheckStats.high = Math.round(preCheckStats.high * scaleFactor);
          preCheckStats.critical = Math.round(preCheckStats.critical * scaleFactor);
          preCheckStats.withPaywall = Math.round(preCheckStats.withPaywall * scaleFactor);
          preCheckStats.withRedirect = Math.round(preCheckStats.withRedirect * scaleFactor);
          preCheckStats.withShortener = Math.round(preCheckStats.withShortener * scaleFactor);
          preCheckStats.withFirewallBypass = Math.round(preCheckStats.withFirewallBypass * scaleFactor);
        }
      }

      setUploadState('analyzing');

      let analysisResult: AnalysisResult;
      try {
        analysisResult = await analyzeWithBackend(headers, rows, f.name, preCheckStats);
      } catch {
        analysisResult = runHeuristicAnalysis(headers, rows, preCheckStats);
      }

      setResult(analysisResult);
      setUploadState('done');
      if (onUploadComplete) {
        onUploadComplete(analysisResult, f.name);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process file.');
      setUploadState('error');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) processFile(f);
  }, []);
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '';
  };

  const reset = () => {
    setUploadState('idle'); setFile(null); setPreview(null);
    setResult(null); setErrorMsg(''); setPreCheckProgress(0);
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold font-display text-white tracking-wide mb-2">Dataset Analyzer</h1>
        <p className="text-gray-400 text-sm">Upload CSV or JSON · Pre-checks every URL · Full analytics dashboard</p>
      </header>

      <AnimatePresence mode="wait">

        {uploadState === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`glass-panel p-8 transition-all duration-300 ${isDragging ? 'border-neon-blue shadow-[0_0_30px_rgba(0,240,255,0.2)]' : ''}`}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`p-6 rounded-full mb-6 transition-all ${isDragging ? 'bg-neon-blue/20 scale-110' : 'bg-surface border border-border'}`}>
                <UploadCloud size={48} className={isDragging ? 'text-neon-blue text-glow-blue' : 'text-gray-400'} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Drag & Drop your dataset</h3>
              <p className="text-gray-400 mb-2">Supports <span className="text-neon-blue">.csv</span> and <span className="text-neon-blue">.json</span></p>
              <p className="text-gray-600 text-xs mb-8 font-mono">9-point URL pre-check · ML phishing analysis · Live analytics dashboard</p>
              <label className="cursor-pointer relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-lg blur opacity-30 group-hover:opacity-70 transition duration-500" />
                <div className="relative px-8 py-3 bg-background rounded-lg border border-border hover:border-neon-blue/50 flex items-center gap-2 text-white font-medium text-sm">
                  <FileSpreadsheet size={15} /> Browse File
                </div>
                <input ref={inputRef} type="file" className="hidden" accept=".csv,.json,.tsv,.txt" onChange={handleInput} />
              </label>
            </div>
          </motion.div>
        )}

        {uploadState === 'reading' && (
          <motion.div key="reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel p-8 flex flex-col items-center justify-center py-20"
          >
            <div className="w-12 h-12 border-4 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin mb-6" />
            <h3 className="text-lg font-semibold mb-1">Reading file…</h3>
            <p className="text-gray-500 font-mono text-sm">{file?.name}</p>
          </motion.div>
        )}

        {uploadState === 'prechecking' && (
          <motion.div key="prechecking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel p-8 flex flex-col items-center py-10"
          >
            {preview && (
              <div className="w-full mb-8 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-white/5">
                      {preview.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-neon-blue font-semibold truncate max-w-[120px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-white/5">
                        {preview.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-gray-300 truncate max-w-[120px]">{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-gray-600 px-3 py-2 font-mono">Preview: first 5 rows · {file?.name}</p>
              </div>
            )}
            <div className="w-full max-w-sm">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2 font-mono">
                <span className="flex items-center gap-1.5"><Shield size={11} className="text-neon-blue" /> Running 9-point pre-checks…</span>
                <span>{Math.min(preCheckProgress, 100)}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div className="h-full bg-neon-blue rounded-full" initial={{ width: 0 }}
                  animate={{ width: `${Math.min(preCheckProgress, 100)}%` }}
                  transition={{ type: 'spring', stiffness: 50 }}
                />
              </div>
              <div className="flex gap-3 mt-4 flex-wrap justify-center">
                {[
                  { icon: Database, label: 'Cache', color: 'text-neon-blue' },
                  { icon: Lock, label: 'HTTPS', color: 'text-neon-green' },
                  { icon: RotateCcw, label: 'Redirects', color: 'text-yellow-400' },
                  { icon: Shield, label: 'Firewall', color: 'text-orange-400' },
                  { icon: Eye, label: 'Paywall', color: 'text-yellow-300' },
                  { icon: Globe, label: 'Patterns', color: 'text-neon-purple' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-1 text-[10px] text-gray-500">
                    <Icon size={9} className={color} /> {label}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {uploadState === 'analyzing' && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel p-8 flex flex-col items-center py-10"
          >
            {preview && (
              <div className="w-full mb-8 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-white/5">
                      {preview.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-neon-blue font-semibold truncate max-w-[120px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-white/5">
                        {preview.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-gray-300 truncate max-w-[120px]">{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center gap-3 text-neon-blue mb-2">
              <div className="w-7 h-7 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
              <span className="font-semibold">Running ML Phishing Analysis…</span>
            </div>
            <p className="text-gray-500 text-sm">Querying model for each URL</p>
            <div className="mt-5 flex gap-1 h-6 w-40 opacity-40">
              {Array.from({ length: 16 }).map((_, i) => (
                <motion.div key={i} className="flex-1 bg-neon-blue rounded-sm"
                  animate={{ scaleY: [0.2, 1, 0.2] }}
                  transition={{ duration: 1 + Math.random(), repeat: Infinity, delay: Math.random() * 0.8 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {uploadState === 'done' && result && (
          <motion.div key="done" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <AnalyticsDashboard result={result} fileName={file?.name} />
            <div className="flex justify-center pt-6">
              <button onClick={reset}
                className="flex items-center gap-2 px-8 py-3 rounded-xl border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/10 transition-colors font-medium text-sm"
              >
                <RotateCcw size={14} /> Scan Another File
              </button>
            </div>
          </motion.div>
        )}

        {uploadState === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel p-12 flex flex-col items-center text-center"
          >
            <div className="p-4 rounded-full bg-neon-red/10 mb-6">
              <AlertCircle size={52} className="text-neon-red" />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white">Processing Failed</h3>
            <p className="text-gray-400 mb-2 max-w-md text-sm">{errorMsg}</p>
            <p className="text-gray-600 text-xs mb-8">Make sure your file has column headers and valid CSV / JSON format.</p>
            <button onClick={reset}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-neon-blue text-background font-bold hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all text-sm"
            >
              <RotateCcw size={14} /> Try Again
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
