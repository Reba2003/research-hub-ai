import { motion, AnimatePresence } from 'framer-motion';
import { Library, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { SourceItem } from './SourceItem';
import { UploadZone } from './UploadZone';
import { useResearchStore } from '@/hooks/useResearchStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Source } from '@/types';

interface SourceLibraryProps {
  className?: string;
}

export function SourceLibrary({ className }: SourceLibraryProps) {
  const { sources, addSource, removeSource, toggleSource, selectedCitation } = useResearchStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleUpload = (sourceData: Omit<Source, 'id' | 'uploadedAt'>) => {
    const newSource: Source = {
      ...sourceData,
      id: crypto.randomUUID(),
      uploadedAt: new Date(),
    };
    addSource(newSource);

    // Simulate processing completion
    setTimeout(() => {
      useResearchStore.getState().updateSourceStatus(newSource.id, 'completed');
    }, 2000 + Math.random() * 2000);
  };

  const enabledCount = sources.filter((s) => s.enabled).length;

  return (
    <div className={`flex h-full flex-col bg-sidebar ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Source Library</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {enabledCount} active
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/* Upload Zone */}
            <div className="border-b border-sidebar-border p-4">
              <UploadZone onUpload={handleUpload} />
            </div>

            {/* Source List */}
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-4">
                <AnimatePresence mode="popLayout">
                  {sources.length === 0 ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No sources uploaded yet.
                      <br />
                      Upload files to get started.
                    </motion.p>
                  ) : (
                    sources.map((source) => (
                      <SourceItem
                        key={source.id}
                        source={source}
                        onToggle={() => toggleSource(source.id)}
                        onRemove={() => removeSource(source.id)}
                        isSelected={selectedCitation === source.id}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
