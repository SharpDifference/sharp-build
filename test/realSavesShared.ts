import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { readCharacterRecord } from "@shared/characterRules";
import { validateRecord } from "@shared/jsonValidate";
import {
  atLocation,
  classifySaveId,
  RECORD_READ,
  SAVE_READ,
} from "@shared/saveRules";
import type {
  Character,
  GameSave,
  PlaythroughRecord,
  SaveDraft,
} from "@shared/types";
import { useGameStore } from "../src/renderer/stores/gameStore";

/**
 * The walk over a corpus of the player's real saves that the real-save suites share: each save
 * read and checked as the main process reads it, loaded as entering the game loads it, written
 * straight back, and compared with what it was.
 *
 * A corpus is one folder per backup: `<root>/<backup>/saves/<playthroughId>/*.json` and
 * `<root>/<backup>/characters/<charId>/character.json` — the JSON alone, no pictures.
 */

export type Path = readonly (string | number)[];

/** The save keys the mods these saves were played with wrote at the top level, by the mod's id. */
export const LEGACY_MOD_KEYS = {
  exPlotTwist: "plot-twist",
  exStoryMemory: "story-memory",
  exBreakthrough: "breakthrough",
  exVenusWhisper: "venus-whisper",
  exNpcWatch: "meanwhile",
  exReckoning: "reckoning",
  exEcho: "echo",
} as const;

export type LegacyModKey = keyof typeof LEGACY_MOD_KEYS;

export const KNOWN_MOD_KEYS = Object.keys(LEGACY_MOD_KEYS) as LegacyModKey[];

/**
 * Keys mods wrote inside core's records — Photo Feature, Text Regeneration, Bunnyfeeds, Prompt
 * Studio — held wherever they turn up, at any depth.
 */
const NESTED_MOD_KEYS = new Set([
  "photo",
  "exReplyTo",
  "exTextBase",
  "body",
  "threadedThrough",
  "feedReadThrough",
  "presetVarMarks",
]);

/** Core's own top-level keys that a fresh store's `toGameSave()` may leave out. */
const OPTIONAL_CORE_KEYS = [
  "playthroughId",
  "saveId",
  "saveDate",
  "thumbnail",
  "semester",
  "replays",
  "formerJobs",
  "transcript",
  "homecomingVisitor",
  "sceneEventsFired",
  "readerCold",
  "readerColdsHad",
];

/**
 * What the round trip changes on purpose, as patterns over a path from the top of the save
 * (`*` is any one step). A difference at one of these, or under it, is not a finding.
 */
const NORMALIZED: readonly { path: Path; why: string }[] = [
  // The service's own fields: stamped from where the file is and when it was written, and the
  // thumbnail taken fresh at each write. `toGameSave` writes none of them.
  {
    path: ["playthroughId"],
    why: "stamped by the save service, not written by toGameSave",
  },
  {
    path: ["saveId"],
    why: "stamped by the save service, not written by toGameSave",
  },
  { path: ["saveDate"], why: "stamped by the save service at write time" },
  { path: ["thumbnail"], why: "taken fresh by the save service at write time" },
  // The loop's own scene fields: written by the loop as it saves mid-turn, never by
  // `captureScene` (see `LOOP_SCENE_FIELDS` in savePassThrough.test.ts).
  {
    path: ["scene", "resumeOnLine"],
    why: "written by the loop, not captureScene",
  },
  {
    path: ["scene", "endPending"],
    why: "written by the loop, not captureScene",
  },
  { path: ["scene", "ledger"], why: "written by the loop, not captureScene" },
  { path: ["scene", "opening"], why: "written by the loop, not captureScene" },
];

/** The value at `path`, or undefined where any step is missing. */
export function at(value: unknown, path: Path): unknown {
  let here = value;
  for (const step of path) {
    if (typeof here !== "object" || here === null) return undefined;
    here = (here as Record<string | number, unknown>)[step];
  }
  return here;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const named = (path: Path): string =>
  path.length > 0 ? path.join(".") : "(top level)";

/**
 * Every path where `after` does not hold what `before` held: a key gone, a value changed, an
 * array grown or shrunk. A key `after` adds is not a difference unless `both` is set.
 */
export function differences(
  before: unknown,
  after: unknown,
  both = false,
  path: Path = [],
): Path[] {
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) return [path];
    return before.flatMap((item, i) =>
      differences(item, after[i], both, [...path, i]),
    );
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([
      ...Object.keys(before),
      ...(both ? Object.keys(after) : []),
    ]);
    return [...keys].flatMap((key) =>
      key in before && key in after
        ? differences(before[key], after[key], both, [...path, key])
        : [[...path, key]],
    );
  }
  return Object.is(before, after) ? [] : [path];
}

/** The entry of {@link NORMALIZED} `path` is at or under, if any. */
function normalizedAt(path: Path): string | undefined {
  const entry = NORMALIZED.find(
    ({ path: pattern }) =>
      pattern.length <= path.length &&
      pattern.every((step, i) => step === "*" || step === path[i]),
  );
  return entry && named(entry.path);
}

/**
 * Every path in `value` that ends in one of {@link NESTED_MOD_KEYS}, below the top level. A
 * `stats` record's `body` is core's own stat, not the mod's key.
 */
function nestedModPaths(value: unknown, path: Path = []): Path[] {
  if (Array.isArray(value))
    return value.flatMap((item, i) => nestedModPaths(item, [...path, i]));
  if (!isRecord(value)) return [];
  const ownStat = path[path.length - 1] === "stats";
  return Object.entries(value).flatMap(([key, inner]) => [
    ...(path.length > 0 &&
    NESTED_MOD_KEYS.has(key) &&
    !(ownStat && key === "body")
      ? [[...path, key]]
      : []),
    ...nestedModPaths(inner, [...path, key]),
  ]);
}

/** The folders under `dir`, or none where it is not there. */
export function foldersIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf-8"));

/** Every `character.json` under `dir`, read and checked as the character service reads them. */
function charactersIn(dir: string): Record<string, Character> {
  const characters: Record<string, Character> = {};
  for (const charId of foldersIn(dir)) {
    const path = join(dir, charId, "character.json");
    if (!existsSync(path)) continue;
    // The folder's name is her id, whatever the file says.
    characters[charId] = {
      ...readCharacterRecord(readJson(path), path).character,
      charId,
    };
  }
  return characters;
}

/** The cast the game ships with, from this checkout's `assets/characters`. */
const SHIPPED = charactersIn(join(__dirname, "..", "assets", "characters"));

/** Loads `save` as entering the game does — the save, then its scene — and writes it straight back. */
function loadAndSave(
  save: GameSave,
  record: PlaythroughRecord,
  characters: Record<string, Character>,
): SaveDraft {
  useGameStore.getState().reset();
  useGameStore.getState().loadSave(structuredClone(save), record, characters);
  useGameStore.getState().restoreScene(save.scene);
  return structuredClone(useGameStore.getState().toGameSave());
}

/** Core's own top-level keys: what a fresh store writes, and the optional ones it may leave out. */
function coreKeys(): Set<string> {
  useGameStore.getState().reset();
  return new Set([
    ...Object.keys(useGameStore.getState().toGameSave()),
    ...OPTIONAL_CORE_KEYS,
  ]);
}

/** Where one save was found. */
export interface SaveSite {
  backup: string;
  playthroughId: string;
  saveId: string;
  /** The playthrough's `playthrough.json`. */
  recordPath: string;
}

/** What a suite adds to the walk. */
export interface CheckOptions {
  /**
   * Top-level keys the round trip takes out of the save on purpose: left out of the shared
   * checks, so `check` must say what became of them.
   */
  moved?: readonly string[];
  /** The suite's own checks on one save, with what it read and what its first round trip wrote. */
  check?: (
    input: GameSave,
    out: SaveDraft,
    problem: (path: Path, what: string) => void,
  ) => void;
  /** Each save as the service would write it back after its first round trip. */
  written?: (save: GameSave, site: SaveSite) => void;
}

/** What one backup's saves showed, for the report line and the corpus-wide checks. */
export interface BackupReport {
  saves: number;
  skipped: string[];
  versions: Set<number>;
  modKeys: Set<string>;
  nestedModKeys: Set<string>;
  /** Which {@link NORMALIZED} entries this backup's saves needed. */
  normalized: Set<string>;
  problems: string[];
}

/**
 * Round-trips every save in one backup folder of the corpus at `root`, gathering every problem
 * instead of stopping. Each save is checked for its strangers kept, core idempotent and core's
 * values kept, then by the suite's own `check`.
 */
export function checkBackup(
  root: string,
  backup: string,
  options: CheckOptions = {},
): BackupReport {
  const report: BackupReport = {
    saves: 0,
    skipped: [],
    versions: new Set(),
    modKeys: new Set(),
    nestedModKeys: new Set(),
    normalized: new Set(),
    problems: [],
  };
  const moved = new Set(options.moved ?? []);
  const isMoved = (path: Path): boolean =>
    path.length > 0 && moved.has(String(path[0]));
  const core = coreKeys();
  const characters = {
    ...SHIPPED,
    ...charactersIn(join(root, backup, "characters")),
  };
  const savesDir = join(root, backup, "saves");

  for (const playthroughId of foldersIn(savesDir)) {
    const folder = join(savesDir, playthroughId);
    const recordPath = join(folder, "playthrough.json");
    const files = readdirSync(folder).sort();
    // A class registration not yet played has an enrollment and nothing else.
    if (!existsSync(recordPath)) {
      if (
        files.some(
          (file) => classifySaveId(file.replace(/\.json$/, "")) !== null,
        )
      ) {
        report.problems.push(
          `${backup}/saves/${playthroughId}: saves with no playthrough.json`,
        );
      }
      continue;
    }
    const record = validateRecord<PlaythroughRecord>(
      readJson(recordPath),
      recordPath,
      RECORD_READ,
    );

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const saveId = file.slice(0, -".json".length);
      const where = `${backup}/saves/${playthroughId}/${file}`;
      // The record, the registration, the lorebook and the break's stray files are no save.
      if (classifySaveId(saveId) === null) {
        if (saveId.startsWith("break")) report.skipped.push(where);
        continue;
      }
      const problem = (path: Path, what: string): void => {
        report.problems.push(`${where}: ${named(path)} ${what}`);
      };

      const parsed = readJson(join(folder, file));
      report.versions.add((parsed as { schemaVersion: number }).schemaVersion);
      const input = atLocation(
        validateRecord<GameSave>(parsed, where, SAVE_READ),
        playthroughId,
        saveId,
      );
      report.saves++;

      let out1: SaveDraft;
      let out2: SaveDraft;
      let rewritten: GameSave;
      try {
        out1 = loadAndSave(input, record, characters);
        // Written back as the service would: stamped where it was found, dated as it was.
        rewritten = {
          ...out1,
          playthroughId,
          saveId,
          saveDate: input.saveDate,
        };
        out2 = loadAndSave(rewritten, record, characters);
      } catch (err) {
        problem([], `does not load: ${(err as Error).message}`);
        continue;
      }

      // 1. Strangers kept: every key core does not own, at the top level, and the mods' keys
      //    inside core's records, wherever they are.
      for (const key of Object.keys(input)) {
        if (core.has(key) || moved.has(key)) continue;
        report.modKeys.add(key);
        for (const path of differences(
          at(input, [key]),
          at(out1, [key]),
          true,
          [key],
        )) {
          problem(path, "lost or changed (a key core does not own)");
        }
      }
      for (const path of nestedModPaths(input)) {
        if (isMoved(path)) continue;
        report.nestedModKeys.add(String(path[path.length - 1]));
        for (const lost of differences(
          at(input, path),
          at(out1, path),
          true,
          path,
        )) {
          problem(lost, "lost or changed (a mod key inside a record)");
        }
      }

      // 2. Core idempotent: the save written back loads and writes back exactly as itself.
      for (const path of differences(out1, out2, true)) {
        problem(path, "differs on the second round trip");
      }

      // 3. Core's values kept: everything the file held comes out the same, but what the round
      //    trip normalizes on purpose and what it moves out.
      for (const path of differences(input, out1)) {
        if (isMoved(path)) continue;
        const entry = normalizedAt(path);
        if (entry) report.normalized.add(entry);
        else problem(path, "lost or changed by the round trip");
      }

      options.check?.(input, out1, problem);
      options.written?.(rewritten, { backup, playthroughId, saveId, recordPath });
    }
  }
  return report;
}

/** The report line every suite prints for one backup, with `extra` before the problem count. */
export function reportLine(
  backup: string,
  report: BackupReport,
  extra = "",
): string {
  return (
    `${backup}: ${report.saves} saves; schema ${[...report.versions].sort().join(", ")}; ` +
    `mod keys ${[...report.modKeys].sort().join(", ") || "none"}; ` +
    `in records ${[...report.nestedModKeys].sort().join(", ") || "none"}; ` +
    `normalized ${[...report.normalized].sort().join(", ") || "none"}; ` +
    (extra ? `${extra}; ` : "") +
    `${report.problems.length} problems`
  );
}
