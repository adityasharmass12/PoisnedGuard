import { motion } from 'motion/react';
import { ShieldCheck, Cpu, Code, Database, Globe, Lock } from 'lucide-react';

export function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <header className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center justify-center p-4 rounded-full bg-neon-blue/10 border border-neon-blue/30 shadow-[0_0_30px_rgba(0,240,255,0.2)] mb-6"
        >
          <ShieldCheck size={48} className="text-neon-blue" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-bold font-display text-white tracking-wide mb-4">
          About <span className="text-neon-blue text-glow-blue">PoisonGuard</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
          The next-generation defense system against adversarial machine learning attacks and dataset poisoning.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="glass-panel p-8 border-l-4 border-neon-purple/50 hover:shadow-[0_0_20px_rgba(176,38,255,0.15)] transition-all"
        >
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-3 text-white">
            <Lock className="text-neon-purple" /> The Problem
          </h2>
          <p className="text-gray-400 leading-relaxed">
            Modern AI models are vulnerable to data poisoning attacks, where malicious actors inject carefully crafted samples into training datasets. These "backdoors" can cause catastrophic failures in production environments, forcing models to misclassify specific inputs while behaving normally otherwise.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="glass-panel p-8 border-l-4 border-neon-blue/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)] transition-all"
        >
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-3 text-white">
            <ShieldCheck className="text-neon-blue" /> Our Solution
          </h2>
          <p className="text-gray-400 leading-relaxed">
            IntrusionX SE utilizes advanced statistical analysis, robust clustering algorithms, and simulated neural network probing to identify and isolate poisoned data points before they ever reach your training pipeline. We ensure the integrity of your AI models from the ground up.
          </p>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass-panel p-10 relative overflow-hidden mt-12"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-neon-purple/5 pointer-events-none" />
        
        <h2 className="text-2xl font-semibold mb-8 text-center text-white">Core Technologies</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Cpu, label: 'Deep Learning', color: 'text-neon-blue' },
            { icon: Database, label: 'Big Data Processing', color: 'text-neon-green' },
            { icon: Code, label: 'Python / PyTorch', color: 'text-yellow-400' },
            { icon: Globe, label: 'Web3 Security', color: 'text-neon-purple' },
          ].map((tech, i) => (
            <div key={i} className="flex flex-col items-center justify-center p-6 rounded-xl bg-surface border border-border hover:border-neon-blue/30 transition-colors group">
              <tech.icon size={32} className={`${tech.color} mb-4 group-hover:scale-110 transition-transform`} />
              <span className="text-sm font-medium text-gray-300 text-center">{tech.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center mt-16 text-sm text-gray-500 font-mono"
      >
        <p>PoisonGuard</p>
        <p className="mt-2">© 2026 Team Lumen</p>
      </motion.div>
    </div>
  );
}
