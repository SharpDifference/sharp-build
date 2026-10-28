import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "../src/renderer/stores/gameStore";
import { resetLoopState } from "../src/renderer/stores/loop/state";
import {
  checkBackup,
  differences,
  foldersIn,
  KNOWN_MOD_KEYS,
  reportLine,
} from "./realSavesShared";

/**
 * The player's real saves after their mods' data moved into `ex`, round-tripped with the mods
 * removed — no save field registered: every slice is written back exactly as read, no legacy key
 * comes back, and core's own fields come out as they went in.
 *
 * Skipped unless `VU_REAL_SAVES_MIGRATED` names the corpus realSavesMigrated.test.ts writes.
 */

const ROOT = process.env.VU_REAL_SAVES_MIGRATED ?? "";

const BACKUPS = ROOT ? foldersIn(ROOT) : [];

beforeEach(() => {
  resetLoopState();
  useGameStore.getState().reset();
});

afterEach(() => {
  resetLoopState();
  useGameStore.getState().reset();
});

describe.skipIf(!ROOT)(
  "the player’s migrated saves, through a load and a save with the mods removed",
  () => {
    const slicesRead = new Set<string>();

    it.each(BACKUPS)("%s", (backup) => {
      const slices = new Map<string, number>();
      const report = checkBackup(ROOT, backup, {
        moved: ["ex"],
        check: (input, out, problem) => {
          for (const key of KNOWN_MOD_KEYS) {
            if (key in input) problem([key], "on the migrated save");
            if (key in out) problem([key], "back on the save after the load");
          }
          for (const id of Object.keys(input.ex ?? {})) {
            slices.set(id, (slices.get(id) ?? 0) + 1);
            slicesRead.add(id);
          }
          if (!("ex" in input)) {
            if ("ex" in out) problem(["ex"], "written for a save with no mod data");
            return;
          }
          for (const path of differences(input.ex, out.ex, true, ["ex"])) {
            problem(path, "lost or changed with its mod removed");
          }
        },
      });

      console.log(
        reportLine(
          backup,
          report,
          `slices ${[...slices].sort().map(([id, n]) => `${id} ${n}`).join(", ") || "none"}`,
        ),
      );
      expect(report.saves).toBeGreaterThan(0);
      expect(report.problems).toEqual([]);
    });

    it("finds slices in the migrated saves", () => {
      expect(BACKUPS.length).toBeGreaterThan(0);
      expect(slicesRead.size).toBeGreaterThan(0);
    });
  },
);
