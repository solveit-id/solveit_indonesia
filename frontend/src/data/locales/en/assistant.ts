import type { AssistantCopy } from "~/types/assistant";

/** English wording for the automated guide. Same facts as the Indonesian file. */
export const assistant: AssistantCopy = {
  topics: {
    services: {
      label: "Services",
      intro:
        "Solveit Indonesia offers five services, delivered by one team from consultation until the system is in use:",
      keywords: [
        "service",
        "services",
        "website",
        "site",
        "app",
        "application",
        "web app",
        "information system",
        "software",
        "maintenance",
        "support",
        "build",
        "develop",
        "make",
      ],
    },
    consultation: {
      label: "Project consultation",
      intro:
        "An initial consultation maps your needs, priorities, and the most sensible first step for your business. Once you get in touch:",
      keywords: [
        "consultation",
        "consult",
        "start",
        "project",
        "work together",
        "discuss",
        "hire",
        "idea",
      ],
    },
    portfolio: {
      label: "Portfolio",
      intro:
        "The portfolio currently holds concept case studies that show how we think. They are illustrative, not client work; client projects will appear once publication is approved.",
      keywords: [
        "portfolio",
        "example",
        "examples",
        "case study",
        "case studies",
        "client",
        "clients",
        "previous work",
      ],
    },
    process: {
      label: "Process",
      intro:
        "Every project follows seven steps. At each one you know what is being done, what your role is, and what you receive:",
      keywords: ["process", "step", "steps", "stage", "workflow", "how do you work", "method"],
    },
    contact: {
      label: "Contact",
      intro: "You can reach Solveit Indonesia through these official channels:",
      keywords: [
        "contact",
        "reach",
        "whatsapp",
        "email",
        "instagram",
        "phone",
        "number",
        "call",
        "address",
      ],
    },
  },
  faqKeywords: {
    serviceFaq: [
      ["cost", "price", "pricing", "budget", "fee", "expensive", "cheap", "quote", "how much"],
      ["small business", "smes", "sme", "msme", "individual", "startup", "small"],
      ["further development", "extend", "upgrade", "new features", "after launch", "finished"],
    ],
    processFaq: [
      ["how long", "duration", "timeline", "deadline", "time"],
      ["progress", "track", "monitor", "preview"],
      ["revision", "revisions", "change", "changes"],
      ["handover", "end of the project", "documentation", "what do i receive", "deliverables"],
    ],
  },
  greetings: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "test"],
  greetingReply:
    "Hello. Pick a topic below, or ask about services, the process, the portfolio, or how to get in touch.",
  fallback:
    "I cannot answer that from this guide yet. The Solveit Indonesia team can answer it directly on WhatsApp or by email.",
  contactLabels: {
    email: "Email",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    form: "Consultation form",
  },
};
