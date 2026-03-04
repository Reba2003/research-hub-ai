import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Trash2, Loader2, Sparkles, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useResearchStore } from '@/hooks/useResearchStore';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { setActiveConversationId, clearMessages } = useResearchStore();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to load conversations:', error);
      return;
    }
    setConversations(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const handleNew = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .insert([{ user_id: user.id, title: 'New Conversation' }])
      .select()
      .single();

    if (error) {
      toast.error('Failed to create conversation');
      return;
    }

    setActiveConversationId(data.id);
    clearMessages();
    navigate('/notebook');
  };

  const handleOpen = (id: string) => {
    setActiveConversationId(id);
    clearMessages();
    navigate('/notebook');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete conversation');
      return;
    }
    setConversations(prev => prev.filter(c => c.id !== id));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-info">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold gradient-text">StudyTimeAI</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Your Notebooks</h2>
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" />
              New Notebook
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">No notebooks yet</h3>
              <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                Create your first notebook to start researching with AI.
              </p>
              <Button onClick={handleNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Notebook
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {conversations.map((conv) => (
                  <motion.button
                    key={conv.id}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    onClick={() => handleOpen(conv.id)}
                    className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-card/80"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(conv.updated_at)}</p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="shrink-0 rounded-lg p-2 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
