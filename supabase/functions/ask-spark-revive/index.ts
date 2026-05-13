import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Server configuration is incomplete');
    }

    const { question, userId, context } = await req.json();
    if (typeof question !== 'string' || !question.trim() || typeof userId !== 'string' || !userId.trim()) {
      return new Response(JSON.stringify({ error: 'Question and userId are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Received request:', { question, userId, hasContext: !!context });

    const messages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: 'You are a thoughtful, empathetic relationship expert. Provide warm, practical, and concise advice.',
      },
    ];

    if (context?.previousQuestion && context?.previousAnswer) {
      messages.push({ role: 'user', content: context.previousQuestion });
      messages.push({ role: 'assistant', content: context.previousAnswer });
    }

    messages.push({ role: 'user', content: question });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
        'X-Lovable-AIG-SDK': 'edge-function',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const answer = typeof data?.choices?.[0]?.message?.content === 'string'
      ? data.choices[0].message.content.trim()
      : '';
    if (!answer) {
      console.error('Unexpected AI response shape:', data);
      throw new Error('No answer returned from AI');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { error: dbError } = await supabase
      .from('ai_conversations')
      .insert([{ user_id: userId, question, answer }]);

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ask-spark-revive function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
