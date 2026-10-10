// Checks every migration file in supabase/migrations against the rules that
// would have prevented Wanderlog's database incidents (L3, L10, L20, L21, L34).
// Runs in CI on every pull request; exits non-zero with a plain-English
// reason for each problem. Usage:
//   node scripts/check-migrations.mjs [--changed=<file list>]
// --changed lists files the PR modified or deleted (not added); any of those
// that are migrations fail, because a merged migration may already be live.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'supabase/migrations'
const NAME = /^(\d{4})_[a-z0-9_]+\.sql$/
const problems = []

const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()

// 1. Names and numbering: 0001_x.sql, 0002_y.sql, … no gaps, no repeats.
files.forEach((f, i) => {
  const m = f.match(NAME)
  if (!m) {
    problems.push(`${f}: name must look like 0001_short_description.sql (4 digits, lowercase, underscores)`)
    return
  }
  const expected = String(i + 1).padStart(4, '0')
  if (m[1] !== expected) problems.push(`${f}: expected number ${expected} here — numbers must run 0001, 0002, … with no gaps or repeats`)
})

// 2. Already-merged migrations are never edited or deleted.
const changedArg = process.argv.find(a => a.startsWith('--changed='))
if (changedArg) {
  const changed = changedArg.slice('--changed='.length).split(/\s+/).filter(Boolean)
  for (const c of changed) {
    // Session 4: the Wanderlog-era migrations were moved, unchanged, into
    // supabase/archive/wanderlog-db/ when Hanh's Log got its own database.
    const archived = c.startsWith(DIR + '/') && existsSync(join('supabase/archive/wanderlog-db', c.slice(DIR.length + 1)))
    if (archived) continue
    if (c.startsWith(DIR + '/')) problems.push(`${c}: this migration was already merged and may be live — add a NEW migration instead of editing or deleting it`)
  }
}

// Strip -- comments so a commented-out statement doesn't count.
const stripComments = sql => sql.replace(/--.*$/gm, '')

for (const f of files) {
  const raw = readFileSync(join(DIR, f), 'utf8')
  const sql = stripComments(raw).toLowerCase()

  // 3. Nothing destructive unless the file says why, on purpose.
  const allowDestructive = /--\s*allow-destructive:\s*\S/i.test(raw)
  const destructive = [
    [/\bdrop\s+table\b/, 'DROP TABLE'],
    [/\bdrop\s+schema\b/, 'DROP SCHEMA'],
    [/\btruncate\b/, 'TRUNCATE'],
    [/\balter\s+table\s+[^;]*\bdrop\s+column\b/, 'DROP COLUMN'],
    [/\bdelete\s+from\s+[^;]*;/, 'DELETE FROM'],
    [/\bdrop\s+policy\b/, 'DROP POLICY']
  ]
  for (const [re, label] of destructive) {
    if (re.test(sql) && !allowDestructive) {
      problems.push(`${f}: contains ${label}. This database holds real trips. If it's truly intended, add a line "-- allow-destructive: <reason>" and get it approved`)
    }
  }

  // 4. Every new table ships with RLS enabled AND grants, in the same file.
  const created = [...sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/g)].map(m => m[1])
  for (const t of created) {
    const tbl = `(?:public\\.)?"?${t}"?`
    if (!new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?${tbl}\\s+enable\\s+row\\s+level\\s+security`).test(sql)) {
      problems.push(`${f}: creates table "${t}" but never runs "alter table ${t} enable row level security" — without it anyone with the app's public key could read it`)
    }
    if (!new RegExp(`\\bgrant\\s+[^;]+\\son\\s+(?:table\\s+)?${tbl}\\s+to\\s+`).test(sql)) {
      problems.push(`${f}: creates table "${t}" but has no GRANT for it — RLS policies alone don't give the app access (Wanderlog lesson L3)`)
    }
    if (!new RegExp(`\\bcreate\\s+policy\\s+[^;]+\\son\\s+${tbl}\\b`).test(sql)) {
      problems.push(`${f}: creates table "${t}" but defines no RLS policy for it — the app would see no rows at all`)
    }
  }
}

if (problems.length) {
  console.error(`Migration check failed (${problems.length}):\n`)
  problems.forEach(p => console.error(`  ✗ ${p}`))
  process.exit(1)
}
console.log(`Migration check passed: ${files.length} migration file(s).`)
