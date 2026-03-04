import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2, Image as ImageIcon, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChatMessage } from './ChatMessage';
import { useResearchStore } from '@/hooks/useResearchStore';
import { streamChat, createMessage, type ModelProvider } from '@/lib/api';
import { toast } from 'sonner';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatInterfaceProps {
  className?: string;
}

const MODEL_OPTIONS: { value: ModelProvider; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Lovable AI (default)' },
  { value: 'gemini', label: 'Gemini Flash', description: 'Vision & reasoning (OpenRouter)' },
  { value: 'openai', label: 'GPT-4o', description: 'OpenAI (OpenRouter)' },
  { value: 'deepseek', label: 'DeepSeek', description: 'DeepSeek Chat (OpenRouter)' },
];

export function ChatInterface({ className }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<ModelProvider>('auto');
  const [attachedImage, setAttachedImage] = useState<{ url: string; file: File } | null>(null);
  const { messages, addMessage, updateMessage, isTyping, setIsTyping, sources, activeConversationId } = useResearchStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enabledSources = sources.filter((s) => s.enabled && s.status === 'ready');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage({ url: reader.result as string, file });
      // Auto-switch to Gemini for vision when image is attached
      if (selectedModel === 'auto') {
        setSelectedModel('gemini');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || isTyping) return;

    const userContent = input.trim();
    const hasImage = !!attachedImage;

    // Build message content (multimodal if image attached)
    let messageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    let displayContent = userContent;

    if (attachedImage) {
      messageContent = [];
      if (userContent) {
        messageContent.push({ type: 'text', text: userContent });
      } else {
        messageContent.push({ type: 'text', text: 'Analyze this image.' });
        displayContent = '📎 [Image attached]';
      }
      messageContent.push({ type: 'image_url', image_url: { url: attachedImage.url } });
      if (userContent) {
        displayContent = `📎 [Image] ${userContent}`;
      }
    } else {
      messageContent = userContent;
    }

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayContent,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setInput('');
    setAttachedImage(null);
    setIsTyping(true);

    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessageType = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    addMessage(assistantMessage);

    createMessage({ role: 'user', content: displayContent, conversation_id: activeConversationId || undefined }).catch(console.error);

    const sourceIds = enabledSources.map(s => s.id);

    const messageHistory: Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = messages
      .filter(m => m.content.trim())
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));
    messageHistory.push({ role: 'user', content: messageContent });

    let fullContent = '';

    await streamChat({
      messages: messageHistory,
      sourceIds,
      modelProvider: hasImage ? 'gemini' : selectedModel,
      hasImage,
      onDelta: (delta) => {
        fullContent += delta;
        updateMessage(assistantId, { content: fullContent });
      },
      onDone: () => {
        setIsTyping(false);
        if (fullContent) {
          createMessage({ role: 'assistant', content: fullContent, conversation_id: activeConversationId || undefined }).catch(console.error);
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

  const currentModel = MODEL_OPTIONS.find(m => m.value === selectedModel) || MODEL_OPTIONS[0];

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

        {/* Model Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              {currentModel.label}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {MODEL_OPTIONS.map((model) => (
              <DropdownMenuItem
                key={model.value}
                onClick={() => setSelectedModel(model.value)}
                className={selectedModel === model.value ? 'bg-accent' : ''}
              >
                <div>
                  <div className="font-medium">{model.label}</div>
                  <div className="text-xs text-muted-foreground">{model.description}</div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
                Ask questions about your uploaded sources. Attach images for visual analysis with Gemini 3 Flash.
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </AnimatePresence>
          )}

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

      {/* Image preview */}
      <AnimatePresence>
        {attachedImage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border px-4 pt-3"
          >
            <div className="relative inline-block">
              <img
                src={attachedImage.url}
                alt="Attached"
                className="h-20 w-20 rounded-lg object-cover border border-border"
              />
              <button
                onClick={() => setAttachedImage(null)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-[52px] w-[52px] shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isTyping}
            title="Attach image for visual analysis"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              attachedImage
                ? "Describe what you want to know about this image..."
                : enabledSources.length > 0
                ? "Ask about your sources..."
                : "Upload sources first..."
            }
            disabled={enabledSources.length === 0 && !attachedImage}
            className="min-h-[52px] max-h-32 resize-none border-border bg-card"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={(!input.trim() && !attachedImage) || isTyping || (enabledSources.length === 0 && !attachedImage)}
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
