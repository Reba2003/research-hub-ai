import { motion, AnimatePresence } from 'framer-motion';
import { X, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SourceLibrary } from './source-library/SourceLibrary';
import { useResearchStore } from '@/hooks/useResearchStore';

export function MobileSourceSheet() {
  const { isMobileSourcesOpen, setMobileSourcesOpen } = useResearchStore();

  return (
    <AnimatePresence>
      {isMobileSourcesOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSourcesOpen(false)}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 h-[70vh] rounded-t-3xl border-t border-border bg-sidebar lg:hidden"
          >
            {/* Handle */}
            <div className="flex items-center justify-center py-3">
              <div className="h-1 w-10 rounded-full bg-muted" />
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 h-8 w-8"
              onClick={() => setMobileSourcesOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Content */}
            <div className="h-full overflow-hidden">
              <SourceLibrary />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
