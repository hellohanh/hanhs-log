// "My location" (session 19, Hanh): say what went wrong and how to fix it on
// this phone, instead of one message for every problem. Pure, so the tests
// can check every case.

export interface LocationProblem {
  title: string
  steps: string[]
}

type Browser = 'iphone' | 'samsung' | 'android-app' | 'android' | 'other'

/** Which browser's steps to show (from the user agent; standalone = home-screen app). */
export function browserOf(ua: string, standalone = false): Browser {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) return 'iphone'
  if (/SamsungBrowser/.test(ua)) return 'samsung'
  if (/Android/.test(ua)) return standalone ? 'android-app' : 'android'
  return 'other'
}

const ALLOW: Record<Browser, string[]> = {
  iphone: [
    'Open Settings → Privacy & Security → Location Services, and turn it on.',
    'In the same list tap Safari Websites → While Using the App.',
    'Back in Safari, tap aA by the web address → Website Settings → Location → Allow.'
  ],
  samsung: [
    'Swipe down from the top of the screen and turn Location on.',
    'In Samsung Internet: ☰ → Settings → Sites and downloads → Site permissions → Location, and remove Hanh’s Log from Blocked.'
  ],
  'android-app': [
    'Swipe down from the top of the screen and turn Location on.',
    'Long-press the Hanh’s Log icon → App info → Permissions → Location → Allow.'
  ],
  android: [
    'Swipe down from the top of the screen and turn Location on.',
    'In Chrome, tap the icon left of the web address → Permissions → Location → Allow.',
    'Still blocked? Android Settings → Apps → Chrome → Permissions → Location → Allow only while using the app.'
  ],
  other: [
    'Click the icon left of the web address and set Location to Allow.',
    'Check your computer lets the browser use location (System Settings → Privacy → Location).'
  ]
}

/** The message for a GeolocationPositionError code (1 blocked, 2 unavailable, 3 timeout), or no geolocation at all (0). */
export function locationProblem(code: number, browser: Browser): LocationProblem {
  if (code === 1 || code === 0)
    return { title: code === 0 ? 'This browser can’t share your location.' : 'Location is blocked for Hanh’s Log.', steps: [...ALLOW[browser], 'Then tap My location again and choose Allow.'] }
  if (code === 3) return { title: 'Finding you took too long.', steps: ['Try again, ideally outside or near a window.', 'Turning on Wi-Fi helps the phone find you faster.'] }
  return { title: 'Your phone couldn’t tell where you are.', steps: ['Check Location is on (swipe down from the top of the screen).', 'Then tap My location again.'] }
}
