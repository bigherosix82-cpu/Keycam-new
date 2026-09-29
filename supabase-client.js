/* =========================
   SUPABASE CLIENT
   Public project URL + anon key — safe to expose in frontend code.
   The anon key can ONLY insert into `orders` (see RLS policy in Supabase),
   it cannot read, edit, or delete any data.
========================= */
(function () {
  const SUPABASE_URL = "https://qysglhjqcrukdpzavdom.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5c2dsaGpxY3J1a2RwemF2ZG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NDk2NjIsImV4cCI6MjEwMzMyNTY2Mn0.-ZT6HOqS-KSvg49zDpALBBr6-kCwoMniLtWI0C21ur4";

  if (window.supabase && window.supabase.createClient) {
    window.KEYCAM_SUPABASE = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error("Supabase library did not load — orders will not be saved to the database, but Telegram checkout will still work.");
  }
})();
