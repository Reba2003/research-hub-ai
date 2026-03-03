import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = Deno.env.get('N8N_WEBHOOK_URL') || 'http://localhost:5678/webhook/user-action';

type ActionType = 'signup' | 'new_conversation' | 'add_source';

interface WebhookPayload {
  action: ActionType;
  userId: string;
  email?: string;
  name?: string;
  title?: string;
  conversationId?: string;
  sourceType?: string;
  sourceUrl?: string;
  sourceId?: string;
}

Deno.serve(async (req) => {
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
    const { action, title, conversationId, sourceType, sourceUrl, sourceId } = body;

    // Build payload matching n8n workflow expected fields
    const webhookPayload: WebhookPayload = {
      action,
      userId: user.id,
      email: user.email,
      name: user.user_metadata?.display_name || user.email?.split('@')[0],
      ...(title && { title }),
      ...(conversationId && { conversationId }),
      ...(sourceType && { sourceType }),
      ...(sourceUrl && { sourceUrl }),
      ...(sourceId && { sourceId }),
    };

    console.log('Sending to n8n:', JSON.stringify(webhookPayload, null, 2));

    // Send to n8n webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    if (!n8nResponse.ok) {
      const errText = await n8nResponse.text();
      console.error('n8n webhook error:', errText);
      return new Response(
        JSON.stringify({ error: 'Failed to trigger n8n workflow', details: errText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let n8nResult;
    try {
      n8nResult = await n8nResponse.json();
    } catch {
      n8nResult = { success: true };
    }
    
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
