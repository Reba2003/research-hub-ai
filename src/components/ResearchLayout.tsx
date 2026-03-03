import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SourceLibrary } from './source-library/SourceLibrary';
import { ChatInterface } from './chat/ChatInterface';
import { OutputEngine } from './output/OutputEngine';
import { MobileSourceSheet } from './MobileSourceSheet';
import { MobileBottomNav } from './MobileBottomNav';
import { useResearchStore } from '@/hooks/useResearchStore';
import { useAuth } from '@/hooks/useAuth';

type ScreenSize = 'small' | 'medium' | 'large';

function useScreenSize(): ScreenSize {
  const [size, setSize] = useState<ScreenSize>('large');

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 768) setSize('small');
      else if (w < 1280) setSize('medium');
      else setSize('large');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return size;
}

export function ResearchLayout() {
  const screenSize = useScreenSize();
  const [showDesktopSources, setShowDesktopSources] = useState(true);
  const [showDesktopOutput, setShowDesktopOutput] = useState(true);
  const { activeOutputTab } = useResearchStore();
  const { signOut } = useAuth();

  // Auto-manage panel visibility based on screen size
  useEffect(() => {
    if (screenSize === 'small') {
      setShowDesktopSources(false);
      setShowDesktopOutput(false);
    } else if (screenSize === 'medium') {
      // Medium: show only one panel at a time, prefer sources
      setShowDesktopSources(true);
      setShowDesktopOutput(false);
    } else {
      setShowDesktopSources(true);
      setShowDesktopOutput(true);
    }
  }, [screenSize]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-info">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">StudyTimeAI</h1>
          </div>
        </div>

        {/* Desktop toggle buttons */}
        <div className="hidden gap-2 md:flex">
          <Button
            variant={showDesktopSources ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowDesktopSources(!showDesktopSources)}
            className="gap-2"
          >
            Sources
          </Button>
          <Button
            variant={showDesktopOutput ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowDesktopOutput(!showDesktopOutput)}
            className="gap-2"
          >
            Output
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop: Source Library */}
        <AnimatePresence mode="wait">
          {showDesktopSources && screenSize !== 'small' && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: screenSize === 'medium' ? 300 : 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden h-full min-w-[300px] border-r border-border md:block"
            >
              <SourceLibrary />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Chat Interface - Always visible, guaranteed min-width */}
        <main className="min-w-0 flex-1 overflow-hidden pb-16 md:pb-0">
          <ChatInterface />
        </main>

        {/* Desktop: Output Engine */}
        <AnimatePresence mode="wait">
          {showDesktopOutput && screenSize !== 'small' && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: screenSize === 'medium' ? 340 : 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden h-full min-w-[280px] border-l border-border md:block"
            >
              <OutputEngine />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile: Bottom Navigation */}
      <MobileBottomNav />

      {/* Mobile: Source Library Sheet */}
      <MobileSourceSheet />

      {/* Mobile: Output Panel */}
      <div className="fixed inset-x-0 bottom-16 top-14 z-20 hidden overflow-hidden bg-sidebar">
        {activeOutputTab === 'summary' && (
          <div className="h-full">Summary Tab Mobile</div>
        )}
      </div>
    </div>
  );
}
