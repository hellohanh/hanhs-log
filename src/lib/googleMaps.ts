/// <reference types="google.maps" />
// Loads the Google Maps JavaScript API once, using the key from GitHub
// Secrets (baked in at build time). Resolves to null when this build has
// no key (local and test builds), so pages can show a message instead.

let loading: Promise<typeof google | null> | null = null

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
    s.onerror = () => reject(new Error("Google Maps didn't load. Check the key and its allowed websites."))
    document.head.appendChild(s)
  })
  return loading
}
