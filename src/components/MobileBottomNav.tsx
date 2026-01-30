import { motion } from 'framer-motion';
import { FileText, Mic, Brain, Library } from 'lucide-react';
import { useResearchStore } from '@/hooks/useResearchStore';
import type { OutputTab } from '@/types';

export function MobileBottomNav() {
  const { activeOutputTab, setActiveOutputTab, setMobileSourcesOpen, sources } = useResearchStore();

  const tabs: { id: OutputTab | 'sources'; icon: typeof FileText; label: string }[] = [
    { id: 'sources', icon: Library, label: 'Sources' },
    { id: 'summary', icon: FileText, label: 'Summary' },
    { id: 'podcast', icon: Mic, label: 'Podcast' },
    { id: 'quiz', icon: Brain, label: 'Quiz' },
  ];

  const handleTabClick = (id: typeof tabs[number]['id']) => {
    if (id === 'sources') {
      setMobileSourcesOpen(true);
    } else {
      setActiveOutputTab(id);
    }
  };

  const enabledCount = sources.filter((s) => s.enabled).length;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-sidebar lg:hidden">
      <div className="flex items-center justify-around py-2">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = id === 'sources' ? false : activeOutputTab === id;

          return (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className="relative flex flex-col items-center gap-1 px-4 py-2"
            >
              <div className="relative">
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                {id === 'sources' && enabledCount > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {enabledCount}
                  </span>
                )}
              </div>
              <span
                className={`text-xs transition-colors ${
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-indicator"
                  className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
