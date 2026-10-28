import type { FC } from "react";
import { ListBox, Select } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { GB, GR } from "country-flag-icons/react/3x2";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, getCurrentLanguage } from "@/lib/i18n";

const FLAGS = { GB, GR } as const;

const Flag: FC<{ country: keyof typeof FLAGS; label: string }> = ({ country, label }) => {
    const Icon = FLAGS[country];
    return <Icon title={label} className="h-3.5 w-5 shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)]" />;
};

/** Compact flag + code switcher for the public booking pages; the choice is remembered in localStorage. */
export const BookingLanguagePicker: FC = () => {
    const { t, i18n } = useTranslation();
    const current = SUPPORTED_LANGUAGES.find((l) => l.code === getCurrentLanguage()) ?? SUPPORTED_LANGUAGES[0];

    return (
        <Select
            aria-label={t("common.language")}
            value={current.code}
            onChange={(key) => {
                if (key) void i18n.changeLanguage(String(key));
            }}
            className="w-auto"
        >
            <Select.Trigger className="h-9 min-h-0 w-auto gap-2 rounded-full bg-surface px-3 text-sm shadow-sm">
                <Flag country={current.country} label={current.label} />
                <span className="font-medium">{current.shortLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 text-muted" aria-hidden />
            </Select.Trigger>
            <Select.Popover className="min-w-44">
                <ListBox>
                    {SUPPORTED_LANGUAGES.map((language) => (
                        <ListBox.Item key={language.code} id={language.code} textValue={language.label}>
                            <span className="flex items-center gap-2.5">
                                <Flag country={language.country} label={language.label} />
                                {language.label}
                            </span>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
};
