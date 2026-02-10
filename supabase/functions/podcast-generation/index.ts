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

    const { source_ids, style, duration_minutes } = await req.json();
    // style: 'conversational' | 'interview' | 'narrative' | 'debate'

    console.log('[podcast-generation] Style:', style, 'Duration:', duration_minutes, 'Sources:', source_ids);

    // Gather content
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

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({
        success: true,
        script: {
          title: 'Mock Podcast Episode',
          style: style || 'conversational',
          segments: [
            { speaker: 'host', content: 'Welcome to the show! Today we discuss findings from our research.', timestamp: 0 },
            { speaker: 'expert', content: `Based on ${(docs || []).length} sources, there are several key points...`, timestamp: 15 },
          ],
        },
        audio_url: null,
        message: 'Mock response - LOVABLE_API_KEY required for AI generation',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const targetDuration = duration_minutes || 5;
    const selectedStyle = style || 'conversational';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a podcast script writer. Create a ${selectedStyle} podcast script for approximately ${targetDuration} minutes. Use two speakers: "host" and "expert". Format as JSON array of segments: [{"speaker": "host"|"expert", "content": "...", "timestamp": <seconds>}]. Make it engaging, informative, and natural-sounding.`,
          },
          {
            role: 'user',
            content: `Create a podcast script based on this content:\n\n${context.substring(0, 80000)}`,
          },
        ],
      }),
    });

    const result = await response.json();
    const scriptText = result.choices?.[0]?.message?.content || '';

    // Try to parse JSON from the response
    let segments = [];
    try {
      const jsonMatch = scriptText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        segments = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If parsing fails, create a single segment with the text
      segments = [{ speaker: 'host', content: scriptText, timestamp: 0 }];
    }

    // Store the output
    const { data: output } = await supabase.from('outputs').insert({
      user_id: user.id,
      type: 'podcast',
      status: 'completed',
      content: { title: `Research Podcast (${selectedStyle})`, segments, style: selectedStyle },
    }).select().single();

    return new Response(JSON.stringify({
      success: true,
      output_id: output?.id,
      script: {
        title: `Research Podcast (${selectedStyle})`,
        style: selectedStyle,
        segments,
      },
      audio_url: null, // Audio generation would require ElevenLabs or similar
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[podcast-generation] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
