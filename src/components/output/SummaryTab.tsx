import { motion } from 'framer-motion';
import { FileText, ChevronRight } from 'lucide-react';
import { CitationChip } from '@/components/chat/CitationChip';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Summary } from '@/types';

interface SummaryTabProps {
  summary: Summary | null;
}

// Mock summary data
const mockSummary: Summary = {
  id: '1',
  title: 'Research Summary',
  generatedAt: new Date(),
  sections: [
    {
      id: 's1',
      heading: 'Key Findings',
      content: 'The research reveals significant advancements in the field, with three primary areas of focus emerging from the analyzed materials. First, there is a clear trend toward integrated approaches that combine theoretical frameworks with practical applications.',
      citations: [
        { id: 'c1', sourceId: 's1', sourceName: 'Research.pdf', sourceType: 'pdf', location: 'PDF, p. 12', page: 12, text: '' },
      ],
    },
    {
      id: 's2',
      heading: 'Methodology Overview',
      content: 'The studies employ a mixed-methods approach, combining quantitative analysis with qualitative insights. This methodology ensures robust findings that are both statistically significant and contextually meaningful.',
      citations: [
        { id: 'c2', sourceId: 's2', sourceName: 'Lecture', sourceType: 'video', location: 'Video, 08:32', timestamp: 512, text: '' },
        { id: 'c3', sourceId: 's1', sourceName: 'Research.pdf', sourceType: 'pdf', location: 'PDF, p. 45', page: 45, text: '' },
      ],
    },
    {
      id: 's3',
      heading: 'Conclusions',
      content: 'The evidence strongly supports the hypothesis that collaborative frameworks lead to improved outcomes. Future research should focus on longitudinal studies to validate these preliminary findings.',
      citations: [
        { id: 'c4', sourceId: 's3', sourceName: 'YouTube Analysis', sourceType: 'youtube', location: 'YT, 15:20', timestamp: 920, text: '' },
      ],
    },
  ],
};

export function SummaryTab({ summary }: SummaryTabProps) {
  const displaySummary = summary || mockSummary;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{displaySummary.title}</h3>
            <p className="text-xs text-muted-foreground">
              Generated {displaySummary.generatedAt.toLocaleDateString()}
            </p>
          </div>
        </motion.div>

        <div className="space-y-4">
          {displaySummary.sections.map((section, index) => (
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
              <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                {section.content}
              </p>
              {section.citations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {section.citations.map((citation) => (
                    <CitationChip key={citation.id} citation={citation} />
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
