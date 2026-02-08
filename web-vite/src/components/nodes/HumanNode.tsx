import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { HumanNodeData } from '../../types';

function HumanNodeComponent({ data, selected }: NodeProps<HumanNodeData>) {
  return (
    <div className="relative">
      {/* Top handle - hidden but present for consistency */}
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        className="!w-2 !h-2 !bg-amber-400 !border !border-amber-600 !-top-1 !opacity-0"
      />

      {/* Card */}
      <div
        className={`
          bg-amber-50 rounded-lg px-4 py-3 min-w-[140px]
          border transition-all duration-200 cursor-pointer
          ${selected
            ? 'border-amber-400 shadow-md'
            : 'border-amber-200 hover:border-amber-300 hover:shadow-sm'
          }
        `}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg" role="img" aria-label="human">👤</span>
          <span className="font-medium text-stone-800 text-sm">{data.label}</span>
        </div>

        {/* Subtitle */}
        <span className="text-xs text-stone-400">Click to compose</span>
      </div>

      {/* Bottom handle - delegates tasks to bees */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        className="!w-2 !h-2 !bg-amber-400 !border !border-amber-600 !-bottom-1"
      />
    </div>
  );
}

export const HumanNode = memo(HumanNodeComponent);
