// The GPins button's icon (session 13, E106, Hanh's pick "A"): an outline map
// pin with a G inside, for Google's own place pins. ON shows the pin (the
// button gets the red ring via aria-pressed); OFF adds a slash.
export default function GPinsIcon({ off = false }: { off?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12Z" stroke="currentColor" strokeWidth="1.8" />
      <text x="12" y="13.2" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="8.5" textAnchor="middle" fill="currentColor">G</text>
      {off && <path d="M4 3l16 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  )
}
