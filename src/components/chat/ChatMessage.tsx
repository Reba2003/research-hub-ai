import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { CitationChip } from './CitationChip';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';

  // Parse message content for inline citations
  const renderContent = () => {
    if (!message.citations?.length) {
      return <p className="whitespace-pre-wrap">{message.content}</p>;
    }

    // Simple rendering with citations at the end
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.citations.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {message.citations.map((citation) => (
              <CitationChip key={citation.id} citation={citation} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
          isAssistant ? 'bg-primary/10 text-primary' : 'bg-secondary text-foreground'
        }`}
      >
        {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isAssistant
            ? 'rounded-tl-sm bg-card border border-border'
            : 'rounded-tr-sm bg-primary text-primary-foreground'
        }`}
      >
        <div className={`text-sm ${isAssistant ? 'text-foreground' : 'text-primary-foreground'}`}>
          {renderContent()}
        </div>
        <p className={`mt-2 text-xs ${isAssistant ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}
