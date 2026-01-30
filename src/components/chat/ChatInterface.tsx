import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { useResearchStore } from '@/hooks/useResearchStore';
import type { ChatMessage as ChatMessageType, Citation } from '@/types';

interface ChatInterfaceProps {
  className?: string;
}

// Mock responses with citations
const mockResponses = [
  {
    content: "Based on your sources, I found several key insights about this topic. The main argument presented suggests a paradigm shift in the field, supported by empirical evidence from multiple studies.",
    citations: [
      { id: '1', sourceId: 's1', sourceName: 'Research Paper.pdf', sourceType: 'pdf' as const, location: 'PDF, p. 82', page: 82, text: 'Key finding' },
      { id: '2', sourceId: 's2', sourceName: 'Lecture Video', sourceType: 'video' as const, location: 'Video, 12:45', timestamp: 765, text: 'Supporting evidence' },
    ],
  },
  {
    content: "The analysis reveals three distinct phases in the development process. Each phase builds upon the previous one, creating a cumulative effect that's well-documented across your uploaded materials.",
    citations: [
      { id: '3', sourceId: 's3', sourceName: 'YouTube Lecture', sourceType: 'youtube' as const, location: 'YT, 06:53', timestamp: 413, text: 'Phase breakdown' },
      { id: '4', sourceId: 's1', sourceName: 'Research Paper.pdf', sourceType: 'pdf' as const, location: 'PDF, p. 156', page: 156, text: 'Statistical analysis' },
    ],
  },
];

export function ChatInterface({ className }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const { messages, addMessage, isTyping, setIsTyping, sources } = useResearchStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const enabledSources = sources.filter((s) => s.enabled);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const mockResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      const assistantMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: mockResponse.content,
        citations: mockResponse.citations,
        timestamp: new Date(),
      };
      addMessage(assistantMessage);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex h-full flex-col bg-background ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Research Assistant</h2>
            <p className="text-xs text-muted-foreground">
              {enabledSources.length > 0
                ? `Analyzing ${enabledSources.length} source${enabledSources.length > 1 ? 's' : ''}`
                : 'Upload sources to begin'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="space-y-6 py-6">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">Start Researching</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ask questions about your uploaded sources. I'll provide answers with precise citations
                you can click to jump to the source.
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </AnimatePresence>
          )}

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Analyzing sources...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-3">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={enabledSources.length > 0 ? "Ask about your sources..." : "Upload sources first..."}
            disabled={enabledSources.length === 0}
            className="min-h-[52px] max-h-32 resize-none border-border bg-card"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isTyping || enabledSources.length === 0}
            className="h-[52px] w-[52px] shrink-0"
          >
            {isTyping ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
