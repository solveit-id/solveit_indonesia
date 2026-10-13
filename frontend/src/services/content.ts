import { content } from "~/data/locales";
import { processStepIds } from "~/data/process";
import { serviceIds } from "~/data/services";
import type { Locale } from "~/i18n/config";
import type { FaqItem, ProcessStep, ProjectCategory, Service, ServiceId } from "~/types/content";

/**
 * Localized content access. Reads the typed local dataset today; when the
 * Laravel API exists these become API calls with the same signatures
 * (docs/integration-plan.md).
 */
export const getServices = (locale: Locale): Service[] =>
  serviceIds.map((id) => ({ id, ...content[locale].services[id] }));

export const getService = (locale: Locale, id: ServiceId): Service => ({
  id,
  ...content[locale].services[id],
});

export const getServiceFaq = (locale: Locale): FaqItem[] => content[locale].serviceFaq;

export const getProcessSteps = (locale: Locale): ProcessStep[] =>
  processStepIds.map((id) => ({ id, ...content[locale].process[id] }));

export const getProcessFaq = (locale: Locale): FaqItem[] => content[locale].processFaq;

export const categoryLabel = (locale: Locale, id: ProjectCategory): string =>
  content[locale].categories[id];
