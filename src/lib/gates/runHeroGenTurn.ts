import type { Db } from "../db/types";
import type { AssetStorage } from "../storage/types";
import type { ImageProvider } from "../imagegen/types";
import type { ClaudeCallOptions, ClaudeResponse } from "../ai/claude";
import {
  generateHeroCandidatesForGate,
  type PersistedHeroCandidate,
} from "./generateHeroCandidatesForGate";
import { refineHeroPrompt } from "../imagegen/refineHeroPrompt";
import { getGateChat, appendGateChatTurn } from "../db/queries/gate-chat";

// Ein Hero-Gen-Chat-Turn (Gate 2). Komponiert die getesteten Bausteine:
//   refineHeroPrompt (Iteration) -> generateHeroCandidatesForGate -> gate_chat.
// Persistiert User- + Assistant-Turn (Audit + Re-Open). Aenderung am Bild erfolgt
// IMMER via Re-Gen (neuer Prompt/Refs), nie per Drag — der Hero ist ein flaches
// Raster (siehe mentales Modell im Plan).
export interface HeroGenTurnInput {
  campaignId: string;
  brandSlug: string;
  brandName: string;
  language?: string; // default 'de'
  // Erstgenerierung: basePrompt gesetzt, userMessage leer.
  basePrompt?: string;
  // Iteration: userMessage gesetzt -> refineHeroPrompt verfeinert currentPrompt.
  currentPrompt?: string;
  userMessage?: string;
  // Komponenten-Uploads + Library-Refs (-> styleReferenceUrls / nano-banana image_urls).
  referenceUrls?: string[];
  // Gewaehlte Variante des Vorturns -> zusaetzliche Style-Ref fuer diesen Turn.
  selectedReferenceUrl?: string;
  n?: number; // default 3
  modelId?: string;
  // Nur fuer die Iteration noetig (Prompt-Verfeinerung). Erstgenerierung braucht keine LLM.
  llm?: (
    opts: ClaudeCallOptions
  ) => Promise<ClaudeResponse<{ rationale: string; prompt: string }>>;
}

export interface HeroGenTurnResult {
  rationale: string;
  prompt: string;
  candidates: PersistedHeroCandidate[];
}

// Dedupliziert Komponenten-Refs + die gewaehlte Variante; undefined wenn leer
// (damit kein leeres image_urls an fal geht).
function mergeRefs(a?: string[], b?: string[]): string[] | undefined {
  const all = [...(a ?? []), ...(b ?? [])];
  if (all.length === 0) return undefined;
  return Array.from(new Set(all));
}

export async function runHeroGenTurn(
  db: Db,
  storage: AssetStorage,
  provider: ImageProvider,
  input: HeroGenTurnInput,
  fetchBytes?: (url: string) => Promise<Buffer>
): Promise<HeroGenTurnResult> {
  const language = input.language ?? "de";
  const isIteration =
    input.userMessage !== undefined && input.userMessage.trim() !== "";

  let prompt: string;
  let rationale: string;
  let refs: string[] | undefined;
  let userContent: string;

  if (isIteration) {
    if (!input.llm) {
      throw new Error(
        "runHeroGenTurn: llm fuer die Iteration erforderlich"
      );
    }
    // Bisherigen Hero-Dialog als LLM-Kontext laden (nur role+content relevant).
    const priorTurns = await getGateChat(db, input.campaignId, "hero", language);
    const history = priorTurns.map((t) => ({
      role: t.role,
      content: t.content,
    }));
    const refined = await refineHeroPrompt({
      brandName: input.brandName,
      currentPrompt: input.currentPrompt ?? "",
      history,
      userMessage: input.userMessage as string,
      selectedReferenceUrl: input.selectedReferenceUrl,
      llm: input.llm,
    });
    prompt = refined.prompt;
    rationale = refined.rationale;
    refs = mergeRefs(input.referenceUrls, refined.referenceUrls);
    userContent = input.userMessage as string;
  } else {
    if (!input.basePrompt || input.basePrompt.trim() === "") {
      throw new Error(
        "runHeroGenTurn: basePrompt fuer die Erstgenerierung erforderlich (prompt leer)"
      );
    }
    prompt = input.basePrompt;
    rationale = "Erste Generierung aus deinem Prompt.";
    refs = input.referenceUrls;
    userContent = input.basePrompt;
  }

  // User-Turn ZUERST persistieren — Feedback/Prompt darf bei einem Gen-Fehler
  // nicht verloren gehen (gleiches Muster wie der Copy-Chat).
  await appendGateChatTurn(db, {
    campaignId: input.campaignId,
    gate: "hero",
    language,
    role: "user",
    content: userContent,
  });

  const candidates = await generateHeroCandidatesForGate(
    provider,
    storage,
    {
      campaignId: input.campaignId,
      brandSlug: input.brandSlug,
      prompt,
      referenceUrls: refs,
      n: input.n,
      modelId: input.modelId,
    },
    fetchBytes
  );

  // Assistant-Turn mit Begruendung + Kandidaten-Set (prompt + images). Der Prompt
  // wird mitgespeichert, damit ein Re-Open den naechsten Iterations-Turn auf dem
  // letzten Stand fortsetzen kann.
  await appendGateChatTurn(db, {
    campaignId: input.campaignId,
    gate: "hero",
    language,
    role: "assistant",
    content: rationale,
    candidates: { prompt, images: candidates },
  });

  return { rationale, prompt, candidates };
}
