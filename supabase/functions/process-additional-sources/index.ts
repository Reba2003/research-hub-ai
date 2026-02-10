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

    const { source_ids, action } = await req.json();
    // action: 'reprocess' | 'merge' | 'compare'

    console.log('[process-additional-sources] Action:', action, 'Sources:', source_ids);

    if (!source_ids?.length) {
      return new Response(JSON.stringify({ error: 'No source_ids provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch sources
    const { data: sources } = await supabase
      .from('sources')
      .select('*')
      .in('id', source_ids)
      .eq('user_id', user.id);

    if (!sources?.length) {
      return new Response(JSON.stringify({ error: 'No matching sources found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark sources as processing
    for (const src of sources) {
      await supabase.from('sources').update({ status: 'processing' }).eq('id', src.id);
    }

    // Trigger extract-text + upsert for each source (mock pipeline)
    const results = [];
    for (const src of sources) {
      // In a real n8n workflow, this would chain extract-text → upsert-vector-store
      // Here we simulate the pipeline
      let content = '';

      if (src.file_path) {
        try {
          const { data: fileData } = await supabase.storage.from('sources').download(src.file_path);
          if (fileData) content = await fileData.text();
        } catch (_e) { /* ignore */ }
      }

      if (!content && (src.metadata as Record<string, unknown>)?.content) {
        content = (src.metadata as Record<string, unknown>).content as string;
      }

      if (content) {
        // Store as document chunks
        await supabase.from('documents').delete().eq('source_id', src.id).eq('user_id', user.id);
        await supabase.from('documents').insert({
          source_id: src.id,
          user_id: user.id,
          content,
          metadata: { source_name: src.name, source_type: src.type, chunk_type: 'raw', processed_at: new Date().toISOString() },
        });
      }

      await supabase.from('sources').update({ status: 'ready' }).eq('id', src.id);
      results.push({ source_id: src.id, name: src.name, status: 'ready', content_length: content.length });
    }

    return new Response(JSON.stringify({
      success: true,
      action: action || 'reprocess',
      processed: results,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[process-additional-sources] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
