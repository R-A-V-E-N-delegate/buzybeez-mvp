import { useEffect, useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  NodeMouseHandler,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useStore } from './store/useStore';
import { useWebSocket } from './hooks/useWebSocket';
import { BeeNode } from './components/nodes/BeeNode';
import { HumanNode } from './components/nodes/HumanNode';
import { BeeSidePanel } from './components/panels/BeeSidePanel';
import { TimelineView } from './components/panels/TimelineView';
import { ComposeMailModal } from './components/modals/ComposeMailModal';
import { AddBeeModal } from './components/modals/AddBeeModal';
import { BeeNodeData } from './types';

const nodeTypes = {
  bee: BeeNode,
  human: HumanNode,
};

type ViewMode = 'canvas' | 'timeline';

function App() {
  // Initialize WebSocket connection
  useWebSocket();

  const [viewMode, setViewMode] = useState<ViewMode>('canvas');

  const {
    connected,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    swarmConfig,
    selectedBee,
    showCompose,
    showAddBee,
    setSelectedBee,
    setShowCompose,
    setShowAddBee,
    setContextMenu,
    fetchSwarm,
    fetchBeeStates,
    fetchCanvas,
    fetchMailCounts,
    saveCanvas,
    startBee,
    stopBee,
    addBee,
    sendMail,
    addConnection,
  } = useStore();

  // Fetch initial data
  useEffect(() => {
    fetchSwarm();
    fetchBeeStates();
    fetchCanvas();
    fetchMailCounts();
  }, [fetchSwarm, fetchBeeStates, fetchCanvas, fetchMailCounts]);

  // Poll mail counts every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchMailCounts, 5000);
    return () => clearInterval(interval);
  }, [fetchMailCounts]);

  // Handle node clicks
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === 'bee') {
        setSelectedBee({ ...(node.data as BeeNodeData), id: node.id });
      } else if (node.type === 'human') {
        setShowCompose(true);
      }
    },
    [setSelectedBee, setShowCompose]
  );

  // Handle node drag end - save canvas layout
  const onNodeDragStop: NodeMouseHandler = useCallback(() => {
    saveCanvas();
  }, [saveCanvas]);

  // Handle right-click context menu
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [setContextMenu]
  );

  // Handle new connections
  const handleConnect = useCallback(
    (params: { source: string | null; target: string | null }) => {
      if (params.source && params.target) {
        onConnect(params as { source: string; target: string; sourceHandle: string | null; targetHandle: string | null });
        addConnection(params.source, params.target);
      }
    },
    [onConnect, addConnection]
  );

  // Get connections for compose modal
  const connections = swarmConfig?.connections || [];

  return (
    <div className="w-full h-full flex flex-col bg-[#faf9f7]">
      {/* Header - Notion style */}
      <header className="h-12 flex items-center justify-between px-4 bg-white border-b border-stone-200">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐝</span>
          <h1 className="text-sm font-medium text-stone-700">BuzyBeez</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                viewMode === 'canvas'
                  ? 'bg-white text-stone-700 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Canvas
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-white text-stone-700 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Timeline
            </button>
          </div>

          <button
            onClick={() => setShowAddBee(true)}
            className="btn primary text-xs"
          >
            + New Bee
          </button>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-emerald-500' : 'bg-stone-300'
              }`}
            />
            <span className="text-xs text-stone-400">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main content - Canvas or Logs */}
      <div className="flex-1">
        {viewMode === 'canvas' ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onPaneContextMenu={onPaneContextMenu}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} color="#d6d3d1" gap={24} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'human') return '#fbbf24';
                return (node.data as BeeNodeData)?.running ? '#f5a623' : '#d6d3d1';
              }}
            />
          </ReactFlow>
        ) : (
          <TimelineView
            bees={swarmConfig?.bees || []}
            onClose={() => setViewMode('canvas')}
          />
        )}
      </div>

      {/* Side Panel for Bee Details */}
      {selectedBee && (
        <BeeSidePanel
          bee={selectedBee}
          onClose={() => setSelectedBee(null)}
          onStart={startBee}
          onStop={stopBee}
        />
      )}

      {showCompose && (
        <ComposeMailModal
          connections={connections}
          onClose={() => setShowCompose(false)}
          onSend={sendMail}
        />
      )}

      {showAddBee && (
        <AddBeeModal
          onClose={() => setShowAddBee(false)}
          onAdd={addBee}
        />
      )}
    </div>
  );
}

export default App;
