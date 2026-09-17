import React from 'react';

export const PulseOrb = ({ status = 'idle', className = '' }) => {
  const getColors = () => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'active':
      case 'connected':
        return {
          bg: 'bg-emerald-500',
          shadow: 'shadow-emerald-500/50',
          ping: 'bg-emerald-400',
        };
      case 'error':
      case 'failed':
      case 'disconnected':
        return {
          bg: 'bg-rose-500',
          shadow: 'shadow-rose-500/50',
          ping: 'bg-rose-400',
        };
      case 'idle':
      default:
        return {
          bg: 'bg-beige-400 dark:bg-stone-400',
          shadow: 'shadow-beige-400/50 dark:shadow-stone-500/50',
          ping: 'bg-beige-300 dark:bg-stone-400',
        };
    }
  };

  const colors = getColors();

  return (
    <div className={`relative flex items-center justify-center h-3 w-3 ${className}`}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colors.ping}`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 shadow-[0_0_8px_2px_rgba(0,0,0,0.1)] ${colors.bg} ${colors.shadow}`} />
    </div>
  );
};

export default PulseOrb;
