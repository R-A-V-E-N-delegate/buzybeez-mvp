import { useState } from 'react';
import { BeeNodeData } from '../../types';

interface BeeControlModalProps {
  bee: BeeNodeData & { id: string };
  onClose: () => void;
  onStart: (beeId: string) => Promise<void>;
  onStop: (beeId: string) => Promise<void>;
}

export function BeeControlModal({ bee, onClose, onStart, onStop }: BeeControlModalProps) {
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
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl min-w-[360px] max-w-[480px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-honey-500 to-honey-600 text-white">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span role="img" aria-label="bee">&#128029;</span>
            {bee.label}
          </h3>
          <button
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-2xl transition-colors"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="flex items-center gap-2.5 p-4 bg-gray-100 rounded-lg mb-4">
            <span
              className={`w-3 h-3 rounded-full ${
                bee.running ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-base">{bee.running ? 'Running' : 'Stopped'}</span>
          </div>

          <div className="flex justify-center">
            {bee.running ? (
              <button
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white font-medium shadow-lg shadow-red-500/30 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleStop}
                disabled={loading}
              >
                {loading ? 'Stopping...' : 'Stop Bee'}
              </button>
            ) : (
              <button
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-honey-500 to-honey-600 text-white font-medium shadow-lg shadow-honey-500/30 hover:shadow-honey-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleStart}
                disabled={loading}
              >
                {loading ? 'Starting...' : 'Start Bee'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
