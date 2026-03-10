import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Mic } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LanguageContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME_MSGS: Record<string, string> = {
  es: '¡Hola! Soy Guaci, tu asistente personal de Ocean Drive.\n¿En qué puedo ayudarte?',
  en: "Hi! I'm Guaci, your Ocean Drive personal assistant.\nHow can I help you?",
  de: 'Hallo! Ich bin Guaci, dein persönlicher Ocean Drive Assistent.\nWie kann ich dir helfen?',
  sv: 'Hej! Jag är Guaci, din personliga Ocean Drive-assistent.\nHur kan jag hjälpa dig?',
  no: 'Hei! Jeg er Guaci, din personlige Ocean Drive-assistent.\nHvordan kan jeg hjelpe deg?',
  fr: "Bonjour ! Je suis Guaci, votre assistant personnel Ocean Drive.\nComment puis-je vous aider ?",
};

export default function ChatWidget() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, typing]);

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updated = [...history, userMsg];
    setHistory(updated);
    setInput('');
    setTyping(true);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/chat_assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ messages: updated, lang }),
        }
      );
      const data = await response.json();
      const reply = data.reply || 'Lo siento, no pude procesar tu mensaje. Inténtalo de nuevo.';
      setHistory((h) => [...h, { role: 'assistant', content: reply }]);
    } catch {
      setHistory((h) => [
        ...h,
        { role: 'assistant', content: 'Error de conexión. Inténtalo de nuevo más tarde.' },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const texto = event.results[0][0].transcript;
      setInput(texto);
    };
    recognition.start();
  };

  // Display messages: prepend welcome message as assistant
  const displayMessages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'assistant', content: WELCOME_MSGS[lang] || WELCOME_MSGS.es },
    ...history,
  ];

  return (
    <>
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

      {open && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden bg-background w-[360px] h-[500px] max-sm:inset-4 max-sm:w-auto max-sm:h-auto max-sm:bottom-4 max-sm:right-4 max-sm:left-4 max-sm:top-16">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground shrink-0">
            <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Bot className="h-5 w-5" />
            </div>
            <span className="font-semibold text-sm flex-1">Guaci – Ocean Drive</span>
            <button onClick={() => setOpen(false)} className="hover:opacity-80">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {displayMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-cta text-cta-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  {m.content}
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
              onClick={startListening}
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                listening
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
              aria-label="Micrófono"
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              onClick={send}
              disabled={!input.trim() || typing}
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
