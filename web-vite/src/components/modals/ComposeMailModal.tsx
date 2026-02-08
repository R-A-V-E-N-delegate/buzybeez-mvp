import { useState, useEffect } from 'react';
import { Connection } from '../../types';

interface ComposeMailModalProps {
  connections: Connection[];
  onClose: () => void;
  onSend: (to: string, subject: string, body: string) => Promise<void>;
}

export function ComposeMailModal({ connections, onClose, onSend }: ComposeMailModalProps) {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter connections from human
  const availableRecipients = connections
    .filter((c) => c.from === 'human' && c.to !== 'human')
    .map((c) => c.to);

  useEffect(() => {
    if (availableRecipients.length > 0 && !recipient) {
      setRecipient(availableRecipients[0]);
    }
  }, [availableRecipients, recipient]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !subject.trim() || !body.trim()) return;

    setLoading(true);
    await onSend(recipient, subject, body);
    setLoading(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/20 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-[420px] shadow-xl border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <h3 className="text-sm font-medium text-stone-800 flex items-center gap-2">
            <span>✉️</span>
            Compose Mail
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

        <form onSubmit={handleSend}>
          {/* Body */}
          <div className="p-4">
            {availableRecipients.length === 0 ? (
              <div className="text-center py-6 text-stone-400 text-sm">
                No connected bees. Draw a connection from Human to a bee first.
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>To</label>
                  <select
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  >
                    {availableRecipients.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter subject..."
                  />
                </div>

                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your message..."
                    rows={4}
                    className="resize-y min-h-[80px]"
                  />
                </div>
              </>
            )}
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
            {availableRecipients.length > 0 && (
              <button
                type="submit"
                className="btn primary"
                disabled={loading || !subject.trim() || !body.trim()}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
