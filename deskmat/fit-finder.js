(function(){
    // Product sizes from the current price tables.
    // Dimensions are in mm.
    // Regular supports 3MM / 5MM where listed.
    // FPS is 5MM only.
    // Glass is 3MM glass only.
    var SIZES = [
      // Regular Mouse Pad
      { name:'XXL', w:1000, d:500, price3:null, price5:22,    format:'regular', formatLabel:'Regular Mouse Pad' },
      { name:'XL',  w:900,  d:400, price3:12,   price5:16,    format:'regular', formatLabel:'Regular Mouse Pad' },
      { name:'L',   w:800,  d:400, price3:11,   price5:14.5,  format:'regular', formatLabel:'Regular Mouse Pad' },
      { name:'M',   w:800,  d:300, price3:9.5,  price5:13,    format:'regular', formatLabel:'Regular Mouse Pad' },
      { name:'S',   w:600,  d:300, price3:8.5,  price5:null, format:'regular', formatLabel:'Regular Mouse Pad' },
      { name:'XS',  w:450,  d:400, price3:null, price5:9.5, format:'regular', formatLabel:'Regular Mouse Pad' },
      { name:'XXS', w:300,  d:250, price3:4.5,  price5:7.5,  format:'regular', formatLabel:'Regular Mouse Pad' },

      // FPS Mouse Pad — 5MM only
      { name:'450×400', w:450, d:400, price3:null, price5:10,   format:'fps', formatLabel:'FPS Mouse Pad' },
      { name:'360×320', w:360, d:320, price3:null, price5:8.5,  format:'fps', formatLabel:'FPS Mouse Pad' },
      

      // Glass Mouse Pad — 3MM glass only
      { name:'360×320', w:360, d:320, price3:18, price5:null, format:'glass', formatLabel:'Glass Mouse Pad' },
      { name:'490×420', w:490, d:420, price3:24, price5:null, format:'glass', formatLabel:'Glass Mouse Pad' }
    ];

    // Real-world footprints used for the top-down product assets.
    // These values control physical scale; the desk itself is the only canvas that resizes.
    var KEYBOARD_W = 330, KEYBOARD_D = 138;
    var MOUSE_W = 65, MOUSE_D = 116;
    var MONITOR_W = 610;
    var MONITOR_D = 190;

    // Real asset paths. Keep these files in assets/fit-finder/.
    var FIT_ASSETS = {
      desk: 'assets/fit-finder/desk-texture.jpg',
      monitor: 'assets/fit-finder/Monitor.png',
      keyboard: 'assets/fit-finder/keyboard.png',
      mouse: 'assets/fit-finder/Mouse.png'
    };

    var DESK_TEXTURE_KEY = 'keycam-desk-texture';
    function getDeskTextureFile(){
      try {
        var v = localStorage.getItem(DESK_TEXTURE_KEY);
        if(v && /^desk-texture[\w.-]*\.jpg$/i.test(v)) return v;
      } catch(e){}
      return 'desk-texture.jpg';
    }
    function setDeskTextureFile(file){
      try { localStorage.setItem(DESK_TEXTURE_KEY, file); } catch(e){}
    }
    function applyDeskTexture(){
      FIT_ASSETS.desk = 'assets/fit-finder/' + getDeskTextureFile();
      if(deskEl){
        deskEl.style.backgroundImage = 'url("' + FIT_ASSETS.desk + '")';
      }
    }
    function wireDeskTextureSwitch(){
      var wrap = document.getElementById('deskTextureSwitch');
      if(!wrap) return;
      var current = getDeskTextureFile();
      var buttons = wrap.querySelectorAll('.desk-texture-btn');
      for(var i = 0; i < buttons.length; i++){
        (function(btn){
          btn.classList.toggle('active', btn.getAttribute('data-desk') === current);
          btn.addEventListener('click', function(){
            setDeskTextureFile(btn.getAttribute('data-desk'));
            for(var j = 0; j < buttons.length; j++){
              buttons[j].classList.toggle('active', buttons[j] === btn);
            }
            applyDeskTexture();
          });
        })(buttons[i]);
      }
      applyDeskTexture();
    }

    // Coverage is independent from product format.
    // Desk mat = keyboard + mouse.
    // Mouse pad = mouse only.
    var CLEARANCE = {
      deskmat:  { w:100, d:50 },
      mousepad: { w:30,  d:20 }
    };

    var widthInput = document.getElementById('fitWidth');
    var depthInput = document.getElementById('fitDepth');
    var coverageSelect = document.getElementById('fitCoverage');
    var typeSelect = document.getElementById('fitType');
    var findBtn = document.getElementById('fitFindBtn');
    var errorEl = document.getElementById('fitError');
    var resultsEl = document.getElementById('fitResults');
    var deskEl = document.getElementById('fitDesk');
    var matEl = document.getElementById('fitMat');
    var matLabelEl = document.getElementById('fitMatLabel');
    var keyboardEl = document.getElementById('fitKeyboard');
    var mouseEl = document.getElementById('fitMouseShape');
    var captionEl = document.getElementById('fitCaption');

    if(!findBtn) return;

    function priceLabel(size){
  var parts = [];

  function displayPrice(price){
    if(price === null) return null;

    // Follow maintenance pricing used by the Size Guide.
    if(
      typeof KEYCAM_STORE !== 'undefined' &&
      KEYCAM_STORE.maintenanceMode &&
      (size.format === 'regular' || size.format === 'fps')
    ){
      return Math.round(
        price * (1 - KEYCAM_STORE.maintenanceDiscount) * 100
      ) / 100;
    }

    return price;
  }

  var price3 = displayPrice(size.price3);
  var price5 = displayPrice(size.price5);

  if(price3 !== null){
    parts.push('3MM $' + price3);
  }

  if(price5 !== null){
    parts.push('5MM $' + price5);
  }

  return parts.join(' · ');
}

    function cmLabel(mm){
      return (mm / 10).toString().replace(/\.0$/, '');
    }

    function getFormat(){
      return typeSelect && typeSelect.value ? typeSelect.value : 'regular';
    }

    function getCoverage(){
      return coverageSelect && coverageSelect.value
        ? coverageSelect.value
        : 'deskmat';
    }

    function syncCoverageForFormat(){
      if(!coverageSelect || !typeSelect) return;

      // FPS and Glass are mouse-focused products, so Desk mat mode
      // is disabled for them.
      if(typeSelect.value === 'fps' || typeSelect.value === 'glass'){
        coverageSelect.value = 'mousepad';
        coverageSelect.disabled = true;
      } else {
        coverageSelect.disabled = false;
      }
    }

    function setRect(el, leftPct, topPct, wPct, dPct){
      el.style.left = leftPct + '%';
      el.style.top = topPct + '%';
      el.style.width = wPct + '%';
      el.style.height = dPct + '%';
    }

    function applyFitFinderAssetStyles(){
      // Real desk texture instead of the old flat-color canvas.
      deskEl.style.position = 'relative';
      deskEl.style.overflow = 'hidden';
      deskEl.style.backgroundImage = 'url(\"' + FIT_ASSETS.desk + '\")';
      deskEl.style.backgroundSize = 'cover';
      deskEl.style.backgroundPosition = 'center';
      deskEl.style.backgroundRepeat = 'no-repeat';

      // Replace the CSS placeholder keyboard/mouse with the supplied images.
      [keyboardEl, mouseEl].forEach(function(el){
        el.style.backgroundColor = 'transparent';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = 'center';
        el.style.backgroundSize = '100% 100%';
        el.style.border = '0';
        el.style.boxShadow = 'none';
        el.style.borderRadius = '0';
        el.style.display = 'none';
        el.style.zIndex = '6';
        el.style.pointerEvents = 'none';
      });

      keyboardEl.style.backgroundImage = 'url(\"' + FIT_ASSETS.keyboard + '\")';
      mouseEl.style.backgroundImage = 'url(\"' + FIT_ASSETS.mouse + '\")';

      // Keep the artwork as the desk-mat surface.
      matEl.style.zIndex = '4';
      matEl.style.overflow = 'hidden';
      matEl.style.borderRadius = '2px';
      matEl.style.backgroundColor = '#242424';
      matEl.style.backgroundSize = 'cover';
      matEl.style.backgroundPosition = 'center';
      matEl.style.backgroundRepeat = 'no-repeat';
      matEl.style.boxShadow = '0 7px 18px rgba(0,0,0,.28)';
      matEl.style.border = '1px solid rgba(255,255,255,.14)';
      matEl.style.display = 'none';

      // Hide the on-mat size pill — empty black blob when artwork is shown.
      // Size text lives in #fitCaption under the desk instead.
      matLabelEl.style.display = 'none';
      matLabelEl.textContent = '';
    }

    function createMonitorAsset(){
      var old = document.getElementById('fitMonitor27');
      if(old) old.remove();

      var img = document.createElement('img');
      img.id = 'fitMonitor27';
      img.src = FIT_ASSETS.monitor;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.draggable = false;
      img.style.position = 'absolute';
      img.style.display = 'none';
      img.style.boxSizing = 'border-box';
      img.style.objectFit = 'fill';
      img.style.objectPosition = 'center';
      img.style.zIndex = '5';
      img.style.pointerEvents = 'none';
      img.style.filter = 'drop-shadow(0 7px 9px rgba(0,0,0,.30))';
      deskEl.appendChild(img);
      return img;
    }

    // Artwork Checker shares its local object URL through this global.
    var artworkPreviewUrl = window.KEYCAM_ARTWORK_PREVIEW || null;
    var monitorEl = createMonitorAsset();

    function setArtworkPreview(url){
      artworkPreviewUrl = url || null;
      if(artworkPreviewUrl){
        matEl.style.backgroundImage = 'url(\"' + artworkPreviewUrl + '\")';
      } else {
        matEl.style.backgroundImage = 'none';
      }
    }

    applyFitFinderAssetStyles();
    setArtworkPreview(artworkPreviewUrl);

    document.addEventListener('keycamArtworkChanged', function(e){
      setArtworkPreview(e.detail && e.detail.url);
      if(matEl.style.display !== 'none'){
        var w = parseFloat(widthInput.value);
        var d = parseFloat(depthInput.value);
        if(w > 0 && d > 0 && matEl.dataset.fitSize){
          try{
            var saved = JSON.parse(matEl.dataset.fitSize);
            renderVisual(w * 10, d * 10, saved, getFormat(), getCoverage());
          }catch(err){}
        }
      }
    });

    function renderVisual(deskWmm, deskDmm, mat, format, coverage){
      deskEl.style.aspectRatio = deskWmm + ' / ' + deskDmm;

      if(!mat){
        matEl.dataset.fitSize = '';
        matEl.style.display = 'none';
        keyboardEl.style.display = 'none';
        mouseEl.style.display = 'none';
        if(monitorEl) monitorEl.style.display = 'none';
        captionEl.textContent =
          'No listed size fits that usable space — try a larger area or ask about a custom size.';
        return;
      }

      matEl.dataset.fitSize = JSON.stringify(mat);
      setArtworkPreview(artworkPreviewUrl);

      var matWpct = (mat.w / deskWmm) * 100;
      var matDpct = (mat.d / deskDmm) * 100;
      var kbWpct = (KEYBOARD_W / deskWmm) * 100;
      var kbDpct = (KEYBOARD_D / deskDmm) * 100;
      var mouseWpct = (MOUSE_W / deskWmm) * 100;
      var mouseDpct = (MOUSE_D / deskDmm) * 100;
      var monitorWpct = (MONITOR_W / deskWmm) * 100;
      var monitorDpct = (MONITOR_D / deskDmm) * 100;
      var gapPct = (15 / deskWmm) * 100;

      // The supplied assets keep their real-world footprint. The desk canvas
      // changes size; the monitor/keyboard/mouse do not change physical size.
      if(monitorEl){
        monitorEl.style.display = 'block';
        monitorEl.style.width = monitorWpct + '%';
        monitorEl.style.height = monitorDpct + '%';
        monitorEl.style.left = ((100 - monitorWpct) / 2) + '%';
        monitorEl.style.top = '3%';
      }

      matEl.style.display = 'flex';
      

      if(coverage === 'deskmat'){
        // Desk mat sits toward the front of the desk.
        var matLeft = (100 - matWpct) / 2;
        var matTop = 100 - matDpct - 7;
        setRect(matEl, matLeft, matTop, matWpct, matDpct);

       // Center the keyboard + mouse GROUP on the desk mat.
var groupWidth = kbWpct + gapPct + mouseWpct;
var groupHeight = Math.max(kbDpct, mouseDpct);

var groupLeft = matLeft + (matWpct - groupWidth) / 2;
var groupTop = matTop + (matDpct - groupHeight) / 2;

// Keyboard
setRect(
  keyboardEl,
  groupLeft,
  groupTop + (groupHeight - kbDpct) / 2,
  kbWpct,
  kbDpct
);

// Mouse
setRect(
  mouseEl,
  groupLeft + kbWpct + gapPct,
  groupTop + (groupHeight - mouseDpct) / 2,
  mouseWpct,
  mouseDpct
);

        keyboardEl.style.display = 'block';
        mouseEl.style.display = 'block';

        captionEl.textContent =
          mat.formatLabel + ' · ' +
          cmLabel(mat.w) + '×' + cmLabel(mat.d) +
          ' cm' +
          (artworkPreviewUrl ? ' using your uploaded artwork' : '') +
          ' shown with a real 27-inch monitor + keyboard + mouse on your ' +
          cmLabel(deskWmm) + '×' + cmLabel(deskDmm) +
          ' cm usable space.';
      } else {
        // Mouse-pad mode: keep the same physical assets, with the pad under the mouse.
        var totalWpct = kbWpct + gapPct + matWpct;
        var startLeft = (100 - totalWpct) / 2;
        var rowTop = 100 - Math.max(kbDpct, matDpct) - 7;

        var matLeft = startLeft + kbWpct + gapPct;
        var keyboardTop = rowTop + (matDpct - kbDpct) / 2;

        // Mouse-pad mode: keyboard stays to the LEFT of the mousepad,
        // but its vertical center aligns with the mousepad's vertical center.
        setRect(keyboardEl, startLeft, keyboardTop, kbWpct, kbDpct);
        setRect(matEl, matLeft, rowTop, matWpct, matDpct);
        setRect(mouseEl, matLeft + (matWpct - mouseWpct) / 2, rowTop + (matDpct - mouseDpct) / 2, mouseWpct, mouseDpct);

        keyboardEl.style.display = 'block';
        mouseEl.style.display = 'block';

        captionEl.textContent =
          mat.formatLabel + ' · ' +
          cmLabel(mat.w) + '×' + cmLabel(mat.d) +
          ' cm' +
          (artworkPreviewUrl ? ' using your uploaded artwork' : '') +
          ' shown with a real 27-inch monitor + keyboard + mouse on your ' +
          cmLabel(deskWmm) + '×' + cmLabel(deskDmm) +
          ' cm usable space.';
      }
    }

    function renderSelectedCard(size, tag){
      var priceStr = priceLabel(size);
      var dims = cmLabel(size.w) + '×' + cmLabel(size.d) + ' cm';

      var tgText = encodeURIComponent(
        'Hi! I\'d like a ' +
        size.formatLabel +
        ' in ' +
        dims +
        '.'
      );

      var browseType =
        size.format === 'fps'
          ? 'fps'
          : size.format === 'glass'
            ? 'glass'
            : 'mousepad';

      resultsEl.innerHTML =
        '<div class="fit-card fit-card-primary">' +
          '<span class="fit-card-tag">' + tag + '</span>' +
          '<strong class="fit-card-size">' +
            size.formatLabel +
          '</strong>' +
          (priceStr
            ? '<span class="fit-card-price">' +
                priceStr +
              '</span>'
            : '') +
          '<div class="fit-card-links">' +
            '<a class="fit-card-link" href="collection.html?type=' +
              browseType +
              '">Browse designs &rarr;</a>' +
            '<a class="fit-card-link" href="https://t.me/Key_Cam?text=' +
              tgText +
              '" target="_blank" rel="noopener">' +
              'Ask on Telegram &rarr;' +
            '</a>' +
          '</div>' +
        '</div>';
    }

    function renderSizeOptions(list, selected){
      if(list.length <= 1) return;

      var options = document.createElement('div');
      options.className = 'fit-size-options';

      var heading = document.createElement('div');
      heading.className = 'fit-size-options-title';
      heading.textContent = 'Compare other sizes';
      options.appendChild(heading);

      var buttons = document.createElement('div');
      buttons.className = 'fit-size-option-list';

      list.forEach(function(size){
        if(size.name === selected.name) return;

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'fit-size-option';

        button.innerHTML =
          '<strong>' +
            cmLabel(size.w) + '×' + cmLabel(size.d) +
            ' cm' +
          '</strong>';

        button.addEventListener('click', function(){
          renderSelectedCard(size, 'SELECTED SIZE');
          renderSizeOptions(list, size);

          renderVisual(
            parseFloat(widthInput.value) * 10,
            parseFloat(depthInput.value) * 10,
            size,
            getFormat(),
            getCoverage()
          );
        });

        buttons.appendChild(button);
      });

      options.appendChild(buttons);
      resultsEl.appendChild(options);
    }

    function renderResults(list, selected, tag){
      renderSelectedCard(selected, tag);
      renderSizeOptions(list, selected);
    }

    function findFits(){
      errorEl.textContent = '';
      resultsEl.innerHTML = '';

      var wCm = parseFloat(widthInput.value);
      var dCm = parseFloat(depthInput.value);
      var format = getFormat();
      var coverage = getCoverage();

      // FPS and Glass are mouse-pad-only formats.
      if(format === 'fps' || format === 'glass'){
        coverage = 'mousepad';
        coverageSelect.value = 'mousepad';
      }

      // Only show the Fit Finder result once the usable space is
      // wider than 70cm and deeper than 30cm.
      if(!wCm || !dCm || wCm <= 70 || dCm <= 30){
        resultsEl.innerHTML = '';
        errorEl.textContent = '';
        matEl.style.display = 'none';
        keyboardEl.style.display = 'none';
        mouseEl.style.display = 'none';
        if(monitorEl) monitorEl.style.display = 'none';
        captionEl.textContent =
          'Enter a usable width above 70cm and depth above 30cm to see the fitting size.';
        return;
      }

      if(wCm > 250 || dCm > 100){
        errorEl.textContent =
          'Max usable size is 250cm wide × 100cm deep. Please enter a smaller size.';

        resultsEl.innerHTML = '';
        matEl.style.display = 'none';
        keyboardEl.style.display = 'none';
        mouseEl.style.display = 'none';

        captionEl.textContent =
          'Enter a usable width above 70cm and depth above 30cm to see the fitting size.';

        return;
      }

      var wMm = wCm * 10;
      var dMm = dCm * 10;

      var clear =
        CLEARANCE[coverage] || CLEARANCE.deskmat;

      var pool = SIZES.filter(function(s){
  if(s.format !== format) return false;

  // 45×40 and 30×25 are for Mouse pad only.
  if(format === 'regular' && coverage === 'deskmat'){
    if(
      (s.w === 450 && s.d === 400) ||
      (s.w === 300 && s.d === 250)
    ){
      return false;
    }
  }

  return true;
});
      if(format === 'regular' && coverage === 'mousepad'){
        pool = pool.filter(function(s){
          return (
            (s.w === 450 && s.d === 400) ||
            (s.w === 300 && s.d === 250)
          );
        });
        
      }
      

      // First find sizes that physically fit.
      var fitting = pool.filter(function(s){
        return s.w <= wMm && s.d <= dMm;
      });

      if(!fitting.length){
        resultsEl.innerHTML =
          '<p class="small-note">No listed ' +
          (format === 'fps'
            ? 'FPS'
            : format === 'glass'
              ? 'Glass'
              : 'Regular') +
          ' size fits that usable space yet. ' +
          '<a href="https://t.me/Key_Cam" target="_blank" rel="noopener">' +
          'Ask on Telegram</a> about a custom size.</p>';

        renderVisual(
          wMm,
          dMm,
          null,
          format,
          coverage
        );

        return;
      }

      // Lower score = closer proportional match to the usable desk area.
      function scoreSize(s){
        var remainingW = (wMm - s.w) / wMm;
        var remainingD = (dMm - s.d) / dMm;

        return (
          remainingW * remainingW +
          remainingD * remainingD
        );
      }

      // Prefer sizes that have the requested clearance.
      var comfortable = fitting.filter(function(s){
        return (
          s.w <= (wMm - clear.w) &&
          s.d <= (dMm - clear.d)
        );
      });

      var list;

      if(comfortable.length){
        list = comfortable;
      } else {
        list = fitting;

        errorEl.textContent =
          'The recommended size fits tightly with little clearance around the mat.';
      }

      list.sort(function(a, b){
        return scoreSize(a) - scoreSize(b);
      });

      renderResults(
        list,
        list[0],
        'BEST FIT'
      );

      renderVisual(
        wMm,
        dMm,
        list[0],
        format,
        coverage
      );
    }

    // Keep the old "mouse pad vs desk mat" choice, while making it
    // work together with the new product-format choice.
    function autoFindFits(){
      syncCoverageForFormat();
      findFits();
    }

    if(typeSelect){
      typeSelect.addEventListener('change', autoFindFits);
    }

    if(coverageSelect){
      coverageSelect.addEventListener('change', autoFindFits);
    }

    syncCoverageForFormat();

    // Keep the button as an optional manual refresh.
    wireDeskTextureSwitch();
    findBtn.addEventListener('click', findFits);

    // Recalculate automatically whenever the user changes desk dimensions.
    [widthInput, depthInput].forEach(function(el){
      el.addEventListener('input', autoFindFits);
      el.addEventListener('change', autoFindFits);
      el.addEventListener('keydown', function(e){
        if(e.key === 'Enter') findFits();
      });
    });
  })();
