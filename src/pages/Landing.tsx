import { motion } from 'motion/react';
import { ShieldAlert, ArrowRight, UploadCloud, Activity, Database } from 'lucide-react';

export function Landing({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[50vw] h-[50vw] rounded-full bg-neon-blue/5 blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[40vw] h-[40vw] rounded-full bg-neon-purple/5 blur-[150px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        
        {/* Floating Particles */}
        <div className="absolute top-[20%] right-[15%] w-2 h-2 rounded-full bg-neon-blue/50 shadow-[0_0_10px_#00f0ff] animate-float" />
        <div className="absolute bottom-[30%] left-[20%] w-3 h-3 rounded-full bg-neon-purple/50 shadow-[0_0_15px_#b026ff] animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-[40%] left-[10%] w-1.5 h-1.5 rounded-full bg-neon-green/50 shadow-[0_0_8px_#00ff66] animate-float" style={{ animationDelay: '3s' }} />
      </div>

      <div className="z-10 text-center max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          <div className="relative mb-8 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-neon-blue to-neon-purple rounded-full blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
            <div className="relative p-6 bg-surface border border-neon-blue/30 rounded-full shadow-[0_0_30px_rgba(0,240,255,0.2)]">
              <ShieldAlert size={64} className="text-neon-blue" />
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold font-display tracking-tight mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Poison</span>
            <span className="text-neon-blue text-glow-blue">Guard</span>
          </h1>
          
          <h2 className="text-xl md:text-2xl text-gray-300 font-light tracking-wide mb-6">
            Poisoned Dataset Detection System
          </h2>
          
          <div className="overflow-hidden h-8 mb-12">
            <motion.p 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-neon-green font-mono tracking-widest uppercase text-sm md:text-base text-glow-green"
            >
              Secure Your Data Before Training AI
            </motion.p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(0,240,255,0.4)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('dashboard')}
              className="px-8 py-4 rounded-xl bg-neon-blue text-background font-bold text-lg flex items-center gap-3 transition-all relative overflow-hidden group btn-slide"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(25,25,40,0.8)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('upload')}
              className="px-8 py-4 rounded-xl glass-panel border-neon-purple/50 text-white font-medium text-lg flex items-center gap-3 hover:border-neon-purple hover:shadow-[0_0_15px_rgba(176,38,255,0.3)] transition-all btn-slide"
            >
              <UploadCloud size={20} className="text-neon-purple" />
              Upload Dataset
            </motion.button>
          </div>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24"
        >
          {[
            { icon: Database, title: 'Data Integrity', desc: 'Verify dataset purity before model training' },
            { icon: Activity, title: 'Real-time Analysis', desc: 'Detect anomalies with advanced clustering' },
            { icon: ShieldAlert, title: 'Threat Mitigation', desc: 'Quarantine poisoned samples automatically' }
          ].map((feature, i) => (
            <div key={i} className="glass-panel p-6 flex flex-col items-center text-center group hover:border-neon-blue/30 transition-colors">
              <div className="p-3 rounded-lg bg-neon-blue/10 mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon size={24} className="text-neon-blue" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
