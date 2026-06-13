import { accessSync, constants } from "fs";
import { join } from "path";

// Temporary diagnostic endpoint. Tells us exactly what the serverless runtime
// sees WITHOUT making an Anthropic call. Hit /api/health after deploy/promote.
// Never returns the key value — only whether it exists.
export const dynamic = "force-dynamic";

function canRead(p: string): boolean {
  try { accessSync(p, constants.R_OK); return true; } catch { return false; }
}

export async function GET() {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, "directives", "system_prompt.md"),
    join(cwd, "kaprukaAgent", "directives", "system_prompt.md"),
  ];
  const promptReadable = candidates.find(canRead) || null;

  return Response.json({
    ok: true,
    anthropicKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
    anthropicKeyLength: process.env.ANTHROPIC_API_KEY?.length ?? 0,
    cwd,
    systemPromptReadable: Boolean(promptReadable),
    systemPromptPath: promptReadable,
    triedPaths: candidates,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
