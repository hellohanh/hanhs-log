import { test, expect } from '@playwright/test'
import { dayCityName, dayForCity } from '../../src/lib/dayCity'
import type { ItineraryDay, TravelLeg } from '../../src/lib/itineraryDays'

// Session 13 (E102): the day's city — home until a travel leg lands somewhere
// else, carried forward; a date-line repeat day is where its flights land.
// Pure helpers, so they run once (not per screen size).
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'laptop', 'pure helper test') })

const leg = (over: Partial<TravelLeg>): TravelLeg => ({
  id: 'l', day_id: 'd', mode: 'flight', title: null, carrier: null, reference: null,
  from_location: '', from_date: null, from_time: null, from_timezone: null,
  to_location: '', to_date: null, to_time: null, to_timezone: null, ...over
})
const day = (date: string | null, repeat_after: string | null = null, id = date ?? 'extra'): ItineraryDay =>
  ({ id: repeat_after ? `${date}-r` : id, trip_id: 't', date, repeat_after, note: null, created_at: '' })

const HOME = 'Hồ Chí Minh City'
const legs = [
  leg({ from_location: 'Saigon / SGN', from_date: '2027-01-01', from_time: '08:00', to_location: 'Seoul / ICN', to_date: '2027-01-01', to_time: '15:00' }),
  // Across the date line: leaves Seoul Jan 3 18:45, lands Seattle Jan 3 12:30 (earlier by the clock).
  leg({ from_location: 'Seoul / ICN', from_date: '2027-01-03', from_time: '18:45', from_timezone: 'Asia/Seoul', to_location: 'Seattle / SEA', to_date: '2027-01-03', to_time: '12:30', to_timezone: 'America/Los_Angeles' }),
  leg({ mode: 'train', from_location: 'Seattle', from_date: '2027-01-05', from_time: '09:00', to_location: 'Portland', to_date: '2027-01-05', to_time: '13:00' })
]

test('home until a leg lands, then that city, carried forward', () => {
  expect(dayCityName(day('2026-12-31'), legs, HOME)).toBe(HOME)
  expect(dayCityName(day('2027-01-01'), legs, HOME)).toBe('Seoul')
  expect(dayCityName(day('2027-01-02'), legs, HOME)).toBe('Seoul')
  expect(dayCityName(day('2027-01-05'), legs, HOME)).toBe('Portland')
  expect(dayCityName(day('2027-01-09'), legs, HOME)).toBe('Portland')
  expect(dayCityName(day('2027-01-02'), [], HOME)).toBe(HOME)
})

test('date line: the departure tab stays in Seoul, the repeat tab is Seattle', () => {
  expect(dayCityName(day('2027-01-03'), legs, HOME)).toBe('Seoul')
  expect(dayCityName(day('2027-01-03', '2027-01-03'), legs, HOME)).toBe('Seattle')
  expect(dayCityName(day('2027-01-04'), legs, HOME)).toBe('Seattle')
})

test('an extra day with no date, or no day at all, is the home city', () => {
  expect(dayCityName(day(null), legs, HOME)).toBe(HOME)
  expect(dayCityName(null, legs, HOME)).toBe(HOME)
})

test('which day: the open one; else today during the trip; else none', () => {
  const days = [day('2027-01-01'), day('2027-01-02'), day('2027-01-03', '2027-01-03')]
  expect(dayForCity(days, '2027-01-02', '2026-10-16')?.id).toBe('2027-01-02')
  expect(dayForCity(days, null, '2027-01-01')?.id).toBe('2027-01-01')
  expect(dayForCity(days, null, '2026-10-16')).toBeNull()
})
