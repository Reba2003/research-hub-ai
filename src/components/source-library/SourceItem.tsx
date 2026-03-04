import { motion } from 'framer-motion';
import { FileText, Video, Music, Type, Youtube, Image, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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

export function SourceItem({ source, onToggle, onRemove, isSelected }: SourceItemProps) {
  const Icon = iconMap[source.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
        isSelected
          ? 'bg-primary/10'
          : 'hover:bg-secondary/50'
      }`}
    >
      {/* Icon */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Name */}
      <span className={`flex-1 truncate text-sm ${
        source.enabled ? 'text-foreground' : 'text-muted-foreground'
      }`}>
        {source.name}
      </span>

      {/* Status */}
      {source.status === 'processing' && (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-warning" />
      )}
      {source.status === 'error' && (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
      )}

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </Button>

      {/* Checkbox toggle */}
      <Checkbox
        checked={source.enabled}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
    </motion.div>
  );
}
