import { listed } from '../minigameKit'

/**
 * Truth or Dare, as far as code can run it: whose turn it is and who asks, what each round asks
 * of the model and what stands in when the model cannot be had, the tally, and what the scene is
 * told once it is over. What is asked, answered and done is the model's and the reader's.
 */

export type Kind = 'truth' | 'dare'

/**
 * How a turn came out: a truth answered straight or dodged, a dare done or backed out of.
 * `skipped` is a girl's turn the model never played: nobody's doing, and no point either way.
 */
export type Verdict = 'honest' | 'dodged' | 'done' | 'chickened' | 'skipped'

/** How far the questions and dares may go. */
export type Heat = 1 | 2 | 3

/** The reader's seat; the girls sit at 1 and up, in the order they were handed over. */
export const READER = 0

/** One turn, played out. */
export interface Turn {
  /** Whose turn it was, by seat. */
  player: number
  /** Who asked or set it, by seat. */
  asker: number
  kind: Kind
  /** The question or the dare, as it was put. */
  prompt: string
  /** What was said in answer: the reader's own typing, or her line; empty where he backed out. */
  reply: string
  /** What she was seen to do, for a dare of hers the model played. */
  deed: string
  verdict: Verdict
}

/** The game's terms and who is in it. `names` are the girls', in seat order. */
export interface Terms {
  names: readonly string[]
  rounds: number
  heat: Heat
}

export const HEAT_WORD: Record<Heat, string> = { 1: 'mild', 2: 'flirty', 3: 'bold' }

const HEAT_MEANS: Record<Heat, string> = {
  1: 'mild: harmless fun between friends. Embarrassing stories, silly habits, goofy dares. Nothing romantic and no touching beyond a high five.',
  2: 'flirty: teasing is welcome. Crushes, first impressions, what they like in someone; dares with a little closeness, such as holding a hand, a compliment said with a straight face, a kiss on the cheek at most.',
  3: 'bold: frank about attraction, romance and each other; dares may be daring and close, a kiss at most. Nothing explicit.'
}

/** What holds at every heat, said in every brief. */
const LIMIT =
  'Whatever the heat, everything asked, dared, said and done stays within what adults playing this at a party, in company, would really say and do: never sexually explicit in word or deed, no undressing, and nothing physical beyond a kiss.'

export function heatOf(value: number | undefined): Heat {
  return value === 1 || value === 3 ? value : 2
}

/** How many sit at the table, the reader included. */
export function seats(terms: Terms): number {
  return terms.names.length + 1
}

/** How many turns the whole game is. */
export function turnsIn(terms: Terms): number {
  return seats(terms) * terms.rounds
}

/** Whose turn the `turn`th is, counting from 0: round the table, the reader first. */
export function playerAt(terms: Terms, turn: number): number {
  return turn % seats(terms)
}

/** Who asks on the `turn`th turn: the player just before in the order, round the table. */
export function askerAt(terms: Terms, turn: number): number {
  const n = seats(terms)
  return (playerAt(terms, turn) + n - 1) % n
}

/** A seat's name as the table shows it. */
export function seatName(terms: Terms, seat: number): string {
  return seat === READER ? 'You' : terms.names[seat - 1]
}

/** A seat's name as the model is told it. */
function told(terms: Terms, seat: number): string {
  return seat === READER ? 'the reader' : terms.names[seat - 1]
}

export function scored(verdict: Verdict): boolean {
  return verdict === 'honest' || verdict === 'done'
}

/** The turn was ducked by whoever's it was: a dodge or a backing out, not a turn that was skipped. */
export function ducked(verdict: Verdict): boolean {
  return verdict === 'dodged' || verdict === 'chickened'
}

/** The verdicts a turn of this kind can end on: the one that scores, then the one that does not. */
export function verdictsFor(kind: Kind): readonly [Verdict, Verdict] {
  return kind === 'truth' ? ['honest', 'dodged'] : ['done', 'chickened']
}

/** Points by seat. */
export function tally(terms: Terms, log: readonly Turn[]): number[] {
  const points = Array.from({ length: seats(terms) }, () => 0)
  for (const turn of log) if (scored(turn.verdict)) points[turn.player]++
  return points
}

/** How it came out for the reader: alone on top he won, sharing it is a draw. */
export function outcomeOf(points: readonly number[]): 'won' | 'lost' | 'draw' {
  const best = Math.max(...points)
  if (points[READER] < best) return 'lost'
  return points.filter((p) => p === best).length > 1 ? 'draw' : 'won'
}

/* What stands in for the model. Tame on purpose, and each works whoever asks whom. */

const TRUTHS: Record<Heat, readonly string[]> = {
  1: [
    'What is the most embarrassing thing that has happened to you in a class?',
    'What is a food you pretend to like but secretly cannot stand?',
    'What is the silliest thing you were scared of as a kid?',
    'What is the worst gift you ever had to act happy about?',
    'What song do you only listen to when nobody is around?',
    'What is the last lie you told to get out of plans?'
  ],
  2: [
    'What was your honest first impression of me?',
    'What is the first thing you notice about someone you like?',
    'Who was your first crush, and what did you do about it?',
    'What is the most romantic thing anyone has done for you?',
    'What is something about me you have never said out loud?',
    'What would your perfect date be, start to finish?'
  ],
  3: [
    'Have you ever thought about kissing someone at this table?',
    'What is the boldest thing you have ever done to get someone to notice you?',
    'What is the thing you find most attractive about me?',
    'When did you last get jealous, and over whom?',
    'What is a secret you have never told anyone on campus?',
    'What do you think about right before you fall asleep these days?'
  ]
}

const DARES: Record<Heat, readonly string[]> = {
  1: [
    'Do your best impression of me.',
    'Say the alphabet backwards as far as you can get.',
    'Talk in a posh accent until your next turn.',
    'Show the last photo you took.',
    'Sing the chorus of the last song you listened to.',
    'Balance something on your head for a count of ten.'
  ],
  2: [
    'Give me your best pick-up line with a straight face.',
    'Hold eye contact with me for ten seconds without laughing.',
    'Pay me three compliments, and mean them.',
    'Hold my hand until your next turn.',
    'Describe me in three words, no thinking.',
    'Whisper something nice in my ear.'
  ],
  3: [
    'Kiss me on the cheek.',
    'Sit right next to me, shoulder to shoulder, for the rest of the game.',
    'Tell me, looking me in the eye, the moment you liked me most.',
    'Whisper something you have never dared tell me.',
    'Dance with me for ten seconds, right here.',
    'Say what you would do on a date with me if nothing could go wrong.'
  ]
}

/** What has been put so far this game, so nothing is put twice. */
export function askedSoFar(log: readonly Turn[]): string[] {
  return log.map((turn) => turn.prompt).filter((prompt) => prompt !== '')
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Stock truths or dares to offer or to fall back on: this heat's first, then the tamer ones,
 * none already put this game. `start` turns the list so each turn opens on different ones.
 */
export function stock(
  kind: Kind,
  heat: Heat,
  used: readonly string[],
  count: number,
  start = 0
): string[] {
  const lists = kind === 'truth' ? TRUTHS : DARES
  const heats = ([3, 2, 1] as const).filter((h) => h <= heat)
  const out: string[] = []
  for (const h of heats) {
    const list = lists[h]
    for (let i = 0; i < list.length; i++) {
      const pick = list[(i + start) % list.length]
      if (!used.some((u) => same(u, pick))) out.push(pick)
    }
  }
  // A long game at the mild heat can run the lists dry: then a repeat is better than nothing.
  return (out.length > 0 ? out : [...lists[heat]]).slice(0, count)
}

/** One round asked of the model: what it is told, and what it sends back. */
export interface RoundPlan {
  brief: string
  fields: Record<string, 'text' | readonly string[]>
}

/** What every brief opens with: the turn, who asks, how far it may go, and what has been put. */
function frame(terms: Terms, log: readonly Turn[]): string[] {
  const turn = log.length
  const player = playerAt(terms, turn)
  const asker = askerAt(terms, turn)
  const used = askedSoFar(log)
  return [
    `Truth or Dare, turn ${turn + 1} of ${turnsIn(terms)}. It is ${told(terms, player)}'s turn to take a truth or a dare; ${told(terms, asker)} is the one who asks the question or sets the dare.`,
    `Heat is ${terms.heat} of 3, ${HEAT_MEANS[terms.heat]} That is the ceiling, not a target. ${LIMIT}`,
    'Write every girl in her own character and voice, as her sheet and the scene so far show her, and within what her relationship with the reader in this scene supports: she says and does only what she really would with him, here, now.',
    used.length > 0
      ? `Already asked or dared this game, none of which may be repeated or reworded: ${used.map((p) => `"${p}"`).join(' ')}`
      : 'Nothing has been asked or dared yet this game.'
  ]
}

const HER_WORDS = 'her spoken words only, in her own voice: one or two sentences, no narration, no stage directions'

/** A girl's turn opens: does she take truth or dare? */
export function chooseRound(terms: Terms, log: readonly Turn[]): RoundPlan {
  const her = told(terms, playerAt(terms, log.length))
  const asker = told(terms, askerAt(terms, log.length))
  return {
    brief: [
      ...frame(terms, log),
      `${her} now picks truth or dare, in character: what she would really pick with ${asker} doing the asking, given her nerve, her mood and how the game has gone.`,
      `"choice" is her pick: "truth" or "dare".`,
      `"line" is what ${her} says as she picks, ${HER_WORDS}. It must make her pick plain.`
    ].join('\n'),
    fields: { choice: ['truth', 'dare'], line: 'text' }
  }
}

/** A girl puts the question or sets the dare for whoever's turn it is; here, the reader's. */
export function poseRound(terms: Terms, log: readonly Turn[], kind: Kind): RoundPlan {
  const her = told(terms, askerAt(terms, log.length))
  const player = told(terms, playerAt(terms, log.length))
  return {
    brief: [
      ...frame(terms, log),
      `${player} has picked ${kind}. ${her} now ${kind === 'truth' ? 'asks the question' : 'sets the dare'}.`,
      kind === 'truth'
        ? `"prompt" is the one question ${her} asks ${player}, ${HER_WORDS}. A real question with something at stake for him, about him, about her or about the two of them, answerable in a sentence or two.`
        : `"prompt" is the dare ${her} sets ${player}, ${HER_WORDS}. One thing he can do right here at the table in a moment and describe in a sentence: nothing that needs him to leave, and nothing that needs anyone outside the game.`
    ].join('\n'),
    fields: { prompt: 'text' }
  }
}

/** A girl answers the truth or does the dare that was put to her. */
export function answerRound(
  terms: Terms,
  log: readonly Turn[],
  kind: Kind,
  prompt: string
): RoundPlan {
  const her = told(terms, playerAt(terms, log.length))
  const asker = told(terms, askerAt(terms, log.length))
  const [yes, no] = verdictsFor(kind)
  const head = [...frame(terms, log), `${her} picked ${kind}. ${asker} put it to her, word for word: "${prompt}"`]
  if (kind === 'truth') {
    return {
      brief: [
        ...head,
        `${her} now answers, in character. She answers for real where she would; where the question goes further than she would go with ${asker}, or than the heat allows, she ducks it.`,
        `"line" is what ${her} says in answer, ${HER_WORDS}. The answer itself, not a remark about answering.`,
        `"outcome" is "${yes}" where her line truly answers the question, and "${no}" where she deflected, joked past it or refused.`
      ].join('\n'),
      fields: { line: 'text', outcome: [yes, no] }
    }
  }
  return {
    brief: [
      ...head,
      `${her} now does the dare or backs out, in character. She goes through with what she would really do; where it goes further than she would go with ${asker}, further than the heat allows, or cannot be done right here, she backs out.`,
      `"line" is what ${her} says as she does it or backs out, ${HER_WORDS}.`,
      `"action" is one short sentence of narration in the present tense, naming her, of what she is seen to do: the dare carried out, or how she backs out. The reader is "you" in it.`,
      `"outcome" is "${yes}" where she went through with the dare, and "${no}" where she backed out or did something lesser instead.`
    ].join('\n'),
    fields: { line: 'text', action: 'text', outcome: [yes, no] }
  }
}

/**
 * A girl reacts to what the reader made of his turn, and judges it. `reply` is what he typed,
 * word for word; null where he backed out, which needs no judging.
 */
export function judgeRound(
  terms: Terms,
  log: readonly Turn[],
  kind: Kind,
  prompt: string,
  reply: string | null
): RoundPlan {
  const her = told(terms, askerAt(terms, log.length))
  const [yes, no] = verdictsFor(kind)
  const head = [...frame(terms, log), `The reader picked ${kind}. ${her} put it to him: "${prompt}"`]
  if (reply === null) {
    return {
      brief: [
        ...head,
        `The reader backed out: he ${kind === 'truth' ? 'would not answer' : 'would not do it'}, and scores nothing for the turn.`,
        `"line" is what ${her} says to that, ${HER_WORDS}.`
      ].join('\n'),
      fields: { line: 'text' }
    }
  }
  return {
    brief: [
      ...head,
      kind === 'truth'
        ? `The reader answered, word for word: "${reply}"`
        : `The reader says what he does, word for word: "${reply}"`,
      `${her} reacts and judges it, in character and fairly: she takes him at his word unless what he typed plainly ducks it. Where what he typed goes further than the heat allows, she does not go along with it or repeat it: she laughs it off or calls him on it, and her own line stays within the heat.`,
      `"line" is what ${her} says in reaction, ${HER_WORDS}. She reacts to what he actually ${kind === 'truth' ? 'said' : 'did'}.`,
      kind === 'truth'
        ? `"verdict" is "${yes}" where he gave a real answer to the question asked, and "${no}" where he deflected, joked past it or answered something else.`
        : `"verdict" is "${yes}" where what he describes is the dare carried out, and "${no}" where he did not do it or did something lesser instead.`
    ].join('\n'),
    fields: { line: 'text', verdict: [yes, no] }
  }
}

/* What the game does where a round comes back empty. */

/** A text field of a round, or empty: a blank one is as good as none. */
function text(got: Record<string, string> | null, field: string): string {
  const value = got?.[field]
  return typeof value === 'string' ? value.trim() : ''
}

export interface Chosen {
  kind: Kind
  line: string
}

/** Her pick: the model's, or a coin and a plain word. A pick with no line to it is no round. */
export function chosenOf(got: Record<string, string> | null, rand: () => number = Math.random): Chosen {
  const line = text(got, 'line')
  if (got && line && (got.choice === 'truth' || got.choice === 'dare')) {
    return { kind: got.choice, line }
  }
  return rand() < 0.6 ? { kind: 'truth', line: 'Truth.' } : { kind: 'dare', line: 'Dare.' }
}

/**
 * What she puts to the reader: the model's, or the first stock one not yet used. A blank one, or
 * one already put this game, is no round.
 */
export function posedOf(
  got: Record<string, string> | null,
  kind: Kind,
  heat: Heat,
  log: readonly Turn[]
): string {
  const used = askedSoFar(log)
  const prompt = text(got, 'prompt')
  if (prompt && !used.some((u) => same(u, prompt))) return prompt
  return stock(kind, heat, used, 1, log.length)[0]
}

export interface Answered {
  line: string
  deed: string
  verdict: Verdict
}

/** Her answer or her dare as the model played it, or null where the round is no use. */
export function answerHeard(got: Record<string, string> | null, kind: Kind): Answered | null {
  const [yes, no] = verdictsFor(kind)
  const line = text(got, 'line')
  const deed = kind === 'dare' ? text(got, 'action') : ''
  if (!got || !line || (kind === 'dare' && !deed)) return null
  if (got.outcome !== yes && got.outcome !== no) return null
  return { line, deed, verdict: got.outcome }
}

/**
 * Her answer or her dare: the model's, or what stands in. No code can answer a question for
 * her, and a failed call is not her dodging it: her truth is skipped, with no point either way
 * and nothing put in her mouth. A dare she is taken to have done.
 */
export function answeredOf(got: Record<string, string> | null, kind: Kind, name: string): Answered {
  return (
    answerHeard(got, kind) ??
    (kind === 'truth'
      ? { line: '', deed: '', verdict: 'skipped' }
      : { line: 'Fine. There. Happy now?', deed: `${name} goes through with it.`, verdict: 'done' })
  )
}

/** What the table is told where a girl's turn is skipped. */
export function skippedLine(name: string): string {
  return `${name}'s answer never comes, and her turn is skipped: no point either way.`
}

export interface Judged {
  line: string
  verdict: Verdict
}

/**
 * Her verdict on the reader's turn: the model's, or his word taken for it. Backing out
 * (`reply` null) is settled without her.
 */
export function judgedOf(got: Record<string, string> | null, kind: Kind, reply: string | null): Judged {
  const [yes, no] = verdictsFor(kind)
  const line = text(got, 'line')
  if (reply === null) return { line: line || 'Backing out? Noted.', verdict: no }
  if (got && line && (got.verdict === yes || got.verdict === no)) {
    return { line, verdict: got.verdict }
  }
  return { line: kind === 'truth' ? 'Okay. I will take that.' : 'All right, that counts.', verdict: yes }
}

/* The others at the table. */

/** How many times a game someone not in the turn says something, by how talkative the table is. */
export const REMARKS = { quiet: 0, some: 2, lots: 5 } as const

/**
 * The girl who may say something about the turn just played: one who neither asked nor answered,
 * the word going round by turn. Null with nobody spare, at the cap, or on the last turn, which
 * the scene's own reply answers. Short of talkative, only a turn somebody ducked is worth it.
 */
export function onlooker(
  terms: Terms,
  log: readonly Turn[],
  chattiness: keyof typeof REMARKS,
  made: number
): number | null {
  const last = log[log.length - 1]
  if (!last || log.length >= turnsIn(terms) || made >= REMARKS[chattiness]) return null
  // A skipped turn is nobody's doing: there is nothing in it to remark on.
  if (last.verdict === 'skipped') return null
  if (chattiness !== 'lots' && scored(last.verdict)) return null
  const spare = terms.names
    .map((_, i) => i + 1)
    .filter((seat) => seat !== last.player && seat !== last.asker)
  return spare.length > 0 ? spare[log.length % spare.length] : null
}

const VERDICT_TOLD: Record<Verdict, string> = {
  honest: 'answered straight',
  dodged: 'dodged it',
  done: 'did it',
  chickened: 'backed out',
  skipped: 'turn skipped'
}

/** The turn just played, for whoever remarks on it. */
export function remarkCue(terms: Terms, turn: Turn): string {
  const player = told(terms, turn.player)
  const asker = told(terms, turn.asker)
  const put = turn.kind === 'truth' ? `asked ${player} "${turn.prompt}"` : `dared ${player}: "${turn.prompt}"`
  const said = turn.reply ? ` ${player} said: "${turn.reply}"` : ''
  return `${asker} ${put}.${said} ${player} ${VERDICT_TOLD[turn.verdict]}. She was watching, not part of that turn.`
}

/* What the framework is told. */

const points = (n: number): string => `${n} point${n === 1 ? '' : 's'}`

/** The tally in a row: "the reader 1, Ana 2". */
function tallyTold(terms: Terms, log: readonly Turn[]): string {
  return tally(terms, log)
    .map((p, seat) => `${told(terms, seat)} ${p}`)
    .join(', ')
}

/** How the game stands, for anything said at the table. `now` is what is happening this turn. */
export function situationOf(terms: Terms, log: readonly Turn[], now: string): string {
  const over = log.length >= turnsIn(terms)
  return [
    `The game is Truth or Dare, ${terms.rounds} turn${terms.rounds === 1 ? '' : 's'} each, played ${HEAT_WORD[terms.heat]}. A truth answered straight or a dare done is a point.`,
    `The tally is ${tallyTold(terms, log)}.`,
    over
      ? 'The last turn has just been played.'
      : `Turn ${log.length + 1} of ${turnsIn(terms)}: it is ${told(terms, playerAt(terms, log.length))}'s turn, and ${told(terms, askerAt(terms, log.length))} asks.`,
    ...(now ? [now] : [])
  ].join(' ')
}

/** The result as the scene narrates it. */
export function summaryOf(terms: Terms, log: readonly Turn[]): string {
  const score = tally(terms, log)
  const who = listed(terms.names)
  const outcome = outcomeOf(score)
  const best = Math.max(...score)
  const mine = points(score[READER])
  if (terms.names.length === 1) {
    const hers = score[1]
    return outcome === 'draw'
      ? `You play Truth or Dare with ${who} and it ends level, ${mine} each.`
      : `You play Truth or Dare with ${who} and ${outcome === 'won' ? 'win' : 'lose'}, ${score[READER]} to ${hers}.`
  }
  const top = terms.names.filter((_, i) => score[i + 1] === best)
  if (outcome === 'won') return `You play Truth or Dare with ${who} and come out on top with ${mine}.`
  if (outcome === 'draw') return `You play Truth or Dare with ${who} and share the top with ${listed(top)}, ${points(best)} each.`
  return `You play Truth or Dare with ${who}; ${listed(top)} ${top.length > 1 ? 'share the top' : 'comes out on top'} with ${points(best)}, and you finish on ${score[READER]}.`
}

/** One turn in a line: who put what to whom, what was said, how it was judged. */
function turnTold(terms: Terms, turn: Turn, at: number): string {
  const player = told(terms, turn.player)
  const asker = told(terms, turn.asker)
  const head =
    turn.kind === 'truth'
      ? `${at + 1}. Truth. ${asker} asked ${player}: "${turn.prompt}"`
      : `${at + 1}. Dare. ${asker} dared ${player}: "${turn.prompt}"`
  if (turn.verdict === 'skipped') {
    return `${head} No answer came and the turn was skipped: ${player} was not heard to answer or to refuse. (turn skipped, no point either way)`
  }
  const backed = turn.player === READER && turn.reply === ''
  // His dare is his own account of what he did; hers is her line, and then what she was seen to do.
  const verb = turn.kind === 'truth' ? 'answered' : turn.player === READER ? 'said what he did' : 'said'
  const body = backed
    ? ` ${player} backed out without ${turn.kind === 'truth' ? 'answering' : 'doing it'}.`
    : `${turn.reply ? ` ${player} ${verb}: "${turn.reply}"` : ''}${turn.deed ? ` ${turn.deed}` : ''}`
  return `${head}${body} (${VERDICT_TOLD[turn.verdict]}${scored(turn.verdict) ? ', a point' : ', no point'})`
}

/**
 * The game for the scene's writer: the terms, every turn with what was asked and what was said
 * in answer, who ducked, and the tally. A game left before its last turn is told as far as it
 * got, with nobody the winner.
 */
export function accountOf(terms: Terms, log: readonly Turn[]): string[] {
  const score = tally(terms, log)
  const best = Math.max(...score)
  const top = score.map((p, seat) => (p === best ? told(terms, seat) : '')).filter(Boolean)
  const count = (seat: number, is: (verdict: Verdict) => boolean): number =>
    log.filter((turn) => turn.player === seat && is(turn.verdict)).length
  const times = (n: number): string => (n === 1 ? 'once' : `${n} times`)
  const all = Array.from({ length: seats(terms) }, (_, seat) => seat)
  const backed = all.filter((seat) => count(seat, ducked) > 0)
  const lost = all.filter((seat) => count(seat, (v) => v === 'skipped') > 0)
  const whole = log.length >= turnsIn(terms)
  return [
    `Truth or Dare, ${terms.rounds} turn${terms.rounds === 1 ? '' : 's'} each, played ${HEAT_WORD[terms.heat]}. What was said below was really said at the table and everyone there heard it: it may be remembered, teased about or brought up again.`,
    ...log.map((turn, at) => turnTold(terms, turn, at)),
    backed.length > 0
      ? `Dodged or backed out: ${backed.map((seat) => `${told(terms, seat)} ${times(count(seat, ducked))}`).join(', ')}.`
      : 'Nobody dodged or backed out.',
    ...(lost.length > 0
      ? [
          `Turns skipped through nobody's fault, not held against her: ${lost.map((seat) => `${told(terms, seat)} ${times(count(seat, (v) => v === 'skipped'))}`).join(', ')}.`
        ]
      : []),
    whole
      ? `Final tally: ${tallyTold(terms, log)}. ${top.length > 1 ? `${listed(top).replace(/^t/, 'T')} share the top: a draw between them.` : `${top[0].replace(/^t/, 'T')} won.`}`
      : `The game stopped after ${log.length} of ${turnsIn(terms)} turns, unfinished. The tally as it stood: ${tallyTold(terms, log)}. Nobody won.`
  ]
}
