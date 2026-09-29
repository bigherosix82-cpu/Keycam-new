(function(){
  // DOM elements
  var sizeSelect = document.getElementById('artworkPrintSize');
  var fileInput = document.getElementById('artworkFile');
  var preview = document.getElementById('artworkPreview');
  var previewImage = document.getElementById('artworkPreviewImage');
  var metrics = document.getElementById('artworkMetrics');
  var dimensionsEl = document.getElementById('artworkDimensions');
  var ppiEl = document.getElementById('artworkPpi');
  var cropEl = document.getElementById('artworkCrop');
  var resultCard = document.getElementById('artworkResultCard');
  var resultEl = document.getElementById('artworkResult');
  var resultNoteEl = document.getElementById('artworkResultNote');

  if(!sizeSelect || !fileInput || !preview || !previewImage) {
    console.error('Artwork checker: Required elements not found');
    return;
  }

  // Size data
  var sizes = {
    '900x400': { w:90, d:40 },
    '1000x500': { w:100, d:50 },
    '800x400': { w:80, d:40 },
    '800x300': { w:80, d:30 },
    '600x300': { w:60, d:30 },
    '450x400': { w:45, d:40 },
    '300x250': { w:30, d:25 },
    '360x320': { w:36, d:32 },
    '490x420': { w:49, d:42 }
  };

  var objectUrl = null;

  function getPrintSize(){
    return sizes[sizeSelect.value] || sizes['900x400'];
  }

  function syncPreviewShape(size){
    preview.style.aspectRatio = size.w + ' / ' + size.d;
  }

  function showMessage(text, type){
    // Remove old message
    var old = document.querySelector('.artwork-status-msg');
    if(old) old.remove();

    var msg = document.createElement('div');
    msg.className = 'artwork-status-msg';
    msg.style.cssText = 'margin-top:9px;padding:10px 12px;border-radius:4px;font-size:12px;line-height:1.4;';
    
    if(type === 'success'){
      msg.style.cssText += 'border:1px solid #4caf50;background:#1a2a1a;color:#a5d6a7;';
      msg.textContent = '✓ ' + text;
    } else if(type === 'error'){
      msg.style.cssText += 'border:1px solid #f44336;background:#2a1a1a;color:#ef9a9a;';
      msg.textContent = '⚠ ' + text;
    } else {
      msg.style.cssText += 'border:1px solid #4a9eff;background:#1a1a2a;color:#b0d4ff;';
      msg.textContent = '⏳ ' + text;
    }

    var uploadBox = fileInput.closest('.artwork-upload');
    if(uploadBox){
      uploadBox.parentNode.insertBefore(msg, uploadBox.nextSibling);
      if(type !== 'loading'){
        setTimeout(function(){
          if(msg.parentNode) msg.remove();
        }, 4000);
      }
    }
  }

  function setResult(level, title, note){
    resultCard.classList.remove('artwork-result-good','artwork-result-warn','artwork-result-low');
    resultCard.classList.add('artwork-result-' + level);
    resultEl.textContent = title;
    resultNoteEl.textContent = note;
  }

  function checkImage(){
    if(!previewImage.naturalWidth || !previewImage.naturalHeight) return;

    var size = getPrintSize();
    var imageW = previewImage.naturalWidth;
    var imageH = previewImage.naturalHeight;
    var imageRatio = imageW / imageH;
    var printRatio = size.w / size.d;
    var ppiW = imageW / (size.w / 2.54);
    var ppiH = imageH / (size.d / 2.54);
    var ppi = Math.min(ppiW, ppiH);
    var crop = imageRatio > printRatio
      ? 1 - (printRatio / imageRatio)
      : 1 - (imageRatio / printRatio);

    dimensionsEl.textContent = imageW + ' × ' + imageH + ' px';
    ppiEl.textContent = Math.round(ppi) + ' PPI';
    cropEl.textContent = Math.round(crop * 100) + '% crop';
    metrics.hidden = false;

    if(ppi >= 150 && crop <= 0.05){
      setResult('good', 'Looks strong', 'Good pixel density with very little shape loss.');
    }else if(ppi >= 100 && crop <= 0.15){
      setResult('good', 'Good for planning', 'The file should work well; still inspect important details.');
    }else if(ppi >= 80 && crop <= 0.25){
      setResult('warn', 'Inspect carefully', 'The file may work, but text, faces, and fine lines deserve a close look.');
    }else{
      setResult('low', 'Needs attention', 'Low effective resolution or significant crop. A better-shaped/larger file is recommended.');
    }

    syncPreviewShape(size);
    showMessage('Image loaded successfully', 'success');
  }

  function loadFile(file){
    if(!file) return false;
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)){
      showMessage('Please use JPG, PNG, or WebP images only', 'error');
      return false;
    }

    if(objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    window.KEYCAM_ARTWORK_PREVIEW = null;
    showMessage('Loading image...', 'loading');

    previewImage.onload = function(){
      previewImage.hidden = false;
      preview.classList.add('has-artwork');
      var empty = preview.querySelector('.artwork-preview-empty');
      if(empty) empty.hidden = true;

      // Share the same local preview URL with Fit Finder. Nothing is uploaded.
      window.KEYCAM_ARTWORK_PREVIEW = objectUrl;
      document.dispatchEvent(new CustomEvent('keycamArtworkChanged', {
        detail: { url: objectUrl }
      }));

      checkImage();
    };

    previewImage.onerror = function(){
      showMessage('Failed to load the image', 'error');
      previewImage.hidden = true;

      window.KEYCAM_ARTWORK_PREVIEW = null;
      document.dispatchEvent(new CustomEvent('keycamArtworkChanged', {
        detail: { url: null }
      }));

      if(objectUrl){
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    previewImage.src = objectUrl;
    return true;
  }

  // File input handler
  fileInput.addEventListener('change', function(e){
    if(this.files && this.files[0]){
      loadFile(this.files[0]);
    }
    this.value = '';
  });

  // Upload button click handler
  var uploadLabel = document.querySelector('.artwork-upload');
  if(uploadLabel){
    uploadLabel.addEventListener('click', function(e){
      // Let the file input handle it
    });
  }

  // ==================== PASTE SUPPORT ====================
  
  // Method 1: Click paste button → try clipboard API
  var pasteBtn = document.createElement('button');
  pasteBtn.type = 'button';
  pasteBtn.textContent = '📋 Paste image';
  pasteBtn.style.cssText = 'width:100%;margin-top:10px;padding:12px;border:1px solid #303b41;background:#11171a;color:#f4f7f8;font:600 14px/1 "Space Grotesk",sans-serif;cursor:pointer;border-radius:4px;transition:all .2s;';
  pasteBtn.onmouseover = function(){ this.style.borderColor = '#4a9eff'; };
  pasteBtn.onmouseout = function(){ this.style.borderColor = '#303b41'; };

  if(uploadLabel){
    uploadLabel.insertAdjacentElement('afterend', pasteBtn);
  }

  pasteBtn.addEventListener('click', function(){
    if(navigator.clipboard && navigator.clipboard.read){
      showMessage('Checking clipboard...', 'loading');
      
      navigator.clipboard.read()
        .then(function(items){
          var found = false;
          for(var i = 0; i < items.length; i++){
            var types = items[i].types || [];
            for(var j = 0; j < types.length; j++){
              if(types[j] && types[j].indexOf('image/') === 0){
                items[i].getType(types[j]).then(function(blob){
                  if(blob){
                    var ext = blob.type === 'image/jpeg' ? 'jpg' : (blob.type === 'image/webp' ? 'webp' : 'png');
                    var file = new File([blob], 'clipboard.' + ext, {type: blob.type});
                    loadFile(file);
                  }
                }).catch(function(err){
                  showMessage('Could not read image from clipboard', 'error');
                });
                found = true;
                break;
              }
            }
            if(found) break;
          }
          if(!found){
            showMessage('No image found in clipboard. Copy an image first.', 'error');
          }
        })
        .catch(function(){
          showMessage('Clipboard access denied. Try Ctrl+V instead.', 'error');
        });
    } else {
      showMessage('Press Ctrl+V / Cmd+V to paste your image', 'loading');
      
      // Focus a hidden input for paste
      var hiddenInput = document.createElement('input');
      hiddenInput.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;opacity:0;';
      document.body.appendChild(hiddenInput);
      hiddenInput.focus();
      
      var cleanup = function(){
        if(hiddenInput.parentNode) hiddenInput.remove();
        document.removeEventListener('paste', pasteHandler);
      };
      
      var pasteHandler = function(e){
        var items = e.clipboardData && e.clipboardData.items;
        if(items){
          for(var i = 0; i < items.length; i++){
            if(items[i].kind === 'file' && items[i].type.indexOf('image/') === 0){
              var file = items[i].getAsFile();
              if(file){
                loadFile(file);
                e.preventDefault();
                cleanup();
                return;
              }
            }
          }
        }
        showMessage('No image found in clipboard', 'error');
        cleanup();
      };
      
      document.addEventListener('paste', pasteHandler);
      
      setTimeout(function(){
        cleanup();
        var msg = document.querySelector('.artwork-status-msg');
        if(msg && msg.textContent.includes('Ctrl+V')){
          msg.remove();
        }
      }, 10000);
    }
  });

  // Method 2: Global Ctrl+V / Cmd+V
  document.addEventListener('paste', function(e){
    var items = e.clipboardData && e.clipboardData.items;
    if(!items) return;
    
    for(var i = 0; i < items.length; i++){
      if(items[i].kind === 'file' && items[i].type.indexOf('image/') === 0){
        var file = items[i].getAsFile();
        if(file){
          loadFile(file);
          e.preventDefault();
          showMessage('Image pasted!', 'success');
          return;
        }
      }
    }
  });

  // ==================== DRAG & DROP ====================
  
  if(uploadLabel){
    uploadLabel.addEventListener('dragover', function(e){
      e.preventDefault();
      e.stopPropagation();
      this.style.borderColor = '#4a9eff';
      this.style.background = '#121a1e';
    });
    
    uploadLabel.addEventListener('dragleave', function(e){
      e.preventDefault();
      e.stopPropagation();
      this.style.borderColor = '';
      this.style.background = '';
    });
    
    uploadLabel.addEventListener('drop', function(e){
      e.preventDefault();
      e.stopPropagation();
      this.style.borderColor = '';
      this.style.background = '';
      
      var files = e.dataTransfer && e.dataTransfer.files;
      if(files && files[0]){
        loadFile(files[0]);
      }
    });
  }

  // ==================== SIZE CHANGE ====================
  
  sizeSelect.addEventListener('change', function(){
    if(previewImage.src && previewImage.naturalWidth){
      checkImage();
    } else {
      syncPreviewShape(getPrintSize());
    }
  });

  // ==================== CLEANUP ====================
  
  window.addEventListener('beforeunload', function(){
    window.KEYCAM_ARTWORK_PREVIEW = null;
    if(objectUrl) URL.revokeObjectURL(objectUrl);
  });

  // Initial sync
  syncPreviewShape(getPrintSize());
  
  console.log('Artwork checker initialized');
})();