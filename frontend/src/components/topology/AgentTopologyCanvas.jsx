import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAgentStore } from '../../store/useAgentStore';
import { useThemeStore } from '../../store/useThemeStore';
import NodeCard from './NodeCard';
import EdgeBeam from './EdgeBeam';
import GlassCard from '../ui/GlassCard';
import { Activity, GitMerge, LayoutGrid, Network, Layers, EyeOff } from 'lucide-react';

const NODES_LIST = [
  { id: 'orchestrator', label: 'Orchestrator' },
  { id: 'rag_agent', label: 'RAG Agent' },
  { id: 'gmail_agent', label: 'Gmail Agent' },
  { id: 'code_generator', label: 'Code Gen Agent' },
  { id: 'code_critic', label: 'Code Critic Agent' },
  { id: 'chromadb', label: 'ChromaDB' },
  { id: 'redis', label: 'Redis Cache' },
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'ollama', label: 'Ollama (Local)' },
  { id: 'ai_apis', label: 'Cloud LLM APIs' },
];

const CONNECTIONS = [
  { from: 'orchestrator', to: 'rag_agent' },
  { from: 'orchestrator', to: 'gmail_agent' },
  { from: 'orchestrator', to: 'code_generator' },
  { from: 'orchestrator', to: 'code_critic' },
  { from: 'orchestrator', to: 'redis' },
  { from: 'orchestrator', to: 'postgresql' },
  { from: 'rag_agent', to: 'chromadb' },
  { from: 'code_generator', to: 'code_critic' },
  
  { from: 'orchestrator', to: 'ollama' },
  { from: 'orchestrator', to: 'ai_apis' },
  
  { from: 'gmail_agent', to: 'ai_apis' },
];

// WebGL Liquid Shader Background
const BackgroundShader = () => {
  const meshRef = useRef();
  const { theme } = useThemeStore();

  const uniforms = useMemo(() => ({
    u_time: { value: 0 },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    u_isDark: { value: theme === 'dark' ? 1.0 : 0.0 }
  }), [theme]);

  useEffect(() => {
    if (meshRef.current?.material?.uniforms?.u_isDark) {
      meshRef.current.material.uniforms.u_isDark.value = theme === 'dark' ? 1.0 : 0.0;
    }
  }, [theme]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    meshRef.current.material.uniforms.u_time.value = time;

    const mx = state.pointer.x * 0.5 + 0.5;
    const my = state.pointer.y * 0.5 + 0.5;
    meshRef.current.material.uniforms.u_mouse.value.lerp(new THREE.Vector2(mx, my), 0.05);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -5]}>
      <planeGeometry args={[30, 20]} />
      <shaderMaterial
        depthWrite={false}
        depthTest={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float u_time;
          uniform vec2 u_mouse;
          uniform float u_isDark;
          varying vec2 vUv;

          void main() {
            vec3 ivory = mix(vec3(0.99, 0.985, 0.97), vec3(0.11, 0.10, 0.09), u_isDark);
            vec3 beige = mix(vec3(0.965, 0.945, 0.915), vec3(0.15, 0.14, 0.13), u_isDark);
            vec3 sand = mix(vec3(0.935, 0.905, 0.865), vec3(0.19, 0.17, 0.15), u_isDark);
            vec3 gold = mix(vec3(0.915, 0.875, 0.825), vec3(0.23, 0.20, 0.17), u_isDark);

            vec2 uv = vUv;

            float wave1 = sin(uv.x * 4.0 + u_time * 0.2) * cos(uv.y * 4.0 + u_time * 0.15) * 0.5 + 0.5;
            float wave2 = sin(uv.y * 5.0 - u_time * 0.12) * cos(uv.x * 3.0 + u_time * 0.25) * 0.5 + 0.5;
            float blend = (wave1 + wave2) * 0.5;

            float dist = length(uv - u_mouse);
            float ripple = sin(dist * 35.0 - u_time * 2.5) * 0.012 * smoothstep(0.4, 0.0, dist);

            vec3 baseColor = mix(ivory, beige, uv.y + blend * 0.2 + ripple);
            vec3 finalColor = mix(baseColor, mix(sand, gold, blend), wave1 * 0.15 * (1.0 - dist * 0.5));

            gl_FragColor = vec4(finalColor, 1.0);
          }
        `}
      />
    </mesh>
  );
};

export const AgentTopologyCanvas = ({ onClose }) => {
  const { activeLayout, setActiveLayout, agentStates, activeNodes, customPositions, isDraggingNode } = useAgentStore();

  const nodePositions = useMemo(() => {
    const coords = {};

    if (activeLayout === 'parallel') {
      coords.orchestrator = [0, 0.5, 0];
      const otherNodes = NODES_LIST.filter(n => n.id !== 'orchestrator');
      otherNodes.forEach((node, idx) => {
        const angle = idx * (2 * Math.PI / otherNodes.length);
        const radius = 3.6;
        coords[node.id] = [radius * Math.cos(angle), radius * Math.sin(angle) + 0.5, 0];
      });

    } else if (activeLayout === 'sequential') {
      coords.orchestrator = [-4, 0.5, 0];
      coords.rag_agent = [-2.2, 2.2, 0];
      coords.gmail_agent = [-2.2, 0.5, 0];
      coords.code_generator = [-2.2, -1.2, 0];
      coords.code_critic = [-0.5, -2, 0];
      coords.chromadb = [0.5, 3, 0];
      coords.redis = [0.5, 1.2, 0];
      coords.postgresql = [0.5, -0.6, 0];
      coords.ollama = [3.5, 1.5, 0];
      coords.ai_apis = [3.5, -0.5, 0];

    } else if (activeLayout === 'graph') {
      coords.orchestrator = [0, 1.8, 0];
      coords.rag_agent = [-2.6, 2.5, 0];
      coords.gmail_agent = [2.6, 2.5, 0];
      coords.code_generator = [-1.5, 0, 0];
      coords.code_critic = [1.5, 0, 0];
      coords.chromadb = [-4.2, 1.5, 0];
      coords.redis = [-3, -1.5, 0];
      coords.postgresql = [3, -1.5, 0];
      coords.ollama = [-0.8, -2.4, 0];
      coords.ai_apis = [0.8, -2.4, 0];

    } else if (activeLayout === 'hierarchy') {
      coords.orchestrator = [0, 3.2, 0];
      
      coords.rag_agent = [-2.6, 1.6, 0];
      coords.gmail_agent = [0, 1.6, 0];
      coords.code_generator = [2.6, 1.6, 0];
      
      coords.chromadb = [-4.0, 0, 0];
      coords.redis = [-2.2, 0, 0];
      coords.postgresql = [-0.4, 0, 0];
      coords.code_critic = [2.6, 0, 0];
      
      coords.ollama = [-1.2, -1.8, 0];
      coords.ai_apis = [1.2, -1.8, 0];
    }

    return coords;
  }, [activeLayout]);

  const layoutModes = [
    { id: 'parallel', label: 'Parallel', icon: LayoutGrid },
    { id: 'sequential', label: 'Sequential', icon: GitMerge },
    { id: 'graph', label: 'Force Graph', icon: Network },
    { id: 'hierarchy', label: 'Hierarchy', icon: Layers },
  ];

  const getCloudLLMStatus = () => {
    const providers = ['openai', 'anthropic', 'gemini', 'groq', 'openrouter'];
    const anyConnected = providers.some(p => agentStates[p]?.status === 'connected');
    return anyConnected ? 'connected' : 'disconnected';
  };

  const getNodeStatusInfo = (nodeId) => {
    if (nodeId === 'ai_apis') {
      const status = getCloudLLMStatus();
      return { status, latency: 150, last_action: 'Listening' };
    }
    return agentStates[nodeId] || { status: 'idle', latency: 0 };
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-stone-50 dark:bg-stone-950">
      
      {/* Control Tabs */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {layoutModes.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeLayout === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => setActiveLayout(mode.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all duration-300 backdrop-blur-md cursor-pointer ${
                isActive
                  ? 'bg-beige-150 dark:bg-stone-800 border-beige-200 dark:border-stone-700 text-beige-700 dark:text-stone-200 shadow-[0_2px_8px_rgba(168,152,120,0.08)]'
                  : 'bg-white/40 dark:bg-stone-900/40 border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/50 dark:hover:bg-stone-800/50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Hide Map Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white/70 dark:bg-stone-900/70 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all duration-300 backdrop-blur-md text-[11px] font-semibold cursor-pointer"
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span>Hide Map</span>
        </button>
      )}

      {/* R3F 3D Canvas wrapper */}
      <div className="relative flex-1 w-full h-full z-0 cursor-grab active:cursor-grabbing">
        <Canvas camera={{ position: [0, 0, 6.5], fov: 70 }}>
          <ambientLight intensity={1.6} />
          <pointLight position={[10, 10, 10]} intensity={1.8} />

          <BackgroundShader />

          {/* Node Render */}
          {NODES_LIST.map((node) => {
            const pos = customPositions[node.id] || nodePositions[node.id] || [0, 0, 0];
            return (
              <NodeCard
                key={node.id}
                id={node.id}
                label={node.label}
                position={pos}
                statusInfo={getNodeStatusInfo(node.id)}
              />
            );
          })}

          {/* Connection Render */}
          {CONNECTIONS.map((conn, idx) => {
            const start = customPositions[conn.from] || nodePositions[conn.from];
            const end = customPositions[conn.to] || nodePositions[conn.to];
            if (!start || !end) return null;

            const isConnectionActive = activeNodes.includes(conn.from) || activeNodes.includes(conn.to);

            return (
              <EdgeBeam
                key={idx}
                start={start}
                end={end}
                isActive={isConnectionActive}
              />
            );
          })}

          <OrbitControls 
            enableZoom={true} 
            enablePan={!isDraggingNode}
            enableRotate={!isDraggingNode}
            maxDistance={12}
            minDistance={3}
          />
        </Canvas>
      </div>

      {/* Live Topology status bar overlay */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex gap-4 overflow-x-auto py-2 shrink-0">
        <GlassCard className="p-3.5! rounded-xl flex-1 flex items-center justify-between border-stone-200/60 dark:border-stone-700 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 dark:text-stone-400 tracking-wider uppercase font-mono">
            <Activity className="h-3.5 w-3.5 text-beige-600 dark:text-beige-400" />
            <span>Agent Deployment Ring:</span>
          </div>

          <div className="flex items-center gap-6 text-[10px] font-semibold text-stone-600 dark:text-stone-300 font-mono">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
              <span>Orchestrator: <b className="text-emerald-600 dark:text-emerald-400 capitalize">{agentStates.orchestrator?.status}</b></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
              <span>RAG indexing: <b className="text-emerald-600 dark:text-emerald-400 capitalize">{agentStates.rag_agent?.status}</b></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-beige-500 shadow-[0_0_6px_rgba(196,181,160,0.4)]" />
              <span>Gmail monitoring: <b className="text-beige-600 dark:text-beige-400 capitalize">{agentStates.gmail_agent?.status}</b></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(217,119,6,0.4)]" />
              <span>Coding logic: <b className="text-amber-600 dark:text-amber-400 capitalize">connected</b></span>
            </div>
          </div>
        </GlassCard>
      </div>

    </div>
  );
};

export default AgentTopologyCanvas;
