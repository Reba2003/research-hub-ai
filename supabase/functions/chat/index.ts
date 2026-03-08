import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type ModelProvider = 'gemini' | 'openai' | 'deepseek' | 'auto';

interface ChatRequest {
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
  source_ids?: string[];
  model_provider?: ModelProvider;
  has_image?: boolean;
}

function getProviderConfig(provider: ModelProvider, hasImage: boolean) {
  // If image is attached, use Gemini via OpenRouter for vision
  if (hasImage) {
    const key = Deno.env.get('OPENROUTER_API_KEY');
    if (!key) throw new Error('OpenRouter API key not configured');
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key,
      model: 'google/gemini-2.5-flash',
      name: 'Gemini Flash (Vision via OpenRouter)',
      maxChars: 800000,
    };
  }

  switch (provider) {
    case 'openai': {
      const key = Deno.env.get('OPENROUTER_API_KEY');
      if (!key) throw new Error('OpenRouter API key not configured');
      return {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key,
        model: 'openai/gpt-4o',
        name: 'GPT-4o (OpenRouter)',
        maxChars: 400000,
      };
    }
    case 'deepseek': {
      const key = Deno.env.get('OPENROUTER_API_KEY');
      if (!key) throw new Error('OpenRouter API key not configured');
      return {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key,
        model: 'deepseek/deepseek-chat',
        name: 'DeepSeek Chat (OpenRouter)',
        maxChars: 500000,
      };
    }
    case 'gemini': {
      const key = Deno.env.get('OPENROUTER_API_KEY');
      if (!key) throw new Error('OpenRouter API key not configured');
      return {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key,
        model: 'google/gemini-2.5-flash',
        name: 'Gemini Flash (OpenRouter)',
        maxChars: 800000,
      };
    }
    case 'auto':
    default: {
      const key = Deno.env.get('LOVABLE_API_KEY');
      if (!key) throw new Error('LOVABLE_API_KEY not configured');
      return {
        url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        key,
        model: 'google/gemini-2.5-flash',
        name: 'Auto (Lovable AI)',
        maxChars: 800000,
      };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    const { messages, source_ids, model_provider = 'auto', has_image = false }: ChatRequest = await req.json();

    // Get provider configuration first so we know context limits
    const config = getProviderConfig(model_provider, has_image);

    // Fetch documents for enabled sources
    let sourceContext = '';
    if (source_ids && source_ids.length > 0) {
      const { data: documents } = await supabase
        .from('documents')
        .select('content, metadata, source_id')
        .eq('user_id', user.id)
        .in('source_id', source_ids)
        .order('source_id');

      if (documents && documents.length > 0) {
        let totalChars = 0;
        const chunks: string[] = [];
        for (const doc of documents) {
          const meta = doc.metadata as Record<string, unknown> || {};
          const chunkType = meta.chunk_type === 'summary' ? ' (Summary)' : '';
          const chunkIndex = typeof meta.chunk_index === 'number' ? meta.chunk_index : chunks.length;
          // Estimate page number: ~4000 chars per chunk, ~2500 chars per page
          const estPage = Math.floor(chunkIndex * 4000 / 2500) + 1;
          const pageInfo = meta.source_type === 'pdf' ? `, ~p.${estPage}` : '';
          const locationInfo = meta.location ? ` (${meta.location}${pageInfo})` : '';
          const chunk = `[Source ${chunks.length + 1} - ${meta.source_name || 'Unknown'}${chunkType}${locationInfo}]: ${doc.content}`;
          if (totalChars + chunk.length > config.maxChars) {
            console.log(`Context truncated at ${totalChars} chars (limit: ${config.maxChars}) after ${chunks.length} chunks`);
            break;
          }
          chunks.push(chunk);
          totalChars += chunk.length;
        }
        if (chunks.length > 0) {
          sourceContext = '\n\nSource materials:\n' + chunks.join('\n\n');
        }
      }
    }

    const systemPrompt = `You are StudyTimeAI, an intelligent research assistant. You help users understand and analyze their uploaded study materials.

When answering questions:
1. Reference specific parts of the sources when possible
2. Provide clear, well-structured answers using the FULL content available
3. Use citations that include the source name AND page number when available, e.g. [Source Name, p.42] or [Source Name, pp.42-45]
4. For PDF sources, always include page numbers in citations based on the ~p.N info provided in the source labels
5. Be thorough and detailed - use all the information from the sources
6. If you cannot find relevant information in the sources, say so honestly
7. If an image is provided, analyze it thoroughly and relate it to the source materials when relevant

${sourceContext}`;
    console.log(`Using model: ${config.name} (provider: ${model_provider}, hasImage: ${has_image})`);

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://studytimeai.lovable.app',
        'X-Title': 'StudyTimeAI',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${config.name} error:`, response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `${config.name} temporarily unavailable` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Chat function error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
