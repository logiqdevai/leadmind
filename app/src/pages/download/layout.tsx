import { Outlet } from "react-router-dom";
import { AppLogo } from "@/components/layout/app-logo";
import { environments } from "@/config/environments";
import "./download.css";

export default function DownloadLayout() {
  return (
    <div className="dl-root">
      <div className="dl-frame">
        <header className="dl-bar">
          <AppLogo className="size-7" />
          <span className="dl-brand-name">{environments.APP_NAME}</span>
        </header>
        <div className="dl-stage">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
