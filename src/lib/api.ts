import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { Source, ChatMessage, Summary, PodcastScript, QuizQuestion } from '@/types';

// Trigger n8n webhook for various events
export async function triggerN8nWebhook(payload: {
  event_type: 'file_upload' | 'message' | 'output_request';
  source_id?: string;
  file_url?: string;
  source_type?: string;
  message_content?: string;
  message_id?: string;
  output_type?: 'summary' | 'podcast' | 'quiz';
  output_id?: string;
}) {
  const { data, error } = await supabase.functions.invoke('n8n-webhook', {
    body: payload,
  });

  if (error) {
    console.error('n8n webhook error:', error);
    throw error;
  }

  return data;
}

// Sources API
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

  // Trigger n8n for processing
  try {
    await triggerN8nWebhook({
      event_type: 'file_upload',
      source_id: data.id,
      file_url: data.file_url || undefined,
      source_type: data.type,
    });
  } catch (e) {
    console.warn('n8n webhook failed (non-critical):', e);
  }

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

// Messages API
export async function createMessage(message: {
  role: 'user' | 'assistant';
  content: string;
  citations?: unknown[];
}): Promise<ChatMessage | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .insert([{
      user_id: user.id,
      role: message.role,
      content: message.content,
      citations: (message.citations || []) as Json,
    }])
    .select()
    .single();

  if (error) {
    console.error('Create message error:', error);
    throw error;
  }

  // Trigger n8n for AI response (only for user messages)
  if (message.role === 'user') {
    try {
      await triggerN8nWebhook({
        event_type: 'message',
        message_id: data.id,
        message_content: data.content,
      });
    } catch (e) {
      console.warn('n8n webhook failed (non-critical):', e);
    }
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

// Outputs API
export async function requestOutput(type: 'summary' | 'podcast' | 'quiz') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('outputs')
    .insert({
      user_id: user.id,
      type,
      status: 'processing',
    })
    .select()
    .single();

  if (error) {
    console.error('Create output error:', error);
    throw error;
  }

  // Trigger n8n for generation
  try {
    await triggerN8nWebhook({
      event_type: 'output_request',
      output_type: type,
      output_id: data.id,
    });
  } catch (e) {
    console.warn('n8n webhook failed (non-critical):', e);
  }

  return data;
}

export async function fetchOutput(type: 'summary' | 'podcast' | 'quiz') {
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
