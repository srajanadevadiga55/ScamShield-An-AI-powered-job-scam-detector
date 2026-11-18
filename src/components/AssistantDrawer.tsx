import { useState, useRef, useEffect } from 'react';
import { X, Send, Trash2, Shield, Loader2 } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: string;
}

const SUGGESTED_QUESTIONS = [
  'How do I spot a fake work-from-home offer?',
  'Is a refundable registration fee normal?',
  'How should I interpret a Medium Risk score?',
  'What checks should I run before sending my ID?',
];

export function AssistantDrawer({ isOpen, onClose, initialContext }: AssistantDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello, I am ScamShield Assistant. Ask me about job scam indicators, suspicious recruitment emails, risk scores, or how to verify an employer safely.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    if (initialContext && isOpen) {
      setInput(`Can you explain this scan result and what I should do next?\n`);
    }
  }, [initialContext, isOpen]);

  if (!isOpen) return null;

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await apiRequest<{ reply: string; source: string }>('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: nextMessages,
          scanContext: initialContext || undefined,
        }),
      });
      setMessages([...nextMessages, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md h-full bg-[#0B1222] border-l border-slate-800 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">ScamShield Assistant</h3>
              <p className="text-xs text-slate-400">Recruitment Safety Guidance</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    role: 'assistant',
                    content: 'Chat cleared. How can I help you evaluate a job offer or recruitment message?',
                  },
                ])
              }
              title="Clear chat"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {initialContext && (
          <div className="px-5 py-2.5 bg-blue-950/30 border-b border-slate-800 text-xs text-blue-200">
            Scan context attached for this conversation.
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#111C33] border border-slate-800 text-slate-200'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-xl bg-[#111C33] border border-slate-800 px-4 py-2.5 text-xs text-slate-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                Thinking...
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="px-5 py-3 border-t border-slate-800 space-y-3 bg-[#070C18]">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="text-left text-xs rounded-lg border border-slate-800 bg-[#0D1528] px-2.5 py-1.5 text-slate-300 hover:border-blue-500/50 hover:text-white transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a suspicious offer or risk score..."
              className="flex-1 rounded-lg border border-slate-700 bg-[#0D1528] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
