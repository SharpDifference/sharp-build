import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "../src/renderer/stores/gameStore";
import { resetLoopState } from "../src/renderer/stores/loop/state";
import {
  checkBackup,
  foldersIn,
  KNOWN_MOD_KEYS,
  reportLine,
} from "./realSavesShared";

/**
 * The player's real saves, round-tripped with no mod registered: read and checked as the main
 * process reads them, loaded as entering the game loads them, and written straight back.
 * Whatever a mod or an older build left on a save rides through untouched, and core's own fields
 * come out as they went in.
 *
 * Skipped unless `VU_REAL_SAVES` names a folder of extracted save data, one folder per backup
 * (see realSavesShared.ts).
 */

const ROOT = process.env.VU_REAL_SAVES ?? "";

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
  "the player’s real saves, through a load and a save",
  () => {
    const skipped: string[] = [];
    const modKeys = new Set<string>();

    it.each(BACKUPS)("%s", (backup) => {
      const report = checkBackup(ROOT, backup);
      skipped.push(...report.skipped);
      for (const key of report.modKeys) modKeys.add(key);
      console.log(reportLine(backup, report));
      expect(report.saves).toBeGreaterThan(0);
      expect(report.problems).toEqual([]);
    });

    it("skips the break’s stray files and finds the mods’ keys", () => {
      expect(BACKUPS.length).toBeGreaterThan(0);
      expect(skipped.length).toBeGreaterThan(0);
      // Every key the mods were known to write turned up somewhere, and was held as a stranger.
      expect(KNOWN_MOD_KEYS.filter((key) => !modKeys.has(key))).toEqual([]);
    });
  },
);
