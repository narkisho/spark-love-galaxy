import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

    const { date, budget, country } = await req.json()
    console.log('Generating date idea for:', { date, budget, country })

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
        'X-Lovable-AIG-SDK': 'edge-function',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You generate creative romantic date ideas. Always respond with ONLY valid JSON, no markdown fences, matching: {"title": string, "description": string, "estimatedCost": string}.',
          },
          {
            role: 'user',
            content: `Generate a romantic date idea for ${date} with a budget of $${budget} in ${country}. Make it creative and specific to the location and date provided.`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits in your workspace.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`AI gateway error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content ?? ''
    const cleaned = String(raw).replace(/```json\s*|\s*```/g, '').trim()
    const content = JSON.parse(cleaned)
    console.log('Parsed date idea:', content)

    return new Response(JSON.stringify(content), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error generating date idea:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate date idea' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
