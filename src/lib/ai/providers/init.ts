// Provider-Initialisierung - wird einmal beim Startup aufgerufen

import { providerRegistry } from "./registry";
import { getAllProviderConfigs } from "./config";
import { claudeProvider } from "./text/claude";
import { openaiProvider } from "./text/openai";
import { nanobananaProvider } from "./image/nanobanana";
import { dalleProvider } from "./image/dalle";
import { veo3Provider } from "./video/veo3";

let initialized = false;

/**
 * Alle Provider registrieren und DB-Konfigurationen laden.
 * Wird lazy beim ersten Router-Aufruf getriggert.
 */
export async function initializeProviders(): Promise<void> {
  if (initialized) return;

  // Text-Provider
  providerRegistry.register(claudeProvider);
  providerRegistry.register(openaiProvider);

  // Image-Provider
  providerRegistry.register(nanobananaProvider);
  providerRegistry.register(dalleProvider);

  // Video-Provider
  providerRegistry.register(veo3Provider);

  // Weitere Provider hier registrieren wenn implementiert:
  // providerRegistry.register(fluxProvider);
  // providerRegistry.register(runwayProvider);

  // DB-Konfigurationen laden
  try {
    const configs = await getAllProviderConfigs();
    providerRegistry.loadConfigs(configs);
  } catch (err) {
    console.warn(
      "[ProviderInit] DB-Configs konnten nicht geladen werden, nutze Defaults:",
      err
    );
  }

  initialized = true;
}

/** Fuer Tests: Initialisierung zuruecksetzen */
export function resetProviders(): void {
  initialized = false;
}
