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

function chunkText(text: string, maxChars = 4000): Array<{ content: string; pages: number[] }> {
  if (text.length <= maxChars) {
    const pages = extractPageNumbers(text);
    return [{ content: text, pages }];
  }
  const chunks: Array<{ content: string; pages: number[] }> = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push({ content: remaining, pages: extractPageNumbers(remaining) });
      break;
    }
    let breakPoint = remaining.lastIndexOf('. ', maxChars);
    if (breakPoint < maxChars * 0.5) breakPoint = remaining.lastIndexOf('\n', maxChars);
    if (breakPoint < maxChars * 0.3) breakPoint = maxChars;
    const chunkContent = remaining.slice(0, breakPoint + 1).trim();
    chunks.push({ content: chunkContent, pages: extractPageNumbers(chunkContent) });
    remaining = remaining.slice(breakPoint + 1).trim();
  }
  return chunks;
}

function extractPageNumbers(text: string): number[] {
  const pageMarkerRegex = /<<<PAGE_(\d+)>>>/g;
  const pages: number[] = [];
  let match;
  while ((match = pageMarkerRegex.exec(text)) !== null) {
    pages.push(parseInt(match[1], 10));
  }
  return pages;
}

function extractTimestamps(text: string): string[] {
  const tsRegex = /<<<TIMESTAMP_([\d:]+)>>>/g;
  const timestamps: string[] = [];
  let match;
  while ((match = tsRegex.exec(text)) !== null) {
    timestamps.push(match[1]);
  }
  return timestamps;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function extractVideoId(url: string): string | null {
  // Handle various YouTube URL formats including share links with ?si= params
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function extractYoutubeTranscript(url: string): Promise<string> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    console.error('[process-source] Could not extract YouTube video ID from:', url);
    return '';
  }

  const API_KEY = Deno.env.get('TRANSCRIPTAPI_KEY');
  if (!API_KEY) {
    console.error('[process-source] TRANSCRIPTAPI_KEY not configured');
    return '';
  }

  console.log('[process-source] Fetching transcript via TranscriptAPI for:', videoId);

  try {
    const response = await fetch(
      `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${videoId}&format=json`,
      {
        headers: { 'Authorization': `Bearer ${API_KEY}` },
      }
    );

    if (!response.ok) {
      console.error('[process-source] TranscriptAPI failed:', response.status, await response.text());
      return '';
    }

    const data = await response.json();
    const segments = data.segments as Array<{ start: number; end?: number; text: string }> | undefined;

    if (!segments || segments.length === 0) {
      console.log('[process-source] TranscriptAPI returned no segments');
      return '';
    }

    console.log(`[process-source] TranscriptAPI returned ${segments.length} segments`);

    // Convert to our timestamped marker format
    const result: string[] = [];
    for (const seg of segments) {
      const timestamp = formatTimestamp(Math.floor(seg.start));
      if (seg.text.trim()) {
        result.push(`<<<TIMESTAMP_${timestamp}>>>\n${seg.text.trim()}`);
      }
    }

    console.log(`[process-source] Formatted ${result.length} timestamped segments`);
    return result.join('\n');
  } catch (error) {
    console.error('[process-source] TranscriptAPI error:', error);
    return '';
  }
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
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('*')
      .eq('id', source_id)
      .eq('user_id', user.id)
      .single();

    if (sourceError || !source) {
      return new Response(
        JSON.stringify({ error: 'Source not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sourceData = source as SourceData;
    console.log('[process-source] Processing:', sourceData.name, 'Type:', sourceData.type);

    await supabase.from('sources').update({ status: 'processing' }).eq('id', source_id);

    let rawContent = '';

    // Priority 1: Use client-side extracted content from metadata (for PDFs)
    if (sourceData.metadata?.extracted_content) {
      rawContent = sourceData.metadata.extracted_content as string;
      console.log(`[process-source] Using client-extracted content: ${rawContent.length} chars`);
    }
    // Priority 2: Text type sources store content directly in metadata
    else if (sourceData.type === 'text') {
      rawContent = (sourceData.metadata?.content as string) || '';
    }
    // Priority 3: YouTube – extract real transcript with timestamps
    else if (sourceData.type === 'youtube') {
      rawContent = await extractYoutubeTranscript(sourceData.file_url || '');
      if (!rawContent) {
        rawContent = `YouTube video: ${sourceData.file_url}. Transcript could not be extracted automatically.`;
      }
    }
    // Priority 4: Download text files from storage
    else if (sourceData.file_path) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('sources')
          .download(sourceData.file_path);

        if (downloadError || !fileData) {
          throw new Error(`Download failed: ${downloadError?.message}`);
        }

        // Only attempt text extraction for text-like files
        const ext = sourceData.name.split('.').pop()?.toLowerCase() || '';
        const textExts = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'c', 'cpp'];
        
        if (textExts.includes(ext)) {
          rawContent = await fileData.text();
          console.log(`[process-source] Text file: ${rawContent.length} chars`);
        } else {
          // For binary files without client-extracted content, try reading as text
          const textAttempt = await fileData.text();
          if (textAttempt.length > 100 && !/[\x00-\x08\x0E-\x1F]/.test(textAttempt.substring(0, 500))) {
            rawContent = textAttempt;
          } else {
            rawContent = `File "${sourceData.name}" was uploaded but text could not be extracted server-side. Please re-upload to enable client-side text extraction.`;
          }
        }
      } catch (e) {
        console.error('[process-source] File processing error:', e);
      }
    }

    if (!rawContent.trim()) {
      await supabase.from('sources').update({ status: 'error' }).eq('id', source_id);
      return new Response(
        JSON.stringify({ error: 'No content could be extracted from source' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete existing documents for re-processing
    await supabase.from('documents').delete().eq('source_id', source_id).eq('user_id', user.id);

    // Store full raw content as chunked documents
    const chunks = chunkText(rawContent, 4000);
    console.log(`[process-source] Storing ${chunks.length} chunks (${rawContent.length} total chars) for: ${sourceData.name}`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const timestamps = extractTimestamps(chunk.content);
      
      let locationLabel: string;
      if (chunk.pages.length > 0) {
        locationLabel = chunk.pages.length === 1
          ? `p.${chunk.pages[0]}`
          : `pp.${chunk.pages[0]}-${chunk.pages[chunk.pages.length - 1]}`;
      } else if (timestamps.length > 0) {
        locationLabel = timestamps.length === 1
          ? timestamps[0]
          : `${timestamps[0]}-${timestamps[timestamps.length - 1]}`;
      } else {
        locationLabel = `Part ${i + 1}`;
      }
      
      // Strip page and timestamp markers from stored content
      const cleanContent = chunk.content
        .replace(/<<<PAGE_\d+>>>\n?/g, '')
        .replace(/<<<TIMESTAMP_[\d:]+>>>\n?/g, '');
      const { error: docError } = await supabase.from('documents').insert({
        source_id,
        user_id: user.id,
        content: cleanContent,
        metadata: {
          source_name: sourceData.name,
          source_type: sourceData.type,
          chunk_index: i,
          total_chunks: chunks.length,
          chunk_type: 'raw',
          processed_at: new Date().toISOString(),
          location: locationLabel,
          pages: chunk.pages,
          timestamps: timestamps,
        }
      });
      if (docError) console.error(`[process-source] Chunk ${i} error:`, docError);
    }

    // Also create an AI summary chunk
    try {
      const summaryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Create a comprehensive summary capturing ALL key information, facts, data points, arguments, and conclusions. Be thorough.' },
            { role: 'user', content: `Summarize this content from "${sourceData.name}":\n\n${rawContent.substring(0, 60000)}` }
          ],
        }),
      });

      if (summaryResponse.ok) {
        const summaryResult = await summaryResponse.json();
        const summaryContent = summaryResult.choices?.[0]?.message?.content || '';
        if (summaryContent) {
          await supabase.from('documents').insert({
            source_id,
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
      console.error('[process-source] Summary error (non-critical):', aiError);
    }

    // Clean up: remove extracted_content from metadata to save space
    if (sourceData.metadata?.extracted_content) {
      const cleanMetadata = { ...sourceData.metadata };
      delete cleanMetadata.extracted_content;
      await supabase.from('sources').update({ metadata: cleanMetadata }).eq('id', source_id);
    }

    await supabase.from('sources').update({ status: 'ready' }).eq('id', source_id);
    console.log('[process-source] Success:', source_id, `${chunks.length} chunks stored`);

    return new Response(
      JSON.stringify({ success: true, source_id, chunks: chunks.length, total_chars: rawContent.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[process-source] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
