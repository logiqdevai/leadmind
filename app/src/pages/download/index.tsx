import { type FC } from "react";
import { Smartphone } from "lucide-react";
import { environments } from "@/config/environments";
import { useInstallPrompt } from "./hooks/use-install-prompt";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "other";
}

const DownloadPage: FC = () => {
    const platform = detectPlatform();
    const { canInstall, installed, install } = useInstallPrompt();

    const android = (
        <section key="android" className="dl-card" data-current={platform === "android"}>
            <div className="dl-card-head">
                <Smartphone className="size-5" aria-hidden />
                <h2 className="dl-card-title">Android</h2>
                {platform === "android" && <span className="dl-badge">Your device</span>}
            </div>
            {canInstall && (
                <button type="button" className="dl-btn" onClick={install}>
                    Install app
                </button>
            )}
            <ol className="dl-steps">
                <li>Open this page in Chrome.</li>
                <li>Tap the menu (⋮) in the top right.</li>
                <li>Tap “Install app” or “Add to Home screen”, then confirm.</li>
            </ol>
        </section>
    );

    const ios = (
        <section key="ios" className="dl-card" data-current={platform === "ios"}>
            <div className="dl-card-head">
                <Smartphone className="size-5" aria-hidden />
                <h2 className="dl-card-title">iPhone</h2>
                {platform === "ios" && <span className="dl-badge">Your device</span>}
            </div>
            <ol className="dl-steps">
                <li>Open this page in Safari.</li>
                <li>Tap the Share button at the bottom of the screen.</li>
                <li>Scroll down and tap “Add to Home Screen”.</li>
                <li>Tap Add. {environments.APP_NAME} now opens from your home screen like an app.</li>
            </ol>
            <p className="dl-note">This only works in Safari, not in Chrome or in-app browsers.</p>
        </section>
    );

    return (
        <div className="dl-content">
            <h1 className="dl-title">Get the {environments.APP_NAME} app</h1>
            <p className="dl-lead">
                Install {environments.APP_NAME} on your phone for quick, full-screen access, with no app store needed.
            </p>
            {installed && <div className="dl-installed">You’re already using the installed app.</div>}
            {platform === "ios" ? [ios, android] : [android, ios]}
        </div>
    );
};

export default DownloadPage;
