import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/hanken-grotesk";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { BrandResults } from "./pages/BrandResults";
import { CreatorHeld, DemoBrandSearch } from "./pages/HeldRoutes";
import { Login } from "./pages/Login";
import { AppPage } from "./pages/AppPages";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/for-brands" replace />} />
        <Route path="/for-brands" element={<Landing audience="brands" />} />
        <Route path="/for-creators" element={<Landing audience="creators" />} />
        <Route path="/brands/:brand" element={<BrandResults />} />
        <Route path="/demo/brand-search" element={<DemoBrandSearch />} />
        {/* Sample CreatorResults stays unmounted. This route posts /api/creator-report. */}
        <Route path="/creators/:handle" element={<CreatorHeld />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<AppPage view="overview" />} />
        <Route path="/app/list" element={<AppPage view="list" />} />
        <Route path="/app/pipeline" element={<AppPage view="pipeline" />} />
        <Route path="*" element={<Navigate to="/for-brands" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
