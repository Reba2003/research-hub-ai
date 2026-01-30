import { motion } from 'framer-motion';
import { FileText, Mic, Brain, Layers } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SummaryTab } from './SummaryTab';
import { PodcastTab } from './PodcastTab';
import { QuizTab } from './QuizTab';
import { useResearchStore } from '@/hooks/useResearchStore';
import type { OutputTab } from '@/types';

interface OutputEngineProps {
  className?: string;
}

export function OutputEngine({ className }: OutputEngineProps) {
  const { activeOutputTab, setActiveOutputTab, summary, podcast, quizQuestions } = useResearchStore();

  return (
    <div className={`flex h-full flex-col bg-sidebar ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-sidebar-border p-4">
        <Layers className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-foreground">Output Engine</h2>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeOutputTab}
        onValueChange={(v) => setActiveOutputTab(v as OutputTab)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="mx-4 mt-4 grid w-auto grid-cols-3 bg-secondary">
          <TabsTrigger value="summary" className="gap-2 data-[state=active]:bg-card">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Summary</span>
          </TabsTrigger>
          <TabsTrigger value="podcast" className="gap-2 data-[state=active]:bg-card">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Podcast</span>
          </TabsTrigger>
          <TabsTrigger value="quiz" className="gap-2 data-[state=active]:bg-card">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Quiz</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="flex-1 overflow-hidden">
          <SummaryTab summary={summary} />
        </TabsContent>

        <TabsContent value="podcast" className="flex-1 overflow-hidden">
          <PodcastTab podcast={podcast} />
        </TabsContent>

        <TabsContent value="quiz" className="flex-1 overflow-hidden">
          <QuizTab questions={quizQuestions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
