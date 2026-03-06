import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface Message {
  role: 'bot' | 'user';
  text: string;
}

const INITIAL_MSG: Message = {
  role: 'bot',
  text: '¡Hola! 👋 Soy el asistente de Ocean Drive.\nPuedo ayudarte con información sobre nuestros vehículos, precios y reservas.\n¿En qué puedo ayudarte?',
};

const PLACEHOLDER_REPLY: Message = {
  role: 'bot',
  text: 'Estamos configurando el asistente.\nEn breve estará disponible.\nMientras puedes contactarnos por teléfono.',
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MSG]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [...m, PLACEHOLDER_REPLY]);
      setTyping(false);
    }, 1200);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(true)}
              className="fixed bottom-6 right-6 z-[9999] h-[60px] w-[60px] rounded-full bg-cta text-cta-foreground shadow-lg flex items-center justify-center animate-pulse hover:animate-none hover:scale-105 transition-transform"
              aria-label="Abrir chat"
            >
              <MessageCircle className="h-7 w-7" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">¿Necesitas ayuda? 💬</TooltipContent>
        </Tooltip>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden bg-background w-[360px] h-[500px] max-sm:inset-4 max-sm:w-auto max-sm:h-auto max-sm:bottom-4 max-sm:right-4 max-sm:left-4 max-sm:top-16">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground shrink-0">
            <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Bot className="h-5 w-5" />
            </div>
            <span className="font-semibold text-sm flex-1">Asistente Ocean Drive</span>
            <button onClick={() => setOpen(false)} className="hover:opacity-80">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-cta text-cta-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-4 py-2 text-sm text-muted-foreground">
                  <span className="animate-pulse">●●●</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Escribe tu mensaje…"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className="h-9 w-9 rounded-lg bg-cta text-cta-foreground flex items-center justify-center disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
