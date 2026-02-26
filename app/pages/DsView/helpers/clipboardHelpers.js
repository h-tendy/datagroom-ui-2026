export default function createClipboardHelpers(context) {
  const {
    tabulatorRef,
    // UI setters from DsViewPage
    setShowNotification,
    setNotificationMessage,
    setNotificationType,
    setModalTitle,
    setModalQuestion,
    setShowModal,
  } = context;

  // Cache for SVG to PNG conversions (used during table export)
  let svgToPngCache = new Map();

  function showCopiedNotification(isSuccess, message) {
    try {
      if (isSuccess) {
        if (setNotificationType) setNotificationType('success');
        if (setNotificationMessage) setNotificationMessage(message || 'Copied to clipboard');
        if (setShowNotification) setShowNotification(true);
      } else {
        if (setNotificationType) setNotificationType('error');
        if (setNotificationMessage) setNotificationMessage(message || 'Copy failed');
        if (setShowNotification) setShowNotification(true);
      }
      // Auto-hide after 2s
      setTimeout(() => {
        try { if (setShowNotification) setShowNotification(false); } catch (e) {}
      }, 2000);
    } catch (e) {
      // ignore
    }
  }

  function copyTextToClipboard(text) {
    if (!text && text !== '') return false;
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        showCopiedNotification(true);
        return true;
      }
    } catch (e) {
      // fall through to fallback
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      showCopiedNotification(!!ok);
      return !!ok;
    } catch (e) {
      showCopiedNotification(false);
      return false;
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function copyFormatted(element, html) {
    // Reference: clipboardHelpers.js lines 92-126
    try {
      const container = document.createElement('div');
      if (element && element.innerHTML) html = element.innerHTML;
      
      // Fix image sizes before setting innerHTML
      html = fixImgSizeForClipboard(html);
      
      // Remove highlightjs badge wrapper and set white background for code blocks
      html = html.replace(/<pre class="code-badge-pre"[\s\S]*?(<code [\s\S]*?<\/code>)<\/pre>/gi, '<pre>$1</pre>');
      html = html.replace(/<code class="hljs">/gi, '<code class="hljs" style="background-color:white; font-size:12px">');
      
      container.innerHTML = html || '';
      
      // Hide element
      container.style.position = 'fixed';
      container.style.pointerEvents = 'none';
      container.style.opacity = '0';
      
      // Detect all style sheets of the page
      const activeSheets = Array.prototype.slice.call(document.styleSheets)
        .filter(function (sheet) { return !sheet.disabled; });
      
      // Mount the container to the DOM to make `contentWindow` available
      document.body.appendChild(container);
      
      // Copy to clipboard
      window.getSelection().removeAllRanges();
      const range = document.createRange();
      range.selectNode(container);
      window.getSelection().addRange(range);
      document.execCommand('copy');
      
      // Temporarily disable non-static stylesheets so copied HTML keeps desired look
      for (let i = 0; i < activeSheets.length; i++) {
        if (!/static\/css/.test(activeSheets[i].href))
          activeSheets[i].disabled = true;
      }
      document.execCommand('copy');
      
      // Re-enable stylesheets we disabled earlier
      for (let i = 0; i < activeSheets.length; i++) {
        if (!/static\/css/.test(activeSheets[i].href))
          activeSheets[i].disabled = false;
      }
      
      document.body.removeChild(container);
      showCopiedNotification(true);
      return true;
    } catch (e) {
      console.error('copyFormatted error:', e);
      showCopiedNotification(false);
      return false;
    }
  }

  // Helper function to convert a single SVG element to PNG img element
  async function convertSvgToPng(svg) {
    try {
      // Get SVG dimensions - prioritize attributes over bounding box for detached elements
      let width, height;
      
      // First try to get from SVG attributes
      const svgWidth = svg.getAttribute('width');
      const svgHeight = svg.getAttribute('height');
      
      if (svgWidth && svgHeight) {
        width = Math.ceil(parseFloat(svgWidth));
        height = Math.ceil(parseFloat(svgHeight));
      } else {
        // Try viewBox if attributes aren't set
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.split(/\s+/);
          if (parts.length === 4) {
            width = Math.ceil(parseFloat(parts[2]));
            height = Math.ceil(parseFloat(parts[3]));
          }
        }
      }
      
      // Fall back to bounding box only if SVG is in the DOM
      if (!width || !height) {
        const bbox = svg.getBoundingClientRect();
        if (bbox.width > 0 && bbox.height > 0) {
          width = Math.ceil(bbox.width);
          height = Math.ceil(bbox.height);
        }
      }
      
      // Final fallback
      if (!width || !height) {
        width = 800;
        height = 600;
      }
      
      // Log the dimensions being used
      console.log(`[convertSvgToPng] Converting SVG to ${width}x${height}`);
      
      // Create a copy of the SVG and ensure it has proper attributes
      const svgClone = svg.cloneNode(true);
      
      // Remove any style constraints that might affect rendering
      svgClone.removeAttribute('style');
      
      svgClone.setAttribute('width', width);
      svgClone.setAttribute('height', height);
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      
      // Serialize the SVG
      const svgString = new XMLSerializer().serializeToString(svgClone);
      
      // Create data URL from SVG
      const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      
      // Load SVG as image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Image load timeout')), 5000);
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.onerror = (err) => {
          clearTimeout(timeout);
          reject(new Error('Image failed to load'));
        };
        img.src = svgDataUrl;
      });
      
      // Create canvas and draw the image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      
      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      
      // Draw the SVG image onto canvas
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert canvas to PNG data URL
      const pngDataUrl = canvas.toDataURL('image/png', 1.0);
      
      // Create replacement img element
      const replacementImg = document.createElement('img');
      replacementImg.src = pngDataUrl;
      replacementImg.width = width;
      replacementImg.height = height;
      
      return replacementImg;
    } catch (err) {
      console.error('[convertSvgToPng] Failed to convert SVG to PNG:', err);
      return svg.cloneNode(true); // Return cloned SVG on failure
    }
  }

  async function copyCellToClipboard(e, cell) {
    try {
      if (!cell) return false;
      const cellElement = cell.getElement ? cell.getElement() : null;
      if (!cellElement) return false;
      
      // Find all SVG elements and convert them to PNG images
      const svgs = cellElement.querySelectorAll('svg');
      const replacements = [];
      
      for (let i = 0; i < svgs.length; i++) {
        const svg = svgs[i];
        const replacementImg = await convertSvgToPng(svg);
        replacements.push({ svg, replacement: replacementImg });
      }
      
      // Get the HTML content
      let html = cellElement.innerHTML;
      
      // Clone the cell content
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      
      // Replace SVGs with PNG images in the clone
      const clonedSvgs = wrapper.querySelectorAll('svg');
      for (let i = 0; i < replacements.length && i < clonedSvgs.length; i++) {
        clonedSvgs[i].parentNode.replaceChild(replacements[i].replacement.cloneNode(true), clonedSvgs[i]);
      }
      
      // Get the modified HTML
      html = wrapper.innerHTML;
      
      // Reference: clipboardHelpers.js lines 96-97
      // Remove highlightjs badge wrapper and set white background for code blocks
      html = html.replace(/<pre class="code-badge-pre"[\s\S]*?(<code [\s\S]*?<\/code>)<\/pre>/gi, '<pre>$1</pre>');
      html = html.replace(/<code class="hljs">/gi, '<code class="hljs" style="background-color:white; font-size:12px">');
      // Also set white background on pre tags to remove theme colors
      html = html.replace(/<pre>/gi, '<pre style="background-color:white">');
      html = html.replace(/<pre /gi, '<pre style="background-color:white" ');
      
      // Reference: clipboardHelpers.js lines 153-156
      // Wrap with white background to remove theme colors, but preserve specific element colors
      html = `<div style="font-family:verdana; font-size:12px; background-color: white">${html}</div>`;
      
      // Try to copy formatted HTML
      const ok = copyFormatted(null, html);
      if (!ok) {
        // Fallback to plain text
        const text = cell.getValue ? String(cell.getValue()) : '';
        copyTextToClipboard(text);
      }
      return true;
    } catch (err) {
      showCopiedNotification(false);
      return false;
    }
  }

  async function myCopyToClipboard(ref) {
    // Reference: clipboardHelpers.js lines 147-152
    
    // Step 1: Get actual SVG dimensions from rendered cells BEFORE export
    const svgDimensions = new Map();
    try {
      const rows = ref.table.getRows();
      for (const row of rows) {
        const cells = row.getCells();
        for (const cell of cells) {
          const cellElement = cell.getElement();
          if (!cellElement) continue;
          
          const svgs = cellElement.querySelectorAll('svg');
          for (const svg of svgs) {
            const id = svg.getAttribute('id');
            if (id) {
              const bbox = svg.getBoundingClientRect();
              if (bbox.width > 0 && bbox.height > 0) {
                svgDimensions.set(id, {
                  width: Math.ceil(bbox.width),
                  height: Math.ceil(bbox.height)
                });
              }
            }
          }
        }
      }
      console.log(`[myCopyToClipboard] Collected dimensions for ${svgDimensions.size} SVGs from live cells`);
    } catch (err) {
      console.error('[myCopyToClipboard] Error collecting SVG dimensions:', err);
    }
    
    // Step 2: Use Tabulator export module to generate HTML
    let visible = "all";
    let style = true;
    let colVisProp = "clipboard";
    let config = null;
    let html = ref.table.modules.export.getHtml(visible, style, config, colVisProp);
    
    // Step 3: Post-process HTML to convert SVGs to PNGs using collected dimensions
    try {
      // Parse the HTML to find all SVGs
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      const svgs = tempDiv.querySelectorAll('svg');
      if (svgs.length > 0) {
        console.log(`[myCopyToClipboard] Found ${svgs.length} SVGs to convert`);
        
        // Convert all SVGs to PNGs
        for (let i = 0; i < svgs.length; i++) {
          const svg = svgs[i];
          try {
            const svgId = svg.getAttribute('id');
            
            // If we have dimensions from the live cell, use those
            if (svgId && svgDimensions.has(svgId)) {
              const dims = svgDimensions.get(svgId);
              svg.setAttribute('width', dims.width);
              svg.setAttribute('height', dims.height);
              console.log(`[myCopyToClipboard] SVG ${i+1} (${svgId}): Using live dimensions ${dims.width}x${dims.height}`);
            } else {
              const w = svg.getAttribute('width');
              const h = svg.getAttribute('height');
              console.log(`[myCopyToClipboard] SVG ${i+1}: No live dimensions, using attributes ${w}x${h}`);
            }
            
            const pngImg = await convertSvgToPng(svg);
            console.log(`[myCopyToClipboard] SVG ${i+1} converted to PNG: ${pngImg.width}x${pngImg.height}`);
            svg.replaceWith(pngImg);
          } catch (err) {
            console.error('[myCopyToClipboard] Failed to convert SVG:', err);
            // Leave the SVG as-is if conversion fails
          }
        }
        
        // Update html with converted content
        html = tempDiv.innerHTML;
      }
    } catch (err) {
      console.error('[myCopyToClipboard] Error post-processing SVGs:', err);
      // Continue with original HTML if post-processing fails
    }
    
    copyFormatted(null, html);
  }

  function copyToClipboard(ref) {
    return myCopyToClipboard(ref);
  }

  function fixImgSizeForClipboard(html) {
    // Reference: clipboardHelpers.js lines 60-89
    try {
      const imgList = document.querySelectorAll("img");
      const imgSizes = {};
      for (let i = 0; i < imgList.length; i++) {
        const img = {};
        img.src = imgList[i].getAttribute("src");
        img.width = imgList[i].width;
        img.height = imgList[i].height;
        imgSizes[img.src] = img;
      }
      const e = [...html.matchAll(/<img src="(.*?)"/gi)];
      for (let i = 0; i < e.length; i++) {
        const key = e[i][1];
        if (!imgSizes[key]) continue;
        if (/data:image/.test(key)) continue;
        const str = `<img src="${key}" alt="${key}" width=".*" height=".*"`;
        const rep = `<img src="${key}" alt="${key}" width=${imgSizes[key].width} height=${imgSizes[key].height}`;
        html = html.replace(new RegExp(str), rep);
      }
      html = html.replaceAll('<img src="/attachments/', `<img src="${window.location.origin}/attachments/`);
    } catch (e) {
      console.error('fixImgSizeForClipboard error:', e);
    }
    return html;
  }

  return {
    copyTextToClipboard,
    showCopiedNotification,
    fixImgSizeForClipboard,
    copyFormatted,
    copyCellToClipboard,
    myCopyToClipboard,
    copyToClipboard,
  };
}

