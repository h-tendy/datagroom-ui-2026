import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import RequireAuth from './auth/RequireAuth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import MainPage from './MainPage';
import LoginPage from './components/LoginPage';
import Sample1Page from './Sample1Page';
import Sample2Page from './Sample2Page';
import NewDsFromDsPage from './pages/AllDs/NewDsFromDsPage';
import NewDsFromXlsPage from './pages/AllDs/NewDsFromXlsPage';
import NewDsFromCsvPage from './pages/AllDs/NewDsFromCsvPage';
import DsViewPage from './pages/DsView/DsViewPage';
import DsEditLogPage from './pages/DsEditLog/DsEditLogPage';
import DsViewEditPage from './pages/DsViewEdit/DsViewEditPage';
import SidebarLayout from './SidebarLayout';
import { useAuth } from './auth/AuthProvider';

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
            <Route path="/dsViewEdit/:dsName/:dsView" element={<RequireAuth><DsViewEditWithLayout /></RequireAuth>} />
            <Route path="/dsEditLog/:dsName" element={<RequireAuth><DsEditLogWithLayout /></RequireAuth>} />
            <Route path="/ds/:dsName/:dsView/:filter" element={<RequireAuth><DsViewWithLayout /></RequireAuth>} />
            <Route path="/ds/:dsName/:dsView" element={<RequireAuth><DsViewWithLayout /></RequireAuth>} />
            <Route path="/ds/new-from-ds" element={<RequireAuth><NewDsFromDsPage /></RequireAuth>} />
            <Route path="/ds/new-from-xls" element={<RequireAuth><NewDsFromXlsPage /></RequireAuth>} />
            <Route path="/ds/new-from-csv" element={<RequireAuth><NewDsFromCsvPage /></RequireAuth>} />
            <Route path="/sample1" element={<RequireAuth><Sample1Page /></RequireAuth>} />
            <Route path="/sample2" element={<RequireAuth><Sample2Page /></RequireAuth>} />
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
