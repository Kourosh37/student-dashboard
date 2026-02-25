import {
  ExamStatus,
  ExamType,
  PlannerPriority,
  PlannerStatus,
  Weekday,
} from "@prisma/client";

import { prisma } from "../lib/db/prisma";
import { hashPassword } from "../lib/auth/password";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@student-dashboard.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const name = process.env.SEED_ADMIN_NAME ?? "Student User";

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`Seed user already exists: ${email}`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      studentId: "STU-2026-1001",
      university: "Sample University",
      major: "Computer Science",
      currentTerm: "Spring 2026",
      bio: "Student Dashboard demo profile",
    },
  });

  const semester = await prisma.semester.create({
    data: {
      userId: user.id,
      title: "Spring 2026",
      code: "SP26",
      startDate: new Date("2026-01-20T00:00:00.000Z"),
      endDate: new Date("2026-06-20T00:00:00.000Z"),
      isCurrent: true,
      isPinned: true,
    },
  });

  const course = await prisma.course.create({
    data: {
      userId: user.id,
      semesterId: semester.id,
      name: "Algorithms",
      code: "CS301",
      instructor: "Dr. Alice Morgan",
      location: "Engineering Building - Room 202",
      credits: 3,
      color: "#0F766E",
      isPinned: true,
      sessions: {
        create: [
          { weekday: Weekday.MONDAY, startTime: "09:00", endTime: "10:30", room: "E-202" },
          { weekday: Weekday.WEDNESDAY, startTime: "09:00", endTime: "10:30", room: "E-202" },
        ],
      },
    },
  });

  await prisma.exam.create({
    data: {
      userId: user.id,
      semesterId: semester.id,
      courseId: course.id,
      title: "Algorithms Midterm",
      examType: ExamType.MIDTERM,
      status: ExamStatus.SCHEDULED,
      examDate: new Date("2026-03-20T00:00:00.000Z"),
      startTime: "10:00",
      durationMinutes: 120,
      location: "Main Hall",
      isPinned: true,
    },
  });

  await prisma.plannerItem.create({
    data: {
      userId: user.id,
      semesterId: semester.id,
      courseId: course.id,
      title: "Finish assignment 2",
      description: "Complete dynamic programming section",
      status: PlannerStatus.IN_PROGRESS,
      priority: PlannerPriority.HIGH,
      dueAt: new Date("2026-03-10T23:59:00.000Z"),
      isPinned: true,
    },
  });

  await prisma.folder.create({
    data: {
      userId: user.id,
      name: "Important Files",
      color: "#EA580C",
      isPinned: true,
    },
  });

  console.log(`Seed completed: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
