import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { GameSave, ModSlice } from "@shared/types";
import { useGameStore } from "../src/renderer/stores/gameStore";
import { resetLoopState } from "../src/renderer/stores/loop/state";
import {
  checkBackup,
  differences,
  foldersIn,
  KNOWN_MOD_KEYS,
  LEGACY_MOD_KEYS,
  reportLine,
  type SaveSite,
} from "./realSavesShared";
import { restoreApi, stubApi } from "./fixtures";

/**
 * The player's real saves, round-tripped with a save field registered for each mod that wrote a
 * top-level key: each legacy key is read once into its mod's slice in `ex`, kept exactly as it
 * was, and gone from the save; everything else comes out as the no-mods round trip has it.
 *
 * Each save as it would be written back is written to a second corpus, the playthrough's record
 * and the backup's characters beside it, for the suite that loads them with the mods removed.
 *
 * Skipped unless `VU_REAL_SAVES` names a folder of extracted save data (see realSavesShared.ts).
 * The corpus is written to `VU_REAL_SAVES_MIGRATED`, or beside the first as `<folder>-migrated`.
 * Its own file, so the fields registered here stay in this file's worker.
 */

// The window's kit entry loads stores that subscribe to the bridge as they load; the bridge is
// stubbed for that import alone, so the saves load as they do in the no-mods suite.
stubApi({ jobs: { onProgress: () => () => {} } });
const { saveField } = await import("@vx/modkit/renderer");
restoreApi();

const ROOT = process.env.VU_REAL_SAVES ?? "";
const OUT = process.env.VU_REAL_SAVES_MIGRATED || (ROOT && `${ROOT}-migrated`);

const BACKUPS = ROOT ? foldersIn(ROOT) : [];

/** A slice written by a mod `MODS` does not list. */
const UNLISTED = "0.0.0";

const MOD_IDS = Object.values(LEGACY_MOD_KEYS);

beforeAll(() => {
  if (!ROOT) return;
  // Each mod's data kept as it was: its slice once written, else its legacy key.
  for (const key of KNOWN_MOD_KEYS) {
    saveField<unknown>(LEGACY_MOD_KEYS[key], {
      empty: null,
      legacy: [key],
      normalize: (stored, legacy) => stored ?? legacy[key] ?? null,
    });
  }
});

beforeEach(() => {
  resetLoopState();
  useGameStore.getState().reset();
});

afterEach(() => {
  resetLoopState();
  useGameStore.getState().reset();
});

/** Writes `save` into the migrated corpus, its record and the backup's characters beside it. */
function writeMigrated(save: GameSave, site: SaveSite): void {
  const folder = join(OUT, site.backup, "saves", site.playthroughId);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `${site.saveId}.json`), JSON.stringify(save));
  const record = join(folder, "playthrough.json");
  if (!existsSync(record)) copyFileSync(site.recordPath, record);
}

/** Copies the backup's `character.json` files into the migrated corpus. */
function copyCharacters(backup: string): void {
  const from = join(ROOT, backup, "characters");
  for (const charId of foldersIn(from)) {
    const file = join(from, charId, "character.json");
    if (!existsSync(file)) continue;
    const to = join(OUT, backup, "characters", charId);
    mkdirSync(to, { recursive: true });
    copyFileSync(file, join(to, "character.json"));
  }
}

describe.skipIf(!ROOT)(
  "the player’s real saves, through a load and a save with the mods’ save fields",
  () => {
    const slicesWritten = new Set<string>();

    it.each(BACKUPS)("%s", (backup) => {
      rmSync(join(OUT, backup), { recursive: true, force: true });
      copyCharacters(backup);
      const slices = new Map<string, number>(MOD_IDS.map((id) => [id, 0]));

      const report = checkBackup(ROOT, backup, {
        moved: [...KNOWN_MOD_KEYS, "ex"],
        check: (input, out, problem) => {
          const held = input as unknown as Record<string, unknown>;
          // No legacy key is left on the save.
          for (const key of KNOWN_MOD_KEYS) {
            if (key in out) problem([key], "still on the save after the load");
          }
          // Each legacy key is its mod's slice, its data as it was; any slice the save held
          // already is kept as read; and no other slice is written.
          const expected: Record<string, ModSlice> = { ...input.ex };
          for (const key of KNOWN_MOD_KEYS) {
            if (!(key in held)) continue;
            const id = LEGACY_MOD_KEYS[key];
            expected[id] = { v: UNLISTED, data: held[key] };
            slices.set(id, (slices.get(id) ?? 0) + 1);
            slicesWritten.add(id);
          }
          if (Object.keys(expected).length === 0) {
            if ("ex" in out) problem(["ex"], "written for a save with no mod data");
            return;
          }
          for (const path of differences(expected, out.ex ?? {}, true, ["ex"])) {
            problem(path, "is not the legacy data, or the slice as read");
          }
        },
        written: writeMigrated,
      });

      console.log(
        reportLine(
          backup,
          report,
          `slices ${[...slices].map(([id, n]) => `${id} ${n}`).join(", ")}`,
        ),
      );
      expect(report.saves).toBeGreaterThan(0);
      expect(report.problems).toEqual([]);
    });

    it("moves every mod’s legacy key into its slice somewhere", () => {
      expect(BACKUPS.length).toBeGreaterThan(0);
      expect(MOD_IDS.filter((id) => !slicesWritten.has(id))).toEqual([]);
    });
  },
);
