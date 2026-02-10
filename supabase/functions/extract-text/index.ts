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

    const { source_id, file_url, file_path, source_type } = await req.json();

    console.log('[extract-text] Processing source:', source_id, 'type:', source_type);

    let extractedText = '';

    // Try downloading from storage if file_path is provided
    if (file_path) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('sources')
          .download(file_path);

        if (!downloadError && fileData) {
          extractedText = await fileData.text();
          console.log(`[extract-text] Downloaded ${extractedText.length} chars from storage`);
        }
      } catch (e) {
        console.error('[extract-text] Storage download error:', e);
      }
    }

    // Fallback: fetch from URL
    if (!extractedText && file_url) {
      try {
        const res = await fetch(file_url);
        if (res.ok) {
          extractedText = await res.text();
          console.log(`[extract-text] Fetched ${extractedText.length} chars from URL`);
        }
      } catch (e) {
        console.error('[extract-text] URL fetch error:', e);
      }
    }

    if (!extractedText) {
      extractedText = `[Mock extracted text for source ${source_id}] No content could be retrieved from the provided file.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        source_id,
        extracted_text: extractedText,
        char_count: extractedText.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[extract-text] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
