// Tabulator configuration and callbacks for hooks-based DsViewPage
import MarkdownIt from 'markdown-it';
import mditBracketedSpans from 'markdown-it-bracketed-spans';
import mditAttrs from 'markdown-it-attrs';
import mditContainer from 'markdown-it-container';
import mditHighlightjs from 'markdown-it-highlightjs';
import mditPlantuml from 'markdown-it-plantuml';
import { markdownItFancyListPlugin as mditFancyLists } from 'markdown-it-fancy-lists';
import { parseExpr, evalExpr } from '../../../components/editors/QueryParsers';

// Initialize markdown-it with all plugins (matching reference implementation)
const md = new MarkdownIt({
  html: true,
  linkify: true,
})
  .use(mditBracketedSpans)
  .use(mditAttrs)
  .use(mditContainer, 'code')
  .use(mditContainer, 'indent1')
  .use(mditContainer, 'indent2')
  .use(mditContainer, 'indent3')
  .use(mditHighlightjs)
  // mermaid temporarily disabled due to d3.js document access errors
  // .use(mditMermaid)
  .use(mditPlantuml, { imageFormat: 'png' })
  .use(mditContainer, 'slide')
  .use(mditFancyLists);

// Custom link renderer - open in new tab
const defaultLinkOpen = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
  const aIndex = tokens[idx].attrIndex('target');
  if (aIndex < 0) {
    tokens[idx].attrPush(['target', '_blank']);
  } else {
    tokens[idx].attrs[aIndex][1] = '_blank';
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

// Custom fence renderer for plotly graphs
// CRITICAL: Save the default fence renderer that markdown-it-highlightjs set up
const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = function(tokens, idx, options, env, self) {
  const token = tokens[idx];
  const info = token.info ? token.info.trim() : '';
  
  if (info === 'plotly') {
    // Encode plotly data for rendering
    const encoded = btoa(token.content);
    return `<div class="plotly-graph-div" data-plotly="${encoded}"></div>`;
  }
  
  // Call the default fence renderer to apply syntax highlighting
  return defaultFence(tokens, idx, options, env, self);
};

// Export markdown renderer for reuse
export { md };

/**
 * Create Tabulator configuration with all formatters, editors, and callbacks
 * @param {Object} context - { tabulatorRef, viewConfig, dsName, dsView, userId, handlers, cellImEditingRef, frozenCol }
 * @param {Object} context.handlers - All handler functions from DsViewPage
 * @returns {Object} - { setColumnDefinitions, ajaxURLGenerator, ajaxResponse }
 */
export default function createTabulatorConfig(context) {
  const { tabulatorRef, viewConfig, dsName, dsView, userId, handlers, cellImEditingRef, frozenCol,
          MyTextArea, MyCodeMirror, DateEditor, MyAutoCompleter, MySingleAutoCompleter,
          filterColumnAttrs, columnResizedRecently, originalColumnAttrs } = context;
  
  // Extract handlers passed from DsViewPage
  const {
    cellEditCheck,
    cellForceEditTrigger,
    isKey,
    toggleSingleFilter,
    freezeColumn,
    unfreezeColumn,
    hideColumn,
    hideColumnFromCell,
    showAllCols,
    copyCellToClipboard,
    startPreso,
    urlGeneratorFunction,
    duplicateAndAddRowHandler,
    addRow,
    deleteAllRowsInViewQuestion,
    deleteAllRowsInQuery,
    deleteRowQuestion,
    deleteColumnQuestion,
    addColumnQuestion,
    downloadXlsx,
    convertToJiraRow,
    addJiraRow,
    isJiraRow,
    showAllFilters,
  } = handlers || {};

  /**
   * Generate Tabulator column definitions from viewConfig
   */
  function setColumnDefinitions() {
    if (!viewConfig || !viewConfig.columnAttrs) {
      return [];
    }

    const jiraConfig = viewConfig.jiraConfig;
    const jiraAgileConfig = viewConfig.jiraAgileConfig;
    const keys = viewConfig.keys || [];

    // Helper function to filter out null menu items
    const filterMenu = (menuItems) => menuItems.filter(item => item !== null);

    // Header menu for key columns (no hide option) - only include items with valid handlers
    const headerMenuWithoutHide = filterMenu([
      (typeof toggleSingleFilter === 'function') ? { label: "Toggle Filters", action: toggleSingleFilter } : null,
      (typeof freezeColumn === 'function') ? { label: "Freeze", action: freezeColumn } : null,
      (typeof unfreezeColumn === 'function') ? { label: "Unfreeze", action: unfreezeColumn } : null
    ]);

    // Header menu for non-key columns - only include items with valid handlers
    const headerMenuWithHide = filterMenu([
      (typeof toggleSingleFilter === 'function') ? { label: "Toggle Filters", action: toggleSingleFilter } : null,
      (typeof freezeColumn === 'function') ? { label: "Freeze", action: freezeColumn } : null,
      (typeof unfreezeColumn === 'function') ? { label: "Unfreeze", action: unfreezeColumn } : null,
      (typeof hideColumn === 'function') ? { label: "<i class='fas fa-eye-slash'></i> Hide Column", action: hideColumn } : null,
      (typeof showAllCols === 'function') ? { label: "<i class='fas fa-eye'></i> Unhide all Columns", action: showAllCols } : null
    ]);

    // Context menu for all cells - using reference implementation pattern
    const cellContextMenu = [
      { label: "Copy cell to clipboard...", action: function(e, cell) { if (copyCellToClipboard) copyCellToClipboard(e, cell); } },
      { label: "Generate URL.....", menu: [
        { label: "Copy URL for this row to clipboard...", action: function (e, cell) { if (urlGeneratorFunction) urlGeneratorFunction(e, cell, false); } },
        { label: "Copy URL for current view to clipboard...", action: function (e, cell) { if (urlGeneratorFunction) urlGeneratorFunction(e, cell, true); } }
      ] },
      { separator: true },
      { label: "Hide/Unhide column...", menu: [
        { label: "<i class='fas fa-eye-slash'></i> Hide Column", action: function(e, cell) { if (hideColumnFromCell) hideColumnFromCell(e, cell); } },
        { label: "<i class='fas fa-eye'></i> Unhide all Columns", action: function(e, cell) { if (showAllCols) showAllCols(e, cell); } }
      ] },
      { label: "Add row.....", menu: [
        { label: "Duplicate row & add (above)", action: function (e, cell) { if (duplicateAndAddRowHandler) duplicateAndAddRowHandler(e, cell, true); } },
        { label: "Duplicate row & add (below)", action: function (e, cell) { if (duplicateAndAddRowHandler) duplicateAndAddRowHandler(e, cell, false); } },
        { label: "Add empty row...", action: function (e, cell) { if (addRow) addRow(e, cell, null, true); } }
      ] },
      { label: "Delete row....", menu: [
        { label: "Delete all rows in view...", action: function(e, cell) { if (deleteAllRowsInViewQuestion) deleteAllRowsInViewQuestion(e, cell); } },
        { label: "Delete all rows in query...", action: function(e, cell) { if (deleteAllRowsInQuery) deleteAllRowsInQuery(e, cell); } },
        { label: "Delete row...", action: function(e, cell) { if (deleteRowQuestion) deleteRowQuestion(e, cell); } }
      ] },
      { label: "Delete column...", menu: [ { label: "Delete column...", action: function (e, cell) { if (deleteColumnQuestion) deleteColumnQuestion(e, cell); } } ] },
      { label: "Add Column", menu: [ { label: "Add Column", action: function (_, cell) { if (addColumnQuestion) addColumnQuestion(cell.getColumn().getField()); } } ] },
      { label: "Get xlsx....", menu: [
        { label: "Get xlsx for whole DS...", action: function () { if (downloadXlsx) downloadXlsx(false); } },
        { label: "Get xlsx in query...", action: function () { if (downloadXlsx) downloadXlsx(true); } }
      ] }
    ];

    const columns = [];
    
    for (let i = 0; i < viewConfig.columnAttrs.length; i++) {
      const col = { ...viewConfig.columnAttrs[i] };
      // If saved filter column attributes provided, apply visibility/width before returning
      try {
        const attrsForField = filterColumnAttrs && col.field ? filterColumnAttrs[col.field] : null;
        if (attrsForField) {
          if (attrsForField.hidden) {
            // Tabulator column definition uses 'visible' boolean
            col.visible = false;
          } else {
            col.visible = true;
          }

          if (!columnResizedRecently && attrsForField.width !== undefined) {
            col.width = attrsForField.width;
          }
        } else if (!columnResizedRecently && originalColumnAttrs) {
          // If no saved attrs but original widths exist, restore width from original attrs
          if (originalColumnAttrs[col.field] && originalColumnAttrs[col.field].width !== undefined) {
            col.width = originalColumnAttrs[col.field].width;
          } else if (Array.isArray(originalColumnAttrs)) {
            for (let o = 0; o < originalColumnAttrs.length; o++) {
              const oc = originalColumnAttrs[o];
              if (oc && oc.field === col.field && oc.width !== undefined) {
                col.width = oc.width;
                break;
              }
            }
          }
        }
      } catch (e) {
        // ignore attr application errors
      }
      
      // Determine if this is a key column
      const isKeyColumn = keys.includes(col.field);
      
      // Set header menu based on key status
      col.headerMenu = isKeyColumn ? headerMenuWithoutHide : headerMenuWithHide;
      
      // Underline title for key columns
      if (isKeyColumn) {
        col.titleFormatter = (cell) => `<u>${cell.getValue()}</u>`;
      }
      
      // Set context menu
      col.contextMenu = cellContextMenu;
      
      // Set editable check and force edit trigger
      col.editable = cellEditCheck;
      col.cellForceEditTrigger = cellForceEditTrigger;
      
      // Enable header filter if showAllFilters is true
      if (showAllFilters) {
        col.headerFilter = col.headerFilterType || "input";
      }

      // Conditional formatting function
      function doConditionalFormatting(cell, formatterParams) {
        if (formatterParams && formatterParams.conditionalFormatting) {
          const rowData = cell.getRow().getData();
          for (let i = 0; i < formatterParams.conditionalExprs.length; i++) {
            const exprStr = formatterParams.conditionalExprs[i].split('->')[0].trim();
            const expr = parseExpr(exprStr);
            if (evalExpr(expr, rowData, cell.getColumn().getField())) {
              const values = JSON.parse(formatterParams.conditionalExprs[i].split('->')[1].trim());
              if (values.backgroundColor) cell.getElement().style.backgroundColor = values.backgroundColor;
              if (values.color) cell.getElement().style.color = values.color;
              break;
            }
          }
        }
      }

      // Apply formatters based on editor type
      if (col.editor === "input" || !col.editor) {
        col.formatter = (cell, formatterParams) => {
          let value = cell.getValue();
          doConditionalFormatting(cell, formatterParams);
          if (value === undefined) return "";
          return value;
        };
      }

      // Markdown/HTML formatting for textarea, codemirror, autocomplete
      if (col.editor === "textarea" || col.editor === "codemirror" || 
          (col.editor === false && col.formatter === "textarea") || 
          col.editor === "autocomplete") {
        
        col.formatter = function(cell, formatterParams) {
          let value = cell.getValue();
          doConditionalFormatting(cell, formatterParams);
          
          if (value === undefined) return "";
          if (typeof value !== "string") return value;
          
          const width = cell.getColumn().getWidth();
          
          // Render markdown to HTML
          value = md.render(value);
          
          // Wrap in div with proper width
          return `<div style="white-space:normal;word-wrap:break-word;margin-bottom:-12px;width:${width - 8}px">${value}</div>`;
        };
        
        // Clipboard formatter - preserve styling
        col.formatterClipboard = (cell) => {
          const h = cell.getRow().getCell(cell.getField())._cell.element;
          const cloned = h.cloneNode(true);
          cell.getElement().style.backgroundColor = cloned.style.backgroundColor;
          cell.getElement().style.color = cloned.style.color;
          return cloned;
        };
        
        // CRITICAL: Enable variable height for proper HTML rendering
        col.variableHeight = true;
        
        // Setup editor params and custom editors for textarea/codemirror
        if (col.editor === "textarea" || col.editor === "codemirror") {
          col.editorParams = col.editorParams || {};
          col.editorParams.dsName = dsName;
          
          // Replace string editor names with actual function references
          if (col.editor === "textarea") {
            col.editor = MyTextArea;
          } else if (col.editor === "codemirror") {
            col.editor = MyCodeMirror;
          }
          
          // Add cellEditCancelled callback to normalize height
          const cellEditCancelled = (cell) => {
            if (!cellImEditingRef || !cellImEditingRef.current) {
              cell.getRow().normalizeHeight();
            } else {
            }
          };
          col.cellEditCancelled = cellEditCancelled;
        }
      }

      // Setup autocomplete editors
      if (col.editor === "autocomplete" && col.editorParams) {
        if (!col.editorParams.verticalNavigation) {
          col.editorParams.verticalNavigation = "table";
        }
        // Replace string editor name with actual component reference
        if (col.editorParams.multiselect) {
          col.editor = MyAutoCompleter;
        } else {
          col.editor = MySingleAutoCompleter;
        }
      }

      // Setup date editor
      if (col.editor === "date") {
        col.editorParams = { format: "MM/DD/YYYY" };
        // Replace string editor name with actual component reference
        col.editor = DateEditor;
      }

      columns.push(col);
    }

    // Handle frozen columns if frozenCol state is set
    if (frozenCol) {
      let beforeFrozen = true;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (beforeFrozen) {
          col.frozen = true;
        } else {
          delete col.frozen;
        }
        if (col.field === frozenCol) {
          beforeFrozen = false;
        }
      }
    } else {
      // Clear all frozen columns
      for (let i = 0; i < columns.length; i++) {
        delete columns[i].frozen;
      }
    }
    return columns;
  }

  /**
   * Ajax URL generator - adds chronology, reqCount, fetchAllMatchingRecords to params
   */
  function ajaxURLGenerator(url, config, params) {
    // This will be implemented in DsViewPage with state access
    return url;
  }

  /**
   * Ajax response handler - extract total records and data
   */
  function ajaxResponse(url, params, response) {
    // This will be implemented in DsViewPage with state access
    return response;
  }

  return {
    setColumnDefinitions,
    ajaxURLGenerator,
    ajaxResponse,
  };
}
