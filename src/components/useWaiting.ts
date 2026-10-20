import { useEffect, useState } from 'react'
import { onQueueChange, queueState, type QueueState } from '../lib/offline'

// Offline step 2: the waiting changes, for the yellow line and the
// "waiting to send" tags on itinerary blocks (approved mockup, screen 2).
export function useQueue(): QueueState {
  const [s, setS] = useState(queueState)
  useEffect(() => onQueueChange(setS), [])
  return s
}
/** Is a change to this row still waiting to be sent? */
export function useWaiting(id: string): boolean {
  return useQueue().ids.has(id)
}
