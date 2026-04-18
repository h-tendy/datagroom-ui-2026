import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import RequireAuth from './auth/RequireAuth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import MainPage from './MainPage';
import LoginPage from './components/LoginPage';
import NewDsFromDsPage from './pages/AllDs/NewDsFromDsPage';
import NewDsFromXlsPage from './pages/AllDs/NewDsFromXlsPage';
import NewDsFromCsvPage from './pages/AllDs/NewDsFromCsvPage';
import DsViewPage from './pages/DsView/DsViewPage';
import DsEditLogPage from './pages/DsEditLog/DsEditLogPage';
import DsViewEditPage from './pages/DsViewEdit/DsViewEditPage';
import DsAttachmentsPage from './pages/DsAttachments/DsAttachmentsPage';
import DsBulkEditPage from './pages/DsBulkEdit/DsBulkEditPage';
import PATManager from './pages/Settings/PATManager';
import SidebarLayout from './SidebarLayout';
import { useAuth } from './auth/AuthProvider';
import { md } from './pages/DsView/helpers/tabulatorConfig';
import mermaid from 'mermaid';

// Markdown viewer for /attachments/*.md URLs - uses same md.render() as cells
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

function MarkdownViewer() {
    const location = useLocation();
    const [html, setHtml] = React.useState('Loading...');
    
    React.useEffect(() => {
        mermaid.initialize({ startOnLoad: true, securityLevel: 'loose', theme: 'default', flowchart: { htmlLabels: false, useMaxWidth: true } });
    }, []);
    
    React.useEffect(() => {
        // Extract actual file path: /view-md/attachments/file.md -> /attachments/file.md
        const filePath = location.pathname.replace('/view-md', '');
        
        fetch(filePath)
            .then(r => r.text())
            .then(content => {
                setHtml(md.render(content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')));
                requestAnimationFrame(() => requestAnimationFrame(() => 
                    mermaid.run({ querySelector: '.mermaid' }).catch(() => {})
                ));
            });
    }, [location.pathname]);
    
    return (
        <div style={{ padding: '3rem', maxWidth: '1000px', margin: '0 auto', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif', fontSize: '16px', backgroundColor: '#fff', color: '#24292f', minHeight: '100vh', lineHeight: 1.6 }}>
            <style>{mdViewerStyles}</style>
            <div style={{ whiteSpace: 'normal', wordWrap: 'break-word', overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
}

function DsViewWithLayout() {
    const auth = useAuth();
    return (
        <SidebarLayout onLogout={() => { auth.logout(); window.location.href = '/login'; }}>
            <div style={{ position: 'relative', width: '100%', margin: '0 auto', padding: '0 20px' }}>
                <DsViewPage currentUserId={auth.userId} />
            </div>
        </SidebarLayout>
    );
}

function PATManagerWithLayout() {
    const auth = useAuth();
    return (
        <SidebarLayout onLogout={() => { auth.logout(); window.location.href = '/login'; }}>
            <div style={{ position: 'relative', width: '100%', margin: '0 auto', padding: '0 20px' }}>
                <PATManager />
            </div>
        </SidebarLayout>
    );
}

function DsEditLogWithLayout() {
    const auth = useAuth();
    return (
        <SidebarLayout onLogout={() => { auth.logout(); window.location.href = '/login'; }}>
            <div style={{ position: 'relative', width: '100%', margin: '0 auto', padding: '0 20px' }}>
                <DsEditLogPage />
            </div>
        </SidebarLayout>
    );
}

function DsViewEditWithLayout() {
    const auth = useAuth();
    return (
        <SidebarLayout onLogout={() => { auth.logout(); window.location.href = '/login'; }}>
            <div style={{ position: 'relative', width: '100%', margin: '0 auto', padding: '0 20px' }}>
                <DsViewEditPage />
            </div>
        </SidebarLayout>
    );
}

export function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireAuth><MainPage /></RequireAuth>} />
            <Route path="/view-md/attachments/*" element={<MarkdownViewer />} />
            <Route path="/dsViewEdit/:dsName/:dsView" element={<RequireAuth><DsViewEditWithLayout /></RequireAuth>} />
            <Route path="/dsEditLog/:dsName" element={<RequireAuth><DsEditLogWithLayout /></RequireAuth>} />
            <Route path="/dsAttachments/:dsName" element={<RequireAuth><DsAttachmentsPage /></RequireAuth>} />
            <Route path="/dsBulkEdit/:dsName" element={<RequireAuth><DsBulkEditPage /></RequireAuth>} />
            <Route path="/ds/:dsName/:dsView/:filter" element={<RequireAuth><DsViewWithLayout /></RequireAuth>} />
            <Route path="/ds/:dsName/:dsView" element={<RequireAuth><DsViewWithLayout /></RequireAuth>} />
            <Route path="/ds/new-from-ds" element={<RequireAuth><NewDsFromDsPage /></RequireAuth>} />
            <Route path="/ds/new-from-xls" element={<RequireAuth><NewDsFromXlsPage /></RequireAuth>} />
            <Route path="/ds/new-from-csv" element={<RequireAuth><NewDsFromCsvPage /></RequireAuth>} />
            <Route path="/settings/pats" element={<RequireAuth><PATManagerWithLayout /></RequireAuth>} />
        </Routes>
    );
}

export default function App() {
    const queryClient = React.useMemo(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
            },
        },
    }), []);
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </QueryClientProvider>
    );
}
