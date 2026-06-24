import type { Db } from "../types";
import type { CopyOutput } from "@/lib/copy/generateCopy";

// Ein Turn im Gate-Chat. Bei Assistant-Turns traegt `candidates` das erzeugte
// CopyOutput-Set; bei User-Turns ist es null.
export interface GateChatTurn {
  id: string;
  campaign_id: string;
  gate: string;
  language: string;
  role: "user" | "assistant";
  content: string;
  candidates: CopyOutput | null;
  created_at: string;
}

// Liest den kompletten Chat-Verlauf eines Gates in einer Sprache, aelteste
// zuerst (ASC nach created_at) — damit der UI-Verlauf chronologisch rendert.
export async function getGateChat(
  db: Db,
  campaignId: string,
  gate: string,
  language: string
): Promise<GateChatTurn[]> {
  const res = await db.query<Record<string, unknown>>(
    `SELECT id, campaign_id, gate, language, role, content, candidates, created_at
       FROM gate_chat
      WHERE campaign_id = $1 AND gate = $2 AND language = $3
      ORDER BY created_at ASC`,
    [campaignId, gate, language]
  );
  return res.rows.map(mapRow);
}

// Haengt einen Turn an. `candidates` wird als jsonb gespeichert (JSON.stringify
// + $n::jsonb); User-Turns uebergeben undefined/null -> SQL NULL.
export async function appendGateChatTurn(
  db: Db,
  input: {
    campaignId: string;
    gate: string;
    language: string;
    role: "user" | "assistant";
    content: string;
    candidates?: CopyOutput | null;
  }
): Promise<GateChatTurn> {
  const candidatesJson =
    input.candidates == null ? null : JSON.stringify(input.candidates);

  const res = await db.query<Record<string, unknown>>(
    `INSERT INTO gate_chat
       (campaign_id, gate, language, role, content, candidates)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, campaign_id, gate, language, role, content, candidates, created_at`,
    [
      input.campaignId,
      input.gate,
      input.language,
      input.role,
      input.content,
      candidatesJson,
    ]
  );
  return mapRow(res.rows[0]);
}

// pg parst jsonb beim Lesen bereits zu einem Objekt — `candidates` ist also
// entweder schon das CopyOutput-Objekt oder null; einfach durchreichen.
function mapRow(row: Record<string, unknown>): GateChatTurn {
  return {
    id: row.id as string,
    campaign_id: row.campaign_id as string,
    gate: row.gate as string,
    language: row.language as string,
    role: row.role as "user" | "assistant",
    content: row.content as string,
    candidates: (row.candidates as CopyOutput | null) ?? null,
    created_at: String(row.created_at),
  };
}
