import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { generateOutput } from '@/lib/api';
import { useResearchStore } from '@/hooks/useResearchStore';
import { toast } from 'sonner';
import type { Summary } from '@/types';

interface SummaryTabProps {
  summary: Summary | null;
}

export function SummaryTab({ summary }: SummaryTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { sources, setSummary } = useResearchStore();
  const enabledSources = sources.filter((s) => s.enabled && s.status === 'ready');

  const handleGenerate = async () => {
    if (enabledSources.length === 0) {
      toast.error('No ready sources available. Upload and process sources first.');
      return;
    }

    setIsGenerating(true);
    try {
      const sourceIds = enabledSources.map(s => s.id);
      const result = await generateOutput('summary', sourceIds);
      
      if (result?.content) {
        const content = typeof result.content === 'string' ? result.content : '';
        // Parse markdown content into sections by headings
        const sections = content.split(/^##\s+/m).filter(Boolean).map((section: string, i: number) => {
          const lines = section.split('\n');
          const heading = lines[0]?.trim() || `Section ${i + 1}`;
          const body = lines.slice(1).join('\n').trim();
          return { id: `s-${i}`, heading, content: body, citations: [] };
        });
        
        setSummary({
          id: crypto.randomUUID(),
          title: 'Study Summary',
          generatedAt: new Date(),
          sections: sections.length > 0 ? sections : [{ id: 's-0', heading: 'Summary', content, citations: [] }],
        });
        toast.success('Summary generated!');
      }
    } catch (error) {
      console.error('Generate summary error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!summary) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">Generate Summary</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          Create a comprehensive summary from your uploaded sources.
        </p>
        <Button onClick={handleGenerate} disabled={isGenerating || enabledSources.length === 0} className="gap-2">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Generate Summary
            </>
          )}
        </Button>
        {enabledSources.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Upload sources first</p>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{summary.title}</h3>
              <p className="text-xs text-muted-foreground">
                Generated {summary.generatedAt.toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={isGenerating} className="gap-1">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Regenerate
          </Button>
        </motion.div>

        <div className="space-y-4">
          {summary.sections.map((section, index) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-foreground">{section.heading}</h4>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {section.content}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
