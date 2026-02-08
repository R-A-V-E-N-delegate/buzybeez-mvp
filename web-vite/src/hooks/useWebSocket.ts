import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { BeeState, SwarmConfig } from '../types';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const {
    setConnected,
    updateBeeState,
    setSwarmConfig,
    fetchBeeStates,
  } = useStore();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      // Auto-reconnect after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    };

    ws.onmessage = (event) => {
      try {
        const { event: eventType, data } = JSON.parse(event.data);

        switch (eventType) {
          case 'bee:status':
            updateBeeState((data as BeeState).id, data as BeeState);
            break;
          case 'swarm:updated':
            setSwarmConfig(data as SwarmConfig);
            fetchBeeStates();
            break;
          case 'mail:sent':
          case 'mail:received':
          case 'mail:routed':
            console.log(`Mail event: ${eventType}`, data);
            break;
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [setConnected, updateBeeState, setSwarmConfig, fetchBeeStates]);

  return wsRef;
}
