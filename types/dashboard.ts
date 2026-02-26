export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type PlannerStatus = "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
export type PlannerPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type PlannerCadence = "DAILY" | "WEEKLY" | "MONTHLY";
export type ExamType = "MIDTERM" | "FINAL" | "QUIZ" | "PROJECT" | "PRESENTATION" | "ASSIGNMENT" | "OTHER";
export type ExamStatus = "SCHEDULED" | "COMPLETED" | "MISSED";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  studentId: string | null;
  university: string | null;
  major: string | null;
  currentTerm: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type Semester = {
  id: string;
  title: string;
  code: string | null;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    courses: number;
    exams: number;
  };
};

export type CourseSession = {
  id: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room: string | null;
};

export type Course = {
  id: string;
  semesterId: string;
  name: string;
  code: string | null;
  instructor: string | null;
  location: string | null;
  credits: number | null;
  color: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  semester?: {
    id: string;
    title: string;
  };
  sessions?: CourseSession[];
  _count?: {
    files: number;
    exams: number;
  };
};

export type PlannerItem = {
  id: string;
  semesterId: string | null;
  courseId: string | null;
  title: string;
  description: string | null;
  status: PlannerStatus;
  priority: PlannerPriority;
  cadence: PlannerCadence;
  plannedFor: string | null;
  startAt: string | null;
  dueAt: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StudentEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Exam = {
  id: string;
  semesterId: string | null;
  courseId: string | null;
  title: string;
  examType: ExamType;
  status: ExamStatus;
  examDate: string;
  startTime: string | null;
  durationMinutes: number | null;
  location: string | null;
  notes: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  semester?: {
    id: string;
    title: string;
  } | null;
  course?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
};

export type Folder = {
  id: string;
  parentId: string | null;
  name: string;
  color: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files: number;
    children: number;
  };
};

export type FileItem = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  isPinned: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  folder: {
    id: string;
    name: string;
  } | null;
  course: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  semester: {
    id: string;
    title: string;
  } | null;
  plannerItem: {
    id: string;
    title: string;
  } | null;
};

export type ScheduleEntry = {
  sessionId: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room: string | null;
  course: {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
    semesterId: string;
    semesterTitle: string;
  };
};

export type CalendarPlannerEvent = {
  id: string;
  title: string;
  description: string | null;
  status: PlannerStatus;
  priority: PlannerPriority;
  cadence: PlannerCadence;
  plannedFor: string | null;
  startAt: string | null;
  dueAt: string | null;
  isPinned: boolean;
};

export type CalendarUserEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  isPinned: boolean;
};

export type CalendarExamEvent = {
  id: string;
  title: string;
  examType: ExamType;
  status: ExamStatus;
  examDate: string;
  startTime: string | null;
  durationMinutes: number | null;
  location: string | null;
  course: {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
  } | null;
  semester: {
    id: string;
    title: string;
  } | null;
};

export type CalendarSessionEvent = {
  id: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room: string | null;
  course: {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
    semester: {
      id: string;
      title: string;
    };
  };
};

export type ScheduleConflictSource = "CLASS" | "PLANNER" | "EVENT" | "EXAM";

export type ScheduleConflict = {
  source: ScheduleConflictSource;
  id: string;
  title: string;
  startAt: string;
  endAt: string;
};
