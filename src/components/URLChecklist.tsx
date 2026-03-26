import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  Shield, Link2, Lock, Globe, Database, RotateCcw,
  Eye, Info, Clock
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckStatus = 'pending' | 'running' | 'pass' | 'fail' | 'warn' | 'info' | 'skipped';

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

export interface ChecklistResult {
  url: string;
  checks: CheckResult[];
  overallRisk: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  warnings: string[];
  fromCache: boolean;
  cachedAt?: Date;
  shouldRunML: boolean;
  hasMandatoryWarning: boolean;
  mandatoryWarnings: string[];
}

// ─── Module-level persistent cache ───────────────────────────────────────────

interface CacheEntry {
  result: ChecklistResult;
  cachedAt: Date;
  ttlMinutes: number;
}

const URL_CACHE = new Map<string, CacheEntry>();

export function getCached(url: string): ChecklistResult | null {
  const entry = URL_CACHE.get(url);
  if (!entry) return null;
  const ageMin = (Date.now() - entry.cachedAt.getTime()) / 60000;
  if (ageMin > entry.ttlMinutes) { URL_CACHE.delete(url); return null; }
  return { ...entry.result, fromCache: true, cachedAt: entry.cachedAt };
}

function setCache(result: ChecklistResult) {
  URL_CACHE.set(result.url, {
    result,
    cachedAt: new Date(),
    ttlMinutes: result.overallRisk === 'safe' ? 30 : 5,
  });
}

export function getCacheStats() {
  return {
    total: URL_CACHE.size,
    safe: [...URL_CACHE.values()].filter(e => e.result.overallRisk === 'safe').length,
    flagged: [...URL_CACHE.values()].filter(e => e.result.overallRisk !== 'safe').length,
  };
}

export function clearCache() { URL_CACHE.clear(); }

// ─── Domain / pattern lists ───────────────────────────────────────────────────

const TRUSTED = new Set([
  'google.com','github.com','facebook.com','twitter.com','x.com','linkedin.com',
  'stackoverflow.com','reddit.com','wikipedia.org','youtube.com','amazon.com',
  'ebay.com','paypal.com','microsoft.com','apple.com','adobe.com','dropbox.com',
  'slack.com','gmail.com','outlook.com','yahoo.com','protonmail.com','github.io',
  'cloudflare.com','npmjs.com','pypi.org','docker.com','mozilla.org','w3.org',
  'medium.com','dev.to','hashnode.com','substack.com','anthropic.com','openai.com',
]);

const SHORTENERS = new Set([
  'bit.ly','goo.gl','t.co','tinyurl.com','ow.ly','short.link','rb.gy','cutt.ly',
  'tiny.cc','is.gd','buff.ly','ift.tt','dlvr.it','snip.ly','youtu.be','amzn.to',
]);

const PAYWALL_MAP = new Map<string, string>([
  ['wsj.com','Wall Street Journal'],['nytimes.com','New York Times'],
  ['ft.com','Financial Times'],['bloomberg.com','Bloomberg'],
  ['economist.com','The Economist'],['wired.com','Wired'],
  ['hbr.org','Harvard Business Review'],['theathletic.com','The Athletic'],
  ['washingtonpost.com','Washington Post'],['thetimes.co.uk','The Times UK'],
  ['telegraph.co.uk','The Telegraph'],['businessinsider.com','Business Insider'],
]);

const PAYWALL_PATHS = ['/subscribe','/subscription','/premium','/membership','/paywall','/join'];

const REDIRECT_PARAMS = ['url=','redirect=','goto=','next=','return=','returnurl=','forward=','link=','target=','continue='];

const PHISHING_PATTERNS = [
  /paypa1\./i, /g00gle\./i, /faceb00k\./i, /amaz0n\./i,
  /mircosoft\./i, /secure.*login.*\.(xyz|tk|ml|ga|cf)/i,
  /(?:login|signin|account).*(?:paypal|amazon|apple).*\.(?!com|net|org)/i,
];

const SUSPICIOUS_KW = [
  'verify','confirm','update-account','suspended','validate',
  'secure-login','account-locked','unusual-activity',
];

// ─── Core check logic (pure, no state) ───────────────────────────────────────

export async function runAllChecks(url: string): Promise<ChecklistResult> {
  const cached = getCached(url);
  if (cached) return cached;

  const checks: CheckResult[] = [];
  const warnings: string[] = [];
  const mandatory: string[] = [];
  let risk = 0;
  let parsed: URL | null = null;

  const stats = getCacheStats();

  // 1. Cache
  checks.push({
    id: 'cache', label: 'Cache Lookup', status: 'info',
    detail: `Not cached · ${stats.total} URLs in session cache (${stats.safe} safe, ${stats.flagged} flagged)`,
  });

  // 2. Format
  try {
    parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
    checks.push({
      id: 'format', label: 'URL Format', status: 'pass',
      detail: `Valid · ${parsed.protocol}//${parsed.hostname}${parsed.port ? ':'+parsed.port : ''}`,
    });
  } catch {
    checks.push({ id: 'format', label: 'URL Format', status: 'fail', detail: 'Malformed URL — cannot be parsed safely' });
    risk += 30; warnings.push('URL is malformed');
    ['https','redirect','shortener','firewall','paywall','patterns','trailing'].forEach(id =>
      checks.push({ id, label: id, status: 'skipped', detail: 'Skipped — URL invalid' })
    );
    const result: ChecklistResult = { url, checks, overallRisk: 'critical', riskScore: risk, warnings, fromCache: false, shouldRunML: false, hasMandatoryWarning: false, mandatoryWarnings: [] };
    setCache(result); return result;
  }

  // 3. HTTPS
  if (parsed.protocol === 'https:') {
    checks.push({ id: 'https', label: 'HTTPS / TLS', status: 'pass', detail: 'Secure TLS connection' });
  } else {
    checks.push({ id: 'https', label: 'HTTPS / TLS', status: 'warn', detail: 'Unencrypted HTTP — data in plaintext' });
    risk += 10; warnings.push('No HTTPS — connection is unencrypted');
  }

  // 4. Redirects
  const search = parsed.search.toLowerCase();
  const rParams = REDIRECT_PARAMS.filter(p => search.includes(p));
  const hasTrail = parsed.pathname === '/' || parsed.pathname.endsWith('/') || parsed.pathname === '';
  if (rParams.length > 1) {
    checks.push({ id: 'redirect', label: 'Redirect Check', status: 'fail', detail: `Redirect chain: ${rParams.join(', ')} — likely open redirect attack` });
    risk += 25; warnings.push(`Open redirect chain: ${rParams.join(', ')}`);
  } else if (rParams.length === 1) {
    checks.push({ id: 'redirect', label: 'Redirect Check', status: 'warn', detail: `Redirect param "${rParams[0]}" — may forward to another domain` });
    risk += 10; warnings.push(`Redirect parameter: "${rParams[0]}"`);
  } else {
    checks.push({ id: 'redirect', label: 'Redirect Check', status: 'pass', detail: `No redirect params · ${hasTrail ? 'Trailing slash ✓' : 'No trailing slash (may trigger server redirect)'}` });
  }

  // 5. URL Shortener
  const isShort = [...SHORTENERS].some(s => parsed!.hostname === s || parsed!.hostname.endsWith('.'+s));
  if (isShort) {
    checks.push({ id: 'shortener', label: 'URL Shortener', status: 'warn', detail: `${parsed.hostname} hides real destination — cannot verify without following link` });
    risk += 15; warnings.push(`URL shortener (${parsed.hostname}) obscures true destination`);
  } else {
    checks.push({ id: 'shortener', label: 'URL Shortener', status: 'pass', detail: 'Not a shortener — destination visible' });
  }

  // 6. Firewall indicators
  const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname);
  const badPort = parsed.port && !['80','443','8080','8443','3000','3001','5000','5173','4173'].includes(parsed.port);
  const multiEnc = (url.match(/%[0-9a-fA-F]{2}/g) || []).length > 3;
  const isTor = parsed.hostname.endsWith('.onion');

  if (isTor) {
    checks.push({ id: 'firewall', label: 'Firewall Bypass', status: 'warn', detail: 'Tor .onion — bypasses standard network monitoring, requires Tor Browser' });
    risk += 10; warnings.push('Tor hidden service bypasses conventional firewalls');
  } else if (multiEnc) {
    checks.push({ id: 'firewall', label: 'Firewall Bypass', status: 'fail', detail: 'Excessive URL encoding — common evasion technique for content filters' });
    risk += 20; warnings.push('Multiple URL encodings suggest firewall evasion');
  } else if (isIP && badPort) {
    checks.push({ id: 'firewall', label: 'Firewall Bypass', status: 'fail', detail: `Raw IP ${parsed.hostname} + port ${parsed.port} — bypasses DNS filtering AND port-based rules` });
    risk += 25; warnings.push(`IP + non-standard port ${parsed.port} bypasses DNS & port firewalls`);
  } else if (isIP) {
    checks.push({ id: 'firewall', label: 'Firewall Bypass', status: 'warn', detail: `IP address ${parsed.hostname} skips DNS-based filtering` });
    risk += 15; warnings.push('Raw IP address bypasses DNS firewall rules');
  } else if (badPort) {
    checks.push({ id: 'firewall', label: 'Firewall Bypass', status: 'warn', detail: `Port ${parsed.port} may bypass port-based network controls` });
    risk += 8; warnings.push(`Non-standard port ${parsed.port} may evade filtering`);
  } else {
    checks.push({ id: 'firewall', label: 'Firewall Bypass', status: 'pass', detail: 'No firewall evasion indicators' });
  }

  // 7. Paywall
  let pwName: string | null = null;
  for (const [d, n] of PAYWALL_MAP) {
    if (parsed.hostname.endsWith(d)) { pwName = n; break; }
  }
  const pwPath = PAYWALL_PATHS.some(p => parsed!.pathname.toLowerCase().startsWith(p));
  if (pwName) {
    checks.push({ id: 'paywall', label: 'Paywall', status: 'warn', detail: `${pwName} requires a paid subscription — link may be inaccessible` });
    mandatory.push(`⚠️ Paywall Warning: This URL leads to ${pwName}, which requires a paid subscription. Recipients may not be able to access the content.`);
  } else if (pwPath) {
    checks.push({ id: 'paywall', label: 'Paywall', status: 'warn', detail: `Path "${parsed.pathname}" suggests premium/gated content` });
    mandatory.push('⚠️ Possible Paywall: This URL suggests subscription or premium-gated content. Verify access before sharing.');
  } else {
    checks.push({ id: 'paywall', label: 'Paywall', status: 'pass', detail: 'No paywall detected' });
  }

  // 8. Patterns
  const isTrusted = [...TRUSTED].some(d => parsed!.hostname === d || parsed!.hostname.endsWith('.'+d));
  const matchPhish = PHISHING_PATTERNS.some(p => p.test(parsed!.hostname) || p.test(url));
  const urlLow = url.toLowerCase();
  const kwHits = SUSPICIOUS_KW.filter(k => urlLow.includes(k));
  const manyDots = (parsed.hostname.match(/\./g)||[]).length > 4;
  const longSub = parsed.hostname.split('.').some(p => p.length > 30);

  if (isTrusted) {
    checks.push({ id: 'patterns', label: 'Pattern Analysis', status: 'pass', detail: `${parsed.hostname} is a verified trusted domain` });
  } else if (matchPhish) {
    checks.push({ id: 'patterns', label: 'Pattern Analysis', status: 'fail', detail: 'Matches known phishing patterns — likely impersonating a trusted brand' });
    risk += 40; warnings.push('Matches known phishing domain pattern');
  } else if (kwHits.length >= 2) {
    checks.push({ id: 'patterns', label: 'Pattern Analysis', status: 'fail', detail: `Phishing keywords: "${kwHits.join('", "')}"` });
    risk += 20; warnings.push(`Multiple phishing keywords: ${kwHits.join(', ')}`);
  } else if (manyDots || longSub || kwHits.length === 1) {
    checks.push({ id: 'patterns', label: 'Pattern Analysis', status: 'warn',
      detail: [manyDots&&'excessive subdomains', longSub&&'very long subdomain', kwHits[0]&&`keyword "${kwHits[0]}"`].filter(Boolean).join(', ') });
    risk += 10;
  } else {
    checks.push({ id: 'patterns', label: 'Pattern Analysis', status: 'pass', detail: 'No suspicious patterns' });
  }

  // 9. Path structure / trailing slash
  const path = parsed.pathname;
  let trailStatus: CheckStatus = 'pass', trailDetail = '';
  if (!path || path === '/') { trailDetail = 'Root URL — no ambiguity'; }
  else if (/\.[a-z]{2,5}(\?|#|$)/i.test(path)) { trailDetail = 'File resource — trailing slash not expected'; trailStatus = 'info'; }
  else if (path.endsWith('/')) { trailDetail = 'Directory URL with trailing slash ✓'; }
  else { trailDetail = 'Path ends without slash — server may issue 301 redirect'; trailStatus = 'info'; }
  checks.push({ id: 'trailing', label: 'Path Structure', status: trailStatus, detail: trailDetail });

  // Compute overall risk
  let overall: ChecklistResult['overallRisk'];
  if (risk >= 50) overall = 'critical';
  else if (risk >= 30) overall = 'high';
  else if (risk >= 15) overall = 'medium';
  else if (risk > 0) overall = 'low';
  else overall = 'safe';

  const result: ChecklistResult = {
    url, checks, overallRisk: overall, riskScore: risk, warnings,
    fromCache: false, shouldRunML: overall !== 'safe',
    hasMandatoryWarning: mandatory.length > 0,
    mandatoryWarnings: mandatory,
  };
  setCache(result);
  return result;
}

// ─── Visual config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<CheckStatus, { icon: any; color: string; bg: string; border: string }> = {
  pending:  { icon: Clock,        color: 'text-gray-500',   bg: 'bg-gray-900/40',      border: 'border-gray-800' },
  running:  { icon: Loader2,      color: 'text-neon-blue',  bg: 'bg-neon-blue/5',      border: 'border-neon-blue/30' },
  pass:     { icon: CheckCircle2, color: 'text-neon-green', bg: 'bg-neon-green/5',     border: 'border-neon-green/20' },
  fail:     { icon: XCircle,      color: 'text-neon-red',   bg: 'bg-neon-red/10',      border: 'border-neon-red/30' },
  warn:     { icon: AlertTriangle,color: 'text-yellow-400', bg: 'bg-yellow-400/10',    border: 'border-yellow-400/30' },
  info:     { icon: Info,         color: 'text-neon-blue',  bg: 'bg-neon-blue/5',      border: 'border-neon-blue/20' },
  skipped:  { icon: Clock,        color: 'text-gray-700',   bg: 'bg-gray-900/20',      border: 'border-gray-900' },
};

const CHECK_META: Record<string, { label: string; icon: any }> = {
  cache:     { label: 'Cache Lookup',     icon: Database },
  format:    { label: 'URL Format',       icon: Link2 },
  https:     { label: 'HTTPS / TLS',      icon: Lock },
  redirect:  { label: 'Redirect Check',   icon: RotateCcw },
  shortener: { label: 'URL Shortener',    icon: Link2 },
  firewall:  { label: 'Firewall Bypass',  icon: Shield },
  paywall:   { label: 'Paywall',          icon: Eye },
  patterns:  { label: 'Pattern Analysis', icon: AlertTriangle },
  trailing:  { label: 'Path Structure',   icon: Globe },
};

const RISK_BADGE: Record<string, string> = {
  safe:     'text-neon-green  border-neon-green/30  bg-neon-green/10',
  low:      'text-yellow-300  border-yellow-300/30  bg-yellow-300/10',
  medium:   'text-orange-400  border-orange-400/30  bg-orange-400/10',
  high:     'text-neon-red    border-neon-red/30    bg-neon-red/10',
  critical: 'text-neon-red    border-neon-red/50    bg-neon-red/20',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface URLChecklistProps {
  url: string;
  onComplete?: (result: ChecklistResult) => void;
  compact?: boolean;
}

const CHECK_ORDER = ['cache','format','https','redirect','shortener','firewall','paywall','patterns','trailing'];

export function URLChecklist({ url, onComplete, compact = false }: URLChecklistProps) {
  const [items, setItems] = useState<CheckResult[]>(
    CHECK_ORDER.map(id => ({ id, label: CHECK_META[id].label, status: 'pending' as CheckStatus }))
  );
  const [result, setResult] = useState<ChecklistResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!url || ran.current) return;
    ran.current = true;

    const go = async () => {
      // Check cache instantly
      const cached = getCached(url);
      if (cached) {
        setItems(cached.checks.length === CHECK_ORDER.length ? cached.checks : items);
        setResult(cached);
        if (cached.hasMandatoryWarning) setShowModal(true);
        else onComplete?.(cached);
        return;
      }

      // Animate through checks
      for (let i = 0; i < CHECK_ORDER.length; i++) {
        const id = CHECK_ORDER[i];
        setItems(prev => prev.map(c => c.id === id ? { ...c, status: 'running' } : c));
        await new Promise(r => setTimeout(r, 80 + Math.random() * 220));
      }

      // Run all checks
      const full = await runAllChecks(url);
      setItems(full.checks);
      setResult(full);

      if (full.hasMandatoryWarning) setShowModal(true);
      else onComplete?.(full);
    };

    go();
  }, [url]);

  const handleAck = () => {
    setShowModal(false);
    if (result) onComplete?.(result);
  };

  return (
    <>
      {/* Mandatory warning modal */}
      <AnimatePresence>
        {showModal && result && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="glass-panel p-8 max-w-md w-full"
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="p-3 rounded-xl bg-yellow-400/20 border border-yellow-400/30">
                  <AlertTriangle size={24} className="text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Before You Continue</h3>
                  <p className="text-gray-500 text-sm">Please read the following warning</p>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {result.mandatoryWarnings.map((w, i) => (
                  <div key={i} className="p-4 rounded-xl bg-yellow-400/10 border border-yellow-400/25 text-yellow-200 text-sm leading-relaxed">
                    {w}
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAck}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 font-semibold hover:bg-yellow-400/30 transition-colors text-sm"
                >
                  I Understand, Continue
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {/* Risk badge */}
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-mono ${RISK_BADGE[result.overallRisk]}`}
          >
            <span className="font-bold uppercase tracking-wider">
              {result.overallRisk === 'safe' ? '✓ Pre-checks Passed' : `Risk: ${result.overallRisk.toUpperCase()}`}
            </span>
            <span className="opacity-60 flex items-center gap-2">
              {result.fromCache && <><Database size={10} /> cached ·</>}
              score {result.riskScore}
            </span>
          </motion.div>
        )}

        {/* Check items */}
        <div className={compact ? 'grid grid-cols-2 gap-1' : 'space-y-1'}>
          {items.map((item, i) => {
            const cfg = STATUS_CFG[item.status];
            const meta = CHECK_META[item.id] || { label: item.label, icon: Shield };
            const MetaIcon = meta.icon;
            const StatusIcon = cfg.icon;
            const spinning = item.status === 'running';

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025 }}
                className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-all duration-200 ${cfg.bg} ${cfg.border}`}
              >
                <div className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>
                  {spinning
                    ? <Loader2 size={13} className="animate-spin" />
                    : <StatusIcon size={13} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <MetaIcon size={10} className={`${cfg.color} opacity-50`} />
                    <span className={`text-xs font-semibold ${cfg.color}`}>{meta.label}</span>
                    {spinning && <span className="text-[10px] text-neon-blue/60 font-mono ml-1">scanning…</span>}
                  </div>
                  {item.detail && !compact && (
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </>
  );
}