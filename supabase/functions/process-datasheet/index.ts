import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RequestSchema = z.object({
  fileBase64: z.string().min(100, 'PDF inválido'),
  fileName: z.string().optional(),
  hint: z.enum(['module', 'inverter', 'auto']).optional().default('auto'),
});

const ExtractedInverter = z.object({
  brand: z.string(),
  model: z.string(),
  power: z.number(),
  max_dc_voltage: z.number(),
  mppt_min: z.number(),
  mppt_max: z.number(),
  max_input_current: z.number(),
  mppt_count: z.number(),
  nominal_output_voltage: z.number(),
  output_phases: z.number(),
});

const ExtractedModule = z.object({
  brand: z.string(),
  model: z.string(),
  power: z.number(),
  voc: z.number(),
  isc: z.number(),
  vmp: z.number(),
  imp: z.number(),
});

const ResultSchema = z.object({
  type: z.enum(['inverter', 'module', 'mixed']),
  extractedInverters: z.array(ExtractedInverter),
  extractedModules: z.array(ExtractedModule),
});

const MAX_BASE64_LENGTH = 14_000_000; // ~10 MB

const SYSTEM_PROMPT = `Você é um especialista em datasheets de equipamentos fotovoltaicos.
Analise o PDF anexado e extraia TODAS as especificações técnicas de módulos solares e/ou inversores.
Um mesmo datasheet pode conter VÁRIOS modelos em uma tabela — extraia cada um como um item separado.

Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem texto adicional) com este formato exato:
{
  "type": "inverter" | "module" | "mixed",
  "extractedInverters": [
    { "brand": string, "model": string, "power": number (kW),
      "max_dc_voltage": number (V), "mppt_min": number (V), "mppt_max": number (V),
      "max_input_current": number (A), "mppt_count": number,
      "nominal_output_voltage": number (V), "output_phases": number (1, 2 ou 3) }
  ],
  "extractedModules": [
    { "brand": string, "model": string, "power": number (W),
      "voc": number (V), "isc": number (A), "vmp": number (V), "imp": number (A) }
  ]
}

REGRAS CRÍTICAS:
- NUNCA omita campos. Se um valor numérico não constar no PDF, use 0.
- "type" = "inverter" se só houver inversores, "module" se só houver módulos, "mixed" se ambos.
- Sempre retorne os dois arrays (vazios se não aplicável).
- Potência de inversores em kW (ex: 5.0). Potência de módulos em W (ex: 550).
- output_phases: 1 = monofásico, 2 = bifásico, 3 = trifásico.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const parsedReq = RequestSchema.safeParse(body);
    if (!parsedReq.success) {
      return new Response(
        JSON.stringify({ error: 'Requisição inválida', details: parsedReq.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileBase64, fileName, hint } = parsedReq.data;

    if (fileBase64.length > MAX_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'PDF muito grande (máx ~10MB).' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY ausente no servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hintMsg =
      hint === 'module'
        ? 'O usuário indicou que este datasheet é de MÓDULOS solares.'
        : hint === 'inverter'
        ? 'O usuário indicou que este datasheet é de INVERSORES.'
        : 'Detecte automaticamente se é módulo, inversor ou ambos.';

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: hintMsg },
              {
                type: 'file',
                file: {
                  filename: fileName || 'datasheet.pdf',
                  file_data: `data:application/pdf;base64,${fileBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em instantes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (aiResponse.status === 402) {
      return new Response(
        JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos no workspace.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: 'Falha ao processar o datasheet via IA.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiJson = await aiResponse.json();
    const rawContent: string = aiJson?.choices?.[0]?.message?.content ?? '';
    const cleaned = rawContent
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error:', e, 'content:', rawContent);
      return new Response(
        JSON.stringify({ error: 'A IA não retornou JSON válido.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validated = ResultSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error('Zod validation error:', validated.error.flatten());
      return new Response(
        JSON.stringify({
          error: 'Formato extraído inválido.',
          details: validated.error.flatten(),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(validated.data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('process-datasheet error:', err);
    return new Response(
      JSON.stringify({ error: 'Erro inesperado no processamento.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
