// Airlines (for the carrier picker, matching logo files in public/airlines)
// and major airports (filling the place and time zone), carried over from
// old Wanderlog.

export const AIRLINES: { display: string; value: string }[] = [
  { display: 'American Airlines', value: 'American Airlines' },
  { display: 'Delta Air Lines', value: 'Delta' },
  { display: 'United Airlines', value: 'United Airlines' },
  { display: 'Southwest Airlines', value: 'Southwest Airlines' },
  { display: 'Alaska Airlines', value: 'Alaska Airlines' },
  { display: 'JetBlue Airways', value: 'JetBlue' },
  { display: 'Hawaiian Airlines', value: 'Hawaiian Airlines' },
  { display: 'Air Canada', value: 'Air Canada' },
  { display: 'Aeroméxico', value: 'Aeroméxico' },
  { display: 'British Airways', value: 'British Airways' },
  { display: 'Lufthansa', value: 'Lufthansa' },
  { display: 'Air France', value: 'Air France' },
  { display: 'KLM Royal Dutch Airlines', value: 'KLM' },
  { display: 'Iberia', value: 'Iberia' },
  { display: 'Swiss International Air Lines', value: 'Swiss' },
  { display: 'Turkish Airlines', value: 'Turkish Airlines' },
  { display: 'Scandinavian Airlines (SAS)', value: 'SAS' },
  { display: 'Virgin Atlantic', value: 'Virgin Atlantic' },
  { display: 'Emirates', value: 'Emirates' },
  { display: 'Qatar Airways', value: 'Qatar Airways' },
  { display: 'Etihad Airways', value: 'Etihad Airways' },
  { display: 'Saudia', value: 'Saudia' },
  { display: 'Singapore Airlines', value: 'Singapore Airlines' },
  { display: 'ANA (All Nippon Airways)', value: 'ANA' },
  { display: 'Japan Airlines (JAL)', value: 'JAL' },
  { display: 'Korean Air', value: 'Korean Air' },
  { display: 'Cathay Pacific', value: 'Cathay Pacific' },
  { display: 'EVA Air', value: 'EVA Air' },
  { display: 'Vietnam Airlines', value: 'Vietnam Airlines' },
  { display: 'Qantas', value: 'Qantas' }
]

// Curated major-airport list for the flight-mode from/to picker.
// Selecting one fills BOTH the location field (as "City / CODE", same
// format the old free-text placeholder suggested) and the timezone
// field in one step — the real fix for the duration bug: a picked
// airport always has a valid IANA timezone, so there's no way to end
// up with typed-but-not-selected text that Intl can't resolve.
export interface Airport {
  code: string
  city: string
  timezone: string
}

export const AIRPORTS: Airport[] = [
  { code: 'ATL', city: 'Atlanta', timezone: 'America/New_York' },
  { code: 'JFK', city: 'New York', timezone: 'America/New_York' },
  { code: 'LGA', city: 'New York', timezone: 'America/New_York' },
  { code: 'EWR', city: 'Newark', timezone: 'America/New_York' },
  { code: 'BOS', city: 'Boston', timezone: 'America/New_York' },
  { code: 'PHL', city: 'Philadelphia', timezone: 'America/New_York' },
  { code: 'MIA', city: 'Miami', timezone: 'America/New_York' },
  { code: 'DTW', city: 'Detroit', timezone: 'America/New_York' },
  { code: 'ORD', city: 'Chicago', timezone: 'America/Chicago' },
  { code: 'DFW', city: 'Dallas', timezone: 'America/Chicago' },
  { code: 'IAH', city: 'Houston', timezone: 'America/Chicago' },
  { code: 'AUS', city: 'Austin', timezone: 'America/Chicago' },
  { code: 'MSP', city: 'Minneapolis', timezone: 'America/Chicago' },
  { code: 'DEN', city: 'Denver', timezone: 'America/Denver' },
  { code: 'PHX', city: 'Phoenix', timezone: 'America/Phoenix' },
  { code: 'LAX', city: 'Los Angeles', timezone: 'America/Los_Angeles' },
  { code: 'SFO', city: 'San Francisco', timezone: 'America/Los_Angeles' },
  { code: 'SAN', city: 'San Diego', timezone: 'America/Los_Angeles' },
  { code: 'SEA', city: 'Seattle', timezone: 'America/Los_Angeles' },
  { code: 'LAS', city: 'Las Vegas', timezone: 'America/Los_Angeles' },
  { code: 'HNL', city: 'Honolulu', timezone: 'Pacific/Honolulu' },
  { code: 'ANC', city: 'Anchorage', timezone: 'America/Anchorage' },
  { code: 'YYZ', city: 'Toronto', timezone: 'America/Toronto' },
  { code: 'YVR', city: 'Vancouver', timezone: 'America/Vancouver' },
  { code: 'MEX', city: 'Mexico City', timezone: 'America/Mexico_City' },
  { code: 'LHR', city: 'London', timezone: 'Europe/London' },
  { code: 'CDG', city: 'Paris', timezone: 'Europe/Paris' },
  { code: 'FRA', city: 'Frankfurt', timezone: 'Europe/Berlin' },
  { code: 'MAD', city: 'Madrid', timezone: 'Europe/Madrid' },
  { code: 'FCO', city: 'Rome', timezone: 'Europe/Rome' },
  { code: 'AMS', city: 'Amsterdam', timezone: 'Europe/Amsterdam' },
  { code: 'ZRH', city: 'Zurich', timezone: 'Europe/Zurich' },
  { code: 'CPH', city: 'Copenhagen', timezone: 'Europe/Copenhagen' },
  { code: 'IST', city: 'Istanbul', timezone: 'Europe/Istanbul' },
  { code: 'DXB', city: 'Dubai', timezone: 'Asia/Dubai' },
  { code: 'AUH', city: 'Abu Dhabi', timezone: 'Asia/Dubai' },
  { code: 'DOH', city: 'Doha', timezone: 'Asia/Qatar' },
  { code: 'JED', city: 'Jeddah', timezone: 'Asia/Riyadh' },
  { code: 'SIN', city: 'Singapore', timezone: 'Asia/Singapore' },
  { code: 'HKG', city: 'Hong Kong', timezone: 'Asia/Hong_Kong' },
  { code: 'NRT', city: 'Tokyo', timezone: 'Asia/Tokyo' },
  { code: 'HND', city: 'Tokyo', timezone: 'Asia/Tokyo' },
  { code: 'ICN', city: 'Seoul', timezone: 'Asia/Seoul' },
  { code: 'PVG', city: 'Shanghai', timezone: 'Asia/Shanghai' },
  { code: 'TPE', city: 'Taipei', timezone: 'Asia/Taipei' },
  { code: 'BKK', city: 'Bangkok', timezone: 'Asia/Bangkok' },
  { code: 'KUL', city: 'Kuala Lumpur', timezone: 'Asia/Kuala_Lumpur' },
  { code: 'CGK', city: 'Jakarta', timezone: 'Asia/Jakarta' },
  { code: 'DEL', city: 'Delhi', timezone: 'Asia/Kolkata' },
  { code: 'BOM', city: 'Mumbai', timezone: 'Asia/Kolkata' },
  { code: 'SGN', city: 'Ho Chi Minh City', timezone: 'Asia/Ho_Chi_Minh' },
  { code: 'HAN', city: 'Hanoi', timezone: 'Asia/Ho_Chi_Minh' },
  { code: 'DAD', city: 'Da Nang', timezone: 'Asia/Ho_Chi_Minh' },
  { code: 'CXR', city: 'Nha Trang (Cam Ranh)', timezone: 'Asia/Ho_Chi_Minh' },
  { code: 'HUI', city: 'Hue', timezone: 'Asia/Ho_Chi_Minh' },
  { code: 'PQC', city: 'Phu Quoc', timezone: 'Asia/Ho_Chi_Minh' },
  { code: 'VCA', city: 'Can Tho', timezone: 'Asia/Ho_Chi_Minh' },
  { code: 'SYD', city: 'Sydney', timezone: 'Australia/Sydney' },
  { code: 'MEL', city: 'Melbourne', timezone: 'Australia/Melbourne' },
  { code: 'AKL', city: 'Auckland', timezone: 'Pacific/Auckland' }
]
