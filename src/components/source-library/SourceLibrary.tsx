import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { SourceItem } from './SourceItem';
import { UploadZone } from './UploadZone';
import { useResearchStore } from '@/hooks/useResearchStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchSources, deleteSource as apiDeleteSource } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import type { Source } from '@/types';

interface SourceLibraryProps {
  className?: string;
}

export function SourceLibrary({ className }: SourceLibraryProps) {
  const { sources, addSource, removeSource, toggleSource, selectedCitation, updateSourceStatus, activeConversationId } = useResearchStore();
  const [showUpload, setShowUpload] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Clear and reload sources when conversation changes
  useEffect(() => {
    const loadSources = async () => {
      setIsLoading(true);
      // Clear existing sources in store
      const store = useResearchStore.getState();
      store.clearSources();

      if (!activeConversationId) {
        setIsLoading(false);
        return;
      }

      try {
        const dbSources = await fetchSources(activeConversationId);
        dbSources.forEach((source) => {
          store.addSource(source);
        });
      } catch (error) {
        console.error('Failed to load sources:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSources();
  }, [activeConversationId]);

  useEffect(() => {
    const channel = supabase
      .channel('sources-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sources' }, (payload) => {
        const updatedSource = payload.new as { id: string; status: string };
        if (updatedSource.status) {
          updateSourceStatus(updatedSource.id, updatedSource.status as Source['status']);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [updateSourceStatus]);

  const handleUpload = (sourceData: Source) => {
    addSource(sourceData);
    setShowUpload(false);
  };

  const handleRemove = async (id: string) => {
    try {
      await apiDeleteSource(id);
      removeSource(id);
    } catch (error) {
      console.error('Failed to delete source:', error);
    }
  };

  const allEnabled = sources.length > 0 && sources.every(s => s.enabled);

  const toggleAll = () => {
    sources.forEach(s => {
      if (allEnabled ? s.enabled : !s.enabled) {
        toggleSource(s.id);
      }
    });
  };

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border bg-sidebar p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Sources</h2>
        </div>
        <Button
          onClick={() => setShowUpload(!showUpload)}
          variant="outline"
          className="w-full gap-2 text-sm"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Add sources
        </Button>
      </div>

      {/* Upload zone (collapsible) */}
      {showUpload && (
        <div className="border-b border-border p-3">
          <UploadZone onUpload={handleUpload} conversationId={activeConversationId} />
        </div>
      )}

      {/* Select all */}
      {sources.length > 0 && (
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs text-muted-foreground">Select all sources</span>
          <Checkbox checked={allEnabled} onCheckedChange={toggleAll} />
        </div>
      )}

      {/* Source list - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-1">
          <AnimatePresence mode="popLayout">
            {sources.length === 0 && !isLoading ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No sources yet.
                <br />
                Click "Add sources" to get started.
              </p>
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
      </div>
    </div>
  );
}
