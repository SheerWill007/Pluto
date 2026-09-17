import React from 'react';
import { motion } from 'framer-motion';

export const SectionWrapper = ({ children, isActive }) => {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(12px)', scale: 0.98, display: 'none' }}
      animate={isActive 
        ? { opacity: 1, filter: 'blur(0px)', scale: 1, display: 'flex' } 
        : { opacity: 0, filter: 'blur(12px)', scale: 0.98, transitionEnd: { display: 'none' } }
      }
      transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
      className="w-full h-full flex flex-col flex-1"
    >
      {children}
    </motion.div>
  );
};

export default SectionWrapper;
