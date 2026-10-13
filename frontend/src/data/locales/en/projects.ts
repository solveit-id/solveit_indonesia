import type { ProjectKey } from "~/data/projects";
import type { ProjectCategory, ProjectCopy } from "~/types/content";

/** Demonstration concepts only: `results` stays empty (see src/data/projects.ts). */
export const projects: Record<ProjectKey, ProjectCopy> = {
  "sistem-antrean-klinik": {
    title: "Clinic Queue and Medical Records System",
    sector: "Healthcare",
    summary:
      "A concept system that brings a primary care clinic's registration, queue, and medical records into one flow.",
    context:
      "A primary care clinic with one registration desk and several examination rooms. Registrations are written in a book, the queue is called out by hand, and patient histories sit in paper folders.",
    problem:
      "Patients have no idea how long they will wait, staff write the same details again and again, and doctors struggle to see previous visits.",
    solution:
      "Online and walk-in registrations join a single queue. A waiting room screen shows the number being called, while doctors open the patient's record from the examination room.",
    flow: [
      "Patient registers",
      "Queue number issued",
      "Called to the examination room",
      "Doctor records the examination",
      "History is saved",
    ],
    features: [
      {
        name: "Multi-department queue",
        description: "One queue per department, with a calling screen for the waiting room.",
      },
      {
        name: "Electronic medical records",
        description: "Visit history, diagnoses, and treatments on a single patient page.",
      },
      {
        name: "User roles",
        description: "Separate access for registration staff, doctors, and clinic managers.",
      },
      { name: "Daily reports", description: "Exportable visit summaries per department." },
    ],
    system: {
      actors: [
        "Registration desk",
        "Queue and calling screen",
        "Examination room",
        "Medical records",
      ],
      handoffs: ["Patient details", "Number called", "Examination notes"],
    },
    results: [],
    metricsToTrack: [
      "Average patient waiting time",
      "Registration time per patient",
      "Completeness of medical records",
    ],
  },
  "pemesanan-katering-harian": {
    title: "Daily Catering Ordering Platform",
    sector: "Food and small business",
    summary:
      "A concept web app for a home catering business: weekly menus, subscription orders, and kitchen production summaries.",
    context:
      "A catering business that takes orders through chat messages. Every night the owner tallies orders by hand to plan ingredient shopping and portion counts.",
    problem:
      "Orders slip through, menu changes are hard to announce, and manual tallies eat up time that should go into cooking.",
    solution:
      "Customers choose menus and subscription days from their phones. The system builds the daily portion summary and the delivery list automatically.",
    flow: [
      "Weekly menu published",
      "Customer orders",
      "Order confirmed",
      "Production summary built",
      "Order delivered",
    ],
    features: [
      { name: "Weekly menu", description: "Menu management with daily portion quotas." },
      { name: "Subscriptions", description: "Recurring orders covering several days at once." },
      {
        name: "Kitchen summary",
        description: "Portion counts and ingredient needs per production date.",
      },
      { name: "Delivery list", description: "An ordered list of delivery addresses for couriers." },
    ],
    system: {
      actors: ["Customer", "Menu and orders", "Kitchen", "Courier"],
      handoffs: ["Menu choices", "Portion summary", "Delivery list"],
    },
    results: [],
    metricsToTrack: [
      "Orders missed per week",
      "Time spent on the daily tally",
      "Active subscribers",
    ],
  },
  "inventori-gudang-distribusi": {
    title: "Distribution Warehouse Inventory Integration",
    sector: "Distribution and logistics",
    summary:
      "A concept for software that connects warehouse stock, incoming orders, and shipping through barcode scanning.",
    context:
      "A distributor with two warehouses that track stock in separate spreadsheets. Orders from the sales team are checked by hand against each warehouse.",
    problem:
      "Stock discrepancies only surface when goods are about to ship, and the sales team cannot see actual stock without calling the warehouse.",
    solution:
      "Every item in and out is scanned. Stock for both warehouses appears on one screen, and orders are routed automatically to the warehouse that has enough stock.",
    flow: [
      "Incoming goods scanned",
      "Stock updated",
      "Order received",
      "Warehouse chosen automatically",
      "Outgoing goods scanned",
    ],
    features: [
      {
        name: "Barcode scanning",
        description: "Record goods in and out from handheld devices.",
      },
      {
        name: "Multi-warehouse stock",
        description: "Stock positions for every warehouse in one view.",
      },
      {
        name: "Order allocation",
        description: "Rules that pick a warehouse based on stock and location.",
      },
      { name: "Movement history", description: "An audit trail for every stock change." },
    ],
    system: {
      actors: ["Warehouse scanner", "Multi-warehouse stock", "Order allocation", "Shipping"],
      handoffs: ["Goods in and out", "Stock position", "Chosen warehouse"],
    },
    results: [],
    metricsToTrack: [
      "Stock discrepancies at stocktake",
      "Time spent checking stock",
      "Orders delayed by stock",
    ],
  },
  "portal-akademik-sekolah": {
    title: "School Academic Portal",
    sector: "Education",
    summary:
      "A concept academic information system for timetables, grades, and communication between the school, teachers, and parents.",
    context:
      "A secondary school that shares timetables and grades on printed sheets, while announcements are scattered across many chat groups.",
    problem:
      "Parents often miss information, teachers enter grades in several formats, and compiling report cards takes up the end of every semester.",
    solution:
      "Teachers enter grades in one place, report cards are compiled automatically, and parents receive announcements and their child's progress through the portal.",
    flow: [
      "Timetable prepared",
      "Teachers enter grades",
      "Report cards compiled",
      "Parents follow progress",
      "Announcements sent",
    ],
    features: [
      {
        name: "Timetables and classes",
        description: "Manage class groups, subjects, and timetables.",
      },
      { name: "Grading", description: "Grade entry per competency with automatic summaries." },
      { name: "Parent portal", description: "Access to a child's grades and attendance." },
      {
        name: "Announcements",
        description: "School news that reaches the right groups.",
      },
    ],
    system: {
      actors: ["Teacher", "Grades and timetable", "Report card", "Parent portal"],
      handoffs: ["Grade entry", "Automatic summary", "Child's progress"],
    },
    results: [],
    metricsToTrack: [
      "Time to compile report cards",
      "Announcement read rate",
      "Grade completeness per semester",
    ],
  },
  "profil-perusahaan-manufaktur": {
    title: "Manufacturer Company Profile Website",
    sector: "Manufacturing",
    summary:
      "A concept company profile website for a component manufacturer: a catalogue of production capabilities, certifications, and a request-for-quote path.",
    context:
      "A manufacturer that has relied on PDF brochures and personal networks. Prospective buyers struggle to find information on capacity and product types.",
    problem:
      "Product information cannot be found on search engines, and quote requests arrive without enough detail to act on.",
    solution:
      "A website with a structured capability catalogue, a page for each product line, and a quote request form that asks for technical details up front.",
    flow: [
      "Buyer searches",
      "Finds a product line",
      "Reads the specifications",
      "Requests a quote",
      "Sales team follows up",
    ],
    features: [
      {
        name: "Capability catalogue",
        description: "Browsable product lines, materials, and production processes.",
      },
      {
        name: "Quote requests",
        description: "A guided form with technical drawing attachments.",
      },
      {
        name: "Technical SEO",
        description: "Page structure and structured data for every product line.",
      },
      {
        name: "Content management",
        description: "The internal team updates the catalogue without a developer.",
      },
    ],
    system: {
      actors: ["Prospective buyer", "Capability catalogue", "Quote request", "Sales team"],
      handoffs: ["Search", "Specifications", "Complete technical details"],
    },
    results: [],
    metricsToTrack: [
      "Complete quote requests",
      "Visits from search engines",
      "Sales team response time",
    ],
  },
};

export const categories: Record<ProjectCategory, string> = {
  website: "Website",
  "aplikasi-web": "Web app",
  "sistem-informasi": "Information system",
  "custom-software": "Custom software",
};
