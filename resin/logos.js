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
    id: "val-duelists",
    name: "Valorant Duelists",
    short: "Duelists",
    region: "VCT",
    group: "Esports",
    blurb: "32 ability icons",
    designs: [
      { id: "iso-undercut",             name: "Iso · Undercut",             tile: "dark"  },
      { id: "iso-double-tap",           name: "Iso · Double Tap",           tile: "dark"  },
      { id: "iso-contingency",          name: "Iso · Contingency",          tile: "dark"  },
      { id: "iso-kill-contract",        name: "Iso · Kill Contract",        tile: "dark"  },
      { id: "jett-updraft",             name: "Jett · Updraft",             tile: "dark"  },
      { id: "jett-tailwind",            name: "Jett · Tailwind",            tile: "dark"  },
      { id: "jett-cloudburst",          name: "Jett · Cloudburst",          tile: "dark"  },
      { id: "jett-blade-storm",         name: "Jett · Blade Storm",         tile: "dark"  },
      { id: "neon-relay-bolt",          name: "Neon · Relay Bolt",          tile: "dark"  },
      { id: "neon-high-gear",           name: "Neon · High Gear",           tile: "dark"  },
      { id: "neon-fast-lane",           name: "Neon · Fast Lane",           tile: "dark"  },
      { id: "neon-overdrive",           name: "Neon · Overdrive",           tile: "dark"  },
      { id: "phoenix-hot-hands",        name: "Phoenix · Hot Hands",        tile: "dark"  },
      { id: "phoenix-curveball",        name: "Phoenix · Curveball",        tile: "dark"  },
      { id: "phoenix-blaze",            name: "Phoenix · Blaze",            tile: "dark"  },
      { id: "phoenix-run-it-back",      name: "Phoenix · Run it Back",      tile: "dark"  },
      { id: "raze-blast-pack",          name: "Raze · Blast Pack",          tile: "dark"  },
      { id: "raze-paint-shells",        name: "Raze · Paint Shells",        tile: "dark"  },
      { id: "raze-boom-bot",            name: "Raze · Boom Bot",            tile: "dark"  },
      { id: "raze-showstopper",         name: "Raze · Showstopper",         tile: "dark"  },
      { id: "reyna-devour",             name: "Reyna · Devour",             tile: "dark"  },
      { id: "reyna-dismiss",            name: "Reyna · Dismiss",            tile: "dark"  },
      { id: "reyna-leer",               name: "Reyna · Leer",               tile: "dark"  },
      { id: "reyna-empress",            name: "Reyna · Empress",            tile: "dark"  },
      { id: "waylay-lightspeed",        name: "Waylay · Lightspeed",        tile: "dark"  },
      { id: "waylay-refract",           name: "Waylay · Refract",           tile: "dark"  },
      { id: "waylay-saturate",          name: "Waylay · Saturate",          tile: "dark"  },
      { id: "waylay-convergent-paths",  name: "Waylay · Convergent Paths",  tile: "dark"  },
      { id: "yoru-blindside",           name: "Yoru · BLINDSIDE",           tile: "dark"  },
      { id: "yoru-gatecrash",           name: "Yoru · GATECRASH",           tile: "dark"  },
      { id: "yoru-fakeout",             name: "Yoru · FAKEOUT",             tile: "dark"  },
      { id: "yoru-dimensional-drift",   name: "Yoru · DIMENSIONAL DRIFT",   tile: "dark"  }
    ]
  },
  {
    id: "val-initiators",
    name: "Valorant Initiators",
    short: "Initiators",
    region: "VCT",
    group: "Esports",
    blurb: "28 ability icons",
    designs: [
      { id: "breach-flashpoint",       name: "Breach · Flashpoint",       tile: "dark"  },
      { id: "breach-fault-line",       name: "Breach · Fault Line",       tile: "dark"  },
      { id: "breach-aftershock",       name: "Breach · Aftershock",       tile: "dark"  },
      { id: "breach-rolling-thunder",  name: "Breach · Rolling Thunder",  tile: "dark"  },
      { id: "fade-seize",              name: "Fade · Seize",              tile: "dark"  },
      { id: "fade-haunt",              name: "Fade · Haunt",              tile: "dark"  },
      { id: "fade-prowler",            name: "Fade · Prowler",            tile: "dark"  },
      { id: "fade-nightfall",          name: "Fade · Nightfall",          tile: "dark"  },
      { id: "gekko-wingman",           name: "Gekko · Wingman",           tile: "dark"  },
      { id: "gekko-dizzy",             name: "Gekko · Dizzy",             tile: "dark"  },
      { id: "gekko-mosh-pit",          name: "Gekko · Mosh Pit",          tile: "dark"  },
      { id: "gekko-thrash",            name: "Gekko · Thrash",            tile: "dark"  },
      { id: "kay-o-flash-drive",       name: "KAY/O · FLASH/drive",       tile: "dark"  },
      { id: "kay-o-zero-point",        name: "KAY/O · ZERO/point",        tile: "dark"  },
      { id: "kay-o-frag-ment",         name: "KAY/O · FRAG/ment",         tile: "dark"  },
      { id: "kay-o-null-cmd",          name: "KAY/O · NULL/cmd",          tile: "dark"  },
      { id: "skye-trailblazer",        name: "Skye · Trailblazer",        tile: "dark"  },
      { id: "skye-guiding-light",      name: "Skye · Guiding Light",      tile: "dark"  },
      { id: "skye-regrowth",           name: "Skye · Regrowth",           tile: "dark"  },
      { id: "skye-seekers",            name: "Skye · Seekers",            tile: "dark"  },
      { id: "sova-shock-bolt",         name: "Sova · Shock Bolt",         tile: "dark"  },
      { id: "sova-recon-bolt",         name: "Sova · Recon Bolt",         tile: "dark"  },
      { id: "sova-owl-drone",          name: "Sova · Owl Drone",          tile: "dark"  },
      { id: "sova-hunter-s-fury",      name: "Sova · Hunter's Fury",      tile: "dark"  },
      { id: "tejo-special-delivery",   name: "Tejo · Special Delivery",   tile: "dark"  },
      { id: "tejo-guided-salvo",       name: "Tejo · Guided Salvo",       tile: "dark"  },
      { id: "tejo-stealth-drone",      name: "Tejo · Stealth Drone",      tile: "dark"  },
      { id: "tejo-armageddon",         name: "Tejo · Armageddon",         tile: "dark"  }
    ]
  },
  {
    id: "val-controllers",
    name: "Valorant Controllers",
    short: "Controllers",
    region: "VCT",
    group: "Esports",
    blurb: "28 ability icons",
    designs: [
      { id: "astra-nova-pulse",          name: "Astra · Nova Pulse",          tile: "dark"  },
      { id: "astra-nebula",              name: "Astra · Nebula",              tile: "dark"  },
      { id: "astra-gravity-well",        name: "Astra · Gravity Well",        tile: "dark"  },
      { id: "astra-cosmic-divide",       name: "Astra · Cosmic Divide",       tile: "dark"  },
      { id: "brimstone-incendiary",      name: "Brimstone · Incendiary",      tile: "dark"  },
      { id: "brimstone-sky-smoke",       name: "Brimstone · Sky Smoke",       tile: "dark"  },
      { id: "brimstone-stim-beacon",     name: "Brimstone · Stim Beacon",     tile: "dark"  },
      { id: "brimstone-orbital-strike",  name: "Brimstone · Orbital Strike",  tile: "dark"  },
      { id: "clove-meddle",              name: "Clove · Meddle",              tile: "dark"  },
      { id: "clove-ruse",                name: "Clove · Ruse",                tile: "dark"  },
      { id: "clove-pick-me-up",          name: "Clove · Pick-me-up",          tile: "dark"  },
      { id: "clove-not-dead-yet",        name: "Clove · Not Dead Yet",        tile: "dark"  },
      { id: "harbor-high-tide",          name: "Harbor · High Tide",          tile: "dark"  },
      { id: "harbor-cove",               name: "Harbor · Cove",               tile: "dark"  },
      { id: "harbor-storm-surge",        name: "Harbor · Storm Surge",        tile: "dark"  },
      { id: "harbor-reckoning",          name: "Harbor · Reckoning",          tile: "dark"  },
      { id: "miks-harmonize",            name: "Miks · Harmonize",            tile: "dark"  },
      { id: "miks-waveform",             name: "Miks · Waveform",             tile: "dark"  },
      { id: "miks-m-pulse",              name: "Miks · M-pulse",              tile: "dark"  },
      { id: "miks-bassquake",            name: "Miks · Bassquake",            tile: "dark"  },
      { id: "omen-paranoia",             name: "Omen · Paranoia",             tile: "dark"  },
      { id: "omen-dark-cover",           name: "Omen · Dark Cover",           tile: "dark"  },
      { id: "omen-shrouded-step",        name: "Omen · Shrouded Step",        tile: "dark"  },
      { id: "omen-from-the-shadows",     name: "Omen · From the Shadows",     tile: "dark"  },
      { id: "viper-poison-cloud",        name: "Viper · Poison Cloud",        tile: "dark"  },
      { id: "viper-toxic-screen",        name: "Viper · Toxic Screen",        tile: "dark"  },
      { id: "viper-snake-bite",          name: "Viper · Snake Bite",          tile: "dark"  },
      { id: "viper-viper-s-pit",         name: "Viper · Viper's Pit",         tile: "dark"  }
    ]
  },
  {
    id: "val-sentinels",
    name: "Valorant Sentinels",
    short: "Sentinels",
    region: "VCT",
    group: "Esports",
    blurb: "28 ability icons",
    designs: [
      { id: "chamber-headhunter",     name: "Chamber · Headhunter",     tile: "dark"  },
      { id: "chamber-rendezvous",     name: "Chamber · Rendezvous",     tile: "dark"  },
      { id: "chamber-trademark",      name: "Chamber · Trademark",      tile: "dark"  },
      { id: "chamber-tour-de-force",  name: "Chamber · Tour De Force",  tile: "dark"  },
      { id: "cypher-cyber-cage",      name: "Cypher · Cyber Cage",      tile: "dark"  },
      { id: "cypher-spycam",          name: "Cypher · Spycam",          tile: "dark"  },
      { id: "cypher-trapwire",        name: "Cypher · Trapwire",        tile: "dark"  },
      { id: "cypher-neural-theft",    name: "Cypher · Neural Theft",    tile: "dark"  },
      { id: "deadlock-sonic-sensor",  name: "Deadlock · Sonic Sensor",  tile: "dark"  },
      { id: "deadlock-gravnet",       name: "Deadlock · GravNet",       tile: "dark"  },
      { id: "deadlock-barrier-mesh",  name: "Deadlock · Barrier Mesh",  tile: "dark"  },
      { id: "deadlock-annihilation",  name: "Deadlock · Annihilation",  tile: "dark"  },
      { id: "killjoy-alarmbot",       name: "Killjoy · ALARMBOT",       tile: "dark"  },
      { id: "killjoy-turret",         name: "Killjoy · TURRET",         tile: "dark"  },
      { id: "killjoy-nanoswarm",      name: "Killjoy · Nanoswarm",      tile: "dark"  },
      { id: "killjoy-lockdown",       name: "Killjoy · Lockdown",       tile: "dark"  },
      { id: "sage-slow-orb",          name: "Sage · Slow Orb",          tile: "dark"  },
      { id: "sage-healing-orb",       name: "Sage · Healing Orb",       tile: "dark"  },
      { id: "sage-barrier-orb",       name: "Sage · Barrier Orb",       tile: "dark"  },
      { id: "sage-resurrection",      name: "Sage · Resurrection",      tile: "dark"  },
      { id: "veto-chokehold",         name: "Veto · Chokehold",         tile: "dark"  },
      { id: "veto-interceptor",       name: "Veto · Interceptor",       tile: "dark"  },
      { id: "veto-crosscut",          name: "Veto · Crosscut",          tile: "dark"  },
      { id: "veto-evolution",         name: "Veto · Evolution",         tile: "dark"  },
      { id: "vyse-shear",             name: "Vyse · Shear",             tile: "dark"  },
      { id: "vyse-arc-rose",          name: "Vyse · Arc Rose",          tile: "dark"  },
      { id: "vyse-razorvine",         name: "Vyse · Razorvine",         tile: "dark"  },
      { id: "vyse-steel-garden",      name: "Vyse · Steel Garden",      tile: "dark"  }
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
