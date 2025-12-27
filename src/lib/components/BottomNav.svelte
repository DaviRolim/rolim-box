<script lang="ts">
	import { page } from '$app/stores';

	interface NavItem {
		label: string;
		path: string;
		icon: string;
		disabled?: boolean;
		disabledMessage?: string;
	}

	const navItems: NavItem[] = [
		{
			label: 'Home',
			path: '/dashboard',
			icon: 'home'
		},
		{
			label: 'Workouts',
			path: '/workouts',
			icon: 'workouts'
		},
		{
			label: 'PRs',
			path: '/prs',
			icon: 'prs'
		},
		{
			label: 'Timers',
			path: '/timers',
			icon: 'timers'
		}
	];

	function isActive(itemPath: string): boolean {
		const currentPath = $page.url.pathname;
		if (itemPath === '/dashboard') {
			return currentPath === '/dashboard';
		}
		return currentPath.startsWith(itemPath);
	}
</script>

<nav
	class="fixed right-0 bottom-0 left-0 z-50 border-t border-white/5 bg-bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
>
	<div
		class="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-accent-500/50 to-transparent opacity-50"
	></div>

	<div class="mx-auto grid max-w-md grid-cols-4 md:max-w-7xl">
		{#each navItems as item}
			{@const active = isActive(item.path)}
			<a
				href={item.disabled ? undefined : item.path}
				class="group relative flex min-h-[var(--bottom-nav-min-height)] flex-col items-center justify-center gap-1.5 py-3 transition-colors duration-300"
				class:text-accent-400={active}
				class:text-text-muted={!active}
				class:pointer-events-none={item.disabled}
				aria-label={item.label}
				aria-current={active ? 'page' : undefined}
			>
				<!-- Icon Wrapper -->
				<div class="relative transition-all duration-300 group-hover:-translate-y-1">
					{#if item.icon === 'home'}
						<svg
							class="h-6 w-6 transition-transform duration-300 {active
								? 'scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]'
								: ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
						>
							<path
								d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{:else if item.icon === 'workouts'}
						<svg
							class="h-6 w-6 transition-transform duration-300 {active
								? 'scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]'
								: ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
						>
							<rect x="3" y="4" width="18" height="16" rx="2" stroke-width="2" />
							<line x1="12" y1="8" x2="12" y2="16" stroke-width="2" stroke-linecap="round" />
							<line x1="8" y1="12" x2="16" y2="12" stroke-width="2" stroke-linecap="round" />
						</svg>
					{:else if item.icon === 'timers'}
						<svg
							class="h-6 w-6 transition-transform duration-300 {active
								? 'scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]'
								: ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
						>
							<circle cx="12" cy="12" r="9" stroke-width="2" />
							<polyline points="12 6 12 12 16 14" stroke-width="2" stroke-linecap="round" />
						</svg>
					{:else if item.icon === 'prs'}
						<svg
							class="h-6 w-6 transition-transform duration-300 {active
								? 'scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]'
								: ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
						>
							<path
								d="M12 15l-2 5h4l-2-5z"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M8 8a4 4 0 1 1 8 0c0 2.5-2 3-2 5h-4c0-2-2-2.5-2-5z"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
				</div>

				<!-- Label -->
				<span
					class="text-[10px] font-medium tracking-wider uppercase transition-all duration-300 {active
						? 'text-text-primary'
						: 'text-text-muted group-hover:text-text-secondary'}"
				>
					{item.label}
				</span>

				<!-- Active Glow -->
				{#if active}
					<div
						class="absolute -bottom-3 left-1/2 h-8 w-12 -translate-x-1/2 rounded-full bg-accent-500/20 blur-xl"
					></div>
				{/if}
			</a>
		{/each}
	</div>
</nav>
