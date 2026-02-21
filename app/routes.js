import { Navigate } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';
import DsViewPage from './pages/DsView/DsViewPage';
import DsEditLogPage from './pages/DsEditLog/DsEditLogPage';
import DsAttachmentsPage from './pages/DsAttachments/DsAttachmentsPage';

export default [
  {
    path: '/dsEditLog/:dsName',
    element: <RequireAuth><DsEditLogPage /></RequireAuth>,
  },
  {
    path: '/dsAttachments/:dsName',
    element: <RequireAuth><DsAttachmentsPage /></RequireAuth>,
  },
  {
    path: '/ds/:dsName/:dsView/:filter',
    element: <RequireAuth><DsViewPage /></RequireAuth>,
  },
  {
    path: '/ds/:dsName/:dsView',
    element: <RequireAuth><DsViewPage /></RequireAuth>,
  },
];

