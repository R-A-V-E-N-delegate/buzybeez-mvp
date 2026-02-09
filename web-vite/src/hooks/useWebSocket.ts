import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { BeeState, SwarmConfig } from '../types';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const {
    setConnected,
    updateBeeState,
    setSwarmConfig,
    fetchBeeStates,
  } = useStore();

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      console.log('WebSocket disconnected');
      setConnected(false);
      // Auto-reconnect after 3 seconds
      reconnectTimer.current = setTimeout(() => {
        console.log('WebSocket reconnecting...');
        connect();
      }, 3000);
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
  }, [setConnected, updateBeeState, setSwarmConfig, fetchBeeStates]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return wsRef;
}
