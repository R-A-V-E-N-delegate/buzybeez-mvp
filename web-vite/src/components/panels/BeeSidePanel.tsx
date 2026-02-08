import { useState, useEffect, useCallback } from 'react';
import { BeeNodeData } from '../../types';

interface Mail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string;
  attachments?: string[];
}

interface LogEntry {
  timestamp: string;
  type: string;
  message?: string;
  [key: string]: unknown;
}

interface BeeSidePanelProps {
  bee: BeeNodeData & { id: string };
  onClose: () => void;
  onStart: (beeId: string) => Promise<void>;
  onStop: (beeId: string) => Promise<void>;
}

type TabType = 'logs' | 'inbox' | 'outbox';

export function BeeSidePanel({ bee, onClose, onStart, onStop }: BeeSidePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [inbox, setInbox] = useState<Mail[]>([]);
  const [outbox, setOutbox] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch data for the selected bee
  const fetchBeeData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, inboxRes, outboxRes] = await Promise.all([
        fetch(`/api/bees/${bee.id}/transcript`),
        fetch(`/api/bees/${bee.id}/inbox`),
        fetch(`/api/bees/${bee.id}/outbox`),
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }
      if (inboxRes.ok) {
        const inboxData = await inboxRes.json();
        setInbox(inboxData.messages || []);
      }
      if (outboxRes.ok) {
        const outboxData = await outboxRes.json();
        setOutbox(outboxData.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch bee data:', err);
    }
    setLoading(false);
  }, [bee.id]);

  useEffect(() => {
    fetchBeeData();
    // Poll for updates every 3 seconds
    const interval = setInterval(fetchBeeData, 3000);
    return () => clearInterval(interval);
  }, [fetchBeeData]);

  const handleStart = async () => {
    setActionLoading(true);
    await onStart(bee.id);
    setActionLoading(false);
  };

  const handleStop = async () => {
    setActionLoading(true);
    await onStop(bee.id);
    setActionLoading(false);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-600';
      case 'tool_call': return 'text-blue-600';
      case 'tool_result': return 'text-emerald-600';
      case 'mail_received': return 'text-purple-600';
      case 'mail_sent': return 'text-amber-600';
      default: return 'text-stone-500';
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white border-l border-stone-200 shadow-lg z-[1000] flex flex-col animate-slideIn">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐝</span>
          <div>
            <h3 className="text-sm font-medium text-stone-800">{bee.label}</h3>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${bee.running ? 'bg-emerald-500' : 'bg-stone-300'}`} />
              <span className={`text-xs ${bee.running ? 'text-emerald-600' : 'text-stone-400'}`}>
                {bee.running ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>
        </div>
        <button
          className="w-6 h-6 rounded hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
          onClick={onClose}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      {/* Controls */}
      <div className="px-4 py-2 border-b border-stone-100 flex gap-2">
        {bee.running ? (
          <button
            className="flex-1 px-3 py-1.5 text-xs rounded border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
            onClick={handleStop}
            disabled={actionLoading}
          >
            {actionLoading ? 'Stopping...' : 'Stop'}
          </button>
        ) : (
          <button
            className="flex-1 px-3 py-1.5 text-xs rounded bg-amber-500 text-white hover:bg-amber-400 transition-colors disabled:opacity-50"
            onClick={handleStart}
            disabled={actionLoading}
          >
            {actionLoading ? 'Starting...' : 'Start'}
          </button>
        )}
        <button
          className="px-3 py-1.5 text-xs rounded border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
          onClick={fetchBeeData}
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-100">
        {(['logs', 'inbox', 'outbox'] as TabType[]).map((tab) => (
          <button
            key={tab}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'text-amber-600 border-b-2 border-amber-500 -mb-[1px]'
                : 'text-stone-400 hover:text-stone-600'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'logs' && `Logs (${logs.length})`}
            {tab === 'inbox' && `Inbox (${inbox.length})`}
            {tab === 'outbox' && `Outbox (${outbox.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && logs.length === 0 && inbox.length === 0 && outbox.length === 0 ? (
          <div className="flex items-center justify-center h-full text-stone-400 text-sm">
            Loading...
          </div>
        ) : (
          <>
            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <div className="p-3 space-y-1">
                {logs.length === 0 ? (
                  <p className="text-stone-400 text-center py-8 text-sm">No logs yet</p>
                ) : (
                  logs.slice().reverse().map((log, i) => (
                    <div key={i} className="text-xs font-mono bg-stone-50 rounded px-2 py-1.5 border border-stone-100">
                      <span className="text-stone-400">{formatTime(log.timestamp)}</span>
                      <span className={`ml-2 ${getLogColor(log.type)}`}>[{log.type}]</span>
                      {log.message && <span className="ml-2 text-stone-600">{log.message}</span>}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Inbox Tab */}
            {activeTab === 'inbox' && (
              <div className="p-3 space-y-2">
                {inbox.length === 0 ? (
                  <p className="text-stone-400 text-center py-8 text-sm">Inbox empty</p>
                ) : (
                  inbox.slice().reverse().map((mail) => (
                    <div key={mail.id} className="bg-stone-50 rounded-lg p-3 border border-stone-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-purple-600 text-xs font-medium">From: {mail.from}</span>
                        <span className="text-stone-400 text-xs">{formatTime(mail.timestamp)}</span>
                      </div>
                      <p className="text-stone-800 font-medium text-sm mb-1">{mail.subject}</p>
                      <p className="text-stone-500 text-xs line-clamp-3">{mail.body}</p>
                      {mail.attachments && mail.attachments.length > 0 && (
                        <div className="mt-2 flex gap-1">
                          {mail.attachments.map((att, i) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                              {att}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Outbox Tab */}
            {activeTab === 'outbox' && (
              <div className="p-3 space-y-2">
                {outbox.length === 0 ? (
                  <p className="text-stone-400 text-center py-8 text-sm">Outbox empty</p>
                ) : (
                  outbox.slice().reverse().map((mail) => (
                    <div key={mail.id} className="bg-stone-50 rounded-lg p-3 border border-stone-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-amber-600 text-xs font-medium">To: {mail.to}</span>
                        <span className="text-stone-400 text-xs">{formatTime(mail.timestamp)}</span>
                      </div>
                      <p className="text-stone-800 font-medium text-sm mb-1">{mail.subject}</p>
                      <p className="text-stone-500 text-xs line-clamp-3">{mail.body}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
