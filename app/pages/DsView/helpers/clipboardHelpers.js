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
      
      // Process code blocks - match the full <pre> structure and rebuild with proper formatting
      // Original structure: <pre class="code-badge-pre"><div class="code-badge">...<div class="code-badge-language">LANG</div>...<copy icon>...</div><code class="hljs">CODE</code></pre>
      html = html.replace(/<pre class="code-badge-pre">\s*<div class="code-badge">[\s\S]*?<div class="code-badge-language"\s*>(.*?)<\/div>[\s\S]*?<\/div>\s*(<code[^>]*>[\s\S]*?<\/code>)\s*<\/pre>/gi, 
        function(match, lang, codeBlock) {
          // Keep the entire code block with its tags and content to preserve formatting
          // Use display:inline-block to fit content width, white-space:pre to preserve formatting
          return '<div style="display: inline-block; border: 2px solid #999; border-radius: 4px; padding: 12px; margin: 8px 0; background: #fdf6e3;">' +
                 '<pre style="margin: 0; padding: 0; font-family: \'Courier New\', monospace; font-size: 12px; white-space: pre; background: transparent; color: #657b83;">' +
                 codeBlock +
                 '</pre></div>';
        });
      
      // Style the code tag to ensure proper display
      html = html.replace(/<code class="hljs">/gi, '<code class="hljs" style="display: block; padding: 0; background: transparent; color: #657b83; font-family: inherit; font-size: inherit; white-space: pre;">');
      
      // Apply colors to syntax highlighting classes
      // Solarized Green - keywords
      html = html.replace(/<span class="hljs-keyword">/gi, '<span class="hljs-keyword" style="color: #859900;">');
      html = html.replace(/<span class="hljs-selector-tag">/gi, '<span class="hljs-selector-tag" style="color: #859900;">');
      html = html.replace(/<span class="hljs-addition">/gi, '<span class="hljs-addition" style="color: #859900;">');
      
      // Solarized Cyan - strings, numbers
      html = html.replace(/<span class="hljs-number">/gi, '<span class="hljs-number" style="color: #2aa198;">');
      html = html.replace(/<span class="hljs-string">/gi, '<span class="hljs-string" style="color: #2aa198;">');
      html = html.replace(/<span class="hljs-literal">/gi, '<span class="hljs-literal" style="color: #2aa198;">');
      html = html.replace(/<span class="hljs-doctag">/gi, '<span class="hljs-doctag" style="color: #2aa198;">');
      html = html.replace(/<span class="hljs-regexp">/gi, '<span class="hljs-regexp" style="color: #2aa198;">');
      
      // Solarized Blue - titles, names
      html = html.replace(/<span class="hljs-title">/gi, '<span class="hljs-title" style="color: #268bd2;">');
      html = html.replace(/<span class="hljs-section">/gi, '<span class="hljs-section" style="color: #268bd2;">');
      html = html.replace(/<span class="hljs-name">/gi, '<span class="hljs-name" style="color: #268bd2;">');
      html = html.replace(/<span class="hljs-selector-id">/gi, '<span class="hljs-selector-id" style="color: #268bd2;">');
      html = html.replace(/<span class="hljs-selector-class">/gi, '<span class="hljs-selector-class" style="color: #268bd2;">');
      
      // Solarized Yellow - attributes, variables
      html = html.replace(/<span class="hljs-attribute">/gi, '<span class="hljs-attribute" style="color: #b58900;">');
      html = html.replace(/<span class="hljs-attr">/gi, '<span class="hljs-attr" style="color: #b58900;">');
      html = html.replace(/<span class="hljs-variable">/gi, '<span class="hljs-variable" style="color: #b58900;">');
      html = html.replace(/<span class="hljs-template-variable">/gi, '<span class="hljs-template-variable" style="color: #b58900;">');
      html = html.replace(/<span class="hljs-type">/gi, '<span class="hljs-type" style="color: #b58900;">');
      
      // Solarized Orange - symbols, meta
      html = html.replace(/<span class="hljs-symbol">/gi, '<span class="hljs-symbol" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-bullet">/gi, '<span class="hljs-bullet" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-subst">/gi, '<span class="hljs-subst" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-meta">/gi, '<span class="hljs-meta" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-selector-attr">/gi, '<span class="hljs-selector-attr" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-selector-pseudo">/gi, '<span class="hljs-selector-pseudo" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-link">/gi, '<span class="hljs-link" style="color: #cb4b16;">');
      
      // Solarized Red - built-ins
      html = html.replace(/<span class="hljs-built_in">/gi, '<span class="hljs-built_in" style="color: #dc322f;">');
      html = html.replace(/<span class="hljs-deletion">/gi, '<span class="hljs-deletion" style="color: #dc322f;">');
      
      // Solarized Gray - comments
      html = html.replace(/<span class="hljs-comment">/gi, '<span class="hljs-comment" style="color: #93a1a1;">');
      html = html.replace(/<span class="hljs-quote">/gi, '<span class="hljs-quote" style="color: #93a1a1;">');
      
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

  // Helper function to convert a Plotly graph (with multiple SVG layers) to a single PNG
  async function convertPlotlyGraphToPng(plotlyDiv, forcedWidth = null, forcedHeight = null) {
    try {
      // Get all SVGs within the plotly graph, but exclude the mode bar and logo
      const allSvgs = plotlyDiv.querySelectorAll('svg');
      const svgs = Array.from(allSvgs).filter(svg => {
        // Exclude SVGs that are part of the mode bar (Plotly toolbar) or logo
        const parent = svg.closest('.modebar, .modebar-container, .modebar-group');
        if (parent) return false;
        
        // Also exclude if the SVG itself has classes indicating it's a logo or icon
        const svgClass = svg.getAttribute('class') || '';
        if (svgClass.includes('modebar') || svgClass.includes('logo')) return false;
        
        // Check if it's a very small SVG (likely an icon)
        const svgWidth = parseInt(svg.getAttribute('width')) || 0;
        const svgHeight = parseInt(svg.getAttribute('height')) || 0;
        if (svgWidth > 0 && svgHeight > 0 && svgWidth < 50 && svgHeight < 50) {
          console.log(`[convertPlotlyGraphToPng] Excluding small SVG (${svgWidth}x${svgHeight}) - likely a logo/icon`);
          return false;
        }
        
        return true;
      });
      
      if (svgs.length === 0) return null;
      
      console.log(`[convertPlotlyGraphToPng] Found ${allSvgs.length} total SVGs, ${svgs.length} after excluding mode bar/logo`);
      
      // Get dimensions - use forced dimensions if provided, otherwise get from main SVG
      let width, height;
      if (forcedWidth && forcedHeight) {
        width = forcedWidth;
        height = forcedHeight;
      } else {
        // Get the actual SVG dimensions, not the visible bounding box
        const mainSvg = svgs[0];
        
        // Try to get from viewBox first (most accurate for full graph)
        const viewBox = mainSvg.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.split(/\s+/);
          if (parts.length === 4) {
            width = Math.ceil(parseFloat(parts[2]));
            height = Math.ceil(parseFloat(parts[3]));
            console.log(`[convertPlotlyGraphToPng] Using viewBox dimensions: ${width}x${height}`);
          }
        }
        
        // If no viewBox or invalid, try width/height attributes
        if (!width || !height) {
          const svgWidth = mainSvg.getAttribute('width');
          const svgHeight = mainSvg.getAttribute('height');
          if (svgWidth && svgHeight) {
            width = Math.ceil(parseFloat(svgWidth));
            height = Math.ceil(parseFloat(svgHeight));
            console.log(`[convertPlotlyGraphToPng] Using SVG attributes: ${width}x${height}`);
          }
        }
        
        // Last resort: use bounding box (but this may be clipped)
        if (!width || !height) {
          const bbox = mainSvg.getBoundingClientRect();
          width = Math.ceil(bbox.width) || 800;
          height = Math.ceil(bbox.height) || 600;
          console.log(`[convertPlotlyGraphToPng] Using bounding box (may be clipped): ${width}x${height}`);
        }
      }
      
      console.log(`[convertPlotlyGraphToPng] Converting plotly graph with ${svgs.length} SVG layers to ${width}x${height} PNG`);
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      
      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      
      // Draw each SVG layer on top of each other
      for (let i = 0; i < svgs.length; i++) {
        const svg = svgs[i];
        
        // Clone and prepare SVG for conversion
        const svgClone = svg.cloneNode(true);
        svgClone.removeAttribute('style');
        svgClone.setAttribute('width', width);
        svgClone.setAttribute('height', height);
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        // Serialize the SVG
        const svgString = new XMLSerializer().serializeToString(svgClone);
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
        
        // Draw this layer onto the canvas
        ctx.drawImage(img, 0, 0, width, height);
      }
      
      // Convert canvas to PNG data URL
      const pngDataUrl = canvas.toDataURL('image/png', 1.0);
      
      // Create replacement img element
      const replacementImg = document.createElement('img');
      replacementImg.src = pngDataUrl;
      replacementImg.width = width;
      replacementImg.height = height;
      
      return replacementImg;
    } catch (err) {
      console.error('[convertPlotlyGraphToPng] Failed to convert Plotly graph:', err);
      return null;
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
      
      // Clone the cell content first
      const wrapper = document.createElement('div');
      wrapper.innerHTML = cellElement.innerHTML;
      
      // Handle Plotly graphs (multiple SVG layers) as single images
      const plotlyGraphs = wrapper.querySelectorAll('.plotly-graph');
      for (const plotlyDiv of plotlyGraphs) {
        const pngImg = await convertPlotlyGraphToPng(plotlyDiv);
        if (pngImg) {
          // Replace the entire plotly-graph div with the single image
          plotlyDiv.parentNode.replaceChild(pngImg, plotlyDiv);
        }
      }
      
      // Handle standalone SVG elements (not part of Plotly graphs)
      const svgs = wrapper.querySelectorAll('svg');
      for (const svg of svgs) {
        const replacementImg = await convertSvgToPng(svg);
        svg.parentNode.replaceChild(replacementImg, svg);
      }
      
      // Get the modified HTML
      let html = wrapper.innerHTML;
      
      // Process code blocks - match the full <pre> structure and rebuild with proper formatting
      // Original structure: <pre class="code-badge-pre"><div class="code-badge">...<div class="code-badge-language">LANG</div>...<copy icon>...</div><code class="hljs">CODE</code></pre>
      html = html.replace(/<pre class="code-badge-pre">\s*<div class="code-badge">[\s\S]*?<div class="code-badge-language"\s*>(.*?)<\/div>[\s\S]*?<\/div>\s*(<code[^>]*>[\s\S]*?<\/code>)\s*<\/pre>/gi, 
        function(match, lang, codeBlock) {
          // Keep the entire code block with its tags and content to preserve formatting
          // Use display:inline-block to fit content width, white-space:pre to preserve formatting
          return '<div style="display: inline-block; border: 2px solid #999; border-radius: 4px; padding: 12px; margin: 8px 0; background: #fdf6e3;">' +
                 '<pre style="margin: 0; padding: 0; font-family: \'Courier New\', monospace; font-size: 12px; white-space: pre; background: transparent; color: #657b83;">' +
                 codeBlock +
                 '</pre></div>';
        });
      
      // Style the code tag to ensure proper display
      html = html.replace(/<code class="hljs">/gi, '<code class="hljs" style="display: block; padding: 0; background: transparent; color: #657b83; font-family: inherit; font-size: inherit; white-space: pre;">');
      
      // Apply colors to syntax highlighting classes
      // Solarized Green - keywords
      html = html.replace(/<span class="hljs-keyword">/gi, '<span class="hljs-keyword" style="color: #859900;">');
      html = html.replace(/<span class="hljs-selector-tag">/gi, '<span class="hljs-selector-tag" style="color: #859900;">');
      html = html.replace(/<span class="hljs-addition">/gi, '<span class="hljs-addition" style="color: #859900;">');
      
      // Solarized Cyan - strings, numbers
      html = html.replace(/<span class="hljs-number">/gi, '<span class="hljs-number" style="color: #2aa198;">');
      html = html.replace(/<span class="hljs-string">/gi, '<span class="hljs-string" style="color: #2aa198;">');
      html = html.replace(/<span class="hljs-literal">/gi, '<span class="hljs-literal" style="color: #2aa198;">');
      html = html.replace(/<span class="hljs-doctag">/gi, '<span class="hljs-doctag" style="color: #2aa198;">');
      html = html.replace(/<span class="hljs-regexp">/gi, '<span class="hljs-regexp" style="color: #2aa198;">');
      
      // Solarized Blue - titles, names
      html = html.replace(/<span class="hljs-title">/gi, '<span class="hljs-title" style="color: #268bd2;">');
      html = html.replace(/<span class="hljs-section">/gi, '<span class="hljs-section" style="color: #268bd2;">');
      html = html.replace(/<span class="hljs-name">/gi, '<span class="hljs-name" style="color: #268bd2;">');
      html = html.replace(/<span class="hljs-selector-id">/gi, '<span class="hljs-selector-id" style="color: #268bd2;">');
      html = html.replace(/<span class="hljs-selector-class">/gi, '<span class="hljs-selector-class" style="color: #268bd2;">');
      
      // Solarized Yellow - attributes, variables
      html = html.replace(/<span class="hljs-attribute">/gi, '<span class="hljs-attribute" style="color: #b58900;">');
      html = html.replace(/<span class="hljs-attr">/gi, '<span class="hljs-attr" style="color: #b58900;">');
      html = html.replace(/<span class="hljs-variable">/gi, '<span class="hljs-variable" style="color: #b58900;">');
      html = html.replace(/<span class="hljs-template-variable">/gi, '<span class="hljs-template-variable" style="color: #b58900;">');
      html = html.replace(/<span class="hljs-type">/gi, '<span class="hljs-type" style="color: #b58900;">');
      
      // Solarized Orange - symbols, meta
      html = html.replace(/<span class="hljs-symbol">/gi, '<span class="hljs-symbol" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-bullet">/gi, '<span class="hljs-bullet" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-subst">/gi, '<span class="hljs-subst" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-meta">/gi, '<span class="hljs-meta" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-selector-attr">/gi, '<span class="hljs-selector-attr" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-selector-pseudo">/gi, '<span class="hljs-selector-pseudo" style="color: #cb4b16;">');
      html = html.replace(/<span class="hljs-link">/gi, '<span class="hljs-link" style="color: #cb4b16;">');
      
      // Solarized Red - built-ins
      html = html.replace(/<span class="hljs-built_in">/gi, '<span class="hljs-built_in" style="color: #dc322f;">');
      html = html.replace(/<span class="hljs-deletion">/gi, '<span class="hljs-deletion" style="color: #dc322f;">');
      
      // Solarized Gray - comments
      html = html.replace(/<span class="hljs-comment">/gi, '<span class="hljs-comment" style="color: #93a1a1;">');
      html = html.replace(/<span class="hljs-quote">/gi, '<span class="hljs-quote" style="color: #93a1a1;">');
      
      // Wrap with white background for overall consistency, but preserve code block colors
      html = `<div style="font-family:verdana; font-size:12px; background-color: white">${html}</div>`;
      
      // Try to copy formatted HTML
      const ok = copyFormatted(null, html);
      if (!ok) {
        // Fallback to plain text
        const text = cell.getValue ? String(cell.getValue()) : '';
        copyTextToClipboard(text);
      }
      
      // Show success notification
      showCopiedNotification(true);
      return true;
    } catch (err) {
      console.error('[copyCellToClipboard] Error:', err);
      showCopiedNotification(false);
      return false;
    }
  }

  async function myCopyToClipboard(ref) {
    // Reference: clipboardHelpers.js lines 147-152
    
    // Step 1: Get actual dimensions from rendered cells BEFORE export
    const svgDimensions = new Map();
    const plotlyDimensions = new Map();
    try {
      const rows = ref.table.getRows();
      for (const row of rows) {
        const cells = row.getCells();
        for (const cell of cells) {
          const cellElement = cell.getElement();
          if (!cellElement) continue;
          
          // Collect Plotly graph dimensions
          const plotlyGraphs = cellElement.querySelectorAll('.plotly-graph');
          for (const plotlyDiv of plotlyGraphs) {
            const id = plotlyDiv.getAttribute('id');
            if (id) {
              // Get full dimensions from the SVG, not just visible bounding box
              const mainSvg = plotlyDiv.querySelector('svg');
              if (mainSvg) {
                let width, height;
                
                // Try viewBox first (most accurate)
                const viewBox = mainSvg.getAttribute('viewBox');
                if (viewBox) {
                  const parts = viewBox.split(/\s+/);
                  if (parts.length === 4) {
                    width = Math.ceil(parseFloat(parts[2]));
                    height = Math.ceil(parseFloat(parts[3]));
                  }
                }
                
                // Try width/height attributes
                if (!width || !height) {
                  const svgWidth = mainSvg.getAttribute('width');
                  const svgHeight = mainSvg.getAttribute('height');
                  if (svgWidth && svgHeight) {
                    width = Math.ceil(parseFloat(svgWidth));
                    height = Math.ceil(parseFloat(svgHeight));
                  }
                }
                
                // Last resort: bounding box
                if (!width || !height) {
                  const bbox = plotlyDiv.getBoundingClientRect();
                  if (bbox.width > 0 && bbox.height > 0) {
                    width = Math.ceil(bbox.width);
                    height = Math.ceil(bbox.height);
                  }
                }
                
                if (width && height) {
                  plotlyDimensions.set(id, { width, height });
                }
              }
            }
          }
          
          // Collect standalone SVG dimensions
          const svgs = cellElement.querySelectorAll('svg');
          for (const svg of svgs) {
            // Skip SVGs that are inside plotly graphs (they'll be handled as a group)
            if (svg.closest('.plotly-graph')) continue;
            
            const id = svg.getAttribute('id');
            if (id) {
              let width, height;
              
              // Try viewBox first
              const viewBox = svg.getAttribute('viewBox');
              if (viewBox) {
                const parts = viewBox.split(/\s+/);
                if (parts.length === 4) {
                  width = Math.ceil(parseFloat(parts[2]));
                  height = Math.ceil(parseFloat(parts[3]));
                }
              }
              
              // Try width/height attributes
              if (!width || !height) {
                const svgWidth = svg.getAttribute('width');
                const svgHeight = svg.getAttribute('height');
                if (svgWidth && svgHeight) {
                  width = Math.ceil(parseFloat(svgWidth));
                  height = Math.ceil(parseFloat(svgHeight));
                }
              }
              
              // Last resort: bounding box
              if (!width || !height) {
                const bbox = svg.getBoundingClientRect();
                if (bbox.width > 0 && bbox.height > 0) {
                  width = Math.ceil(bbox.width);
                  height = Math.ceil(bbox.height);
                }
              }
              
              if (width && height) {
                svgDimensions.set(id, { width, height });
              }
            }
          }
        }
      }
      console.log(`[myCopyToClipboard] Collected dimensions for ${plotlyDimensions.size} Plotly graphs and ${svgDimensions.size} standalone SVGs from live cells`);
    } catch (err) {
      console.error('[myCopyToClipboard] Error collecting dimensions:', err);
    }
    
    // Step 2: Use Tabulator export module to generate HTML
    let visible = "all";
    let style = true;
    let colVisProp = "clipboard";
    let config = null;
    let html = ref.table.modules.export.getHtml(visible, style, config, colVisProp);
    
    // Step 3: Post-process HTML to convert graphs to PNGs
    try {
      // Parse the HTML to find graphs
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // First, handle Plotly graphs (multiple SVG layers) as single images
      const plotlyGraphs = tempDiv.querySelectorAll('.plotly-graph');
      if (plotlyGraphs.length > 0) {
        console.log(`[myCopyToClipboard] Found ${plotlyGraphs.length} Plotly graphs to convert`);
        
        for (let i = 0; i < plotlyGraphs.length; i++) {
          const plotlyDiv = plotlyGraphs[i];
          try {
            const plotlyId = plotlyDiv.getAttribute('id');
            
            // Use collected dimensions if available
            let width = null, height = null;
            if (plotlyId && plotlyDimensions.has(plotlyId)) {
              const dims = plotlyDimensions.get(plotlyId);
              width = dims.width;
              height = dims.height;
              console.log(`[myCopyToClipboard] Plotly graph ${i+1} (${plotlyId}): Using live dimensions ${width}x${height}`);
            } else {
              console.log(`[myCopyToClipboard] Plotly graph ${i+1}: No live dimensions, will use SVG dimensions`);
            }
            
            const pngImg = await convertPlotlyGraphToPng(plotlyDiv, width, height);
            if (pngImg) {
              console.log(`[myCopyToClipboard] Plotly graph ${i+1} converted to PNG: ${pngImg.width}x${pngImg.height}`);
              plotlyDiv.parentNode.replaceChild(pngImg, plotlyDiv);
            }
          } catch (err) {
            console.error('[myCopyToClipboard] Failed to convert Plotly graph:', err);
          }
        }
      }
      
      // Then, handle standalone SVGs (not part of already-processed Plotly graphs)
      const svgs = tempDiv.querySelectorAll('svg');
      if (svgs.length > 0) {
        console.log(`[myCopyToClipboard] Found ${svgs.length} standalone SVGs to convert`);
        
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
      // Get all images and their displayed sizes
      // imgList[i].width gives us the rendered width as seen on screen (accounting for zoom)
      // This is exactly what we want to preserve in the clipboard
      const imgList = document.querySelectorAll("img");
      const imgSizes = {};
      for (let i = 0; i < imgList.length; i++) {
        const img = {};
        img.src = imgList[i].getAttribute("src");
        // Use the displayed dimensions directly - this is what the user sees
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

