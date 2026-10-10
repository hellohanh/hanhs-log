// Outline boxes (south, north, west, east) of the 22 HCMC districts in
// public/hcm-districts.geojson, so the map can tell when any district is in
// view without loading the full file. Regenerate if that file changes.
export const DISTRICT_BOXES: [string, number, number, number, number][] = [
  ["District 1", 10.7532, 10.7971, 106.6814, 106.715],
  ["District 3", 10.7655, 10.7925, 106.6642, 106.6981],
  ["District 4", 10.7518, 10.7694, 106.6864, 106.722],
  ["District 5", 10.7462, 10.7655, 106.6505, 106.687],
  ["District 6", 10.7298, 10.7622, 106.6211, 106.655],
  ["District 7", 10.6978, 10.7774, 106.6902, 106.7668],
  ["District 8", 10.6924, 10.7521, 106.5978, 106.6927],
  ["District 10", 10.7584, 10.7869, 106.6561, 106.6827],
  ["District 11", 10.7534, 10.7785, 106.6342, 106.6615],
  ["District 12", 10.8186, 10.9042, 106.6033, 106.7183],
  ["Gò Vấp District", 10.8099, 10.8607, 106.632, 106.7011],
  ["Phú Nhuận District", 10.7879, 10.8142, 106.666, 106.6925],
  ["Tân Bình District", 10.769, 10.8367, 106.6279, 106.6786],
  ["Tân Phú District", 10.7582, 10.8247, 106.6068, 106.6477],
  ["Bình Thạnh District", 10.7856, 10.8391, 106.6839, 106.7514],
  ["Bình Tân District", 10.711, 10.8298, 106.5583, 106.6253],
  ["Thủ Đức City", 10.7403, 10.899, 106.6979, 106.8818],
  ["Hóc Môn District", 10.8261, 10.9286, 106.4962, 106.6929],
  ["Củ Chi District", 10.9136, 11.1595, 106.3567, 106.6574],
  ["Bình Chánh District", 10.625, 10.8737, 106.4636, 106.6949],
  ["Nhà Bè District", 10.5763, 10.7256, 106.6728, 106.7832],
  ["Cần Giờ District", 10.3762, 10.6752, 106.7335, 107.0277],
]

/** True when the map view overlaps any HCMC district. */
export function anyDistrictInView(v: { south: number; north: number; west: number; east: number }): boolean {
  return DISTRICT_BOXES.some(([, s, n, w, e]) => s <= v.north && n >= v.south && w <= v.east && e >= v.west)
}
