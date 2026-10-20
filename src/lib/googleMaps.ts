/// <reference types="google.maps" />
// Loads the Google Maps JavaScript API once, using the key from GitHub
// Secrets (baked in at build time). Resolves to null when this build has
// no key (local and test builds), so pages can show a message instead.

let loading: Promise<typeof google | null> | null = null

/** Shown where the map would be when there's no signal (offline mockup). */
export const MAP_OFFLINE = 'Map needs a connection (your places are still listed)'

export const hasMapsKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)

export function loadGoogleMaps(): Promise<typeof google | null> {
  if (loading) return loading
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key) return (loading = Promise.resolve(null))
  loading = new Promise((resolve, reject) => {
    const cb = '__hanhsLogMapsReady'
    ;(window as unknown as Record<string, unknown>)[cb] = () => resolve(window.google)
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=${cb}&loading=async`
    s.async = true
    s.onerror = () => {
      // Let a later try load it again (back online, session 15).
      loading = null
      s.remove()
      reject(new Error(navigator.onLine === false ? MAP_OFFLINE : "Google Maps didn't load. Check the key and its allowed websites."))
    }
    document.head.appendChild(s)
  })
  return loading
}
