import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/hanken-grotesk";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SAMPLE_MODE } from "./lib/mode";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { CreatorHeld, DemoBrandSearch } from "./pages/HeldRoutes";
import { LiveBrandResults } from "./pages/live/BrandResults";
import { LiveAppPage } from "./pages/AppPages";
import { BrandResults as SampleBrandResults } from "./pages/sample/BrandResults";
import { CreatorResults as SampleCreatorResults } from "./pages/sample/CreatorResults";
import { AppPage as SampleAppPage } from "./pages/sample/AppPages";

/** The default build is live only. VITE_SAMPLE=1 swaps in the synthetic-data screens for the hosted demo. */
const sample = SAMPLE_MODE;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/for-brands" replace />} />
        <Route path="/for-brands" element={<Landing audience="brands" />} />
        <Route path="/for-creators" element={<Landing audience="creators" />} />
        <Route path="/brands/:brand" element={sample ? <SampleBrandResults /> : <LiveBrandResults />} />
        <Route path="/creators/:handle" element={sample ? <SampleCreatorResults /> : <CreatorHeld />} />
        <Route path="/demo/brand-search" element={<DemoBrandSearch />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={sample ? <SampleAppPage view="overview" /> : <LiveAppPage view="overview" />} />
        <Route path="/app/list" element={sample ? <SampleAppPage view="list" /> : <LiveAppPage view="list" />} />
        <Route path="/app/pipeline" element={sample ? <SampleAppPage view="pipeline" /> : <LiveAppPage view="pipeline" />} />
        <Route path="*" element={<Navigate to="/for-brands" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
