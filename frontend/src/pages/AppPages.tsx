import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Desk, DeskHead } from "../components/Desk";
import { CreatorReportScreen } from "../creator/CreatorReportScreen";
import { readSession, saveSession } from "../lib/session";
import { BrandWorkspace, type WorkspaceView } from "../workspace/BrandWorkspace";

type View = WorkspaceView;

export function LiveAppPage({ view }: { view: View }) {
  const [session, setSession] = useState(readSession);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);
  const navigate = useNavigate();
  if (!session) return <Navigate to="/login" replace />;
  if (session.audience === "creators") {
    return (
      <Desk session={session} listLabel="Brands" pipelineLabel="Pitches">
        <DeskHead title={`@${session.name}`} note="Indexed posts for this handle. Confirm an appearance before anything is valued." />
        <CreatorReportScreen handle={session.name} layout="workspace" />
      </Desk>
    );
  }
  return <BrandWorkspace key={session.name.trim().toLowerCase()} session={session} view={view} sessionWarning={sessionWarning} onBrandChange={name => {
    const next = { ...session, name };
    try {
      saveSession(next);
      setSessionWarning(null);
    } catch {
      setSessionWarning("The brand selection could not be saved in this browser. You can work here, but reloading may open the previous brand.");
    }
    setSession(next);
    navigate("/app");
  }} />;
}
