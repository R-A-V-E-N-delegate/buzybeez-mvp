import { create } from 'zustand';
import { Node, Edge, addEdge, Connection, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, MarkerType } from 'reactflow';
import { BeeState, SwarmConfig, ContextMenuState, BeeNodeData, HumanNodeData, MailCounts } from '../types';

const API_BASE = '';

interface AppState {
  // Connection state
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Nodes and edges
  nodes: Node<HumanNodeData | BeeNodeData>[];
  edges: Edge[];
  setNodes: (nodes: Node<HumanNodeData | BeeNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Swarm and bee state
  swarmConfig: SwarmConfig | null;
  beeStates: Record<string, BeeState>;
  setSwarmConfig: (config: SwarmConfig | null) => void;
  setBeeStates: (states: Record<string, BeeState>) => void;
  updateBeeState: (id: string, state: BeeState) => void;

  // Modal state
  selectedBee: (BeeNodeData & { id: string }) | null;
  showCompose: boolean;
  showAddBee: boolean;
  contextMenu: ContextMenuState | null;
  setSelectedBee: (bee: (BeeNodeData & { id: string }) | null) => void;
  setShowCompose: (show: boolean) => void;
  setShowAddBee: (show: boolean) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;

  // API actions
  fetchSwarm: () => Promise<void>;
  fetchBeeStates: () => Promise<void>;
  fetchCanvas: () => Promise<void>;
  fetchMailCounts: () => Promise<void>;
  saveCanvas: () => Promise<void>;
  startBee: (beeId: string) => Promise<void>;
  stopBee: (beeId: string) => Promise<void>;
  addBee: (id: string, name: string) => Promise<void>;
  sendMail: (to: string, subject: string, body: string) => Promise<void>;
  addConnection: (from: string, to: string) => Promise<void>;
  deleteConnection: (from: string, to: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Connection state
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Nodes and edges
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    // All edges are bidirectional - two-way communication
    const newEdge: Edge = {
      id: `${connection.source}-${connection.target}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'straight',
      animated: true,
      style: { stroke: '#f5a623', strokeWidth: 2, strokeDasharray: '5,5' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#f5a623' },
      markerStart: { type: MarkerType.ArrowClosed, color: '#f5a623' },
    };
    set({
      edges: addEdge(newEdge, get().edges),
    });
  },

  // Swarm and bee state
  swarmConfig: null,
  beeStates: {},
  setSwarmConfig: (config) => set({ swarmConfig: config }),
  setBeeStates: (states) => set({ beeStates: states }),
  updateBeeState: (id, state) => set((s) => ({
    beeStates: { ...s.beeStates, [id]: state },
    nodes: s.nodes.map((node) => {
      if (node.type === 'bee' && node.id === id) {
        return {
          ...node,
          data: { ...node.data, running: state.running } as BeeNodeData,
        };
      }
      return node;
    }),
  })),

  // Modal state
  selectedBee: null,
  showCompose: false,
  showAddBee: false,
  contextMenu: null,
  setSelectedBee: (bee) => set({ selectedBee: bee }),
  setShowCompose: (show) => set({ showCompose: show }),
  setShowAddBee: (show) => set({ showAddBee: show }),
  setContextMenu: (menu) => set({ contextMenu: menu }),

  // API actions
  fetchSwarm: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/swarm`);
      const data = await res.json();
      set({ swarmConfig: data });
    } catch (e) {
      console.error('Failed to fetch swarm:', e);
    }
  },

  fetchBeeStates: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bees`);
      const data: BeeState[] = await res.json();
      const statesMap: Record<string, BeeState> = {};
      data.forEach((bee) => {
        statesMap[bee.id] = bee;
      });
      set({ beeStates: statesMap });

      // Update node running states
      set((s) => ({
        nodes: s.nodes.map((node) => {
          if (node.type === 'bee' && statesMap[node.id]) {
            return {
              ...node,
              data: { ...node.data, running: statesMap[node.id].running } as BeeNodeData,
            };
          }
          return node;
        }),
      }));
    } catch (e) {
      console.error('Failed to fetch bee states:', e);
    }
  },

  fetchCanvas: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/canvas`);
      const data = await res.json();

      const nodes = data.nodes.map((n: Node) => ({
        ...n,
        type: n.type || 'default',
        draggable: true,
      }));

      // All edges are bidirectional - managers and reports communicate both ways
      const edges = data.edges.map((e: Edge) => ({
        ...e,
        type: 'straight',
        animated: true,
        style: { stroke: '#f5a623', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f5a623' },
        markerStart: { type: MarkerType.ArrowClosed, color: '#f5a623' },
      }));

      set({ nodes, edges });
    } catch (e) {
      console.error('Failed to fetch canvas:', e);
    }
  },

  fetchMailCounts: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mail/counts`);
      const counts: Record<string, MailCounts> = await res.json();

      // Update nodes with mail counts
      set((state) => ({
        nodes: state.nodes.map((node) => {
          const nodeId = node.type === 'human' ? 'human' : node.id;
          const mailCounts = counts[nodeId];
          if (mailCounts) {
            return {
              ...node,
              data: { ...node.data, mailCounts } as BeeNodeData | HumanNodeData,
            };
          }
          return node;
        }),
      }));
    } catch (e) {
      console.error('Failed to fetch mail counts:', e);
    }
  },

  saveCanvas: async () => {
    try {
      const { nodes, edges } = get();
      await fetch(`${API_BASE}/api/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });
    } catch (e) {
      console.error('Failed to save canvas:', e);
    }
  },

  startBee: async (beeId) => {
    try {
      await fetch(`${API_BASE}/api/bees/${beeId}/start`, { method: 'POST' });
      await get().fetchBeeStates();
    } catch (e) {
      console.error('Failed to start bee:', e);
    }
  },

  stopBee: async (beeId) => {
    try {
      await fetch(`${API_BASE}/api/bees/${beeId}/stop`, { method: 'POST' });
      await get().fetchBeeStates();
    } catch (e) {
      console.error('Failed to stop bee:', e);
    }
  },

  addBee: async (id, name) => {
    try {
      await fetch(`${API_BASE}/api/bees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      });

      // Add node to canvas
      const newNode: Node<BeeNodeData> = {
        id,
        type: 'bee',
        position: { x: 400 + Math.random() * 100, y: 200 + Math.random() * 100 },
        data: { label: name, beeId: id, running: false },
        draggable: true,
      };

      set((s) => ({ nodes: [...s.nodes, newNode] }));
      await get().saveCanvas();
      await get().fetchSwarm();
      await get().fetchBeeStates();
    } catch (e) {
      console.error('Failed to add bee:', e);
    }
  },

  sendMail: async (to, subject, body) => {
    try {
      await fetch(`${API_BASE}/api/mail/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      });
    } catch (e) {
      console.error('Failed to send mail:', e);
    }
  },

  addConnection: async (from, to) => {
    try {
      await fetch(`${API_BASE}/api/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      await get().saveCanvas();
    } catch (e) {
      console.error('Failed to add connection:', e);
    }
  },

  deleteConnection: async (from, to) => {
    try {
      await fetch(`${API_BASE}/api/connections`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
    } catch (e) {
      console.error('Failed to delete connection:', e);
    }
  },
}));
