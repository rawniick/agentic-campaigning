// Campaign State Machine — Phase 2 5-Gate-Flow
//
// states:    created -> copy_pending -> hero_pending -> layout_pending
//            -> final_pending -> rendering -> done
// Re-Open:   bringt Status zurueck auf einen frueheren Gate, ohne den Reset
//            der Daten zu implementieren (das macht Cycle 7).

export type CampaignState =
  | "created"
  | "copy_pending"
  | "hero_pending"
  | "layout_pending"
  | "final_pending"
  | "rendering"
  | "done"
  | "failed";

export type GateEvent =
  | "COPY_GENERATED"
  | "COPY_APPROVED"
  | "HERO_SELECTED"
  | "LAYOUT_APPROVED"
  | "FINAL_APPROVED"
  | "RENDER_COMPLETE"
  | "RENDER_FAILED"
  | "REOPEN_TO_COPY"
  | "REOPEN_TO_HERO"
  | "REOPEN_TO_LAYOUT"
  | "REOPEN_TO_FINAL";

const FORWARD_TRANSITIONS: Partial<Record<CampaignState, Partial<Record<GateEvent, CampaignState>>>> = {
  created: { COPY_GENERATED: "copy_pending" },
  copy_pending: { COPY_APPROVED: "hero_pending" },
  hero_pending: { HERO_SELECTED: "layout_pending" },
  layout_pending: { LAYOUT_APPROVED: "final_pending" },
  final_pending: { FINAL_APPROVED: "rendering" },
  rendering: { RENDER_COMPLETE: "done", RENDER_FAILED: "failed" },
};

// Ordnung der Gates entlang des Happy-Path. Re-Open ist nur RUECKWAERTS
// erlaubt — kein Sprung an einen Gate, der noch nicht erreicht wurde.
const GATE_ORDER: CampaignState[] = [
  "created",
  "copy_pending",
  "hero_pending",
  "layout_pending",
  "final_pending",
  "rendering",
  "done",
];

const REOPEN_TARGETS: Partial<Record<GateEvent, CampaignState>> = {
  REOPEN_TO_COPY: "copy_pending",
  REOPEN_TO_HERO: "hero_pending",
  REOPEN_TO_LAYOUT: "layout_pending",
  REOPEN_TO_FINAL: "final_pending",
};

function isReopen(event: GateEvent): event is keyof typeof REOPEN_TARGETS {
  return event in REOPEN_TARGETS;
}

export function transitionGate(state: CampaignState, event: GateEvent): CampaignState {
  if (isReopen(event)) {
    const target = REOPEN_TARGETS[event]!;
    const currentIdx = GATE_ORDER.indexOf(state);
    const targetIdx = GATE_ORDER.indexOf(target);
    // Re-Open nur, wenn aktueller Stand >= Ziel-Gate (sonst waere es ein Sprung vorwaerts).
    // 'failed' darf zu jedem frueheren Gate, 'created' zu keinem.
    const allowFromFailed = state === "failed";
    if (!allowFromFailed && (currentIdx < 0 || targetIdx < 0 || currentIdx < targetIdx)) {
      throw new Error(`Invalid transition: ${state} + ${event} (cannot re-open forward)`);
    }
    return target;
  }

  const next = FORWARD_TRANSITIONS[state]?.[event];
  if (!next) {
    throw new Error(`Invalid transition: ${state} + ${event}`);
  }
  return next;
}
