import { create } from 'zustand';

export const useAgentStore = create((set, get) => ({
  agentStates: {
    orchestrator: { status: 'idle', latency: 0, last_action: 'Awaiting prompt' },
    rag_agent: { status: 'idle', latency: 0, last_action: 'Ready' },
    gmail_agent: { status: 'idle', latency: 0, last_action: 'Ready' },
    code_generator: { status: 'idle', latency: 0, last_action: 'Synthesizing code' },
    code_critic: { status: 'idle', latency: 0, last_action: 'Evaluating scripts' },
    chromadb: { status: 'disconnected', latency: 0 },
    redis: { status: 'disconnected', latency: 0 },
    postgresql: { status: 'disconnected', latency: 0 },
    ollama: { status: 'disconnected', latency: 0 },
    openai: { status: 'disconnected', latency: 0 },
    anthropic: { status: 'disconnected', latency: 0 },
    gemini: { status: 'disconnected', latency: 0 },
    groq: { status: 'disconnected', latency: 0 },
    openrouter: { status: 'disconnected', latency: 0 },
  },
  activeLayout: 'parallel', // 'sequential', 'parallel', 'graph', 'hierarchy'
  activeNodes: [], // list of nodes currently pulsing/transmitting
  hoveredNode: null,
  customPositions: {},
  isDraggingNode: false,
  
  setAgentStates: (states) => set((state) => ({
    agentStates: { ...state.agentStates, ...states }
  })),
  
  setActiveLayout: (layout) => set({ activeLayout: layout }),
  
  setNodeActive: (nodeId, isActive) => set((state) => {
    // Intercept active cloud provider calls and map them to 'ai_apis'
    const targetId = ['openai', 'anthropic', 'google', 'gemini', 'groq', 'openrouter'].includes(nodeId)
      ? 'ai_apis'
      : nodeId;

    const activeNodes = isActive 
      ? [...new Set([...state.activeNodes, targetId])]
      : state.activeNodes.filter(id => id !== targetId);
    return { activeNodes };
  }),
  
  clearActiveNodes: () => set({ activeNodes: [] }),
  setHoveredNode: (node) => set({ hoveredNode: node }),

  updateNodePosition: (nodeId, position) => set((state) => ({
    customPositions: { ...state.customPositions, [nodeId]: position }
  })),
  setIsDraggingNode: (isDraggingNode) => set({ isDraggingNode }),
  resetCustomPositions: () => set({ customPositions: {} }),
}));
export default useAgentStore;
