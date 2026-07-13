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
      'You are the AI editorial assistant inside "Magazine Studio", a Bulgarian magazine layout tool.',
      "The current article is listed below; every block appears as [Block №<n> | id=<id> | <TYPE>].",
      "You CAN: rewrite, shorten, expand or change the tone of text/heading/quote blocks; suggest better headlines; answer questions about the content.",
      "You CANNOT yet: add, delete or reorder blocks, or edit images/ads. If asked, say so honestly and suggest how to do it manually in the editor.",
      "",
      "When you propose concrete text changes, write a SHORT conversational reply (do not paste the full new text in it), then END the reply with exactly one fenced block:",
      "```commands",
      '{"commands":[{"action":"rewrite","id":"<block id from the context>","text":"<full replacement text>"}]}',
      "```",
      "Command rules:",
      '- "text" is the COMPLETE new text of the block — it replaces the old text verbatim.',
      "- Use the block's id exactly as written in the context. Never invent ids.",
      "- Never target IMAGE or AD blocks (their content is a URL).",
      "- Keep the language of the original block text.",
      "- The user approves each change in the app, so never claim a change is already made.",
      "- If the user only asks a question, do NOT emit a commands block.",
      "Write your conversational reply in Bulgarian unless the user writes in another language.",
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
