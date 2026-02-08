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
	destroy: () => void;
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

	function handleVisibilityChange() {
		if (document.visibilityState === 'visible' && running) {
			tick();
		}
	}

	function start() {
		if (running) return;
		running = true;
		lastTickTime = performance.now();
		intervalId = setInterval(tick, TICK_INTERVAL);
		document.addEventListener('visibilitychange', handleVisibilityChange);
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

	function destroy() {
		stop();
		document.removeEventListener('visibilitychange', handleVisibilityChange);
	}

	function isRunning() {
		return running;
	}

	return { start, pause, resume, stop, isRunning, destroy };
}
