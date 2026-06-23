import type { CSSProperties, ReactElement } from "react";
import type { AiLabelPosition } from "../db/queries/format-specs";

// Konfiguration fuer das AI-Label-Asset, das auf jedem AI-generierten Rendering
// pflicht-eingebettet ist. `src` ist der finale URL (Storage oder static asset),
// `position` kommt aus format_specs.ai_label_position oder dem brand-globalen
// Default (siehe resolveAiLabelConfig, kommt in einer separaten Slice).
export interface AiLabelConfig {
  src: string;
  position: AiLabelPosition;
}

export interface AiLabelOverlayProps {
  config: AiLabelConfig;
}

function styleForPosition(position: AiLabelPosition): CSSProperties {
  const { anchor, offset, size } = position;
  const style: CSSProperties = {
    position: "absolute",
    width: size.w,
    height: size.h,
    // objectFit:contain — Pflicht-Brand-Asset proportional skalieren, nie
    // verzerren (gleiche KO-Klasse wie das Logo), falls Quell- != Slot-Ratio.
    objectFit: "contain",
  };
  if (anchor.startsWith("top")) style.top = offset.y;
  if (anchor.startsWith("bottom")) style.bottom = offset.y;
  if (anchor.endsWith("left")) style.left = offset.x;
  if (anchor.endsWith("right")) style.right = offset.x;
  return style;
}

export function AiLabelOverlay({ config }: AiLabelOverlayProps): ReactElement {
  return (
    <img
      src={config.src}
      alt="AI-generated content label"
      style={styleForPosition(config.position)}
    />
  );
}
