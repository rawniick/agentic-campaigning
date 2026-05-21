// Pluggable Embedding-Provider-Contract. Implementations:
//   - mockEmbeddingProvider     (Tests, deterministisch seed-basiert)
//   - openaiEmbeddingProvider   (Phase 5 production, kommt wenn API-Key da)
//
// Provider sind dimension-agnostic. Caller stellt sicher dass alle persistierten
// und gequerten Vektoren von derselben Provider-Instanz stammen (sonst ist die
// Cosine-Distance unsinnig).

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}
