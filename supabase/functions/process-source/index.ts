import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SourceData {
  id: string;
  name: string;
  type: string;
  file_url?: string;
  file_path?: string;
  metadata?: Record<string, unknown>;
  user_id: string;
}

// Split text into chunks of roughly maxChars, breaking at sentence boundaries
function chunkText(text: string, maxChars = 4000): string[] {
  if (text.length <= maxChars) return [text];
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }
    
    // Try to break at a sentence boundary
    let breakPoint = remaining.lastIndexOf('. ', maxChars);
    if (breakPoint < maxChars * 0.5) {
      breakPoint = remaining.lastIndexOf('\n', maxChars);
    }
    if (breakPoint < maxChars * 0.3) {
      breakPoint = maxChars;
    }
    
    chunks.push(remaining.slice(0, breakPoint + 1).trim());
    remaining = remaining.slice(breakPoint + 1).trim();
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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { source_id } = await req.json();

    // Fetch the source
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('*')
      .eq('id', source_id)
      .eq('user_id', user.id)
      .single();

    if (sourceError || !source) {
      console.error('Source not found:', sourceError);
      return new Response(
        JSON.stringify({ error: 'Source not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing source:', source.name, 'Type:', source.type);

    // Update status to processing
    await supabase
      .from('sources')
      .update({ status: 'processing' })
      .eq('id', source_id);

    // Extract content based on source type
    let rawContent = '';
    const sourceData = source as SourceData;

    if (sourceData.type === 'text') {
      rawContent = (sourceData.metadata?.content as string) || '';
    } else if (sourceData.type === 'youtube') {
      rawContent = `YouTube video: ${sourceData.file_url}. This video needs to be analyzed.`;
    } else if (sourceData.file_url || sourceData.file_path) {
      // Try to download and read the file content
      let fileContent = '';
      
      if (sourceData.file_path) {
        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('sources')
            .download(sourceData.file_path);
          
          if (!downloadError && fileData) {
            fileContent = await fileData.text();
            console.log(`Downloaded file content: ${fileContent.length} chars`);
          } else {
            console.error('File download error:', downloadError);
          }
        } catch (e) {
          console.error('Error downloading file:', e);
        }
      }
      
      rawContent = fileContent || `Uploaded file: ${sourceData.name}. File URL: ${sourceData.file_url || sourceData.file_path}`;
    }

    if (!rawContent.trim()) {
      await supabase
        .from('sources')
        .update({ status: 'error' })
        .eq('id', source_id);

      return new Response(
        JSON.stringify({ error: 'No content could be extracted from source' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete any existing documents for this source (re-processing)
    await supabase
      .from('documents')
      .delete()
      .eq('source_id', source_id)
      .eq('user_id', user.id);

    // Store the FULL raw content as chunked documents for RAG
    const chunks = chunkText(rawContent, 4000);
    console.log(`Storing ${chunks.length} raw content chunks for source: ${sourceData.name}`);

    for (let i = 0; i < chunks.length; i++) {
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          source_id: source_id,
          user_id: user.id,
          content: chunks[i],
          metadata: {
            source_name: sourceData.name,
            source_type: sourceData.type,
            chunk_index: i,
            total_chunks: chunks.length,
            chunk_type: 'raw',
            processed_at: new Date().toISOString(),
            location: `Part ${i + 1} of ${chunks.length}`,
          }
        });

      if (docError) {
        console.error(`Error storing chunk ${i}:`, docError);
      }
    }

    // Also create an AI-generated summary chunk for quick retrieval
    try {
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
              content: `You are a document processor. Create a comprehensive summary that captures ALL key information, facts, data points, arguments, and conclusions from the provided content. Be thorough - do not omit any important details.`
            },
            {
              role: 'user',
              content: `Thoroughly summarize this content from "${sourceData.name}":\n\n${rawContent.substring(0, 30000)}`
            }
          ],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const summaryContent = result.choices?.[0]?.message?.content || '';

        if (summaryContent) {
          await supabase
            .from('documents')
            .insert({
              source_id: source_id,
              user_id: user.id,
              content: summaryContent,
              metadata: {
                source_name: sourceData.name,
                source_type: sourceData.type,
                chunk_type: 'summary',
                processed_at: new Date().toISOString(),
                location: 'AI Summary',
              }
            });
        }
      }
    } catch (aiError) {
      console.error('AI summary error (non-critical):', aiError);
    }

    // Update status to ready
    await supabase
      .from('sources')
      .update({ status: 'ready' })
      .eq('id', source_id);

    console.log('Source processed successfully:', source_id);

    return new Response(
      JSON.stringify({ success: true, source_id, chunks: chunks.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Process source error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
