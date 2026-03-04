import { motion } from 'framer-motion';
import { FileText, Video, Music, Type, Youtube, Image, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type { Source } from '@/types';

interface SourceItemProps {
  source: Source;
  onToggle: () => void;
  onRemove: () => void;
  isSelected?: boolean;
}

const iconMap = {
  pdf: FileText,
  video: Video,
  audio: Music,
  text: Type,
  youtube: Youtube,
  image: Image,
};

const statusColors = {
  idle: 'bg-muted',
  processing: 'bg-warning',
  completed: 'bg-success',
  error: 'bg-destructive',
};

export function SourceItem({ source, onToggle, onRemove, isSelected }: SourceItemProps) {
  const Icon = iconMap[source.type];

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`group relative flex items-center gap-2 rounded-lg border p-2 transition-all ${
        isSelected
          ? 'border-primary/50 bg-primary/10'
          : source.enabled
          ? 'border-border bg-card hover:border-primary/30'
          : 'border-border/50 bg-card/50'
      }`}
    >
      {/* Status indicator */}
      <div className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full ${statusColors[source.status]}`} />

      {/* Icon */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
        source.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${
          source.enabled ? 'text-foreground' : 'text-muted-foreground'
        }`}>
          {source.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {source.pageCount && <span>{source.pageCount} pages</span>}
          {source.duration && <span>{formatDuration(source.duration)}</span>}
          {source.size && <span>{formatSize(source.size)}</span>}
        </div>
      </div>

      {/* Status icon */}
      <div className="flex items-center gap-2">
        {source.status === 'processing' && (
          <Loader2 className="h-4 w-4 animate-spin text-warning" />
        )}
        {source.status === 'completed' && (
          <CheckCircle2 className="h-4 w-4 text-success" />
        )}
        {source.status === 'error' && (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}

        {/* Toggle */}
        <Switch
          checked={source.enabled}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-primary"
        />

        {/* Remove button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </motion.div>
  );
}
