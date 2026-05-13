import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')
    const { type } = await req.json()

    let userPrompt = ''
    if (type === 'topic') {
      userPrompt = 'Generate a conversation topic for couples with 3 discussion questions. Respond with ONLY valid JSON: {"title": string, "questions": string[]}. Make it meaningful for relationship growth.'
    } else if (type === 'exercise') {
      userPrompt = 'Generate a deep connection exercise for couples. Respond with ONLY valid JSON: {"title": string, "description": string, "duration": string}. Make it interactive and meaningful.'
    } else {
      throw new Error('Invalid content type')
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
        'X-Lovable-AIG-SDK': 'edge-function',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a relationship coach. Always respond with ONLY valid JSON. No markdown fences.' },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (res.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (res.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted. Add credits in your workspace.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`)

    const data = await res.json()
    const raw = String(data?.choices?.[0]?.message?.content ?? '').replace(/```json\s*|\s*```/g, '').trim()
    const content = JSON.parse(raw)

    return new Response(JSON.stringify(content), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('generate-conversation-content error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate content' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
