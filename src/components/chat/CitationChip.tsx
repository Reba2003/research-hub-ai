import { motion } from 'framer-motion';
import { FileText, Video, Music, Youtube, Image, Type, ExternalLink } from 'lucide-react';
import type { Citation } from '@/types';
import { useResearchStore } from '@/hooks/useResearchStore';

interface CitationChipProps {
  citation: Citation;
  onClick?: () => void;
}

const iconMap = {
  pdf: FileText,
  video: Video,
  audio: Music,
  text: Type,
  youtube: Youtube,
  image: Image,
};

export function CitationChip({ citation, onClick }: CitationChipProps) {
  const Icon = iconMap[citation.sourceType];
  const { setSelectedCitation } = useResearchStore();

  const handleClick = () => {
    setSelectedCitation(citation.sourceId);
    onClick?.();
  };

  return (
    <motion.button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-all hover:border-primary/50 hover:bg-primary/20"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Icon className="h-3 w-3" />
      <span>{citation.location}</span>
      <ExternalLink className="h-3 w-3 opacity-50" />
    </motion.button>
  );
}
