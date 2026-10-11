// The pin categories (docs/pin-standard.md, decisions E28–E34): category ›
// sub-category › sub-sub-category, each with its colour and icon. Icons are
// Google Material Symbols names or Hanh's own drawings (src/assets/pin-icons).
// Keys are what the database stores; labels are what people see.

export type CategoryKey = 'accommodation' | 'airport' | 'attraction' | 'shopping' | 'transport' | 'food'

export interface Leaf {
  key: string
  label: string
  icon: string
}
export interface Sub {
  key: string
  label: string
  icon: string
  color: string
  /** Third level (attraction types, food dishes). */
  leaves?: Leaf[]
}
export interface Category {
  key: CategoryKey
  label: string
  icon: string
  color: string
  /** What the second and third levels are called in the form. */
  subLabel?: string
  leafLabel?: string
  subs: Sub[]
}

/** Lower-case key from a label: "Bún bò Huế" → "bun-bo-hue". */
export function slug(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const s = (label: string, icon: string, color: string, leaves?: Leaf[]): Sub => ({ key: slug(label), label, icon, color, leaves })
const l = (label: string, icon: string): Leaf => ({ key: slug(label), label, icon })

// ---- Nom-Nom (E32): cuisine colour by region, dish icon by dish family ----
const REGION = {
  sea: '#D85A30',
  eastAsia: '#C23B22',
  southAsia: '#B35F00',
  europe: '#946B00',
  americas: '#A3502A',
  cafe: '#6F4325',
  bakery: '#B5651D',
  bar: '#8A4B0F',
  fusion: '#9C3F2E'
}

const VIETNAMESE: Leaf[] = [
  ...['Phở', 'Bún bò Huế', 'Bún riêu', 'Hủ tiếu', 'Mì', 'Bánh canh', 'Mì Quảng', 'Cao lầu'].map(d => l(d, 'ramen_dining')),
  ...['Bún (general)', 'Bún chả', 'Bún thịt nướng'].map(d => l(d, 'ramen_dining')),
  ...['Cơm (general)', 'Cơm tấm', 'Xôi', 'Cháo'].map(d => l(d, 'rice_chopsticks')),
  l('Bánh mì', 'banh_mi'),
  ...['Bánh xèo', 'Bánh cuốn', 'Bánh bèo / bột lọc', 'Bánh khọt'].map(d => l(d, 'skillet')),
  ...['Gỏi cuốn', 'Chả giò / nem rán'].map(d => l(d, 'spring_rolls')),
  l('Lẩu', 'fish_striped'),
  l('Đồ nướng / BBQ', 'cow'),
  l('Hải sản', 'fish_striped'),
  l('Nhậu', 'beer_meal'),
  l('Bò kho', 'cow'),
  l('Gà', 'chicken')
]

const dishes = (list: [string, string][]) => list.map(([d, i]) => l(d, i))

const CUISINES: Sub[] = [
  s('Vietnamese', 'restaurant', REGION.sea, VIETNAMESE),
  s('Thai', 'restaurant', REGION.sea, dishes([['Pad Thai', 'ramen_dining'], ['Green curry', 'soup_kitchen'], ['Tom yum', 'stockpot'], ['Som tam', 'nutrition'], ['Khao man gai', 'chicken']])),
  s('Filipino', 'restaurant', REGION.sea, dishes([['Adobo', 'chicken'], ['Sinigang', 'soup_kitchen'], ['Lechon', 'pig'], ['Pancit', 'ramen_dining'], ['Sisig', 'pig']])),
  s('Malaysian', 'restaurant', REGION.sea, dishes([['Nasi lemak', 'rice_chopsticks'], ['Laksa', 'ramen_dining'], ['Char kway teow', 'skillet'], ['Satay', 'kebab_dining'], ['Roti canai', 'bakery_dining']])),
  s('Indonesian', 'restaurant', REGION.sea, dishes([['Nasi goreng', 'rice_chopsticks'], ['Rendang', 'cow'], ['Sate', 'kebab_dining'], ['Gado-gado', 'nutrition'], ['Bakso', 'ramen_dining']])),
  s('Cambodian', 'restaurant', REGION.sea, dishes([['Fish amok', 'fish_striped'], ['Lok lak', 'cow'], ['Kuy teav', 'ramen_dining'], ['Num banh chok', 'dinner_dining'], ['Bai sach chrouk', 'pig']])),
  s('Laotian', 'restaurant', REGION.sea, dishes([['Larb', 'nutrition'], ['Khao piak sen', 'ramen_dining'], ['Tam mak hoong', 'nutrition'], ['Sai oua', 'pig'], ['Khao jee', 'banh_mi']])),
  s('Singaporean', 'restaurant', REGION.sea, dishes([['Hainanese chicken rice', 'chicken'], ['Chili crab', 'crab_2'], ['Laksa', 'ramen_dining'], ['Bak kut teh', 'pig'], ['Kaya toast', 'breakfast_dining']])),
  // Dishes for these come with Q5; until then the cuisine is the last level.
  ...['Japanese', 'Korean', 'Chinese', 'Taiwanese', 'Cantonese / Hong Kong'].map(c => s(c, 'restaurant', REGION.eastAsia)),
  s('Indian', 'restaurant', REGION.southAsia),
  ...['Italian', 'French', 'Spanish', 'Greek', 'Mediterranean'].map(c => s(c, 'restaurant', REGION.europe)),
  ...['American', 'Southern / soul food', 'Cajun / Creole', 'Tex-Mex', 'Mexican'].map(c => s(c, 'restaurant', REGION.americas)),
  s('Café / coffee', 'coffee', REGION.cafe),
  s('Bakery / dessert', 'bakery_dining', REGION.bakery),
  s('Bar / drinks', 'local_bar', REGION.bar),
  s('Fusion', 'restaurant', REGION.fusion)
]

export const CATEGORIES: Category[] = [
  {
    key: 'food',
    label: 'Nom-Nom',
    icon: 'restaurant',
    color: '#D85A30',
    subLabel: 'Cuisine',
    leafLabel: 'Dish',
    subs: CUISINES
  },
  {
    key: 'accommodation',
    label: 'Accommodation',
    icon: 'hotel',
    color: '#378ADD',
    subLabel: 'Type',
    subs: [
      s('Hotel', 'hotel', '#3D8FE0'),
      s('Vacation rental', 'key', '#2C7BD0'),
      s('Family / friends', 'family_home', '#1F68BA'),
      s('Resort', 'villa', '#17559C'),
      s('Homestay / guesthouse', 'cottage', '#10437E'),
      s('Cruise / overnight transport', 'directions_boat', '#0A3160')
    ]
  },
  {
    key: 'attraction',
    label: 'Attraction',
    icon: 'flag',
    color: '#B03A7A',
    subLabel: 'Group',
    leafLabel: 'Type',
    subs: [
      s('Landmarks & history', 'flag', '#B03A7A', dishes([['Landmark', 'flag'], ['Historic site / ruins', 'castle'], ['Bridge', 'waves'], ['General', 'location_on']])),
      s('Worship', 'church', '#982F69', dishes([['Church', 'church'], ['Temple / pagoda', 'temple_buddhist']])),
      s('Museums & shows', 'museum', '#80265A', dishes([['Museum', 'museum'], ['Show / theatre', 'local_activity'], ['Music venue', 'music_note']])),
      s('Nature & outdoors', 'landscape', '#691D4A', dishes([['Park / garden', 'nature_people'], ['Nature / hike', 'hiking'], ['Beach', 'beach_access'], ['Viewpoint', 'mountain_flag']])),
      s('Family fun', 'attractions', '#52153A', dishes([['Theme park / zoo', 'pets'], ['Aquarium', 'fish_striped']]))
    ]
  },
  {
    key: 'shopping',
    label: 'Shopping',
    icon: 'local_mall',
    color: '#639922',
    subLabel: 'Type',
    subs: [
      s('Mall / department store', 'local_mall', '#5E8F23'),
      s('Market', 'store', '#548120'),
      s('Souvenirs / gifts', 'redeem', '#4A731C'),
      s('Tailor / clothing', 'apparel', '#406519'),
      s('Grocery / supermarket', 'shopping_cart', '#375715'),
      s('Pharmacy', 'local_pharmacy', '#2D4911'),
      s('Bookstore', 'menu_book', '#243B0E'),
      s('Sports store', 'sports_basketball', '#1B2D0A')
    ]
  },
  {
    key: 'transport',
    label: 'Transport',
    icon: 'train',
    color: '#1D9E75',
    subLabel: 'Type',
    subs: [
      s('Train station', 'train', '#168A66'),
      s('Bus station', 'bus', '#13795A'),
      s('Metro / subway', 'tram', '#10684E'),
      s('Ferry / pier', 'directions_boat', '#0D5842'),
      s('Car / motorbike rental', 'directions_car', '#0A4836'),
      s('Taxi / ride pick-up', 'local_taxi', '#08392B'),
      s('Parking', 'local_parking', '#052A20')
    ]
  },
  { key: 'airport', label: 'Airport', icon: 'flight', color: '#7F77DD', subs: [] }
]

export const MICHELIN_RED = '#9E2A2B'

export function categoryOf(key: string): Category | undefined {
  return CATEGORIES.find(c => c.key === key)
}

export interface CategoryPath {
  category: string
  subcategory: string | null
  subsubcategory: string | null
}

/** What a pin looks like from its category path: colour, icon and a label like "Nom-Nom › Vietnamese › Phở". */
export function pinLook(p: CategoryPath): { color: string; icon: string; label: string; parts: string[] } {
  const c = categoryOf(p.category)
  if (!c) return { color: '#5F5E5A', icon: 'location_on', label: p.category, parts: [p.category] }
  const sub = c.subs.find(x => x.key === p.subcategory)
  const leaf = sub?.leaves?.find(x => x.key === p.subsubcategory)
  const parts = [c.label, sub?.label, leaf?.label].filter(Boolean) as string[]
  return { color: sub?.color ?? c.color, icon: leaf?.icon ?? sub?.icon ?? c.icon, label: parts.join(' › '), parts }
}
