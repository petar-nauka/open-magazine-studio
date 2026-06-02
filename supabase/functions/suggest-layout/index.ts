import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ContentBlock {
  id: string;
  type: "heading" | "text" | "image" | "pull_quote";
  content: string;
  position: number;
  metadata: {
    level?: number;
    imageAspect?: "landscape" | "portrait" | "square";
  };
}

interface PageConfig {
  id: string;
  layout: "hero-top" | "two-column" | "full-width" | "sidebar-image";
  blocks: ContentBlock[];
  pullQuote?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { blocks } = (await req.json()) as { blocks: ContentBlock[] };

    if (!blocks || blocks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No content blocks provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pages: PageConfig[] = [];
    let pageIndex = 0;
    const BLOCKS_PER_PAGE = 5;

    const firstImage = blocks.find((b) => b.type === "image");
    const titleBlock = blocks.find(
      (b) => b.type === "heading" && b.metadata.level === 1
    );

    let remainingBlocks = [...blocks];

    // First page: hero layout with title + first image
    if (titleBlock || firstImage) {
      const heroBlocks: ContentBlock[] = [];
      let consumed = 0;

      for (let i = 0; i < remainingBlocks.length && heroBlocks.length < 4; i++) {
        heroBlocks.push(remainingBlocks[i]);
        consumed++;
        if (remainingBlocks[i].type === "image" && heroBlocks.length >= 2) break;
      }

      pages.push({
        id: `page_${pageIndex++}`,
        layout: "hero-top",
        blocks: heroBlocks,
      });

      remainingBlocks = remainingBlocks.slice(consumed);
    }

    // Distribute remaining blocks across pages
    let currentPageBlocks: ContentBlock[] = [];

    for (const block of remainingBlocks) {
      currentPageBlocks.push(block);

      if (currentPageBlocks.length >= BLOCKS_PER_PAGE) {
        const hasImage = currentPageBlocks.some((b) => b.type === "image");
        const imageBlock = currentPageBlocks.find((b) => b.type === "image");

        let layout: PageConfig["layout"] = "two-column";

        if (hasImage && imageBlock) {
          if (imageBlock.metadata.imageAspect === "portrait") {
            layout = "sidebar-image";
          } else if (imageBlock.metadata.imageAspect === "landscape") {
            layout = "full-width";
          }
        }

        // Find a good pull quote candidate
        const quoteCandidate = currentPageBlocks.find(
          (b) =>
            b.type === "text" &&
            b.content.length > 60 &&
            b.content.length < 200
        );

        pages.push({
          id: `page_${pageIndex++}`,
          layout,
          blocks: currentPageBlocks,
          pullQuote: quoteCandidate?.content,
        });

        currentPageBlocks = [];
      }
    }

    // Last page with remaining blocks
    if (currentPageBlocks.length > 0) {
      pages.push({
        id: `page_${pageIndex++}`,
        layout: "two-column",
        blocks: currentPageBlocks,
      });
    }

    const result = {
      pages,
      font: "Georgia",
      accentColor: "#1a5f3a",
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to generate layout", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
