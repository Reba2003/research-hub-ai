import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SourceLibrary } from './source-library/SourceLibrary';
import { ChatInterface } from './chat/ChatInterface';
import { OutputEngine } from './output/OutputEngine';
import { MobileSourceSheet } from './MobileSourceSheet';
import { MobileBottomNav } from './MobileBottomNav';
import { useResearchStore } from '@/hooks/useResearchStore';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function ResearchLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-info">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold gradient-text">StudyTimeAI</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sources panel */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
          <SourceLibrary />
        </aside>

        {/* Chat */}
        <main className="min-w-0 flex-1 border-r border-border pb-16 md:pb-0">
          <ChatInterface />
        </main>

        {/* Output / Studio panel */}
        <aside className="hidden w-72 shrink-0 bg-sidebar lg:flex lg:flex-col">
          <OutputEngine />
        </aside>
      </div>

      <MobileBottomNav />
      <MobileSourceSheet />
    </div>
  );
}
