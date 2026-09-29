/* =========================
   SHARED LAYOUT (Keyboard / Accessories / Mouse / site hub)
   Injects header, footer, mobile menu and order drawer into
   placeholder elements so every new page shares one copy of this
   markup instead of duplicating it per file. Deskmat is NOT part of
   this — it keeps its own header/footer inline, frozen as-is.

   Usage: call initLayout({ base: '' | '../', active: 'keyboard'|'accessories'|'mouse'|'deskmat'|null })
   Requires these placeholders in the page:
     <div id="siteHeader"></div>  ... page content ...  <div id="siteFooter"></div>
     <div id="siteOverlays"></div>  (anywhere — holds drawer/backdrop/mobile menu)
========================= */

function initLayout(opts){
  const base = opts.base || "";
  const active = opts.active || "";
  const a = (path) => base + path;

  const isKeyboard = active === "keyboard";

  document.querySelector("#siteHeader").innerHTML = `
    <header class="site-header">
      <div class="container nav-wrap">
        <a class="brand" href="${a('index.html')}"><img src="${a('assets/keycam-logo.jpg')}" alt="KeyCam logo"><span>KEYCAM</span></a>
        <nav class="desktop-nav">
          <a class="nav-menu ${isKeyboard?'active':''}" id="keyboardNavToggle" href="${a('keyboard/index.html')}">Keyboard</a>
          <a href="${a('accessories/collection.html')}" class="${active==='accessories'?'active':''}">Accessories</a>
          <a href="${a('mouse/collection.html')}" class="${active==='mouse'?'active':''}">Mouse</a>
          <a href="${a('deskmat/index.html')}" class="${active==='deskmat'?'active':''}">Deskmat</a>
        </nav>
        <div class="header-actions">
          <button class="icon-btn" id="searchOpen" aria-label="Search">⌕</button>
          <button class="order-pill" id="orderOpen">My Order <b id="orderCount">0</b></button>
          <button class="menu-btn" id="menuOpen" aria-label="Open menu">☰</button>
        </div>
      </div>
      <div class="mega product-mega" id="keyboardMenu">
        <div class="container product-menu-grid">
          <a href="${a('keyboard/collection.html?subtype=prebuild')}"><strong>Prebuild Keyboard</strong><span>Ready-made keyboards</span></a>
          <a href="${a('keyboard/collection.html?subtype=customized')}"><strong>Customized Keyboard</strong><span>Ready custom builds</span></a>
          <a href="${a('keyboard/collection.html?subtype=barebone')}"><strong>Barebone</strong><span>Every size · hotswap</span></a>
          <a href="${a('keyboard/collection.html?subtype=switch')}"><strong>Switch</strong><span>By brand or by amount</span></a>
          <a href="${a('keyboard/collection.html?subtype=keycap')}"><strong>Keycap</strong><span>Full sets</span></a>
          <a href="${a('keyboard/collection.html?subtype=artisan')}"><strong>Artisan</strong><span>Unique &amp; pack pieces</span></a>
        </div>
      </div>
    </header>
    <div id="festivalBanner"></div>
  `;

  document.querySelector("#siteFooter").innerHTML = `
    <footer class="site-footer">
      <div class="container footer-social">
        <a href="https://maps.app.goo.gl/SFp44sTmpm52HC5i7" target="_blank" rel="noopener" aria-label="Location"><img src="${a('assets/icons/location.png')}" alt=""></a>
        <a href="https://t.me/Key_Cam" target="_blank" rel="noopener" aria-label="Telegram"><img src="${a('assets/icons/telegram.png')}" alt=""></a>
        <a href="https://www.facebook.com/share/1EyHBrqsXP/" target="_blank" rel="noopener" aria-label="Facebook"><img src="${a('assets/icons/facebook.png')}" alt=""></a>
        <a href="https://www.instagram.com/key_camm?igsh=bWVjeWd6bWFvZHB4" target="_blank" rel="noopener" aria-label="Instagram"><img src="${a('assets/icons/instagram.webp')}" alt=""></a>
        <a href="https://www.tiktok.com/@keycamm?_r=1&_t=ZS-98MRrdf6b" target="_blank" rel="noopener" aria-label="TikTok"><img src="${a('assets/icons/tiktok.png')}" alt=""></a>
      </div>
      <div class="container footer-grid">
        <div>
          <div class="footer-brand">KEYCAM</div>
          <p>Custom desk mats and mouse pads for your setup.<br>Cambodia.</p>
        </div>
        <div>
          <span>EXPLORE</span>
          <a href="${a('index.html')}#collections">Collections</a>
          <a href="${a('deskmat/index.html')}#products">All Designs</a>
          <a href="${a('deskmat/size-guide.html')}">Size Guide</a>
        </div>
        <div>
          <span>CONTACT</span>
          <p>Phnom Penh, Toul Kork, Sonthormok</p>
          <p>0886449944</p>
          <a href="https://t.me/Key_Cam" target="_blank" rel="noopener">@Key_cam</a>
          <a href="https://maps.app.goo.gl/SFp44sTmpm52HC5i7" target="_blank" rel="noopener">View on Google Maps →</a>
        </div>
        <div>
          <span>POLICY</span>
          <a href="${a('deskmat/policy.html')}">Return &amp; Warranty</a>
          <a href="${a('deskmat/faq.html')}">FAQ</a>
          <a href="#" id="footerOrder">My Order</a>
        </div>
      </div>
      <div class="container footer-bottom">
        <span>© 2026 KeyCam. All rights reserved.</span>
        <span>MADE FOR YOUR DESK.</span>
      </div>
    </footer>
  `;

  document.querySelector("#siteOverlays").innerHTML = `
    <div class="search-panel" id="searchPanel">
      <div class="container">
        <button id="searchClose" aria-label="Close search">×</button>
        <input id="searchInput" placeholder="Search keyboards, accessories, mouse..." autocomplete="off">
        <p>Press Enter to search.</p>
      </div>
    </div>
    <div class="drawer-backdrop" id="drawerBackdrop"></div>
    <aside class="order-drawer" id="orderDrawer">
      <div class="drawer-head"><h2>My Order</h2><button id="orderClose" aria-label="Close order">×</button></div>
      <div id="orderItems"></div>
      <div class="order-contact" id="orderContact">
        <label>Full name
          <input type="text" id="orderName" placeholder="Your name" autocomplete="name">
        </label>
        <label>Phone number
          <input type="tel" id="orderPhone" placeholder="e.g. 012 345 678" autocomplete="tel">
        </label>
        <p class="order-contact-error" id="orderContactError" style="display:none;">Please enter your name and phone number.</p>
      </div>
      <div class="drawer-total"><span>Total</span><strong id="orderTotal">$0</strong></div>
      <button class="btn btn-primary btn-wide" id="telegramOrder">Order on Telegram ↗</button>
      <button class="clear-order" id="clearOrder">Clear order</button>
    </aside>
    <div class="mobile-menu" id="mobileMenu">
      <button id="mobileClose" aria-label="Close menu">×</button>
      <a href="${a('index.html')}">Home</a>
      <button class="mobile-expand" data-target="mobileKeyboard">Keyboard +</button>
      <div id="mobileKeyboard">
        <a href="${a('keyboard/collection.html?subtype=prebuild')}">Prebuild Keyboard</a>
        <a href="${a('keyboard/collection.html?subtype=customized')}">Customized Keyboard</a>
        <a href="${a('keyboard/collection.html?subtype=barebone')}">Barebone</a>
        <a href="${a('keyboard/collection.html?subtype=switch')}">Switch</a>
        <a href="${a('keyboard/collection.html?subtype=keycap')}">Keycap</a>
        <a href="${a('keyboard/collection.html?subtype=artisan')}">Artisan</a>
      </div>
      <a href="${a('accessories/collection.html')}">Accessories</a>
      <a href="${a('mouse/collection.html')}">Mouse</a>
      <a href="${a('deskmat/index.html')}">Deskmat</a>
      <a href="https://t.me/Key_Cam" target="_blank" rel="noopener">Telegram ↗</a>
    </div>
  `;

  wireLayoutEvents(base);
  if(typeof wireCatalogCartEvents === "function") wireCatalogCartEvents();

  // Pchum Ben festival banner — shown under the header on every
  // Keyboard/Accessories/Mouse/hub page (anywhere initLayout runs).
  // Deskmat pages never call initLayout, so it never shows there, and
  // it stays hidden entirely when the festival sale isn't currently on.
  if(window.CATALOG_READY && typeof window.CATALOG_READY.then === "function"){
    window.CATALOG_READY.then(renderFestivalBanner);
  }
}

function renderFestivalBanner(){
  const bannerEl = document.querySelector("#festivalBanner");
  if(!bannerEl) return;
  if(!window.CATALOG_DISCOUNT || !window.CATALOG_DISCOUNT.active){
    bannerEl.innerHTML = "";
    return;
  }
  const label = window.CATALOG_DISCOUNT.label || "Pchum Ben Festival Sale";
  const pct = Math.round(window.CATALOG_DISCOUNT.percent);
  const endsText = window.CATALOG_DISCOUNT.endsAt
    ? `Ends ${window.CATALOG_DISCOUNT.endsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "";
  bannerEl.innerHTML = `
    <div class="festival-banner">
      <span>🎉 <strong>${label}</strong> — up to ${pct}% off Keyboard, Accessories &amp; Mouse</span>
      ${endsText ? `<span class="festival-banner-sub">${endsText}</span>` : ""}
    </div>
  `;
}

function wireLayoutEvents(base){
  const keyboardToggle = document.querySelector("#keyboardNavToggle");
  const keyboardMenu = document.querySelector("#keyboardMenu");
  if(keyboardToggle && keyboardMenu){
    keyboardToggle.addEventListener("mouseenter", () => keyboardMenu.classList.add("open"));
    document.addEventListener("click", (e) => {
      if(!keyboardMenu.contains(e.target) && e.target !== keyboardToggle) keyboardMenu.classList.remove("open");
    });
  }

  document.querySelector("#searchOpen")?.addEventListener("click", () => {
    document.querySelector("#searchPanel")?.classList.add("open");
    document.querySelector("#searchInput")?.focus();
  });
  document.querySelector("#searchClose")?.addEventListener("click", () => document.querySelector("#searchPanel")?.classList.remove("open"));
  document.querySelector("#searchInput")?.addEventListener("keydown", (e) => {
    if(e.key === "Enter" && e.target.value.trim()){
      location.href = `${base}search.html?q=${encodeURIComponent(e.target.value.trim())}`;
    }
  });

  document.querySelector("#menuOpen")?.addEventListener("click", () => document.querySelector("#mobileMenu")?.classList.add("open"));
  document.querySelector("#mobileClose")?.addEventListener("click", () => document.querySelector("#mobileMenu")?.classList.remove("open"));
  document.querySelectorAll(".mobile-expand").forEach(btn => {
    btn.addEventListener("click", () => document.querySelector(`#${btn.dataset.target}`)?.classList.toggle("open"));
  });
}

/* =========================
   IMAGE COPY DETERRENTS
   Blocks the easy ways of saving a photo: the right-click / long-press menu,
   dragging the image out of the page, and image selection. This is only a
   deterrent — screenshots and dev tools still work, so a watermark is the
   real protection. (Same snippet lives in shared/layout.js and deskmat/app.js
   because Deskmat and the catalog pages load different shared scripts.)
========================= */
(function(){
  if(window.__kcImageGuard) return;
  window.__kcImageGuard = true;

  const style = document.createElement("style");
  style.textContent =
    "img{-webkit-user-drag:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}" +
    // Card photos sit inside a link that handles the click, so the photo itself
    // doesn't need to receive pointer events (nothing left to long-press/save).
    ".product-card{-webkit-touch-callout:none;}.product-card img{pointer-events:none;}";
  document.head.appendChild(style);

  const onImage = e => e.target && e.target.closest && e.target.closest("img");
  document.addEventListener("contextmenu", e => { if(onImage(e)) e.preventDefault(); });
  document.addEventListener("dragstart",   e => { if(onImage(e)) e.preventDefault(); });
})();
