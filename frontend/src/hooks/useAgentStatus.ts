import { useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import { apiFetch } from '../lib/api';
import type { NodeState } from '../lib/types';

/**
 * Polls backend component status. Pauses while the tab is hidden and backs off
 * (up to 30s) while the backend is unreachable, instead of hammering it every few seconds.
 */
export const useAgentStatus = (pollingInterval = 3000) => {
  const setAgentStates = useAgentStore((state) => state.setAgentStates);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const delay = Math.min(pollingInterval * 2 ** failures, 30_000);
      timer = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (document.visibilityState === 'hidden') return schedule();
      try {
        setAgentStates(await apiFetch<Record<string, NodeState>>('/agents/status', { auth: false, timeoutMs: 5000 }));
        failures = 0;
      } catch {
        failures = Math.min(failures + 1, 4);
      }
      schedule();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        tick();
      }
    };

    tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [setAgentStates, pollingInterval]);
};

export default useAgentStatus;
