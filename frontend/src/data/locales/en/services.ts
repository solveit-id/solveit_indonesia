import type { FaqItem, ServiceCopy, ServiceId } from "~/types/content";

export const services: Record<ServiceId, ServiceCopy> = {
  website: {
    name: "Website Development",
    shortName: "Website",
    summary:
      "Company profiles, landing pages, and catalogues that load fast, are easy to update, and are ready to be found on search engines.",
    forWhom:
      "Businesses and organisations that need a credible online presence, or want to replace an old website that is slow and hard to update.",
    examples: [
      "Company profile",
      "Campaign landing page",
      "Product catalogue",
      "Information portal",
    ],
    deliverables: [
      "Responsive design for phones, tablets, and desktops",
      "Clear page structure and content",
      "Technical SEO essentials: metadata, sitemap, and structured data",
      "Speed and accessibility optimisation",
    ],
  },
  "aplikasi-web": {
    name: "Web Applications",
    shortName: "Web app",
    summary:
      "Browser-based applications for customers or internal teams: portals, dashboards, ordering, and workflows that are still handled by hand.",
    forWhom:
      "Startups and companies that want to move business processes online without installing an app on every device.",
    examples: ["Customer portal", "Ordering system", "Operations dashboard", "Internal tool"],
    deliverables: [
      "User flow and access rights analysis",
      "Interfaces designed for everyday work",
      "API and database integration",
      "Technical documentation for handover",
    ],
  },
  "sistem-informasi": {
    name: "Information Systems",
    shortName: "Information system",
    summary:
      "Systems that record, process, and report operational data, so decisions are made from clean data and a single source of truth.",
    forWhom:
      "Clinics, schools, cooperatives, warehouses, and institutions whose data still lives on paper, in spreadsheets, or in apps that do not talk to each other.",
    examples: ["Inventory", "Academic records", "Clinic and queueing", "Human resources"],
    deliverables: [
      "Data modelling that follows your actual process",
      "User roles with tiered access rights",
      "Reports and data export",
      "User training during rollout",
    ],
  },
  "custom-software": {
    name: "Custom Software",
    shortName: "Custom software",
    summary:
      "Software built for workflows that off-the-shelf products cannot handle: automation, system integration, and API services.",
    forWhom:
      "Teams that have tried generic apps, but whose processes are too specific to fit them without compromise.",
    examples: [
      "System integration",
      "Process automation",
      "API services",
      "Purpose-built internal tools",
    ],
    deliverables: [
      "Process and integration point mapping",
      "An architecture that can grow in stages",
      "Testing against real scenarios",
      "Code and documentation other teams can maintain",
    ],
  },
  "dukungan-teknis": {
    name: "Technical Support and Maintenance",
    shortName: "Technical support",
    summary:
      "Care after launch: security updates, fixes, monitoring, and new features as your needs grow.",
    forWhom:
      "Owners of a website or application who want it to stay secure, run reliably, and keep evolving with the business.",
    examples: ["Security updates", "Bug fixes", "Data backups", "New features"],
    deliverables: [
      "An agreed maintenance schedule",
      "Issue handling by priority",
      "A change log for every update",
      "Recommendations for what to build next",
    ],
  },
};

export const serviceFaq: FaqItem[] = [
  {
    question: "How much does a website or application from Solveit Indonesia cost?",
    answer:
      "Cost depends on scope, the number of features, and the integrations you need. After the consultation and requirements analysis, you receive a written estimate before any work begins.",
  },
  {
    question: "Does Solveit Indonesia work with small businesses?",
    answer:
      "Yes. We work with individuals, small and medium businesses, startups, organisations, and companies. Scope is shaped around your needs and your stage of growth, including building in phases.",
  },
  {
    question: "Can the website or system be extended after it is finished?",
    answer:
      "Yes. We structure the code and documentation so the system is easy to maintain, and we offer technical support and further feature development.",
  },
];
