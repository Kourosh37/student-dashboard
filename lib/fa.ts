import type {
  ExamStatus,
  ExamType,
  PlannerCadence,
  PlannerPriority,
  PlannerStatus,
  Weekday,
} from "@/types/dashboard";

const weekdayMap: Record<Weekday, string> = {
  MONDAY: "Ø¯ÙˆØ´Ù†Ø¨Ù‡",
  TUESDAY: "Ø³Ù‡ Ø´Ù†Ø¨Ù‡",
  WEDNESDAY: "Ú†Ù‡Ø§Ø±Ø´Ù†Ø¨Ù‡",
  THURSDAY: "Ù¾Ù†Ø¬Ø´Ù†Ø¨Ù‡",
  FRIDAY: "Ø¬Ù…Ø¹Ù‡",
  SATURDAY: "Ø´Ù†Ø¨Ù‡",
  SUNDAY: "ÛŒÚ©Ø´Ù†Ø¨Ù‡",
};

const plannerStatusMap: Record<PlannerStatus, string> = {
  TODO: "Ø¨Ø±Ø§ÛŒ Ø§Ù†Ø¬Ø§Ù…",
  IN_PROGRESS: "Ø¯Ø± Ø­Ø§Ù„ Ø§Ù†Ø¬Ø§Ù…",
  DONE: "Ø§Ù†Ø¬Ø§Ù… Ø´Ø¯Ù‡",
  ARCHIVED: "Ø¨Ø§ÛŒÚ¯Ø§Ù†ÛŒ",
};

const plannerPriorityMap: Record<PlannerPriority, string> = {
  LOW: "Ú©Ù…",
  MEDIUM: "Ù…ØªÙˆØ³Ø·",
  HIGH: "Ø²ÛŒØ§Ø¯",
  URGENT: "ÙÙˆØ±ÛŒ",
};

const plannerCadenceMap: Record<PlannerCadence, string> = {
  DAILY: "Ø±ÙˆØ²Ø§Ù†Ù‡",
  WEEKLY: "Ù‡ÙØªÚ¯ÛŒ",
  MONTHLY: "Ù…Ø§Ù‡Ø§Ù†Ù‡",
};

const examTypeMap: Record<ExamType, string> = {
  MIDTERM: "Ù…ÛŒØ§Ù† ØªØ±Ù…",
  FINAL: "Ù¾Ø§ÛŒØ§Ù† ØªØ±Ù…",
  QUIZ: "Ú©ÙˆÛŒÛŒØ²",
  PROJECT: "Ù¾Ø±ÙˆÚ˜Ù‡",
  PRESENTATION: "Ø§Ø±Ø§Ø¦Ù‡",
  ASSIGNMENT: "ØªÚ©Ù„ÛŒÙ",
  OTHER: "Ø³Ø§ÛŒØ±",
};

const examStatusMap: Record<ExamStatus, string> = {
  SCHEDULED: "Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø±ÛŒØ²ÛŒ Ø´Ø¯Ù‡",
  COMPLETED: "Ø¨Ø±Ú¯Ø²Ø§Ø± Ø´Ø¯Ù‡",
  MISSED: "Ø§Ø² Ø¯Ø³Øª Ø±ÙØªÙ‡",
};

export function weekdayLabel(value: Weekday | "") {
  if (!value) return "Ù‡Ù…Ù‡ Ø±ÙˆØ²Ù‡Ø§";
  return weekdayMap[value];
}

export function plannerStatusLabel(value: PlannerStatus | "") {
  if (!value) return "Ù‡Ù…Ù‡ ÙˆØ¶Ø¹ÛŒØª Ù‡Ø§";
  return plannerStatusMap[value];
}

export function plannerPriorityLabel(value: PlannerPriority) {
  return plannerPriorityMap[value];
}

export function plannerCadenceLabel(value: PlannerCadence | "") {
  if (!value) return "Ù‡Ù…Ù‡ Ø¨Ø§Ø²Ù‡ Ù‡Ø§";
  return plannerCadenceMap[value];
}

export function examTypeLabel(value: ExamType) {
  return examTypeMap[value];
}

export function examStatusLabel(value: ExamStatus | "") {
  if (!value) return "Ù‡Ù…Ù‡ ÙˆØ¶Ø¹ÛŒØª Ù‡Ø§";
  return examStatusMap[value];
}

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

