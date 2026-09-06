import type { BuildingModel } from "@/lib/model/schema";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  createdAt: string;
  footprint: string;
}

export interface ProjectRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  draftModel: BuildingModel;
  schemaVersion: number;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VersionRecord {
  id: string;
  projectId: string;
  number: number;
  label: string | null;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
}

export interface ProjectRepo {
  upsertUser(u: { clerkId: string; email: string; name: string | null }): Promise<UserRecord>;
  listProjects(ownerId: string): Promise<ProjectSummary[]>;
  getProject(ownerId: string, id: string): Promise<ProjectRecord | null>;
  createProject(ownerId: string, model: BuildingModel): Promise<ProjectRecord>;
  saveDraft(ownerId: string, id: string, model: BuildingModel): Promise<{ updatedAt: string } | null>;
  deleteProject(ownerId: string, id: string): Promise<boolean>;
  createVersion(ownerId: string, id: string, label: string | null): Promise<VersionRecord | null>;
  listVersions(ownerId: string, id: string): Promise<VersionRecord[]>;
}
