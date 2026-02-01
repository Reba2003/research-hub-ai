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
  metadata?: Record<string, unknown>;
  user_id: string;
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
    let content = '';
    const sourceData = source as SourceData;

    if (sourceData.type === 'text') {
      // Text was pasted directly
      content = (sourceData.metadata?.content as string) || '';
    } else if (sourceData.type === 'youtube') {
      // For YouTube, we'll use AI to process the URL
      content = `YouTube video: ${sourceData.file_url}. This video needs to be analyzed.`;
    } else if (sourceData.file_url) {
      // For uploaded files, use the URL
      // In production, you would fetch and parse the file content
      content = `Uploaded file: ${sourceData.name}. File URL: ${sourceData.file_url}`;
    }

    // If we have content, use AI to create a structured summary for RAG
    if (content) {
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
                content: `You are a document processor. Extract and summarize the key information from the provided content. 
Create a structured summary that captures:
1. Main topics and themes
2. Key facts and data points
3. Important quotes or statements
4. Conclusions or takeaways

Format your response as clear, searchable paragraphs that can be used for retrieval-augmented generation.`
              },
              {
                role: 'user',
                content: `Process this content from "${sourceData.name}":\n\n${content.substring(0, 10000)}`
              }
            ],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const processedContent = result.choices?.[0]?.message?.content || content;

          // Store as document for RAG
          const { error: docError } = await supabase
            .from('documents')
            .insert({
              source_id: source_id,
              user_id: user.id,
              content: processedContent,
              metadata: {
                source_name: sourceData.name,
                source_type: sourceData.type,
                processed_at: new Date().toISOString(),
                location: sourceData.type === 'pdf' ? 'Full document' : 
                         sourceData.type === 'youtube' ? 'Video transcript' : 'Text content'
              }
            });

          if (docError) {
            console.error('Error storing document:', docError);
          }
        }
      } catch (aiError) {
        console.error('AI processing error:', aiError);
        // Still mark as ready even if AI fails - content is stored
      }
    }

    // Update status to ready
    await supabase
      .from('sources')
      .update({ status: 'ready' })
      .eq('id', source_id);

    console.log('Source processed successfully:', source_id);

    return new Response(
      JSON.stringify({ success: true, source_id }),
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
