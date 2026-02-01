export type SourceType = 'pdf' | 'video' | 'audio' | 'text' | 'youtube' | 'image';

export type ProcessingStatus = 'idle' | 'processing' | 'completed' | 'ready' | 'error';

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  enabled: boolean;
  status: ProcessingStatus;
  uploadedAt: Date;
  size?: number;
  duration?: number;
  pageCount?: number;
  thumbnailUrl?: string;
}

export interface Citation {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  location: string;
  page?: number;
  timestamp?: number;
  text: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  sourceId: string;
}

export interface PodcastScript {
  id: string;
  title: string;
  segments: PodcastSegment[];
  audioUrl?: string;
  duration?: number;
}

export interface PodcastSegment {
  id: string;
  speaker: 'host' | 'expert';
  content: string;
  timestamp: number;
}

export interface Summary {
  id: string;
  title: string;
  sections: SummarySection[];
  generatedAt: Date;
}

export interface SummarySection {
  id: string;
  heading: string;
  content: string;
  citations: Citation[];
}

export type OutputTab = 'summary' | 'podcast' | 'quiz';
