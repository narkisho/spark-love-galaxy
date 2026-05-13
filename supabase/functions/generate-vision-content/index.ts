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
    const { prompt } = await req.json()
    if (!prompt) throw new Error('No prompt provided')

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
          { role: 'system', content: 'You are a warm, encouraging relationship coach. Use clear markdown formatting (headings, bold, bullet lists) to enhance and expand relationship visions into specific, actionable, and inspiring goals with measurable outcomes.' },
          { role: 'user', content: `Enhance this relationship vision/goal: "${prompt}"` },
        ],
      }),
    })

    if (res.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (res.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted. Add credits in your workspace.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`)

    const data = await res.json()
    const suggestion = String(data?.choices?.[0]?.message?.content ?? '').trim()

    return new Response(JSON.stringify({ suggestion }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('generate-vision-content error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
