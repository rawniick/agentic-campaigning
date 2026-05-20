// @vitest-environment node

import { describe, it, expect } from "vitest";

// Smoke-Tests gegen reale APIs. Werden übersprungen wenn entsprechende ENV
// fehlen, damit lokale Dev-Runs ohne Credentials grün bleiben.
// Bewusste Integration-Tests — NICHT in CI default. Manuell aufrufen via
//   ANTHROPIC_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx vitest run smoke

const hasClaude = !!process.env.ANTHROPIC_API_KEY;
const hasSupabase =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe.skipIf(!hasClaude)("Claude API smoke", () => {
  it("authenticates and responds to a minimal prompt", async () => {
    const { callClaude } = await import("../ai/claude");
    const res = await callClaude<string>({
      systemPrompt:
        "You are a smoke-test responder. Reply with exactly the word: OK",
      userMessage: "ping",
      maxTokens: 16,
      temperature: 0,
    });

    expect(res.rawText.trim().toLowerCase()).toContain("ok");
    expect(res.tokensUsed.total).toBeGreaterThan(0);
  }, 30_000);
});

describe.skipIf(!hasSupabase)("Supabase smoke", () => {
  it("reaches the Supabase Auth endpoint with the anon key", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await client.auth.getSession();
    expect(error).toBeNull();
    expect(data).toBeDefined();
  }, 30_000);
});
