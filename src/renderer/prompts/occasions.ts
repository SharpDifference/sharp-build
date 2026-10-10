import type { ExamPeriod } from '@shared/academics'
import { FINAL_DATE, slotOf } from '@shared/classes'
import { jobDefOf, slotFromId } from '@shared/jobs'
import { locationDefOf } from '@shared/locations'
import type { SemesterCalendar } from '@shared/semesters'
import type { ClassSlot, HauntKind, Occasion, Season, TimeSlot } from '@shared/types'
import { classWeekdayOf, formatGameDate, formatWeekday } from './gameDate'

/**
 * The occasion calendar: what is happening on campus and in Veridan on a given day,
 * whoever the reader knows and wherever he goes — one fixed table per season, and whatever the
 * semester invented beside it.
 */

/** How many weeks the semester runs, for the invented-occasions placement pass. */
export const SEMESTER_WEEKS = Math.floor(FINAL_DATE / 7) + 1

/** Which semester week a date falls in, counting from 0. Day 0 is a Monday, so weeks align. */
export function weekOf(date: number): number {
  return Math.floor(date / 7)
}

/** A spring's real-world holidays. */
const SPRING_HOLIDAYS: readonly Occasion[] = [
  {
    id: 'valentines',
    title: "Valentine's Day",
    description:
      "On Valentine's Day, every florist and sweets counter in Veridan is picked clean by noon, the Pastel Palace has a queue out the door, and the SEB hangs paper hearts off everything on the Rose Road that will hold one.",
    startDate: 26, // Saturday, February 14
    endDate: 26,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'mardi-gras',
    title: 'Mardi Gras',
    description:
      'On Mardi Gras, Stanchion Street lights up with the official parade that includes the VU Marching Band and a lush CAPC floral installation on a float. Expect about a quarter of VU students to be drunk by six PM.',
    startDate: 29, // Tuesday, February 17
    endDate: 29,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'st-patricks',
    title: "St. Patrick's Day",
    description:
      "On St. Patrick's Day, green is everywhere it can be got away with, drinks at Stalestein are dyed, and the VU campus comes alive with CAPC greenery and rainbow displays. The SEB organizes a scavenger hunt for limited-edition wishing coins.",
    startDate: 57, // Tuesday, March 17
    endDate: 57,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'april-fools',
    title: "April Fool's Day",
    description:
      "On April Fool's Day, somebody has done something to the Venus statue, half the doors in the Lowrises are papered over, and nothing anyone tells you today should be believed on the first pass.",
    startDate: 72, // Wednesday, April 1
    endDate: 72,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'easter',
    title: 'Easter Sunday',
    description:
      'Easter Sunday is a popular time for families to visit students. The egg hunt in Green Hill Park draws large crowds and many restaurants offer a special brunch menu.',
    startDate: 76, // Sunday, April 5
    endDate: 76,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'earth-day',
    title: 'Earth Day',
    description:
      'On Earth Day, CAPC works overtime to spread awareness about conservation on campus. There are seedling giveaways outside the Whitman Greenhouse, a river cleanup down at Pier 44, and tables in the Quad asking people to sign things.',
    startDate: 93, // Wednesday, April 22
    endDate: 93,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'selkie-beach-party',
    title: 'Selkie MusicFest',
    description:
      'The Selkie MusicFest is a three-day beach party that began decades ago as a riverfront music festival. It was a small hippie thing until it was co-opted by the company that owns the beach, and now famous musicians play from noon to well past midnight, dozens of bonfires are lit next to the shore, and the whole town is packed with travellers.',
    startDate: 102, // Friday, May 1
    endDate: 104, // Sunday, May 3
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'cinco-de-mayo',
    title: 'Cinco de Mayo',
    description:
      'On Cinco de Mayo, Lotterdale Market hosts Mexican music performances and sells traditional trinkets. Every dining hall from the Agora to the Lowrise communal kitchens has a special menu, and the SEB hosts a salsa dance night in the Quad.',
    startDate: 106, // Tuesday, May 5
    endDate: 106,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'mothers-day',
    title: "Mother's Day",
    description:
      "On Mother's Day, students fend off visits or calls from their family and every restaurant in town is packed to the brim.",
    startDate: 111, // Sunday, May 10
    endDate: 111,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  }
]

/** Venus University's own spring calendar, fitted to a January 19 – May 22 term. */
const SPRING_ACADEMIC: readonly Occasion[] = [
  {
    id: 'orientation',
    title: 'Freshman Orientation',
    description:
      'Freshman orientation. No classes meet: the entire first-year intake is being walked around campus in groups, handed lanyards and shown where the Agora is, and the SEB has a welcome mixer running in the Quad until late night.',
    startDate: 0, // Monday, January 19
    endDate: 0,
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    id: 'add-drop',
    title: 'Add/Drop Deadline',
    description:
      'The add/drop deadline — the last day of the semester a student can change their class schedule. Classes still meet. The registrar closes enrollment at midnight, so anybody still unsure about a course has spent the week sitting in on the alternatives, and dropping one today is final: a dropped class cannot be picked back up.',
    startDate: 25, // Friday, February 13
    endDate: 25,
    time: null,
    cancelsClasses: false,
    kind: 'academic'
  },
  {
    id: 'presidents-day',
    title: "Presidents' Day",
    description:
      "Presidents' Day. Campus is closed and there are no classes, and students are everywhere in the city enjoying their long weekend.",
    startDate: 28, // Monday, February 16
    endDate: 28,
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    id: 'midterm-week',
    title: 'Midterm Week',
    description:
      'Midterm week. All classes have exams or project showcases. Kendall Library is full to the walls, the Agora study pods are impossible to get, and everybody is running on too little sleep. Spring break starts the moment it is over, which is the only thing keeping anybody upright.',
    startDate: 42, // Monday, March 2
    endDate: 46, // Friday, March 6
    time: null,
    cancelsClasses: false,
    kind: 'academic'
  },
  {
    id: 'spring-break',
    title: 'Spring Break',
    description:
      'Spring break. No classes all week. Half the campus has gone home or somewhere exotic, and the half still here has the campus almost to itself.',
    startDate: 49, // Monday, March 9
    endDate: 53, // Friday, March 13
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    id: 'lottery-day',
    title: 'Lottery Day',
    description:
      "On Lottery Day, the draw that decides next year's intake is performed. Superstitious types rub the Venus statue's foot for anybody they know who entered. Numbered lots are pulled live on the Thorne Auditorium stage and put up on screens across campus, CAPC hangs the drawn numbers as banners down the Rose Road. Parties celebrating the anniversary of getting into VU continue late into the night on the quad or in townhouses.",
    startDate: 67, // Friday, March 27
    endDate: 67,
    time: null,
    cancelsClasses: false,
    kind: 'academic'
  },
  {
    id: 'good-friday',
    title: 'Good Friday',
    description:
      'On Good Friday, the university closes and no classes meet, a long weekend unique to VU\'s schedule.',
    startDate: 74, // Friday, April 3
    endDate: 74,
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    id: 'thorne-day',
    title: 'Thorne Day',
    description:
      'Thorne Day is an academic holiday celebrating the university’s founder, and the university is closed. Thorne personally gives a speech from the auditorium stage about the importance of social connection, and SEB hosts a full day of events in the Quad, including a student talent show and speed-dating tables.',
    startDate: 88, // Friday, April 17
    endDate: 88,
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    // Cancels nothing: every class still meets once more as its exam.
    id: 'last-day-of-classes',
    title: 'Last day of classes',
    description:
      'The last day of classes. Every lecture hall on campus is holding its final ordinary meeting of the semester, professors are cramming a term of loose ends into fifty minutes, and people keep saying goodbye to rooms they will not sit in again.',
    startDate: 108, // Thursday, May 7
    endDate: 108,
    time: null,
    cancelsClasses: false,
    kind: 'academic'
  },
  {
    id: 'reading-day',
    title: 'Reading Day',
    description:
      'Reading day. Classes have stopped and finals have not started: one quiet, strange Friday of nothing but studying, with every flat surface in Kendall Library already spoken for.',
    startDate: 109, // Friday, May 8
    endDate: 109,
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    // Monday to Friday, so every one of the ten class slots meets exactly once inside it.
    id: 'finals-week',
    title: 'Finals Week',
    description:
      'Finals week. Every class meets once more, as its exam. Nobody is sleeping properly, the Reserve Bank Cafe has stopped closing, and the mood on campus swings between grim and giddy by the hour.',
    startDate: 112, // Monday, May 11
    endDate: 116, // Friday, May 15
    time: null,
    cancelsClasses: false,
    kind: 'academic'
  },
  {
    // One `cancelsClasses` entry closes the timetable, the university's employers and its haunts at once.
    id: 'summer-vacation',
    title: 'Summer Vacation',
    description:
      'Summer vacation, which has technically already started — finals are marked and nothing meets again. Half of campus is packing, cars are double-parked outside every Lowrise, and people are leaving a few at a time. Whoever is left is waiting on the graduation ceremony on Friday, May 22, and going home after it.',
    startDate: 117, // Saturday, May 16
    endDate: 122, // Thursday, May 21
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    id: 'graduation',
    title: 'Graduation Day',
    description:
      "Graduation day, and the last day of the semester. The Quad is full of chairs and gowns and somebody's crying parents, the seniors are leaving, and everyone else is packing up a room they will not see again until autumn.",
    startDate: 123, // Friday, May 22 — FINAL_DATE
    endDate: 123,
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  }
]

/** A fall's real-world holidays; the Selkie weekend is the one held at a place of its own. */
const FALL_HOLIDAYS: readonly Occasion[] = [
  {
    id: 'selkie-send-off',
    title: 'Selkie Summer Send-Off',
    description:
      "The Selkie Summer Send-Off is Labor Day weekend's last hurrah at Selkie Beach: three days of DJs, volleyball nets and bonfires along the shore, thrown by the company that owns the beach. Half of VU turns up in swimsuits to pretend the summer isn't over, and the Loop runs packed trams to the Promenade until well past midnight.",
    startDate: 19, // Saturday, September 5
    endDate: 21, // Monday, September 7
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'oktoberfest',
    title: 'Oktoberfest',
    description:
      'Oktoberfest comes to Veridan for a weekend of steins, pretzels and brass bands. Beer tents go up all over town, Stalestein swaps its taps for a German menu, the market stalls sell bratwurst by the yard, and anybody wearing lederhosen gets a free round somewhere.',
    startDate: 40, // Saturday, September 26
    endDate: 40,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'halloween',
    title: 'Halloween',
    description:
      'On Halloween, Veridan dresses up. The Lowrises run a costume crawl from building to building, every bar on Stanchion Street holds a costume contest, CAPC has carved a pumpkin for every planter on the Rose Road, and the SEB screens horror movies on the Quad after dark.',
    startDate: 75, // Saturday, October 31
    endDate: 75,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'dia-de-los-muertos',
    title: 'Día de los Muertos',
    description:
      'On Día de los Muertos, marigolds, sugar skulls and pan de muerto fill the market stalls, families build ofrendas in shop windows across Downtown, and the SEB leads a candlelit procession through campus in the evening.',
    startDate: 77, // Monday, November 2
    endDate: 77,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'friday-the-13th',
    title: 'Friday the 13th',
    description:
      'On Friday the 13th, half of campus is pretending to be superstitious and the other half actually is. The cinema runs a horror marathon, the arcade holds a "cursed" tournament, and nobody will walk under the scaffolding outside Kendall Library.',
    startDate: 88, // Friday, November 13
    endDate: 88,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'thanksgiving',
    title: 'Thanksgiving',
    description:
      "On Thanksgiving, VU's Friendsgiving takes over every dining hall and Lowrise kitchen: long tables of turkey, stuffing and pie for everybody on campus, which this year is everybody, and the restaurants in town serve set holiday menus to whoever is left.",
    startDate: 101, // Thursday, November 26
    endDate: 101,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'black-friday',
    title: 'Black Friday',
    description:
      'On Black Friday, Riverside Mall opens at dawn to a line around the block, every shop in town has a doorbuster sale, and the trams are full of shopping bags until late.',
    startDate: 102, // Friday, November 27
    endDate: 102,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  }
]

/** Venus University's own fall calendar, fitted to an August 17 – December 18 term. */
const FALL_ACADEMIC: readonly Occasion[] = [
  {
    id: 'orientation',
    title: 'Freshman Orientation',
    description:
      'Freshman orientation for the fall intake. No classes meet: the new first-years are being walked around campus in groups, handed lanyards and shown where the Agora is, everybody else is moving back in after the summer, and the SEB has a welcome mixer running in the Quad until late night.',
    startDate: 0, // Monday, August 17
    endDate: 0,
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    id: 'labor-day',
    title: 'Labor Day',
    description:
      'Labor Day. Campus is closed and there are no classes, and half the city is spending the long weekend at the beach or out on the river.',
    startDate: 21, // Monday, September 7
    endDate: 21,
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    id: 'add-drop',
    title: 'Add/Drop Deadline',
    description:
      'The add/drop deadline — the last day of the semester a student can change their class schedule. Classes still meet. The registrar closes enrollment at midnight, so anybody still unsure about a course has spent the week sitting in on the alternatives, and dropping one today is final: a dropped class cannot be picked back up.',
    startDate: 25, // Friday, September 11
    endDate: 25,
    time: null,
    cancelsClasses: false,
    kind: 'academic'
  },
  {
    id: 'midterm-week',
    title: 'Midterm Week',
    description:
      'Midterm week. All classes have exams or project showcases. Kendall Library is full to the walls, the Agora study pods are impossible to get, and everybody is running on too little sleep and too much pumpkin spice.',
    startDate: 49, // Monday, October 5
    endDate: 53, // Friday, October 9
    time: null,
    cancelsClasses: false,
    kind: 'academic'
  },
  {
    id: 'thanksgiving-break',
    title: 'Thanksgiving Break',
    description:
      "Thanksgiving break. No classes all week. VU's Friendsgiving keeps the whole campus here rather than scattering everybody home: the dining halls and the Lowrise kitchens are cooking for everyone, and the week is one long holiday on campus.",
    startDate: 98, // Monday, November 23
    endDate: 102, // Friday, November 27
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    // Cancels nothing: every class still meets once more as its exam.
    id: 'last-day-of-classes',
    title: 'Last day of classes',
    description:
      'The last day of classes. Every lecture hall on campus is holding its final ordinary meeting of the semester, professors are cramming a term of loose ends into fifty minutes, and people keep saying goodbye to rooms they will not sit in again.',
    startDate: 108, // Thursday, December 3
    endDate: 108,
    time: null,
    cancelsClasses: false,
    kind: 'academic'
  },
  {
    id: 'reading-day',
    title: 'Reading Day',
    description:
      'Reading day. Classes have stopped and finals have not started: one quiet, strange Friday of nothing but studying, with every flat surface in Kendall Library already spoken for.',
    startDate: 109, // Friday, December 4
    endDate: 109,
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    // Monday to Friday, so every one of the ten class slots meets exactly once inside it.
    id: 'finals-week',
    title: 'Finals Week',
    description:
      'Finals week. Every class meets once more, as its exam. Nobody is sleeping properly, the Reserve Bank Cafe has stopped closing, and the mood on campus swings between grim and giddy by the hour.',
    startDate: 112, // Monday, December 7
    endDate: 116, // Friday, December 11
    time: null,
    cancelsClasses: false,
    kind: 'academic'
  },
  {
    // One `cancelsClasses` entry closes the timetable, the university's employers and its haunts at once.
    id: 'winter-vacation',
    title: 'Winter Vacation',
    description:
      'Winter vacation, which has technically already started — finals are marked and nothing meets again. Half of campus is packing for the holidays, cars are double-parked outside every Lowrise, and people are leaving a few at a time. Whoever is left is waiting on the fall graduation ceremony on Friday, December 18, and going home after it.',
    startDate: 117, // Saturday, December 12
    endDate: 122, // Thursday, December 17
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  },
  {
    id: 'graduation',
    title: 'Fall Graduation',
    description:
      'Fall graduation, and the last day of the semester. The Quad is full of chairs and gowns for the December ceremony, the seniors finishing this term are leaving for good, and everyone else is packing for winter break.',
    startDate: 123, // Friday, December 18 — FINAL_DATE
    endDate: 123,
    time: null,
    cancelsClasses: true,
    kind: 'academic'
  }
]

/** Every occasion that is the same in every semester of a season, in calendar order; never written into the save. */
const STATIC_BY_SEASON: Record<Season, readonly Occasion[]> = {
  spring: [...SPRING_HOLIDAYS, ...SPRING_ACADEMIC].sort((a, b) => a.startDate - b.startDate),
  fall: [...FALL_HOLIDAYS, ...FALL_ACADEMIC].sort((a, b) => a.startDate - b.startDate)
}

/** The fixed occasions of a season's semester, in calendar order. */
export function staticOccasionsOf(season: Season): readonly Occasion[] {
  return STATIC_BY_SEASON[season]
}

/** A semester's fixed occasions plus whatever it generated, in calendar order. */
function allOccasions(calendar: SemesterCalendar): Occasion[] {
  return [...STATIC_BY_SEASON[calendar.season], ...calendar.generated].sort(
    (a, b) => a.startDate - b.startDate
  )
}

/** Everything happening on `date`, in either half of it — what the Calendar draws. */
export function occasionsOn(date: number, calendar: SemesterCalendar): Occasion[] {
  return allOccasions(calendar).filter(
    (occasion) => date >= occasion.startDate && date <= occasion.endDate
  )
}

/** Everything happening in one slot — what the prompts are told about. */
export function occasionsAt(
  date: number,
  time: TimeSlot,
  calendar: SemesterCalendar
): Occasion[] {
  return occasionsOn(date, calendar).filter(
    (occasion) => occasion.time === null || occasion.time === time
  )
}

/**
 * When an occasion that started earlier began, as the timing sentence says it:
 * `"on Thursday"` inside the last week, `"on March 3"` beyond it.
 */
function startedWhen(startDate: number, date: number, season: Season): string {
  return date - startDate <= 6
    ? `on ${formatWeekday(startDate)}`
    : `on ${formatGameDate(startDate, season)}`
}

/**
 * The sentence closing an occasion's lorebook paragraph: where in its own span the current
 * slot sits.
 */
function timingSentence(occasion: Occasion, date: number, time: TimeSlot, season: Season): string {
  if (occasion.time !== null) {
    return time === 0 ? "It's happening today." : "It's happening tonight."
  }
  if (occasion.startDate === occasion.endDate) {
    return 'It started this morning and will go until the end of the night.'
  }
  if (date === occasion.startDate) {
    return `It started this morning and will go until ${formatWeekday(occasion.endDate)}.`
  }
  const started = startedWhen(occasion.startDate, date, season)
  return date === occasion.endDate
    ? `It started ${started} and will go until the end of the night.`
    : `It started ${started} and is still going.`
}

/**
 * The occasions nothing leads up to here: VenusBot's texts, the exam lookahead line, the
 * spring-break lines and the end-of-term descriptions already announce these ahead of time.
 */
const NO_LEAD_UP_IDS: ReadonlySet<string> = new Set([
  'add-drop',
  'midterm-week',
  'spring-break',
  'thanksgiving-break',
  'finals-week',
  'summer-vacation',
  'winter-vacation',
  'graduation'
])

/**
 * The fixed occasions somebody can ask the reader along to, of either season. Every generated
 * occasion is one as well, by its `campus` kind.
 */
const OUTING_OCCASION_IDS: ReadonlySet<string> = new Set([
  'mardi-gras',
  'st-patricks',
  'easter',
  'earth-day',
  'selkie-beach-party',
  'cinco-de-mayo',
  'lottery-day',
  'thorne-day',
  'selkie-send-off',
  'oktoberfest',
  'halloween',
  'dia-de-los-muertos',
  'friday-the-13th',
  'thanksgiving',
  'black-friday'
])

/** The occasion in this slot that somebody could ask the reader to, or null for a slot with none. */
export function outingOccasionAt(
  date: number,
  time: TimeSlot,
  calendar: SemesterCalendar
): Occasion | null {
  return (
    occasionsAt(date, time, calendar).find(
      (occasion) => occasion.kind === 'campus' || OUTING_OCCASION_IDS.has(occasion.id)
    ) ?? null
  )
}

/**
 * The sentence naming when an occasion this slot leads up to arrives, or null when the slot
 * is outside its lead-up window.
 */
function leadUpSentence(
  occasion: Occasion,
  date: number,
  time: TimeSlot,
  season: Season
): string | null {
  const { startDate, endDate } = occasion
  if (startDate === endDate && occasion.time !== null) {
    if (occasion.time === 0) {
      return date === startDate - 1 && time === 1 ? "It's happening tomorrow morning." : null
    }
    return date === startDate && time === 0 ? "It's happening later tonight." : null
  }
  if (startDate === endDate) {
    return date === startDate - 1 ? "It's happening tomorrow." : null
  }
  const span = endDate - startDate + 1
  if (date < startDate - span || date >= startDate) return null
  const named =
    startDate - date > 6
      ? `on ${formatGameDate(startDate, season)}`
      : `on ${formatWeekday(startDate)}`
  const day = date === startDate - 1 ? 'tomorrow' : named
  const when =
    occasion.time === 1 ? `${day} night` : occasion.time === 0 ? `${day}, during the day` : day
  return `It starts ${when} and runs until ${formatWeekday(endDate)}.`
}

/**
 * The lorebook paragraphs for what this slot leads up to: whatever has not started yet but
 * is close enough that campus is already talking about it.
 */
export function occasionLeadUpLines(
  date: number,
  time: TimeSlot,
  calendar: SemesterCalendar
): string[] {
  const lines: string[] = []
  for (const occasion of allOccasions(calendar)) {
    if (NO_LEAD_UP_IDS.has(occasion.id)) continue
    const sentence = leadUpSentence(occasion, date, time, calendar.season)
    if (sentence) lines.push(`${occasion.title}: ${occasion.description} ${sentence}`)
  }
  return lines
}

/**
 * The always-on lorebook paragraphs for whatever is going on in this slot and whatever it
 * leads up to: the one source for the scene builders and the texting call.
 */
export function occasionLoreLines(
  date: number,
  time: TimeSlot,
  calendar: SemesterCalendar
): string[] {
  const lines = occasionsAt(date, time, calendar).map(
    (occasion) =>
      `${occasion.title}: ${occasion.description} ${timingSentence(occasion, date, time, calendar.season)}`
  )
  lines.push(...occasionLeadUpLines(date, time, calendar))
  const lookahead = examLookaheadLine(date, calendar.season)
  if (lookahead) lines.push(lookahead)
  return lines
}

/** Whether the university is closed on `date`. */
function classesCancelledOn(date: number, calendar: SemesterCalendar): boolean {
  return occasionsOn(date, calendar).some((occasion) => occasion.cancelsClasses)
}

/** The occasion closing the university on `date`, or null. */
export function closureOn(date: number, calendar: SemesterCalendar): Occasion | null {
  return occasionsOn(date, calendar).find((occasion) => occasion.cancelsClasses) ?? null
}

/**
 * Whether `jobId`'s employer is shut on `date` — a university employer on a day an occasion
 * closes the university.
 */
export function jobClosedOn(
  jobId: string | null | undefined,
  date: number,
  calendar: SemesterCalendar
): boolean {
  if (!jobId || !jobDefOf(jobId)?.closesWithUniversity) return false
  return classesCancelledOn(date, calendar)
}

/** Whether `location` is shut on `date` — a university place on a day an occasion closes it. */
export function placeClosedOn(
  location: string,
  date: number,
  calendar: SemesterCalendar
): boolean {
  return (
    locationDefOf(location)?.closesWithUniversity === true && classesCancelledOn(date, calendar)
  )
}

/**
 * Whether a `kind` haunt at `location` does not happen on `date` — the single test behind every
 * read of a character's week, and `jobClosedOn`'s sibling. Nobody studies in a break week.
 */
export function hauntClosedOn(
  location: string,
  kind: HauntKind,
  date: number,
  calendar: SemesterCalendar
): boolean {
  if (placeClosedOn(location, date, calendar)) return true
  if (kind !== 'study') return false
  return breakWeeksOf(calendar.season).some(
    (week) => date >= week.startDate && date <= week.endDate
  )
}

/**
 * The `ClassSlot` a game slot meets in, or null when nothing meets at all: the one bridge from
 * the clock to the timetable.
 */
export function classSlotOf(
  date: number,
  time: TimeSlot,
  calendar: SemesterCalendar
): ClassSlot | null {
  const weekday = classWeekdayOf(date)
  if (weekday === null) return null
  if (classesCancelledOn(date, calendar)) return null
  return slotOf(weekday, time)
}

/** One run of the fixed calendar, read back off its season's table so dates and names have one home. */
export interface CalendarSpan {
  id: string
  title: string
  startDate: number
  endDate: number
}

/** The fixed occasion `id` names in a season's table. */
function spanOf(season: Season, id: string): CalendarSpan {
  const occasion = STATIC_BY_SEASON[season].find((entry) => entry.id === id)
  if (!occasion) throw new Error(`missing ${season} occasion: ${id}`)
  return { id, title: occasion.title, startDate: occasion.startDate, endDate: occasion.endDate }
}

/** A season's midterm week. */
export function midtermWeekOf(season: Season): CalendarSpan {
  return spanOf(season, 'midterm-week')
}

/** A season's week off: spring break, or the fall's Thanksgiving break. */
export function breakWeekOf(season: Season): CalendarSpan {
  return spanOf(season, season === 'spring' ? 'spring-break' : 'thanksgiving-break')
}

/** The wind-down after finals: summer vacation in a spring, winter vacation in a fall. */
export function endVacationOf(season: Season): CalendarSpan {
  return spanOf(season, season === 'spring' ? 'summer-vacation' : 'winter-vacation')
}

/** Finals week, the same days in either season. */
export const FINALS_WEEK = spanOf('spring', 'finals-week')

/** The day the semester ends on, likewise — always `FINAL_DATE`. */
export const GRADUATION_DATE = spanOf('spring', 'graduation').startDate

/**
 * The last date the player may change their class schedule, the same in either season.
 * Inclusive: the deadline day itself is still open.
 */
export const ADD_DROP_DATE = spanOf('spring', 'add-drop').startDate

/** The two weeks nobody has anything to study for — {@link hauntClosedOn}'s second rule. */
function breakWeeksOf(season: Season): CalendarSpan[] {
  return [breakWeekOf(season), endVacationOf(season)]
}

/** Whether `date` is a weekday of the term's week off or of the week after finals, when outings run every slot. */
export function isBreakOutingWeek(date: number, season: Season): boolean {
  const week = breakWeekOf(season)
  // The Monday the wind-down's own week starts: the weekend before it is still a weekend.
  const windDown = endVacationOf(season).startDate + 2
  return (
    (date >= week.startDate && date <= week.endDate) ||
    (date >= windDown && date <= endVacationOf(season).endDate)
  )
}

/** The heads-up line for the week before each exam week, or null. */
export function examLookaheadLine(date: number, season: Season): string | null {
  const week = weekOf(date)
  const midterms = midtermWeekOf(season)
  if (week === weekOf(midterms.startDate) - 1) {
    const after = season === 'spring' ? ' Spring break is the week after.' : ''
    return `Midterms are next week, starting ${formatGameDate(midterms.startDate, season)}. Every class is a week out from its exam or project showcase.${after}`
  }
  if (week === weekOf(FINALS_WEEK.startDate) - 1) {
    return `Finals are next week, starting ${formatGameDate(FINALS_WEEK.startDate, season)}. Classes are meeting for the last time this week.`
  }
  return null
}

/** Memo for {@link meetingDatesOf}, keyed on the calendar's identity. */
const meetingsMemo = new WeakMap<SemesterCalendar, Map<ClassSlot, readonly number[]>>()

/** Every date a class in `slot` actually meets, in calendar order. */
export function meetingDatesOf(slot: ClassSlot, calendar: SemesterCalendar): readonly number[] {
  let bySlot = meetingsMemo.get(calendar)
  if (!bySlot) {
    bySlot = new Map()
    meetingsMemo.set(calendar, bySlot)
  }
  const cached = bySlot.get(slot)
  if (cached) return cached

  const { time } = slotFromId(slot)
  const dates: number[] = []
  for (let date = 0; date <= FINAL_DATE; date++) {
    if (classSlotOf(date, time, calendar) === slot) dates.push(date)
  }
  bySlot.set(slot, dates)
  return dates
}

/** Which meeting of the class `date` is — 1-based — or null if it does not meet then. */
export function classMeetingIndexOf(
  slot: ClassSlot,
  date: number,
  calendar: SemesterCalendar
): number | null {
  const index = meetingDatesOf(slot, calendar).indexOf(date)
  return index === -1 ? null : index + 1
}

/** How many meetings the class has held strictly before `date`. */
export function meetingsBefore(slot: ClassSlot, date: number, calendar: SemesterCalendar): number {
  return meetingDatesOf(slot, calendar).filter((meeting) => meeting < date).length
}

/** The class's first meeting strictly after `date`, or null if it has none left. */
export function firstMeetingAfter(
  slot: ClassSlot,
  date: number,
  calendar: SemesterCalendar
): number | null {
  return meetingDatesOf(slot, calendar).find((meeting) => meeting > date) ?? null
}

/**
 * The meeting a class holds inside `exam`'s week — its midterm or its final.
 * Never null in the fixed calendar.
 */
export function examMeetingDateOf(
  slot: ClassSlot,
  exam: ExamPeriod,
  calendar: SemesterCalendar
): number | null {
  const { startDate, endDate } =
    exam === 'midterm' ? midtermWeekOf(calendar.season) : FINALS_WEEK
  return (
    meetingDatesOf(slot, calendar).find((date) => date >= startDate && date <= endDate) ?? null
  )
}
