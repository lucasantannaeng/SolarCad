import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const InputSchema = z.object({
  module: z.object({
    brand: z.string().max(100),
    model: z.string().max(100),
    power: z.number().positive().max(2000),
    voc: z.number().positive().max(200),
    vmp: z.number().positive().max(200),
    isc: z.number().positive().max(50),
    imp: z.number().positive().max(50),
  }),
  inverter: z.object({
    brand: z.string().max(100),
    model: z.string().max(100),
    power: z.number().positive().max(1000),
    maxDcVoltage: z.number().positive().max(2000),
    maxInputCurrent: z.number().positive().max(200),
    mpptMin: z.number().positive().max(2000),
    mpptMax: z.number().positive().max(2000),
    mpptCount: z.number().int().min(1).max(20),
  }),
  inverterQty: z.number().int().min(1).max(100),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json().catch(() => null);
    const parsedInput = InputSchema.safeParse(rawBody);
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: "Entrada inválida.", details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { module, inverter, inverterQty } = parsedInput.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize user inputs to prevent prompt injection
    const sanitize = (val: unknown, maxLen = 100): string => {
      if (typeof val !== 'string') return '';
      return val.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLen);
    };
    const sanitizeNum = (val: unknown): number => {
      const n = Number(val);
      return isFinite(n) ? n : 0;
    };

    const prompt = `Você é um engenheiro elétrico especialista em dimensionamento de sistemas fotovoltaicos.

Dados do MÓDULO:
- Marca/Modelo: [BRAND: ${sanitize(module.brand)}] [MODEL: ${sanitize(module.model)}]
- Potência: ${sanitizeNum(module.power)}W
- Voc: ${sanitizeNum(module.voc)}V
- Vmp: ${sanitizeNum(module.vmp)}V  
- Isc: ${sanitizeNum(module.isc)}A
- Imp: ${sanitizeNum(module.imp)}A

Dados do INVERSOR:
- Marca/Modelo: [BRAND: ${sanitize(inverter.brand)}] [MODEL: ${sanitize(inverter.model)}]
- Potência: ${sanitizeNum(inverter.power)}kW
- Tensão DC Máxima: ${sanitizeNum(inverter.maxDcVoltage)}V
- Corrente Máxima de Entrada: ${sanitizeNum(inverter.maxInputCurrent)}A
- Faixa MPPT: ${sanitizeNum(inverter.mpptMin)}V - ${sanitizeNum(inverter.mpptMax)}V
- Número de MPPTs: ${sanitizeNum(inverter.mpptCount)}
- Quantidade de Inversores: ${sanitizeNum(inverterQty)}

REGRAS DE DIMENSIONAMENTO:
1. Voc_string = Nmodulos × Voc_modulo. Deve ser < Tensão DC Máxima do inversor (considerar fator de temperatura 1.14 para -10°C)
2. Vmp_string = Nmodulos × Vmp_modulo. Deve estar dentro da faixa MPPT (mpptMin a mpptMax)
3. Corrente por string = Isc_modulo. Strings em paralelo no mesmo MPPT somam correntes. Total < Corrente Máxima
4. Razão DC/AC ideal: entre 1.0 e 1.3 (máximo aceitável 1.35)
5. Distribuir strings uniformemente entre os MPPTs disponíveis

Retorne APENAS um JSON válido:
{
  "strings": [
    { "id": 1, "count": 10 },
    { "id": 2, "count": 10 }
  ],
  "totalModules": 20,
  "dcPowerKwp": 11.0,
  "dcAcRatio": 1.10,
  "vocString": 450.0,
  "vmpString": 380.0,
  "explanation": "Texto curto explicando a configuração escolhida e por que é ideal"
}

Sem markdown, sem explicações fora do JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um calculador técnico. Retorne apenas JSON válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Optimize error:", e);
    return new Response(JSON.stringify({ error: "Erro ao otimizar strings. Tente novamente." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
