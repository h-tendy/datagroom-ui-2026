import React from 'react';
import { useLocation } from 'react-router-dom';
import { md } from '../pages/DsView/helpers/tabulatorConfig';
import mermaid from 'mermaid';

const mdViewerStyles = `
  h1,h2,h3,h4,h5,h6{font-weight:600!important;margin:1.5em 0 .5em!important;color:#1a1a1a!important;line-height:1.25!important}
  h1{font-size:2em!important;border-bottom:1px solid #e1e4e8!important;padding-bottom:.3em!important}
  h2{font-size:1.5em!important;border-bottom:1px solid #e1e4e8!important;padding-bottom:.3em!important}
  h3{font-size:1.25em!important}h4{font-size:1em!important}
  p{margin:1em 0!important}ul,ol{padding-left:2em!important;margin:1em 0!important}li{margin:.25em 0!important}
  table{border-collapse:collapse!important;width:100%!important;margin:1.5em 0!important;display:table!important}
  th,td{border:1px solid #d0d7de!important;padding:.6em 1em!important;text-align:left!important}
  th{background:#f6f8fa!important;font-weight:600!important}
  pre{background:#f6f8fa!important;border-radius:6px!important;padding:1em!important;overflow-x:auto!important;margin:1em 0!important}
  code{background:rgba(175,184,193,.2)!important;padding:.2em .4em!important;border-radius:3px!important;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}
  pre code{background:transparent!important;padding:0!important}
  a{color:#0969da!important;text-decoration:none!important}a:hover{text-decoration:underline!important}
  strong{font-weight:600!important}
`;

const tabStyle = (active) => ({
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    border: '1px solid #d0d7de',
    borderBottom: active ? '2px solid #0969da' : '1px solid #d0d7de',
    background: active ? '#fff' : '#f6f8fa',
    color: active ? '#0969da' : '#57606a',
    borderRadius: '6px 6px 0 0',
    marginLeft: '4px',
    outline: 'none',
});

export default function MarkdownViewer() {
    const location = useLocation();
    const [rawContent, setRawContent] = React.useState('');
    const [renderedHtml, setRenderedHtml] = React.useState('');
    const [activeTab, setActiveTab] = React.useState('markdown');
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        mermaid.initialize({ startOnLoad: true, securityLevel: 'loose', theme: 'default', flowchart: { htmlLabels: false, useMaxWidth: true } });
    }, []);

    const isMdFile = location.pathname.endsWith('.md');

    React.useEffect(() => {
        if (!isMdFile) return;
        const filePath = location.pathname;
        setLoading(true);

        fetch(filePath, { headers: { 'X-Raw-Content': '1' } })
            .then(r => r.text())
            .then(content => {
                const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                setRawContent(normalized);
                setRenderedHtml(md.render(normalized));
                setLoading(false);
            })
            .catch(() => {
                setRawContent('Failed to load file.');
                setRenderedHtml('<p>Failed to load file.</p>');
                setLoading(false);
            });
    }, [location.pathname, isMdFile]);

    // Run mermaid when switching to preview tab or when content loads in preview mode
    React.useEffect(() => {
        if (activeTab === 'preview' && renderedHtml) {
            requestAnimationFrame(() => requestAnimationFrame(() =>
                mermaid.run({ querySelector: '.mermaid' }).catch(() => {})
            ));
        }
    }, [activeTab, renderedHtml]);

    // For non-.md files, redirect to the raw file
    if (!isMdFile) {
        window.location.replace(location.pathname);
        return null;
    }

    if (loading) {
        return <div style={{ padding: '3rem', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif' }}>Loading...</div>;
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif', paddingTop: '50px' }}>
            {/* Tab bar */}
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 20px 0', borderBottom: '1px solid #d0d7de', background: '#f6f8fa' }}>
                <button style={tabStyle(activeTab === 'markdown')} onClick={() => setActiveTab('markdown')}>
                    Markdown
                </button>
                <button style={tabStyle(activeTab === 'preview')} onClick={() => setActiveTab('preview')}>
                    Preview
                </button>
            </div>

            {/* Content area */}
            {activeTab === 'markdown' ? (
                <div style={{ padding: '2rem 3rem', maxWidth: '1000px', margin: '0 auto' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace', fontSize: '14px', lineHeight: 1.6, background: '#f6f8fa', padding: '1.5em', borderRadius: '6px', border: '1px solid #d0d7de', color: '#24292f', overflow: 'auto' }}>
                        {rawContent}
                    </pre>
                </div>
            ) : (
                <div style={{ padding: '3rem', maxWidth: '1000px', margin: '0 auto', fontSize: '16px', color: '#24292f', lineHeight: 1.6 }}>
                    <style>{mdViewerStyles}</style>
                    <div style={{ whiteSpace: 'normal', wordWrap: 'break-word', overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                </div>
            )}
        </div>
    );
}
