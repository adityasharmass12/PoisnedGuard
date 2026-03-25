import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  Activity, 
  FileSearch, 
  Info,
  Menu,
  X,
  ShieldAlert
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload Dataset', icon: UploadCloud },
  { id: 'analysis', label: 'Analysis', icon: Activity },
  { id: 'results', label: 'Results', icon: FileSearch },
  { id: 'about', label: 'About', icon: Info },
];

export function Sidebar({ currentPage }: { currentPage: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button 
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 right-4 z-50 p-2 rounded-lg bg-surface border border-border text-neon-blue hover:bg-surface-hover transition-colors"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Container */}
      <AnimatePresence>
        {(isOpen || window.innerWidth >= 768) && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className={`
              fixed inset-y-0 left-0 z-40 w-64 glass-panel border-r border-y-0 border-l-0 rounded-none
              flex flex-col
              ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
          >
            {/* Logo Area */}
            <div className="p-6 flex items-center gap-3 border-b border-border">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-neon-blue/10 border border-neon-blue/30 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                <ShieldAlert className="text-neon-blue" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wider text-glow-blue">Poison Guard</h1>
                <p className="text-[10px] text-neon-blue/70 uppercase tracking-widest font-mono">System Active</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (window.innerWidth < 768) setIsOpen(false);
                      // Dispatch custom event to change page
                      window.dispatchEvent(new CustomEvent('navigate', { detail: item.id }));
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden btn-slide
                      ${isActive 
                        ? 'bg-white/10 text-neon-blue border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] backdrop-blur-md' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}
                    `}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="activeTabIndicator"
                        className="absolute left-0 top-0 bottom-0 w-1 bg-neon-blue shadow-[0_0_10px_rgba(0,240,255,1)]"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <Icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                    <span className="font-medium">{item.label}</span>
                    
                    {/* Hover Glow */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"
                         style={{ background: 'radial-gradient(circle at center, rgba(0,240,255,0.1) 0%, transparent 70%)' }} />
                  </button>
                );
              })}
            </nav>

            {/* Footer Area */}
            <div className="p-6 border-t border-border mt-auto">
              <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
                <span>System Status</span>
                <span className="flex items-center gap-2 text-neon-green text-glow-green">
                  <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                  ONLINE
                </span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}
