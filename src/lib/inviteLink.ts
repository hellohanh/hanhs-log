// Which invite a pasted link is (session 15, Join with a link). Accepts the
// full address (live site or a preview) or just the path; returns the in-app
// page that joins it. Pure, so tests can use it directly.
const KINDS: { re: RegExp; label: string; path: (t: string) => string }[] = [
  { re: /\/wander\/join-trips\/([\w-]+)/, label: 'Several-trips invite', path: t => `/wander/join-trips/${t}` },
  { re: /\/wander\/join\/([\w-]+)/, label: 'Trip invite', path: t => `/wander/join/${t}` },
  { re: /\/savor\/join\/([\w-]+)/, label: 'Savorlog family invite', path: t => `/savor/join/${t}` }
]
export function inviteKind(text: string): { label: string; path: string } | null {
  const s = text.trim()
  if (!s) return null
  for (const k of KINDS) {
    const m = s.match(k.re)
    if (m) return { label: k.label, path: k.path(m[1]) }
  }
  return null
}
