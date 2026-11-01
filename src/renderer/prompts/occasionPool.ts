import type { OccasionEntry, PlannedOccasion } from '@shared/application'
import type { Season, TimeSlot } from '@shared/types'
import { occasionKindOf } from './occasionPrompt'

/**
 * The authored occasions a skipped occasion call is dealt from: the gala, the dance and the
 * fillers per season, the fillers split by half of the day and by whether they fall in the week
 * off, and the career fair and the concert shared by both seasons. Nothing in them names a
 * weekday, a date or the weather, and none of it is a second version of a fixed occasion. A
 * filler held all day is dealt from the day's pool.
 */

/** What kind of planned occasion a pool entry is written for. */
export type OccasionPoolKind = 'gala' | 'dance' | 'career-fair' | 'concert' | 'filler' | 'break'

/** The pool a planned occasion is filled from, by its flags and then its kind; null where none covers it. */
export function occasionPoolKindOf(planned: PlannedOccasion): OccasionPoolKind | null {
  if (planned.breakWeek) return 'break'
  const kind = occasionKindOf(planned)
  return kind === 'small-event' ? 'filler' : kind
}

/** Whether a kind's pool is split by half of the day. */
function splitByHalf(kind: OccasionPoolKind): boolean {
  return kind === 'filler' || kind === 'break'
}

/** Whether a kind's pool is shared by both seasons. */
function shared(kind: OccasionPoolKind): boolean {
  return kind === 'career-fair' || kind === 'concert'
}

/** The grab bag one pool is dealt from. */
export function occasionBagOf(
  season: Season,
  kind: OccasionPoolKind,
  time: TimeSlot | null
): string {
  const half = splitByHalf(kind) ? `.${time === 1 ? 'night' : 'day'}` : ''
  return shared(kind) ? `newGame.occasion.${kind}` : `newGame.occasion.${season}.${kind}${half}`
}

/** The entries one pool deals. */
export function occasionPoolOf(
  season: Season,
  kind: OccasionPoolKind,
  time: TimeSlot | null
): readonly OccasionEntry[] {
  const spring = season === 'spring'
  const day = time !== 1
  switch (kind) {
    case 'career-fair':
      return CAREER_FAIRS
    case 'concert':
      return CONCERTS
    case 'gala':
      return spring ? SPRING_GALAS : FALL_GALAS
    case 'dance':
      return spring ? SPRING_DANCES : FALL_DANCES
    case 'filler':
      if (spring) return day ? SPRING_DAY_FILLERS : SPRING_NIGHT_FILLERS
      return day ? FALL_DAY_FILLERS : FALL_NIGHT_FILLERS
    case 'break':
      if (spring) return day ? SPRING_DAY_BREAK : SPRING_NIGHT_BREAK
      return day ? FALL_DAY_BREAK : FALL_NIGHT_BREAK
  }
}

/** Two-day career fairs held during the day, the same in either season. */
const CAREER_FAIRS: readonly OccasionEntry[] = [
  {
    title: 'Thorne Career Expo',
    description:
      "Palaestra Stadium's biggest gymnasium fills with rows of glossy booths for the Thorne Career Expo, staffed by Promenade developers, regional hospitals, and a sprawling Thorne Philanthropies pavilion. Students in freshly pressed suits clutch printed resumes as they collect branded tote bags, stress balls, and stylus pens between nervous handshakes."
  },
  {
    title: 'Lab Coat Career Days',
    description:
      "Regional hospitals, Downtown clinics, and Promenade biotech labs fill the Riverside Mall's lower-floor event hall with crisp white booths and demo stations of microscopes and patient simulators. Pre-med and nursing students in pressed slacks rehearse their pitches between free blood pressure checks, collecting branded scrub caps and stethoscope charms along the way."
  },
  {
    title: 'Startup Alley',
    description:
      "Promenade startups line the Agora's ground floor beside the indoor waterfalls, their booths glowing with ring lights, sticker walls, and demo screens looping sleek product videos. Founders in designer hoodies pitch equity-heavy internships to curious undergrads balancing cold brew and free protein bars."
  },
  {
    title: 'Pixel & Code Recruiting Fair',
    description:
      "Game studios, app developers, and Pino-Cola's own digital team load playable demos onto the console setups of the Pino-Cola Lounge, with recruiters perched on gaming chairs. Computer science majors queue with laptops open to their portfolios, trading resumes for enamel pins, limited-edition soda cans, and on-the-spot coding puzzles."
  },
  {
    title: 'Arts & Culture Hiring Days',
    description:
      "The Veridan Museum of Art, the Aquarium at Riverside, Future Cinema, and Thorne Auditorium's stage crew set up draped tables in the auditorium lobby to recruit curators, keepers, ushers, and stagehands. Art and theater majors drift between portfolio reviews beneath the seashell ceiling, collecting canvas bags, gallery passes, and enamel museum pins."
  },
  {
    title: 'Corner Office Recruiting Days',
    description:
      'Promenade banks, corporate law firms, and consulting groups take over the upper level of the Agora with polished wood-paneled booths and racks of glossy brochures. Students in borrowed blazers queue for firm handshakes, embossed leather padfolios, and five-minute interviews held in the app-booked study pods.'
  },
  {
    title: 'Civic Futures Fair',
    description:
      "Veridan's city departments, Silktown nonprofits, and regional school districts pitch canopy booths along the Gold Road beneath the Jupiter statue, each marked with hand-painted signs and stacks of volunteer clipboards. Education and social work majors drift between tables collecting Loop tram passes, reusable tote bags, and invitations to paid fellowships."
  },
  {
    title: 'Hospitality Hiring Days',
    description:
      'A row of crisp white tents rises along the Rose Road, staffed by the resort that owns Selkie Beach, its glass beachside hotels, Lumiere Fusion, and a tight-lipped recruiter from Club Apogee. Hospitality hopefuls trade resumes for branded sunglasses, cabana bar coupons, and quick on-the-spot interviews about weekend availability.'
  },
  {
    title: 'Media Row',
    description:
      "Promenade ad agencies, streaming studios, Veridan's local newspaper, and Bunnyboard's own product team take over the glass atrium of a Promenade tower, its animated billboards looping recruitment reels overhead. Communications and film majors work the room with QR-code resumes, collecting tripod keychains, branded phone grips, and quick portfolio critiques."
  },
  {
    title: 'Silktown Hiring Fair',
    description:
      "Downtown's family businesses fill the ground floor of Kendall Library with folding tables and hand-lettered signs, from SpringMart and Bobby's Diner to Fast Eats and a dozen corner shops short on part-timers. Students in casual clothes browse flexible shift schedules beneath the engraved shelves while collecting coupons, free pastries, and paper applications."
  }
]

/** Night concerts in Thorne Auditorium, one booked act and student openers, the same in either season. */
const CONCERTS: readonly OccasionEntry[] = [
  {
    title: 'Low Tide Choir at Thorne',
    description:
      'Nine-piece folk collective Low Tide Choir brings its three fiddles, banjo, and glockenspiel to Thorne Auditorium, opened by a student a cappella group from the basement practice rooms. Fans pack the seashell-shaped hall for stomping sing-alongs, lush vocal harmonies, and slow ballads lit by a sea of phone flashlights.'
  },
  {
    title: 'Mina Okafor Trio at Thorne',
    description:
      'Jazz pianist Mina Okafor brings her trio to Thorne Auditorium for an intimate evening of standards and late-night originals, opened by the student big band from the basement practice rooms. Couples lean together in the dimmed hall as brushed snares, walking bass lines, and rippling piano runs spill across the seashell ceiling.'
  },
  {
    title: 'VELVETINE Live',
    description:
      'Glitter-pop singer VELVETINE brings her heartbreak tour to Thorne Auditorium, with a student DJ from the basement recording studios warming up the crowd. The SEB clears a standing pit in front of the stage, where fans in sequins and smudged eyeliner scream every lyric beneath pulsing pink lasers.'
  },
  {
    title: 'STARLINE Showcase',
    description:
      "K-pop girl group STARLINE brings its sold-out showcase to Thorne Auditorium, opened by the campus dance crew performing razor-sharp covers of the group's biggest hits. Fans wave glowing lightsticks in perfect sync, chanting member names between explosive choreography and bursts of pastel confetti."
  },
  {
    title: 'The Pelham Quartet',
    description:
      'The Pelham Quartet, a string ensemble famous for chamber arrangements of pop breakup anthems, takes the Thorne Auditorium stage after an opening set from a student pianist. Couples and the recently heartbroken sit shoulder to shoulder in the packed rows as soaring cello lines echo off the seashell ceiling.'
  },
  {
    title: 'Big Wren at Thorne',
    description:
      'Rapper Big Wren, raised beneath the Stanchion Street overpasses, headlines Thorne Auditorium after four student MCs from the basement studios trade verses on the opening bill. Longtime Stanchion locals and students crowd the floor together, trading chants, raised phones, and bass so heavy it rattles the balcony rails.'
  },
  {
    title: 'An Evening of Arias',
    description:
      'Soprano Elise Varga headlines a night of opera arias and art songs at Thorne Auditorium, preceded by a student chamber choir in flowing black robes. The audience sits in rapt silence as her voice soars through the seashell-shaped hall, rising to its feet in roaring ovations after every aria.'
  },
  {
    title: 'Glass Harbor in Concert',
    description:
      'Shoegaze band Glass Harbor floods Thorne Auditorium with walls of reverb and shimmering guitar feedback, preceded by a ferocious student noise-rock trio. The SEB hands out foam earplugs at the doors as fans sway in a haze of fog machines and slow-washing violet light.'
  },
  {
    title: 'Paper Cutouts Reunion Show',
    description:
      'Pop-punk four-piece Paper Cutouts tears through Thorne Auditorium on its reunion tour, opened by a scrappy student garage band from the Lowrises. Fans in faded band tees crowd-surf toward the stage and shout every word of the decade-old anthems back at the band.'
  },
  {
    title: 'An Evening with Darla Kincaid',
    description:
      'Country singer Darla Kincaid brings her twang-heavy ballads of heartbreak and long highways to Thorne Auditorium, opened by a student bluegrass band with a washboard and an upright bass. By the encore, students in borrowed cowboy boots are line dancing down the aisles under warm amber spotlights.'
  }
]

/** Spring's two-night formal galas, thrown by the SEB. */
const SPRING_GALAS: readonly OccasionEntry[] = [
  {
    title: 'The Rose & Gold',
    description:
      'The SEB rents the entire Veridan Museum of Art for two nights of the Rose & Gold, seating a candlelit dinner beneath the blooming upside-down garden ceiling. Students in black-tie gowns and tuxedos pose for photographers on the front steps and leave single roses at the frame of the Girl at the Window.'
  },
  {
    title: 'The Silk River Gala',
    description:
      'The SEB charters a pair of glittering riverboats from the Pier 44 docks for the Silk River Gala, two nights of black-tie cruising past the Promenade towers and the lit-up ferris wheel. Guests dine on the upper deck beneath strings of white lights before dancing to a live swing band as the skyline glides by.'
  },
  {
    title: 'The Glasshouse Gala',
    description:
      'The SEB pitches a glass-walled marquee across the real-grass turf of Palaestra Stadium for the Glasshouse Gala, two nights of mirrored tables, hanging terrariums, and a ceiling of trailing ivy. Guests in jewel-toned gowns and velvet tuxedos dance beneath the dimmed stadium floodlights as a swing orchestra performs from a stage at midfield.'
  },
  {
    title: 'Concordia Ball',
    description:
      "Named for the university motto, the SEB's two-night Concordia Ball takes over the Aquarium at Riverside, with a string quartet playing inside the glass tunnel beneath the river. Guests in shimmering evening wear sip sparkling cider by the observation window, hoping for a cameo from Duchess, the aquarium's famous giant Pacific octopus."
  },
  {
    title: 'The Blossom Gala',
    description:
      "For two nights, the SEB transforms the Riverside Mall's rooftop terrace into the Blossom Gala, lined with CAPC cherry trees in planters while the Threads below glow pink from floor to floor. Couples in black tie dance to a live orchestra against the river view as photographers capture every twirl for Bunnyboard."
  },
  {
    title: 'The Gilded Loom Gala',
    description:
      'The SEB restores a vacant brick textile mill in Downtown for two nights of the Gilded Loom Gala, draping the old weaving floor in gold silk and hanging crystal chandeliers from the iron beams. Guests in vintage-inspired black tie sip sparkling drinks between antique looms while a jazz orchestra plays beneath the tall factory windows.'
  },
  {
    title: 'The Elysian Fields Gala',
    description:
      'The SEB clears a meadow in the woodland behind Elysium Village for the Elysian Fields Gala, two nights of white silk tents, candlelit paths through the trees, and a string orchestra in a mossy clearing. Guests in flowing chiffon and pale tuxedos wander between the tents with sparkling drinks as fairy lights glimmer in the branches overhead.'
  },
  {
    title: 'Olympus Night',
    description:
      "The SEB raises a white pavilion around the Jupiter statue at the North Entrance for Olympus Night, lining the Gold Road with flickering torches for two nights. Guests in flowing gowns and crisp tuxedos enjoy a seven-course dinner, a live orchestra that plays past one, and a photo wall beneath Jupiter's towering marble gaze."
  }
]

/** Spring's one-night formal or themed dances, in a campus venue. */
const SPRING_DANCES: readonly OccasionEntry[] = [
  {
    title: 'Quiet Hours Formal',
    description:
      'The SEB hands out glowing wireless headphones at the doors of Kendall Library for the Quiet Hours Formal, a three-channel silent disco among the engraved wooden shelves. Students in suits and gowns dance in eerie silence, mouthing lyrics to each other as the screened terminals cast a soft blue glow across the stacks.'
  },
  {
    title: 'Courtyard Swing Night',
    description:
      'The SEB lays a portable dance floor across the Lowrise 2 courtyard for Courtyard Swing Night, ringing it with café lights and a live big band on a folding stage. Students in polka-dot dresses and suspenders spin through a crash course in lindy hop before the floor opens to everyone.'
  },
  {
    title: '8-Bit Formal',
    description:
      'The SEB rewires the Pino-Cola Lounge for the 8-Bit Formal, projecting pixel art across the walls and setting every old arcade machine to free play. Students in neon prom dresses and suits worn with high-top sneakers dance to chiptune remixes between rounds on the glowing retro cabinets.'
  },
  {
    title: 'Prom Redux',
    description:
      "Prom Redux is the SEB's second-chance prom, held in the Agora between the two indoor waterfalls with a balloon arch, a corsage table, and a glittering mirror ball. Students in rented tuxedos and tulle gowns slow dance to throwback hits before crowding the floor for a dramatic midnight crowning."
  },
  {
    title: 'The Butterfly Ball',
    description:
      'The CAPC dims the Whitman Greenhouse for the Butterfly Ball, stringing fairy lights through the orchard and opening the butterfly enclosure as a glowing centerpiece. Students in pastel gowns and pale linen suits wander the winding garden paths as a harpist plays beside the tropical pond.'
  },
  {
    title: 'Garden of Venus Masquerade',
    description:
      'The CAPC rings the Venus statue with rose-covered trellises and paper lanterns for the Garden of Venus Masquerade, a one-night dance across the lawns of the Venus Quad. Students in feathered masks and flowing gowns waltz around the Concord Fountain to a live string quintet, tossing wishing coins between songs.'
  },
  {
    title: 'Stage Lights Formal',
    description:
      'The SEB turns the stage of Thorne Auditorium into a ballroom for the Stage Lights Formal, laying a dance floor over the boards beneath sweeping spotlights and velvet curtains. Students in sequined dresses and sharp suits pose for a red-carpet photographer at the lip of the stage while a DJ spins Broadway remixes from the wings.'
  },
  {
    title: 'Rooftop Formal',
    description:
      'The SEB clears the rooftop running track at Palaestra Stadium for the Rooftop Formal, setting a DJ booth in the middle lane and hanging string lights lap after lap. Couples in formalwear slow dance where sprinters usually stretch, with the glittering Promenade skyline spread out beyond the railings.'
  }
]

/** Fall's two-night formal galas, thrown by the SEB. */
const FALL_GALAS: readonly OccasionEntry[] = [
  {
    title: 'The Carousel Ball',
    description:
      'For two nights, the SEB rents out all of Pier 44 for the Carousel Ball, wrapping the antique carousel in gold ribbon and setting long banquet tables along the boardwalk. Guests in black tie ride the carousel and the towering ferris wheel for free, snapping glittering skyline photos from the very top.'
  },
  {
    title: 'The Overture Gala',
    description:
      'The SEB takes over the stage and grand lobby of Thorne Auditorium for two nights of the Overture Gala, seating dinner on the stage itself while a full student orchestra plays below. Guests in black tie dance beneath the seashell ceiling between courses as the empty three-thousand-seat hall glows gold under the house lights.'
  },
  {
    title: 'The Barnlight Gala',
    description:
      "The SEB fills the largest of Lotterdale Market's conjoined barnhouses with wrought-iron lanterns, hay-bale lounges, and long farmhouse tables for two nights of the Barnlight Gala. Guests in black tie and cowboy boots feast on family-style platters before a bluegrass string band strikes up a rollicking barn dance."
  },
  {
    title: 'Premiere Night',
    description:
      "Future Cinema rolls a red carpet across both of its gilded marble floors for Premiere Night, the SEB's two-night gala of velvet ropes and flashing cameras. Guests are announced by name as they arrive, then settle into plush velvet seats for a reel of student films on the big screen."
  },
  {
    title: 'The Ember Gala',
    description:
      'The SEB books the glass sky lobby of a Promenade tower for the Ember Gala, two nights of amber candlelight, a live jazz band, and a Lumiere Fusion tasting menu forty floors up. Guests in velvet gowns and dark tuxedos compete for the window tables, where the whole glittering city spreads out beneath them.'
  },
  {
    title: 'The Silky Way Gala',
    description:
      "The SEB rents the ballroom of a glass beachside hotel and the imported white sand of Selkie Beach for two nights of the Silky Way Gala, lighting the shore with hundreds of hurricane lanterns. Guests in black tie dance barefoot on a teak floor laid over the sand while a jazz orchestra plays beneath the strip's giant sign."
  },
  {
    title: 'The Rotunda Gala',
    description:
      "The SEB takes over the marble rotunda of Veridan's historic city hall for two nights of the Rotunda Gala, ringing its mosaic floor with candlelit tables beneath portraits of the old mill founders. Guests in ball gowns and white tie waltz under the soaring painted dome as a chamber orchestra fills the hall from the grand staircase."
  },
  {
    title: 'The Lantern Ball',
    description:
      'The Lantern Ball pitches white marquees across the rolling hills of Green Hill Park for two nights, with paper lanterns strung along the cobbled paths between them. The SEB runs shuttles from the Venus Quad, and couples in formalwear slip away from the dance floor to stargaze beside the marble memorials.'
  }
]

/** Fall's one-night formal or themed dances, in a campus venue. */
const FALL_DANCES: readonly OccasionEntry[] = [
  {
    title: 'High Rollers Formal',
    description:
      'The SEB turns the Pino-Cola Lounge into a glittering casino for the High Rollers Formal, swapping the ping pong tables for play-money blackjack and roulette wheels. Students in black tie dance between the arcade machines, cashing their chips in for raffle tickets and oversized prizes.'
  },
  {
    title: 'Midnight Library Masquerade',
    description:
      'The SEB hangs velvet curtains and flickering candle lanterns between the engraved shelves of Kendall Library for the Midnight Library Masquerade. Students in lace masks and dark formalwear waltz across the main reading room as a string trio plays beneath the tall arched windows.'
  },
  {
    title: 'Roller Disco Formal',
    description:
      'The SEB lays a smooth rink across the Lowrise 5 courtyard for the Roller Disco Formal, renting skates in every size and hanging a giant mirror ball above the floor. Students in glittering jumpsuits and flared suits wobble and spin through funk classics as prismatic spotlights sweep across the courtyard walls.'
  },
  {
    title: 'Speakeasy Formal',
    description:
      'The SEB posts the password for the Speakeasy Formal on Bunnyboard an hour before doors open, then dresses the Agora as a Prohibition-era club with velvet drapes and a swing band by the waterfalls. Students in flapper dresses and pinstripe suits sip mocktails from teacups and dance the Charleston under dim amber bulbs.'
  },
  {
    title: 'Firelight Formal',
    description:
      'The CAPC lights every sunken fire pit on the Venus Quad for the Firelight Formal, a semi-formal evening with a string band playing beneath the shaded gazebos. Students in cocktail dresses and loosened ties roast SEB-supplied marshmallows between dances as embers drift up toward the Venus statue.'
  },
  {
    title: 'Elysium Garden Party Formal',
    description:
      'Elysium Village residents and the SEB string lanterns between the private patios for the Elysium Garden Party Formal, laying a dance floor on the lawn at the edge of the woods. Underclassmen in cocktail dresses and linen jackets finally make it past the porch lights, mingling with upperclassmen over lemonade punch and a live jazz trio.'
  },
  {
    title: 'Tango Night on the Courts',
    description:
      'The SEB strings lanterns over the outdoor tennis courts at Palaestra Stadium for Tango Night, laying a polished dance floor across the baseline with a live bandoneon quartet on a corner riser. Students in slit skirts and slim black suits learn the basic steps before pairing off for dramatic dips under the lights.'
  },
  {
    title: 'Black & White Ball',
    description:
      'The Black & White Ball enforces its dress code at the doors of the Whitman Greenhouse: black, white, or turned away. Inside, the CAPC strings white lights through the orchard as a pianist plays a white grand piano beside the tropical pond, and couples slip into the maze-like paths between songs.'
  }
]

/** Spring's half-day things during the day. */
const SPRING_DAY_FILLERS: readonly OccasionEntry[] = [
  {
    title: 'Concord Fountain Coin Count',
    description:
      "CAPC volunteers in rubber waders pull the semester's wishing coins out of the Concord Fountain and sort them into glittering heaps on folding tables across the Venus Quad. Curious students crowd the rope line hoping to spot a rare thousand-dollar coin while volunteers tally the haul for financial aid."
  },
  {
    title: 'Paper Boat Regatta',
    description:
      'The engineering club launches a paper boat regatta across the tropical pond of the Whitman Greenhouse, with hand-folded vessels racing toward a ribbon finish line at the far bank. Spectators crowd the stone edges with phones raised, cheering as soggy hulls capsize and wax-coated champions glide to victory.'
  },
  {
    title: 'Ask Duchess Day',
    description:
      "The Aquarium at Riverside offers half-price student admission while Duchess's keeper hosts a live question session in the dim observation room. Students press close to the glass with notebooks and phones raised, waiting for the giant Pacific octopus to unfurl her rust-red arms against the window."
  },
  {
    title: 'Closet Swap Pop-Up',
    description:
      "The CAPC fills the Agora's ground floor with rolling racks of donated dresses, denim jackets, and statement coats for a free clothing swap, complete with full-length mirrors and a curtained fitting corner. Students trade armfuls of outgrown outfits for vintage finds, posting their best hauls to Bunnyboard before they even leave."
  },
  {
    title: 'Speed Chess Blitz Open',
    description:
      'The chess club takes over the study desks of the Pino-Cola Lounge for a three-minute blitz tournament open to anyone who signs up. Spectators crowd around the boards as players slam their clocks loud enough to be heard over the ping pong tables.'
  },
  {
    title: 'Crate Day at Freights',
    description:
      'Freights Books & Records hauls its bargain bins onto the Stanchion Street sidewalk for Crate Day, selling dollar records and paperbacks by the pound beneath the mural-covered pillars. Students dig through dusty milk crates and leave with armfuls of secondhand vinyl, cassette tapes, and dog-eared manga.'
  },
  {
    title: 'Bumper Car Derby',
    description:
      'Pier 44 hosts a bumper car derby for student teams in matching homemade jerseys, with a referee in a striped shirt calling the rounds through a megaphone. Spectators line the boardwalk railing with cotton candy, cheering as rubber bumpers slam together beneath the towering ferris wheel.'
  },
  {
    title: 'Abandoned Bike Auction',
    description:
      'Campus security auctions off every bike left chained behind the Lowrises since last year, lining rows of rusty cruisers and dented road bikes across the Lowrise 1 courtyard. Bidding starts at five dollars, and students shout over each other to claim cheap rides with mismatched wheels and squeaky brakes.'
  },
  {
    title: 'Sandy Spikes Volleyball Open',
    description:
      "Selkie Beach strings nets across a row of courts on the resort strip's sand for a two-on-two volleyball open, with a DJ booth and an umpire's chair at center court. Teams in matching tank tops dive for digs while friends cheer from beneath striped cabana umbrellas."
  },
  {
    title: 'Silktown Skyline March',
    description:
      'Downtown residents march from Green Hill Park to city hall to protest yet another Promenade tower, carrying hand-painted banners of the old mill skyline. A handful of students join the procession with borrowed signs while longtime locals chant slogans and pass out flyers about the next zoning meeting.'
  },
  {
    title: 'Pastel Palace Test Batch',
    description:
      'Pastel Palace sets up a candy-striped tasting table outside its Stanchion Street storefront, handing out free samples of an unreleased pastry and asking for votes on Bunnyboard. Sweet-toothed students line up around the block for frosted bites and glittering macarons, with singles allowed a second sample.'
  },
  {
    title: 'Overpass Mural Day',
    description:
      "Stanchion Street's muralists invite volunteers to repaint the fading murals on the overpass pillars, handing out brushes, rollers, and paint-splattered aprons to anyone willing to climb a ladder. Art majors and curious passersby layer bold color over decades-old designs while street vendors sell skewers and lemonade along the barricades."
  },
  {
    title: 'SEB Blood Drive',
    description:
      "The SEB fills the Agora's ground floor with reclining donor chairs and nurses from a Downtown clinic for a campus-wide blood drive. Donors leave with heart-shaped stickers, juice boxes, and fresh cookies while Bunnyboard keeps a running tally of every pint collected."
  },
  {
    title: 'Polyglot Picnic',
    description:
      'International student clubs spread checkered blankets across the lawns of the Venus Quad for the Polyglot Picnic, each one offering homemade snacks and five-minute mini lessons in its language. Students drift from blanket to blanket practicing greetings, sampling dumplings and pastries, and collecting passport-style stamps.'
  },
  {
    title: 'Library Steps Debate',
    description:
      'The debate team argues outlandish motions on the steps of Kendall Library, from "This House Would Date Frederic Thorne" to "This House Would Ban Bunnyboard." Passing students vote by standing on one side of the steps or the other, cheering their favorite rebuttals between classes.'
  },
  {
    title: 'Free Sketch Day',
    description:
      'The Veridan Museum of Art waives admission for any student carrying a sketchbook, and art majors fill every bench beneath the blooming upside-down garden ceiling. Charcoal-smudged students sketch the salvaged-loom galleries and the Girl at the Window while the guards keep a respectful distance.'
  },
  {
    title: 'Robot Rumble',
    description:
      'The robotics club stages a combat robot tournament inside a polycarbonate arena on the indoor turf of Palaestra Stadium, with spinning blades, flippers, and hammers clashing in timed bouts. Spectators pack the bleachers in safety goggles, roaring every time a battered bot is flipped onto its back in a shower of sparks.'
  },
  {
    title: 'Latte Art Throwdown',
    description:
      'Baristas from across Veridan face off inside the vault of Reserve Bank Cafe, pouring intricate rosettas and swans head to head while a judge inspects every cup. Caffeine-loving spectators pack the heavy steel doorway to cheer each pour and sample the Getaway Lattes left behind.'
  },
  {
    title: 'Small Press Zine Fair',
    description:
      "Local artists and student illustrators fill Kendall Library's grand reading room with folding tables of handmade zines, risograph prints, and sticker sheets. Browsers flip through photocopied comics and poetry chapbooks beneath the engraved shelves, trading pocket change for one-of-a-kind finds."
  },
  {
    title: 'Dodgeball Championship Clash',
    description:
      'The intramural dodgeball league plays its championship in a Palaestra Stadium gymnasium, where teams in pun-printed jerseys hurl rubber balls with thunderous force. Friends pack the bleachers with handmade signs, cheering every dramatic catch and last-second dodge.'
  }
]

/** Spring's half-day things in the evening. */
const SPRING_NIGHT_FILLERS: readonly OccasionEntry[] = [
  {
    title: 'Stalestein Poetry Slam',
    description:
      'The Stalestein turns its small underground stage over to a poetry slam, judged by three grizzled regulars holding up handwritten scorecards. Students read raw verses about heartbreak and homesickness while bikers snap along in the dim red glow of the bar.'
  },
  {
    title: 'Museum After Hours',
    description:
      'The Veridan Museum of Art stays open late for a gallery party, with a live DJ spinning in the contemporary wing and a cocktail bar set up among the salvaged looms. Students in their weekend best wander the dim halls with drinks in hand, dancing between installations as colored light washes over the rebar sculptures.'
  },
  {
    title: 'Love Between Gods Quote-Along',
    description:
      'Future Cinema screens "Love Between Gods" for a packed house armed with props from the door, from paper roses to tiny golden road signs. Every time a character says "Meet me where Gold crosses Rose," the entire velvet-seated theater shouts the line along with them.'
  },
  {
    title: 'Study Pod Speed Dating',
    description:
      'The SEB books every study pod in the Agora for a speed dating mixer, pairing students for four-minute conversations that end at the chime of a bell. Nervous participants shuffle from pod to pod with name tags and paper scorecards while friends watch the matches roll in on Bunnyboard.'
  },
  {
    title: 'Dumpling Showdown',
    description:
      'Eastern Buffet hosts a dumpling-eating showdown for anyone hoping to join the champions framed by the register, timed by the owner himself with a battered stopwatch. Spectators pay the usual twelve dollars at the door and cheer from steaming plates of noodles as contenders race through towering stacks.'
  },
  {
    title: 'PARADISO Song Drop',
    description:
      'BTB Arcade unlocks a new song pack for PARADISO, and the line of hopefuls wraps around the warehouse before the doors even open. Sweat-soaked dancers battle through the brutal new tracks under flashing neon while crowds record every combo for Bunnyboard.'
  },
  {
    title: 'Jigsaw Sprint at CuteTea',
    description:
      'The Stanchion Street CuteTea hosts a speed jigsaw contest, handing teams of four identical five-hundred-piece puzzles and starting the clock with a brass gong. Players hunch over crowded tables with boba in hand, sorting edge pieces in frantic silence while spectators lean over their shoulders to point out stray pieces.'
  },
  {
    title: 'Astronomy Club Star Party',
    description:
      'The astronomy club sets up a row of telescopes on the highest hill of Green Hill Park, far enough from the Promenade towers to reveal a sky full of stars. Couples on picnic blankets and curious stargazers take turns at the eyepieces as members trace planets and constellations with laser pointers.'
  },
  {
    title: 'Lowrise Kitchen Clash',
    description:
      'Kitchen volunteers from all five Lowrises face off in the Lowrise 3 kitchen for a mystery-basket cook-off, each team racing the clock to turn surprise ingredients into a three-course meal. Hungry residents pack the communal dining room to judge every plate, cheering for their own building with banging spoons.'
  },
  {
    title: "Bobby's Late-Night Trivia",
    description:
      "Bobby's Diner keeps its kitchen open late for trivia night, with the current Bobby reading questions from behind the counter in a pressed paper hat. Student teams huddle in the vinyl booths over milkshakes and fries, battling a table of retirees who have held the title for decades."
  },
  {
    title: 'Night Bloom Walk',
    description:
      'The CAPC keeps the Whitman Greenhouse open after dark for its night-blooming flowers, lighting the winding paths with low amber lamps. Couples and curious botany majors wander the maze-like garden, pausing as volunteers point out moonflowers and fragrant jasmine opening in the dark.'
  },
  {
    title: 'Campus Legends Lantern Walk',
    description:
      'SEB guides lead a lantern-lit walk along the Gold Road and the Rose Road, stopping at each towering statue to tell the campus legends whispered about it. Students cluster close in the dark as the tales grow stranger, ending the night with a wish tossed into the Concord Fountain.'
  },
  {
    title: 'Elysium Porch Crawl',
    description:
      'Every porch light in Elysium Village switches on for the porch crawl, and upperclassmen set out snacks, drinks, and speakers on their private patios. Underclassmen roam the row of townhouses in excited packs, finally welcome at the parties they usually only hear about on Bunnyboard.'
  },
  {
    title: 'Drag Cabaret at the Stalestein',
    description:
      "Veridan's drag performers take over the Stalestein's small stage for a cabaret night of lip-syncs, live vocals, and dramatic costume reveals, led by a sharp-tongued host in a towering wig. Students and bikers pack the grimy underground room shoulder to shoulder, waving dollar bills and roaring at every death drop and high kick."
  },
  {
    title: 'Basement Sessions',
    description:
      'Thorne Auditorium opens its basement practice rooms for a night of rotating student acts, each soundproofed room hosting a different band, singer, or ensemble. Listeners drift from door to door through the narrow hallways, catching jazz trios, bedroom-pop duos, and solo cellists along the way.'
  },
  {
    title: 'Stanchion Night Market',
    description:
      'Vendors set up stalls between the mural-covered overpass pillars of Stanchion Street, selling sizzling skewers, secondhand clothes, and handmade jewelry beneath the hanging lanterns. Students wander the crowded lanes with half-price bubble tea from the original CuteTea, bargaining for vintage jackets and beaded earrings.'
  },
  {
    title: 'Pino-Cola Improv Showdown',
    description:
      "Two rival improv troupes take over the Pino-Cola Lounge for a scene-by-scene showdown, spinning wild sketches from suggestions the crowd shouts out. Students pile onto beanbags and gaming chairs in fits of laughter, voting for each round's winner with glow sticks."
  },
  {
    title: 'Food Court Karaoke',
    description:
      "Once the Agora's food court closes, the SEB rolls out a karaoke machine and a sparkly portable stage in front of the indoor waterfalls. Students line up to belt power ballads and cheesy duets while friends wave phone flashlights from the cafeteria tables."
  },
  {
    title: 'Blacklight Mini Golf',
    description:
      'Pier 44 converts its boardwalk mini golf course into a blacklight wonderland after dark, painting every hole in neon and handing out glowing putters. Couples and rowdy groups of friends trade trick shots through glowing windmills and neon loop-the-loops, keeping score on cards that glow in their hands.'
  },
  {
    title: 'Apogee Student Night',
    description:
      'Club Apogee waives its cover charge for anyone with a student ID, though its eye-watering drink prices stay exactly the same. Wide-eyed students crowd the glass-floored section to peer down forty stories, then dance under strobe lights to a masked celebrity DJ.'
  }
]

/** Spring's half-day things during the day in spring break, put on by the city or the students who stayed. */
const SPRING_DAY_BREAK: readonly OccasionEntry[] = [
  {
    title: 'Wristband Day at Pier 44',
    description:
      'With campus nearly empty, Pier 44 hands out free ride wristbands to anyone with a student ID. The few students who stayed share the antique carousel and the creaky cheap rides with local families, munching cotton candy along the boardwalk.'
  },
  {
    title: 'Upside-Down Garden Tour',
    description:
      'With campus quiet, the Veridan Museum of Art offers behind-the-scenes tours of its upside-down garden, leading small groups along the catwalks where gardeners tend the hanging blooms. Students who stayed peer down at the galleries far below while a horticulturist explains how the ceiling stays in flower year round.'
  },
  {
    title: 'Silk River Paddle',
    description:
      'The city parks department leads a guided kayak tour down the Silk River from the Downtown docks, gliding past the glass hotels of Selkie Beach and under the towering ferris wheel at Pier 44. Students left in town fill half the bright orange kayaks, snapping photos of the skyline from the water.'
  },
  {
    title: 'Lotterdale Token Hunt',
    description:
      'Lotterdale Market hosts a citywide treasure hunt through its conjoined barnhouses, hiding brass tokens among the antique stalls and dusty record crates. Students left in town team up with local families to search the cluttered aisles, trading their tokens for vintage trinkets and fresh kettle corn.'
  },
  {
    title: 'Silktown Bike Tour',
    description:
      "The city cycling club leads a free group ride from Green Hill Park through Downtown's brick mill district to the edge of the Promenade towers. Students who stayed rent bikes for a few dollars and pedal alongside local families, stopping for lemonade at a halfway rest station."
  },
  {
    title: "Stayers' Brunch",
    description:
      "Bobby's Diner offers a half-price brunch to students who stayed through the break, serving towering stacks of pancakes and bottomless coffee in its retro booths. The current Bobby makes the rounds from the kitchen, chatting with every table about why they didn't head somewhere exotic."
  },
  {
    title: 'Courtyard Yard Sale',
    description:
      'The students left in the Lowrises spread a sprawling yard sale across the Lowrise 2 courtyard, laying out mismatched mugs, desk lamps, and forgotten kitchen gadgets on bedsheets. Bargain hunters haggle over cheap finds while a portable speaker plays lazy throwback hits.'
  },
  {
    title: 'Green Hill Birding Walk',
    description:
      'A city naturalist leads a bird walk through the quiet corners of Green Hill Park, pointing out warblers, woodpeckers, and nesting hawks among the trees. The few students on campus jot sightings in borrowed field guides as the group pauses beside the marble memorials to listen for songbirds.'
  },
  {
    title: 'Selkie Sandcastle Contest',
    description:
      'The resort that owns Selkie Beach hosts a sandcastle contest on its imported white sand, judged by a lifeguard from his tall wooden chair. Students who stayed form scrappy teams with plastic buckets, competing against tourist families armed with professional sculpting tools.'
  },
  {
    title: 'Quiet Campus Photo Walk',
    description:
      'The photography club leads a walk across the nearly empty campus, framing the Gold Road, the Venus statue, and the Concord Fountain without a single passerby in the shot. Students who stayed trade lenses and framing tips along the way, posting their crowd-free shots to Bunnyboard.'
  },
  {
    title: 'Silktown Pottery Drop-In',
    description:
      'A Downtown ceramics studio in a converted mill building opens its wheels to drop-in visitors for the break, with instructors guiding first-timers through centering and shaping. Students who stayed turn out lopsided bowls and mugs beside local regulars, leaving their pieces on drying racks for the kiln.'
  },
  {
    title: 'Silktown History Walk',
    description:
      "A retired mill worker leads the city's free walking tour through Downtown's brick mill buildings, sharing stories of Veridan's textile boom and bust. The tour ends at the Veridan Museum of Art in front of the Girl at the Window, where he tells a new version of her story to the small crowd of visitors and students."
  }
]

/** Spring's half-day things in the evening in spring break, put on by the city or the students who stayed. */
const SPRING_NIGHT_BREAK: readonly OccasionEntry[] = [
  {
    title: 'Quad Campout',
    description:
      'The students who stayed pitch a cluster of tents around the Concord Fountain, stringing battery lanterns between them across the deserted lawn. Campers share instant noodles, ghost stories, and borrowed blankets late into the night beneath the towering Venus statue.'
  },
  {
    title: 'Pastel Palace Closing Sale',
    description:
      'Pastel Palace marks down its unsold pastries at closing for the break-week crowd, filling the display case with half-price tarts, cream puffs, and pastel-frosted cupcakes. Stayers line up outside the Stanchion Street storefront and carry their boxes to the Venus Quad for an impromptu dessert picnic.'
  },
  {
    title: 'CuteTea Game Marathon',
    description:
      'The Stanchion Street CuteTea keeps its tables open all night for students left in town, lending its entire board game shelf to anyone who buys a drink. Groups huddle over sprawling strategy games and party classics, fueled by endless refills of brown sugar boba.'
  },
  {
    title: 'Midnight Classics Marathon',
    description:
      'Future Cinema stretches its midnight classic into an all-night marathon of black-and-white romances for anyone left in town, opening its largest gilded theater for the occasion. Students sprawl across the velvet seats with oversized popcorn tubs, staying awake through every grainy kiss and dramatic farewell.'
  },
  {
    title: 'Boardwalk Talent Night',
    description:
      'Pier 44 opens a small stage on its boardwalk for a talent night aimed at the students and locals still in town, taking sign-ups on a chalkboard by the carousel. Performers try everything from ukulele ballads to juggling and stand-up as the crowd cheers beneath the colored string lights.'
  },
  {
    title: 'Empty Fridge Potluck',
    description:
      'The few upperclassmen left in Elysium Village pool the contents of their fridges for a potluck on one private patio, porch lights glowing for anyone still around. Students crowd a long folding table of mismatched casseroles, leftover takeout, and creative pasta experiments.'
  },
  {
    title: 'Leaderboard Night at BTB',
    description:
      'With no lines at BTB Arcade for once, the students who stayed spend the night chasing high scores on the oldest cabinets in the back of the warehouse. Small crowds gather around the glowing screens as decades-old leaderboard records finally topple.'
  },
  {
    title: 'Lowrise LAN Party',
    description:
      'The students left in the Lowrises haul their computers and consoles into the Lowrise 4 common room for an all-night LAN party, taping cables along the floor and pushing every couch into a horseshoe. Players trade snacks and trash talk across the glowing screens, running tournament after tournament until dawn.'
  },
  {
    title: 'Eastern Buffet All-Nighter',
    description:
      'Eastern Buffet becomes the unofficial clubhouse for everyone who stayed through the break, with students pushing tables together for an all-night card tournament. Players fuel up on twelve-dollar plates of dumplings, sushi, and noodles as the games run until sunrise.'
  },
  {
    title: 'Stalestein Open Jam',
    description:
      'The Stalestein opens its small stage to anyone still in town for an open jam, lending out a battered drum kit and a pair of house guitars. Locals and students who stayed swap songs until closing as the grimy underground room fills with cheers and feedback.'
  },
  {
    title: 'Downtown Docks Night Fishing',
    description:
      'The city parks department lends out rods and lanterns for a night fishing session on the Downtown docks, with a local angler teaching the basics of baiting and casting. Students who stayed sit along the edge of the pier with thermoses of cocoa, swapping stories as catfish tug at their lines in the dark water.'
  },
  {
    title: 'Threads After Dark',
    description:
      'The Riverside Mall projects a sweeping light show onto the Threads after closing, with the kinetic sculpture turning in time to a booming soundtrack. The handful of students left in town claim the best view from the rooftop terrace as colors ripple across the river.'
  }
]

/** Fall's half-day things during the day. */
const FALL_DAY_FILLERS: readonly OccasionEntry[] = [
  {
    title: 'Kendall Fill-a-Bag Book Sale',
    description:
      'Kendall Library sells off its withdrawn books on long tables in the main lobby, a dollar a bag and fill it yourself. Students squeeze between the engraved shelves to stuff tote bags with old textbooks, oversized atlases, and forgotten novels.'
  },
  {
    title: 'Club Rush',
    description:
      'Every student club sets up a folding table along the Rose Road for Club Rush, decked out with tri-fold posters, candy bowls, and blaring speakers. Students weave through the crowd signing mailing lists, watching quick demos, and collecting free stickers, buttons, and keychains.'
  },
  {
    title: 'Chalk the Gold Road',
    description:
      'The CAPC hands out buckets of chalk and assigns every campus club a square of the Gold Road, offering a prize for the most impressive design. The winding stone road fills with colorful mascots, sprawling murals, and portraits of Frederic Thorne as passersby stop to vote on Bunnyboard.'
  },
  {
    title: "Duchess's Birthday Bash",
    description:
      'The Aquarium at Riverside throws Duchess a birthday party, lowering a frozen cake of crab and shrimp into the river shallows outside her den and streaming it on screens throughout the halls. Students and families in paper party hats crowd the glass tunnel, cheering as the octopus wraps the cake in her arms and flushes a brilliant red.'
  },
  {
    title: 'Lotterdale Chili Cook-Off',
    description:
      'A dozen Silktown cooks bring their bubbling pots of chili to Lotterdale Market, ladling out free tastings to anyone with a spoon and a ballot. Students wander the conjoined barnhouses sampling smoky and fiery recipes, often leaving with an antique trinket alongside their full stomachs.'
  },
  {
    title: 'Bunnyboard Hack Day',
    description:
      "The computer science club fills the Agora's study pods for a hackathon, with teams racing to build new features for Bunnyboard on a steady supply of pizza and energy drinks. Coders hunch over glowing laptops while a panel of student judges circles the pods, scoring every demo on originality and polish."
  },
  {
    title: 'Laser Tag Open',
    description:
      "The laser tag arena on the Riverside Mall's lower floors hosts an open tournament for teams of four, posting a glowing bracket by the entrance. Competitors in neon vests sprint through the fog-filled maze while spectators track the live scoreboard from the lobby."
  },
  {
    title: 'Threads Runway Show',
    description:
      'Fashion design students stage a runway show along the spiraling walkways of the Riverside Mall, with models descending floor by floor around the turning Threads sculpture. Shoppers and classmates crowd the glass railings to snap photos of bold silhouettes, upcycled denim, and hand-dyed silk.'
  },
  {
    title: 'Flu Shot Clinic',
    description:
      'The campus health center sets up a free flu shot clinic in the Agora, with rows of folding chairs and nurses in brightly patterned scrubs. Students roll up their sleeves for quick shots, collecting cartoon bandages and lollipops on their way out.'
  },
  {
    title: 'Pickleball Smash Open',
    description:
      'The pickleball club takes over the indoor courts of a Palaestra Stadium gymnasium for a doubles open, taping kitchen lines across every court and posting a bracket by the doors. Players in visors and bright athletic skirts trade rapid dinks at the net while spectators cheer from the pull-out bleachers.'
  },
  {
    title: 'Secret Menu Crawl',
    description:
      'Fast Eats prints a stamp card for all five of its Veridan locations, each serving a single item off its secret menu. Students ride the Loop tram between stops to collect every stamp, trading a completed card for a limited-edition T-shirt.'
  },
  {
    title: 'CuteTea Flavor Lab',
    description:
      'The Stanchion Street CuteTea invites students behind the counter to blend and name a brand-new bubble tea, setting out jars of syrups, fruit purées, and chewy toppings. Tasters line up along the mural-covered windows to vote, and the winning drink earns a permanent spot on the menu.'
  },
  {
    title: 'Abolish the 8AM Rally',
    description:
      'Students rally at the Jupiter statue at the North Entrance with handmade signs demanding later class times, led by a club founded solely for the cause. Megaphone chants echo down the Gold Road while sleepy supporters sip coffee and sign petitions.'
  },
  {
    title: 'Green Hill Disc Golf Open',
    description:
      'The disc golf club lays out an eighteen-basket course across the rolling hills of Green Hill Park, weaving between stands of old oaks and down the steepest slopes. Players in team jerseys fling discs over the grassy slopes while spectators follow each group from hole to hole.'
  },
  {
    title: 'Orchard Picking at Whitman',
    description:
      'The CAPC opens the Whitman Greenhouse orchard to students for a day of fruit picking, handing out one paper bag per person at the gate. Students wander the leafy rows reaching for ripe citrus and figs while butterflies drift over from the nearby enclosure.'
  },
  {
    title: 'Fighting Game Bracket',
    description:
      'The esports club runs a double-elimination fighting game bracket on the console setups of the Pino-Cola Lounge, streaming every match to Bunnyboard with live commentary. Crowds pack around the screens with snacks and Pino-Cola sodas, erupting at every last-second comeback.'
  },
  {
    title: 'Carousel Workshop Open House',
    description:
      "The restorers who keep Pier 44's antique carousel turning open their workshop to visitors, displaying half-painted horses on sawhorses and racks of antique tools. Curious students try their hand at sanding wooden manes while the craftsmen explain gold-leafing and century-old paint techniques."
  },
  {
    title: 'Mock Trial Scrimmage',
    description:
      'The mock trial team argues a fictional murder case in a borrowed courtroom at the Veridan county courthouse, complete with a retired judge presiding from the bench. Spectators fill the wooden gallery as student attorneys cross-examine witnesses, raise objections, and deliver dramatic closing arguments.'
  },
  {
    title: 'Elysium Croquet Tournament',
    description:
      'Upperclassmen in Elysium Village lay out a croquet course across the lawns between the townhouses, playing in crisp blazers and striped polos. Spectators lounge on the private patios with pitchers of lemonade, clapping politely at every well-placed shot.'
  },
  {
    title: 'Free Headshot Day',
    description:
      'The photography club sets up studio lights and backdrops in the lobby of Thorne Auditorium, offering free professional headshots to any student who signs up. Students in blazers and freshly ironed blouses queue with combs and compact mirrors, practicing their smiles before stepping in front of the camera.'
  }
]

/** Fall's half-day things in the evening. */
const FALL_NIGHT_FILLERS: readonly OccasionEntry[] = [
  {
    title: 'Album Roulette at the Stalestein',
    description:
      'Student bands crowd the cramped underground stage of the Stalestein, each drawing a classic album from a hat and playing it start to finish. Bikers and undergrads pack the sticky floor to shout along, heckle missed chords, and cheer the boldest reinventions.'
  },
  {
    title: "Bobby's Jukebox Hop",
    description:
      "Bobby's Diner hands control of its vintage jukebox to students for a late-night sock hop, pushing the tables aside to clear a checkered dance floor between the booths. Waitresses in period uniforms serve root beer floats as students twist and jive to fifties hits under the neon signs."
  },
  {
    title: 'Vault Heist Mystery',
    description:
      'Reserve Bank Cafe hosts a mystery night built around its own unsolved heist, with actors playing the suspects and clues hidden throughout the old vault. Teams of students race to crack the case over Getaway Lattes, interrogating suspects by candlelight.'
  },
  {
    title: 'Mahjong Night at Eastern Buffet',
    description:
      'Eastern Buffet clears its back tables for a mahjong tournament, with the owner himself teaching the rules to beginners between bowls of noodles. The clatter of tiles fills the room as students and longtime regulars play late into the night, fueled by endless refills of jasmine tea and sesame buns.'
  },
  {
    title: 'CuteTea League Finals',
    description:
      'The board game league plays its championship at the Stanchion Street CuteTea, borrowing every copy of every game on the shelves. Spectators crowd the tables with bubble tea in hand, gasping at every ruthless trade and last-minute victory.'
  },
  {
    title: 'Pier 44 Fireworks Night',
    description:
      'Pier 44 launches a fireworks show from a barge on the Silk River, timing every burst to music piped along the boardwalk. Students crowd the railings and the top of the ferris wheel, gasping as gold and violet blooms reflect across the dark water.'
  },
  {
    title: 'Tunnel Nights',
    description:
      'The Aquarium at Riverside stays open late for an over-21 evening, setting up a softly lit bar at the mouth of the glass tunnel under the river. Couples sip cocktails as schools of fish drift overhead, and the private nooks of the jellyfish room open to walk-ins for one night only.'
  },
  {
    title: 'Thorne Speaker Series',
    description:
      'Thorne Auditorium hosts a sold-out evening talk with a celebrity guest invited by Frederic Thorne himself, whose identity stays secret until the lights go down. Students who snagged tickets in the seconds before they vanished fill all three thousand seats, buzzing with guesses as the spotlight finds the stage.'
  },
  {
    title: 'Movies on Green Hill',
    description:
      'The city parks department hangs a giant screen on the slope of Green Hill Park for an outdoor showing of an old romance film. Students and locals spread picnic blankets across the grass, sharing popcorn and whispering through the slow-burning love story.'
  },
  {
    title: 'Moonlight Yoga in the Orchard',
    description:
      'The yoga club leads a candlelit flow among the orchard trees of the Whitman Greenhouse after hours, lining the winding paths with mats and battery candles. Participants stretch through slow moon salutations and long holds while the soft trickle of the tropical pond fills every pause.'
  },
  {
    title: 'Agora Open Mic Comedy',
    description:
      "The comedy club hosts an open stand-up night on the Agora's upper level, giving each comic five minutes before a red light flashes. Students crowd around café tables to cheer jokes about Bunnyboard, campus coffee, and Frederic Thorne, who is rumored to be in the audience in disguise."
  },
  {
    title: 'Ball Pit After Dark',
    description:
      'The Downtown Fast Eats flagship opens its attached play area to adults after closing, with a DJ spinning throwback hits beside the twisting tube slides. Students dive into the ball pit with milkshakes and cheese fries, racing each other down the slides and posting chaotic videos to Bunnyboard.'
  },
  {
    title: 'Lumiere Student Seating',
    description:
      'Lumiere Fusion opens a single dinner seating at a student price, letting the chef test bold dishes too experimental for paying regulars. Diners in their best outfits taste mysterious foams, smoked desserts, and edible flowers, scribbling their verdicts on gold-edged comment cards.'
  },
  {
    title: 'Midnight Hoops',
    description:
      'Palaestra Stadium keeps a gymnasium open late for a three-on-three basketball tournament, with a DJ booth at half-court and neon lights strung along the railings. Teams in mismatched jerseys battle through quick-fire games as friends pound the bleachers and chant for every buzzer-beater.'
  },
  {
    title: 'Kendall Lock-In',
    description:
      'The library club stays in Kendall Library after closing for a scavenger hunt through the stacks, hiding riddles in the screened terminals and inside long-forgotten books. Teams with flashlights race between the engraved shelves, and the winners see their names added to a brass plaque beside the final clue.'
  },
  {
    title: 'Escape Room Challenge',
    description:
      "The escape room on the Riverside Mall's lower floors hosts a late-night challenge for teams of four, locking each group inside a candlelit Victorian study filled with riddles and hidden compartments. Students race the countdown clock in frantic whispers as the fastest times climb a glowing leaderboard by the exit."
  },
  {
    title: 'After Hours at Freights',
    description:
      'Freights Books & Records clears its lobby after closing for an acoustic jam session beneath the wall of yellowed, signed musician photos. Anyone with an instrument can sit in while browsers wander the towering shelves and couples slip into the curtained reading nooks.'
  },
  {
    title: "Pastel Palace Couples' Night",
    description:
      "Pastel Palace dims its lights for Couples' Night, setting each two-seat table with candles, rose petals, and a tasting flight of limited-edition desserts. Couples share forkfuls of molten lava cake and heart-shaped mille-feuille while singles claim the discounted stools along the window counter."
  },
  {
    title: 'Glow Swim',
    description:
      'Palaestra Stadium switches off its pool lights and scatters glow sticks across the water for a late-night neon swim. Students splash between the floating lights to booming party music while lifeguards in glowing vests patrol the deck.'
  },
  {
    title: 'Overpass Dance Cypher',
    description:
      'Breakdancers from across Veridan form a circle beneath the Stanchion Street overpasses for a late-night cypher, with a DJ spinning from a folding table under the hanging lanterns. Crowds ring the dancers three deep, cheering every headspin, freeze, and footwork battle that spins across the cracked concrete.'
  }
]

/** Fall's half-day things during the day in Thanksgiving break, put on for Friendsgiving week. */
const FALL_DAY_BREAK: readonly OccasionEntry[] = [
  {
    title: 'Pie Bake-Off',
    description:
      "Lowrise 3's kitchen volunteers host a pie bake-off ahead of Friendsgiving, open to anyone with an oven and a cherished family recipe. Judges sample flaky crusts and spiced fillings at a long courtyard table before the leftovers vanish into the hungry crowd."
  },
  {
    title: "Bobby's Biscuit Workshop",
    description:
      "Bobby's Diner opens its kitchen for a Friendsgiving biscuit workshop, with the current Bobby demonstrating the flaky recipe that has not changed since the diner opened. Students in borrowed aprons fold and stamp out their own dough, carrying warm batches home for their Friendsgiving tables."
  },
  {
    title: 'Friendsgiving Grocery Shuttle',
    description:
      'The SEB runs free shuttles from campus to SpringMart so students can stock up for Friendsgiving, and SpringMart hands out recipe cards at the door. Students push overflowing carts through crowded aisles, racing each other to the last boxes of stuffing mix and cranberry sauce.'
  },
  {
    title: 'Friendsgiving Flag Football',
    description:
      'The SEB organizes a Friendsgiving flag football game on the real-grass turf of Palaestra Stadium, splitting players into teams by Lowrise and handing out bright pinnies. Classmates shout from the sidelines with thermoses of cider as players sprint, juke, and dive for flags across the field.'
  },
  {
    title: 'Turkey Trot Fun Run',
    description:
      'The SEB leads a costumed fun run along the winding Gold Road ahead of Friendsgiving, with water stations along the route and a finish line at the Venus statue. Students in turkey hats and feathered headbands jog past cheering classmates, earning pie vouchers at the finish.'
  },
  {
    title: 'Centerpiece Workshop',
    description:
      'The CAPC hosts a centerpiece-making workshop inside the Whitman Greenhouse, handing out cuttings, gourds, candles, and twine to anyone setting a Friendsgiving table. Students arrange their creations on the potting benches before carrying them proudly back to the Lowrises.'
  },
  {
    title: 'Silktown Senior Center Visit',
    description:
      "The SEB buses volunteers to a Downtown senior center ahead of Friendsgiving, bringing board games, pie, and handmade cards for the residents. Students settle in for long rounds of bingo and gin rummy, listening to stories of Veridan's old mill days over cups of coffee."
  },
  {
    title: 'Can Sculpture Drive',
    description:
      'The SEB collects canned food in the Agora for a Silktown food bank, stacking every donation into a towering sculpture beside the indoor waterfalls. Engineering students take charge of the design, building elaborate arches and spires from soup cans and canned beans as the pile grows.'
  },
  {
    title: 'Lumiere Carving Masterclass',
    description:
      "Lumiere Fusion's chef of the day leads a free carving masterclass in the Agora, breaking down a roast turkey on a gleaming butcher block in front of a packed crowd. Students take notes on knife technique and brining secrets, then line up for sample slices and sprigs of fresh herbs to take home."
  },
  {
    title: 'Friendsgiving Table Swap',
    description:
      'Lotterdale Market hosts a table-setting swap for Friendsgiving week, filling its barnhouses with secondhand dishware, mismatched candlesticks, and vintage tablecloths. Students hunting for enough plates to feed their whole floor haggle with local vendors over armfuls of thrift-store china.'
  },
  {
    title: 'Potluck Recipe Swap',
    description:
      'The Lowrise 2 kitchen hosts a recipe swap ahead of Friendsgiving, with students pinning handwritten index cards to a corkboard and setting out tasting spoons for every dish. Cooks trade tips on stuffing, mashed potatoes, and roasted vegetables, leaving with a stack of new recipes and a plan for their potluck.'
  },
  {
    title: 'Gratitude Wall',
    description:
      'The CAPC puts up a giant wall of colorful sticky notes on the Venus Quad, inviting students to share what they are thankful for. Passersby linger to read heartfelt messages, inside jokes, and anonymous confessions, adding their own notes beneath the Venus statue.'
  }
]

/** Fall's half-day things in the evening in Thanksgiving break, put on for Friendsgiving week. */
const FALL_NIGHT_BREAK: readonly OccasionEntry[] = [
  {
    title: 'Turkey Shoot at BTB',
    description:
      'BTB Arcade runs a light-gun tournament on its oldest cabinets, with a frozen turkey waiting on the prize table for the champion. Students crowd the glowing screens in rowdy cheering sections, battling for bragging rights and an unwieldy Friendsgiving centerpiece.'
  },
  {
    title: 'Friendsgiving Sandwich Showdown',
    description:
      "The SEB challenges students to build the ultimate Friendsgiving sandwich in the Agora's food court, laying out roast turkey, stuffing, cranberry sauce, and fresh rolls. Judges in paper chef hats taste towering creations stacked with gravy and crispy onions while the crowd votes for its favorite."
  },
  {
    title: 'Holiday Lights Preview at Pier 44',
    description:
      'Pier 44 switches on its holiday lights for a test run, wrapping the antique carousel and the ferris wheel in thousands of twinkling bulbs. Students stroll the boardwalk with cups of warm cider, riding the carousel before the holiday crowds arrive.'
  },
  {
    title: 'Stanchion Cocoa Crawl',
    description:
      "Stanchion Street's cafés and dessert shops serve a different hot cocoa at each stop for the holiday week, from Pastel Palace's marshmallow towers to CuteTea's brown sugar cocoa. Students stroll the lantern-lit lanes with stamp cards and steaming cups, debating their favorite cup as they go."
  },
  {
    title: 'Fireside Story Night',
    description:
      'The SEB lights the sunken fire pits on the Venus Quad for a night of storytelling, inviting students to share their most chaotic holiday dinner memories. Listeners huddle in blankets with mugs of cocoa as the most outrageous tales earn rounds of applause.'
  },
  {
    title: 'Townie Night at the Stalestein',
    description:
      'Silktown kids home from colleges elsewhere pack the Stalestein for the holiday week, filling the grimy underground bar with reunions and loud toasts. VU students who wander in mingle with the hometown crowd while a local cover band plays nostalgic hits.'
  },
  {
    title: 'Rivalry Game Watch Party',
    description:
      'The SEB projects the big holiday football game across every screen in the Pino-Cola Lounge, setting out trays of wings, nachos, and sliders for the crowd. Students in team colors pack the beanbags and gaming chairs, groaning and roaring together at every fumble and touchdown.'
  },
  {
    title: 'Holiday Double Feature',
    description:
      'Future Cinema hosts a double feature of classic holiday films, offering free popcorn to anyone with a student ID. Students settle into the plush velvet seats, cheering at the cheesy first film and tearing up through the heartfelt second.'
  },
  {
    title: 'Holiday Sing-Along at Thorne',
    description:
      'The student choir leads a holiday sing-along in Thorne Auditorium, projecting the lyrics above the stage and passing out paper song sheets at the door. Students and locals fill the seats, belting out old favorites as the seashell ceiling rings with off-key harmonies.'
  },
  {
    title: 'Elysium Pie Crawl',
    description:
      'Elysium Village residents leave their porch lights on for a pie crawl, setting out homemade pies and warm cider on their private patios. Students drift from townhouse to townhouse with paper plates, sampling pecan, pumpkin, and apple slices under the glowing lights.'
  },
  {
    title: 'Eastern Buffet Open Table',
    description:
      "Eastern Buffet's owner opens his doors to anyone without Friendsgiving plans, setting a long banquet table down the center of the restaurant and waving off the usual door fee. Students, local workers, and night-shift regulars share heaping plates of char siu, fried rice, and longevity noodles, toasting each other with paper cups of tea."
  },
  {
    title: 'Friendsgiving Dress Rehearsal',
    description:
      "Lowrise 3's kitchen volunteers host a practice run of their Friendsgiving dishes, inviting anyone who wanders in to taste-test the experiments. Students crowd the steamy communal kitchen sampling lumpy gravy, sticky glazed yams, and slightly burnt dinner rolls."
  }
]
