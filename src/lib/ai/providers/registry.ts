// Provider Registry - Singleton fuer alle registrierten AI Provider

import type {
  AICapability,
  AIProvider,
  AIProviderId,
  ProviderConfig,
} from "./types";

class ProviderRegistry {
  private providers = new Map<AIProviderId, AIProvider>();
  private configs = new Map<AIProviderId, ProviderConfig>();

  /** Provider-Implementierung registrieren */
  register(provider: AIProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(
        `[ProviderRegistry] Provider ${provider.id} bereits registriert, wird ueberschrieben`
      );
    }
    this.providers.set(provider.id, provider);
  }

  /** DB-Konfigurationen laden (beim Startup oder Refresh) */
  loadConfigs(configs: ProviderConfig[]): void {
    this.configs.clear();
    for (const config of configs) {
      this.configs.set(config.providerId, config);
    }
  }

  /** Provider per ID holen (null wenn nicht verfuegbar oder deaktiviert) */
  get<T extends AIProvider>(id: AIProviderId): T | null {
    const provider = this.providers.get(id) as T | undefined;
    if (!provider) return null;

    // Pruefen: env vars vorhanden UND in Config aktiviert
    const config = this.configs.get(id);
    if (config && !config.isEnabled) return null;
    if (!provider.isAvailable()) return null;

    return provider;
  }

  /** Alle Provider fuer eine Capability, sortiert nach Prioritaet */
  getByCapability(capability: AICapability): AIProvider[] {
    const result: AIProvider[] = [];

    for (const [id, provider] of this.providers) {
      if (provider.capability !== capability) continue;
      if (!provider.isAvailable()) continue;

      const config = this.configs.get(id);
      if (config && !config.isEnabled) continue;

      result.push(provider);
    }

    return result.sort((a, b) => {
      const aPrio = this.configs.get(a.id)?.priority ?? 999;
      const bPrio = this.configs.get(b.id)?.priority ?? 999;
      return aPrio - bPrio;
    });
  }

  /** Status aller registrierten Provider auflisten */
  listAll(): Array<{
    id: AIProviderId;
    capability: AICapability;
    displayName: string;
    available: boolean;
    enabled: boolean;
    priority: number;
  }> {
    return Array.from(this.providers.values()).map((p) => {
      const config = this.configs.get(p.id);
      return {
        id: p.id,
        capability: p.capability,
        displayName: p.displayName,
        available: p.isAvailable(),
        enabled: config?.isEnabled ?? true,
        priority: config?.priority ?? 999,
      };
    });
  }
}

// Singleton
export const providerRegistry = new ProviderRegistry();
