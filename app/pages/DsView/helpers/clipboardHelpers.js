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
    try {
      const container = document.createElement('div');
      if (element && element.innerHTML) html = element.innerHTML;
      // Prepare container and temporary style overrides
      const rootStyles = getComputedStyle(document.documentElement);
      const bg = (rootStyles.getPropertyValue('--color-bg') || '').trim() || '#ffffff';
      const textColor = (rootStyles.getPropertyValue('--color-text') || '').trim() || '#111111';
      const codeBg = (rootStyles.getPropertyValue('--color-code-bg') || '').trim() || '#f6f8fa';

      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-clipboard-temp-style', '1');
      styleEl.textContent = `
        html, body { background: ${bg} !important; color: ${textColor} !important; }
        body { margin: 0 !important; }
        pre, code { background: ${codeBg} !important; color: ${textColor} !important; }
        .badge, .highlightjs-badge { background: transparent !important; color: ${textColor} !important; box-shadow: none !important; }
        table { border-collapse: collapse !important; background: ${bg} !important; }
        table, th, td { border: 1px solid #ddd !important; }
        th, td { background: ${bg} !important; color: ${textColor} !important; }
        a { color: #0366d6 !important; text-decoration: underline !important; }
        img { max-width: 800px !important; height: auto !important; display: block !important; }
      `;

      // Attach style and content wrapper so selection picks up styles
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.top = '0';
      container.style.pointerEvents = 'none';
      container.style.opacity = '0';
      container.style.zIndex = '-9999';

      const contentWrapper = document.createElement('div');
      contentWrapper.setAttribute('data-clipboard-content', '1');
      contentWrapper.innerHTML = html || '';

      container.appendChild(styleEl);
      container.appendChild(contentWrapper);
      document.body.appendChild(container);

      // Fix image sizes inside wrapper so clipboard consumers see reasonable dimensions
      try {
        const imgs = contentWrapper.querySelectorAll('img');
        imgs.forEach(img => {
          try {
            const w = img.naturalWidth || img.width || img.getBoundingClientRect().width || 300;
            img.style.width = (w > 800 ? 800 : w) + 'px';
            img.style.maxWidth = '800px';
            img.style.height = 'auto';
            img.removeAttribute('srcset');
          } catch (e) {}
        });
      } catch (e) {}

      const sel = window.getSelection();
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNode(container);
      sel.addRange(range);

      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }

      sel.removeAllRanges();
      try { document.body.removeChild(container); } catch (e) {}

      showCopiedNotification(!!ok);
      return !!ok;
    } catch (e) {
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
    try {
      if (!ref || !ref.table) return false;

      // Try Tabulator export HTML if available
      try {
        const exportModule = ref.table.modules && ref.table.modules.export;
        if (exportModule && typeof exportModule.getHtml === 'function') {
          const html = exportModule.getHtml(true, true, null, 'clipboard');
          return copyFormatted(null, html);
        }
      } catch (e) {
        // fallthrough to fallback
      }

      // Fallback: build simple HTML table from visible columns and data
      try {
        const cols = (ref.table.getColumns && ref.table.getColumns()) || [];
        const fields = cols.map(c => c.getField()).filter(Boolean);
        const data = ref.table.getData ? ref.table.getData() : [];

        let html = '<table><thead><tr>' + fields.map(f => '<th>' + escapeHtml(f) + '</th>').join('') + '</tr></thead><tbody>';
        for (let i = 0; i < data.length; i++) {
          html += '<tr>' + fields.map(f => '<td>' + escapeHtml(data[i][f]) + '</td>').join('') + '</tr>';
        }
        html += '</tbody></table>';
        return copyFormatted(null, html);
      } catch (e) {
        // final fallback
        showCopiedNotification(false);
        return false;
      }
    } catch (e) {
      showCopiedNotification(false);
      return false;
    }
  }

  function copyToClipboard(ref) {
    return myCopyToClipboard(ref);
  }

  function fixImgSizeForClipboard(html) {
    // Placeholder: in reference this adjusted img width/height to preserve size when copying.
    // Keep as no-op to avoid brittle DOM queries here.
    try {
      // If passed HTML string, attempt to set reasonable width attributes on img tags.
      if (!html) return html;
      if (typeof html === 'string') {
        return html.replace(/<img([^>]+)>/gi, (match, attrs) => {
          // If width already present, leave it; otherwise add max-width style
          if (/width=|style=.*max-width/i.test(attrs)) return `<img${attrs}>`;
          return `<img${attrs} style="max-width:800px;height:auto;"/>`;
        });
      }
    } catch (e) {}
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

