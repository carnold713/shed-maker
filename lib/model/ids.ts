import { nanoid } from "nanoid";

/** Short, URL-safe ids for entities inside a BuildingModel. */
export function newId(prefix?: string): string {
  const id = nanoid(10);
  return prefix ? `${prefix}_${id}` : id;
}
