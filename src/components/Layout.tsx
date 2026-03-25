import { ReactNode } from 'react';
import { Background } from './Background';
import { Sidebar } from './Sidebar';
import { motion } from 'motion/react';

interface LayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
  currentPage?: string;
}

export function Layout({ children, showSidebar = true, currentPage = 'dashboard' }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-white font-sans selection:bg-neon-blue/30 selection:text-neon-blue">
      <Background />
      
      {showSidebar && <Sidebar currentPage={currentPage} />}
      
      <main className={`flex-1 flex flex-col min-h-screen ${showSidebar ? 'md:ml-64' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex-1 p-6 md:p-10"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
