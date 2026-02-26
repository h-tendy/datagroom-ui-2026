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

  function copyCellToClipboard(e, cell) {
    try {
      if (!cell) return false;
      const el = cell.getElement ? cell.getElement() : null;
      let html = '';
      if (el && el.innerHTML) {
        html = el.innerHTML;
      } else {
        // fallback to cell value
        const val = cell.getValue ? cell.getValue() : '';
        html = escapeHtml(val);
      }
      
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

  function myCopyToClipboard(ref) {
    // Reference: clipboardHelpers.js lines 147-152
    // Use Tabulator export module to generate HTML for ALL rows (not just visible page)
    // The key is passing "all" instead of true to export all rows regardless of pagination
    let visible = "all";  // Changed from true to "all" to export all rows, not just current page
    let style = true;
    let colVisProp = "clipboard";
    let config = null;
    let html = ref.table.modules.export.getHtml(visible, style, config, colVisProp);
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

