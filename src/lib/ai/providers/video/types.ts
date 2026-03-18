import type {
  AIProvider,
  VideoAIRequest,
  VideoResponseData,
  VideoProviderId,
} from "../types";

/** Vertrag fuer alle Video-Provider */
export interface VideoProvider
  extends AIProvider<VideoAIRequest, VideoResponseData> {
  readonly id: VideoProviderId;
  readonly capability: "video";

  /** Maximale Video-Dauer in Sekunden */
  getMaxDurationSeconds(): number;

  /** Unterstuetzte Seitenverhaeltnisse */
  getSupportedAspectRatios(): string[];
}
