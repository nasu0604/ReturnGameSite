import type { ClubHistoryRecord, HistoryStatus } from "@return-game/shared";
import { prisma } from "./db.js";

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(date)
    .replace(/\.\s/g, ".")
    .replace(/\.$/, "");
}

function toHistoryRecord(history: {
  id: string;
  eventDate: Date;
  dateLabel: string;
  title: string;
  summary: string;
  description: string;
  status: HistoryStatus;
  createdAt: Date;
  updatedAt: Date;
}): ClubHistoryRecord {
  return {
    id: history.id,
    eventDate: history.eventDate.toISOString(),
    dateLabel: history.dateLabel || formatDateLabel(history.eventDate),
    title: history.title,
    summary: history.summary,
    description: history.description,
    status: history.status,
    createdAt: history.createdAt.toISOString(),
    updatedAt: history.updatedAt.toISOString()
  };
}

export async function listPublishedHistory() {
  const histories = await prisma.clubHistory.findMany({
    where: {
      status: {
        not: "ARCHIVED"
      }
    },
    orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }]
  });

  return histories.map(toHistoryRecord);
}

export async function listAdminHistory() {
  const histories = await prisma.clubHistory.findMany({
    orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }]
  });

  return histories.map(toHistoryRecord);
}

export async function getAdminHistoryById(id: string) {
  const history = await prisma.clubHistory.findUnique({
    where: {
      id
    }
  });

  return history ? toHistoryRecord(history) : null;
}

export async function createHistory(input: {
  eventDate: Date;
  title: string;
  summary: string;
  description?: string;
  status?: HistoryStatus;
}) {
  const history = await prisma.clubHistory.create({
    data: {
      eventDate: input.eventDate,
      dateLabel: formatDateLabel(input.eventDate),
      title: input.title,
      summary: input.summary,
      description: input.description ?? "",
      status: input.status ?? "PUBLISHED"
    }
  });

  return toHistoryRecord(history);
}

export async function updateHistory(
  id: string,
  input: {
    eventDate: Date;
    title: string;
    summary: string;
    description?: string;
    status?: HistoryStatus;
  }
) {
  const history = await prisma.clubHistory.update({
    where: {
      id
    },
    data: {
      eventDate: input.eventDate,
      dateLabel: formatDateLabel(input.eventDate),
      title: input.title,
      summary: input.summary,
      description: input.description ?? "",
      ...(input.status ? { status: input.status } : {})
    }
  });

  return toHistoryRecord(history);
}

export async function archiveHistory(id: string) {
  const history = await prisma.clubHistory.update({
    where: {
      id
    },
    data: {
      status: "ARCHIVED"
    }
  });

  return toHistoryRecord(history);
}

export async function deleteHistory(id: string) {
  const history = await prisma.clubHistory.delete({
    where: {
      id
    }
  });

  return toHistoryRecord(history);
}
