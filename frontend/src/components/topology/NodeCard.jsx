import React, { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAgentStore } from '../../store/useAgentStore';
import { 
  Cpu, MessageSquare, Database, Mail, HardDrive, 
  Layers, Power, Terminal, Globe, Key, Code 
} from 'lucide-react';

const iconMap = {
  orchestrator: MessageSquare,
  rag_agent: Database,
  gmail_agent: Mail,
  code_generator: Code,
  code_critic: Cpu,
  chromadb: HardDrive,
  redis: Layers,
  postgresql: HardDrive,
  ollama: Cpu,
  ai_apis: Globe,
};

export const NodeCard = ({ id, label, position, statusInfo = {} }) => {
  const { 
    activeNodes, 
    setHoveredNode, 
    hoveredNode, 
    updateNodePosition, 
    customPositions, 
    setIsDraggingNode 
  } = useAgentStore();
  
  const groupRef = useRef(null);
  const dragStartRef = useRef(null);
  
  const isActive = activeNodes.includes(id);
  const isHovered = hoveredNode?.id === id;
  
  const IconComponent = iconMap[id] || Cpu;
  const status = statusInfo?.status || 'disconnected';
  const latency = statusInfo?.latency || 0;
  const lastAction = statusInfo?.last_action || 'Ready';

  // Target position
  const currentPos = customPositions[id] || position;

  // Smooth position interpolation (lerp) glide on every frame
  useFrame(() => {
    if (!groupRef.current) return;
    const speed = dragStartRef.current ? 0.35 : 0.08; // High speed on manual drag, smooth glide on layout changes
    
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, currentPos[0], speed);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, currentPos[1], speed);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, currentPos[2], speed);
  });

  const handleMouseDown = (e) => {
    e.preventDefault();
    if (!groupRef.current) return;
    
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      // Read current interpolated position to avoid coordinate jumping on click
      startPos: [groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z]
    };
    setIsDraggingNode(true);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!dragStartRef.current) return;
    const { startX, startY, startPos } = dragStartRef.current;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Convert pixel movement delta to 3D units
    const sensitivity = 0.014;
    const nextX = startPos[0] + deltaX * sensitivity;
    const nextY = startPos[1] - deltaY * sensitivity;

    updateNodePosition(id, [nextX, nextY, startPos[2]]);
  };

  const handleMouseUp = () => {
    dragStartRef.current = null;
    setIsDraggingNode(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <group ref={groupRef} position={position}>
      {/* 3D Glowing ring mesh underneath */}
      <mesh>
        <ringGeometry args={[0.32, 0.38, 6]} />
        <meshBasicMaterial 
          color={isActive ? "#d97706" : (status === 'connected' ? "#10b981" : "#d6d3d1")} 
          transparent 
          opacity={isActive ? 0.9 : 0.4} 
        />
      </mesh>

      {/* HTML Rounded Glass Card Overlay */}
      <Html center distanceFactor={10} zIndexRange={[10, 50]}>
        <div 
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setHoveredNode({ id, label, status, latency, lastAction })}
          onMouseLeave={() => setHoveredNode(null)}
          className={`relative flex flex-col justify-between w-38 h-18 rounded-xl border p-2 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl transition-all duration-300 cursor-grab active:cursor-grabbing hover:scale-[1.04] ${
            isActive
              ? 'border-amber-400 shadow-[0_6px_18px_rgba(217,119,6,0.14)]'
              : (status === 'connected' ? 'border-emerald-400/80 shadow-[0_6px_14px_rgba(16,185,129,0.06)]' : 'border-stone-200/80 dark:border-stone-700/80 shadow-[0_6px_14px_rgba(28,25,23,0.03)]')
          }`}
        >
          {/* Top Row: Status Dot, Badge & Latency */}
          <div className="flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-1.5">
              <div className={`h-1.5 w-1.5 rounded-full ${
                isActive ? 'bg-amber-500 animate-pulse' : (status === 'connected' ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600')
              }`} />
              <span className="text-[7.5px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider font-mono">
                {isActive ? 'Active' : (status === 'connected' ? 'Ready' : 'Offline')}
              </span>
            </div>
            
            {latency > 0 && (
              <span className="text-[7.5px] font-mono font-bold text-stone-400 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 border border-stone-200/50 dark:border-stone-700/50 px-1 rounded-sm">
                {latency}ms
              </span>
            )}
          </div>

          {/* Center/Main Row: Icon box & label */}
          <div className="flex items-center gap-2 flex-grow min-h-0 mt-1 pointer-events-none">
            <div className={`p-1.5 rounded-lg border shrink-0 ${
              isActive 
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400' 
                : (status === 'connected' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200/50 dark:border-stone-700/50 text-stone-400 dark:text-stone-500')
            }`}>
              <IconComponent className="h-4.5 w-4.5" />
            </div>
            
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] font-extrabold text-stone-700 dark:text-stone-200 truncate leading-none mb-0.5 font-sans">
                {label}
              </span>
              <span className="text-[7.5px] text-stone-400 dark:text-stone-500 truncate font-mono tracking-tight leading-none">
                {lastAction || 'Standby'}
              </span>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
};

export default NodeCard;
