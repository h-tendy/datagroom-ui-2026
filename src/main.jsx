import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from 'react-router-dom';
import App from "../app/root.jsx";
import "../app/theme.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found in document");

createRoot(rootEl).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
