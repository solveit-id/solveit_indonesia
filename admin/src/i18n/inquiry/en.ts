import type { InquiryMessages } from "./id";

/** Inquiry console copy, English. Same structure as inquiry/id.ts. */
export const inquiryEn: InquiryMessages = {
  status: {
    received: "New",
    "in-review": "In review",
    contacted: "Contacted",
    closed: "Closed",
  },
  statusDetail: {
    received: "Just arrived from the website; nobody has picked it up yet.",
    "in-review": "The team is reviewing it.",
    contacted: "The team has reached the sender.",
    closed: "Done: answered, not a fit, or spam. Can be reopened for review.",
  },
  service: {
    website: "Website",
    "aplikasi-web": "Web app",
    "sistem-informasi": "Information system",
    "custom-software": "Custom software",
    "dukungan-teknis": "Technical support",
  },
  budget: {
    "belum-tahu": "Not sure yet",
    "di-bawah-10jt": "Under IDR 10 million",
    "10-50jt": "IDR 10 to 50 million",
    "50-150jt": "IDR 50 to 150 million",
    "di-atas-150jt": "Over IDR 150 million",
  },
  timeline: {
    fleksibel: "Flexible",
    "1-3-bulan": "Within 1 to 3 months",
    segera: "As soon as possible",
  },
  contactType: {
    email: "Email",
    phone: "Phone or WhatsApp",
  },
  inquiry: {
    you: "You",
    accountNumber: (id: number) => `Account #${id}`,
    unknownAccount: "Unknown account",
    forbiddenTitle: "No inquiry access",
    forbiddenBody:
      "The server does not let this account read inquiries. If your role or permissions just changed, sign in again so the console uses the current ones.",
    toHome: "Go to the console home",
    clearFilters: "Clear filters",
    refreshing: "Updating the list",
    filterRefused:
      "The server refused this filter or page marker. Clear the filters and try again; no data was changed.",
    privacy:
      "Inquiries are personal data. How long they are kept, and how they are exported or deleted, is not decided by the owner yet; until then the console exports and deletes nothing.",
  },
  list: {
    title: "Inquiries",
    lede: "Messages sent to the server through the website form, newest first. Contacts are always masked, and the message is only shown on the detail.",
    listLabel: "Inquiry list",
    filtersTitle: "Filter inquiries",
    status: "Status",
    allStatuses: "All statuses",
    service: "Service",
    allServices: "All services",
    from: "Received from",
    to: "Received until",
    dateHint: "In this device's time zone.",
    rangeInvalid: "The end date cannot be before the start date.",
    reference: "Reference number",
    referenceHint: "Exactly as the sender received it, for example INQ-7K3M-9QX2-HD4T.",
    referenceInvalid:
      "Write the full reference number: INQ- and three groups of four letters or digits, separated by hyphens.",
    find: "Find",
    columns: {
      sender: "Sender",
      reference: "Reference",
      service: "Service",
      status: "Status",
      received: "Received",
    },
    showing: (count: number, more: boolean) =>
      more
        ? `Showing the ${count} newest ${count === 1 ? "inquiry" : "inquiries"}.`
        : `Showing ${count} ${count === 1 ? "inquiry" : "inquiries"}.`,
    loading: "Loading inquiries",
    loadFailed: "The inquiry list could not be loaded.",
    emptyFiltered: "No matching inquiries",
    emptyFilteredBody: "No inquiry matches these filters. Change or clear them.",
    empty: "No inquiries yet",
    emptyBody: "Inquiries sent to the server through the website form appear here, newest first.",
    loadMore: "Load older inquiries",
  },
  detail: {
    back: "Inquiries",
    loading: "Loading the inquiry",
    loadFailed: "The inquiry could not be loaded.",
    notFoundTitle: "Inquiry not found",
    notFoundBody:
      "There is no inquiry at this address. Check the link, or go back to the inquiry list.",
    submissionTitle: "Submission",
    submissionNote: "As the visitor sent it; the console cannot change it.",
    reference: "Reference",
    name: "Name",
    organization: "Organisation",
    noOrganization: "Not given",
    contact: "Contact",
    service: "Service",
    budget: "Budget",
    timeline: "Timeline",
    received: "Received",
    updated: "Updated",
    messageTitle: "Message",
    messageNote:
      "Written by the visitor and may hold personal data, including numbers or addresses that are not masked. Do not copy it to other channels without a need.",
    statusTitle: "Status",
    statusNote: "For the team only; the sender never sees this status.",
    move: {
      "in-review": "Mark as in review",
      contacted: "Mark as contacted",
      closed: "Close the inquiry",
    },
    reopen: "Reopen for review",
    movesNote: "Every move is recorded in the status history and the audit log under your name.",
    noMoves: "No status move is available from here.",
    cannotChange: "Your account is not allowed to change inquiry statuses.",
    confirmTitle: (to: string) => `Move to ${to}?`,
    confirmBody: (from: string, to: string) =>
      `The status changes from ${from} to ${to}. The change is recorded in the status history and the audit log under your name.`,
    changing: "Changing the status",
    changed: (to: string) => `The inquiry is now ${to}.`,
    changedSame: (to: string) => `This inquiry is already ${to}; no new change was recorded.`,
    reloaded: (to: string) =>
      `The status was reloaded from the server: it is now ${to}. Check it, then decide again.`,
    uncertain:
      "The server gave no clear answer, so the status may have changed. Check the inquiry before you try again.",
    checkState: "Check the inquiry",
    checking: "Checking",
    checked: (to: string) => `The status the server holds now: ${to}.`,
    auditLink: "See its events in the audit log",
  },
  contact: {
    reveal: "Open the full contact",
    cannotReveal: "Your account is not allowed to open full contacts.",
    revealTitle: "Open the full contact?",
    revealBody:
      "The full contact is personal data. Every opening is recorded in the audit log under your name, also when you open the same contact again. The console shows it on this screen only and does not keep it.",
    acknowledge: "I am opening this contact to follow up on this inquiry",
    acknowledgeRequired: "Tick the statement above before opening the contact.",
    revealing: "Opening the contact",
    reauthBody:
      "Opening a full contact needs a password confirmation from the last 15 minutes. The contact is not open yet and nothing has been recorded.",
    revealed: (time: string) =>
      `The full contact was opened and recorded in the audit log at ${time}.`,
    fullLabel: "Full contact",
    onlyHere:
      "Shown on this screen only while you keep it open; not stored in the browser or in the page address.",
    copy: "Copy the contact",
    hide: "Hide",
    hidden: "The full contact is hidden again. Opening it again is recorded as a new opening.",
    hiddenAway:
      "The full contact was hidden because this tab was left. Opening it again is recorded as a new opening.",
    notShownAway:
      "The opening was recorded in the audit log, but the contact is not shown because this tab was left before the answer arrived. Open it again if you still need it; that is recorded as a new opening.",
    uncertain:
      "The contact could not be opened because the server gave no clear answer. If the server recorded the opening, that record stays in the audit log. Open it again if you still need it.",
  },
  history: {
    title: "Status history",
    body: "Every status move, newest first. The history cannot be changed or deleted.",
    loading: "Loading the status history",
    loadFailed: "The status history could not be loaded.",
    empty: "No status moves yet",
    emptyBody: "This inquiry has not moved since it was received.",
    move: (from: string, to: string) => `${from} to ${to}`,
    by: "By",
    showing: (count: number, more: boolean) =>
      more
        ? `Showing the ${count} newest ${count === 1 ? "move" : "moves"}.`
        : `Showing ${count} ${count === 1 ? "move" : "moves"}.`,
    loadMore: "Load older history",
  },
  notes: {
    title: "Internal notes",
    body: "For the team only, never sent to the sender. Notes cannot be edited or deleted; a correction is written as a new note.",
    field: "New note",
    hint: (left: number) =>
      `${left} characters left. Write only what the team needs; never a password.`,
    missing: "Write the note first.",
    tooLong: "A note can be at most 2000 characters.",
    add: "Add note",
    adding: "Saving the note",
    added: "Note added.",
    cannotAdd: "Your account is not allowed to add notes.",
    resend:
      "The session safeguard was refreshed and the note was not processed. Press Add note once more if you still want to save it.",
    forbidden:
      "The server refused this note for your account. Your permissions may have just changed; the account is reloaded.",
    gone: "This inquiry no longer exists on the server, so the note was not saved.",
    serverInvalid: "The server refused this note. Check its length, then try again.",
    uncertain:
      "The server gave no clear answer, so this note may already be saved. Check the notes before sending it again; the text stays in the field.",
    check: "Check the notes",
    checking: "Checking",
    checkFound: (id: number) =>
      `Your note is saved as note #${id}: a new note from your account with this text appeared after the attempt. The field was cleared; nothing needs to be sent again.`,
    checkAgain: "Check again",
    notSeen:
      "This note is not among the newest notes yet, but the outcome is still unknown: the server may still be finishing it. Check again in a moment. If you are sure it was not saved, send it again on purpose; a duplicate note cannot be deleted.",
    ambiguous:
      "A note from your account with the same text exists, but the console cannot tell whether it is this attempt, because the notes had not loaded when you sent it. Check the list below before you decide; a duplicate note cannot be deleted.",
    sendAgain: "Send again",
    discard: "Drop this text",
    discarded:
      "The note text was dropped from the field. If the earlier attempt was saved after all, it stays in the list.",
    heldHint: "This text is held until the earlier attempt's outcome is clear.",
    loading: "Loading notes",
    loadFailed: "The notes could not be loaded.",
    empty: "No notes yet",
    emptyBody: "The team's notes on this inquiry appear here, newest first.",
    by: "By",
    showing: (count: number, more: boolean) =>
      more
        ? `Showing the ${count} newest ${count === 1 ? "note" : "notes"}.`
        : `Showing ${count} ${count === 1 ? "note" : "notes"}.`,
    loadMore: "Load older notes",
  },
};
