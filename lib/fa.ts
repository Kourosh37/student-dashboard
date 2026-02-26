import type {
  ExamStatus,
  ExamType,
  PlannerPriority,
  PlannerStatus,
  Weekday,
} from "@/types/dashboard";

const weekdayMap: Record<Weekday, string> = {
  MONDAY: "دوشنبه",
  TUESDAY: "سه شنبه",
  WEDNESDAY: "چهارشنبه",
  THURSDAY: "پنجشنبه",
  FRIDAY: "جمعه",
  SATURDAY: "شنبه",
  SUNDAY: "یکشنبه",
};

const plannerStatusMap: Record<PlannerStatus, string> = {
  TODO: "برای انجام",
  IN_PROGRESS: "در حال انجام",
  DONE: "انجام شده",
  ARCHIVED: "بایگانی",
};

const plannerPriorityMap: Record<PlannerPriority, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "زیاد",
  URGENT: "فوری",
};

const examTypeMap: Record<ExamType, string> = {
  MIDTERM: "میان ترم",
  FINAL: "پایان ترم",
  QUIZ: "کوییز",
  PROJECT: "پروژه",
  PRESENTATION: "ارائه",
  ASSIGNMENT: "تکلیف",
  OTHER: "سایر",
};

const examStatusMap: Record<ExamStatus, string> = {
  SCHEDULED: "برنامه ریزی شده",
  COMPLETED: "برگزار شده",
  MISSED: "از دست رفته",
};

export function weekdayLabel(value: Weekday | "") {
  if (!value) return "همه روزها";
  return weekdayMap[value];
}

export function plannerStatusLabel(value: PlannerStatus | "") {
  if (!value) return "همه وضعیت ها";
  return plannerStatusMap[value];
}

export function plannerPriorityLabel(value: PlannerPriority) {
  return plannerPriorityMap[value];
}

export function examTypeLabel(value: ExamType) {
  return examTypeMap[value];
}

export function examStatusLabel(value: ExamStatus | "") {
  if (!value) return "همه وضعیت ها";
  return examStatusMap[value];
}

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("fa-IR");
}

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("fa-IR");
}
