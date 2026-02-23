/**
 * Custom Mermaid plugin for markdown-it using latest mermaid version
 * Based on @datatraccorporation/markdown-it-mermaid but uses the project's mermaid dependency
 */
import mermaid from 'mermaid';

// Simple hash function for generating unique IDs
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

const htmlEntities = (str) =>
  String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MermaidChart = (code, title = '') => {
  try {
    const needsUniqueId = "mermaid-" + simpleHash(code);
    
    // For newer mermaid versions, we output the code in a pre-formatted div
    // and let mermaid initialize it client-side
    const escapedCode = htmlEntities(code);
    
    if (title && String(title).length) {
      title = `<div class="mermaid-title">${htmlEntities(title)}</div>`;
    }
    
    // Output as a mermaid div that will be rendered client-side
    return `<div class="mermaid" id="${needsUniqueId}">${title}${escapedCode}</div>`;
  } catch (err) {
    console.error('Mermaid rendering error:', err);
    return `<pre>${htmlEntities(err.name)}: ${htmlEntities(err.message)}</pre>`;
  }
};

const MermaidPlugin = (md, opts) => {
  // Initialize mermaid with options
  // Note: This will be called on the client side when the page loads
  if (typeof window !== 'undefined') {
    mermaid.initialize(Object.assign({
      startOnLoad: true,
      securityLevel: 'loose',
      theme: 'default',
      flowchart: {
        htmlLabels: false,
        useMaxWidth: true,
      }
    }, opts));
  }

  const defaultRenderer = md.renderer.rules.fence.bind(md.renderer.rules);

  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const code = token.content.trim();
    
    if (token.info.startsWith('mermaid')) {
      let title;
      const spc = token.info.indexOf(' ', 7);
      if (spc > 0) {
        title = token.info.slice(spc + 1);
      }
      return MermaidChart(code, title);
    }
    return defaultRenderer(tokens, idx, opts, env, self);
  };
};

export default MermaidPlugin;
