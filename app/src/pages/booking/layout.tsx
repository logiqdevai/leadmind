import type { FC } from "react";
import { Outlet } from "react-router-dom";
import { I18nProvider } from "@heroui/react/rac";
import { useTranslation } from "react-i18next";
import { AppLogo } from "@/components/layout/app-logo";
import { environments } from "@/config/environments";
import { getCurrentLanguage } from "@/lib/i18n";
import { BookingLanguagePicker } from "@/pages/booking/components/booking-language-picker";

/** Public shell for booking pages: no app chrome, page scrolls itself (html/body are overflow hidden). */
const PublicBookingLayout: FC = () => {
    const { t } = useTranslation();

    return (
        // Calendar month/weekday names follow the selected language, not only the browser's.
        <I18nProvider locale={getCurrentLanguage()}>
            <div className="h-full min-h-0 overflow-y-auto bg-background text-foreground">
                <div className="flex min-h-full flex-col">
                    <div className="mx-auto flex w-full max-w-6xl justify-end px-4 pt-4 sm:pt-6">
                        <BookingLanguagePicker />
                    </div>
                    <main className="flex flex-1 justify-center px-4 py-6 sm:py-10">
                        <div className="w-full max-w-6xl">
                            <Outlet />
                        </div>
                    </main>
                    <footer className="flex items-center justify-center gap-2 px-4 pb-6 text-xs text-muted">
                        <AppLogo className="size-4" />
                        <span>{t("booking.poweredBy", { name: environments.APP_NAME })}</span>
                    </footer>
                </div>
            </div>
        </I18nProvider>
    );
};

export default PublicBookingLayout;
