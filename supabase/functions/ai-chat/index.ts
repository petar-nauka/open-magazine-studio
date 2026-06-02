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
    const { messages, articleContext } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settingsRow } = await supabase
      .from("mag_pdf_app_settings")
      .select("value")
      .eq("key", "ai_config")
      .maybeSingle();

    const aiConfig = settingsRow?.value || {};
    const apiKey = aiConfig.api_key;
    const apiEndpoint = aiConfig.api_endpoint || "https://ollama.com/v1/chat/completions";
    const modelName = aiConfig.model_name || "deepseek-v4-pro:cloud";
    const temperature = aiConfig.temperature ?? 0.7;
    const systemInstructions = aiConfig.system_instructions || "";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Няма конфигуриран API ключ. Отиди в Settings > AI." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = [
      "You are an AI editorial assistant for a Bulgarian magazine layout tool.",
      "You have full context of the current article - its title, text blocks, headings, images, and quotes.",
      "The user can ask you to:",
      "- Rewrite, shorten, expand, or change the tone of specific blocks",
      "- Suggest better headlines or subtitles",
      "- Reorganize the article structure",
      "- Describe what changes you would make",
      "- Answer questions about the content",
      "",
      "When you suggest specific text changes, format them clearly so the user can apply them.",
      "If you rewrite a block, prefix it with [BLOCK X REWRITE]: followed by the new text.",
      "Always respond in the same language as the user (Bulgarian by default).",
      "",
      articleContext || "",
      systemInstructions ? `\nAdditional instructions: ${systemInstructions}` : "",
    ].filter(Boolean).join("\n");

    const isAnthropic = apiEndpoint.includes("anthropic.com");

    let assistantContent: string;

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
          messages,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      assistantContent = data.content?.[0]?.text || "Грешка при генериране на отговор.";
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
            ...messages,
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI API error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      assistantContent = data.choices?.[0]?.message?.content || data.message?.content || "Грешка при генериране на отговор.";
    }

    return new Response(
      JSON.stringify({ content: assistantContent.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
