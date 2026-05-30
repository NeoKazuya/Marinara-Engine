import type { DB } from "../../db/connection.js";
import { characters as charactersTable } from "../../db/schema/index.js";

export type CharacterNameTarget = {
  id: string;
  name: string;
};

export type CharacterNameMatch =
  | { kind: "none"; key: string }
  | { kind: "unique"; key: string; target: CharacterNameTarget }
  | { kind: "ambiguous"; key: string; targets: CharacterNameTarget[] };

export function normalizeCharacterNameKey(name: unknown) {
  if (typeof name !== "string") return "";
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function readCharacterName(data: unknown) {
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
    const name = (parsed as Record<string, unknown>).name;
    return typeof name === "string" ? name.trim() : "";
  } catch {
    return "";
  }
}

export async function buildCharacterNameTargetMap(db: DB) {
  const rows = await db.select({ id: charactersTable.id, data: charactersTable.data }).from(charactersTable);
  const map = new Map<string, CharacterNameTarget[]>();

  for (const row of rows) {
    const name = readCharacterName(row.data);
    const key = normalizeCharacterNameKey(name);
    if (!key) continue;
    const targets = map.get(key) ?? [];
    targets.push({ id: row.id, name });
    map.set(key, targets);
  }

  return map;
}

export function resolveCharacterNameTarget(
  targetsByName: ReadonlyMap<string, CharacterNameTarget[]>,
  name: unknown,
): CharacterNameMatch {
  const key = normalizeCharacterNameKey(name);
  if (!key) return { kind: "none", key };

  const targets = targetsByName.get(key) ?? [];
  if (targets.length === 1) return { kind: "unique", key, target: targets[0]! };
  if (targets.length > 1) return { kind: "ambiguous", key, targets };
  return { kind: "none", key };
}
