import { browser } from '$app/environment';

/** 'auto' follows the phone. 'sol' is the light ground for a bright room, 'noite' the dark one. */
export type ThemeChoice = 'auto' | 'sol' | 'noite';

const KEY = 'rolimbox:theme';
const GROUND = { sol: '#f1ede3', noite: '#0c0c0d' } as const;

class ThemeStore {
	choice = $state<ThemeChoice>('auto');
	#systemLight = $state(false);

	constructor() {
		if (!browser) return;
		try {
			const saved = localStorage.getItem(KEY);
			if (saved === 'sol' || saved === 'noite') this.choice = saved;
		} catch {
			// private mode: stay on auto
		}
		const query = window.matchMedia('(prefers-color-scheme: light)');
		this.#systemLight = query.matches;
		query.addEventListener('change', (event) => {
			this.#systemLight = event.matches;
			this.#paint();
		});
		this.#paint();
	}

	/** The ground actually on screen. */
	get ground(): 'sol' | 'noite' {
		if (this.choice !== 'auto') return this.choice;
		return this.#systemLight ? 'sol' : 'noite';
	}

	set(choice: ThemeChoice): void {
		this.choice = choice;
		if (!browser) return;
		try {
			if (choice === 'auto') localStorage.removeItem(KEY);
			else localStorage.setItem(KEY, choice);
		} catch {
			// not persisted, still applied
		}
		this.#paint();
	}

	#paint(): void {
		const root = document.documentElement;
		if (this.choice === 'auto') delete root.dataset.theme;
		else root.dataset.theme = this.choice;
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', GROUND[this.ground]);
	}
}

export const themeStore = new ThemeStore();
