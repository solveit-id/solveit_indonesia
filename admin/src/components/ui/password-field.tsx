import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlash } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { type ComponentProps, useState } from "react";
import { useI18n } from "~/i18n/i18n";
import { TextField } from "./text-field";

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, "type" | "trailing">;

/**
 * A password input with a visibility toggle inside the capsule. The toggle is a real button
 * with a stable name and `aria-pressed`, so the state is spoken, not only drawn. Showing the
 * password never copies it anywhere; the value stays in the input.
 */
export function PasswordField(props: PasswordFieldProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      trailing={
        <button
          type="button"
          aria-pressed={visible}
          aria-label={t.common.showPassword}
          onClick={() => setVisible((current) => !current)}
          className="inline-flex size-10 items-center justify-center rounded-full text-ink-muted transition-colors duration-[var(--dur-state)] hover:bg-paper-sunken hover:text-ink"
        >
          {visible ? (
            <EyeSlash aria-hidden size={20} weight="bold" />
          ) : (
            <Eye aria-hidden size={20} weight="bold" />
          )}
        </button>
      }
    />
  );
}
