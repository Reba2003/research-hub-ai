import { create } from 'zustand';
import type { Source, ChatMessage, Summary, PodcastScript, QuizQuestion, OutputTab } from '@/types';

interface ResearchStore {
  // Sources
  sources: Source[];
  addSource: (source: Source) => void;
  removeSource: (id: string) => void;
  toggleSource: (id: string) => void;
  updateSourceStatus: (id: string, status: Source['status']) => void;
  clearSources: () => void;

  // Chat
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;

  // Conversations
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  // Output
  activeOutputTab: OutputTab;
  setActiveOutputTab: (tab: OutputTab) => void;
  summary: Summary | null;
  setSummary: (summary: Summary | null) => void;
  podcast: PodcastScript | null;
  setPodcast: (podcast: PodcastScript | null) => void;
  quizQuestions: QuizQuestion[];
  setQuizQuestions: (questions: QuizQuestion[]) => void;

  // UI State
  isMobileSourcesOpen: boolean;
  setMobileSourcesOpen: (open: boolean) => void;
  selectedCitation: string | null;
  setSelectedCitation: (id: string | null) => void;
}

export const useResearchStore = create<ResearchStore>((set) => ({
  // Sources
  sources: [],
  addSource: (source) => set((state) => ({ sources: [...state.sources, source] })),
  removeSource: (id) => set((state) => ({ sources: state.sources.filter((s) => s.id !== id) })),
  toggleSource: (id) => set((state) => ({
    sources: state.sources.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
  })),
  updateSourceStatus: (id, status) => set((state) => ({
    sources: state.sources.map((s) => (s.id === id ? { ...s, status } : s)),
  })),

  // Chat
  messages: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
  })),
  clearMessages: () => set({ messages: [] }),
  setMessages: (messages) => set({ messages }),
  isTyping: false,
  setIsTyping: (typing) => set({ isTyping: typing }),

  // Conversations
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  // Output
  activeOutputTab: 'summary',
  setActiveOutputTab: (tab) => set({ activeOutputTab: tab }),
  summary: null,
  setSummary: (summary) => set({ summary }),
  podcast: null,
  setPodcast: (podcast) => set({ podcast }),
  quizQuestions: [],
  setQuizQuestions: (questions) => set({ quizQuestions: questions }),

  // UI State
  isMobileSourcesOpen: false,
  setMobileSourcesOpen: (open) => set({ isMobileSourcesOpen: open }),
  selectedCitation: null,
  setSelectedCitation: (id) => set({ selectedCitation: id }),
}));
