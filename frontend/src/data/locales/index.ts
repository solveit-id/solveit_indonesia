import type { Locale } from "~/i18n/config";
import type { ProjectKey } from "~/data/projects";
import type {
  FaqItem,
  ProcessStepCopy,
  ProcessStepId,
  ProjectCategory,
  ProjectCopy,
  ServiceCopy,
  ServiceId,
} from "~/types/content";
import * as enProcess from "./en/process";
import * as enProjects from "./en/projects";
import * as enServices from "./en/services";
import * as idProcess from "./id/process";
import * as idProjects from "./id/projects";
import * as idServices from "./id/services";

/** Structured content per language. Records keyed by stable ids keep the languages in step. */
export interface LocaleContent {
  services: Record<ServiceId, ServiceCopy>;
  serviceFaq: FaqItem[];
  process: Record<ProcessStepId, ProcessStepCopy>;
  processFaq: FaqItem[];
  projects: Record<ProjectKey, ProjectCopy>;
  categories: Record<ProjectCategory, string>;
}

export const content: Record<Locale, LocaleContent> = {
  id: { ...idServices, ...idProcess, ...idProjects },
  en: { ...enServices, ...enProcess, ...enProjects },
};
