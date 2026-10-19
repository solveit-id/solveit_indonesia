import type { Messages } from "./id";

/** Interface copy, English. Same structure as id.ts, written for an English-reading admin. */
export const en: Messages = {
  meta: {
    product: "Admin console",
    owner: "Solveit Indonesia",
  },
  shell: {
    skipToContent: "Skip to content",
    consoleName: "Admin console",
    environmentLead: "B4b console",
    environmentDetail: "not deployed",
    navigation: "Main navigation",
    openMenu: "Menu",
    loadingRoute: "Loading page",
    signedInAs: "Signed in as",
    signOut: "Sign out",
    signingOut: "Signing out",
    signOutUncertain:
      "Signing out could not be confirmed because the server did not answer. Try again, or close the browser: the session also ends when the browser closes.",
    preferences: "Display",
    restrictedNote:
      "For invited owners and admins only. Every account signs in with a password and an authenticator app.",
  },
  nav: {
    home: "Home",
    account: "Account",
    security: "Security",
    users: "Users",
    invitations: "Invitations",
    audit: "Audit log",
    inquiries: "Inquiries",
    invite: "Invite an admin",
    reference: "Component reference",
  },
  roles: {
    owner: "Owner",
    admin: "Admin",
    none: "No role",
  },
  theme: {
    label: "Theme",
    toDark: "Switch to dark theme",
    toLight: "Switch to light theme",
    light: "Light",
    dark: "Dark",
  },
  locale: {
    label: "Language",
    id: "Indonesia",
    en: "English",
  },
  common: {
    showPassword: "Show password",
    cancel: "Cancel",
    close: "Close",
    retry: "Try again",
    copied: "Copied.",
    copyFailed: "The browser refused to copy automatically. Select the text and copy it by hand.",
    stepDone: "done",
    stepCurrent: "current step",
    stepNext: "next",
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    notRecorded: "Not recorded",
  },
  errors: {
    rateLimited: (seconds: number) =>
      seconds > 0
        ? `Too many attempts. Try again in ${seconds} seconds.`
        : "The wait is over. You can try again.",
    resendNeeded:
      "The session safeguard was renewed and the server did not process the request. Check the form and send it again.",
    unreachable:
      "The admin server is not answering. Check your connection and try again; nothing is resent automatically.",
    unavailable: "The admin server cannot serve requests right now. Try again shortly.",
    forbidden:
      "The admin security boundary refused this request. Open the console from its official address and try again.",
    unexpected:
      "The server gave an unexpected answer. Try again; if it keeps happening, note the time.",
  },
  signIn: {
    title: "Sign in to the admin console",
    lede: "Enter the email and password of your Solveit admin account, then the code from your authenticator app. Every account needs both steps.",
    stepsLabel: "Sign-in steps",
    steps: ["Email and password", "Authenticator code"],
    email: "Email",
    password: "Password",
    continue: "Continue",
    checking: "Checking",
    emailMissing: "Enter your account email.",
    emailInvalid: "Write the full email address, for example name@company.com.",
    passwordMissing: "Enter your password.",
    rejected:
      "The email or password does not match, or this account cannot sign in yet. Check the spelling and try again.",
    passwordUncertain:
      "The server gave no reliable answer, so you are not signed in. Try again once the connection is back.",
    codeTitle: "Enter your authenticator code",
    codeLede: (email: string) =>
      `The password for ${email} is correct. Open your authenticator app and enter the 6-digit code for the Solveit admin console.`,
    code: "6-digit code",
    codeHint: "The code changes every 30 seconds. Enter it within 5 minutes of the password.",
    recoveryCode: "Recovery code",
    recoveryHint: "One code from the list you saved during activation. Each code works only once.",
    useRecovery: "Use a recovery code",
    useAuthenticator: "Use an authenticator code",
    submit: "Sign in",
    verifying: "Verifying",
    changeAccount: "Use another account",
    codeFormat: "An authenticator code has 6 digits.",
    recoveryMissing: "Enter one recovery code.",
    wrongCode:
      "The code does not match. Wait for the next code in your app and try again, and make sure your device clock is right.",
    wrongRecovery: "The recovery code does not match or has already been used.",
    expired:
      "The sign-in attempt has expired: more than 5 minutes since the password, or the browser session changed. Enter your password again.",
    codeUncertain:
      "The server gave no reliable answer, so this code may already be used up. Check the session before entering a new code.",
    checkSession: "Check session",
    notSignedInYet: "You are not signed in yet. Enter the next code from your app.",
    sessionUnverified:
      "The code was accepted, but the session could not be checked. Check your connection, then check the session again.",
    notices: {
      expired: "Your session has ended. Sign in again to continue.",
      "signed-out": "You have signed out of the console.",
      elsewhere: "You signed out in another tab of this browser.",
    },
    helpTitle: "Cannot sign in?",
    helpAccounts:
      "Admin accounts are created only through an owner's invitation. There is no self sign-up.",
    helpRecovery:
      "Forgot your password, or lost your authenticator and recovery codes? Ask an owner for an access reset link. There is no email recovery.",
  },
  access: {
    pageTitle: "Access link",
    stepsLabel: "Activation steps",
    steps: ["Link", "Password", "Authenticator", "Recovery codes"],
    resetSteps: ["Link", "New password", "New authenticator", "Recovery codes"],
    checkingTitle: "Checking the access link",
    checking: "Checking the link",
    activationTitle: "Activate your admin account",
    resetTitle: "Reset your account access",
    missingTitle: "The access link is incomplete",
    missingBody:
      "This page works only through the complete access link you received. Open the link again exactly as it was sent. Once opened, the link is not kept in the browser, so reloading the page does not use it again.",
    invalidTitle: "This link cannot be used",
    invalidBody:
      "The access link is unknown, has expired, has been used, or has been revoked. Every link works only once.",
    newLinkTitle: "How to get a new link",
    newLinkInvitation: "Invitation: ask the owner who invited you to send a new invitation.",
    newLinkReset: "Access reset: ask another owner to issue a new reset link for your account.",
    newLinkServer:
      "First owner, or when no other owner can sign in: the server operator issues a link with an admin command on the server.",
    inspectFailed:
      "The link could not be checked yet. Checking does not use the link, so it is safe to try again.",
    signedInTitle: "You are signed in on this browser",
    signedInBody:
      "An access link works only while no account is signed in on this browser. Sign out first; the link is then checked again.",
    signOutAndContinue: "Sign out and continue",
    toConsole: "Go to the console",
    forAccount: "For the account",
    validUntil: "Valid until",
    activationLede:
      "Set your name and password. Then you register your authenticator app; the account becomes active once its first code is confirmed.",
    resetLede:
      "This reset replaces your password and authenticator. The old authenticator and recovery codes stopped working when the reset was issued, and the account cannot sign in until this is finished.",
    name: "Name",
    nameHint: "The name owners see in the console. At most 120 characters.",
    nameMissing: "Enter your name.",
    nameTooLong: "The name can have at most 120 characters.",
    newPassword: "New password",
    confirmPassword: "Repeat the new password",
    passwordHint:
      "At least 12 characters and at most 72 bytes (accented letters and emoji take more than one byte). A long phrase you can remember is stronger than a short, complicated word.",
    tooShort: "The password needs at least 12 characters.",
    tooLong: "The password can be at most 72 bytes. Shorten it a little.",
    mismatch: "The two passwords do not match yet.",
    serverRejectedPassword:
      "The server refused this password. Use at least 12 characters and at most 72 bytes, and repeat it exactly.",
    submitNote: "The link is used when you press this button, not before.",
    submit: "Save and continue",
    saving: "Saving",
    redeemUncertain:
      "The server gave no reliable answer, so the link may already be used. Check the link first: if it is still valid, you can send again.",
    checkLink: "Check the link",
    stillValid: "The link is still valid and unused. You can send again.",
  },
  enrollment: {
    title: "Register your authenticator app",
    lede: "Scan the QR code with a time-based (TOTP) authenticator app on your phone, then enter the 6-digit code it shows.",
    qrAlt: "QR code to register the Solveit admin console in an authenticator app",
    manualTitle: "Cannot scan?",
    manualBody: "Enter this key by hand in your authenticator app, as a time-based key.",
    setupKey: "Setup key",
    copyKey: "Copy key",
    deadline: (time: string) => `Finish before ${time}. After that a new link is needed.`,
    shownOnce:
      "This QR code and key are shown only once and are not kept by the console. If the page reloads before you finish, ask for a new link.",
    code: "6-digit code from the app",
    submitActivation: "Confirm and activate the account",
    submitReset: "Confirm the new authenticator",
    confirming: "Confirming",
    wrongCode: "The code does not match. Nothing has changed; enter the next code from your app.",
    gone: "This registration cannot be finished: the time ran out, the link was revoked, or the browser lost its session. Ask for a new link.",
    uncertain:
      "The server gave no reliable answer. Check whether the account is already active before entering a code again.",
    checkAccount: "Check the account",
    notYet: "The account is not active yet. Enter the next code from your app.",
    activeWithoutCodes:
      "The account is active and you are signed in, but its recovery codes cannot be shown again. Create new recovery codes on the Security page now.",
    toSecurity: "Open Security",
  },
  recoveryCodes: {
    title: "Save your recovery codes",
    lede: "Each code signs you in once when your authenticator app is not available. This is the only time they are shown: the console does not keep them and cannot show them again.",
    where:
      "Keep them in a password manager, or print them and store them safely, outside this console and apart from your authenticator device.",
    listLabel: "Recovery codes",
    copyAll: "Copy all codes",
    acknowledge: "I have saved these codes somewhere safe outside the console",
    acknowledgeFirst: "Tick the confirmation above once the codes are saved.",
    continueToConsole: "Continue to the console",
    done: "Done",
    previousInvalid: "Your previous recovery codes no longer work.",
    leaveTitle: "Recovery codes not saved yet",
    leaveBody:
      "If you leave this page now, the codes cannot be shown again and you will have to create new ones.",
    stay: "Stay here",
    leave: "Leave the page",
  },
  home: {
    title: "Console home",
    lede: (name: string, role: string) => `You are signed in as ${name}, ${role}.`,
    sessionTitle: "This session",
    signedInAt: "Signed in at",
    endsBy: "Ends at the latest",
    idleRule: (minutes: number) => `Ends earlier after ${minutes} minutes without activity.`,
    shortcutsTitle: "Your account",
    accountLink: "Account",
    authenticatorOn: "authenticator active",
    authenticatorOff: "authenticator not confirmed",
    securityLink: "Security",
    operationsTitle: "Operations",
    inquiriesLink: "Inquiries",
    inquiriesDetail: "Messages from the website form, their status, and team notes",
    administrationTitle: "Administration",
    usersLink: "Users",
    usersDetail: "Accounts, roles, suspension, and credential resets",
    invitationsLink: "Invitations",
    invitationsDetail: "Activation links for new accounts",
    auditLink: "Audit log",
    auditDetail: "Security and administration events",
    lowCodes: (count: number) =>
      count === 0
        ? "You have no recovery codes left. Create new ones on Security before you need them."
        : `${count} recovery codes left. Create new ones on Security before they run out.`,
  },
  account: {
    title: "Account",
    lede: "Your account as the server records it. Name and email cannot be changed from the console yet.",
    profileTitle: "Profile",
    name: "Name",
    email: "Email",
    role: "Role",
    roleDetail: {
      owner:
        "Manages users, invitations, roles, suspension, and credential resets, reads the audit log, and handles inquiries.",
      admin: "Manages the security of their own account and handles inquiries.",
      none: "An account without a role cannot use the console.",
    },
    authenticatorTitle: "Authenticator",
    totp: "Authenticator app",
    totpActive: (since: string) => `Active since ${since}`,
    totpMissing: "Not confirmed",
    recoveryCodes: "Recovery codes",
    recoveryRemaining: (count: number) => `${count} codes left`,
    sessionTitle: "This session",
    manageSecurity: "Manage security",
  },
  security: {
    title: "Account security",
    lede: "Password, recovery codes, and the devices signed in. Every change is recorded in the audit log.",
    password: {
      title: "Change password",
      body: "Sessions on other devices end when the password changes; this session continues.",
      current: "Current password",
      currentMissing: "Enter your current password.",
      currentWrong: "The current password does not match.",
      newRejected:
        "The server refused the new password: use at least 12 characters, at most 72 bytes, and something different from the old one.",
      submit: "Change password",
      submitting: "Changing",
      changed: (ended: number) =>
        ended === 0
          ? "Password changed. There were no other sessions to end."
          : `Password changed. ${ended} other sessions ended.`,
      uncertain:
        "The server gave no reliable answer, so the password may already be changed. If you send again and the current password is refused, the new one is in effect.",
    },
    recovery: {
      title: "Recovery codes",
      remaining: (count: number) =>
        count === 1 ? "1 recovery code left." : `${count} recovery codes left.`,
      body: "Creating new codes cancels all old ones. The new codes are shown once.",
      action: "Create new recovery codes",
      confirmTitle: "Create new recovery codes?",
      confirmBody:
        "All old recovery codes stop working when new ones are created. Have a safe place ready for the new ones.",
      confirmAction: "Create new codes",
      creating: "Creating codes",
      uncertain:
        "The server gave no reliable answer. The old codes may already have stopped working; create new codes once more so you hold codes that certainly work.",
    },
    reauth: {
      title: "Confirm your password",
      body: "This action needs a password confirmation within the last 15 minutes.",
      password: "Password",
      submit: "Confirm",
      confirming: "Confirming",
      wrong: "The password does not match.",
      confirmedTitle: "Password confirmed",
      confirmedBody:
        "No codes have been created yet. Press the button below to create new recovery codes; the old ones then stop working.",
    },
    sessions: {
      title: "Devices signed in",
      body: "This account's sessions as the server records them. Ending a session makes that device sign in again.",
      loading: "Loading the session list",
      loadFailed: "The session list could not be loaded.",
      current: "This device",
      lastActive: "Last active",
      ipAddress: "IP address",
      browser: "Browser string",
      unknownDevice: "Unrecognised device",
      end: "End session",
      ending: "Ending",
      endAll: "End all other sessions",
      none: "No other sessions. Only this device is signed in.",
      endTitle: "End this session?",
      endBody:
        "That device will have to sign in again with the password and an authenticator code. This session is not affected.",
      endAllTitle: "End all other sessions?",
      endAllBody: "Every other device will have to sign in again. This session continues.",
      ended: "Session ended.",
      endedAll: (count: number) =>
        count === 0 ? "There were no other sessions to end." : `${count} other sessions ended.`,
      alreadyGone: "That session had already ended.",
      uncertain:
        "The server gave no reliable answer. Reload the list to see the current state before trying again.",
      refresh: "Reload the list",
    },
  },
  idle: {
    title: "Your session is about to end",
    body: (time: string) =>
      `There has been no activity in the console for almost 30 minutes. The session ends in ${time} unless you stay signed in.`,
    stay: "Stay signed in",
    staying: "Extending",
    signOut: "Sign out now",
    absoluteTitle: "The 12-hour session limit is near",
    absoluteBody: (time: string) =>
      `This session ends in ${time} and cannot be extended. Finish your work, then sign in again.`,
    understood: "Understood",
  },
  sessionCheck: {
    checking: "Checking the session",
    unavailableTitle: "The session could not be checked",
    unavailableBody:
      "The server gave no reliable answer, so the console shows no account data. Try again shortly.",
    forbiddenTitle: "Request refused",
    forbiddenBody:
      "The admin security boundary refused the session check. No account data is shown. Open the console from its official address.",
    toSignIn: "Go to sign-in",
  },
  phases: {
    title: "Build phases",
    intro: "The admin API and console are released to main but not deployed anywhere.",
    status: {
      released: "Released, not deployed",
      current: "In progress",
      planned: "Planned",
    },
    items: {
      b31a: {
        title: "Backend identity",
        detail:
          "Single-use access links, mandatory TOTP, database sessions, owner and admin roles, append-only audit log.",
      },
      b31b: {
        title: "User administration and audit (API)",
        detail:
          "Invitations, role changes, suspension, credential resets, and owner-only audit reading.",
      },
      b32a: {
        title: "Console foundation",
        detail:
          "Application frame, design system shared with the website, API client with CSRF, native and Docker development, CI.",
      },
      b32b: {
        title: "Sign-in, activation, and recovery",
        detail:
          "Sign-in with password and TOTP, activation and reset through links, own account security.",
      },
      b32c: {
        title: "Administration workspace",
        detail: "Users, invitations, roles, suspension, and the audit log for owners.",
      },
      b32d: {
        title: "Private admin release",
        detail:
          "Production image, separate admin listener (loopback by default), security headers, smoke test.",
      },
      b4a: {
        title: "Inquiry management (API)",
        detail:
          "Masked contacts, a status workflow with history, append-only internal notes, recorded contact reveals.",
      },
      b4b: {
        title: "Inquiry console",
        detail:
          "Inquiry list and detail, collision-safe status changes, team notes, and a deliberate contact reveal.",
      },
    },
  },
  notFound: {
    title: "Page not found",
    body: "This address does not exist in the admin console. Check the spelling, or go back to the console home.",
    back: "Go to the console home",
  },
  error: {
    title: "The page failed to load",
    body: "Something went wrong in the console. Reload the page; if it keeps happening, note the time for investigation.",
    reload: "Reload",
    back: "Go to the console home",
  },
};
