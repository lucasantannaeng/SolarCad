import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { project } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize user inputs to prevent prompt injection
    const sanitize = (val: unknown, maxLen = 100): string => {
      if (typeof val !== 'string') return 'Não informado';
      return val.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLen) || 'Não informado';
    };
    const sanitizeNum = (val: unknown): number => {
      const n = Number(val);
      return isFinite(n) ? n : 0;
    };

    const blocksDesc = (project.equipmentBlocks || []).map((b: any, i: number) => {
      const dcPower = (sanitizeNum(b.modulePowerW) * sanitizeNum(b.moduleQty)) / 1000;
      const stringsDesc = (b.strings || []).map((s: any, si: number) => `String ${si + 1}: ${sanitizeNum(s.count)} módulos`).join(", ");
      return `Conjunto ${i + 1}: ${sanitizeNum(b.inverterQty)}x Inversor [BRAND: ${sanitize(b.inverterBrand)}] [MODEL: ${sanitize(b.inverterModel)}] (${sanitizeNum(b.inverterPowerKw)}kW) + ${sanitizeNum(b.moduleQty)}x Módulo [BRAND: ${sanitize(b.moduleBrand)}] [MODEL: ${sanitize(b.moduleModel)}] (${sanitizeNum(b.modulePowerW)}W) = ${dcPower.toFixed(2)} kWp. Strings: ${stringsDesc}`;
    }).join("\n");

    const utilityName = project.utility === "LIGHT" ? "Light (RECON-BT)" : "Enel RJ (CNC-GD)";
    const utilityNorm = project.utility === "LIGHT" ? "Norma Técnica Light RECON-BT" : "Norma Técnica Enel CNC-GD";

    const prompt = `Você é um engenheiro elétrico sênior especialista em energia solar fotovoltaica no Brasil.

DADOS DO PROJETO:
- Cliente: [CLIENT_NAME: ${sanitize(project.clientName)}]
- Endereço: [ADDRESS: ${sanitize(project.address, 200)}]
- Concessionária: ${utilityName}
- Tipo de Fornecimento: ${sanitize(project.connectionType, 50)}
- Nível de Tensão: ${sanitize(project.voltage, 50)}
- Disjuntor Geral: ${sanitizeNum(project.mainBreaker)}A
- Distância do Padrão: ${sanitizeNum(project.distance)}m

EQUIPAMENTOS:
${blocksDesc}

POTÊNCIA TOTAL DC: ${sanitizeNum(project.totalDcPower)} kWp
POTÊNCIA TOTAL AC: ${sanitizeNum(project.totalAcPower)} kW

Redija uma JUSTIFICATIVA TÉCNICA formal e completa para o memorial descritivo deste projeto de microgeração fotovoltaica. O texto deve:

1. Justificar a escolha dos equipamentos (módulos e inversores)
2. Explicar o dimensionamento das strings e a compatibilidade com os MPPTs
3. Detalhar as proteções elétricas (DPS CC/CA, disjuntores, fusíveis, aterramento)
4. Citar conformidade com: ABNT NBR 5410, ABNT NBR 16690, ABNT NBR 16149, ${utilityNorm}, Resolução ANEEL 482/2012 e 687/2015
5. Usar terminologia técnica específica da concessionária ${utilityName}
6. Mencionar o sistema anti-ilhamento e proteções de tensão/frequência do inversor
7. Ser formal, técnico e adequado para apresentação à concessionária

Escreva o texto completo, sem tópicos, em parágrafos corridos e formais. Aproximadamente 500-800 palavras.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um engenheiro elétrico brasileiro especialista em projetos fotovoltaicos para homologação. Escreva textos formais e técnicos." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
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

    return new Response(JSON.stringify({ justification: content.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Justification error:", e);
    return new Response(JSON.stringify({ error: "Erro ao gerar justificativa. Tente novamente." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
