import { useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';

export const useAgentStatus = (pollingInterval = 3000) => {
  const setAgentStates = useAgentStore((state) => state.setAgentStates);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('https://atlasmultiagentsystem.onrender.com/api/v1/agents/status');
        if (response.ok) {
          const data = await response.json();
          setAgentStates(data);
        }
      } catch (error) {
        console.warn('Error polling agent status. Backend might be offline.', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, pollingInterval);
    return () => clearInterval(interval);
  }, [setAgentStates, pollingInterval]);
};
export default useAgentStatus;
