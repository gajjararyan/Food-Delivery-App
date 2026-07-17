/** Human-readable coords for pins without paid reverse geocoding. */
export function formatCoordsLabel(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

const COORDS_LABEL_RE =
  /^\d+\.\d+°[NS],\s*\d+\.\d+°[EW]$/i;

export function isCoordsLabel(label: string): boolean {
  return COORDS_LABEL_RE.test(label.trim());
}

function isGenericPinLabel(label: string): boolean {
  const t = label.trim().toLowerCase();
  return t === 'pinned location' || t === 'saved pin';
}

/** Primary display name for a saved spot (never duplicates coordinates). */
export function formatSpotTitle(params: {
  label: string;
  hint?: string | null;
}): string {
  const hint = params.hint?.trim();
  const label = params.label.trim();
  const namedLabel =
    label && !isCoordsLabel(label) && !isGenericPinLabel(label)
      ? label
      : null;

  if (hint && namedLabel) return `${namedLabel} — ${hint}`;
  if (hint) return hint;
  if (namedLabel) return namedLabel;
  return 'Saved pin';
}

export function formatAddressLine(params: {
  label: string;
  hint?: string | null;
  lat?: number;
  lng?: number;
}): string {
  const { label, hint } = params;
  const trimmedHint = hint?.trim();
  const trimmedLabel = label.trim();

  if (trimmedHint) {
    if (isCoordsLabel(trimmedLabel) || isGenericPinLabel(trimmedLabel)) {
      return trimmedHint;
    }
    return `${trimmedLabel} — ${trimmedHint}`;
  }

  if (trimmedLabel && !isCoordsLabel(trimmedLabel)) {
    return trimmedLabel;
  }

  if (params.lat != null && params.lng != null) {
    return formatCoordsLabel(params.lat, params.lng);
  }

  return trimmedLabel || 'Saved pin';
}

export function coordsNear(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  thresholdDeg = 0.00045,
): boolean {
  return Math.abs(a.lat - b.lat) < thresholdDeg && Math.abs(a.lng - b.lng) < thresholdDeg;
}
