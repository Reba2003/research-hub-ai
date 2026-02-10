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

    const { source_ids, notebook_type } = await req.json();
    // notebook_type: 'summary' | 'study_guide' | 'faq' | 'timeline' | 'briefing'

    console.log('[generate-notebook-details] Type:', notebook_type, 'Sources:', source_ids);

    // Gather source content
    let query = supabase.from('documents').select('content, metadata').eq('user_id', user.id);
    if (source_ids?.length) {
      query = query.in('source_id', source_ids);
    }
    const { data: docs } = await query;
    const context = (docs || []).map(d => d.content).join('\n\n---\n\n');

    if (!context.trim()) {
      return new Response(JSON.stringify({ error: 'No source content found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const typePrompts: Record<string, string> = {
      summary: 'Create a comprehensive, well-structured summary with clear ## headings and key takeaways.',
      study_guide: 'Create a detailed study guide with key concepts, definitions, and review questions.',
      faq: 'Generate a comprehensive FAQ with 10-15 questions and detailed answers.',
      timeline: 'Create a chronological timeline of key events and developments.',
      briefing: 'Create an executive briefing document with key findings, implications, and recommendations.',
      quiz: 'Generate a quiz as a JSON array of 8-10 objects with this exact format: [{"question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "..."}]. Return ONLY the JSON array, no other text.',
    };

    const prompt = typePrompts[notebook_type || 'summary'] || typePrompts.summary;

    if (!LOVABLE_API_KEY) {
      // Mock response
      return new Response(JSON.stringify({
        success: true,
        notebook_type: notebook_type || 'summary',
        content: `[Mock ${notebook_type || 'summary'}] Based on ${(docs || []).length} document chunks. Full AI generation requires LOVABLE_API_KEY.`,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `You are a research assistant. ${prompt}` },
          { role: 'user', content: `Based on the following research materials:\n\n${context.substring(0, 100000)}` },
        ],
      }),
    });

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({
      success: true,
      notebook_type: notebook_type || 'summary',
      content,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[generate-notebook-details] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
