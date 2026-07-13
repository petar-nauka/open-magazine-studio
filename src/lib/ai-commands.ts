import type { ContentBlock } from './paste-parser';
import { reconcileRichSegments } from './paste-parser';

// The AI chat protocol: the model answers in prose and appends fenced blocks
// (```commands … ```) holding JSON rewrite commands addressed by block ID.
// A fenced block is treated as commands ONLY when its JSON parses into at
// least one valid rewrite — real code samples in an answer stay displayed.

export interface RewriteProposal {
  blockId: string;
  text: string;
}

const FENCE_RE = /```[a-zA-Z-]*[ \t]*\n?([\s\S]*?)```/g;

// Tolerates {"commands":[…]}, a bare array, or a single command object.
function tryParseCommands(inner: string): RewriteProposal[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(inner.trim());
  } catch {
    return null;
  }
  const entries: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { commands?: unknown[] }).commands)
      ? (parsed as { commands: unknown[] }).commands
      : [parsed];
  const proposals: RewriteProposal[] = [];
  for (const e of entries) {
    const cmd = e as { action?: unknown; id?: unknown; text?: unknown };
    if (
      cmd && cmd.action === 'rewrite' &&
      typeof cmd.id === 'string' && cmd.id &&
      typeof cmd.text === 'string' && cmd.text.trim()
    ) {
      proposals.push({ blockId: cmd.id, text: cmd.text.trim() });
    }
  }
  return proposals.length > 0 ? proposals : null;
}

export function parseAssistantReply(raw: string): { display: string; proposals: RewriteProposal[] } {
  const proposals: RewriteProposal[] = [];
  const display = raw.replace(FENCE_RE, (match, inner: string) => {
    const cmds = tryParseCommands(inner);
    if (!cmds) return match; // ordinary code block — keep it visible
    proposals.push(...cmds);
    return '';
  });
  return { display: display.trim(), proposals };
}

// Applies rewrites by block ID. Missing blocks (edited/deleted since the model
// answered) and image/ad blocks (their content is a URL) are skipped. The
// formatting metadata goes through reconcileRichSegments so the paginated
// render shows the new text, not stale rich segments.
export function applyProposals(blocks: ContentBlock[], proposals: RewriteProposal[]): ContentBlock[] {
  return blocks.map((b) => {
    const p = proposals.find((x) => x.blockId === b.id);
    if (!p || b.type === 'image' || b.type === 'ad') return b;
    return { ...b, content: p.text, metadata: reconcileRichSegments(p.text, b.metadata) };
  });
}
