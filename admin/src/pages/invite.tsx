import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useVerifiedAccount } from "~/auth/use-account";
import { OneTimeLinkReveal } from "~/components/admin/one-time-link-reveal";
import {
  ForbiddenState,
  PageHeader,
  hasPermission,
  refreshAccount,
} from "~/components/admin/owner-ui";
import {
  type SensitiveAction,
  SensitiveActionDialog,
} from "~/components/admin/sensitive-action-dialog";
import { Button } from "~/components/ui/button";
import { Notice, type NoticeTone } from "~/components/ui/notice";
import { TextField } from "~/components/ui/text-field";
import { useOwnerI18n } from "~/i18n/owner";
import { cn } from "~/lib/cn";
import { paths } from "~/routes/paths";
import { type AdminRole, isAdminApiError } from "~/services/admin-api";
import { type AdminInvitationIssued, administrationApi } from "~/services/admin-api/owner";

/** Laravel's limit (`max:254`); the full RFC check stays with Laravel. */
const EMAIL_MAX = 254;
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
/** Laravel normalises the same way, so the uncertain-outcome check compares like with like. */
const normalise = (value: string) => value.trim().toLowerCase();

interface Message {
  tone: NoticeTone;
  text: string;
}

type Issued = { email: string; result: AdminInvitationIssued };

/**
 * Invite an admin (B3.2c, `POST invitations`). The form is reviewed in the confirmation dialog
 * (which also handles the 423 password step), and the 201's link is shown once by
 * OneTimeLinkReveal. No email is sent: the owner hands the link over (owner decision
 * 2026-10-16). An uncertain outcome is resolved by reading the waiting invitations, never by
 * sending the invitation again.
 */
export function Invite() {
  const { t } = useOwnerI18n();
  const account = useVerifiedAccount();
  const back = { to: paths.invitations, label: t.invite.back };

  if (!hasPermission(account, "users.invite")) {
    return (
      <article>
        <PageHeader back={back} title={t.invite.title} />
        <div className="mt-10">
          <ForbiddenState />
        </div>
      </article>
    );
  }

  return <InviteFlow />;
}

function InviteFlow() {
  const { t } = useOwnerI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");
  const [errors, setErrors] = useState<{ email?: string; role?: string }>({});
  const [reviewing, setReviewing] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [uncertainFor, setUncertainFor] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  // Bumped when Laravel refused a field: focus goes there after the dialog has closed (a parent
  // effect runs after the dialog's own, which returns focus to its opener).
  const [refusedField, setRefusedField] = useState(0);
  const roleId = useId();

  useEffect(() => {
    if (refusedField > 0) {
      emailRef.current?.focus();
    }
  }, [refusedField]);
  const copy = t.invite;

  const review = (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    const problem =
      value === ""
        ? copy.emailMissing
        : value.length > EMAIL_MAX
          ? copy.emailTooLong
          : !looksLikeEmail(value)
            ? copy.emailInvalid
            : undefined;

    setErrors({ email: problem });

    if (problem) {
      emailRef.current?.focus();

      return;
    }

    setMessage(null);
    setUncertainFor(null);
    setReviewing(true);
  };

  const target = normalise(email);

  const action: SensitiveAction<AdminInvitationIssued> = {
    title: copy.confirmTitle,
    description: copy.confirmBody(target, t.roles[role]),
    confirmLabel: copy.confirm,
    busyLabel: copy.creating,
    run: () => administrationApi.invite({ email: target, role }),
    onDone: (result) => {
      setReviewing(false);
      setIssued({ email: result.invitation.account?.email ?? target, result });
      setEmail("");
    },
    onUncertain: () => {
      setReviewing(false);
      setUncertainFor(target);
    },
    onForbidden: () => void refreshAccount(),
    onValidation: (error) => {
      const found = {
        email: error.fieldErrors.email ? copy.serverInvalid : undefined,
        role: error.fieldErrors.role ? copy.serverInvalid : undefined,
      };

      if (found.email || found.role) {
        // Back to the form, at the field Laravel named.
        setErrors(found);
        setReviewing(false);
        setRefusedField((value) => value + 1);

        return null;
      }

      return copy.serverInvalid;
    },
  };

  /** Did the uncertain invitation happen? Read the waiting invitations for the address. */
  const check = async () => {
    if (uncertainFor === null) {
      return;
    }

    setChecking(true);

    try {
      const page = await administrationApi.listInvitations({ status: "pending" }, { perPage: 100 });
      const found = page.data.some((invitation) => invitation.account?.email === uncertainFor);

      setMessage({
        tone: found ? "warning" : "info",
        text: found
          ? copy.checkFound(uncertainFor)
          : page.meta.next_cursor === null
            ? copy.checkNotFound(uncertainFor)
            : copy.checkPartial(uncertainFor),
      });
      setUncertainFor(null);
    } catch (error) {
      if (!(isAdminApiError(error) && error.kind === "unauthenticated")) {
        setMessage({ tone: "danger", text: t.errors.unreachable });
      }
    } finally {
      setChecking(false);
    }
  };

  if (issued) {
    return (
      <article>
        <PageHeader title={copy.title} />
        <div className="mt-8 max-w-[52rem]">
          <OneTimeLinkReveal
            link={issued.result.access_link}
            title={t.linkReveal.invitationTitle(issued.email)}
            lost={t.linkReveal.lostInvitation}
            onDone={() => navigate(paths.invitations)}
          />
        </div>
      </article>
    );
  }

  return (
    <article>
      <PageHeader
        back={{ to: paths.invitations, label: copy.back }}
        title={copy.title}
        lede={copy.lede}
      />

      <div className="mt-8 grid max-w-[34rem] gap-4">
        {uncertainFor ? (
          <Notice
            tone="warning"
            action={
              <Button
                busy={checking}
                busyLabel={copy.checking}
                icon={<MagnifyingGlass aria-hidden size={18} weight="bold" />}
                onClick={() => void check()}
              >
                {copy.check}
              </Button>
            }
          >
            {copy.uncertain}
          </Notice>
        ) : null}
        {message ? (
          <Notice
            tone={message.tone}
            action={
              <Link to={paths.invitations} className="btn btn-secondary">
                {copy.toInvitations}
                <ArrowRight aria-hidden size={18} weight="bold" />
              </Link>
            }
          >
            {message.text}
          </Notice>
        ) : null}
      </div>

      <form noValidate onSubmit={review} className="mt-8 grid max-w-[34rem] gap-8">
        <TextField
          ref={emailRef}
          label={copy.email}
          hint={copy.emailHint}
          type="email"
          name="invite-email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          required
          maxLength={EMAIL_MAX + 20}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />

        <fieldset
          className="grid gap-3"
          aria-describedby={errors.role ? `${roleId}-error` : undefined}
        >
          <legend className="mb-1 text-[0.9375rem] font-semibold">{copy.role}</legend>
          {(["admin", "owner"] as const).map((option) => (
            <label
              key={option}
              className={cn(
                "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 rounded-[1.25rem] border px-5 py-4 transition-colors duration-[var(--dur-state)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
                role === option
                  ? "border-ink bg-paper-raised"
                  : "border-line-strong hover:border-ink-muted",
              )}
            >
              <input
                type="radio"
                name="invite-role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
                className="row-span-2 radio-input mt-0.5"
              />
              <span className="font-semibold text-ink">{copy.roleOptions[option].title}</span>
              <span className="mt-0.5 text-[0.9375rem] text-ink-muted">
                {copy.roleOptions[option].detail}
              </span>
            </label>
          ))}
          {errors.role ? (
            <p id={`${roleId}-error`} role="alert" className="text-meta font-medium text-danger">
              {errors.role}
            </p>
          ) : null}
        </fieldset>

        <div>
          <Button
            type="submit"
            variant="primary"
            icon={<ArrowRight aria-hidden size={18} weight="bold" />}
          >
            {copy.review}
          </Button>
        </div>
      </form>

      <SensitiveActionDialog
        open={reviewing}
        action={action as SensitiveAction<unknown>}
        onClose={() => setReviewing(false)}
      />
    </article>
  );
}
