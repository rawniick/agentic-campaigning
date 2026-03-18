import type {
  AIProvider,
  ImageAIRequest,
  ImageResponseData,
  ImageProviderId,
} from "../types";

/** Vertrag fuer alle Image-Provider */
export interface ImageProvider
  extends AIProvider<ImageAIRequest, ImageResponseData> {
  readonly id: ImageProviderId;
  readonly capability: "image";

  /** Unterstuetzte Dimensionen abfragen */
  getSupportedDimensions(): { width: number; height: number }[];
}
