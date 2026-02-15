// DOM helpers extracted from DsView to keep component smaller
export default function createDomHelpers(context) {
  const { component, ref, timers, mouseDownOnHtmlLinkRef, mouseDownOnBadgeCopyIconRef } = context;
  // Since we generate html after editing, we need to attach
  // the handlers again. Preserved from `DsView.js` fallback implementation.
  // The original implementation attached click/focus handlers to links and
  // highlight-badge icons inside the Tabulator container. It also flipped
  // component flags `mouseDownOnHtmlLink` and `mouseDownOnBadgeCopyIcon` and
  // used short timeouts to reset them. Keeping these comments here so the
  // behavior is documented even though the component delegates to the helper.
  function applyHtmlLinkAndBadgeClickHandlers() {
    const me = component;
    let splElements = [];
    if (document.getElementById("tabulator")) {
      splElements = document.getElementById("tabulator").getElementsByTagName('a');
    }
    for (var i = 0, len = splElements.length; i < len; i++) {
      splElements[i].onclick = function (e) {
        if (mouseDownOnHtmlLinkRef) mouseDownOnHtmlLinkRef.current = true;
        // Caution: This is a must, otherwise you are getting the click after returning to the tab!
        e.stopPropagation();
        // Caution: To clear this out after a second to ensure that the next click is honored properly.
        setTimeout(() => {
          if (mouseDownOnHtmlLinkRef) mouseDownOnHtmlLinkRef.current = false;
        }, 1000);
        return true;
      }
    }

    // Add a document-level mousedown handler to catch badge clicks as early as possible
    // Remove previous handler if exists
    if (document._badgeMousedownHandler) {
      document.removeEventListener("mousedown", document._badgeMousedownHandler, true);
    }
    
    // Create new handler
    const badgeMousedownHandler = function(e) {
      const target = e.target;
      // Check if click is on badge copy icon or its parent elements
      if (target) {
        const isBadgeIcon = target.classList && target.classList.contains("code-badge-copy-icon");
        const parentBadgeIcon = target.closest && target.closest(".code-badge-copy-icon");
        
        if (isBadgeIcon || parentBadgeIcon) {
          // Set flag immediately
          if (mouseDownOnBadgeCopyIconRef) {
            mouseDownOnBadgeCopyIconRef.current = true;
          }
          // Clear flag after a second
          setTimeout(() => {
            if (mouseDownOnBadgeCopyIconRef) mouseDownOnBadgeCopyIconRef.current = false;
          }, 1000);
        }
      }
    };
    
    // Store handler reference for cleanup
    document._badgeMousedownHandler = badgeMousedownHandler;
    
    // Add handler in capture phase at document level to catch it as early as possible
    document.addEventListener("mousedown", badgeMousedownHandler, true);

    // This querySelectorAll is borrowed from highlightjs-badge.js code
    if (document.getElementById("tabulator")) {
      splElements = document.getElementById("tabulator").querySelectorAll(".code-badge-copy-icon");
    }
    for (i = 0, len = splElements.length; i < len; i++) {
      // Have to setup for 'focus' event because that fires first! And
      // tabulator already has this setup on the cell.
      splElements[i].setAttribute("tabindex", 0);
      
      // Add focus handler as fallback
      splElements[i].addEventListener("focus",
        function(e) {
          let clickedEl = e.srcElement || e.target;
          if (clickedEl && clickedEl.classList && clickedEl.classList.contains("code-badge-copy-icon")) {
            if (mouseDownOnBadgeCopyIconRef) mouseDownOnBadgeCopyIconRef.current = true;
            // Caution: To clear this out after a second to ensure that the next click is honored properly.
            setTimeout(() => {
              if (mouseDownOnBadgeCopyIconRef) mouseDownOnBadgeCopyIconRef.current = false;
            }, 1000);
            return true;
          }
        });
    }
  }

  function applyHighlightJsBadge() {
    const me = component;
    if (timers && timers["applyHighlightJsBadge"]) {
      clearTimeout(timers["applyHighlightJsBadge"]);
      timers["applyHighlightJsBadge"] = null;
    }
    if (timers) {
      timers["applyHighlightJsBadge"] = setTimeout(() => {
        if (window.highlightJsBadge) window.highlightJsBadge();
        applyHtmlLinkAndBadgeClickHandlers();
      }, 1000);
    } else {
      setTimeout(() => {
        if (window.highlightJsBadge) window.highlightJsBadge();
        applyHtmlLinkAndBadgeClickHandlers();
      }, 1000);
    }
  }

  function normalizeAllImgRows() {
    const me = component;
    if (timers && timers["normalizeAllImgRows"]) {
      clearInterval(timers["normalizeAllImgRows"]);
      timers["normalizeAllImgRows"] = null;
    }
    let extraIters = 0;
    if (timers) {
      timers["normalizeAllImgRows"] = setInterval(function () {
        if (document.readyState === 'complete') {
          // Look for images specifically within the tabulator container
          const tabulatorEl = document.getElementById("tabulator");
          let imgList = tabulatorEl ? tabulatorEl.querySelectorAll("img") : document.querySelectorAll("img");
          let allImgsRead = true;
          
          for (let i = 0; i < imgList.length; i++) {
            if (!(imgList[i].complete)) {
              allImgsRead = false;
              extraIters = 0;
              break;
            }
          }
          if (allImgsRead) {
            if (extraIters === 2) {
              // The original behavior: after a couple of successful image loads
              // normalize each Tabulator row height and then adjust the table size
              // so the UI lays out correctly. Preserve the logic here.
              if (imgList.length && !me.cellImEditing && ref && ref() && ref().table) {
                let rows = ref().table.getRows();
                for (let i = 0; i < rows.length; i++) {
                  rows[i].normalizeHeight();
                }
                ref().table.rowManager.adjustTableSize(false);
              }
            }
            if (extraIters >= 10) {
              extraIters = 0;
              clearInterval(timers["normalizeAllImgRows"]);
              timers["normalizeAllImgRows"] = null;
            }
            extraIters++;
          }
        }
      }, 300);
    }
  }

  function renderPlotlyInCells() {
    const plots = document.querySelectorAll('.plotly-graph');
    plots.forEach((div) => {
      const data = div.getAttribute('data-plot');
      try {
        const json = JSON.parse(decodeURIComponent(data));
        if (window.Plotly) {
          window.Plotly.newPlot(div, json.data, json.layout, json.config || {});
          if (ref && ref() && ref().table) {
            let rows = ref().table.getRows();
            for (let i = 0; i < rows.length; i++) {
              rows[i].normalizeHeight();
            }
          }
        } else {
          div.innerHTML = `<div style="color:red;">Plotly CDN not loaded</div>`;
        }
      } catch (e) {
        div.innerHTML = `<div style="color:red;">Invalid Plotly JSON</div>`;
      }
    })
  }

  return {
    applyHtmlLinkAndBadgeClickHandlers,
    applyHighlightJsBadge,
    normalizeAllImgRows,
    renderPlotlyInCells
  };
}
