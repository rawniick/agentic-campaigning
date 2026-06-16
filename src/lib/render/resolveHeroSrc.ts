import sharp from "sharp";
import { fetchAssetBytesFromUrl } from "../export/fetchAssetBytes";

// Bereitet das Hero-Bild fuer den Satori/resvg-Render auf:
// 1. Satori fetcht KEINE Remote-URLs (ein <img src="https://..."> rendert blank) →
//    Bytes serverseitig laden und als Data-URI einbetten.
// 2. resvg decodiert nur PNG/JPEG/GIF (KEIN WebP) und ein 200-Response mit
//    Nicht-Bild-Body wuerde sonst als kaputte Data-URI eingebettet (blanker Hero).
//    Darum jedes Bild via sharp → PNG normalisieren; sharp wirft bei Nicht-Bild,
//    der Aufrufer failt das Asset dann fail-loud statt blank zu rendern.
// Der Template-Vertrag (heroImageUrl: string) bleibt unveraendert.

export type FetchHeroBytesFn = (url: string) => Promise<Buffer>;

// Begrenzt Speicher + Data-URI-Groesse; deckt das groesste V1-Format locker ab.
const MAX_HERO_DIMENSION_PX = 2048;

export async function resolveHeroSrc(
  heroUrl: string,
  fetchBytes: FetchHeroBytesFn = fetchAssetBytesFromUrl
): Promise<string> {
  // Schon eingebettet (oder leer) → nicht erneut laden.
  if (!heroUrl || heroUrl.startsWith("data:")) return heroUrl;
  // Nur fetchbare HTTP(S)-URLs einbetten (Storage-Public-URLs). Andere Schemes
  // (z.B. lokale/Test-Artefakte) bleiben unveraendert — kein Fehl-Fetch.
  if (!/^https?:\/\//i.test(heroUrl)) return heroUrl;

  const raw = await fetchBytes(heroUrl);
  const png = await sharp(raw)
    .resize({
      width: MAX_HERO_DIMENSION_PX,
      height: MAX_HERO_DIMENSION_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

// Default-Fetcher: identisch zum Storage-Fetch des ZIP-Exports — bewusst
// wiederverwendet (timed fetch + res.ok), damit beide nicht auseinanderdriften.
export const defaultFetchHeroBytes: FetchHeroBytesFn = fetchAssetBytesFromUrl;
