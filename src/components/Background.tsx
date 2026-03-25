import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

export function Background() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-background">
      {/* Grid lines */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #00f0ff 1px, transparent 1px),
            linear-gradient(to bottom, #00f0ff 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Radial gradient following mouse */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full pointer-events-none opacity-30 blur-[100px]"
        animate={{
          x: mousePosition.x - 400,
          y: mousePosition.y - 400,
        }}
        transition={{ type: 'tween', ease: 'backOut', duration: 0.5 }}
        style={{
          background: 'radial-gradient(circle, rgba(0,240,255,0.6) 0%, rgba(176,38,255,0.15) 50%, transparent 70%)',
        }}
      />

      {/* Vibrant floating orbs for glassmorphism contrast */}
      <motion.div
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -100, 50, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-neon-purple/20 blur-[100px]"
      />
      <motion.div
        animate={{
          x: [0, -100, 50, 0],
          y: [0, 100, -50, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[20%] right-[10%] w-[35vw] h-[35vw] rounded-full bg-neon-blue/20 blur-[120px]"
      />
      <motion.div
        animate={{
          x: [0, 50, -100, 0],
          y: [0, 50, 100, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute top-[40%] right-[30%] w-[25vw] h-[25vw] rounded-full bg-neon-green/10 blur-[90px]"
      />
    </div>
  );
}
