/**
 * Every chance the game rolls against, in one place to tune. Each line says what the chance is
 * and when it is rolled; the roll itself lives beside the thing it decides.
 */

import type { SceneEventId } from './sceneEvents'
import type { TimeSlot } from './types'

// ─── Scene events ──────────────────────────────────────────────────────────────

/** Each curveball's odds, rolled once as a cast scene opens and only where it fits. */
export const SCENE_EVENT_CHANCE: Record<SceneEventId, number> = {
  /** Her-room invite: she's asleep when he arrives. */
  herAsleep: 0.05,
  /** Her-room invite: she's in the shower. */
  herShowering: 0.05,
  /** Her-room invite, alone with her, NSFW text on: he walks in on her masturbating. */
  herMasturbating: 0.05,
  /** Her-room invite: a bug or spider in her room. */
  herBug: 0.05,
  /** Her-room invite, alone with her: she's set up something romantic. */
  herRomance: 0.05,
  /** Her-room invite: she's locked herself out. */
  herLockedOut: 0.05,
  /** His-room invite: she brings drinks, or takeout. */
  hisDrinks: 0.05,
  /** His-room invite: she shows up very late. */
  hisLate: 0.05,
  /** His-room invite: she shows up upset after a bad day. */
  hisUpset: 0.05,
  /** Meal invite: she starts a kitchen fire. */
  mealFire: 0.05,
  /** Meal invite: she's missing an ingredient. */
  mealMissingIngredient: 0.05,
  /** Meal invite: she hurts herself cooking. */
  mealInjury: 0.05,
  /** Meal invite: the meal turns out terrible. */
  mealDisaster: 0.05,
  /** Public cast scene, not a class: a stray cat. */
  strayCat: 0.03,
  /** Public cast scene, not a class: a stray dog. */
  strayDog: 0.03,
  /** Public cast scene, not a class: a lost child. */
  lostChild: 0.03,
  /** Public cast scene, not a class: a stranger has a heart attack. */
  heartAttack: 0.03,
  /** Public cast scene, not a class: she finds a lost wallet. */
  lostWallet: 0.03,
  /** Public cast scene, not a class: a stranger hits on her. */
  hitOn: 0.03,
  /** Public cast scene in rain: she forgot her umbrella. */
  noUmbrella: 0.05,
  /** Public cast scene in rain: she shows up drenched. */
  drenched: 0.05,
  /** Lecture or project class, past syllabus week: she forgot her homework. */
  noHomework: 0.03,
  /** Lecture or project class: she forgot what she needs for class. */
  noMaterials: 0.03,
  /** Lecture or project class: she falls asleep in class. */
  asleepInClass: 0.03,
  /** Lecture or project class, past syllabus week: she gets a bad grade back. */
  badGrade: 0.03,
  /** Lecture or project class: she's very late. */
  lateToClass: 0.03,
  /** Lecture or project class, an ordinary meeting: the professor cancels it. */
  classCancelled: 0.03,
  /** PE class: she hurts herself. */
  peInjury: 0.05,
  /** PE class, NSFW text on: a wardrobe malfunction. */
  peWardrobe: 0.05,
  /** A girl on day one or two of her cycle is cast: a period accident. */
  periodAccident: 0.05,
  /** Any cast scene in the day half: she's hungover, or has a migraine. */
  hungover: 0.03,
  /** Any cast scene: she hurts herself. */
  injury: 0.03,
  /** Any cast scene, NSFW text on: a wardrobe malfunction. */
  wardrobe: 0.03,
  /** Any cast scene indoors: the power goes out. */
  powerOut: 0.03,
  /** Any cast scene indoors: the AC, or in winter the heating, is broken. */
  brokenAc: 0.03,
  /** Any cast scene on campus: the campus wifi goes down. */
  wifiOut: 0.03,
  /** Any cast scene: she can't find her phone. */
  lostPhone: 0.03,
  /** Any cast scene: she can't stop hiccuping. */
  hiccups: 0.03
}

/** Days after an event fires before that event can roll again. */
export const EVENT_COOLDOWN_DAYS = 56

/** Days after any event fires before another can: one a day at most. */
export const EVENT_GAP_DAYS = 1

/** A host's odds of bringing him a present, by what she invited him to; rolled beside the events. */
export const RECEIVED_GIFT_CHANCE = { herRoom: 0.05, hisRoom: 0.1 } as const

/** What closeness multiplies the present's odds by: her tier, plus a lover's bonus on top. */
export const RECEIVED_GIFT_CLOSENESS = { trusted: 1.5, devoted: 2, lover: 0.5 } as const

// ─── Invitations ───────────────────────────────────────────────────────────────

/** Her base odds of asking him out, by what she is to him; rolled per girl as a slot opens. */
export const ASK_CHANCE = {
  lover: 0.4,
  devoted: 0.3,
  trusted: 0.25,
  friendly: 0.16,
  neutral: 0.04,
  lonelyNeutral: 0.1
} as const

/** What the slot multiplies her ask odds by: free hours invite, exam weeks do not. */
export const SLOT_CHANCE = { weekend: 1.5, weekdayDay: 0.8, examWeek: 0.5 } as const

/** The odds of each ask an invitation out of nowhere may be rolled into, in the order tried. */
export const INVITE_CHANCE = {
  lustfulRoom: 0.5,
  intimateRoom: 0.25,
  study: 0.5,
  hisRoom: 0.25,
  outing: 0.25,
  help: 0.2,
  exercise: 0.1,
  meal: 0.1,
  shopping: 0.1
} as const

// ─── Reach-outs ────────────────────────────────────────────────────────────────

/** Her odds of texting him just to talk, by what she is to him; rolled per girl as a slot opens. */
export const REACH_OUT_CHANCE = {
  lover: 0.3,
  devoted: 0.22,
  trusted: 0.15,
  friendly: 0.08
} as const

// ─── Casting ───────────────────────────────────────────────────────────────────

/** Odds of running into somebody while anyone on the roster is still unmet; rolled as a scene is cast. */
export const MEET_SOMEBODY_CHANCE = 0.75

/** Odds any other body joins a nobody-named action; rolled for each further seat as a scene is cast. */
export const EXTRA_CHARACTER_CHANCE = 0.25

/** Odds a public scene the reader cast by name is walked in on; rolled once as it is cast. */
export const PUBLIC_INJECT_CHANCE = 0.1

/** Odds a girl at her own haunt joins a scene cast by name that holds nobody she is spending the slot with. */
export const LOCAL_INJECT_CHANCE = 0.25

// ─── Rumors ────────────────────────────────────────────────────────────────────

/** Odds one girl with nowhere to be walks past an hour nobody else was there for; rolled per girl as the hour is dealt. */
export const PASSERBY_CHANCE = 0.25

// ─── The roster's evenings ─────────────────────────────────────────────────────

/** Odds a friend says yes to being pulled into a host's evening; rolled per friend as the slot's overlay is dealt. */
export const PULL_CHANCE = 0.5

/** Odds somebody spending the slot in her room is out in the building's shared rooms; rolled per girl as the slot is dealt. */
export const DORM_COMMON_CHANCE = 0.6

/** Odds a character out on campus bumps into somebody; rolled per character as the slot is dealt. */
export const LOOSE_RUN_IN_CHANCE = 0.6

/** Odds a pair that could know each other start with no standing at all; rolled per pair as the roster's relationships are first dealt. */
export const INITIAL_PAIR_SKIP_CHANCE = 0.5

/** Base odds an encounter between two girls goes well, in percentage points, by where the pair stands. */
export const UP_PERCENT = { sour: 65, warming: 60, close: 50 }

/** Percentage points a Good-natured girl adds to an encounter's odds, and a Disagreeable one takes off. */
export const TRAIT_PERCENT = 10

// ─── The feed ──────────────────────────────────────────────────────────────────

/** Odds any one character posts a status update; rolled per character each slot. */
export const POST_CHANCE = 0.1

/** The most an acquaintance's friend-request roll can come to, at Godly Heart. */
export const MAX_ACCEPT_CHANCE = 0.8

// ─── Crushes ───────────────────────────────────────────────────────────────────

/** The share of a crush's odds that is how she already feels about him. */
export const RELATIONSHIP_SHARE = 0.6

/** The share of a crush's odds that is whether he is her type at all. */
export const STAT_SHARE = 0.4

// ─── Weather ───────────────────────────────────────────────────────────────────

/** Odds a dry half-day turns wet; rolled each half-day. */
export const WET_AFTER_CLEAR = 0.1

/** Odds rain is still falling next half-day; rolled each half-day. */
export const WET_AFTER_RAIN = 0.67

/** Odds a storm leaves wet weather behind it; the rest of the time it clears. */
export const WET_AFTER_STORM = 0.3

/** Of the wet that follows a clear sky, the share that is a storm out of nowhere. */
export const STORM_OF_WET_FROM_CLEAR = 0.06

/** Of the wet that follows rain, the share that is the front passing as a storm. */
export const STORM_OF_WET_FROM_RAIN = 0.3

/** Of the wet that follows a storm, the share that is the storm still going. */
export const STORM_OF_WET_FROM_STORM = 0.35

/** What the half-day multiplies the storm share by: storms favour the evening two to one. */
export const STORM_HALF_FACTOR: Record<TimeSlot, number> = { 0: 0.67, 1: 1.33 }

// ─── The stage ─────────────────────────────────────────────────────────────────

/** Odds the first happy face of a turn throws sparkles off her; rolled as it is shown. */
export const HAPPY_SPARKLE_CHANCE = 0.5
