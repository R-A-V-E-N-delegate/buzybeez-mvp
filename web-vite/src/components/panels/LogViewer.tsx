import { useState, useEffect, useCallback, useRef } from 'react';
import { BeeConfig } from '../../types';

interface LogEntry {
  timestamp: string;
  type: string;
  message?: string;
  beeId?: string;
  toolName?: string;
  from?: string;
  to?: string;
  subject?: string;
  [key: string]: unknown;
}

interface LogViewerProps {
  bees: BeeConfig[];
  onClose: () => void;
}

interface BeePane {
  beeId: string;
  name: string;
}

export function LogViewer({ bees, onClose }: LogViewerProps) {
  const [panes, setPanes] = useState<BeePane[]>([]);
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});
  const [showBeeSelector, setShowBeeSelector] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const paneRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Add a bee pane
  const addPane = (bee: BeeConfig) => {
    if (!panes.find(p => p.beeId === bee.id)) {
      setPanes(prev => [...prev, { beeId: bee.id, name: bee.name }]);
    }
    setShowBeeSelector(false);
  };

  // Remove a bee pane
  const removePane = (beeId: string) => {
    setPanes(prev => prev.filter(p => p.beeId !== beeId));
  };

  // Fetch logs for all panes
  const fetchAllLogs = useCallback(async () => {
    const newLogs: Record<string, LogEntry[]> = {};

    await Promise.all(
      panes.map(async (pane) => {
        try {
          const res = await fetch(`/api/bees/${pane.beeId}/transcript`);
          if (res.ok) {
            const data = await res.json();
            // API returns array directly, not wrapped in { logs: [...] }
            const logsArray = Array.isArray(data) ? data : (data.logs || []);
            newLogs[pane.beeId] = logsArray.map((log: LogEntry) => ({
              ...log,
              beeId: pane.beeId,
            }));
          }
        } catch (err) {
          console.error(`Failed to fetch logs for ${pane.beeId}:`, err);
          newLogs[pane.beeId] = [];
        }
      })
    );

    setLogs(newLogs);
  }, [panes]);

  // Poll for updates
  useEffect(() => {
    if (panes.length > 0) {
      fetchAllLogs();
      const interval = setInterval(fetchAllLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [fetchAllLogs, panes.length]);

  // Synchronized scrolling
  const handleScroll = useCallback((sourceId: string) => {
    const sourcePane = paneRefs.current[sourceId];
    if (!sourcePane) return;

    const scrollRatio = sourcePane.scrollTop / (sourcePane.scrollHeight - sourcePane.clientHeight);

    Object.entries(paneRefs.current).forEach(([id, pane]) => {
      if (id !== sourceId && pane) {
        const targetScrollTop = scrollRatio * (pane.scrollHeight - pane.clientHeight);
        pane.scrollTop = targetScrollTop;
      }
    });
  }, []);

  // Get all unique timestamps across all logs for timeline alignment
  const getAllTimestamps = useCallback(() => {
    const timestamps = new Set<string>();
    Object.values(logs).forEach(beeeLogs => {
      beeeLogs.forEach(log => timestamps.add(log.timestamp));
    });
    return Array.from(timestamps).sort();
  }, [logs]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error': return 'border-l-red-500 bg-red-50';
      case 'tool_call': return 'border-l-blue-500 bg-blue-50';
      case 'tool_result': return 'border-l-emerald-500 bg-emerald-50';
      case 'mail_received': return 'border-l-purple-500 bg-purple-50';
      case 'mail_sent': return 'border-l-amber-500 bg-amber-50';
      case 'claude_request': return 'border-l-indigo-500 bg-indigo-50';
      default: return 'border-l-stone-300 bg-stone-50';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'tool_call': return 'TOOL';
      case 'tool_result': return 'RESULT';
      case 'mail_received': return 'RECV';
      case 'mail_sent': return 'SENT';
      case 'claude_request': return 'THINK';
      case 'error': return 'ERROR';
      default: return type.toUpperCase();
    }
  };

  // Available bees (not already in a pane)
  const availableBees = bees.filter(b => !panes.find(p => p.beeId === b.id));

  return (
    <div className="fixed inset-0 bg-[#faf9f7] z-[1000] flex flex-col">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 bg-white border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 10H5M5 10l4-4M5 10l4 4" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h1 className="text-sm font-medium text-stone-700">Log Viewer</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add pane button */}
          <div className="relative">
            <button
              onClick={() => setShowBeeSelector(!showBeeSelector)}
              disabled={availableBees.length === 0}
              className="px-3 py-1.5 text-xs rounded bg-amber-500 text-white hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add Bee
            </button>

            {showBeeSelector && availableBees.length > 0 && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[150px] z-10">
                {availableBees.map(bee => (
                  <button
                    key={bee.id}
                    onClick={() => addPane(bee)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-stone-50 flex items-center gap-2"
                  >
                    <span>🐝</span>
                    <span>{bee.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden" ref={scrollContainerRef}>
        {panes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-stone-400">
            <div className="text-center">
              <p className="mb-4">No bees selected</p>
              <button
                onClick={() => setShowBeeSelector(true)}
                className="px-4 py-2 text-sm rounded bg-amber-500 text-white hover:bg-amber-400 transition-colors"
              >
                + Add Bee to View
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Timeline column */}
            <div className="w-20 flex-shrink-0 bg-white border-r border-stone-200 overflow-hidden">
              <div className="h-10 border-b border-stone-200 flex items-center justify-center">
                <span className="text-xs font-medium text-stone-500">Time</span>
              </div>
              <div
                className="overflow-y-auto h-[calc(100%-40px)]"
                style={{ scrollbarWidth: 'none' }}
              >
                {getAllTimestamps().map((timestamp, i) => (
                  <div
                    key={i}
                    className="h-16 flex flex-col items-center justify-center border-b border-stone-100 px-2"
                  >
                    <span className="text-xs font-mono text-stone-600">{formatTime(timestamp)}</span>
                    <span className="text-[10px] text-stone-400">{formatDate(timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bee panes */}
            {panes.map((pane) => (
              <div
                key={pane.beeId}
                className="flex-1 min-w-[300px] border-r border-stone-200 flex flex-col bg-white"
              >
                {/* Pane header */}
                <div className="h-10 border-b border-stone-200 flex items-center justify-between px-3">
                  <div className="flex items-center gap-2">
                    <span>🐝</span>
                    <span className="text-sm font-medium text-stone-700">{pane.name}</span>
                    <span className="text-xs text-stone-400">({logs[pane.beeId]?.length || 0})</span>
                  </div>
                  <button
                    onClick={() => removePane(pane.beeId)}
                    className="text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 1l12 12M13 1L1 13" />
                    </svg>
                  </button>
                </div>

                {/* Pane content with synced scroll */}
                <div
                  ref={el => paneRefs.current[pane.beeId] = el}
                  className="flex-1 overflow-y-auto"
                  onScroll={() => handleScroll(pane.beeId)}
                >
                  {!logs[pane.beeId] || logs[pane.beeId].length === 0 ? (
                    <div className="h-full flex items-center justify-center text-stone-400 text-sm">
                      No logs yet
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {logs[pane.beeId].map((log, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded border-l-2 ${getLogColor(log.type)}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-stone-400">
                              {formatTime(log.timestamp)}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/50">
                              {getTypeLabel(log.type)}
                            </span>
                          </div>
                          {log.message && (
                            <p className="text-xs text-stone-600 line-clamp-2">{log.message}</p>
                          )}
                          {log.type === 'tool_call' && log.toolName && (
                            <p className="text-xs text-blue-600 font-mono">{log.toolName}</p>
                          )}
                          {log.type === 'mail_received' && log.from && (
                            <p className="text-xs text-purple-600">From: {log.from}</p>
                          )}
                          {log.type === 'mail_sent' && log.to && (
                            <p className="text-xs text-amber-600">To: {log.to}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
