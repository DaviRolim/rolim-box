/**
 * Seed a LOCAL SQLite database with realistic fake data for development,
 * screenshots and e2e tests.
 *
 *   bun run db:seed            # wipe + reseed; uses DATABASE_URL from .env (must be file:...)
 *   bun run db:setup           # create/update the tables first, then seed
 *
 * Safety: this script wipes every table before inserting, so it refuses to run
 * against anything that is not a local `file:` database.
 *
 * Everything is relative to "today" (local time) so the app always has a WoD
 * for today, a few planned ones, and a few weeks of history.
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { hash } from '@node-rs/argon2';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as schema from '../src/lib/server/db/schema';
import { EXERCISE_SEEDS, exerciseSortOrder } from '../src/lib/server/db/exercise-list';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is not set. Copy .env.example to .env and use file:local.db');
	process.exit(1);
}
if (!url.startsWith('file:')) {
	console.error(
		`Refusing to seed "${url.split('?')[0]}": the seed script wipes all data and only runs against a local file: database.`
	);
	process.exit(1);
}

// `--push` creates/updates the tables first. It runs here, after the guard above, because
// `drizzle-kit push --force` applies destructive schema changes without asking.
if (process.argv.includes('--push')) {
	const push = spawnSync('bunx', ['drizzle-kit', 'push', '--force'], {
		stdio: ['ignore', 'ignore', 'inherit'],
		env: { ...process.env, DATABASE_URL: url }
	});
	if (push.status !== 0) {
		console.error('drizzle-kit push failed');
		process.exit(push.status ?? 1);
	}
}

const client = createClient({ url });
const db = drizzle(client, { schema });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic 32-char hex id, so URLs are stable between seeds. */
function id(label: string): string {
	return createHash('sha256').update(`rolimbox-seed:${label}`).digest('hex').slice(0, 32);
}

function isoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
	const copy = new Date(d);
	copy.setDate(copy.getDate() + days);
	return copy;
}

const today = new Date();
today.setHours(12, 0, 0, 0);

const timer = {
	amrap: (minutes: number) => JSON.stringify({ type: 'amrap', duration: minutes * 60 }),
	fortime: (capMinutes: number) => JSON.stringify({ type: 'fortime', duration: capMinutes * 60 }),
	emom: (rounds: number, intervalWork = 60) =>
		JSON.stringify({ type: 'emom', rounds, intervalWork }),
	tabata: (rounds = 8, intervalWork = 20, intervalRest = 10) =>
		JSON.stringify({ type: 'tabata', rounds, intervalWork, intervalRest })
};

type SectionSeed = {
	type: 'warmup' | 'skill' | 'wod' | 'cooldown' | 'stretches' | 'custom';
	name: string;
	content: string;
	timerConfig?: string;
};

type WodSeed = {
	key: string;
	description: string;
	sections: SectionSeed[];
};

// ---------------------------------------------------------------------------
// WoD library (loads in kg, the way the box writes them)
// ---------------------------------------------------------------------------

const WODS: Record<string, WodSeed> = {
	fran: {
		key: 'fran',
		description:
			'Benchmark day. Fran is short and it hurts. Pick a load that keeps the thrusters fast and try to go unbroken on the 21s.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content:
					'2 rounds:\n200m run\n10 PVC pass-throughs\n10 air squats\n5 strict pull-ups or ring rows\n5 empty-bar thrusters'
			},
			{
				type: 'skill',
				name: 'Thruster build-up',
				content:
					'Every minute for 8 min:\n3 thrusters\n\nBuild from the empty bar to your Fran weight.',
				timerConfig: timer.emom(8)
			},
			{
				type: 'wod',
				name: 'Fran',
				content: '21-15-9 for time:\nThrusters (43/30 kg)\nPull-ups\n\nTime cap: 10 min',
				timerConfig: timer.fortime(10)
			},
			{
				type: 'cooldown',
				name: 'Cool-down',
				content: '400m easy walk\n2 min couch stretch per side\n2 min dead hang, accumulated'
			}
		]
	},
	cindy: {
		key: 'cindy',
		description:
			'Squat strength, then 20 minutes of Cindy. Find a pace you can hold from minute 1 to minute 20.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content:
					'3 rounds:\n10 air squats\n8 push-ups\n6 ring rows\n30s plank\n\nThen 2 warm-up sets of back squat'
			},
			{
				type: 'skill',
				name: 'Back squat',
				content: '5 x 5 @ 75%\nRest 2 min between sets\n\nSame load across all five sets.'
			},
			{
				type: 'wod',
				name: 'Cindy',
				content: '20 min AMRAP:\n5 pull-ups\n10 push-ups\n15 air squats',
				timerConfig: timer.amrap(20)
			},
			{
				type: 'stretches',
				name: 'Stretches',
				content: '90s pigeon per side\n90s lat stretch on the rig per side\n2 min child pose'
			}
		]
	},
	helen: {
		key: 'helen',
		description: 'Helen. Run hard, swing unbroken, hang on to the pull-ups.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content:
					'400m easy run\nThen 2 rounds:\n10 Russian KB swings\n10 scap pull-ups\n10 walking lunges'
			},
			{
				type: 'skill',
				name: 'Kipping practice',
				content:
					'10 min of practice:\n5 kip swings\n3 kipping pull-ups or jumping pull-ups\nRest as needed'
			},
			{
				type: 'wod',
				name: 'Helen',
				content:
					'3 rounds for time:\n400m run\n21 kettlebell swings (24/16 kg)\n12 pull-ups\n\nTime cap: 15 min',
				timerConfig: timer.fortime(15)
			},
			{
				type: 'cooldown',
				name: 'Cool-down',
				content: '5 min easy walk\nCalf stretch on the wall, 1 min per side'
			}
		]
	},
	grace: {
		key: 'grace',
		description: 'Barbell cycling. Technique first in the EMOM, then Grace as fast singles.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content:
					'With an empty bar, 2 rounds:\n5 deadlifts\n5 hang power cleans\n5 front squats\n5 push jerks'
			},
			{
				type: 'skill',
				name: 'Clean & jerk',
				content:
					'Every minute for 10 min:\n2 clean & jerks\n\nBuild to a heavy double with clean reps.',
				timerConfig: timer.emom(10)
			},
			{
				type: 'wod',
				name: 'Grace',
				content: 'For time:\n30 clean & jerks (61/43 kg)\n\nTime cap: 8 min',
				timerConfig: timer.fortime(8)
			},
			{
				type: 'stretches',
				name: 'Stretches',
				content: 'Front rack stretch on the bar, 1 min per side\nForearm stretch, 1 min per side'
			}
		]
	},
	tabata: {
		key: 'tabata',
		description: 'Tabata day. 20 seconds on, 10 off. Count your lowest round on each movement.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content: '3 min skipping rope\nThen 2 rounds:\n10 air squats\n10 sit-ups\n5 burpees'
			},
			{
				type: 'wod',
				name: 'Tabata squats',
				content: '8 rounds, 20s work / 10s rest:\nAir squats\n\nScore = lowest round',
				timerConfig: timer.tabata()
			},
			{
				type: 'wod',
				name: 'Tabata push-ups',
				content: '8 rounds, 20s work / 10s rest:\nPush-ups\n\nScore = lowest round',
				timerConfig: timer.tabata()
			},
			{
				type: 'wod',
				name: 'Tabata burpees',
				content: '8 rounds, 20s work / 10s rest:\nBurpees\n\nScore = lowest round',
				timerConfig: timer.tabata()
			},
			{
				type: 'cooldown',
				name: 'Cool-down',
				content: 'Walk until you can talk again\n2 min couch stretch per side'
			}
		]
	},
	longEmom: {
		key: 'longEmom',
		description:
			'Engine work. 24 minutes, always moving. Pick numbers that leave 15 seconds of rest.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content:
					'2 min easy row\nThen 2 rounds:\n10 hollow rocks\n5 box step-ups per leg\n5 inchworms'
			},
			{
				type: 'wod',
				name: 'EMOM 24',
				content:
					'Every minute for 24 min, rotating:\nMin 1: 15/12 cal row\nMin 2: 12 toes-to-bar\nMin 3: 10 box jump overs (60/50 cm)\nMin 4: rest',
				timerConfig: timer.emom(24)
			},
			{
				type: 'cooldown',
				name: 'Cool-down',
				content: '3 min easy bike or walk\n1 min dead hang'
			}
		]
	},
	deadlift: {
		key: 'deadlift',
		description: 'Heavy pulls, then a sprint. Keep your back flat when the burpees make you tired.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content:
					'2 rounds:\n10 good mornings with PVC\n10 glute bridges\n5 light deadlifts\n5 burpees'
			},
			{
				type: 'skill',
				name: 'Deadlift',
				content: '5-5-3-3-1-1\nRest 2 to 3 min between sets\n\nBuild to a heavy single, not a max.'
			},
			{
				type: 'wod',
				name: 'Deadlift / burpee',
				content:
					'21-15-9 for time:\nDeadlifts (100/70 kg)\nBurpees over the bar\n\nTime cap: 12 min',
				timerConfig: timer.fortime(12)
			},
			{
				type: 'stretches',
				name: 'Stretches',
				content: '2 min forward fold\n90s pigeon per side\n1 min cobra'
			}
		]
	},
	snatch: {
		key: 'snatch',
		description: 'Snatch technique under a clock, then a 12 minute triplet.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content:
					'With PVC, 2 rounds:\n5 snatch grip deadlifts\n5 hang muscle snatches\n5 overhead squats\n5 snatch balances'
			},
			{
				type: 'skill',
				name: 'Power snatch',
				content:
					'Every 90s for 8 rounds:\n2 power snatches\n\nSame weight if the bar path is clean, otherwise go lighter.',
				timerConfig: timer.emom(8, 90)
			},
			{
				type: 'wod',
				name: 'AMRAP 12',
				content:
					'12 min AMRAP:\n6 power snatches (43/30 kg)\n9 toes-to-bar\n12 wall balls (9/6 kg)',
				timerConfig: timer.amrap(12)
			},
			{
				type: 'cooldown',
				name: 'Cool-down',
				content: '2 min easy row\nThoracic opener on the foam roller, 2 min'
			}
		]
	},
	partner: {
		key: 'partner',
		description: 'Saturday in pairs. One works, one rests. Split the reps however you like.',
		sections: [
			{
				type: 'warmup',
				name: 'Partner warm-up',
				content:
					'In pairs, 2 rounds:\n200m run together\n10 wall ball passes\n10 air squats holding hands'
			},
			{
				type: 'wod',
				name: 'Partner AMRAP 30',
				content:
					'30 min AMRAP, in pairs:\n800m run together\n60 wall balls (9/6 kg)\n40 kettlebell swings (24/16 kg)\n20 synchro burpees',
				timerConfig: timer.amrap(30)
			},
			{
				type: 'cooldown',
				name: 'Cool-down',
				content: 'Partner hamstring stretch, 1 min per side\nCoffee and cake at the house'
			}
		]
	},
	chipper: {
		key: 'chipper',
		description: 'Chipper. One pass through everything. Break early and keep breathing.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content:
					'2 min skipping rope\nThen 2 rounds:\n10 air squats\n5 toes-to-bar or knee raises\n5 box step-ups'
			},
			{
				type: 'wod',
				name: 'Chipper',
				content:
					'For time:\n50 double-unders\n40 wall balls (9/6 kg)\n30 toes-to-bar\n20 box jumps (60/50 cm)\n10 clean & jerks (61/43 kg)\n20 box jumps\n30 toes-to-bar\n40 wall balls\n50 double-unders\n\nTime cap: 25 min',
				timerConfig: timer.fortime(25)
			},
			{
				type: 'stretches',
				name: 'Stretches',
				content: '2 min couch stretch per side\n2 min child pose'
			}
		]
	},
	gymnastics: {
		key: 'gymnastics',
		description: 'Gymnastics day. Quality over quantity. Stop each set one rep before failure.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content:
					'2 rounds:\n20s hollow hold\n20s arch hold\n10 scap push-ups\n5 wall walks (partial)'
			},
			{
				type: 'skill',
				name: 'Handstand practice',
				content:
					'12 min of practice:\n30s wall-facing handstand hold\n5 shoulder taps per side\nRest 1 min'
			},
			{
				type: 'wod',
				name: 'EMOM 16',
				content:
					'Every minute for 16 min, alternating:\nOdd: 6 strict handstand push-ups or 10 pike push-ups\nEven: 12 alternating pistols or 16 lunges',
				timerConfig: timer.emom(16)
			},
			{
				type: 'stretches',
				name: 'Stretches',
				content: 'Wrist stretches, 2 min\nPuppy pose, 2 min'
			}
		]
	},
	intervals: {
		key: 'intervals',
		description:
			'Intervals. 3 minutes on, 1 minute off. Each round is a sprint. Use the wall clock.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content: '400m easy run\nThen 2 rounds:\n10 lunges\n5 burpees\n5 light snatches'
			},
			{
				type: 'wod',
				name: 'Intervals',
				content:
					'5 rounds, 3 min on / 1 min off:\n15 burpees\n10 lunges per leg\nMax power snatches (35/25 kg) in the remaining time\n\nScore = total snatches'
			},
			{
				type: 'cooldown',
				name: 'Cool-down',
				content: '5 min walk\nShoulder stretch on the rig, 1 min per side'
			}
		]
	},
	halfMurph: {
		key: 'halfMurph',
		description:
			'Half Murph. Partition the middle any way you want. Vest only if you have done it before.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content: '400m easy run\nThen 2 rounds:\n5 ring rows\n10 push-ups\n15 air squats'
			},
			{
				type: 'wod',
				name: 'Half Murph',
				content:
					'For time:\n800m run\n50 pull-ups\n100 push-ups\n150 air squats\n800m run\n\nTime cap: 30 min',
				timerConfig: timer.fortime(30)
			},
			{
				type: 'cooldown',
				name: 'Cool-down',
				content: 'Lie down. Then 5 min walk and plenty of water.'
			}
		]
	},
	jackie: {
		key: 'jackie',
		description: 'Jackie. Row at a pace that lets you start the thrusters right away.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content: '3 min easy row\nThen 2 rounds:\n10 empty-bar thrusters\n5 pull-ups or ring rows'
			},
			{
				type: 'wod',
				name: 'Jackie',
				content: 'For time:\n1000m row\n50 thrusters (20/15 kg)\n30 pull-ups\n\nTime cap: 12 min',
				timerConfig: timer.fortime(12)
			},
			{
				type: 'custom',
				name: 'Accessory',
				content:
					'3 rounds, not for time:\n12 single-arm DB rows per side\n15 hollow rocks\n30s side plank per side'
			},
			{
				type: 'stretches',
				name: 'Stretches',
				content: 'Lat stretch on the rig, 1 min per side\n2 min couch stretch per side'
			}
		]
	},
	karen: {
		key: 'karen',
		description:
			'Front squats first, then Karen. 150 wall balls. Decide your sets before you start.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content:
					'2 rounds:\n10 air squats\n10 wall balls (light)\n5 front squats with the empty bar'
			},
			{
				type: 'skill',
				name: 'Front squat',
				content: '4 x 4 @ 80%\nRest 2 min between sets'
			},
			{
				type: 'wod',
				name: 'Karen',
				content: 'For time:\n150 wall balls (9/6 kg)\n\nTime cap: 12 min',
				timerConfig: timer.fortime(12)
			},
			{
				type: 'cooldown',
				name: 'Cool-down',
				content: '3 min easy bike\nQuad smash on the foam roller, 2 min per side'
			}
		]
	},
	dt: {
		key: 'dt',
		description:
			'DT. The bar should not rest on the floor between the three movements. Grip is the limiter.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content: 'With an empty bar, 3 rounds:\n6 deadlifts\n5 hang power cleans\n4 push jerks'
			},
			{
				type: 'wod',
				name: 'DT',
				content:
					'5 rounds for time:\n12 deadlifts\n9 hang power cleans\n6 push jerks\n(70/47 kg)\n\nTime cap: 15 min',
				timerConfig: timer.fortime(15)
			},
			{
				type: 'stretches',
				name: 'Stretches',
				content: 'Forearm stretch, 1 min per side\n2 min forward fold\n1 min dead hang'
			}
		]
	},
	recovery: {
		key: 'recovery',
		description: 'Active recovery. Move, breathe, leave feeling better than when you arrived.',
		sections: [
			{
				type: 'custom',
				name: 'Easy flow',
				content:
					'20 min at conversation pace:\n400m walk or easy jog\n10 air squats\n10 ring rows\n30s plank'
			},
			{
				type: 'stretches',
				name: 'Mobility',
				content:
					'2 min couch stretch per side\n2 min pigeon per side\n2 min thoracic opener\n2 min ankle stretch per side'
			}
		]
	},
	openCouplet: {
		key: 'openCouplet',
		description: 'Open-style ladder. Seven minutes, as far as you can get.',
		sections: [
			{
				type: 'warmup',
				name: 'Warm-up',
				content: '2 rounds:\n5 empty-bar thrusters\n5 kip swings\n10 air squats\n200m run'
			},
			{
				type: 'skill',
				name: 'Chest-to-bar',
				content:
					'Every minute for 6 min:\n3 to 5 chest-to-bar pull-ups\n\nScale: banded or jumping.',
				timerConfig: timer.emom(6)
			},
			{
				type: 'wod',
				name: 'AMRAP 7',
				content:
					'7 min AMRAP:\n3 thrusters (43/30 kg)\n3 chest-to-bar pull-ups\n6 thrusters\n6 chest-to-bar pull-ups\n9 thrusters\n9 chest-to-bar pull-ups\n...keep adding 3',
				timerConfig: timer.amrap(7)
			},
			{
				type: 'cooldown',
				name: 'Cool-down',
				content: '400m walk\nLat stretch on the rig, 1 min per side'
			}
		]
	}
};

/**
 * Programming calendar, as day offsets from today.
 * History goes back a little over four weeks; two sessions are planned ahead.
 * Sundays are rest days and one weekday is skipped (a holiday) so the list has gaps.
 */
function buildCalendar(): { date: string; wod: WodSeed }[] {
	const rotation: WodSeed[] = [
		WODS.cindy,
		WODS.snatch,
		WODS.longEmom,
		WODS.deadlift,
		WODS.helen,
		WODS.partner,
		WODS.karen,
		WODS.gymnastics,
		WODS.tabata,
		WODS.grace,
		WODS.jackie,
		WODS.chipper,
		WODS.dt,
		WODS.openCouplet,
		WODS.recovery,
		WODS.intervals,
		WODS.halfMurph
	];

	const calendar: { date: string; wod: WodSeed }[] = [];
	const todayIso = isoDate(today);

	// Pinned days around today.
	const pinned = new Map<string, WodSeed>([
		[todayIso, WODS.fran],
		[isoDate(addDays(today, -1)), WODS.deadlift],
		[isoDate(addDays(today, 1)), WODS.longEmom],
		[isoDate(addDays(today, 2)), WODS.snatch]
	]);

	const holiday = isoDate(addDays(today, -8));
	let cursor = 0;

	for (let offset = -31; offset <= 2; offset++) {
		const day = addDays(today, offset);
		const iso = isoDate(day);
		const pinnedWod = pinned.get(iso);
		if (pinnedWod) {
			calendar.push({ date: iso, wod: pinnedWod });
			continue;
		}
		if (day.getDay() === 0) continue; // Sunday: rest day
		if (iso === holiday) continue;
		if (offset > 0) continue;

		// Saturdays are always partner or long sessions.
		if (day.getDay() === 6) {
			const saturdayPick = [WODS.partner, WODS.halfMurph, WODS.chipper, WODS.partner];
			calendar.push({ date: iso, wod: saturdayPick[Math.abs(offset) % saturdayPick.length] });
			continue;
		}

		calendar.push({ date: iso, wod: rotation[cursor % rotation.length] });
		cursor++;
	}

	return calendar;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const SEED_PASSWORD = 'rolimbox123';

const PEOPLE = [
	{ key: 'davi', email: 'davi@rolimbox.test', role: 'owner' },
	{ key: 'danilo', email: 'danilo@rolimbox.test', role: 'coach' },
	{ key: 'bia', email: 'bia@rolimbox.test', role: 'member' },
	{ key: 'rafa', email: 'rafa@rolimbox.test', role: 'member' },
	{ key: 'juliana', email: 'juliana@rolimbox.test', role: 'member' },
	{ key: 'pedro', email: 'pedro@rolimbox.test', role: 'member' },
	{ key: 'carol', email: 'carol@rolimbox.test', role: 'member' },
	{ key: 'thiago', email: 'thiago@rolimbox.test', role: 'member' },
	{ key: 'marina', email: 'marina@rolimbox.test', role: 'member' },
	{ key: 'lucas', email: 'lucas@rolimbox.test', role: 'member' }
] as const;

type PersonKey = (typeof PEOPLE)[number]['key'];

/** PR values in display units (kg, m:ss, reps); converted to base units below. */
const PRS: Record<string, Partial<Record<PersonKey, number | string>>> = {
	'Back Squat': {
		davi: 150,
		danilo: 162.5,
		bia: 85,
		rafa: 130,
		juliana: 77.5,
		pedro: 140,
		carol: 92.5,
		thiago: 120
	},
	'Front Squat': { davi: 125, danilo: 135, bia: 70, rafa: 110, pedro: 117.5 },
	Deadlift: {
		davi: 190,
		danilo: 205,
		bia: 115,
		rafa: 170,
		juliana: 105,
		pedro: 180,
		carol: 120,
		marina: 95
	},
	'Clean & Jerk': { davi: 107.5, danilo: 112.5, bia: 60, rafa: 92.5, pedro: 100, carol: 62.5 },
	Snatch: { davi: 82.5, danilo: 85, bia: 45, rafa: 70, carol: 47.5 },
	'Strict Press': { davi: 70, danilo: 75, bia: 37.5, pedro: 65, lucas: 55 },
	Thruster: { davi: 95, danilo: 100, rafa: 85, juliana: 50 },
	Fran: {
		davi: '3:42',
		danilo: '3:58',
		bia: '5:31',
		rafa: '4:47',
		juliana: '6:12',
		pedro: '4:20',
		carol: '5:05'
	},
	Grace: { davi: '2:51', danilo: '2:39', rafa: '3:48', pedro: '3:15', carol: '4:40' },
	Helen: { davi: '8:55', danilo: '9:20', bia: '10:48', juliana: '11:30', thiago: '10:02' },
	Jackie: { davi: '7:14', bia: '8:50', rafa: '7:58', marina: '9:41' },
	'Cindy - 20 min': { davi: 21, danilo: 19, bia: 17, rafa: 18, juliana: 14, pedro: 20, lucas: 15 },
	'Max Pull-ups': { davi: 32, danilo: 28, bia: 14, rafa: 24, pedro: 26, carol: 11, thiago: 18 },
	'Max Double-unders': { davi: 120, danilo: 86, bia: 142, juliana: 60, marina: 75 },
	'Max Toes-to-Bar': { davi: 25, bia: 16, rafa: 20, carol: 13 },
	'400m Run': {
		davi: '1:12',
		danilo: '1:16',
		bia: '1:28',
		rafa: '1:15',
		pedro: '1:10',
		lucas: '1:19'
	},
	'1 Mile Run': { davi: '6:05', bia: '7:20', juliana: '7:48', thiago: '6:41' },
	'2K Row': { davi: '7:02', danilo: '6:48', rafa: '7:15', carol: '8:21' }
};

function toSeconds(mmss: string): number {
	const [m, s] = mmss.split(':').map(Number);
	return m * 60 + s;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
	console.log(`Seeding ${url} ...`);

	// Wipe (children first).
	await db.delete(schema.personalRecord);
	await db.delete(schema.section);
	await db.delete(schema.wod);
	await db.delete(schema.workspaceInvite);
	await db.delete(schema.workspaceMember);
	await db.delete(schema.session);
	await db.delete(schema.exercise);
	await db.delete(schema.workspace);
	await db.delete(schema.user);

	const passwordHash = await hash(SEED_PASSWORD, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});

	// Users
	const joinedBase = addDays(today, -200);
	await db.insert(schema.user).values([
		...PEOPLE.map((p, i) => ({
			id: id(`user:${p.key}`),
			email: p.email,
			passwordHash,
			createdAt: addDays(joinedBase, i * 9),
			unitPreference: 'metric'
		})),
		// An account that has not joined any box yet (for the "no workspace" screen).
		{
			id: id('user:novato'),
			email: 'novato@rolimbox.test',
			passwordHash,
			createdAt: addDays(today, -1),
			unitPreference: 'metric'
		}
	]);

	// Workspaces: the box, plus an empty one so empty states are reachable.
	const boxId = id('workspace:rolimbox');
	const kidsId = id('workspace:kids');
	await db.insert(schema.workspace).values([
		{ id: boxId, name: 'RolimBox', createdAt: joinedBase },
		{ id: kidsId, name: 'RolimBox Kids', createdAt: addDays(today, -3) }
	]);

	await db.insert(schema.workspaceMember).values([
		...PEOPLE.map((p, i) => ({
			userId: id(`user:${p.key}`),
			workspaceId: boxId,
			role: p.role,
			joinedAt: addDays(joinedBase, i * 9)
		})),
		{
			userId: id('user:davi'),
			workspaceId: kidsId,
			role: 'owner',
			joinedAt: addDays(today, -3)
		}
	]);

	// Invites: one valid for athletes, one valid for coaches, one expired.
	await db.insert(schema.workspaceInvite).values([
		{
			id: id('invite:member'),
			code: 'RLM-B2X',
			workspaceId: boxId,
			role: 'member',
			createdBy: id('user:davi'),
			createdAt: addDays(today, -1),
			expiresAt: addDays(today, 6)
		},
		{
			id: id('invite:coach'),
			code: 'CCH-7KP',
			workspaceId: boxId,
			role: 'coach',
			createdBy: id('user:davi'),
			createdAt: addDays(today, -2),
			expiresAt: addDays(today, 5)
		},
		{
			id: id('invite:expired'),
			code: 'EXP-222',
			workspaceId: boxId,
			role: 'member',
			createdBy: id('user:davi'),
			createdAt: addDays(today, -20),
			expiresAt: addDays(today, -13)
		}
	]);

	// Exercises
	const exerciseRows = EXERCISE_SEEDS.map((ex, index) => ({
		id: id(`exercise:${ex.name}`),
		name: ex.name,
		category: ex.category,
		measurementType: ex.measurementType,
		sortOrder: exerciseSortOrder(ex, index)
	}));
	await db.insert(schema.exercise).values(exerciseRows);

	// WoDs + sections
	const calendar = buildCalendar();
	const wodRows: (typeof schema.wod.$inferInsert)[] = [];
	const sectionRows: (typeof schema.section.$inferInsert)[] = [];
	for (const entry of calendar) {
		const wodId = id(`wod:${entry.date}`);
		const [y, m, d] = entry.date.split('-').map(Number);
		// Written the evening before, like a real coach would.
		const written = new Date(y, m - 1, d - 1, 20, 30, 0);
		wodRows.push({
			id: wodId,
			workspaceId: boxId,
			date: entry.date,
			description: entry.wod.description,
			createdAt: written,
			updatedAt: written
		});
		entry.wod.sections.forEach((s, order) => {
			sectionRows.push({
				id: id(`section:${entry.date}:${order}`),
				wodId,
				type: s.type,
				name: s.name,
				content: s.content,
				order,
				timerConfig: s.timerConfig ?? null
			});
		});
	}
	await db.insert(schema.wod).values(wodRows);
	for (let i = 0; i < sectionRows.length; i += 50) {
		await db.insert(schema.section).values(sectionRows.slice(i, i + 50));
	}

	// Personal records
	const prRows: (typeof schema.personalRecord.$inferInsert)[] = [];
	let prIndex = 0;
	for (const [exerciseName, byPerson] of Object.entries(PRS)) {
		const ex = EXERCISE_SEEDS.find((e) => e.name === exerciseName);
		if (!ex) throw new Error(`Unknown exercise in PR seed: ${exerciseName}`);
		for (const [personKey, raw] of Object.entries(byPerson)) {
			let value: number;
			if (ex.measurementType === 'weight') value = Math.round(Number(raw) * 1000);
			else if (ex.measurementType === 'time') value = toSeconds(String(raw));
			else value = Number(raw);

			const when = addDays(today, -(5 + ((prIndex * 7) % 120)));
			prRows.push({
				id: id(`pr:${exerciseName}:${personKey}`),
				userId: id(`user:${personKey}`),
				exerciseId: id(`exercise:${exerciseName}`),
				value,
				note: null,
				date: isoDate(when),
				createdAt: when,
				updatedAt: when
			});
			prIndex++;
		}
	}
	for (let i = 0; i < prRows.length; i += 50) {
		await db.insert(schema.personalRecord).values(prRows.slice(i, i + 50));
	}

	console.log(
		[
			`  users:      ${PEOPLE.length + 1}  (password for all: ${SEED_PASSWORD})`,
			`  workspaces: 2  (RolimBox, RolimBox Kids [empty])`,
			`  wods:       ${wodRows.length}  (${calendar[0].date} → ${calendar[calendar.length - 1].date}, today = ${isoDate(today)})`,
			`  sections:   ${sectionRows.length}`,
			`  exercises:  ${exerciseRows.length}`,
			`  prs:        ${prRows.length}`,
			`  invites:    RLM-B2X (member), CCH-7KP (coach), EXP-222 (expired)`,
			'',
			'  Coach login:   davi@rolimbox.test',
			'  Athlete login: bia@rolimbox.test'
		].join('\n')
	);
}

main()
	.then(() => {
		client.close();
	})
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
