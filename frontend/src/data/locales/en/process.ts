import type { FaqItem, ProcessStepCopy, ProcessStepId } from "~/types/content";

export const process: Record<ProcessStepId, ProcessStepCopy> = {
  konsultasi: {
    name: "Consultation",
    description:
      "We talk through your business goals, the problem to solve, who the users are, and any time or budget constraints.",
    output: "A summary of your needs and initial recommendations",
    clientRole: "Explain your goals, constraints, and examples of how the process runs today.",
  },
  analisis: {
    name: "Requirements analysis",
    description:
      "We map the current process, the data involved, and the features that are truly needed for the first phase.",
    output: "Written scope, time estimate, and cost estimate",
    clientRole: "Review the scope and set feature priorities for the first phase.",
  },
  desain: {
    name: "Design",
    description:
      "User flows and interfaces are designed first, so you can see and approve the direction of the product before it is built.",
    output: "User flows and interface designs for approval",
    clientRole: "Give feedback on the design and approve the direction before development.",
  },
  pengembangan: {
    name: "Development",
    description:
      "The system is built in stages. You can review each stage through a preview build, so feedback arrives early.",
    output: "Regular preview access and progress notes",
    clientRole: "Try each preview build and share feedback at every stage.",
  },
  pengujian: {
    name: "Testing",
    description:
      "Features are tested against real scenarios, across devices and screen sizes, including the rare edge cases.",
    output: "Test results and a list of the fixes made",
    clientRole: "Run acceptance testing together with the people who will use the system.",
  },
  implementasi: {
    name: "Launch",
    description:
      "The system goes live in production, initial data is prepared, and your team is shown how to use it.",
    output: "A ready-to-use system, handover, and user guide",
    clientRole: "Prepare the initial data and nominate the users to be trained.",
  },
  dukungan: {
    name: "Support",
    description:
      "After launch, we handle maintenance, security updates, and further development as agreed.",
    output: "Scheduled maintenance and a plan for what comes next",
    clientRole: "Report issues and share new needs as they come up after launch.",
  },
};

export const processFaq: FaqItem[] = [
  {
    question: "How long does it take to build a website or application?",
    answer:
      "Duration depends on scope. A company profile website is usually quicker than an information system or an application with many user roles. The time estimate is part of the written scope you receive after the analysis phase.",
  },
  {
    question: "Can I follow progress during development?",
    answer:
      "Yes. Development happens in stages, and each stage can be reviewed through a preview build. Looking ahead, we plan for progress and revisions to be trackable directly in the Solveit Orbit ecosystem.",
  },
  {
    question: "What happens if I need changes mid-project?",
    answer:
      "Change requests are recorded and compared against the agreed scope. Changes within scope are handled right away, while larger changes are discussed together with their impact on time and cost.",
  },
  {
    question: "What do I receive at the end of the project?",
    answer:
      "A system running in production, administrator access, a user guide, and the technical documentation needed for maintenance.",
  },
];
