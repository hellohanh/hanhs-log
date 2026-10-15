// What the map popup shows from Google (session 10, approved preview): the
// address, phone number and Google Maps link for a saved place, fetched when
// the popup opens. Nothing here is stored.

export interface PlaceDetails {
  address: string | null
  phone: string | null
  /** Digits and + only, for a tel: link. */
  tel: string | null
  mapsUrl: string
}

/** A Google Maps link for a place (by its id when known). */
export function mapsLink(placeId: string | null, lat: number, lng: number): string {
  const q = `query=${lat},${lng}`
  return placeId ? `https://www.google.com/maps/search/?api=1&${q}&query_place_id=${encodeURIComponent(placeId)}` : `https://www.google.com/maps/search/?api=1&${q}`
}

export async function placeDetails(placeId: string | null, at: { lat: number; lng: number }): Promise<PlaceDetails> {
  const fallback: PlaceDetails = { address: null, phone: null, tel: null, mapsUrl: mapsLink(placeId, at.lat, at.lng) }
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
  if (!placeId || !key) return fallback
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'formattedAddress,nationalPhoneNumber,internationalPhoneNumber,googleMapsUri' }
    })
    if (!res.ok) return fallback
    const p = (await res.json()) as { formattedAddress?: string; nationalPhoneNumber?: string; internationalPhoneNumber?: string; googleMapsUri?: string }
    const phone = p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null
    return {
      address: p.formattedAddress ?? null,
      phone,
      tel: phone ? phone.replace(/[^\d+]/g, '') : null,
      mapsUrl: p.googleMapsUri ?? fallback.mapsUrl
    }
  } catch {
    return fallback
  }
}
