// src/lib/services/timer-engine.ts

export interface TimerEngineCallbacks {
	onTick: (deltaMs: number) => void;
	onComplete?: () => void;
}

export interface TimerEngine {
	start: () => void;
	pause: () => void;
	resume: () => void;
	stop: () => void;
	isRunning: () => boolean;
}

const TICK_INTERVAL = 100; // 100ms for smooth UI updates

export function createTimerEngine(callbacks: TimerEngineCallbacks): TimerEngine {
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let lastTickTime: number = 0;
	let running = false;

	function tick() {
		const now = performance.now();
		const delta = now - lastTickTime;
		lastTickTime = now;
		callbacks.onTick(delta);
	}

	function start() {
		if (running) return;
		running = true;
		lastTickTime = performance.now();
		intervalId = setInterval(tick, TICK_INTERVAL);
	}

	function pause() {
		if (!running) return;
		running = false;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function resume() {
		if (running) return;
		running = true;
		lastTickTime = performance.now();
		intervalId = setInterval(tick, TICK_INTERVAL);
	}

	function stop() {
		running = false;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function isRunning() {
		return running;
	}

	return { start, pause, resume, stop, isRunning };
}
