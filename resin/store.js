/* =========================
   RESIN STOREFRONT DATA (Supabase)
   The Resin admin writes collections, designs and prices to Supabase. This
   file pulls them in before the hub / builder render and overwrites the
   bundled resin/logos.js data when the tables exist and have rows.

   Safe by design: if the tables are missing, empty, offline or slow, the
   page keeps the bundled data and renders anyway. Pages never wait more
   than 2.5 s for the network.
========================= */

(function(){
  "use strict";

  const FALLBACK_COLLECTIONS = window.RESIN_COLLECTIONS || [];
  const FALLBACK_PRICES = window.RESIN_PRICES || {};
  const GROUPS = ["cherry", "sa", "space"];

  // resin_designs has no role column yet, so the role label for the collection
  // page filter is carried over from the bundled design with the same id.
  const bundledById = new Map();
  FALLBACK_COLLECTIONS.forEach(c => (c.designs || []).forEach(d => bundledById.set(d.id, d)));

  let done = null;
  let timedOut = false;

  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  function mergePrices(raw){
    const out = {};
    GROUPS.forEach(g => {
      const base = FALLBACK_PRICES[g] || {};
      const p = raw && typeof raw[g] === "object" ? raw[g] : {};
      out[g] = {
        label: p.label || base.label || g,
        short: p.short || base.short || g,
        single: num(p.single, base.single),
        tier: num(p.tier, base.tier),
        min: "min" in p
          ? (p.min == null || p.min === "" ? null : num(p.min, base.min))
          : base.min
      };
    });
    return out;
  }

  async function load(){
    const sb = window.KEYCAM_SUPABASE;
    if(!sb || !FALLBACK_COLLECTIONS.length) return;

    try {
      const [colRes, designRes, setRes] = await Promise.all([
        sb.from("resin_collections")
          .select("id,name,short,region,group_name,blurb,custom_only,sort_order,active")
          .order("sort_order"),
        sb.from("resin_designs")
          .select("id,collection_id,name,image_url,tile,sort_order,active")
          .order("sort_order"),
        sb.from("store_settings")
          .select("resin_prices")
          .eq("id", 1)
          .maybeSingle()
      ]);

      // A slow request must not swap the data after the page has rendered.
      if(timedOut) return;
      if(colRes.error || designRes.error) return;
      if(!colRes.data || !colRes.data.length) return;

      const collections = colRes.data
        .filter(c => c.active !== false)
        .map(c => ({
          id: c.id,
          name: c.name,
          short: c.short || c.name,
          region: c.region || undefined,
          group: c.group_name || "Esports",
          blurb: c.blurb || "",
          customOnly: !!c.custom_only,
          designs: []
        }));

      const byId = new Map(collections.map(c => [c.id, c]));
      (designRes.data || []).forEach(d => {
        if(d.active === false) return;
        const c = byId.get(d.collection_id);
        if(!c || c.customOnly) return;
        c.designs.push({
          id: d.id,
          name: d.name,
          tile: d.tile === "dark" ? "dark" : "light",
          image: d.image_url || undefined,
          role: (bundledById.get(d.id) || {}).role
        });
      });

      // The "Your own logo" collection can live only in the bundled file.
      // It stays available unless an admin explicitly deactivated it in the DB.
      const dbCustom = colRes.data.find(c => c.custom_only);
      const bundledCustom = FALLBACK_COLLECTIONS.find(c => c.customOnly);
      if(bundledCustom && !dbCustom && !collections.some(c => c.customOnly)){
        collections.push({ ...bundledCustom, designs: [] });
      }

      window.RESIN_COLLECTIONS = collections.filter(c => c.customOnly || c.designs.length);

      const savedPrices = setRes && setRes.data && setRes.data.resin_prices;
      if(savedPrices) window.RESIN_PRICES = mergePrices(savedPrices);
    } catch(e){
      console.warn("Resin storefront: using bundled data.", e);
    }
  }

  window.ResinStore = {
    ready(){
      if(!done){
        done = Promise.race([
          load(),
          new Promise(resolve => setTimeout(() => { timedOut = true; resolve(); }, 2500))
        ]);
      }
      return done;
    }
  };
})();
