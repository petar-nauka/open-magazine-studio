import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { blockContent, instruction, blockType } = await req.json();

    if (!blockContent || !instruction) {
      return new Response(
        JSON.stringify({ error: "Missing blockContent or instruction" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load AI settings from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase
      .from("mag_pdf_app_settings")
      .select("value")
      .eq("key", "ai_config")
      .maybeSingle();

    const aiConfig = settings?.value || {};
    const apiKey = aiConfig.api_key || Deno.env.get("OPENAI_API_KEY");
    const apiEndpoint = aiConfig.api_endpoint || "https://api.openai.com/v1/chat/completions";
    const modelName = aiConfig.model_name || "gpt-4o-mini";
    const systemInstructions = aiConfig.system_instructions || "";
    const temperature = aiConfig.temperature ?? 0.7;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No AI API key configured. Go to Settings > AI to add one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = [
      "You are an editorial assistant for a Bulgarian magazine layout tool.",
      "You rewrite or edit text blocks based on the user's instruction.",
      "Always respond in the same language as the input text.",
      "Return ONLY the rewritten text, nothing else - no quotes, no explanation.",
      `The block type is: ${blockType || "text"}.`,
      systemInstructions ? `Additional instructions: ${systemInstructions}` : "",
    ].filter(Boolean).join("\n");

    // Determine if this is an Anthropic or OpenAI compatible endpoint
    const isAnthropic = apiEndpoint.includes("anthropic.com");

    let rewrittenText: string;

    if (isAnthropic) {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 2000,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Original text:\n${blockContent}\n\nInstruction: ${instruction}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      rewrittenText = data.content?.[0]?.text || blockContent;
    } else {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          temperature,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Original text:\n${blockContent}\n\nInstruction: ${instruction}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI API error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      rewrittenText = data.choices?.[0]?.message?.content || blockContent;
    }

    return new Response(
      JSON.stringify({ rewritten: rewrittenText.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Rewrite failed", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
