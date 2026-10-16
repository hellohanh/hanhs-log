# Pin standard (Wanderlog + Savorlog)

Decided with Hanh in session 2 (Oct 9–10, 2026), decisions E28–E34 in SKILL.md.
One pin system for both sections. The design canvas "Hanh's Log — Wanderlog M3
mockup" holds the boards and a decisions note with the same content.

## Place names (E72, session 9)

Every pin and eatery is named **`English : Local`** — the English title, a spaced
colon, then the local title. English only when the place has a real English name
(never an invented translation); the local title keeps full accents; Japan's local
title is the native script with romaji in brackets: `Meiji Shrine : 明治神宮 (Meiji Jingū)`.
A place with one name keeps just that one. The add cards take the two parts in
separate boxes.

## Pin shape (E28)

- **Every pin is a teardrop**: 33 px, white, 1.5 px black outline, point at the
  bottom marking the exact spot, a 23 px colour disc, a white icon in the disc.
- **MICHELIN places**: a **36 px** teardrop, deep red disc `#9E2A2B`, and our own
  six-petal outline flower in white (notched petals, a vein in each, centre ring),
  drawn with a **1 px** line (`vector-effect: non-scaling-stroke`). Never the
  MICHELIN Guide logo itself.
- **MICHELIN stars**: 1–3 small red stars in a white chip above the pin. Bib
  Gourmand places are just "Mentioned": the MICHELIN pin with no chip (E52).
- **Status badge** (E51): top-right of every pin. Blank orange `#E8862A` for WTG;
  for VIS, green `#2F8A3E` with a white ✓ (revisit), yellow `#F2C230` with a
  black dash (2nd chance), red `#C8352F` with a white ✗ (don't go back).
- **Filtered out**: the pin fades to 10%.

Flower geometry (100 × 100 grid, rotated 6 × 60°):
`M50 40 C41 37 35 26 38 13 Q40 8 44 11 L50 17 L56 11 Q60 8 62 13 C65 26 59 37 50 40 Z`,
vein `M50 36 L50 25`, centre circle r = 7.

## Icons (E29)

- **Google Material Symbols** (Outlined), white in the disc. Names are checked
  against Google's official codepoints list before use (L16). The app will ship
  only the icons it uses.
- **Hanh's own drawings**, traced to SVG, in `src/assets/pin-icons/` (43 files,
  `fill="currentColor"`):
  - Set 1 (animals): cow, pig, chicken, turkey, fish, shrimp, crab, sheep, duck, egg
  - Set 2: banh_mi, rice_chopsticks, bus, spring_rolls, fish_striped, shrimp_2,
    crab_2, catfish
  - Set 3 (American dining, for later): taco, burger, hot_dog, pizza, burrito,
    sandwich, fries, fried_chicken, chicken_bucket, corn_dog, nachos, onion_rings,
    curly_fries, mac_and_cheese, breakfast_plate, chili_bowl, corn, milkshake,
    ice_cream, pie, ribs, steak, side_bowl, cookies, cookie_bite
  - Fish: `fish_striped` replaces the first `fish`; `catfish` for catfish dishes.
    Shrimp and crab: both versions stay available. No lobster yet (Q7).
- Every pin colour keeps the white icon at ≥ 3:1 contrast.
- **Line-art set (session 11)**: Hanh's Icon Set 1 (46 drawings, from two
  sheets) for every non-food category, group and type — Accommodation … Parking,
  Airport, and the category / group levels too. Extracted white on transparent,
  redrawn at one even line weight (Hanh picked "medium" from a side-by-side),
  traced to SVG as `src/assets/pin-icons/ls_<key>.svg` (key = the catalogue key
  with `_`). Used **in the map pins (17 px in the disc) and the pin popup** (a
  65 px circle with a 52 px drawing, 12 px from the name). The Places panel,
  itinerary blocks and pickers keep the Material icons. Nom-Nom keeps its
  current icons. `pinLook().art` gives the name; `popupIconHtml` draws the popup
  icon.

## Pinned list (E30)

Both map views list pins as a tree: **category › sub-category › sub-sub-category**.
Every level is collapsed by default and opens with its arrow.

## Categories (E31)

| Category | Colour | Icon | Levels |
|---|---|---|---|
| Accommodation | `#378ADD` | `hotel` | 2 |
| Airport | `#7F77DD` | `flight` | 1 (no sub-categories) |
| Attraction | Berry family | `flag` | 3 (group › type) |
| Shopping | `#639922` | `local_mall` | 2 |
| Transport | `#1D9E75` | `train` | 2 |
| Nom-Nom (food) | `#D85A30` | `restaurant` | 3 (cuisine › dish) |

### Accommodation (shades of blue)
| Sub-category | Icon | Colour |
|---|---|---|
| Hotel | `hotel` | `#3D8FE0` |
| Vacation rental | `key` | `#2C7BD0` |
| Family / friends | `family_home` | `#1F68BA` |
| Resort | `villa` | `#17559C` |
| Homestay / guesthouse | `cottage` | `#10437E` |
| Cruise / overnight transport | `directions_boat` | `#0A3160` |

### Attraction (Berry; every type uses its group's shade)
| Group (icon) | Colour | Types (icon) |
|---|---|---|
| Landmarks & history (`flag`) | `#B03A7A` | Landmark `flag` · Historic site / ruins `castle` · Bridge `waves` · General `location_on` |
| Worship (`church`) | `#982F69` | Church `church` · Temple / pagoda `temple_buddhist` |
| Museums & shows (`museum`) | `#80265A` | Museum `museum` · Show / theatre `local_activity` · Music venue `music_note` |
| Nature & outdoors (`landscape`) | `#691D4A` | Park / garden `nature_people` · Nature / hike `hiking` · Beach `beach_access` · Viewpoint `terrain` |
| Family fun (`attractions`) | `#52153A` | Theme park / zoo `pets` · Aquarium `fish_striped` (custom) |

### Shopping (shades of green)
| Sub-category | Icon | Colour |
|---|---|---|
| Mall / department store | `local_mall` | `#5E8F23` |
| Market | `store` | `#548120` |
| Souvenirs / gifts | `card_giftcard` | `#4A731C` |
| Tailor / clothing | `apparel` | `#406519` |
| Grocery / supermarket | `shopping_cart` | `#375715` |
| Pharmacy | `local_pharmacy` | `#2D4911` |
| Bookstore | `menu_book` | `#243B0E` |
| Sports store | `sports_basketball` | `#1B2D0A` |

### Transport (shades of teal)
| Sub-category | Icon | Colour |
|---|---|---|
| Train station | `train` | `#168A66` |
| Bus station | `bus` (custom) | `#13795A` |
| Metro / subway | `tram` | `#10684E` |
| Ferry / pier | `directions_boat` | `#0D5842` |
| Car / motorbike rental | `directions_car` | `#0A4836` |
| Taxi / ride pick-up | `local_taxi` | `#08392B` |
| Parking | `local_parking` | `#052A20` |

## Nom-Nom (E32)

- **Levels**: Nom-Nom › cuisine › main dish. Cuisine is the food's country (a phở
  place in Houston is Vietnamese).
- **Cuisines**: Vietnamese, Thai, Filipino, Malaysian, Indonesian, Cambodian,
  Laotian, Singaporean, Japanese, Korean, Chinese, Taiwanese, Cantonese / Hong Kong,
  Indian, Italian, French, Spanish, Greek, Mediterranean, American, Southern / soul
  food, Cajun / Creole, Tex-Mex, Mexican.
- **Beside the cuisines**: Café / coffee, Bakery / dessert, Bar / drinks, Fusion. A
  café, bakery or bar can also carry a cuisine tag.
- **Colour by region** (colour only, not a level):

| Region | Colour |
|---|---|
| Southeast Asian | `#D85A30` |
| East Asian | `#C23B22` |
| South Asian | `#B35F00` |
| European | `#946B00` |
| Americas | `#A3502A` |
| Café | `#6F4325` |
| Bakery / dessert | `#B5651D` |
| Bar / drinks | `#8A4B0F` |
| Fusion | `#9C3F2E` |

- **Dish icons**: one icon per dish family; the exact dish shows in the list, hover
  and popup. A dish whose protein is the point may use an animal instead.

### Vietnamese (28 dishes, 9 families)
| Family (icon) | Dishes |
|---|---|
| Noodle soups (`ramen_dining`) | Phở, Bún bò Huế, Bún riêu, Hủ tiếu, Mì, Bánh canh, Mì Quảng, Cao lầu |
| Bún (`ramen_dining`) | Bún (general), Bún chả, Bún thịt nướng |
| Rice (`rice_chopsticks`) | Cơm (general), Cơm tấm, Xôi, Cháo |
| Bánh mì (`banh_mi`) | Bánh mì |
| Bánh (`skillet`) | Bánh xèo, Bánh cuốn, Bánh bèo / bột lọc, Bánh khọt |
| Rolls (`spring_rolls`) | Gỏi cuốn, Chả giò / nem rán |
| Hot pot & grill (`local_fire_department`) | Lẩu → `fish_striped`, Đồ nướng / BBQ → `cow` |
| Seafood (`fish_striped`) | Hải sản |
| Other (`beer_meal`) | Nhậu, Bò kho → `cow`, Gà → `chicken` |

### Southeast Asian top 5
| Cuisine | Dishes (icon) |
|---|---|
| Thai | Pad Thai `ramen_dining` · Green curry `soup_kitchen` · Tom yum `stockpot` · Som tam `nutrition` · Khao man gai `chicken` |
| Filipino | Adobo `chicken` · Sinigang `soup_kitchen` · Lechon `pig` · Pancit `ramen_dining` · Sisig `pig` |
| Malaysian | Nasi lemak `rice_chopsticks` · Laksa `ramen_dining` · Char kway teow `skillet` · Satay `kebab_dining` · Roti canai `bakery_dining` |
| Indonesian | Nasi goreng `rice_chopsticks` · Rendang `cow` · Sate `kebab_dining` · Gado-gado `nutrition` · Bakso `ramen_dining` |
| Cambodian | Fish amok `fish_striped` · Lok lak `cow` · Kuy teav `ramen_dining` · Num banh chok `dinner_dining` · Bai sach chrouk `pig` |
| Laotian | Larb `nutrition` · Khao piak sen `ramen_dining` · Tam mak hoong `nutrition` · Sai oua `pig` · Khao jee `banh_mi` |
| Singaporean | Hainanese chicken rice `chicken` · Chili crab `crab_2` · Laksa `ramen_dining` · Bak kut teh `pig` · Kaya toast `breakfast_dining` |

### The rest (Q5 → E70, session 8; top 5 each, approved by Hanh)
Italic names are Hanh's own drawings; the rest are Material Symbols (checked against 0.48.0, L16).

| Cuisine | Dishes (icon) |
|---|---|
| Japanese | Sushi / sashimi `set_meal` · Ramen `ramen_dining` · Udon / soba `ramen_dining` · Tempura *shrimp* · Yakitori / izakaya `kebab_dining` |
| Korean | Korean BBQ *cow* · Bibimbap `rice_bowl` · Korean fried chicken *fried_chicken* · Jjigae / stew `soup_kitchen` · Tteokbokki `skillet` |
| Chinese | Dumplings `takeout_dining` · Hot pot `local_fire_department` · Hand-pulled noodles `ramen_dining` · Peking duck *duck* · Sichuan `soup_kitchen` |
| Taiwanese | Beef noodle soup `ramen_dining` · Xiao long bao `takeout_dining` · Lu rou fan `rice_bowl` · Night-market fried chicken *fried_chicken* · Bubble tea `glass_cup` |
| Cantonese / Hong Kong | Dim sum `takeout_dining` · Roast meats / char siu *pig* · Wonton noodles `ramen_dining` · Congee `rice_bowl` · Cha chaan teng `breakfast_dining` |
| Indian | Curry `soup_kitchen` · Biryani `rice_bowl` · Tandoori *chicken* · Dosa `skillet` · Thali `dinner_dining` |
| Italian | Pizza *pizza* · Pasta `dinner_dining` · Risotto `rice_bowl` · Bistecca / steak *steak* · Gelato *ice_cream* |
| French | Bistro / brasserie `flatware` · Steak frites *steak* · Crêpes `skillet` · Oysters / seafood *crab* · Duck confit *duck* |
| Spanish | Tapas `tapas` · Paella `skillet` · Jamón *pig* · Seafood *shrimp* · Churros `bakery_dining` |
| Greek | Gyros / souvlaki `kebab_dining` · Moussaka `stockpot` · Greek salad `nutrition` · Grilled fish *fish_striped* · Lamb *sheep* |
| Mediterranean | Shawarma / kebab `kebab_dining` · Mezze / hummus `tapas` · Falafel `lunch_dining` · Grilled meats `outdoor_grill` · Lamb *sheep* |
| American | Burger *burger* · Steakhouse *steak* · BBQ *ribs* · Pizza *pizza* · Diner / breakfast *breakfast_plate* |
| Southern / soul food | Fried chicken *fried_chicken* · Catfish *catfish* · Biscuits & gravy *breakfast_plate* · Mac & cheese *mac_and_cheese* · Pie / cobbler *pie* |
| Cajun / Creole | Gumbo `soup_kitchen` · Crawfish boil *crab_2* · Po'boy *sandwich* · Jambalaya `rice_bowl` · Beignets `donut_small` |
| Tex-Mex | Tacos *taco* · Fajitas `skillet` · Enchiladas `dinner_dining` · Queso / nachos *nachos* · Burritos *burrito* |
| Mexican | Tacos *taco* · Mole `stockpot` · Tamales *corn* · Pozole `soup_kitchen` · Mariscos *shrimp* |
| Café / coffee | Coffee `coffee` · Vietnamese coffee `local_cafe` · Tea `emoji_food_beverage` · Bubble tea `glass_cup` · Brunch `brunch_dining` |
| Bakery / dessert | Bakery / pastry `bakery_dining` · Cake `cake` · Ice cream *ice_cream* · Donuts `donut_small` · Cookies *cookies* |
| Bar / drinks | Cocktails `local_bar` · Wine `wine_bar` · Beer / brewery `sports_bar` · Spirits / sake `liquor` · Club / nightlife `nightlife` |
| Fusion | No dish list: the cuisine is the last level |

The same dish can sit under two cuisines (Tacos: Tex-Mex and Mexican; Pizza: Italian and
American; Bubble tea: Taiwanese and Café), because the cuisine is the food's origin.

## The add-pin form (built in session 4)

- Opened from the Places panel's Google search box; category picked by hand.
- You: WTG / VIS; VIS needs ✓, – or ✗; an optional 1–5 rating in half stars.
  Editing lists everyone's status and the average rating (card only).
- MICHELIN (food and drink only): None / Mentioned / ★ / ★★ / ★★★ plus the year.
- Street food and Fine dining: badges, not dishes (E34), food and drink only.
- Code: `src/lib/pinCatalog.ts` (categories), `src/lib/pinDraw.ts` (the pin),
  `src/lib/materialIcons.ts` (the Material Symbols used). Two names in this file
  aren't in Material Symbols and were swapped for the closest match: Viewpoint
  uses `mountain_flag` (not `terrain`), Souvenirs / gifts uses `redeem` (not
  `card_giftcard`). Café, Bakery and Bar use `coffee`, `bakery_dining` and
  `local_bar`; Fusion (no dish list) uses `restaurant`.

## Old Wanderlog food pins (E33)

Not copied automatically (replaces E13). They come in through the import queue
(`/wander/import`, E71): one place at a time, city by city, in a prefilled add card.
