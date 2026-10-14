import { useState } from 'react'
import { checkCases, runMapCheck, type CheckEnv, type CheckRow, type Result } from '../lib/mapCheck'

// The Map check in the Map look panel (session 9): one button runs every
// camera control on every look and fills in what Google actually did.
const MARK: Record<Result, string> = { ok: '✓', no: '✗', greyed: '—' }

export default function MapCheck({ env, className }: { env: () => CheckEnv | null; className?: string }) {
  const [rows, setRows] = useState<CheckRow[]>([])
  const [running, setRunning] = useState(false)
  const e = env()
  const total = e ? checkCases(Boolean(e.ids.noPins)).length : 0
  return (
    <div className={className}>
      <button
        type="button"
        disabled={running || !e}
        onClick={async () => {
          const live = env()
          if (!live) return
          setRows([])
          setRunning(true)
          try {
            await runMapCheck(live, r => setRows(rs => [...rs, r]))
          } finally {
            setRunning(false)
          }
        }}
      >
        {running ? `Checking… ${rows.length} of ${total}` : 'Check all controls'}
      </button>
      {rows.length > 0 && (
        <table aria-label="Map check results">
          <thead>
            <tr><th>Look</th><th>GPins</th><th>Map</th><th>Move</th><th>Zoom</th><th>Reset</th><th>Tilt</th><th>Rotate</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.look}</td><td>{r.gpins}</td><td>{r.map}</td>
                <td>{MARK[r.move]}</td><td>{MARK[r.zoom]}</td><td>{MARK[r.reset]}</td><td>{MARK[r.tilt]}</td><td>{MARK[r.rotate]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && <p>✓ works · ✗ Google didn't do it · — greyed out on purpose (hand-made colours need the flat map)</p>}
    </div>
  )
}
