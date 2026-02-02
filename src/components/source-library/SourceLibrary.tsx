import { motion, AnimatePresence } from 'framer-motion';
import { Library, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { SourceItem } from './SourceItem';
import { UploadZone } from './UploadZone';
import { useResearchStore } from '@/hooks/useResearchStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchSources, deleteSource as apiDeleteSource } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import type { Source } from '@/types';

interface SourceLibraryProps {
  className?: string;
}

export function SourceLibrary({ className }: SourceLibraryProps) {
  const { sources, addSource, removeSource, toggleSource, selectedCitation, updateSourceStatus } = useResearchStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load sources from database on mount
  useEffect(() => {
    const loadSources = async () => {
      try {
        const dbSources = await fetchSources();
        // Clear existing and add all from DB
        const store = useResearchStore.getState();
        // Only add sources that aren't already in the store
        dbSources.forEach((source) => {
          if (!store.sources.find((s) => s.id === source.id)) {
            store.addSource(source);
          }
        });
      } catch (error) {
        console.error('Failed to load sources:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSources();
  }, []);

  // Subscribe to realtime source status updates
  useEffect(() => {
    const channel = supabase
      .channel('sources-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sources',
        },
        (payload) => {
          const updatedSource = payload.new as { id: string; status: string };
          if (updatedSource.status) {
            updateSourceStatus(updatedSource.id, updatedSource.status as Source['status']);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateSourceStatus]);

  const handleUpload = (sourceData: Source) => {
    // Source already has id and uploadedAt from API
    addSource(sourceData);
  };

  const handleRemove = async (id: string) => {
    try {
      await apiDeleteSource(id);
      removeSource(id);
    } catch (error) {
      console.error('Failed to delete source:', error);
    }
  };

  const enabledCount = sources.filter((s) => s.enabled && s.status === 'ready').length;

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
                        onRemove={() => handleRemove(source.id)}
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
