import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function chunkText(text: string, maxChars = 4000): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxChars) { chunks.push(remaining); break; }
    let bp = remaining.lastIndexOf('. ', maxChars);
    if (bp < maxChars * 0.5) bp = remaining.lastIndexOf('\n', maxChars);
    if (bp < maxChars * 0.3) bp = maxChars;
    chunks.push(remaining.slice(0, bp + 1).trim());
    remaining = remaining.slice(bp + 1).trim();
  }
  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    const { source_id, content, source_name, source_type } = await req.json();

    console.log('[upsert-vector-store] Source:', source_id, 'Content length:', content?.length);

    if (!content?.trim()) {
      return new Response(JSON.stringify({ error: 'No content provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete existing chunks for this source
    await supabase.from('documents').delete().eq('source_id', source_id).eq('user_id', user.id);

    // Chunk and store
    const chunks = chunkText(content, 4000);
    let stored = 0;

    for (let i = 0; i < chunks.length; i++) {
      const { error } = await supabase.from('documents').insert({
        source_id,
        user_id: user.id,
        content: chunks[i],
        metadata: {
          source_name: source_name || 'Unknown',
          source_type: source_type || 'text',
          chunk_index: i,
          total_chunks: chunks.length,
          chunk_type: 'raw',
          processed_at: new Date().toISOString(),
          location: `Part ${i + 1} of ${chunks.length}`,
        },
      });
      if (!error) stored++;
    }

    console.log(`[upsert-vector-store] Stored ${stored}/${chunks.length} chunks`);

    return new Response(JSON.stringify({
      success: true,
      source_id,
      chunks_stored: stored,
      total_chunks: chunks.length,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[upsert-vector-store] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
