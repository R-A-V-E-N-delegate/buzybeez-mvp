import { useState } from 'react';

interface AddBeeModalProps {
  onClose: () => void;
  onAdd: (id: string, name: string) => Promise<void>;
}

export function AddBeeModal({ onClose, onAdd }: AddBeeModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const id = 'bee-' + Date.now().toString(36);
    await onAdd(id, name);
    setLoading(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/20 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-[360px] shadow-xl border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <h3 className="text-sm font-medium text-stone-800 flex items-center gap-2">
            <span>🐝</span>
            Add New Bee
          </h3>
          <button
            className="w-6 h-6 rounded hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleAdd}>
          {/* Body */}
          <div className="p-4">
            <div className="form-group">
              <label>Bee Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Research Bee"
                autoFocus
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-stone-100">
            <button
              type="button"
              className="btn secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={loading || !name.trim()}
            >
              {loading ? 'Adding...' : 'Add Bee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
