// Position-Propagation: master-relative (0..1) Koordinaten -> format-absolute Pixel.
// Optional: Safezone-Insets erzwingen, dass das Element innerhalb der zulaessigen
// Brand-Zone bleibt (Clamping links/oben + Width-Shrink rechts/unten).

export interface RelativeBox {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface SafezoneInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FormatDimensions {
  width: number;
  height: number;
  safezone?: SafezoneInsets;
}

export interface AbsoluteBox {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export function propagatePositions(
  rel: RelativeBox,
  format: FormatDimensions
): AbsoluteBox {
  let x = rel.x * format.width;
  let y = rel.y * format.height;
  let w = rel.w === undefined ? undefined : rel.w * format.width;
  let h = rel.h === undefined ? undefined : rel.h * format.height;

  const sz = format.safezone;
  if (sz) {
    if (x < sz.left) x = sz.left;
    if (y < sz.top) y = sz.top;

    const maxRight = format.width - sz.right;
    const maxBottom = format.height - sz.bottom;

    if (w !== undefined && x + w > maxRight) {
      w = maxRight - x;
    }
    if (h !== undefined && y + h > maxBottom) {
      h = maxBottom - y;
    }
  }

  return { x, y, w, h };
}
