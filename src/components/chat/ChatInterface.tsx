import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { useResearchStore } from '@/hooks/useResearchStore';
import { streamChat, createMessage } from '@/lib/api';
import { toast } from 'sonner';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatInterfaceProps {
  className?: string;
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const { messages, addMessage, updateMessage, isTyping, setIsTyping, sources } = useResearchStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const enabledSources = sources.filter((s) => s.enabled && s.status === 'ready');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userContent = input.trim();
    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setInput('');
    setIsTyping(true);

    // Create placeholder for assistant message
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessageType = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    addMessage(assistantMessage);

    // Save user message to database
    createMessage({ role: 'user', content: userContent }).catch(console.error);

    // Get enabled source IDs
    const sourceIds = enabledSources.map(s => s.id);

    // Build message history for context
    const messageHistory = messages
      .filter(m => m.content.trim())
      .map(m => ({ role: m.role, content: m.content }));
    messageHistory.push({ role: 'user', content: userContent });

    let fullContent = '';

    await streamChat({
      messages: messageHistory,
      sourceIds,
      onDelta: (delta) => {
        fullContent += delta;
        updateMessage(assistantId, { content: fullContent });
      },
      onDone: () => {
        setIsTyping(false);
        // Save assistant message to database
        if (fullContent) {
          createMessage({ role: 'assistant', content: fullContent }).catch(console.error);
        }
      },
      onError: (error) => {
        setIsTyping(false);
        updateMessage(assistantId, { 
          content: 'Sorry, I encountered an error. Please try again.' 
        });
        toast.error(error.message || 'Failed to get response');
      },
    });
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
                Ask questions about your uploaded sources. I'll provide answers with insights
                from your study materials.
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
            {isTyping && messages[messages.length - 1]?.content === '' && (
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
