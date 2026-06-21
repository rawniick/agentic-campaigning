import type { ReactElement } from "react";
import type { Db } from "../db/types";
import type { AssetStorage } from "../storage/types";
import type { BrandConfig } from "../brand/loadBrand";
import { getV1Formats, type FormatSpec } from "../db/queries/format-specs";
import { createAsset, recordFailedAsset } from "../db/queries/assets";
import { renderToPng as defaultRenderToPng } from "../render/renderToPng";
import {
  resolveHeroSrc,
  defaultFetchHeroBytes,
  type FetchHeroBytesFn,
} from "../render/resolveHeroSrc";
import { checkBrandConformity } from "../qa/checkBrandConformity";
import { transitionGate, type CampaignState } from "../state/transitionGate";
import { runVisionQA, type VisionQAClient } from "../qa/runVisionQA";
import { resolveAiLabelConfig } from "../aiLabel/resolveAiLabelConfig";
import {
  translateCampaignCopy,
  type TranslateLLMFn,
} from "../copy/translateCampaignCopy";
import {
  findTemplate,
  emphasisForArt,
  type CampaignArt,
  type TemplateComponent,
} from "../../templates/wingo/registry";
import React from "react";

export interface RunMultiplexInput {
  campaignId: string;
  brandConfig: BrandConfig;
  logoUrl: string;
  // injizierbar fuer Tests
  renderToPng?: (
    node: ReactElement,
    opts: { width: number; height: number }
  ) => Promise<Buffer>;
  visionClient?: VisionQAClient;
  // Wenn gesetzt: fehlende Zielsprachen (fr/it/en) werden vor dem Render
  // nachgezogen (translate-if-missing), damit wirklich alle 44 entstehen.
  translate?: {
    passthroughTerms: string[];
    llm: TranslateLLMFn;
  };
  // Auto-Retry pro Asset gegen transiente Render-/Upload-Fehler. Default 2.
  maxRenderRetries?: number;
  // Laedt Hero-Bytes fuer das serverseitige Einbetten als Data-URI (Satori fetcht
  // keine Remote-URLs). Injizierbar fuer Tests; default = HTTP-Fetch.
  fetchHeroBytes?: FetchHeroBytesFn;
  // true, wenn der Render auf den Interim-Logo-Platzhalter zurueckfiel (kein echtes
  // Wingo-Lockup). Geht in den Konformitaets-Gate ein. Default false.
  logoIsPlaceholder?: boolean;
}

export interface MultiplexedAsset {
  formatCode: string;
  language: string;
  assetId: string;
  storageUrl: string;
}

export interface MultiplexFailure {
  formatCode: string;
  language: string;
  error: string;
}

export interface RunMultiplexResult {
  assets: MultiplexedAsset[];
  failures: MultiplexFailure[];
  durationMs: number;
}

// de ist die Quelle (Gate 1), uebersetzt werden fr/it/en.
const TARGET_TRANSLATED_LANGUAGES = ["fr", "it", "en"] as const;

// Zieht fehlende Zielsprachen via translateCampaignCopy nach. Fail-loud, wenn
// danach immer noch Sprachen fehlen — kein stummes Rendern von nur 11 statt 44.
async function ensureAllLanguages(
  db: Db,
  campaignId: string,
  translate: NonNullable<RunMultiplexInput["translate"]>
): Promise<void> {
  const before = await db.query<{ language: string }>(
    `SELECT language FROM campaign_copy WHERE campaign_id = $1 AND is_approved = true`,
    [campaignId]
  );
  const have = new Set(before.rows.map((r) => r.language));
  const missing = TARGET_TRANSLATED_LANGUAGES.filter((l) => !have.has(l));
  if (missing.length === 0) return;

  await translateCampaignCopy(db, {
    campaignId,
    passthroughTerms: translate.passthroughTerms,
    llm: translate.llm,
  });

  const after = await db.query<{ language: string }>(
    `SELECT language FROM campaign_copy WHERE campaign_id = $1 AND is_approved = true`,
    [campaignId]
  );
  const haveAfter = new Set(after.rows.map((r) => r.language));
  const stillMissing = TARGET_TRANSLATED_LANGUAGES.filter(
    (l) => !haveAfter.has(l)
  );
  if (stillMissing.length > 0) {
    throw new Error(
      `Uebersetzung unvollstaendig — fehlende Sprachen: ${stillMissing.join(", ")}`
    );
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

interface GateData {
  brand_id: string;
  kampagne_art: CampaignArt;
  price_promo: string;
  price_suffix: string;
  language: string;
  headline: string;
  subline: string;
  cta_label: string;
  disclaimer_text: string;
  hero_url: string;
  hero_source: string;
  variant: string;
}

function disclaimerColumnFor(language: string): "text_de" | "text_fr" | "text_it" | "text_en" {
  switch (language) {
    case "de":
      return "text_de";
    case "fr":
      return "text_fr";
    case "it":
      return "text_it";
    case "en":
      return "text_en";
    default:
      return "text_de";
  }
}

// Liefert eine GateData-Zeile pro approved Sprache der Kampagne.
// Disclaimer-Text wird pro Sprache aus der disclaimers-Tabelle gezogen
// (NIE via LLM uebersetzt — Compliance-Pass-through).
async function loadGateDataPerLanguage(db: Db, campaignId: string): Promise<GateData[]> {
  const res = await db.query<{
    brand_id: string;
    art: string;
    price_promo: string;
    price_suffix: string;
    language: string;
    headlines: string[];
    subline: string;
    cta_label: string;
    selected_headline_idx: number;
    disclaimer_ids: string[];
    hero_url: string;
    hero_source: string;
    variant: string;
  }>(
    `SELECT
        c.brand_id, c.art, c.price_promo::text AS price_promo, c.price_suffix,
        cc.language, cc.headlines, cc.subline, cc.cta_label,
        cc.selected_headline_idx, cc.disclaimer_ids,
        ch.storage_url AS hero_url,
        ch.source AS hero_source,
        cl.variant
       FROM campaigns c
       JOIN campaign_copy cc ON cc.campaign_id = c.id AND cc.is_approved = true
       LEFT JOIN campaign_hero ch ON ch.campaign_id = c.id
       LEFT JOIN campaign_layout cl ON cl.campaign_id = c.id
      WHERE c.id = $1`,
    [campaignId]
  );
  if (res.rows.length === 0) {
    throw new Error(`Campaign ${campaignId} has no approved copy`);
  }

  // Collect all distinct disclaimer ids across languages — one query, one map per lang
  const allIds = Array.from(
    new Set(res.rows.flatMap((r) => r.disclaimer_ids ?? []))
  );
  const disclaimerTexts = new Map<string, Record<string, string>>(); // id -> {de,fr,it,en}
  if (allIds.length > 0) {
    const d = await db.query<{
      id: string;
      text_de: string;
      text_fr: string;
      text_it: string;
      text_en: string;
      slug: string;
    }>(
      `SELECT id, text_de, text_fr, text_it, text_en, slug
         FROM disclaimers
        WHERE id = ANY($1::uuid[])
        ORDER BY slug`,
      [allIds]
    );
    for (const row of d.rows) {
      disclaimerTexts.set(row.id, {
        de: row.text_de,
        fr: row.text_fr,
        it: row.text_it,
        en: row.text_en,
      });
    }
  }

  return res.rows.map((row) => {
    const col = disclaimerColumnFor(row.language).slice(5) as "de" | "fr" | "it" | "en";
    // ALLE zutreffenden Disclaimer rendern (Compliance: ein Produkt kann mehrere
    // Pflicht-Hinweise haben, z.B. 5G-Netz + Preis-/Vertrags-Disclaimer) — nicht
    // nur der erste. Pro Sprache aus der DB, nie via LLM uebersetzt. Reihenfolge ist
    // via matchDisclaimers ORDER BY slug deterministisch.
    // Separator " · " statt "\n": Satori rendert white-space:normal und wuerde ein
    // "\n" zu einem Space kollabieren (Run-on); " · " trennt sichtbar und umbricht
    // sauber. (Echtes mehrzeiliges Disclaimer-Layout ist ein spaeterer Template-Schliff.)
    const disclaimer_text = (row.disclaimer_ids ?? [])
      .map((id) => disclaimerTexts.get(id)?.[col])
      .filter((t): t is string => Boolean(t))
      .join(" · ");
    return {
      brand_id: row.brand_id,
      kampagne_art: row.art as CampaignArt,
      price_promo: row.price_promo,
      price_suffix: row.price_suffix,
      language: row.language,
      headline: row.headlines[row.selected_headline_idx],
      subline: row.subline,
      cta_label: row.cta_label,
      disclaimer_text,
      hero_url: row.hero_url,
      hero_source: row.hero_source,
      variant: row.variant,
    };
  });
}

async function renderOneFormat(
  db: Db,
  storage: AssetStorage,
  brandConfig: BrandConfig,
  campaignId: string,
  format: FormatSpec,
  component: TemplateComponent,
  data: GateData,
  logoUrl: string,
  renderImpl: NonNullable<RunMultiplexInput["renderToPng"]>,
  visionClient: VisionQAClient | undefined,
  maxRetries: number,
  heroSrc: string,
  logoIsPlaceholder: boolean
): Promise<MultiplexedAsset> {
  // AI-Label-Pflicht (Brand-Compliance): nur bei source='ai' beziehen.
  // Wenn die Brand kein Label registriert hat, gibt der Resolver null zurueck —
  // Template laesst das Asset dann weg (gleicher Codepfad wie upload/library).
  const aiLabel =
    data.hero_source === "ai"
      ? (await resolveAiLabelConfig(db, brandConfig.brand.id, format)) ?? undefined
      : undefined;

  const emphasis = emphasisForArt(data.kampagne_art);

  // heroSrc ist bereits die eingebettete Data-URI (einmal pro Lauf aufgeloest, da
  // alle 44 Assets denselben Hero teilen) — kein Fetch pro Format.
  const jsx = React.createElement(component, {
    tokens: brandConfig.tokens,
    headline: data.headline,
    subline: data.subline,
    pricePromo: Number(data.price_promo).toFixed(2),
    priceSuffix: data.price_suffix,
    ctaLabel: data.cta_label,
    disclaimer: data.disclaimer_text,
    heroImageUrl: heroSrc,
    logoSrc: logoUrl,
    variant: data.variant,
    emphasis,
    aiLabel,
  });

  const key = `${brandConfig.brand.slug}/${campaignId}/${format.code}-${data.language}.png`;

  // Auto-Retry nur um die transient-anfaellige Bild-Erzeugung (Render + Upload),
  // bewusst KEINE DB-Writes — sonst riskieren wir doppelte Inserts beim Retry.
  const { png, url } = await withRetry(async () => {
    const png = await renderImpl(jsx, {
      width: format.width,
      height: format.height,
    });
    const { url } = await storage.upload(key, png, "image/png");
    return { png, url };
  }, maxRetries);

  // Deterministischer Brand-Konformitaets-Gate: persistiert pro Asset, ob es
  // ausgeliefert werden darf (echtes Logo, korrekte Dimensionen, Brand-Farbe).
  // Der ZIP-Export blockt conformity_pass=false.
  const conformity = await checkBrandConformity({
    pngBytes: png,
    expectedWidth: format.width,
    expectedHeight: format.height,
    brandPrimaryHex: brandConfig.tokens.colors.primary.hex,
    logoIsPlaceholder,
  });

  const asset = await createAsset(db, {
    campaign_id: campaignId,
    format_id: format.id,
    language: data.language,
    storage_url: url,
    file_size_bytes: png.length,
    mime_type: "image/png",
    conformity_pass: conformity.pass,
    conformity_details: { checks: conformity.checks },
  });

  // Vision-QA ist best-effort: ein QA-Fehler darf das Asset nicht failen.
  if (visionClient) {
    try {
      await runVisionQA(db, visionClient, {
        assetId: asset.id,
        imageBytes: png,
        imageMimeType: "image/png",
        brandPrimaryHex: brandConfig.tokens.colors.primary.hex,
        formatCode: format.code,
      });
    } catch (e) {
      console.error(
        `[runMultiplex] Vision-QA fehlgeschlagen fuer Asset ${asset.id} ` +
          `(best-effort, Asset bleibt gueltig):`,
        e
      );
    }
  }

  return {
    formatCode: format.code,
    language: data.language,
    assetId: asset.id,
    storageUrl: url,
  };
}

// Multi-Format Orchestrator: laedt einmal die approved Gate-Daten,
// laeuft parallel ueber alle V1-Formate, fuer die ein Template registriert ist.
// State-Machine: final_pending -> rendering -> done (oder failed).
export async function runMultiplex(
  db: Db,
  storage: AssetStorage,
  input: RunMultiplexInput
): Promise<RunMultiplexResult> {
  const t0 = Date.now();
  const renderImpl = input.renderToPng ?? defaultRenderToPng;

  const cur = await db.query<{ status: CampaignState }>(
    `SELECT status FROM campaigns WHERE id = $1`,
    [input.campaignId]
  );
  if (cur.rows.length === 0) throw new Error("Campaign not found");
  const renderingState = transitionGate(cur.rows[0].status, "FINAL_APPROVED");
  await db.query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [
    input.campaignId,
    renderingState,
  ]);

  try {
    // translate-if-missing VOR dem Laden, damit neu erzeugte Sprachen mitgeladen
    // werden. Garantiert 44 statt stumm 11 (oder fail-loud, wenn unmoeglich).
    if (input.translate) {
      await ensureAllLanguages(db, input.campaignId, input.translate);
    }

    const dataPerLang = await loadGateDataPerLanguage(db, input.campaignId);

    // Hero-Guard: ohne ausgewaehlten Hero (Gate 2) entstuende ein Asset ohne Bild.
    if (!dataPerLang[0].hero_url) {
      throw new Error("Kein Hero ausgewaehlt — Gate 2 nicht abgeschlossen");
    }

    // Hero EINMAL aufloesen + einbetten — alle 44 Assets teilen denselben Hero,
    // also kein Fetch pro Format. Schlaegt das Einbetten fehl (Download/Nicht-Bild),
    // faellt der ganze Lauf fail-loud (outer catch → state=failed), statt 44 blanke
    // Hero-Assets als "fertig" auszuliefern (KO-Kriterium Brand-Konformitaet).
    const heroSrc = await resolveHeroSrc(
      dataPerLang[0].hero_url,
      input.fetchHeroBytes ?? defaultFetchHeroBytes
    );

    const kampagneArt = dataPerLang[0].kampagne_art;
    const v1Formats = await getV1Formats(db);

    const renderableTargets: Array<{ format: FormatSpec; component: TemplateComponent }> =
      [];
    for (const format of v1Formats) {
      const component = findTemplate(format.code, kampagneArt);
      if (component) renderableTargets.push({ format, component });
    }

    // Fail-loud + klar, wenn der Kampagnentyp (noch) keine Templates hat —
    // sonst landete die Kampagne mit generischem "kein Asset gerendert" stumm
    // im Fail-State (z.B. eine im Brief-Enum erlaubte, aber unregistrierte Art).
    if (renderableTargets.length === 0) {
      throw new Error(
        `Kein Template fuer Kampagnentyp '${kampagneArt}' registriert — keine Formate renderbar`
      );
    }

    // Cartesian product: jedes Format x jede Sprache
    const renderTasks: Array<{
      format: FormatSpec;
      component: TemplateComponent;
      data: GateData;
    }> = [];
    for (const target of renderableTargets) {
      for (const data of dataPerLang) {
        renderTasks.push({ ...target, data });
      }
    }

    // Idempotenz: alte Assets entfernen, bevor neu gerendert wird. Sonst crasht
    // der Re-Run an UNIQUE(campaign_id, format_id, language).
    await db.query(`DELETE FROM assets WHERE campaign_id = $1`, [input.campaignId]);

    // Partial-success: ein einzelner Fehler killt nicht alle 44. Pro Asset
    // Auto-Retry; Fehler werden gesammelt + als status='failed' persistiert.
    const maxRetries = input.maxRenderRetries ?? 2;
    const settled = await Promise.allSettled(
      renderTasks.map(({ format, component, data }) =>
        renderOneFormat(
          db,
          storage,
          input.brandConfig,
          input.campaignId,
          format,
          component,
          data,
          input.logoUrl,
          renderImpl,
          input.visionClient,
          maxRetries,
          heroSrc,
          input.logoIsPlaceholder ?? false
        )
      )
    );

    const assets: MultiplexedAsset[] = [];
    const failures: MultiplexFailure[] = [];
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === "fulfilled") {
        assets.push(r.value);
      } else {
        const task = renderTasks[i];
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        failures.push({
          formatCode: task.format.code,
          language: task.data.language,
          error: msg,
        });
        await recordFailedAsset(db, {
          campaign_id: input.campaignId,
          format_id: task.format.id,
          language: task.data.language,
          error: msg,
        });
      }
    }

    // Totalausfall ist ein echter Fehler — fail-loud (state=failed).
    if (assets.length === 0) {
      throw new Error(
        `Multiplex fehlgeschlagen — kein Asset gerendert (${failures.length} Fehler)`
      );
    }

    const doneState = transitionGate(renderingState, "RENDER_COMPLETE");
    await db.query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [
      input.campaignId,
      doneState,
    ]);

    return {
      assets,
      failures,
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    const failedState = transitionGate(renderingState, "RENDER_FAILED");
    await db.query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [
      input.campaignId,
      failedState,
    ]);
    throw e;
  }
}

export interface RetryAssetInput {
  campaignId: string;
  brandConfig: BrandConfig;
  logoUrl: string;
  formatId: string;
  language: string;
  renderToPng?: RunMultiplexInput["renderToPng"];
  visionClient?: VisionQAClient;
  maxRenderRetries?: number;
  fetchHeroBytes?: FetchHeroBytesFn;
  logoIsPlaceholder?: boolean;
}

// Re-rendert genau EIN Asset (Format x Sprache) — fuer Einzel-Retry nach
// Partial-success. Aendert KEINEN Campaign-State (bleibt 'done'); createAsset
// upsertet die failed-Zeile auf status='rendered'.
export async function retryAsset(
  db: Db,
  storage: AssetStorage,
  input: RetryAssetInput
): Promise<MultiplexedAsset> {
  const renderImpl = input.renderToPng ?? defaultRenderToPng;

  const dataPerLang = await loadGateDataPerLanguage(db, input.campaignId);
  const data = dataPerLang.find((d) => d.language === input.language);
  if (!data) {
    throw new Error(`Keine approved Copy fuer Sprache ${input.language}`);
  }
  if (!data.hero_url) {
    throw new Error("Kein Hero ausgewaehlt — Gate 2 nicht abgeschlossen");
  }

  const format = (await getV1Formats(db)).find((f) => f.id === input.formatId);
  if (!format) throw new Error(`Format ${input.formatId} nicht gefunden`);

  const component = findTemplate(format.code, data.kampagne_art);
  if (!component) throw new Error(`Kein Template fuer Format ${format.code}`);

  const heroSrc = await resolveHeroSrc(
    data.hero_url,
    input.fetchHeroBytes ?? defaultFetchHeroBytes
  );

  return renderOneFormat(
    db,
    storage,
    input.brandConfig,
    input.campaignId,
    format,
    component,
    data,
    input.logoUrl,
    renderImpl,
    input.visionClient,
    input.maxRenderRetries ?? 2,
    heroSrc,
    input.logoIsPlaceholder ?? false
  );
}
