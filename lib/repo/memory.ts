import { nanoid } from "nanoid";
import type { BuildingModel } from "@/lib/model/schema";
import type { ProjectRecord, ProjectRepo, VersionRecord } from "./types";

/**
 * In-memory repository used when DATABASE_URL is unset. Dev/test only —
 * data lives for the life of the server process. Never used in production.
 */
const g = globalThis as unknown as { __memRepo?: { projects: Map<string, ProjectRecord>; versions: Map<string, VersionRecord[]> } };
const state = (g.__memRepo ??= { projects: new Map(), versions: new Map() });

export const memoryRepo: ProjectRepo = {
  async upsertUser({ clerkId, email, name }) {
    return { id: `u_${clerkId}`, clerkId, email, name };
  },
  async listProjects(ownerId) {
    return [...state.projects.values()]
      .filter((p) => p.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        updatedAt: p.updatedAt,
        createdAt: p.createdAt,
        footprint: p.draftModel.footprint.kind === "rect" ? `${p.draftModel.footprint.wFt}×${p.draftModel.footprint.dFt}` : "polygon",
      }));
  },
  async getProject(ownerId, id) {
    const p = state.projects.get(id);
    return p && p.ownerId === ownerId ? p : null;
  },
  async createProject(ownerId, model: BuildingModel) {
    const now = new Date().toISOString();
    const rec: ProjectRecord = {
      id: nanoid(12),
      ownerId,
      name: model.meta.name,
      description: null,
      draftModel: model,
      schemaVersion: model.schemaVersion,
      currentVersionId: null,
      createdAt: now,
      updatedAt: now,
    };
    state.projects.set(rec.id, rec);
    return rec;
  },
  async saveDraft(ownerId, id, model) {
    const p = state.projects.get(id);
    if (!p || p.ownerId !== ownerId) return null;
    const updatedAt = new Date().toISOString();
    state.projects.set(id, { ...p, draftModel: model, name: model.meta.name, schemaVersion: model.schemaVersion, updatedAt });
    return { updatedAt };
  },
  async deleteProject(ownerId, id) {
    const p = state.projects.get(id);
    if (!p || p.ownerId !== ownerId) return false;
    state.projects.delete(id);
    state.versions.delete(id);
    return true;
  },
  async createVersion(ownerId, id, label) {
    const p = state.projects.get(id);
    if (!p || p.ownerId !== ownerId) return null;
    const list = state.versions.get(id) ?? [];
    const v: VersionRecord = { id: nanoid(12), projectId: id, number: list.length + 1, label, createdAt: new Date().toISOString() };
    state.versions.set(id, [v, ...list]);
    state.projects.set(id, { ...p, currentVersionId: v.id });
    return v;
  },
  async listVersions(ownerId, id) {
    const p = state.projects.get(id);
    if (!p || p.ownerId !== ownerId) return [];
    return state.versions.get(id) ?? [];
  },
};
