import { Outlet } from "react-router-dom";
import { AppLogo } from "@/components/layout/app-logo";
import { environments } from "@/config/environments";
import "./unsubscribe.css";

export default function UnsubscribeLayout() {
  return (
    <div className="unsub-root">
      <div className="unsub-frame">
        <header className="unsub-bar">
          <AppLogo className="size-7" />
          <span className="unsub-brand-name">{environments.APP_NAME}</span>
        </header>
        <div className="unsub-stage">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
