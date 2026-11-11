// src/lib/services/voice-player.ts
//
// Voice cues play through media elements (<audio>), not the Web Audio graph, so the phone lowers
// the music from other apps while a cue speaks:
//
//  - Android Chrome asks the system for audio focus only for media elements. A short, audible
//    element (under ~5 s, which every cue is) takes "transient, may duck" focus, so Spotify dips
//    and comes back. Web Audio takes no focus at all and just mixes on top.
//  - iOS / Safari follows the Audio Session API (see configureAudioSession below).
//
// The beeps stay synthesized on Web Audio (audio.svelte.ts); this module only knows about voices.
// It has no Svelte and no globals so the unit tests can drive it with fake elements.

/** The part of HTMLAudioElement this player uses (lets tests pass a fake). */
export interface VoiceElement {
	src: string;
	preload: string;
	muted: boolean;
	currentTime: number;
	readonly paused: boolean;
	play(): Promise<void>;
	pause(): void;
	load(): void;
}

export interface VoicePlayerOptions {
	createElement: () => VoiceElement;
}

export class VoicePlayer<Cue extends string = string> {
	// Plain caches: nothing renders from them (plain .ts, so no Svelte reactivity rule here).
	private readonly elements = new Map<Cue, VoiceElement>();
	private readonly unlocked = new Set<Cue>();
	private readonly createElement: () => VoiceElement;

	constructor(options: VoicePlayerOptions) {
		this.createElement = options.createElement;
	}

	/** The element for a cue, created on first use. Synchronous, so it can run inside a tap. */
	element(cue: Cue): VoiceElement {
		let el = this.elements.get(cue);
		if (!el) {
			el = this.createElement();
			el.preload = 'auto';
			this.elements.set(cue, el);
		}
		return el;
	}

	/** Point a cue at its audio (a blob: URL of the already-fetched file) and start buffering. */
	setSource(cue: Cue, src: string): void {
		const el = this.element(cue);
		if (el.src === src) return;
		el.src = src;
		el.load();
	}

	hasSource(cue: Cue): boolean {
		return Boolean(this.elements.get(cue)?.src);
	}

	/**
	 * iOS only lets a media element start sound after it was played from a tap. Called from the
	 * tap handler: each element plays muted, is paused at once and rewound. play() must be called
	 * synchronously here (not after an await) or the tap no longer counts.
	 */
	unlock(cues: readonly Cue[]): void {
		for (const cue of cues) {
			if (this.unlocked.has(cue)) continue;
			const el = this.element(cue);
			// Without a source play() rejects, and WebKit keeps the element locked; try on the next tap.
			if (!el.src) continue;
			this.unlocked.add(cue);
			el.muted = true;
			let attempt: Promise<void>;
			try {
				attempt = el.play();
			} catch {
				attempt = Promise.reject(new Error('play() threw'));
			}
			attempt
				.then(() => {
					// A real cue started meanwhile (play() unmutes): leave it speaking.
					if (!el.muted) return;
					el.pause();
					el.currentTime = 0;
					el.muted = false;
				})
				.catch(() => {
					this.unlocked.delete(cue);
					el.muted = false;
				});
		}
	}

	isUnlocked(cues: readonly Cue[]): boolean {
		return cues.every((cue) => this.unlocked.has(cue));
	}

	/**
	 * Play a cue from the start. Resolves once playback has begun; rejects when the browser
	 * refused (not unlocked, no source), so the caller can fall back to Web Audio.
	 */
	async play(cue: Cue): Promise<void> {
		const el = this.elements.get(cue);
		if (!el?.src) throw new Error(`Voice cue not loaded: ${cue}`);
		el.muted = false;
		if (!el.paused) el.pause();
		el.currentTime = 0;
		await el.play();
	}

	/** Silence every cue now (mute pressed mid-cue). */
	stopAll(): void {
		for (const el of this.elements.values()) {
			if (!el.paused) el.pause();
			el.currentTime = 0;
		}
	}
}

// ============================================================================
// Audio Session API (Safari 16.4+, iOS 16.4+)
// ============================================================================

/**
 * Audio Session API type for the whole page. W3C Audio Session draft, section 3.1:
 *  - 'playback'       "should not mix with other playback audio" (would stop Spotify) - no.
 *  - 'transient-solo' "should pause/mute all other audio and play exclusively" - no.
 *  - 'ambient'        mixes, but never lowers the music, so the cue drowns - no.
 *  - 'transient'      "usually should play on top of playback audio" and may "duck" it - yes:
 *                     a short notification-like sound over the user's music.
 * It is set once, not toggled around each cue: the session covers every AudioContext and media
 * element of the window (section 6), the page only ever plays short cues, and changing the type
 * re-runs the session update algorithm, which can glitch audio mid-workout.
 */
export const AUDIO_SESSION_TYPE = 'transient';

interface AudioSessionLike {
	type: string;
}

/** Returns true when the type was applied; a no-op where the API does not exist. */
export function configureAudioSession(nav: unknown): boolean {
	const session = (nav as { audioSession?: AudioSessionLike } | undefined)?.audioSession;
	if (!session || typeof session !== 'object' || !('type' in session)) return false;
	try {
		if (session.type !== AUDIO_SESSION_TYPE) session.type = AUDIO_SESSION_TYPE;
		return true;
	} catch {
		return false;
	}
}

/**
 * Pick a take at random, never the same one twice in a row, so a workout does not repeat
 * the exact same line. `random` is injectable for tests.
 */
export function pickTake(
	count: number,
	previous: number | undefined,
	random: () => number = Math.random
): number {
	if (count <= 1) return 1;
	if (previous === undefined) return 1 + Math.floor(random() * count);
	// Choose among the other takes only.
	const n = 1 + Math.floor(random() * (count - 1));
	return n >= previous ? n + 1 : n;
}
