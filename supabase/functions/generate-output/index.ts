import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type OutputType = 'summary' | 'podcast' | 'quiz';

interface OutputContent {
  summary?: {
    title: string;
    sections: Array<{ heading: string; content: string }>;
    keyTakeaways: string[];
  };
  podcast?: {
    title: string;
    segments: Array<{ speaker: string; text: string; timestamp?: string }>;
    duration?: string;
  };
  quiz?: {
    title: string;
    questions: Array<{
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }>;
  };
}

const outputPrompts: Record<OutputType, string> = {
  summary: `Create a comprehensive study summary based on the provided source content.

Return a JSON object with this exact structure:
{
  "title": "Summary title",
  "sections": [
    { "heading": "Section heading", "content": "Detailed section content" }
  ],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"]
}

Make the summary educational, well-organized, and suitable for studying.`,

  podcast: `Create a podcast script based on the provided source content. Format it as a conversation between two hosts: "Alex" (the explainer) and "Jordan" (asks clarifying questions).

Return a JSON object with this exact structure:
{
  "title": "Podcast episode title",
  "segments": [
    { "speaker": "Alex", "text": "Welcome to the show..." },
    { "speaker": "Jordan", "text": "Response or question..." }
  ],
  "duration": "Estimated duration like '15 minutes'"
}

Make it engaging, educational, and conversational.`,

  quiz: `Create an interactive quiz based on the provided source content.

Return a JSON object with this exact structure:
{
  "title": "Quiz title",
  "questions": [
    {
      "question": "The question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}

Create 5-10 questions that test understanding of the key concepts.`
};

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

    const { output_type, source_ids } = await req.json() as { output_type: OutputType; source_ids?: string[] };

    if (!['summary', 'podcast', 'quiz'].includes(output_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid output type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating output:', output_type, 'for user:', user.id);

    // Create output record with processing status
    const { data: output, error: insertError } = await supabase
      .from('outputs')
      .insert({
        user_id: user.id,
        type: output_type,
        status: 'processing',
        content: {},
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating output:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create output' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch source content for generation
    let sourceContent = '';
    
    // Get enabled sources or specified sources
    const sourceQuery = supabase
      .from('sources')
      .select('id, name, type')
      .eq('user_id', user.id)
      .eq('enabled', true)
      .eq('status', 'ready');

    if (source_ids && source_ids.length > 0) {
      sourceQuery.in('id', source_ids);
    }

    const { data: sources } = await sourceQuery.limit(10);
    const sourceIdList = sources?.map(s => s.id) || [];

    if (sourceIdList.length > 0) {
      // Fetch processed documents
      const { data: documents } = await supabase
        .from('documents')
        .select('content, metadata')
        .eq('user_id', user.id)
        .in('source_id', sourceIdList);

      if (documents && documents.length > 0) {
        sourceContent = documents.map((doc, i) => {
          const meta = doc.metadata as Record<string, unknown> || {};
          return `--- Source ${i + 1}: ${meta.source_name || 'Unknown'} ---\n${doc.content}`;
        }).join('\n\n');
      }
    }

    if (!sourceContent) {
      // Update to error status
      await supabase
        .from('outputs')
        .update({ status: 'error', content: { error: 'No sources available' } })
        .eq('id', output.id);

      return new Response(
        JSON.stringify({ error: 'No processed sources available. Please upload and process sources first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate output using AI
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
              content: outputPrompts[output_type]
            },
            {
              role: 'user',
              content: `Based on these study materials, generate the ${output_type}:\n\n${sourceContent.substring(0, 15000)}`
            }
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI generation error:', response.status, errorText);

        if (response.status === 429) {
          await supabase
            .from('outputs')
            .update({ status: 'error', content: { error: 'Rate limited' } })
            .eq('id', output.id);

          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        throw new Error('AI service error');
      }

      const result = await response.json();
      const generatedContent = result.choices?.[0]?.message?.content;

      // Parse the JSON response
      let parsedContent: OutputContent;
      try {
        parsedContent = JSON.parse(generatedContent);
      } catch {
        console.error('Failed to parse AI response:', generatedContent);
        parsedContent = { [output_type]: { error: 'Failed to parse response', raw: generatedContent } } as unknown as OutputContent;
      }

      // Update output with generated content
      await supabase
        .from('outputs')
        .update({
          status: 'ready',
          content: parsedContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', output.id);

      console.log('Output generated successfully:', output.id);

      return new Response(
        JSON.stringify({ success: true, output_id: output.id, content: parsedContent }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (aiError) {
      console.error('AI error:', aiError);

      await supabase
        .from('outputs')
        .update({ status: 'error', content: { error: 'Generation failed' } })
        .eq('id', output.id);

      return new Response(
        JSON.stringify({ error: 'Failed to generate output' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Generate output error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
