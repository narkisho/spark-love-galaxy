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
    const { preferences } = await req.json()

    const userPrompt = `Generate a relationship-building activity based on:
- Relationship Level: ${preferences.relationship_level}
- Duration: ${preferences.activity_duration} minutes
- Location: ${preferences.location}
- Romance Level: ${preferences.level_of_romance}

Respond with ONLY valid JSON matching this exact shape:
{
  "title": string,
  "description": string,
  "category": string,
  "stage": string,
  "duration": number,
  "difficulty_level": number,
  "location": string,
  "partner_roles": {
    "partner1": { "title": string, "tasks": string[], "preparation": string[] },
    "partner2": { "title": string, "tasks": string[], "preparation": string[] }
  }
}`

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
          { role: 'system', content: 'You design engaging couple activities. Always respond with ONLY valid JSON. No markdown fences.' },
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
    const activity = JSON.parse(raw)

    const formattedDescription = `${activity.description}\n\n**Partner 1 — ${activity.partner_roles.partner1.title}:**\n${activity.partner_roles.partner1.tasks.map((t: string) => `- ${t}`).join('\n')}\n\n**Partner 2 — ${activity.partner_roles.partner2.title}:**\n${activity.partner_roles.partner2.tasks.map((t: string) => `- ${t}`).join('\n')}`

    return new Response(JSON.stringify({ ...activity, description: formattedDescription }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('generate-closer-activity error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate activity' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
