import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import RequireAuth from './auth/RequireAuth';

import MainPage from './MainPage';
import LoginPage from './components/LoginPage';
import Sample1Page from './Sample1Page';
import Sample2Page from './Sample2Page';

export function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireAuth><MainPage /></RequireAuth>} />
            <Route path="/sample1" element={<RequireAuth><Sample1Page /></RequireAuth>} />
            <Route path="/sample2" element={<RequireAuth><Sample2Page /></RequireAuth>} />
        </Routes>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    );
}
