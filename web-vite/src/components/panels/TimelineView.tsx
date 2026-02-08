import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

interface TimelineViewProps {
  bees: BeeConfig[];
  onClose: () => void;
}

interface Track {
  beeId: string;
  name: string;
  logs: LogEntry[];
}

interface ClipData {
  log: LogEntry;
  startTime: number;
  duration: number;
  x: number;
  width: number;
}

// Color mapping for event types
const getClipColor = (type: string): { bg: string; border: string; text: string } => {
  switch (type) {
    case 'mail_received':
      return { bg: 'bg-purple-500/80', border: 'border-purple-600', text: 'text-white' };
    case 'mail_sent':
      return { bg: 'bg-amber-500/80', border: 'border-amber-600', text: 'text-white' };
    case 'tool_call':
      return { bg: 'bg-blue-500/80', border: 'border-blue-600', text: 'text-white' };
    case 'tool_result':
      return { bg: 'bg-emerald-500/80', border: 'border-emerald-600', text: 'text-white' };
    case 'claude_request':
    case 'claude_response':
      return { bg: 'bg-indigo-500/80', border: 'border-indigo-600', text: 'text-white' };
    case 'error':
      return { bg: 'bg-red-500/80', border: 'border-red-600', text: 'text-white' };
    case 'bee_started':
    case 'bee_stopped':
    case 'system':
      return { bg: 'bg-stone-500/80', border: 'border-stone-600', text: 'text-white' };
    case 'info':
      return { bg: 'bg-sky-500/80', border: 'border-sky-600', text: 'text-white' };
    default:
      return { bg: 'bg-stone-400/80', border: 'border-stone-500', text: 'text-white' };
  }
};

const getTypeLabel = (type: string): string => {
  switch (type) {
    case 'tool_call': return 'TOOL';
    case 'tool_result': return 'RESULT';
    case 'mail_received': return 'RECV';
    case 'mail_sent': return 'SENT';
    case 'claude_request': return 'THINK';
    case 'claude_response': return 'RESP';
    case 'error': return 'ERROR';
    case 'bee_started': return 'START';
    case 'bee_stopped': return 'STOP';
    case 'system': return 'SYS';
    case 'info': return 'INFO';
    default: return type.replace(/_/g, ' ').toUpperCase().slice(0, 8);
  }
};

const TRACK_HEIGHT = 60;
const HEADER_WIDTH = 180;
const MIN_CLIP_WIDTH = 4; // Very small min width so clips can pack tightly when zoomed out
const RULER_HEIGHT = 40;
const DEFAULT_PIXELS_PER_SECOND = 20;

export function TimelineView({ bees, onClose }: TimelineViewProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [playheadTime, setPlayheadTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartPan, setDragStartPan] = useState(0);
  const [hoveredClip, setHoveredClip] = useState<{ clip: ClipData; trackIdx: number; x: number; y: number } | null>(null);
  const [showBeeSelector, setShowBeeSelector] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Add a track
  const addTrack = (bee: BeeConfig) => {
    if (!tracks.find(t => t.beeId === bee.id)) {
      setTracks(prev => [...prev, { beeId: bee.id, name: bee.name, logs: [] }]);
    }
    setShowBeeSelector(false);
  };

  // Remove a track
  const removeTrack = (beeId: string) => {
    setTracks(prev => prev.filter(t => t.beeId !== beeId));
  };

  // Fit timeline to show all content
  const fitToContent = useCallback(() => {
    if (!timelineRef.current || tracks.length === 0) return;

    // Get the viewport width (minus header)
    const viewportWidth = timelineRef.current.clientWidth - HEADER_WIDTH;
    if (viewportWidth <= 0) return;

    // Get time range of all logs
    let minTime = Infinity;
    let maxTime = -Infinity;
    tracks.forEach(track => {
      track.logs.forEach(log => {
        const time = new Date(log.timestamp).getTime();
        if (time < minTime) minTime = time;
        if (time > maxTime) maxTime = time;
      });
    });

    if (minTime === Infinity) return;

    // Add padding
    const padding = 30000; // 30 seconds
    const duration = maxTime - minTime + padding * 2;

    // Calculate zoom to fit duration in viewport
    // viewportWidth = duration * (DEFAULT_PIXELS_PER_SECOND / 1000) * zoom
    // zoom = viewportWidth / (duration * DEFAULT_PIXELS_PER_SECOND / 1000)
    const idealZoom = viewportWidth / (duration * DEFAULT_PIXELS_PER_SECOND / 1000);

    // Clamp zoom between 0.01 and 20
    const clampedZoom = Math.max(0.01, Math.min(20, idealZoom));

    setZoom(clampedZoom);
    setPanX(0);
  }, [tracks]);

  // Fetch logs for all tracks
  const fetchAllLogs = useCallback(async () => {
    const updatedTracks = await Promise.all(
      tracks.map(async (track) => {
        try {
          const res = await fetch(`/api/bees/${track.beeId}/transcript`);
          if (res.ok) {
            const data = await res.json();
            const logsArray = Array.isArray(data) ? data : (data.logs || []);
            return {
              ...track,
              logs: logsArray.map((log: LogEntry) => ({
                ...log,
                beeId: track.beeId,
              })),
            };
          }
        } catch (err) {
          console.error(`Failed to fetch logs for ${track.beeId}:`, err);
        }
        return { ...track, logs: [] };
      })
    );
    setTracks(updatedTracks);
  }, [tracks.map(t => t.beeId).join(',')]);

  // Poll for updates
  useEffect(() => {
    if (tracks.length > 0) {
      fetchAllLogs();
      const interval = setInterval(fetchAllLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [tracks.length, fetchAllLogs]);

  // Calculate time range from all logs
  const timeRange = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;

    tracks.forEach(track => {
      track.logs.forEach(log => {
        const time = new Date(log.timestamp).getTime();
        if (time < minTime) minTime = time;
        if (time > maxTime) maxTime = time;
      });
    });

    if (minTime === Infinity) {
      const now = Date.now();
      return { start: now - 60000, end: now, duration: 60000 };
    }

    // Add some padding
    const padding = 30000; // 30 seconds
    return {
      start: minTime - padding,
      end: maxTime + padding,
      duration: maxTime - minTime + padding * 2,
    };
  }, [tracks]);

  // Pixels per millisecond at current zoom
  const pxPerMs = useMemo(() => {
    return (DEFAULT_PIXELS_PER_SECOND / 1000) * zoom;
  }, [zoom]);

  // Calculate clip positions for each track
  const trackClips = useMemo(() => {
    return tracks.map(track => {
      const clips: ClipData[] = [];
      const sortedLogs = [...track.logs].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      sortedLogs.forEach((log, i) => {
        const startTime = new Date(log.timestamp).getTime();
        const nextLog = sortedLogs[i + 1];
        const endTime = nextLog
          ? new Date(nextLog.timestamp).getTime()
          : startTime + 5000; // Default 5 second duration

        // Cap duration at 30 seconds max so clips don't get absurdly long for sparse events
        const rawDuration = endTime - startTime;
        const duration = Math.min(Math.max(rawDuration, 1000), 30000); // Min 1s, max 30s
        const x = (startTime - timeRange.start) * pxPerMs;
        const width = Math.max(duration * pxPerMs, MIN_CLIP_WIDTH);

        clips.push({ log, startTime, duration, x, width });
      });

      return clips;
    });
  }, [tracks, timeRange, pxPerMs]);

  // Timeline width in pixels
  const timelineWidth = useMemo(() => {
    return Math.max(timeRange.duration * pxPerMs, 1000);
  }, [timeRange, pxPerMs]);

  // Generate time ruler marks
  const rulerMarks = useMemo(() => {
    const marks: { time: number; x: number; label: string; major: boolean }[] = [];

    // Determine interval based on zoom
    let interval = 60000; // 1 minute default
    if (zoom > 2) interval = 30000;
    if (zoom > 4) interval = 10000;
    if (zoom > 8) interval = 5000;
    if (zoom < 0.5) interval = 120000;
    if (zoom < 0.25) interval = 300000;

    const startMark = Math.ceil(timeRange.start / interval) * interval;

    for (let time = startMark; time <= timeRange.end; time += interval) {
      const x = (time - timeRange.start) * pxPerMs;
      const date = new Date(time);
      const label = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: zoom > 2 ? '2-digit' : undefined,
        hour12: false,
      });
      marks.push({ time, x, label, major: time % (interval * 5) === 0 });
    }

    return marks;
  }, [timeRange, pxPerMs, zoom]);

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 20));
    } else {
      // Horizontal scroll for panning
      setPanX(prev => prev - e.deltaX - e.deltaY);
    }
  }, []);

  // Handle mouse drag for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !hoveredClip) {
      setIsDragging(true);
      setDragStartX(e.clientX);
      setDragStartPan(panX);
    }
  }, [panX, hoveredClip]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const delta = e.clientX - dragStartX;
      setPanX(dragStartPan + delta);
    }
  }, [isDragging, dragStartX, dragStartPan]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Update playhead on timeline click
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current || hoveredClip) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left - HEADER_WIDTH + (-panX);
    const time = timeRange.start + clickX / pxPerMs;
    setPlayheadTime(time);
  }, [timeRange, pxPerMs, panX, hoveredClip]);

  // Handle clip hover
  const handleClipMouseEnter = useCallback((
    clip: ClipData,
    trackIdx: number,
    e: React.MouseEvent
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredClip({
      clip,
      trackIdx,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const handleClipMouseLeave = useCallback(() => {
    setHoveredClip(null);
  }, []);

  // Format timestamp for tooltip
  const formatFullTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Available bees (not already in a track)
  const availableBees = bees.filter(b => !tracks.find(t => t.beeId === b.id));

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
            <span className="text-lg">🎬</span>
            <h1 className="text-sm font-medium text-stone-700">Timeline View</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Zoom controls */}
          <div className="flex items-center gap-2 bg-stone-100 rounded-lg px-2 py-1">
            <button
              onClick={() => setZoom(prev => Math.max(prev * 0.8, 0.1))}
              className="text-stone-500 hover:text-stone-700 p-1"
              title="Zoom out"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="5" />
                <path d="M11 11l3 3M5 7h4" />
              </svg>
            </button>
            <span className="text-xs text-stone-600 font-mono w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(prev * 1.25, 20))}
              className="text-stone-500 hover:text-stone-700 p-1"
              title="Zoom in"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="5" />
                <path d="M11 11l3 3M5 7h4M7 5v4" />
              </svg>
            </button>
            <button
              onClick={() => { setZoom(1); setPanX(0); }}
              className="text-xs text-stone-500 hover:text-stone-700 px-2"
              title="Reset to 100%"
            >
              Reset
            </button>
            <button
              onClick={fitToContent}
              className="text-xs text-amber-600 hover:text-amber-700 px-2 font-medium"
              title="Fit all content in view"
            >
              Fit
            </button>
          </div>

          {/* Add track button */}
          <div className="relative">
            <button
              onClick={() => setShowBeeSelector(!showBeeSelector)}
              disabled={availableBees.length === 0}
              className="px-3 py-1.5 text-xs rounded bg-amber-500 text-white hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add Track
            </button>

            {showBeeSelector && availableBees.length > 0 && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[150px] z-10">
                {availableBees.map(bee => (
                  <button
                    key={bee.id}
                    onClick={() => addTrack(bee)}
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

      {/* Timeline container */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-hidden flex flex-col"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleTimelineClick}
        style={{ cursor: isDragging ? 'grabbing' : 'default' }}
      >
        {tracks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-stone-400">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-30">🎬</div>
              <p className="mb-4 text-lg">No tracks added</p>
              <p className="text-sm mb-6 text-stone-400">Add bee tracks to see their activity on the timeline</p>
              <button
                onClick={() => setShowBeeSelector(true)}
                className="px-4 py-2 text-sm rounded bg-amber-500 text-white hover:bg-amber-400 transition-colors"
              >
                + Add Track
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Time ruler */}
            <div className="flex bg-white border-b border-stone-200" style={{ height: RULER_HEIGHT }}>
              {/* Header spacer */}
              <div
                className="flex-shrink-0 bg-stone-50 border-r border-stone-200 flex items-center justify-center"
                style={{ width: HEADER_WIDTH }}
              >
                <span className="text-xs text-stone-400 font-medium">TRACKS</span>
              </div>

              {/* Ruler content */}
              <div className="flex-1 relative overflow-hidden">
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    transform: `translateX(${panX}px)`,
                    width: timelineWidth,
                  }}
                >
                  {rulerMarks.map((mark, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 flex flex-col items-center"
                      style={{ left: mark.x }}
                    >
                      <div
                        className={`w-px ${mark.major ? 'bg-stone-400' : 'bg-stone-300'}`}
                        style={{ height: mark.major ? 12 : 8 }}
                      />
                      {mark.major && (
                        <span className="text-[10px] text-stone-500 font-mono mt-1 whitespace-nowrap">
                          {mark.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tracks area */}
            <div ref={contentRef} className="flex-1 overflow-y-auto">
              {tracks.map((track, trackIdx) => (
                <div
                  key={track.beeId}
                  className="flex border-b border-stone-200"
                  style={{ height: TRACK_HEIGHT }}
                >
                  {/* Track header */}
                  <div
                    className="flex-shrink-0 bg-white border-r border-stone-200 flex items-center justify-between px-3 gap-2"
                    style={{ width: HEADER_WIDTH }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">🐝</span>
                      <span className="text-sm font-medium text-stone-700 truncate">
                        {track.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-stone-400">
                        {track.logs.length}
                      </span>
                      <button
                        onClick={() => removeTrack(track.beeId)}
                        className="text-stone-300 hover:text-stone-500 transition-colors p-0.5"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 2l8 8M10 2L2 10" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Track content */}
                  <div className="flex-1 relative bg-stone-50/50 overflow-hidden">
                    {/* Grid lines */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        transform: `translateX(${panX}px)`,
                        width: timelineWidth,
                      }}
                    >
                      {rulerMarks.filter(m => m.major).map((mark, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-stone-200/50"
                          style={{ left: mark.x }}
                        />
                      ))}
                    </div>

                    {/* Clips */}
                    <div
                      className="absolute inset-0"
                      style={{
                        transform: `translateX(${panX}px)`,
                        width: timelineWidth,
                      }}
                    >
                      {trackClips[trackIdx]?.map((clip, clipIdx) => {
                        const colors = getClipColor(clip.log.type);
                        return (
                          <div
                            key={clipIdx}
                            className={`absolute top-2 bottom-2 rounded-md border ${colors.bg} ${colors.border} ${colors.text}
                              cursor-pointer shadow-sm hover:shadow-md hover:brightness-110 transition-all overflow-hidden`}
                            style={{
                              left: clip.x,
                              width: clip.width,
                            }}
                            onMouseEnter={(e) => handleClipMouseEnter(clip, trackIdx, e)}
                            onMouseLeave={handleClipMouseLeave}
                          >
                            <div className="px-2 py-1 h-full flex flex-col justify-center">
                              <span className="text-[10px] font-bold opacity-90 truncate">
                                {getTypeLabel(clip.log.type)}
                              </span>
                              {clip.width > 100 && (
                                <span className="text-[9px] opacity-75 truncate">
                                  {clip.log.message?.slice(0, 30) ||
                                    clip.log.toolName ||
                                    clip.log.subject ||
                                    ''}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Playhead */}
                    {playheadTime && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                        style={{
                          left: (playheadTime - timeRange.start) * pxPerMs + panX,
                        }}
                      >
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rotate-45" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clip tooltip/popover */}
      {hoveredClip && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-stone-200 p-3 max-w-xs pointer-events-none"
          style={{
            left: Math.min(hoveredClip.x, window.innerWidth - 320),
            top: hoveredClip.y - 10,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                getClipColor(hoveredClip.clip.log.type).bg
              } ${getClipColor(hoveredClip.clip.log.type).text}`}
            >
              {getTypeLabel(hoveredClip.clip.log.type)}
            </span>
            <span className="text-xs text-stone-400 font-mono">
              {formatFullTime(hoveredClip.clip.log.timestamp)}
            </span>
          </div>

          {hoveredClip.clip.log.message && (
            <p className="text-sm text-stone-700 mb-2 line-clamp-3">
              {hoveredClip.clip.log.message}
            </p>
          )}

          {hoveredClip.clip.log.toolName && (
            <p className="text-xs text-blue-600 font-mono mb-1">
              Tool: {hoveredClip.clip.log.toolName}
            </p>
          )}

          {hoveredClip.clip.log.from && (
            <p className="text-xs text-purple-600 mb-1">
              From: {hoveredClip.clip.log.from}
            </p>
          )}

          {hoveredClip.clip.log.to && (
            <p className="text-xs text-amber-600 mb-1">
              To: {hoveredClip.clip.log.to}
            </p>
          )}

          {hoveredClip.clip.log.subject && (
            <p className="text-xs text-stone-500 italic">
              Subject: {hoveredClip.clip.log.subject}
            </p>
          )}

          <div className="mt-2 pt-2 border-t border-stone-100 text-[10px] text-stone-400">
            Duration: {Math.round(hoveredClip.clip.duration / 1000)}s
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="h-10 bg-white border-t border-stone-200 flex items-center justify-center gap-6 px-4">
        {[
          { type: 'mail_received', label: 'Received' },
          { type: 'mail_sent', label: 'Sent' },
          { type: 'tool_call', label: 'Tool Call' },
          { type: 'tool_result', label: 'Result' },
          { type: 'claude_request', label: 'Think' },
        ].map(({ type, label }) => {
          const colors = getClipColor(type);
          return (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${colors.bg} ${colors.border} border`} />
              <span className="text-xs text-stone-500">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
