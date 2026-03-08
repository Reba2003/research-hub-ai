import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { Source, ChatMessage, Summary, PodcastScript, QuizQuestion } from '@/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ============== Sources API ==============

export async function createSource(source: {
  name: string;
  type: string;
  file_url?: string;
  file_path?: string;
  size?: number;
  metadata?: Record<string, unknown>;
}): Promise<Source | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('sources')
    .insert([{
      user_id: user.id,
      name: source.name,
      type: source.type,
      file_url: source.file_url,
      file_path: source.file_path,
      size: source.size,
      metadata: (source.metadata || {}) as Json,
    }])
    .select()
    .single();

  if (error) {
    console.error('Create source error:', error);
    throw error;
  }

  // Trigger background processing
  triggerSourceProcessing(data.id).catch(e => 
    console.warn('Source processing trigger failed (non-critical):', e)
  );

  return {
    id: data.id,
    name: data.name,
    type: data.type as Source['type'],
    enabled: data.enabled,
    status: data.status as Source['status'],
    uploadedAt: new Date(data.created_at),
    size: data.size || undefined,
  };
}

export async function triggerSourceProcessing(sourceId: string) {
  const { data, error } = await supabase.functions.invoke('process-source', {
    body: { source_id: sourceId },
  });

  if (error) {
    console.error('Process source error:', error);
    throw error;
  }

  return data;
}

export async function fetchSources(): Promise<Source[]> {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch sources error:', error);
    throw error;
  }

  return (data || []).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type as Source['type'],
    enabled: s.enabled,
    status: s.status as Source['status'],
    uploadedAt: new Date(s.created_at),
    size: s.size || undefined,
    file_url: s.file_url || undefined,
  }));
}

export async function updateSource(id: string, updates: Partial<{ enabled: boolean; status: string }>) {
  const { error } = await supabase
    .from('sources')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Update source error:', error);
    throw error;
  }
}

export async function deleteSource(id: string) {
  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete source error:', error);
    throw error;
  }
}

// ============== Chat API (Streaming) ==============

export type ModelProvider = 'gemini' | 'openai' | 'deepseek' | 'auto';

export interface StreamChatOptions {
  messages: Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
  sourceIds?: string[];
  modelProvider?: ModelProvider;
  hasImage?: boolean;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamChat({ messages, sourceIds, modelProvider = 'auto', hasImage = false, onDelta, onDone, onError }: StreamChatOptions) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ 
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        source_ids: sourceIds,
        model_provider: modelProvider,
        has_image: hasImage,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      textBuffer += decoder.decode(value, { stream: true });

      // Process line-by-line
      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          // Incomplete JSON, put it back
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Flush remaining buffer
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (error) {
    console.error('Stream chat error:', error);
    onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

// ============== Messages API (Persistence) ==============

export async function createMessage(message: {
  role: 'user' | 'assistant';
  content: string;
  citations?: unknown[];
  conversation_id?: string;
}): Promise<ChatMessage | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    role: message.role,
    content: message.content,
    citations: (message.citations || []) as Json,
  };
  if (message.conversation_id) {
    insertData.conversation_id = message.conversation_id;
  }

  const { data, error } = await supabase
    .from('messages')
    .insert([insertData as any])
    .select()
    .single();

  if (error) {
    console.error('Create message error:', error);
    throw error;
  }

  return {
    id: data.id,
    role: data.role as 'user' | 'assistant',
    content: data.content,
    citations: (data.citations as unknown) as ChatMessage['citations'],
    timestamp: new Date(data.created_at),
  };
}

export async function fetchMessages(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Fetch messages error:', error);
    throw error;
  }

  return (data || []).map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    citations: (m.citations as unknown) as ChatMessage['citations'],
    timestamp: new Date(m.created_at),
  }));
}

// ============== Outputs API ==============

export type OutputType = 'summary' | 'podcast' | 'quiz';

export async function generateOutput(type: OutputType, sourceIds?: string[]) {
  if (type === 'podcast') {
    const { data, error } = await supabase.functions.invoke('podcast-generation', {
      body: { source_ids: sourceIds, style: 'conversational', duration_minutes: 5 },
    });
    if (error) {
      console.error('Podcast generation error:', error);
      throw error;
    }
    return data;
  }

  // summary, quiz, study_guide, faq, timeline, briefing → generate-notebook-details
  const notebookTypeMap: Record<string, string> = {
    summary: 'summary',
    quiz: 'quiz',
  };

  const { data, error } = await supabase.functions.invoke('generate-notebook-details', {
    body: { source_ids: sourceIds, notebook_type: notebookTypeMap[type] || type },
  });

  if (error) {
    console.error('Generate notebook details error:', error);
    throw error;
  }

  return data;
}

export async function fetchOutput(type: OutputType) {
  const { data, error } = await supabase
    .from('outputs')
    .select('*')
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Fetch output error:', error);
    throw error;
  }

  return data;
}

export async function fetchAllOutputs() {
  const { data, error } = await supabase
    .from('outputs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch outputs error:', error);
    throw error;
  }

  return data || [];
}
