import type { SecretTier } from '@shared/types'

/**
 * The authored secrets a girl's blank tiers are dealt from when nobody writes hers, each one
 * plausible of almost anyone: no family, origins, body or love life it could contradict.
 */

/** Light surprises she owns up to once they are friends. */
const FRIENDLY: readonly string[] = [
  '{name} is secretly ranked in the top fifty worldwide at Pocket Orchard, a cozy farming game she plays under the username LettuceQueen.',
  '{name} keeps a laminated, color-coded ranking of every vending machine on campus and updates it whenever a new snack appears.',
  "{name} can recite every episode of a children's cartoon about a hedgehog detective and still streams it on her laptop when she cannot sleep.",
  '{name} keeps a shoebox of over three hundred fortune-cookie fortunes, meticulously sorted by how accurately each one came true.',
  '{name} taught herself to read tarot from library books and secretly pulls a card for herself before every exam.',
  '{name} reads the weather forecast aloud every morning to her collection of houseplants, each of which has its own name.',
  '{name} writes long, earnest breakfast cereal reviews on an enthusiast forum under an anonymous username she refuses to share.',
  '{name} owns more than sixty pairs of novelty socks and matches them each morning to whatever mood she wakes up in.',
  '{name} taught herself to juggle five beanbags from library videos but only ever practices behind a locked door.',
  '{name} has recorded her dreams every morning for five years in a color-coded journal that tracks every recurring nightmare.',
  '{name} can fold a paper crane in under fifteen seconds and has strung a thousand of them across the inside of her closet.',
  '{name} has memorized every verse of over forty sea shanties and belts them in the shower whenever her floor is empty.',
  '{name} checks three different horoscope apps every morning and secretly follows whichever prediction she likes best.',
  '{name} has learned the full choreography of over thirty K-pop music videos by practicing alone in front of her darkened window.',
  '{name} can solve a puzzle cube in under a minute but only pulls the battered one from her bag when she is completely alone.',
  '{name} has binge-watched all nine seasons of Gavel & Grace, a decades-old courtroom soap opera, more than twice.',
  '{name} collects vintage cookbooks from thrift stores and cooks one strange retro recipe from them every month.',
  '{name} still sleeps with a stuffed platypus named Sergeant, patched so many times that he is now mostly thread.',
  '{name} practices gothic calligraphy every Sunday night and has filled six notebooks with the same ornate alphabet.',
  '{name} narrates her own life in a hushed nature-documentary voice whenever she is alone in her room.',
  '{name} can whistle dozens of birdcalls so convincingly that she once sent a birdwatcher searching the park treetops for twenty minutes.',
  '{name} paints tiny landscapes on bottle caps and secretly leaves them in odd corners around town for strangers to find.',
  '{name} can speak backward fluently and recite the lyrics of entire songs in reverse without missing a word.',
  '{name} writes her grocery lists in a homemade cipher she invented at age eleven and can now write it faster than plain English.',
  '{name} bakes bread every weekend with a four-year-old sourdough starter she lovingly calls Gerald.',
  '{name} saves the sticker from every piece of fruit she eats and has filled an entire scrapbook with them.',
  '{name} stays up through the night to stream international curling championships and knows the rulebook better than most players.',
  '{name} falls asleep every night to the same eight-hour recording of rain on a tin roof, a habit she has kept since middle school.',
  '{name} unwinds after long days by watching hours of videos of rusty antique tools being restored to a mirror shine.',
  '{name} assembles thousand-piece jigsaw puzzles, glues each finished one together, and hides the growing stack under her bed.',
  '{name} knits miniature beanies and scarves for a hidden collection of rubber ducks lined up along her windowsill.',
  '{name} feeds the same family of crows near her dorm, and they have started leaving shiny buttons and foil wrappers on her windowsill in return.',
  "{name} can identify almost any car's make and model from its headlights alone, a game left over from long childhood road trips.",
  '{name} buys old postcards at flea markets and writes replies to their long-gone senders, storing them in a dented cookie tin.',
  '{name} has a hidden talent for ventriloquism and keeps a sock puppet named Professor Biscuit tucked in her desk drawer.',
  '{name} practices sleight-of-hand coin tricks in front of her mirror every night but has never worked up the nerve to perform one.'
]

/** What she keeps from most people, told once she trusts him. */
const TRUSTED: readonly string[] = [
  '{name} has failed her driving test four times and lets everyone assume she simply prefers walking.',
  '{name} has quietly dropped every class that required a group presentation, even ones she needed, and her transcript is riddled with the gaps.',
  '{name} hides a half-finished novel of over two hundred thousand words in a password-protected folder that no one has ever opened.',
  '{name} never learned to ride a bicycle and has spent years inventing excuses to take the bus instead.',
  '{name} talked her way into a members-only jazz club at seventeen with a forged ID and still keeps the laminated fake tucked in her wallet.',
  '{name} still sleeps with a lamp on and tapes a towel along the gap under her door so nobody notices the light.',
  '{name} was caught with a cheat sheet during a high school final and still panics that the quietly buried incident will resurface.',
  '{name} ghostwrites essays for wealthier students to cover her textbook costs and keeps a spreadsheet of every client.',
  '{name} feeds a hidden mason jar of cash every month toward a trip to see the northern lights, telling nobody what it is for.',
  '{name} froze so completely at a singing audition at age sixteen that she walked offstage without a note and has refused to audition since.',
  '{name} runs an online alter ego with tens of thousands of followers who have no idea who she really is.',
  '{name} sees a campus counselor every other week for panic attacks, booking appointments at odd hours so nobody asks where she is going.',
  '{name} quit piano after one disastrous recital but still plays silent scales on tabletops whenever she gets nervous.',
  '{name} quit her high school varsity team two weeks before the championship because she could not bear losing in front of a crowd.',
  '{name} was secretly accepted to a prestigious art school and turned the offer down without telling a single person.',
  '{name} writes a sealed letter to her future self every New Year but has never dared to open a single old one.',
  '{name} once got so lost on a solo trip abroad that she slept in an airport chapel for two nights rather than admit she needed help.',
  '{name} has reread the same self-help book on making friends nine times, its chapter headings underlined in four colors of ink.',
  '{name} was suspended for a week in high school for starting a hallway fight and carefully hides her temper from everyone she meets.',
  '{name} secretly takes adult ballet classes at a studio across town, terrified that someone she knows will see her at the barre.',
  '{name} is so terrified of hospitals that she once walked out of an emergency room with a broken wrist rather than wait to be seen.',
  '{name} keeps every birthday card she has ever received in a shoebox and anxiously counts them each year to compare against the last.',
  '{name} keeps every rejection letter from the forty-one scholarships she applied for in a binder labeled Motivation.',
  '{name} shoplifted a tube of lipstick at fourteen and has mailed the store an anonymous money order every year since.',
  '{name} keeps a binder of hand-drawn floor plans for the cozy bookshop she dreams of opening, down to the placement of every armchair.',
  '{name} accidentally started a rumor in high school that got a teacher reassigned, and she has never confessed it was her.',
  '{name} was held back a year in elementary school and tells everyone she simply started school late.',
  '{name} spent years training away a childhood stutter and avoids late-night conversations because that is when it creeps back.',
  '{name} sold her entire collection of signed first-edition books to cover rent last year and still visits them at the shop that bought them.',
  '{name} gets so sick with nerves before presentations that she has thrown up in a campus bathroom more times than she can count.',
  '{name} has kept a go-bag packed with clothes, cash, and a phone charger under her bed since she was fifteen.',
  '{name} learned lock-picking from online tutorials and once slipped into a locked campus building after hours just to prove she could.',
  '{name} keeps a notebook full of stand-up comedy material and has twice signed up for an open mic, only to leave before her name was called.',
  '{name} has secretly studied sign language for three years in hopes of becoming an interpreter, afraid to admit it in case she quits.',
  '{name} has never read the classics everyone quotes and keeps a notebook of plot summaries to bluff her way through conversations.',
  '{name} keeps a written list of everyone she believes she has disappointed and rereads it on nights she cannot sleep.'
]

/** The deepest of her secrets, told once she is devoted to him. */
const DEVOTED: readonly string[] = [
  '{name} spent most of a year in a hospital bed at age ten with a mystery illness, learning to read from books the nurses brought her.',
  '{name} dared a friend to leap from a quarry ledge at age fourteen, and the friend shattered her spine on the rocks below.',
  '{name} spent an entire night lost and alone at a crowded fairground at age eight and still scans every packed room for its exits.',
  '{name} hung upside down in her seatbelt for an hour after a car she was riding in rolled off an icy road at age fourteen.',
  "{name} found her best friend's goodbye note at age fifteen and got help in time, but the two of them never spoke again after that night.",
  '{name} was bullied so relentlessly in middle school that she ate lunch alone in a bathroom stall for nearly two years.',
  '{name} fled a kitchen fire that gutted her childhood home at age eleven, carrying out nothing but an overdue library book.',
  '{name} was followed by the same stranger for three months at age sixteen, and nobody took her seriously until he was arrested outside her school.',
  '{name} once performed CPR on a collapsed stranger on a sidewalk until the ambulance arrived and never learned whether he survived.',
  '{name} was the only witness to a hit-and-run at age thirteen and froze so completely that she could not describe the car to the police.',
  '{name} was robbed at knifepoint on a walk home at age seventeen and has carried her keys laced between her fingers ever since.',
  '{name} won a national story contest at twelve, then was publicly accused of plagiarism by a teacher in front of her entire class the following year.',
  '{name} wrote weekly letters for a full year to a childhood best friend who moved away without saying goodbye, never receiving a single reply.',
  '{name} was the anonymous whistleblower behind a cheating scandal that cost her entire debate team its national title at sixteen.',
  '{name} nearly drowned at age nine when a riptide dragged her past the swimmers, staying underwater for over a minute before a lifeguard reached her.',
  '{name} was away at an exam on the day her dog of twelve years was put down and never got to say goodbye.',
  '{name} secretly raised a litter of abandoned kittens in a garden shed at age twelve after the shelter turned them away, and only one survived.',
  '{name} quit competitive gymnastics after eight years when a coach told her in front of the whole team, at age fourteen, that she would never be good enough.',
  '{name} spent a night in a police holding room at sixteen after being mistaken for a shoplifter, and nobody came to collect her until morning.',
  '{name} posted something cruel about a classmate online at age fourteen, and the classmate transferred schools a month later.',
  '{name} had her private diary stolen and read aloud at a sleepover when she was fifteen, and she burned every page that same night.',
  '{name} once waited an entire day at a bus station for someone who had promised to come for her and never showed up.',
  '{name} filed the complaint that got a beloved coach fired at seventeen, and half her school stopped speaking to her before the truth came out.',
  '{name} was left behind by her hiking group on a mountain trail at age fourteen and spent a freezing night alone in a foil space blanket.',
  "{name} was accused of stealing cash from a teacher's desk at thirteen, and her hometown never stopped believing it even after she was cleared.",
  '{name} lost every photo album, journal, and keepsake from her childhood at eighteen when the storage unit holding them was emptied by mistake.',
  "{name} lost on the final question of a televised children's quiz show at eleven, and a clip of her crumpling face still circulates online as a meme.",
  '{name} suffered a seizure onstage during a school play at age twelve and still needs a minute alone before stepping onto any stage.',
  '{name} discovered at seventeen that her closest online friend of six years was a fake identity run by a stranger twice her age.',
  '{name} was the last person to speak with a beloved teacher before his sudden death and has never repeated what he told her.',
  '{name} discovered at sixteen that the award-winning drawings she was known for had been secretly finished by the adult who coached her.',
  "{name} called the police on a neighbor's party at sixteen, and the arrests that followed made her the most hated person on her street.",
  '{name} was caught in a crowd crush at a concert at fifteen and woke up on the trampled grass with a stranger holding her hand.',
  '{name} spent six hours trapped in a stalled elevator at age seventeen, keeping a collapsed stranger talking until firefighters pried the doors open.',
  '{name} worked two jobs at sixteen to pay off a debt someone had forged in her name, and she still checks her credit report every single week.',
  '{name} was disqualified from a scholarship competition at sixteen over a rule nobody had told her about, and still keeps her sealed score envelope unopened.'
]

/** The grab bag one tier's secrets are dealt from. */
export function secretBagOf(tier: SecretTier): string {
  return `newGame.secret.${tier}`
}

/** One pooled secret said of her: `{name}` is her first name. */
export function secretFor(template: string, firstName: string): string {
  return template.split('{name}').join(firstName)
}

/** Every tier's secrets, each with `{name}` where her first name goes. */
export const SECRET_POOLS: Record<SecretTier, readonly string[]> = { friendly: FRIENDLY, trusted: TRUSTED, devoted: DEVOTED }
