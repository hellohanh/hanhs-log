import { useEffect, useState } from 'react'
import { CONTACT_KEYS, TAG, openField, savedValue, typedField, type Contact, type ContactField, type ContactKey } from '../lib/contact'
import { placeDetails } from '../lib/placeDetails'
import styles from './ContactFields.module.css'

// Address, phone and website on every place's edit panel (session 16, Hanh,
// approved mockup; migration 0026). A field never saved is filled in from
// Google as the panel opens, tagged "from Google"; typing tags it "edited";
// clearing it tags it "hidden" (the popup then shows nothing for it). Nothing
// is saved until the panel's Save.

type Fields = Record<ContactKey, ContactField>

/** The three fields' state, filled from Google where nothing was saved. */
export function useContactFields(
  saved: Partial<Contact> | undefined,
  google: { placeId: string | null; lat: number; lng: number; address?: string | null } | null
) {
  const [fields, setFields] = useState<Fields>(() => {
    const out = {} as Fields
    for (const k of CONTACT_KEYS) out[k] = openField(saved?.[k], k === 'address' ? google?.address ?? null : null)
    return out
  })
  const placeId = google?.placeId ?? null
  const needGoogle = CONTACT_KEYS.some(k => saved?.[k] == null)
  useEffect(() => {
    if (!placeId || !google || !needGoogle) return
    let alive = true
    placeDetails(placeId, { lat: google.lat, lng: google.lng }).then(d => {
      if (!alive) return
      // Fill only fields still empty and untouched.
      setFields(f => {
        const next = { ...f }
        for (const k of CONTACT_KEYS) if (f[k].source === 'none' && saved?.[k] == null) next[k] = openField(null, d[k])
        return next
      })
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, needGoogle])
  const values = (): Contact => ({ address: savedValue(fields.address), phone: savedValue(fields.phone), website: savedValue(fields.website) })
  const set = (k: ContactKey, v: string) => setFields(f => ({ ...f, [k]: typedField(v) }))
  return { fields, set, values }
}

const LABEL: Record<ContactKey, string> = { address: 'Address', phone: 'Phone', website: 'Website' }
const ICON: Record<ContactKey, string> = { address: '📍', phone: '☎', website: '🌐' }

export default function ContactFields({ state, fieldClass }: { state: ReturnType<typeof useContactFields>; fieldClass: string }) {
  return (
    <div className={styles.box}>
      {CONTACT_KEYS.map(k => {
        const f = state.fields[k]
        const tag = TAG[f.source]
        return (
          <label key={k} className={fieldClass}>
            <span className={styles.lab}>
              {LABEL[k]}
              {tag && <span className={`${styles.tag} ${styles[f.source]}`}>{tag}</span>}
            </span>
            <span className={styles.row}>
              <span className={styles.icon} aria-hidden="true">{ICON[k]}</span>
              <input
                value={f.value}
                onChange={e => state.set(k, e.target.value)}
                maxLength={k === 'phone' ? 60 : 400}
                type={k === 'phone' ? 'tel' : k === 'website' ? 'url' : 'text'}
                inputMode={k === 'phone' ? 'tel' : k === 'website' ? 'url' : undefined}
                autoComplete="off"
                placeholder={k === 'address' ? 'Street, city' : k === 'phone' ? '+84 28 3829 9274' : 'example.com'}
              />
            </span>
          </label>
        )
      })}
      <p className={styles.hint}>Filled in from Google where nothing was saved; change anything before you save. Leave a field empty to hide it.</p>
    </div>
  )
}
