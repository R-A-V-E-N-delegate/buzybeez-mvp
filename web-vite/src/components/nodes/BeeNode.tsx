import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { BeeNodeData } from '../../types';

function BeeNodeComponent({ data, selected }: NodeProps<BeeNodeData>) {
  const isRunning = data.running;
  const mailCounts = data.mailCounts;

  return (
    <div className="relative">
      {/* Top handle - receives tasks from upstream */}
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        className="!w-2 !h-2 !bg-amber-400 !border !border-amber-600 !-top-1"
      />

      {/* Card */}
      <div
        className={`
          bg-cream-50 rounded-lg px-4 py-3 min-w-[140px]
          border transition-all duration-200 cursor-pointer
          ${selected
            ? 'border-amber-400 shadow-md'
            : 'border-stone-200 hover:border-amber-300 hover:shadow-sm'
          }
        `}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg" role="img" aria-label="bee">🐝</span>
          <span className="font-medium text-stone-800 text-sm">{data.label}</span>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? 'bg-emerald-500' : 'bg-stone-300'
            }`}
          />
          <span className={`text-xs ${isRunning ? 'text-emerald-600' : 'text-stone-400'}`}>
            {isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>

        {/* Mail counts - subtle badges */}
        {mailCounts && (mailCounts.inbox > 0 || mailCounts.outbox > 0) && (
          <div className="flex gap-2 mt-2 pt-2 border-t border-stone-100">
            {mailCounts.inbox > 0 && (
              <span className="text-xs text-stone-500">
                <span className="text-amber-600 font-medium">{mailCounts.inbox}</span> in
              </span>
            )}
            {mailCounts.outbox > 0 && (
              <span className="text-xs text-stone-500">
                <span className="text-amber-600 font-medium">{mailCounts.outbox}</span> out
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom handle - delegates to downstream */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        className="!w-2 !h-2 !bg-amber-400 !border !border-amber-600 !-bottom-1"
      />
    </div>
  );
}

export const BeeNode = memo(BeeNodeComponent);
