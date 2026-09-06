import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { migrateModel } from "@/lib/model/migrations";
import type { BuildingModel } from "@/lib/model/schema";
import type { ProjectRecord, ProjectRepo, ProjectSummary } from "./types";

function describeFootprint(model: BuildingModel): string {
  return model.footprint.kind === "rect" ? `${model.footprint.wFt}×${model.footprint.dFt}` : "polygon";
}

function toRecord(p: {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  draftModel: unknown;
  schemaVersion: number;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectRecord {
  return {
    id: p.id,
    ownerId: p.ownerId,
    name: p.name,
    description: p.description,
    draftModel: migrateModel(p.draftModel),
    schemaVersion: p.schemaVersion,
    currentVersionId: p.currentVersionId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const prismaRepo: ProjectRepo = {
  async upsertUser({ clerkId, email, name }) {
    const u = await prisma.user.upsert({
      where: { clerkId },
      update: { email, name },
      create: { clerkId, email, name },
    });
    return { id: u.id, clerkId: u.clerkId, email: u.email, name: u.name };
  },

  async listProjects(ownerId): Promise<ProjectSummary[]> {
    const rows = await prisma.project.findMany({
      where: { ownerId, archived: false },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, description: true, updatedAt: true, createdAt: true, draftModel: true },
    });
    return rows.map((r) => {
      let footprint = "—";
      try {
        footprint = describeFootprint(migrateModel(r.draftModel));
      } catch {
        /* keep placeholder */
      }
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        updatedAt: r.updatedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        footprint,
      };
    });
  },

  async getProject(ownerId, id) {
    const p = await prisma.project.findFirst({ where: { id, ownerId, archived: false } });
    return p ? toRecord(p) : null;
  },

  async createProject(ownerId, model) {
    const p = await prisma.project.create({
      data: {
        ownerId,
        name: model.meta.name,
        draftModel: model as unknown as Prisma.InputJsonValue,
        schemaVersion: model.schemaVersion,
      },
    });
    return toRecord(p);
  },

  async saveDraft(ownerId, id, model) {
    const res = await prisma.project.updateMany({
      where: { id, ownerId },
      data: {
        draftModel: model as unknown as Prisma.InputJsonValue,
        schemaVersion: model.schemaVersion,
        name: model.meta.name,
      },
    });
    if (res.count === 0) return null;
    const p = await prisma.project.findUnique({ where: { id }, select: { updatedAt: true } });
    return { updatedAt: (p?.updatedAt ?? new Date()).toISOString() };
  },

  async deleteProject(ownerId, id) {
    const res = await prisma.project.deleteMany({ where: { id, ownerId } });
    return res.count > 0;
  },

  async createVersion(ownerId, id, label) {
    const p = await prisma.project.findFirst({ where: { id, ownerId } });
    if (!p) return null;
    const v = await prisma.$transaction(async (tx) => {
      const last = await tx.projectVersion.findFirst({ where: { projectId: id }, orderBy: { number: "desc" } });
      const created = await tx.projectVersion.create({
        data: {
          projectId: id,
          number: (last?.number ?? 0) + 1,
          label,
          model: p.draftModel as Prisma.InputJsonValue,
          schemaVersion: p.schemaVersion,
          createdById: ownerId,
        },
      });
      await tx.project.update({ where: { id }, data: { currentVersionId: created.id } });
      return created;
    });
    return { id: v.id, projectId: v.projectId, number: v.number, label: v.label, createdAt: v.createdAt.toISOString() };
  },

  async listVersions(ownerId, id) {
    const p = await prisma.project.findFirst({ where: { id, ownerId }, select: { id: true } });
    if (!p) return [];
    const rows = await prisma.projectVersion.findMany({ where: { projectId: id }, orderBy: { number: "desc" } });
    return rows.map((v) => ({ id: v.id, projectId: v.projectId, number: v.number, label: v.label, createdAt: v.createdAt.toISOString() }));
  },
};
