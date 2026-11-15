/* =========================
   RESIN KEYCAP DATA (bundled fallback)
   Collections ship with the site, images in /resin/logos. The pages prefer
   the resin_collections / resin_designs tables (loaded by resin/store.js) and
   only use this file when those tables are missing or empty, so deploying
   before running the SQL can never break the storefront.

   A design belongs to one collection. `tile` is "light" | "dark" — copied
   from the printed catalog (white logos sit on a dark tile). The custom
   collection has no designs; the builder shows only the "Your own logo"
   tile for it.
========================= */

window.RESIN_COLLECTIONS = [
  {
    id: "mlbb",
    name: "Mobile Legends: Bang Bang",
    short: "Mobile Legends",
    region: "Cambodia",
    group: "Esports",
    blurb: "23 Cambodian team logos",
    designs: [
      { id: "valhalla",                  name: "Valhalla",                  tile: "light" },
      { id: "evil-eye",                  name: "Evil Eye",                  tile: "light" },
      { id: "cfu-gaming",                name: "CFU Gaming",                tile: "light" },
      { id: "impunity",                  name: "Impunity",                  tile: "light" },
      { id: "tnr",                       name: "TNR",                       tile: "light" },
      { id: "pro-esports",               name: "Pro eSports",               tile: "light" },
      { id: "see-you-soon",              name: "See You Soon",              tile: "light" },
      { id: "flash",                     name: "Flash",                     tile: "dark"  },
      { id: "vigor-apex",                name: "Vigor Apex",                tile: "light" },
      { id: "rvz",                       name: "Rvz",                       tile: "dark"  },
      { id: "galaxy-purple",             name: "Galaxy (purple)",           tile: "light" },
      { id: "galaxy-white",              name: "Galaxy (white)",            tile: "dark"  },
      { id: "galaxy-legend-yellow",      name: "Galaxy Legend (yellow)",    tile: "dark"  },
      { id: "galaxy-phoenix",            name: "Galaxy Phoenix",            tile: "light" },
      { id: "weibo-gaming",              name: "Weibo Gaming",              tile: "dark"  },
      { id: "diversity-gaming-quantum",  name: "Diversity Gaming Quantum",  tile: "light" },
      { id: "navi",                      name: "NAVI",                      tile: "light" },
      { id: "angkor-warriors",           name: "Angkor Warriors",           tile: "light" },
      { id: "team-max",                  name: "Team Max",                  tile: "dark"  },
      { id: "duck-rice",                 name: "Duck Rice",                 tile: "light" },
      { id: "d-roar",                    name: "D-ROAR Legend",             tile: "light" },
      { id: "team-sv",                   name: "Team SV",                   tile: "dark"  },
      { id: "logic-esports",             name: "Logic eSports",             tile: "dark"  }
    ]
  },
  {
    id: "valorant",
    name: "Valorant",
    short: "Valorant",
    region: "VCT",
    group: "Esports",
    blurb: "17 VCT team logos",
    designs: [
      { id: "sentinels",      name: "Sentinels",       tile: "light" },
      { id: "paper-rex",      name: "Paper Rex",       tile: "dark"  },
      { id: "t1",             name: "T1",              tile: "light" },
      { id: "cloud9",         name: "Cloud9",          tile: "light" },
      { id: "fut-esports",    name: "FUT Esports",     tile: "light" },
      { id: "rrq",            name: "RRQ",             tile: "dark"  },
      { id: "mibr",           name: "MIBR",            tile: "dark"  },
      { id: "fnatic",         name: "Fnatic",          tile: "light" },
      { id: "loud",           name: "LOUD",            tile: "dark"  },
      { id: "100-thieves",    name: "100 Thieves",     tile: "light" },
      { id: "nrg",            name: "NRG",             tile: "dark"  },
      { id: "leviatan",       name: "Leviatán",        tile: "dark"  },
      { id: "g2-esports",     name: "G2 Esports",      tile: "dark"  },
      { id: "team-heretics",  name: "Team Heretics",   tile: "dark"  },
      { id: "team-liquid",    name: "Team Liquid",     tile: "dark"  },
      { id: "team-vitality",  name: "Team Vitality",   tile: "dark"  },
      { id: "drx",            name: "DRX",             tile: "light" }
    ]
  },
  {
    id: "mlbb-intl",
    name: "Mobile Legends: Bang Bang",
    short: "Mobile Legends",
    region: "International",
    group: "Esports",
    blurb: "4 team logos from outside Cambodia",
    designs: [
      { id: "blacklist",      name: "Blacklist International", tile: "light" },
      { id: "red-giants",     name: "Red Giants",              tile: "light" },
      { id: "ego",            name: "EGO",                     tile: "light" },
      { id: "omega-esports",  name: "Omega Esports",           tile: "light" }
    ]
  },
  {
    id: "football",
    name: "Football clubs",
    short: "Football",
    region: "Europe",
    group: "Sports",
    blurb: "20 club crests",
    designs: [
      { id: "real-madrid",    name: "Real Madrid",       tile: "dark"  },
      { id: "barcelona",      name: "Barcelona",         tile: "light" },
      { id: "man-united",     name: "Manchester United", tile: "light" },
      { id: "man-city",       name: "Manchester City",   tile: "dark"  },
      { id: "liverpool",      name: "Liverpool",         tile: "dark"  },
      { id: "arsenal",        name: "Arsenal",           tile: "light" },
      { id: "chelsea",        name: "Chelsea",           tile: "light" },
      { id: "bayern-munich",  name: "Bayern Munich",     tile: "light" },
      { id: "psg",            name: "Paris Saint-Germain", tile: "light" },
      { id: "juventus",       name: "Juventus",          tile: "light" },
      { id: "ac-milan",       name: "AC Milan",          tile: "light" },
      { id: "dortmund",       name: "Borussia Dortmund", tile: "light" },
      { id: "atletico-madrid", name: "Atlético Madrid",  tile: "light" },
      { id: "napoli",         name: "Napoli",            tile: "dark"  },
      { id: "ajax",           name: "Ajax",              tile: "dark"  },
      { id: "benfica",        name: "Benfica",           tile: "light" },
      { id: "porto",          name: "FC Porto",          tile: "light" },
      { id: "tottenham",      name: "Tottenham Hotspur", tile: "light" },
      { id: "newcastle",      name: "Newcastle United",  tile: "light" }
    ]
  },
  {
    id: "custom",
    name: "Your own logo",
    short: "Your own logo",
    group: "Custom",
    customOnly: true,
    blurb: "Any team, any game — send the file on Telegram.",
    designs: []
  }
];

/* Listed on the hub until the collection has logos. Deliberately just names:
   don't fake designs we don't have. */
window.RESIN_COMING_SOON = [
  "PUBG Mobile",
  "Free Fire",
  "Dota 2",
  "CS2",
  "League of Legends",
  "RoV"
];

/* Prices per profile. `min` is the quantity that unlocks `tier`;
   null means this profile has no tier (space bar is a fixed price).
   These are the bundled defaults — store_settings.resin_prices (edited in the
   admin Resin tab) overrides them. The matching fallback in
   shared/catalog-cart.js must stay in sync. */
window.RESIN_PRICES = {
  cherry: { label: "Cherry",          short: "Cherry",    single: 3,  tier: 2.5, min: 4 },
  sa:     { label: "SA",              short: "SA",         single: 5,  tier: 4,   min: 4 },
  space:  { label: "Cherry space bar", short: "Space bar", single: 10, tier: 10,  min: null }
};
