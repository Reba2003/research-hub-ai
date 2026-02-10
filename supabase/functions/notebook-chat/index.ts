import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, source_ids, notebook_id } = await req.json();

    console.log('[notebook-chat] Messages:', messages?.length, 'Sources:', source_ids, 'Notebook:', notebook_id);

    // Gather RAG context from documents
    let query = supabase.from('documents').select('content, metadata').eq('user_id', user.id);
    if (source_ids?.length) {
      query = query.in('source_id', source_ids);
    }
    const { data: docs } = await query;

    const context = (docs || []).map(d => {
      const meta = d.metadata as Record<string, unknown> | null;
      const name = meta?.source_name || 'Unknown';
      const loc = meta?.location || '';
      return `[Source: ${name}${loc ? ` | ${loc}` : ''}]\n${d.content}`;
    }).join('\n\n---\n\n');

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({
        success: true,
        response: `[Mock chat response] I found ${(docs || []).length} document chunks. AI requires LOVABLE_API_KEY.`,
        sources_used: (docs || []).length,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const systemPrompt = `You are a research assistant with access to the user's uploaded sources. Answer questions using ONLY the provided context. Cite sources when possible using [Source: name] format.

CONTEXT:
${context.substring(0, 100000)}`;

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages || []).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Streaming response
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[notebook-chat] AI error:', errText);
      throw new Error('AI request failed');
    }

    // Pass through the SSE stream
    return new Response(response.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[notebook-chat] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
