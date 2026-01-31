import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PLACEHOLDER: Replace with your actual n8n webhook URL
const N8N_WEBHOOK_URL = Deno.env.get('N8N_WEBHOOK_URL') || 'https://your-n8n-instance.app.n8n.cloud/webhook/your-webhook-id';

interface WebhookPayload {
  event_type: 'file_upload' | 'message' | 'output_request';
  user_id: string;
  source_id?: string;
  file_url?: string;
  source_type?: string;
  message_content?: string;
  message_id?: string;
  output_type?: 'summary' | 'podcast' | 'quiz';
  output_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    const body = await req.json();
    const { event_type, source_id, file_url, source_type, message_content, message_id, output_type, output_id } = body;

    // Build payload for n8n
    const webhookPayload: WebhookPayload = {
      event_type,
      user_id: user.id,
      ...(source_id && { source_id }),
      ...(file_url && { file_url }),
      ...(source_type && { source_type }),
      ...(message_content && { message_content }),
      ...(message_id && { message_id }),
      ...(output_type && { output_type }),
      ...(output_id && { output_id }),
    };

    console.log('Sending to n8n webhook:', JSON.stringify(webhookPayload, null, 2));

    // Check if n8n URL is configured
    if (N8N_WEBHOOK_URL.includes('your-n8n-instance')) {
      console.warn('N8N_WEBHOOK_URL is not configured. Using mock response.');
      
      // Return mock success for development
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook received (n8n not configured - mock response)',
          payload: webhookPayload
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send to n8n webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!n8nResponse.ok) {
      console.error('n8n webhook error:', await n8nResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to trigger n8n workflow' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const n8nResult = await n8nResponse.json();
    
    return new Response(
      JSON.stringify({ success: true, data: n8nResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
