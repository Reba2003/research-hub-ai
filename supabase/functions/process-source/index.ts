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

  console.log('[process-source] Fetching YouTube transcript for video:', videoId);

  // Method 1: Use YouTube InnerTube API (most reliable from server-side)
  try {
    const transcript = await fetchViaInnerTube(videoId);
    if (transcript) return transcript;
  } catch (error) {
    console.error('[process-source] InnerTube method failed:', error);
  }

  // Method 2: Direct timedtext API
  try {
    const transcript = await fetchTimedTextDirect(videoId);
    if (transcript) return transcript;
  } catch (error) {
    console.error('[process-source] TimedText method failed:', error);
  }

  console.log('[process-source] All transcript extraction methods failed for:', videoId);
  return '';
}

async function fetchViaInnerTube(videoId: string): Promise<string> {
  // Step 1: Get video info to find caption tracks
  const playerResponse = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240101.00.00',
          hl: 'en',
        },
      },
      videoId,
    }),
  });

  if (!playerResponse.ok) {
    console.error('[process-source] InnerTube player request failed:', playerResponse.status);
    return '';
  }

  const playerData = await playerResponse.json();
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  
  if (!tracks || tracks.length === 0) {
    console.log('[process-source] No caption tracks found via InnerTube');
    return '';
  }

  // Prefer English, fall back to first
  const track = tracks.find((t: { languageCode: string }) => t.languageCode.startsWith('en')) || tracks[0];
  console.log('[process-source] Using caption track:', track.languageCode, 'from InnerTube');

  // Fetch the actual transcript XML
  const captionUrl = track.baseUrl + '&fmt=srv3';
  const captionRes = await fetch(captionUrl);
  if (!captionRes.ok) {
    console.error('[process-source] Failed to fetch caption XML:', captionRes.status);
    return '';
  }

  const xml = await captionRes.text();
  return parseTranscriptXml(xml);
}

async function fetchTimedTextDirect(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`;
  const res = await fetch(url);
  if (!res.ok) {
    console.log('[process-source] Direct timedtext failed:', res.status);
    return '';
  }
  const xml = await res.text();
  return parseTranscriptXml(xml);
}

function parseTranscriptXml(xml: string): string {
  // Parse <text start="..." dur="...">content</text> elements
  const textRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?\s*>([\s\S]*?)<\/text>/g;
  const segments: string[] = [];
  let match;

  while ((match = textRegex.exec(xml)) !== null) {
    const startSeconds = parseFloat(match[1]);
    const text = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '') // strip any HTML tags
      .trim();

    if (text) {
      const timestamp = formatTimestamp(startSeconds);
      segments.push(`<<<TIMESTAMP_${timestamp}>>>\n${text}`);
    }
  }

  if (segments.length === 0) {
    console.log('[process-source] No transcript segments parsed from XML');
    return '';
  }

  console.log(`[process-source] Extracted ${segments.length} transcript segments`);
  return segments.join('\n');
}
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
