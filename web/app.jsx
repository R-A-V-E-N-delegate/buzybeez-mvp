const { useState, useEffect, useRef, useCallback, useMemo } = React;
const {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType
} = window.ReactFlow;

const API_BASE = '';

// ==================== Custom Node Components ====================

// Human Mailbox Node
function HumanNode({ data, selected }) {
  return (
    <div className={`human-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="node-icon">
        <span role="img" aria-label="human">&#128100;</span>
      </div>
      <div className="node-label">{data.label}</div>
      <div className="node-sublabel">Click to compose mail</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

// Bee Node with hexagon shape
function BeeNode({ data, selected }) {
  const isRunning = data.running;

  return (
    <div className={`bee-node ${selected ? 'selected' : ''} ${isRunning ? 'running' : 'stopped'}`}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="hexagon-wrapper">
        <div className="hexagon">
          <div className="hexagon-content">
            <span className="bee-emoji" role="img" aria-label="bee">&#128029;</span>
          </div>
        </div>
        <div className={`status-indicator ${isRunning ? 'running' : 'stopped'}`} />
      </div>
      <div className="node-label">{data.label}</div>
      <div className="node-sublabel">
        {isRunning ? 'Running' : 'Stopped'}
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

const nodeTypes = {
  human: HumanNode,
  bee: BeeNode
};

// ==================== Modal Components ====================

function BeeControlModal({ bee, onClose, onStart, onStop }) {
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    await onStart(bee.id);
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    await onStop(bee.id);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><span role="img" aria-label="bee">&#128029;</span> {bee.label}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="status-display">
            <span className={`status-dot ${bee.running ? 'running' : 'stopped'}`} />
            <span>{bee.running ? 'Running' : 'Stopped'}</span>
          </div>
          <div className="modal-actions">
            {bee.running ? (
              <button className="btn danger" onClick={handleStop} disabled={loading}>
                {loading ? 'Stopping...' : 'Stop Bee'}
              </button>
            ) : (
              <button className="btn primary" onClick={handleStart} disabled={loading}>
                {loading ? 'Starting...' : 'Start Bee'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposeMailModal({ connections, onClose, onSend }) {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter connections from human
  const availableRecipients = connections
    .filter(c => c.from === 'human' && c.to !== 'human')
    .map(c => c.to);

  useEffect(() => {
    if (availableRecipients.length > 0 && !recipient) {
      setRecipient(availableRecipients[0]);
    }
  }, [availableRecipients]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!recipient || !subject.trim() || !body.trim()) return;

    setLoading(true);
    await onSend(recipient, subject, body);
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal compose-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><span role="img" aria-label="mail">&#9993;</span> Compose Mail</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSend}>
          <div className="modal-body">
            {availableRecipients.length === 0 ? (
              <div className="empty-state">
                No connected bees. Draw a connection from Human to a bee first.
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>To:</label>
                  <select value={recipient} onChange={e => setRecipient(e.target.value)}>
                    {availableRecipients.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Subject:</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Enter subject..."
                  />
                </div>
                <div className="form-group">
                  <label>Message:</label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your message..."
                    rows={5}
                  />
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            {availableRecipients.length > 0 && (
              <button
                type="submit"
                className="btn primary"
                disabled={loading || !subject.trim() || !body.trim()}
              >
                {loading ? 'Sending...' : 'Send Mail'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function AddBeeModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const id = 'bee-' + Date.now().toString(36);
    await onAdd(id, name);
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><span role="img" aria-label="bee">&#128029;</span> Add New Bee</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleAdd}>
          <div className="modal-body">
            <div className="form-group">
              <label>Bee Name:</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Research Bee, Code Bee..."
                autoFocus
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={loading || !name.trim()}>
              {loading ? 'Adding...' : 'Add Bee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ContextMenu({ x, y, onClose, onAddBee }) {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div className="context-menu" style={{ left: x, top: y }} onClick={e => e.stopPropagation()}>
      <button onClick={onAddBee}>
        <span role="img" aria-label="add">+</span> Add New Bee
      </button>
    </div>
  );
}

// Edge Edit Modal for toggling bidirectional
function EdgeEditModal({ edge, onClose, onToggleBidirectional, onDelete }) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    await onToggleBidirectional(edge, !edge.data?.bidirectional);
    setLoading(false);
    onClose();
  };

  const handleDelete = async () => {
    setLoading(true);
    await onDelete(edge);
    setLoading(false);
    onClose();
  };

  const isBidirectional = edge.data?.bidirectional;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Connection</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="edge-info">
            <span className="edge-label">
              {edge.source} {isBidirectional ? '<->' : '->'} {edge.target}
            </span>
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isBidirectional}
                onChange={handleToggle}
                disabled={loading}
              />
              Bidirectional (two-way communication)
            </label>
          </div>
          <div className="modal-actions">
            <button className="btn danger" onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete Connection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Main App ====================

function App() {
  // Canvas state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // App state
  const [connected, setConnected] = useState(false);
  const [swarmConfig, setSwarmConfig] = useState(null);
  const [beeStates, setBeeStates] = useState({});

  // Modal state
  const [selectedBee, setSelectedBee] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showAddBee, setShowAddBee] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  const wsRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Fetch initial data
  useEffect(() => {
    fetchSwarm();
    fetchBeeStates();
    fetchCanvas();
  }, []);

  // WebSocket connection
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
      setTimeout(() => window.location.reload(), 2000);
    };

    ws.onmessage = (event) => {
      const { event: eventType, data } = JSON.parse(event.data);

      switch (eventType) {
        case 'bee:status':
          setBeeStates(prev => ({ ...prev, [data.id]: data }));
          break;
        case 'swarm:updated':
          setSwarmConfig(data);
          fetchBeeStates();
          break;
        case 'mail:sent':
        case 'mail:received':
        case 'mail:routed':
          console.log(`Mail event: ${eventType}`, data);
          break;
      }
    };

    return () => ws.close();
  }, []);

  // Update node running states when beeStates changes
  useEffect(() => {
    setNodes(nds => nds.map(node => {
      if (node.type === 'bee' && beeStates[node.id]) {
        return {
          ...node,
          data: { ...node.data, running: beeStates[node.id].running }
        };
      }
      return node;
    }));
  }, [beeStates]);

  async function fetchSwarm() {
    try {
      const res = await fetch(`${API_BASE}/api/swarm`);
      const data = await res.json();
      setSwarmConfig(data);
    } catch (e) {
      console.error('Failed to fetch swarm:', e);
    }
  }

  async function fetchBeeStates() {
    try {
      const res = await fetch(`${API_BASE}/api/bees`);
      const data = await res.json();
      const statesMap = {};
      data.forEach(bee => { statesMap[bee.id] = bee; });
      setBeeStates(statesMap);
    } catch (e) {
      console.error('Failed to fetch bee states:', e);
    }
  }

  async function fetchCanvas() {
    try {
      const res = await fetch(`${API_BASE}/api/canvas`);
      const data = await res.json();

      // Set nodes with proper types
      setNodes(data.nodes.map(n => ({
        ...n,
        type: n.type || 'default',
        draggable: true
      })));

      // Set edges with styling - bidirectional edges get markers on both ends
      setEdges(data.edges.map(e => {
        const isBidirectional = e.bidirectional;
        return {
          ...e,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: isBidirectional ? '#4caf50' : '#f5a623',
            strokeWidth: isBidirectional ? 3 : 2
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: isBidirectional ? '#4caf50' : '#f5a623' },
          markerStart: isBidirectional ? { type: MarkerType.ArrowClosed, color: '#4caf50' } : undefined,
          data: { bidirectional: isBidirectional }
        };
      }));
    } catch (e) {
      console.error('Failed to fetch canvas:', e);
    }
  }

  // Save canvas layout (debounced)
  const saveCanvas = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const layout = { nodes, edges };
        await fetch(`${API_BASE}/api/canvas`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(layout)
        });
      } catch (e) {
        console.error('Failed to save canvas:', e);
      }
    }, 500);
  }, [nodes, edges]);

  // Handle node drag end
  const onNodeDragStop = useCallback((event, node) => {
    saveCanvas();
  }, [saveCanvas]);

  // Handle new connections
  const onConnect = useCallback(async (params) => {
    // Add edge visually
    const newEdge = {
      ...params,
      id: `${params.source}-${params.target}`,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#f5a623', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#f5a623' }
    };
    setEdges(eds => addEdge(newEdge, eds));

    // Save to backend
    try {
      await fetch(`${API_BASE}/api/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: params.source, to: params.target })
      });
      saveCanvas();
    } catch (e) {
      console.error('Failed to add connection:', e);
    }
  }, [saveCanvas]);

  // Handle edge deletion
  const onEdgesDelete = useCallback(async (deletedEdges) => {
    for (const edge of deletedEdges) {
      try {
        await fetch(`${API_BASE}/api/connections`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: edge.source, to: edge.target })
        });
      } catch (e) {
        console.error('Failed to delete connection:', e);
      }
    }
    saveCanvas();
  }, [saveCanvas]);

  // Handle node click
  const onNodeClick = useCallback((event, node) => {
    if (node.type === 'bee') {
      setSelectedBee({ ...node.data, id: node.id });
    } else if (node.type === 'human') {
      setShowCompose(true);
    }
  }, []);

  // Handle right click for context menu
  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  // Bee controls
  async function startBee(beeId) {
    try {
      await fetch(`${API_BASE}/api/bees/${beeId}/start`, { method: 'POST' });
      await fetchBeeStates();
    } catch (e) {
      console.error('Failed to start bee:', e);
    }
  }

  async function stopBee(beeId) {
    try {
      await fetch(`${API_BASE}/api/bees/${beeId}/stop`, { method: 'POST' });
      await fetchBeeStates();
    } catch (e) {
      console.error('Failed to stop bee:', e);
    }
  }

  // Add new bee
  async function addBee(id, name) {
    try {
      await fetch(`${API_BASE}/api/bees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name })
      });

      // Add node to canvas
      const newNode = {
        id,
        type: 'bee',
        position: { x: 400 + Math.random() * 100, y: 200 + Math.random() * 100 },
        data: { label: name, beeId: id, running: false },
        draggable: true
      };
      setNodes(nds => [...nds, newNode]);
      saveCanvas();

      await fetchSwarm();
      await fetchBeeStates();
    } catch (e) {
      console.error('Failed to add bee:', e);
    }
  }

  // Send mail
  async function sendMail(to, subject, body) {
    try {
      await fetch(`${API_BASE}/api/mail/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body })
      });
    } catch (e) {
      console.error('Failed to send mail:', e);
    }
  }

  // Get connections for compose modal
  const connections = useMemo(() => {
    return swarmConfig?.connections || [];
  }, [swarmConfig]);

  return (
    <div className="app">
      <header>
        <h1>
          <span role="img" aria-label="bee">&#128029;</span> BuzyBeez Canvas
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? 'Live' : 'Reconnecting...'}
          </span>
        </h1>
        <div className="header-info">
          <span className="bee-count">
            {Object.values(beeStates).filter(b => b.running).length} / {Object.keys(beeStates).length} bees running
          </span>
        </div>
      </header>

      <div className="canvas-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
          selectionKeyCode="Shift"
        >
          <Background color="#f5a623" gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'human') return '#4a90d9';
              return node.data?.running ? '#4caf50' : '#9e9e9e';
            }}
            maskColor="rgba(255, 248, 225, 0.8)"
          />
        </ReactFlow>

        <div className="canvas-instructions">
          <span><b>Click</b> node to control</span>
          <span><b>Drag</b> handles to connect</span>
          <span><b>Select + Delete</b> to remove edge</span>
          <span><b>Right-click</b> to add bee</span>
        </div>
      </div>

      {/* Modals */}
      {selectedBee && (
        <BeeControlModal
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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddBee={() => {
            setContextMenu(null);
            setShowAddBee(true);
          }}
        />
      )}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
