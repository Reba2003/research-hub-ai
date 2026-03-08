import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { CitationChip } from './CitationChip';
import { useResearchStore } from '@/hooks/useResearchStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

/**
 * Parse a timestamp string like "2:30" or "1:02:15" into total seconds.
 */
function timestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/**
 * Renders message content with clickable timestamp citations.
 * Matches patterns like [Source Name, @2:30] or [@1:15] and turns
 * the timestamp portion into a link that opens YouTube at that time.
 */
function RichContent({ content, sources }: { content: string; sources: { id: string; name: string; type: string; file_url?: string }[] }) {
  // Find YouTube sources to resolve URLs
  const youtubeSource = sources.find(s => s.type === 'youtube');

  // Regex to match citations with timestamps: [anything, @M:SS] or [anything, @H:MM:SS]
  // Also matches standalone [@M:SS] patterns
  const citationRegex = /\[([^\]]*?),?\s*@(\d+:\d{2}(?::\d{2})?)\s*(?:-\s*@?\d+:\d{2}(?::\d{2})?)?\]/g;

  const parts: Array<{ type: 'text'; value: string } | { type: 'timestamp'; label: string; timestamp: string; fullMatch: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = citationRegex.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }

    const sourceName = match[1].trim();
    const timestamp = match[2];
    parts.push({
      type: 'timestamp',
      label: sourceName ? `${sourceName}, @${timestamp}` : `@${timestamp}`,
      timestamp,
      fullMatch: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }

  // If no timestamps found, just render plain text
  if (parts.length === 1 && parts[0].type === 'text') {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.value}</span>;
        }

        const seconds = timestampToSeconds(part.timestamp);

        // Try to build a YouTube URL
        let youtubeUrl: string | null = null;
        if (youtubeSource) {
          // Extract video ID from the source's file_url
          const fileUrl = youtubeSource.file_url || '';
          const vidMatch = fileUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (vidMatch) {
            youtubeUrl = `https://www.youtube.com/watch?v=${vidMatch[1]}&t=${seconds}s`;
          }
        }

        if (youtubeUrl) {
          return (
            <a
              key={i}
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary transition-all hover:border-primary/50 hover:bg-primary/20 cursor-pointer no-underline"
              title={`Open video at ${part.timestamp}`}
            >
              ▶ {part.timestamp}
            </a>
          );
        }

        // Non-YouTube timestamp - render as styled span
        return (
          <span
            key={i}
            className="inline-flex items-center gap-0.5 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
          >
            [{part.label}]
          </span>
        );
      })}
    </p>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';
  const { sources } = useResearchStore();

  const renderContent = () => {
    // Map store sources to the shape RichContent needs
    const sourcesForRich = sources.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      file_url: s.file_url,
    }));

    return (
      <div className="space-y-3">
        <RichContent content={message.content} sources={sourcesForRich} />
        {message.citations && message.citations.length > 0 && (
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
