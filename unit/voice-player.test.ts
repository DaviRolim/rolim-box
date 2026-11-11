import { describe, expect, test } from 'bun:test';
import {
	AUDIO_SESSION_TYPE,
	VoicePlayer,
	configureAudioSession,
	type VoiceElement
} from '$lib/services/voice-player';

class FakeAudio implements VoiceElement {
	src = '';
	preload = '';
	muted = false;
	currentTime = 0;
	paused = true;
	loads = 0;
	plays: { muted: boolean; from: number }[] = [];
	refuse = false;

	play(): Promise<void> {
		this.plays.push({ muted: this.muted, from: this.currentTime });
		if (this.refuse) return Promise.reject(new Error('NotAllowedError'));
		this.paused = false;
		this.currentTime = 0.4;
		return Promise.resolve();
	}
	pause() {
		this.paused = true;
	}
	load() {
		this.loads++;
	}
}

function setup() {
	const made: FakeAudio[] = [];
	const player = new VoicePlayer<'go' | 'time'>({
		createElement: () => {
			const el = new FakeAudio();
			made.push(el);
			return el;
		}
	});
	return { player, made };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('voice player', () => {
	test('one reusable element per cue, buffered as soon as it has a source', () => {
		const { player, made } = setup();
		player.setSource('go', 'blob:go');
		player.setSource('go', 'blob:go');
		expect(made).toHaveLength(1);
		expect(made[0].preload).toBe('auto');
		expect(made[0].loads).toBe(1);
		expect(player.hasSource('go')).toBe(true);
		expect(player.hasSource('time')).toBe(false);
	});

	test('a cue replays from the start, even while it is still speaking', async () => {
		const { player, made } = setup();
		player.setSource('go', 'blob:go');
		await player.play('go');
		await player.play('go');
		expect(made).toHaveLength(1);
		expect(made[0].plays).toEqual([
			{ muted: false, from: 0 },
			{ muted: false, from: 0 }
		]);
	});

	test('playing a cue with no file rejects, so the service can fall back', async () => {
		const { player } = setup();
		await expect(player.play('time')).rejects.toThrow();
	});

	test('a refused play rejects', async () => {
		const { player, made } = setup();
		player.setSource('go', 'blob:go');
		made[0].refuse = true;
		await expect(player.play('go')).rejects.toThrow('NotAllowedError');
	});

	test('unlock plays each loaded element muted, inside the tap, then rewinds it', async () => {
		const { player, made } = setup();
		player.setSource('go', 'blob:go');
		player.unlock(['go', 'time']);
		// play() was called synchronously, muted
		expect(made[0].plays).toEqual([{ muted: true, from: 0 }]);
		await flush();
		expect(made[0].paused).toBe(true);
		expect(made[0].currentTime).toBe(0);
		expect(made[0].muted).toBe(false);
		// 'time' had no file yet: not unlocked, retried on a later tap
		expect(player.isUnlocked(['go'])).toBe(true);
		expect(player.isUnlocked(['go', 'time'])).toBe(false);

		player.setSource('time', 'blob:time');
		player.unlock(['go', 'time']);
		expect(made[0].plays).toHaveLength(1);
		await flush();
		expect(player.isUnlocked(['go', 'time'])).toBe(true);
	});

	test('a refused unlock is retried on the next tap', async () => {
		const { player, made } = setup();
		player.setSource('go', 'blob:go');
		made[0].refuse = true;
		player.unlock(['go']);
		await flush();
		expect(player.isUnlocked(['go'])).toBe(false);
		expect(made[0].muted).toBe(false);
		made[0].refuse = false;
		player.unlock(['go']);
		await flush();
		expect(player.isUnlocked(['go'])).toBe(true);
	});

	test('an unlock that settles after a real cue started does not cut it off', async () => {
		const { player, made } = setup();
		player.setSource('go', 'blob:go');
		player.unlock(['go']);
		await player.play('go');
		await flush();
		expect(made[0].paused).toBe(false);
		expect(made[0].muted).toBe(false);
	});

	test('stopAll silences a cue mid-word', async () => {
		const { player, made } = setup();
		player.setSource('go', 'blob:go');
		await player.play('go');
		player.stopAll();
		expect(made[0].paused).toBe(true);
		expect(made[0].currentTime).toBe(0);
	});
});

describe('audio session', () => {
	test('asks for a transient session, which ducks other audio instead of stopping it', () => {
		const nav = { audioSession: { type: 'auto' } };
		expect(configureAudioSession(nav)).toBe(true);
		expect(nav.audioSession.type).toBe(AUDIO_SESSION_TYPE);
		expect(AUDIO_SESSION_TYPE).toBe('transient');
	});

	test('does nothing where the API is missing', () => {
		expect(configureAudioSession({})).toBe(false);
		expect(configureAudioSession(undefined)).toBe(false);
	});
});
