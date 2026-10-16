import { Moon } from "@phosphor-icons/react/dist/csr/Moon";
import { Sun } from "@phosphor-icons/react/dist/csr/Sun";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { type Locale, useI18n } from "~/i18n/i18n";
import { type Theme, setTheme, useTheme } from "~/lib/theme";

/** Theme and language: display preferences only, the two values kept in browser storage. */
export function PreferenceControls() {
  const { t, locale, setLocale } = useI18n();
  const theme = useTheme();

  return (
    <div className="grid gap-3">
      <SegmentedControl<Theme>
        legend={t.theme.label}
        value={theme}
        onChange={setTheme}
        options={[
          {
            value: "light",
            label: (
              <>
                <Sun aria-hidden size={16} weight="bold" />
                {t.theme.light}
              </>
            ),
          },
          {
            value: "dark",
            label: (
              <>
                <Moon aria-hidden size={16} weight="bold" />
                {t.theme.dark}
              </>
            ),
          },
        ]}
      />
      <SegmentedControl<Locale>
        legend={t.locale.label}
        value={locale}
        onChange={setLocale}
        options={[
          { value: "id", label: "ID", accessibleLabel: t.locale.id, lang: "id" },
          { value: "en", label: "EN", accessibleLabel: t.locale.en, lang: "en" },
        ]}
      />
    </div>
  );
}
