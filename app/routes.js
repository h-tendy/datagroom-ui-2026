import { Navigate } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';
import DsViewPage from './pages/DsView/DsViewPage';

export default [
  {
    path: '/ds/:dsName/:dsView',
    element: <RequireAuth><DsViewPage /></RequireAuth>,
  },
];

