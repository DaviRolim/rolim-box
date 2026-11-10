import type { Action } from 'svelte/action';

export interface FitOptions {
	/** Largest font size in px. */
	max?: number;
	/** Smallest font size in px. Below this the text is allowed to wrap instead. */
	min?: number;
	/** Re-run when this value changes (pass the text). */
	key?: unknown;
}

/**
 * Scale a single line of text so it spans the full width of its parent, like a name painted
 * across a sign. Long text that would get too small wraps at `min` instead.
 */
export const fitText: Action<HTMLElement, FitOptions | undefined> = (node, options) => {
	let current = options ?? {};

	function fit() {
		const parent = node.parentElement;
		if (!parent) return;
		const { max = 220, min = 44 } = current;
		const style = getComputedStyle(parent);
		const available =
			parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
		if (available <= 0) return;

		node.style.whiteSpace = 'nowrap';
		node.style.display = 'inline-block';
		node.style.fontSize = '100px';
		const natural = node.getBoundingClientRect().width;
		if (natural <= 0) return;

		const ideal = Math.floor((100 * available) / natural);
		if (ideal >= min) {
			node.style.fontSize = `${Math.min(max, ideal)}px`;
		} else {
			// Too long for one line: wrap, at a size where the longest word still fits.
			node.style.whiteSpace = 'normal';
			node.style.display = 'block';
			const longest = node.textContent
				?.split(/\s+/)
				.reduce((a, b) => (b.length > a.length ? b : a), '');
			const perChar = natural / Math.max(1, node.textContent?.length ?? 1);
			const wordLimit = longest ? (100 * available) / (perChar * longest.length * 1.08) : max;
			node.style.fontSize = `${Math.max(28, Math.min(max, min * 1.25, Math.floor(wordLimit)))}px`;
		}
	}

	const observer = new ResizeObserver(() => fit());
	if (node.parentElement) observer.observe(node.parentElement);
	// The scoreboard face may arrive after first paint; measure again when it does.
	document.fonts?.ready.then(fit).catch(() => {});
	fit();

	return {
		update(next) {
			current = next ?? {};
			fit();
		},
		destroy() {
			observer.disconnect();
		}
	};
};

export interface FitBoxOptions {
	min?: number;
	max?: number;
	key?: unknown;
}

/**
 * Find the largest `--board-size` (px) at which the node's content still fits inside the node,
 * both ways. Used by Placar mode to make a section fill the screen.
 */
export const fitBox: Action<HTMLElement, FitBoxOptions | undefined> = (node, options) => {
	let current = options ?? {};
	let frame = 0;

	function fits(): boolean {
		return node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1;
	}

	function fit() {
		let low = current.min ?? 18;
		let high = current.max ?? 180;
		if (node.clientHeight === 0) return;
		for (let i = 0; i < 9; i++) {
			const mid = (low + high) / 2;
			node.style.setProperty('--board-size', `${mid}px`);
			if (fits()) low = mid;
			else high = mid;
		}
		node.style.setProperty('--board-size', `${Math.floor(low)}px`);
	}

	function schedule() {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(fit);
	}

	const observer = new ResizeObserver(schedule);
	observer.observe(node);
	document.fonts?.ready.then(schedule).catch(() => {});
	fit();

	return {
		update(next) {
			current = next ?? {};
			schedule();
		},
		destroy() {
			cancelAnimationFrame(frame);
			observer.disconnect();
		}
	};
};
