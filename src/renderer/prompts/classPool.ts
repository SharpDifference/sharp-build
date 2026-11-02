import type { CatalogEntry, CatalogPool } from '@shared/application'

/**
 * The authored classes a skipped catalog is dealt from: each of the four catalog pools, and
 * the interest classes a girl's own is drawn from. Codes and titles are unique across every
 * pool; PE carries no kind, and none of it is a swim class, which the scheduler adds itself.
 */

/** A pool the skipped catalog is dealt from: the four catalog pools and the interest classes. */
export type ClassPoolId = CatalogPool | 'interest'

/** The grab bag one class pool is dealt from. */
export function classBagOf(pool: ClassPoolId): string {
  return `newGame.class.${pool}`
}

/** Physical education: sports, fitness and movement classes, every one on dry land. */
const PE_CLASSES: readonly CatalogEntry[] = [
  {
    code: 'PE 104',
    title: 'Tennis Fundamentals and Match Play',
    description:
      'Covers continental grips, topspin groundstrokes, and the flat serve through singles and doubles play on the outdoor courts.'
  },
  {
    code: 'PE 106',
    title: 'Boxing Fundamentals and Conditioning',
    description:
      'Teaches stance, footwork, and jab-cross combinations through heavy bag rounds, mitt work, and circuit conditioning.'
  },
  {
    code: 'PE 108',
    title: 'Indoor Volleyball and Team Rotations',
    description:
      'A team sport course building forearm passing, overhead setting, and serve receive into full six-a-side rotational matches.'
  },
  {
    code: 'PE 114',
    title: 'Ballroom and Latin Dance',
    description:
      'A partner dance course covering the waltz, foxtrot, cha-cha, and rumba, from frame and posture to social floor etiquette.'
  },
  {
    code: 'PE 110',
    title: 'Hatha Yoga and Breath Control',
    description:
      'Focuses on standing postures, balance sequences, and pranayama breathwork, closing each session with a guided final relaxation.'
  },
  {
    code: 'PE 118',
    title: 'Brazilian Jiu-Jitsu Fundamentals',
    description:
      'Introduces guard retention, positional escapes, and submission defense through technical drilling and controlled rolling on the mats.'
  },
  {
    code: 'PE 112',
    title: 'Foundations of Weight Training',
    description:
      'An introductory strength course teaching squat, bench press, and deadlift mechanics within a logged progressive overload program.'
  },
  {
    code: 'PE 124',
    title: 'Barre Fitness',
    description:
      'A ballet-inspired conditioning class building muscular endurance, posture, and balance through small isometric movements at the barre.'
  },
  {
    code: 'PE 115',
    title: 'Indoor Climbing and Belay Technique',
    description:
      'An introductory climbing course teaching figure-eight tie-ins, top-rope belay commands, and efficient footwork on the indoor walls.'
  },
  {
    code: 'PE 117',
    title: 'Foundations of Foil Fencing',
    description:
      'Teaches foil footwork, parry-riposte sequences, and right-of-way rules, culminating in a masked round-robin tournament.'
  },
  {
    code: 'PE 128',
    title: 'Track and Field: Sprints and Jumps',
    description:
      'Develops block starts, sprint mechanics, and the long jump approach on the outdoor track, with timed trials throughout the term.'
  },
  {
    code: 'PE 120',
    title: 'Badminton Strategy and Court Movement',
    description:
      'A racquet sport class covering overhead clears, drop shots, and jump smashes alongside doubles rotation and court coverage.'
  },
  {
    code: 'PE 134',
    title: 'Flag Football and Offensive Schemes',
    description:
      'A field sport class teaching route running, quarterback reads, and flag-pulling defense in seven-on-seven league games.'
  },
  {
    code: 'PE 122',
    title: 'Classical Mat Pilates',
    description:
      'Builds core control, spinal articulation, and postural alignment through the classical Pilates mat sequence at a deliberate pace.'
  },
  {
    code: 'PE 138',
    title: 'Kettlebell and Functional Strength',
    description:
      'Builds hip hinge power, grip strength, and core stability through kettlebell swings, loaded carries, and Turkish get-ups.'
  },
  {
    code: 'PE 125',
    title: 'Distance Running and Race Pacing',
    description:
      'A conditioning course developing aerobic base mileage, interval pacing, and running economy toward a timed five-kilometer race.'
  },
  {
    code: 'PE 144',
    title: 'Lacrosse Skills and Field Play',
    description:
      'An introductory field sport course covering cradling, passing, and ground ball scoops before advancing to full-field scrimmages.'
  },
  {
    code: 'PE 127',
    title: 'Basketball Fundamentals and Team Defense',
    description:
      'Develops ball handling, jump shot mechanics, and man-to-man defense through half-court drills and full-court scrimmages.'
  },
  {
    code: 'PE 130',
    title: 'Practical Self-Defense',
    description:
      'An applied self-defense course drilling situational awareness, verbal de-escalation, and escapes from grabs, chokes, and ground holds.'
  },
  {
    code: 'PE 148',
    title: 'Racquetball and Squash',
    description:
      'Teaches wall angles, kill shots, and court positioning across fast-paced singles matches in the enclosed glass-backed courts.'
  },
  {
    code: 'PE 132',
    title: 'Recurve Archery and Range Safety',
    description:
      'Covers stance, anchor point consistency, and clean release with the recurve bow on targets from ten to thirty meters.'
  },
  {
    code: 'PE 152',
    title: 'Aerial Silks and Flexibility',
    description:
      'An aerial fitness course teaching climbs, wraps, and inverted holds on suspended silks alongside a progressive flexibility program.'
  },
  {
    code: 'PE 135',
    title: 'Golf Swing Mechanics and Course Etiquette',
    description:
      'An introductory golf course covering grip, full-swing mechanics on the driving range, short-game chipping, and putting fundamentals.'
  },
  {
    code: 'PE 157',
    title: 'Fastpitch Softball',
    description:
      'Covers windmill pitching, fielding fundamentals, and situational base running through intrasquad games on the diamond.'
  },
  {
    code: 'PE 137',
    title: 'Soccer Tactics and Ball Control',
    description:
      'Teaches first touch, passing combinations, and positional play through small-sided games that build toward full eleven-a-side matches.'
  },
  {
    code: 'PE 160',
    title: 'Parkour and Movement Training',
    description:
      'A movement course teaching precision jumps, vaults, and safe landings across modular obstacles to build spatial awareness and explosive power.'
  },
  {
    code: 'PE 140',
    title: 'Taekwondo Forms and Sparring',
    description:
      'A martial arts course drilling stances, blocks, and roundhouse kicks through traditional forms, controlled sparring, and an end-of-term belt test.'
  },
  {
    code: 'PE 142',
    title: 'Indoor Cycling and Interval Conditioning',
    description:
      'Builds cardiovascular endurance, cadence control, and heart rate awareness through music-driven interval rides on stationary bikes.'
  },
  {
    code: 'PE 162',
    title: 'Inline Skating and Agility',
    description:
      'Covers stride technique, controlled stops, and crossover turns on inline skates along campus paths and a weaving cone course.'
  },
  {
    code: 'PE 145',
    title: 'Ultimate Disc and Field Strategy',
    description:
      'A field sport class covering backhand and forehand throws, cutting patterns, and stack offenses in self-officiated scrimmages.'
  },
  {
    code: 'PE 165',
    title: 'Cheer and Stunt Fundamentals',
    description:
      'A spirit squad course developing partner stunts, tumbling progressions, and synchronized motions toward a choreographed routine performed for the class.'
  },
  {
    code: 'PE 147',
    title: 'Competitive Table Tennis',
    description:
      'Focuses on topspin loops, backspin pushes, and short serves, with footwork drills and a weekly challenge ladder.'
  },
  {
    code: 'PE 168',
    title: 'Pickleball and Paddle Sports',
    description:
      'Teaches dinks, third-shot drops, and kitchen-line strategy through doubles round-robin play on the outdoor courts.'
  },
  {
    code: 'PE 150',
    title: 'Tai Chi and Moving Meditation',
    description:
      'A low-impact movement course teaching the short Yang-style form for balance, breath regulation, and mental focus.'
  },
  {
    code: 'PE 170',
    title: 'Hip-Hop Dance Fitness',
    description:
      'A dance fitness class building cardiovascular stamina and rhythm through high-energy hip-hop choreography and weekly freestyle challenges.'
  },
  {
    code: 'PE 155',
    title: 'Trail Fitness and Backcountry Hiking',
    description:
      'Covers trail conditioning, map and compass navigation, and leave-no-trace ethics through progressively longer weekend hikes.'
  }
]

/** Humanities: history, philosophy, literature, languages and religion. */
const HUMANITIES_CLASSES: readonly CatalogEntry[] = [
  {
    code: 'HIST 110',
    title: 'The Ancient Mediterranean World',
    description:
      'Traces Greek city-states, Roman expansion, and Near Eastern empires from the Bronze Age collapse to the fall of the Western Empire.',
    kind: 'lecture'
  },
  {
    code: 'HIST 120',
    title: 'The Age of Revolutions',
    description:
      'Traces the American, French, and Haitian revolutions through pamphlets, declarations, and the wars that remade the Atlantic world.',
    kind: 'lecture'
  },
  {
    code: 'PHIL 101',
    title: 'Introduction to Philosophy',
    description:
      'A survey lecture examining epistemology, philosophy of mind, and free will through primary texts from Plato to contemporary thinkers.',
    kind: 'lecture'
  },
  {
    code: 'PHIL 210',
    title: 'Ethics and Moral Reasoning',
    description:
      'A case-driven seminar examining utilitarianism, Kantian duty, and virtue ethics through contemporary dilemmas in medicine, technology, and business.',
    kind: 'lecture'
  },
  {
    code: 'ENGL 220',
    title: 'The Nineteenth-Century Novel',
    description:
      'Examines marriage, money, and social ambition in the long novels of Austen, the Brontës, Dickens, Eliot, and Tolstoy.',
    kind: 'lecture'
  },
  {
    code: 'ENGL 150',
    title: "Shakespeare's Comedies and Romances",
    description:
      'Examines disguise, mistaken identity, and courtship across Twelfth Night, As You Like It, and The Tempest, read alongside modern stage productions.',
    kind: 'lecture'
  },
  {
    code: 'ENGL 240',
    title: 'Memoir and the Personal Essay',
    description:
      'A creative nonfiction workshop centered on memoir craft, narrative voice, and revision, producing a polished personal essay every three weeks.',
    kind: 'project'
  },
  {
    code: 'ENGL 260',
    title: 'Fiction Writing Workshop',
    description:
      'A short fiction workshop focused on scene building, dialogue, and point of view, with two revised stories submitted for peer critique.',
    kind: 'project'
  },
  {
    code: 'SPAN 101',
    title: 'Elementary Spanish I',
    description:
      'Introduces present-tense conjugation, everyday conversational phrases, and core vocabulary for food, family, and travel in an immersive classroom.',
    kind: 'lecture'
  },
  {
    code: 'FREN 101',
    title: 'Elementary French I',
    description:
      'A conversation-based language course building nasal vowels, gendered nouns, and everyday phrases through French films, songs, and café role-plays.',
    kind: 'lecture'
  },
  {
    code: 'JPN 101',
    title: 'Elementary Japanese I',
    description:
      'An introductory language course covering hiragana, katakana, the first hundred kanji, and polite speech for greetings, shopping, and directions.',
    kind: 'lecture'
  },
  {
    code: 'KOR 101',
    title: 'Elementary Korean I',
    description:
      'Teaches the Hangul alphabet, polite verb endings, and essential phrases for ordering food and riding the subway, supported by television drama clips.',
    kind: 'lecture'
  },
  {
    code: 'RELS 150',
    title: 'World Religions',
    description:
      'Surveys the scriptures, rituals, and sacred calendars of Hinduism, Buddhism, Judaism, Christianity, and Islam in comparative perspective.',
    kind: 'lecture'
  },
  {
    code: 'HIST 230',
    title: 'Mills, Labor, and the Industrial City',
    description:
      'Analyzes nineteenth-century textile mills, labor movements, and industrial decline through the history of an American river town.',
    kind: 'lecture'
  },
  {
    code: 'HIST 245',
    title: 'The Silk Roads',
    description:
      'A sweeping historical survey tracing caravan trade, monastic networks, and cultural exchange across Asia from the Han dynasty to the Mongol Empire.',
    kind: 'lecture'
  },
  {
    code: 'RELS 240',
    title: 'Mysticism and Sacred Poetry',
    description:
      'A seminar exploring Sufi poetry, Kabbalah, and Christian contemplative writing as traditions of direct religious experience.',
    kind: 'lecture'
  },
  {
    code: 'HIST 290',
    title: 'Oral History and Community Archives',
    description:
      'A fieldwork practicum training students to record, transcribe, and archive interviews with local residents under the ethical standards of oral history.',
    kind: 'project'
  },
  {
    code: 'CLAS 110',
    title: 'Beginning Latin I',
    description:
      'Introduces noun declensions, verb conjugations, and core vocabulary through graded readings adapted from Caesar and Ovid.',
    kind: 'lecture'
  },
  {
    code: 'CLAS 205',
    title: 'Greek and Roman Mythology',
    description:
      'Explores gods, heroes, and monsters in Homeric epic and Athenian tragedy alongside their retellings in painting and film.',
    kind: 'lecture'
  },
  {
    code: 'HIST 310',
    title: 'Digital Humanities Lab',
    description:
      'A project lab in which students digitize, map, and annotate historical archives, building an interactive online exhibit by the end of term.',
    kind: 'project'
  }
]

/** Arts: studio art, music, theater, film, design, dance and photography. */
const ARTS_CLASSES: readonly CatalogEntry[] = [
  {
    code: 'ART 110',
    title: 'Observational Drawing I',
    description:
      'A studio course developing line, value, and proportion in graphite and charcoal through still lifes, interiors, and the clothed figure.',
    kind: 'project'
  },
  {
    code: 'ART 120',
    title: 'Painting I: Oils',
    description:
      'Teaches color mixing, layered glazing, and alla prima technique through still life, landscape, and portrait studies in oil.',
    kind: 'project'
  },
  {
    code: 'ART 130',
    title: 'Ceramics: Wheel Throwing',
    description:
      "Teaches centering, pulling, and trimming on the potter's wheel through glazing and kiln firing a finished set of tableware.",
    kind: 'project'
  },
  {
    code: 'ART 140',
    title: 'Printmaking: Relief and Screen',
    description:
      'A printmaking studio covering linocut carving, screen printing, and editioning, ending in a portfolio of signed limited prints.',
    kind: 'project'
  },
  {
    code: 'MUSC 105',
    title: 'Music Appreciation and Listening Skills',
    description:
      'A guided listening lecture examining symphonic form, chamber repertoire, and operatic conventions across the concert tradition from Bach to the present.',
    kind: 'lecture'
  },
  {
    code: 'MUSC 160',
    title: 'Class Voice and Vocal Technique',
    description:
      'Builds breath support, resonance, and diction through group vocal exercises and solo art songs performed at a term-end recital.',
    kind: 'project'
  },
  {
    code: 'MUSC 140',
    title: 'Music Theory I: Scales and Harmony',
    description:
      'Covers scales, intervals, and four-part voice leading, reinforced through weekly ear training and sight-singing exercises.',
    kind: 'lecture'
  },
  {
    code: 'MUSC 220',
    title: 'Electronic Music Production',
    description:
      'A production studio teaching synthesis, sampling, and arrangement in a digital audio workstation, culminating in an original three-track EP.',
    kind: 'project'
  },
  {
    code: 'THEA 120',
    title: 'Acting I: Scene Study',
    description:
      'A performance studio building vocal projection, physical presence, and scene analysis toward two-person scenes staged in the final week.',
    kind: 'project'
  },
  {
    code: 'THEA 210',
    title: 'Stagecraft and Set Design',
    description:
      'Covers set construction, scenic painting, and stage lighting as students build and run the technical crew for a campus production.',
    kind: 'project'
  },
  {
    code: 'FILM 200',
    title: 'History of World Cinema',
    description:
      'Traces silent comedy, the Hollywood studio system, and the European new waves through weekly screenings and formal analysis.',
    kind: 'lecture'
  },
  {
    code: 'FILM 150',
    title: 'Introduction to Filmmaking',
    description:
      'A hands-on production workshop covering camera operation, shot composition, and editing as students shoot and cut a five-minute short film.',
    kind: 'project'
  },
  {
    code: 'DSGN 150',
    title: 'Typography and Editorial Layout',
    description:
      'A design studio exploring letterform anatomy, grid systems, and typesetting for print and screen, culminating in a bound booklet.',
    kind: 'project'
  },
  {
    code: 'DSGN 210',
    title: 'Graphic Design Fundamentals',
    description:
      'Explores composition, color theory, and visual hierarchy through poster, logo, and packaging projects built in industry-standard software.',
    kind: 'project'
  },
  {
    code: 'DANC 140',
    title: 'Contemporary Dance and Choreography',
    description:
      'Explores floor work, release technique, and structured improvisation, culminating in an original group piece performed at the end of term.',
    kind: 'project'
  },
  {
    code: 'ARTH 150',
    title: 'Art of the Italian Renaissance',
    description:
      'An illustrated survey tracing perspective, patronage, and humanism through the paintings, sculpture, and architecture of Florence, Rome, and Venice.',
    kind: 'lecture'
  },
  {
    code: 'ARTH 210',
    title: 'Modern Art: Impressionism to Abstraction',
    description:
      'A slide-based lecture charting the movements, manifestos, and gallery scandals that transformed European and American painting between 1860 and 1960.',
    kind: 'lecture'
  },
  {
    code: 'DANC 120',
    title: 'Ballet Technique I',
    description:
      'Develops turnout, alignment, and classical vocabulary through barre and center work, closing with a short studio showing.',
    kind: 'project'
  },
  {
    code: 'PHOT 120',
    title: 'Black-and-White Darkroom Photography',
    description:
      'Teaches manual exposure, film development, and enlarger printing toward a portfolio of twelve finished silver gelatin prints.',
    kind: 'project'
  },
  {
    code: 'MUSC 130',
    title: 'The History of Jazz',
    description:
      'A music history lecture tracing jazz from New Orleans brass bands through swing, bebop, and fusion, with weekly listening sessions.',
    kind: 'lecture'
  }
]

/** Department courses at the intro and intermediate levels, which also serve as major classes. */
const MISC_CLASSES: readonly CatalogEntry[] = [
  {
    code: 'BIO 110',
    title: 'Principles of Biology',
    description:
      'Introduces cellular structure, Mendelian genetics, evolution, and ecology, reinforced through weekly hands-on laboratory sessions.',
    kind: 'lecture'
  },
  {
    code: 'BIO 230',
    title: 'Microbiology',
    description:
      'Examines bacterial structure, microbial metabolism, and host-pathogen interactions, with weekly lab work in culturing and staining.',
    kind: 'lecture'
  },
  {
    code: 'BIO 220',
    title: 'Genetics and Genomics',
    description:
      "A lecture course tracing inheritance, gene expression, and mutation from Mendel's pea plants to modern genome sequencing and editing tools.",
    kind: 'lecture'
  },
  {
    code: 'BIO 240',
    title: 'Human Anatomy and Physiology',
    description:
      'Examines the structure and function of human organ systems through anatomical models, clinical case studies, and dissection labs.',
    kind: 'lecture'
  },
  {
    code: 'BIO 260',
    title: 'Marine Biology',
    description:
      'A field-oriented lecture surveying ocean ecosystems, marine invertebrates, and coral reef ecology, with an aquarium field trip midway through the term.',
    kind: 'lecture'
  },
  {
    code: 'BIO 315',
    title: 'Field Ecology Research',
    description:
      'A field research practicum in which students design and carry out a population or habitat study, from sampling plan to final report.',
    kind: 'project'
  },
  {
    code: 'CHEM 111',
    title: 'General Chemistry I',
    description:
      'Covers atomic structure, chemical bonding, stoichiometry, and gas laws through weekly problem sets and laboratory experiments.',
    kind: 'lecture'
  },
  {
    code: 'BIO 330',
    title: 'Neurobiology',
    description:
      'Traces neuron signaling, synaptic plasticity, and sensory systems from ion channels to the circuits behind memory and behavior.',
    kind: 'lecture'
  },
  {
    code: 'CHEM 230',
    title: 'Organic Chemistry I',
    description:
      'An intensive lecture course on carbon compound structure, stereochemistry, and reaction mechanisms drawn arrow by arrow.',
    kind: 'lecture'
  },
  {
    code: 'CHEM 340',
    title: 'Principles of Biochemistry',
    description:
      'Analyzes protein structure, enzyme kinetics, and the metabolic pathways that convert nutrients into cellular energy.',
    kind: 'lecture'
  },
  {
    code: 'CHEM 112',
    title: 'General Chemistry II',
    description:
      "A continuation lecture on equilibrium, acid-base chemistry, reaction kinetics, and electrochemistry, building directly on the first term's foundations.",
    kind: 'lecture'
  },
  {
    code: 'PHYS 101',
    title: 'Physics I: Mechanics',
    description:
      'An algebra-based lecture course covering kinematics, Newtonian forces, energy, and momentum, tested on carts, springs, and pendulums in lab.',
    kind: 'lecture'
  },
  {
    code: 'PHYS 202',
    title: 'Electricity and Magnetism',
    description:
      "Develops electrostatics, circuit theory, and electromagnetic waves from Coulomb's law through Maxwell's equations.",
    kind: 'lecture'
  },
  {
    code: 'CHEM 260',
    title: 'Analytical Chemistry Lab',
    description:
      'Walks students through titration, spectroscopy, and chromatography experiments, ending in an independent analysis of a real water sample.',
    kind: 'project'
  },
  {
    code: 'ASTR 105',
    title: 'Planetary Science and the Solar System',
    description:
      'A survey lecture examining the sun, planets, moons, and comets, with evening telescope viewing sessions on campus.',
    kind: 'lecture'
  },
  {
    code: 'GEOL 101',
    title: 'Physical Geology',
    description:
      'Introduces mineral identification, plate tectonics, and erosional processes, with field trips along the local river valley.',
    kind: 'lecture'
  },
  {
    code: 'PHYS 150',
    title: 'The Physics of Music and Sound',
    description:
      'An applied physics lecture exploring wave mechanics, resonance, and acoustics through the physics of instruments, voices, and concert halls.',
    kind: 'lecture'
  },
  {
    code: 'ENVS 120',
    title: 'Introduction to Environmental Science',
    description:
      'An interdisciplinary lecture examining climate systems, water resources, and biodiversity loss alongside the science behind environmental policy.',
    kind: 'lecture'
  },
  {
    code: 'ENVS 310',
    title: 'Sustainable Design Studio',
    description:
      'Guides teams through energy and water audits of a campus building, ending in a costed retrofit proposal presented to facilities staff.',
    kind: 'project'
  },
  {
    code: 'ASTR 220',
    title: 'Stars and Galaxies',
    description:
      'Surveys stellar evolution, black holes, and galaxy formation, connecting telescope observations to the physics of the universe.',
    kind: 'lecture'
  },
  {
    code: 'PSYC 101',
    title: 'Introduction to Psychology',
    description:
      'A foundational survey covering perception, memory, learning, and psychological disorders through the landmark experiments that defined the field.',
    kind: 'lecture'
  },
  {
    code: 'PSYC 210',
    title: 'Lifespan Developmental Psychology',
    description:
      'Traces cognitive, linguistic, and social development from infancy through old age, with emphasis on attachment and family systems.',
    kind: 'lecture'
  },
  {
    code: 'ENVS 230',
    title: 'Water Resources and Watershed Management',
    description:
      'A policy-focused lecture on river hydrology, groundwater recharge, and watershed governance, built around case studies of urban river restoration.',
    kind: 'lecture'
  },
  {
    code: 'PSYC 230',
    title: 'Social Psychology',
    description:
      'A lecture course examining conformity, persuasion, prejudice, and interpersonal attraction through classic and contemporary social experiments.',
    kind: 'lecture'
  },
  {
    code: 'PSYC 250',
    title: 'Research Methods in Psychology',
    description:
      'Guides students through designing, running, and analyzing an original experiment, from consent forms and hypotheses to a final research poster.',
    kind: 'project'
  },
  {
    code: 'PSYC 220',
    title: 'Abnormal Psychology',
    description:
      'Examines anxiety, mood, and personality disorders alongside the diagnostic criteria and treatments used in clinical practice.',
    kind: 'lecture'
  },
  {
    code: 'SOC 101',
    title: 'Introduction to Sociology',
    description:
      'An introductory survey examining class, race, gender, and religion as social forces, alongside the research methods used to study them.',
    kind: 'lecture'
  },
  {
    code: 'SOC 240',
    title: 'Urban Sociology',
    description:
      'Analyzes neighborhood formation, residential segregation, and gentrification, with the districts of the surrounding city as a running case study.',
    kind: 'lecture'
  },
  {
    code: 'PSYC 270',
    title: 'Cognitive Psychology',
    description:
      'A lab-informed lecture modeling attention, working memory, and decision-making as information processing, with reaction-time experiments run in class.',
    kind: 'lecture'
  },
  {
    code: 'ANTH 102',
    title: 'Cultural Anthropology',
    description:
      'A comparative lecture exploring kinship, ritual, exchange, and belief systems through ethnographies of everyday life around the world.',
    kind: 'lecture'
  },
  {
    code: 'ANTH 260',
    title: 'Ethnographic Fieldwork',
    description:
      'Trains students in participant observation, interviewing, and field notes as they produce an ethnography of a local community.',
    kind: 'project'
  },
  {
    code: 'PSYC 320',
    title: 'Counseling Skills Practicum',
    description:
      'Trains students in active listening, reflective responses, and ethical boundaries through recorded role-play sessions and peer feedback.',
    kind: 'project'
  },
  {
    code: 'ECON 101',
    title: 'Principles of Microeconomics',
    description:
      'An introductory lecture covering supply and demand, price elasticity, and the decision-making of households and firms.',
    kind: 'lecture'
  },
  {
    code: 'ECON 102',
    title: 'Principles of Macroeconomics',
    description:
      'Surveys economic growth, inflation, unemployment, and the monetary and fiscal tools used to steer national economies.',
    kind: 'lecture'
  },
  {
    code: 'SOC 250',
    title: 'Sociology of Gender',
    description:
      'A sociology lecture tracing how gender norms shape work, family, and power across cultures and historical periods.',
    kind: 'lecture'
  },
  {
    code: 'ECON 201',
    title: 'Intermediate Microeconomics',
    description:
      'A calculus-based lecture course developing consumer theory, producer theory, and market structure through game theory and welfare analysis.',
    kind: 'lecture'
  },
  {
    code: 'POLI 110',
    title: 'American Government and Politics',
    description:
      'Examines the Constitution, Congress, the presidency, and the federal courts alongside the parties and interest groups that shape them.',
    kind: 'lecture'
  },
  {
    code: 'ANTH 210',
    title: 'Archaeology Field Methods',
    description:
      'Teaches excavation, artifact cataloging, and site mapping through a supervised dig and a final site report.',
    kind: 'project'
  },
  {
    code: 'POLI 220',
    title: 'International Relations',
    description:
      'A survey lecture analyzing war, trade, and international institutions through realist, liberal, and constructivist theories of state behavior.',
    kind: 'lecture'
  },
  {
    code: 'POLI 245',
    title: 'Model United Nations',
    description:
      'Prepares students to represent assigned nations in simulated committee sessions, drafting position papers and resolutions for a closing conference.',
    kind: 'project'
  },
  {
    code: 'ECON 230',
    title: 'Behavioral Economics',
    description:
      'A research-driven lecture examining the biases, heuristics, and nudges that explain why real people depart from rational economic models.',
    kind: 'lecture'
  },
  {
    code: 'BUS 101',
    title: 'Introduction to Business',
    description:
      'An introductory survey covering business organization, financing, staffing, and marketing as a foundation for the business curriculum.',
    kind: 'lecture'
  },
  {
    code: 'ACCT 201',
    title: 'Financial Accounting',
    description:
      'Covers journal entries, balance sheets, income statements, and cash flow reporting under generally accepted accounting principles.',
    kind: 'lecture'
  },
  {
    code: 'ECON 310',
    title: 'Introduction to Econometrics',
    description:
      'Develops regression analysis, causal inference, and hypothesis testing using real economic data sets and statistical software.',
    kind: 'lecture'
  },
  {
    code: 'FIN 220',
    title: 'Corporate Finance',
    description:
      'A quantitative lecture course on the time value of money, risk and return, valuation, and capital budgeting decisions.',
    kind: 'lecture'
  },
  {
    code: 'MKTG 210',
    title: 'Principles of Marketing',
    description:
      'Introduces market segmentation, brand positioning, pricing strategy, and the consumer research methods behind modern advertising.',
    kind: 'lecture'
  },
  {
    code: 'POLI 150',
    title: 'Introduction to Political Theory',
    description:
      'A political theory lecture weighing justice, liberty, and state authority in the works of Locke, Rousseau, Mill, and Rawls.',
    kind: 'lecture'
  },
  {
    code: 'MKTG 320',
    title: 'Marketing Campaign Workshop',
    description:
      'A client-based workshop in which teams research, design, and pitch an integrated marketing campaign for a local business.',
    kind: 'project'
  },
  {
    code: 'MGMT 230',
    title: 'Organizational Behavior',
    description:
      'Examines motivation, leadership styles, team dynamics, and workplace culture through organizational research and case studies.',
    kind: 'lecture'
  },
  {
    code: 'POLI 260',
    title: 'Campaigns and Elections',
    description:
      'Coaches teams through polling, message testing, and voter outreach as they design a full campaign plan for a mock candidate.',
    kind: 'project'
  },
  {
    code: 'MGMT 250',
    title: 'Entrepreneurship and Venture Design',
    description:
      'A venture studio guiding students from an initial business concept through customer discovery interviews to a final investor pitch.',
    kind: 'project'
  },
  {
    code: 'CS 110',
    title: 'Introduction to Programming',
    description:
      'Introduces variables, control flow, functions, and lists in a high-level language through weekly programming assignments.',
    kind: 'lecture'
  },
  {
    code: 'BUS 210',
    title: 'Business Law and Ethics',
    description:
      'A case-based lecture covering contracts, liability, and intellectual property alongside the ethical dilemmas managers face.',
    kind: 'lecture'
  },
  {
    code: 'CS 210',
    title: 'Data Structures',
    description:
      'A lecture course on the implementation and analysis of lists, stacks, trees, hash tables, and graphs.',
    kind: 'lecture'
  },
  {
    code: 'CS 240',
    title: 'Design and Analysis of Algorithms',
    description:
      'Analyzes sorting, searching, graph traversal, and dynamic programming algorithms, with proofs of correctness and runtime complexity.',
    kind: 'lecture'
  },
  {
    code: 'HOSP 120',
    title: 'Introduction to Hospitality Management',
    description:
      'Introduces hotel operations, guest services, and event management through case studies of resorts, restaurants, and convention centers.',
    kind: 'lecture'
  },
  {
    code: 'CS 260',
    title: 'Full-Stack Web Development',
    description:
      'A project studio covering HTML structure, CSS styling, JavaScript, and databases, culminating in a deployed web application.',
    kind: 'project'
  },
  {
    code: 'CS 280',
    title: 'Game Prototyping Studio',
    description:
      'Guides students through prototyping, playtesting, and polishing a small video game, covering engine basics, level design, and control feel.',
    kind: 'project'
  },
  {
    code: 'FASH 110',
    title: 'Fashion Design I',
    description:
      'A design studio covering fashion sketching, pattern drafting, and garment construction, culminating in a three-look mini collection.',
    kind: 'project'
  },
  {
    code: 'CS 350',
    title: 'Software Engineering',
    description:
      'A team-based capstone practicum in which groups of four plan, build, test, and ship an application through agile sprints and code reviews.',
    kind: 'project'
  },
  {
    code: 'ENGR 101',
    title: 'Introduction to Engineering Design',
    description:
      'Introduces computer-aided design, shop safety, and iterative prototyping as teams tackle small real-world design challenges.',
    kind: 'project'
  },
  {
    code: 'CS 220',
    title: 'Computer Systems',
    description:
      'Explores memory, processors, operating systems, and low-level programming in C, from raw bits to running processes.',
    kind: 'lecture'
  },
  {
    code: 'ENGR 210',
    title: 'Statics',
    description:
      'A foundational engineering lecture on force systems, moments, and free-body diagrams applied to trusses, beams, and frames.',
    kind: 'lecture'
  },
  {
    code: 'ENGR 280',
    title: 'Mobile Robotics Lab',
    description:
      'Teaches sensor integration, motor control, and embedded programming as teams build an autonomous robot to run an obstacle course.',
    kind: 'project'
  },
  {
    code: 'CS 330',
    title: 'Artificial Intelligence',
    description:
      'A technical lecture covering search, machine learning, and neural networks, with programming assignments that train and evaluate small models.',
    kind: 'lecture'
  },
  {
    code: 'EE 220',
    title: 'Circuit Analysis',
    description:
      "An introductory electrical engineering lecture covering resistive networks, Kirchhoff's laws, capacitors, inductors, and alternating current.",
    kind: 'lecture'
  },
  {
    code: 'ME 240',
    title: 'Thermodynamics',
    description:
      'Applies the laws of thermodynamics, entropy, and energy balances to engines, refrigeration cycles, and power plants.',
    kind: 'lecture'
  },
  {
    code: 'CS 370',
    title: 'Human-Computer Interaction',
    description:
      'Leads teams through user research, wireframing, and usability testing as they design and prototype a mobile app.',
    kind: 'project'
  },
  {
    code: 'ARCH 110',
    title: 'Architectural Design Studio I',
    description:
      'A foundational design studio exploring space, light, and structure through hand drafting, physical model-making, and small building projects.',
    kind: 'project'
  },
  {
    code: 'MATH 121',
    title: 'Calculus I',
    description:
      'Covers limits, derivatives, and introductory integration, with applications to rates of change, motion, and optimization.',
    kind: 'lecture'
  },
  {
    code: 'ENGR 230',
    title: 'Materials Science',
    description:
      'An engineering lecture on the structure, strength, and failure of metals, polymers, and ceramics, tested in the materials lab.',
    kind: 'lecture'
  },
  {
    code: 'MATH 220',
    title: 'Linear Algebra',
    description:
      'A computational lecture on vector spaces, matrices, determinants, and eigenvalues, with applications in computer graphics and data analysis.',
    kind: 'lecture'
  },
  {
    code: 'MATH 230',
    title: 'Discrete Mathematics',
    description:
      'Introduces propositional logic, set theory, combinatorics, and graph theory alongside rigorous proof-writing techniques.',
    kind: 'lecture'
  },
  {
    code: 'ME 260',
    title: 'Machine Shop and Fabrication',
    description:
      'Teaches lathe, mill, and welding fundamentals as students machine and assemble a working mechanical project.',
    kind: 'project'
  },
  {
    code: 'STAT 200',
    title: 'Introductory Statistics',
    description:
      'An introductory lecture covering descriptive statistics, probability, confidence intervals, and hypothesis testing on real-world data sets.',
    kind: 'lecture'
  },
  {
    code: 'DATA 250',
    title: 'Data Science Practicum',
    description:
      'Takes students through cleaning, analyzing, and visualizing a public data set, ending in a written report and a short presentation.',
    kind: 'project'
  },
  {
    code: 'ARCH 210',
    title: 'History of Architecture',
    description:
      'A visual survey tracing buildings from ancient temples to modern skyscrapers through structure, ornament, and urban form.',
    kind: 'lecture'
  },
  {
    code: 'NURS 210',
    title: 'Foundations of Nursing Practice',
    description:
      'A clinical foundations course covering patient assessment, vital signs, safety protocols, and therapeutic communication in the simulation lab.',
    kind: 'lecture'
  },
  {
    code: 'NURS 230',
    title: 'Pharmacology for Nursing',
    description:
      'Examines drug classifications, mechanisms of action, dosage calculations, and safe medication administration in nursing practice.',
    kind: 'lecture'
  },
  {
    code: 'MATH 122',
    title: 'Calculus II',
    description:
      'Extends single-variable calculus to integration techniques, sequences, and power series, applied to volumes, arc length, and probability.',
    kind: 'lecture'
  },
  {
    code: 'PUBH 101',
    title: 'Introduction to Public Health',
    description:
      'A global health survey examining epidemics, vaccination programs, sanitation, and health inequality at the population level.',
    kind: 'lecture'
  },
  {
    code: 'KIN 220',
    title: 'Exercise Physiology',
    description:
      'Analyzes cardiovascular, respiratory, and muscular responses to exercise, measured through lab testing on the students themselves.',
    kind: 'lecture'
  },
  {
    code: 'MATH 310',
    title: 'Probability Theory',
    description:
      'A theoretical lecture on random variables, distributions, expectation, and limit theorems, built on rigorous calculus foundations.',
    kind: 'lecture'
  },
  {
    code: 'NUTR 150',
    title: 'Human Nutrition',
    description:
      'A science-based lecture on macronutrients, vitamins, and minerals, their roles in human metabolism, and how to evaluate dietary research.',
    kind: 'lecture'
  },
  {
    code: 'COMM 110',
    title: 'Public Speaking',
    description:
      'Builds speech structure, vocal delivery, and stage presence through informative, persuasive, and impromptu speeches delivered to the class.',
    kind: 'project'
  },
  {
    code: 'NURS 310',
    title: 'Maternal and Child Health Nursing',
    description:
      'Examines prenatal care, labor and delivery, and pediatric development, practiced through simulation and clinical case studies.',
    kind: 'lecture'
  },
  {
    code: 'COMM 230',
    title: 'Interpersonal Communication',
    description:
      'A discussion-heavy lecture exploring active listening, conflict resolution, self-disclosure, and nonverbal cues in close relationships.',
    kind: 'lecture'
  },
  {
    code: 'JOUR 210',
    title: 'News Reporting and Writing',
    description:
      'Trains students in interviewing, fact-checking, and inverted-pyramid writing as they cover campus and city beats on deadline.',
    kind: 'project'
  },
  {
    code: 'KIN 150',
    title: 'Sport Psychology',
    description:
      'A performance-focused lecture exploring motivation, focus, and performance anxiety in athletes, with mental training techniques tested in practice.',
    kind: 'lecture'
  },
  {
    code: 'MDST 220',
    title: 'Media and Society',
    description:
      'A critical survey analyzing how television, advertising, news, and social media shape public belief and personal identity.',
    kind: 'lecture'
  },
  {
    code: 'EDUC 201',
    title: 'Foundations of Education',
    description:
      'Surveys the history, philosophy, and politics of public schooling, paired with weekly observations in a local classroom.',
    kind: 'lecture'
  },
  {
    code: 'COMM 250',
    title: 'Podcast Production',
    description:
      'Coaches students through scripting, interviewing, and audio editing as they produce and publish a six-episode podcast series.',
    kind: 'project'
  },
  {
    code: 'EDUC 310',
    title: 'Curriculum and Lesson Design',
    description:
      'A teaching practicum in which students write a full unit of lessons, from learning objectives to assessments, and deliver it to classmates.',
    kind: 'project'
  },
  {
    code: 'CRIM 101',
    title: 'Introduction to Criminology',
    description:
      'Examines theories of criminal behavior, methods of crime measurement, and the responses of police, courts, and prisons.',
    kind: 'lecture'
  },
  {
    code: 'LING 220',
    title: 'Sociolinguistics',
    description:
      'A survey lecture examining dialects, slang, and code-switching, and how language marks identity, class, and community.',
    kind: 'lecture'
  },
  {
    code: 'LING 101',
    title: 'Introduction to Linguistics',
    description:
      "An introductory lecture covering phonetics, morphology, syntax, and semantics, and how the world's languages vary and change over time.",
    kind: 'lecture'
  }
]

/** Electives taken out of pure personal interest, each the pick of one particular kind of student. */
const INTEREST_CLASSES: readonly CatalogEntry[] = [
  {
    code: 'AGRI 140',
    title: 'Urban Beekeeping and Apiary Management',
    description:
      'A hands-on apiary workshop covering hive inspections, swarm prevention, and honey extraction from a rooftop colony on campus.',
    kind: 'project'
  },
  {
    code: 'CULN 140',
    title: 'Chocolate and Confectionery',
    description:
      'A confectionery lab covering tempering, ganache, and molded bonbons, ending in a hand-boxed collection of original chocolates.',
    kind: 'project'
  },
  {
    code: 'GAME 210',
    title: 'The History of Video Games',
    description:
      "Traces the arcade cabinets, home consoles, and design philosophies that turned video games into the world's largest entertainment medium.",
    kind: 'lecture'
  },
  {
    code: 'HIST 185',
    title: 'A History of Cosmetics and Beauty',
    description:
      'Traces kohl, powder, and lipstick from ancient Egypt to the modern beauty counter, and the ideals of beauty each era sold.',
    kind: 'lecture'
  },
  {
    code: 'FOOD 130',
    title: 'Global Tea Culture and Cultivation',
    description:
      'A sensory lecture course exploring the cultivation, processing, and ceremonial traditions of green, white, oolong, black, and pu-erh teas.',
    kind: 'lecture'
  },
  {
    code: 'ASTR 170',
    title: 'Astrobiology and the Search for Life',
    description:
      'A speculative science lecture exploring the origins of life, extreme microbes, and the search for habitable worlds beyond Earth.',
    kind: 'lecture'
  },
  {
    code: 'LIT 250',
    title: 'Tarot, Symbolism, and Narrative',
    description:
      'Examines the seventy-eight tarot cards as a narrative system, from Renaissance card games to occult revival decks and the fiction they inspired.',
    kind: 'lecture'
  },
  {
    code: 'ART 185',
    title: 'Floral Design and Arrangement',
    description:
      'Teaches color harmony, floral mechanics, and seasonal sourcing as students build hand-tied bouquets, centerpieces, and a final installation.',
    kind: 'project'
  },
  {
    code: 'FOOD 220',
    title: 'Fermentation Science and Practice',
    description:
      'A teaching kitchen lab covering sourdough, kimchi, kombucha, and fresh cheese alongside the microbiology behind each ferment.',
    kind: 'project'
  },
  {
    code: 'MUSC 185',
    title: 'Musical Theatre Workshop',
    description:
      'A performance workshop covering belting, character songs, and stage movement, culminating in a cabaret of Broadway numbers.',
    kind: 'project'
  },
  {
    code: 'ASTR 160',
    title: 'Star Lore and Cultural Astronomy',
    description:
      'Explores constellation lore from Greek, Polynesian, and Chinese traditions, paired with evening stargazing sessions away from the city lights.',
    kind: 'lecture'
  },
  {
    code: 'TEXT 120',
    title: 'Knitting and Fiber Arts',
    description:
      'A fiber arts studio teaching cast-ons, cable patterns, and stranded colorwork, progressing from a first scarf to a fitted sweater.',
    kind: 'project'
  },
  {
    code: 'PSYC 180',
    title: 'The Science of Happiness',
    description:
      'Examines gratitude, flow, and social connection through positive psychology research, paired with weekly well-being experiments.',
    kind: 'lecture'
  },
  {
    code: 'HIST 270',
    title: 'Pirates and Privateers of the Golden Age',
    description:
      'Investigates Caribbean and Indian Ocean piracy, privateering commissions, and the maritime trials that turned outlaws into legends.',
    kind: 'lecture'
  },
  {
    code: 'FILM 270',
    title: 'Anime and Japanese Animation',
    description:
      'A genre-focused survey tracing Japanese animation from postwar studios to modern streaming, with attention to genre, style, and fandom.',
    kind: 'lecture'
  },
  {
    code: 'FILM 260',
    title: 'Horror Cinema and Cultural Fear',
    description:
      "A screening-based lecture course analyzing monsters, slashers, and haunted houses as reflections of each era's cultural anxieties.",
    kind: 'lecture'
  },
  {
    code: 'LIT 230',
    title: 'Fairy Tales and Folklore',
    description:
      'Analyzes Grimm, Perrault, and global folktales alongside their modern retellings, from Victorian picture books to animated films.',
    kind: 'lecture'
  },
  {
    code: 'BIO 180',
    title: 'Field Mycology and Lichen Identification',
    description:
      'Surveys fungal taxonomy, lichen symbiosis, and mushroom identification through guided field walks and spore-print microscopy.',
    kind: 'lecture'
  },
  {
    code: 'TEXT 140',
    title: 'Sewing and Garment Alteration',
    description:
      'A sewing studio teaching machine basics, hemming, and fitted alterations, ending with a garment tailored from a thrifted find.',
    kind: 'project'
  },
  {
    code: 'MUSC 175',
    title: 'Ukulele Ensemble and Folk Harmony',
    description:
      'An ensemble workshop building chord voicings, strumming patterns, and close vocal harmony toward a group concert at the end of term.',
    kind: 'project'
  },
  {
    code: 'GAME 230',
    title: 'Esports and Competitive Gaming',
    description:
      'Examines tournament structures, team strategy, and the business of streaming through case studies of major competitive titles.',
    kind: 'lecture'
  },
  {
    code: 'CHEM 120',
    title: 'Perfumery and Aromatic Chemistry',
    description:
      'Explores the aromatic molecules behind citrus, floral, musk, and amber notes as students formulate and bottle an original fragrance.',
    kind: 'project'
  },
  {
    code: 'GAME 150',
    title: 'Tabletop Game Design and Playtesting',
    description:
      'A design studio in which students prototype, playtest, and balance an original board or card game, from core mechanics to rulebook.',
    kind: 'project'
  },
  {
    code: 'HIST 160',
    title: 'Ancient Egypt: Pharaohs and the Afterlife',
    description:
      'An archaeology-minded survey exploring pyramids, mummification, and hieroglyphic texts across three thousand years of Egyptian civilization.',
    kind: 'lecture'
  },
  {
    code: 'PHIL 180',
    title: 'The Philosophy of Love',
    description:
      "Examines desire, devotion, and jealousy through Plato's Symposium, troubadour poetry, and contemporary philosophical accounts of romantic love.",
    kind: 'lecture'
  },
  {
    code: 'ENVS 160',
    title: 'Urban Gardening',
    description:
      'Teaches soil building, companion planting, and container gardening as students tend a raised-bed plot through a full growing cycle.',
    kind: 'project'
  },
  {
    code: 'HIST 175',
    title: 'Victorian Fashion and Social Codes',
    description:
      'A lecture course tracing corsetry, crinolines, and calling-card etiquette as expressions of nineteenth-century class and gender codes.',
    kind: 'lecture'
  },
  {
    code: 'PHIL 150',
    title: 'Stoicism and the Good Life',
    description:
      'A seminar reading Seneca, Epictetus, and Marcus Aurelius on adversity, discipline, and the art of living well.',
    kind: 'lecture'
  },
  {
    code: 'CULN 110',
    title: 'Pastry Arts Fundamentals',
    description:
      'Teaches laminated doughs, pâte à choux, custards, and tart construction in the teaching kitchen, judged on flavor and presentation.',
    kind: 'project'
  },
  {
    code: 'ART 195',
    title: 'Tattoo Art and Flash Design',
    description:
      'Explores bold linework, traditional flash motifs, and stencil design as students build a portfolio of original tattoo flash sheets.',
    kind: 'project'
  },
  {
    code: 'ENVS 140',
    title: 'Birding and Field Ornithology',
    description:
      'A field course training students to identify birds by plumage and song on dawn walks, logged in a term-long species journal.',
    kind: 'project'
  },
  {
    code: 'FSCI 130',
    title: 'Introduction to Forensic Science',
    description:
      'A case-file lecture covering fingerprinting, blood spatter analysis, and DNA evidence through reconstructed crime scene case studies.',
    kind: 'lecture'
  },
  {
    code: 'LIT 210',
    title: 'Detective Fiction and the Mystery Genre',
    description:
      'Traces the conventions of the mystery story from Poe and Conan Doyle through hard-boiled noir and the modern cozy.',
    kind: 'lecture'
  },
  {
    code: 'ART 175',
    title: 'Calligraphy and Hand Lettering',
    description:
      'A lettering studio covering italic and blackletter hands with the broad-edged pen and modern brush lettering, ending in a hand-bound book.',
    kind: 'project'
  },
  {
    code: 'LING 160',
    title: 'American Sign Language I',
    description:
      'Introduces fingerspelling, everyday signs, and the grammar of facial expression through conversation-based practice with Deaf instructors.',
    kind: 'lecture'
  },
  {
    code: 'RELS 220',
    title: 'Witchcraft and Magic in History',
    description:
      'Surveys cunning folk, early modern witch trials, and ceremonial magicians from the medieval world to the modern pagan revival.',
    kind: 'lecture'
  },
  {
    code: 'JOUR 150',
    title: 'Food Writing and Restaurant Criticism',
    description:
      'A writing workshop centered on restaurant reviews, recipe headnotes, and food memoir, with tasting trips to local kitchens.',
    kind: 'project'
  },
  {
    code: 'PSYC 160',
    title: 'The Psychology of Dreams',
    description:
      'A seminar-style lecture on sleep stages, nightmares, and lucid dreaming, weighing psychoanalytic and neuroscientific theories against a term-long dream journal.',
    kind: 'lecture'
  },
  {
    code: 'GAME 170',
    title: 'Escape Room Design',
    description:
      'Guides teams through puzzle design, narrative theming, and playtesting as they build a working escape room in a campus classroom.',
    kind: 'project'
  },
  {
    code: 'ART 160',
    title: 'Comics and Sequential Art',
    description:
      'Covers panel layout, visual pacing, character design, and inking as students carry a short comic from script to printed page.',
    kind: 'project'
  },
  {
    code: 'ARTH 230',
    title: 'Art Forgery and Famous Fakes',
    description:
      'A detective-style lecture examining notorious forgers, authentication science, and the art market scandals that fooled museums and collectors.',
    kind: 'lecture'
  },
  {
    code: 'GEOG 175',
    title: 'Hand-Drawn Cartography',
    description:
      'A cartography studio teaching projection, scale, hand lettering, and inked relief shading toward a finished map of a real or invented place.',
    kind: 'project'
  },
  {
    code: 'MUSC 195',
    title: 'The History of Hip-Hop',
    description:
      'Traces hip-hop from Bronx block parties through its golden age to global streaming, examining sampling, lyricism, and DJ culture.',
    kind: 'lecture'
  },
  {
    code: 'LING 180',
    title: 'Constructed Languages and Conlanging',
    description:
      'Analyzes the phonology, grammar, and writing systems of invented languages, from Esperanto to the tongues of fantasy epics.',
    kind: 'lecture'
  }
]

/** Every class pool, by pool. */
export const CLASS_POOLS: Record<ClassPoolId, readonly CatalogEntry[]> = {
  pe: PE_CLASSES,
  humanities: HUMANITIES_CLASSES,
  arts: ARTS_CLASSES,
  misc: MISC_CLASSES,
  interest: INTEREST_CLASSES
}
