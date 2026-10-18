// What the map popup shows from Google (session 10, approved preview): the
// address, phone number and Google Maps link for a saved place, fetched when
// the popup opens. Nothing here is stored.

export interface PlaceDetails {
  address: string | null
  phone: string | null
  /** Digits and + only, for a tel: link. */
  tel: string | null
  /** The place's own website, if Google has one. */
  website: string | null
  mapsUrl: string
}

/** A Google Maps link for a place (by its id when known). */
export function mapsLink(placeId: string | null, lat: number, lng: number): string {
  const q = `query=${lat},${lng}`
  return placeId ? `https://www.google.com/maps/search/?api=1&${q}&query_place_id=${encodeURIComponent(placeId)}` : `https://www.google.com/maps/search/?api=1&${q}`
}

export async function placeDetails(placeId: string | null, at: { lat: number; lng: number }): Promise<PlaceDetails> {
  const fallback: PlaceDetails = { address: null, phone: null, tel: null, website: null, mapsUrl: mapsLink(placeId, at.lat, at.lng) }
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
  if (!placeId || !key) return fallback
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'formattedAddress,nationalPhoneNumber,internationalPhoneNumber,googleMapsUri,websiteUri' }
    })
    if (!res.ok) return fallback
    const p = (await res.json()) as { formattedAddress?: string; nationalPhoneNumber?: string; internationalPhoneNumber?: string; googleMapsUri?: string; websiteUri?: string }
    const phone = p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null
    return {
      address: p.formattedAddress ?? null,
      phone,
      tel: phone ? phone.replace(/[^\d+]/g, '') : null,
      website: p.websiteUri ?? null,
      mapsUrl: p.googleMapsUri ?? fallback.mapsUrl
    }
  } catch {
    return fallback
  }
}

/** A website shown without https:// or a trailing slash. */
export function siteLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}

/** Google's own name for a saved place (session 14: the spelling suggestion on the edit cards). */
export async function googleName(placeId: string | null): Promise<string | null> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
  if (!placeId || !key) return null
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'displayName' }
    })
    if (!res.ok) return null
    const p = (await res.json()) as { displayName?: { text?: string } }
    return p.displayName?.text ?? null
  } catch {
    return null
  }
}
