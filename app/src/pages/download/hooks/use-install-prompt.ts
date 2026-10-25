import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

export function useInstallPrompt() {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(isStandalone);

    useEffect(() => {
        const onPrompt = (e: Event) => {
            e.preventDefault();
            setDeferred(e as BeforeInstallPromptEvent);
        };
        const onInstalled = () => {
            setDeferred(null);
            setInstalled(true);
        };
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    const install = useCallback(async () => {
        if (!deferred) return;
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
    }, [deferred]);

    return { canInstall: deferred !== null, installed, install };
}
