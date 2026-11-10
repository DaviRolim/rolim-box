<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { audioService } from '$lib/services/audio.svelte';
	import { wodStore } from '$lib/stores/wods.svelte';
	import { syncStore } from '$lib/stores/sync.svelte';
	import Toasts from '$lib/components/ui/Toasts.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Logo from '$lib/components/ui/Logo.svelte';
	import SyncChip from '$lib/components/shell/SyncChip.svelte';
	import WorkspaceSwitcher from '$lib/components/shell/WorkspaceSwitcher.svelte';
	import LogoutButton from '$lib/components/shell/LogoutButton.svelte';
	import LangToggle from '$lib/components/shell/LangToggle.svelte';
	import { t } from '$lib/i18n';
	import type { IconName } from '$lib/components/ui/icons';

	let { data, children } = $props();

	const NAV: {
		href: '/dashboard' | '/workouts' | '/timers' | '/prs';
		key: keyof typeof t.shell.nav;
		icon: IconName;
	}[] = [
		{ href: '/dashboard', key: 'today', icon: 'today' },
		{ href: '/workouts', key: 'wods', icon: 'list' },
		{ href: '/timers', key: 'clock', icon: 'timer' },
		{ href: '/prs', key: 'prs', icon: 'trophy' }
	];

	const path = $derived(page.url.pathname);
	// A running clock owns the whole screen: no bars, no navigation.
	const bare = $derived(page.route.id === '/(app)/timers/[id]');
	const isActive = (href: string) => path === href || path.startsWith(href + '/');

	// One store feeds every screen. Opening it here means Today, WoDs and the clock all read
	// the same list, and it is already there when the person moves between them.
	// (Untracked: the store's own state must not re-run this, or a failed refresh would loop.)
	$effect(() => {
		const workspaceId = data.activeWorkspaceId;
		untrack(() => void wodStore.open(workspaceId));
	});

	onMount(() => {
		// Voice cues are loaded when the phone is idle, not while the WoD is being drawn.
		if ('requestIdleCallback' in window) requestIdleCallback(() => audioService.preload());
		else setTimeout(() => audioService.preload(), 1000);

		// iOS only lets audio start from a tap: unlock it on the first one.
		const unlock = () => audioService.unlockAudio();
		document.addEventListener('touchstart', unlock, { once: true });
		document.addEventListener('click', unlock, { once: true });

		// Ask the service worker to keep a copy of Today, so the next open works without signal.
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.ready
				.then((registration) => registration.active?.postMessage({ type: 'warm' }))
				.catch(() => {});
		}
	});

	function onKeydown(event: KeyboardEvent) {
		if (!data.canEdit || bare) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable], dialog')) return;
		if (event.key === 'n' || event.key === 'N') {
			event.preventDefault();
			void goto(resolve('/workouts/new'));
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<Toasts />

{#if bare}
	{@render children()}
{:else}
	<div class="shell">
		<!-- Desktop: the rail -->
		<aside class="rail" aria-label="RolimBox">
			<div class="flex items-start justify-between gap-2 pt-5 pr-3 pb-4 pl-4">
				<a href={resolve('/dashboard')} class="block no-underline" aria-label={t.shell.homeLink}>
					<Logo size={34} />
				</a>
				<LangToggle class="-mt-1.5" />
			</div>

			{#if data.workspaces.length > 0}
				<WorkspaceSwitcher
					workspaces={data.workspaces}
					activeWorkspaceId={data.activeWorkspaceId}
					variant="rail"
				/>
			{/if}

			{#if !data.hasNoWorkspace}
				<nav class="mt-2 flex flex-col" aria-label={t.shell.mainNav}>
					{#each NAV as item, index (item.href)}
						<a
							href={resolve(item.href)}
							class="rail-link"
							class:active={isActive(item.href)}
							aria-current={isActive(item.href) ? 'page' : undefined}
						>
							<span class="w-6 legend opacity-70">0{index + 1}</span>
							<span class="display text-[1.75rem]">{t.shell.nav[item.key]}</span>
						</a>
					{/each}
				</nav>

				{#if data.canEdit}
					<div class="px-4 pt-5">
						<a href={resolve('/workouts/new')} class="btn btn-pink w-full justify-between">
							<span class="flex items-center gap-2">
								<Icon name="plus" size={20} stroke={3.5} />
								{t.shell.newWod}
							</span>
							<kbd class="border border-current px-1.5 py-0.5 legend">N</kbd>
						</a>
					</div>
				{/if}
			{/if}

			<div class="mt-auto flex flex-col gap-1 border-t border-line px-4 py-3">
				<SyncChip />
				<a
					href={resolve('/settings')}
					class="flex min-h-11 items-center gap-2 px-1 legend no-underline {isActive('/settings')
						? 'text-ink'
						: 'text-dim'}"
				>
					<Icon name="settings" size={16} stroke={2.5} />
					{t.shell.settings}
				</a>
				<p class="truncate px-1 pb-2 text-sm text-mute" title={data.user.email}>
					{data.user.email}
				</p>
				<LogoutButton class="btn btn-quiet btn-sm w-full" />
			</div>
		</aside>

		<!-- Phone: the top bar -->
		<header class="topbar">
			<div class="flex min-w-0 items-center gap-2">
				<a
					href={resolve('/dashboard')}
					class="flex-none no-underline"
					aria-label={t.shell.homeLink}
				>
					<Logo size={28} wordmark={data.workspaces.length <= 1} />
				</a>
				{#if data.workspaces.length > 1}
					<WorkspaceSwitcher
						workspaces={data.workspaces}
						activeWorkspaceId={data.activeWorkspaceId}
						variant="bar"
					/>
				{/if}
			</div>
			<div class="flex flex-none items-center gap-1">
				<SyncChip />
				<LangToggle />
				<a
					href={resolve('/settings')}
					class="-mr-2 flex h-12 w-11 flex-none items-center justify-center {isActive('/settings')
						? 'text-pink-ink'
						: 'text-ink'}"
					aria-label={t.shell.settings}
				>
					<Icon name="settings" size={22} stroke={2.2} />
				</a>
			</div>
		</header>

		<div class="stage">
			{#if syncStore.isOffline}
				<div class="status-strip bg-warn text-on-fill" role="status">
					<Icon name="wifi-off" size={16} stroke={2.8} />
					<span>{t.shell.offlineStrip}</span>
				</div>
			{:else if syncStore.failed.length > 0}
				<div role="status">
					<a href={resolve('/settings')} class="status-strip bg-danger text-on-fill no-underline">
						<Icon name="alert" size={16} stroke={2.8} />
						<span>
							{t.shell.refused(syncStore.failed.length)}
							{t.shell.review}
						</span>
					</a>
				</div>
			{/if}

			<main>
				{@render children()}
			</main>
		</div>

		<!-- Phone: the bottom navigation -->
		{#if !data.hasNoWorkspace}
			<nav class="tabs" aria-label={t.shell.mainNav}>
				{#each NAV as item (item.href)}
					<a
						href={resolve(item.href)}
						class="tab"
						class:active={isActive(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						<Icon name={item.icon} size={24} stroke={isActive(item.href) ? 2.6 : 2} />
						<span class="legend">{t.shell.nav[item.key]}</span>
					</a>
				{/each}
			</nav>
		{/if}
	</div>
{/if}

<style>
	.shell {
		min-height: 100dvh;
	}

	.rail {
		display: none;
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		height: calc(var(--bar-h) + var(--safe-top));
		padding: var(--safe-top) calc(1rem + var(--safe-right)) 0 calc(1rem + var(--safe-left));
		background: var(--c-bg);
		border-bottom: 2px solid var(--c-ink);
	}

	.stage {
		padding-bottom: calc(var(--nav-h) + var(--safe-bottom) + 1.5rem);
	}

	.status-strip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem calc(1rem + var(--safe-right)) 0.5rem calc(1rem + var(--safe-left));
		font-family: var(--font-mono);
		font-stretch: 75%;
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1.3;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.tabs {
		position: fixed;
		z-index: 40;
		inset: auto 0 0 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		height: calc(var(--nav-h) + var(--safe-bottom));
		padding-bottom: var(--safe-bottom);
		padding-inline: var(--safe-left) var(--safe-right);
		background: var(--c-bg);
		border-top: 2px solid var(--c-ink);
	}
	.tab {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		color: var(--c-mute);
		text-decoration: none;
	}
	.tab + .tab {
		border-left: 1px solid var(--c-line);
	}
	.tab.active {
		color: var(--c-on-fill);
		background: var(--c-pink);
	}

	@media (min-width: 1024px) {
		.rail {
			position: fixed;
			inset: 0 auto 0 0;
			z-index: 40;
			display: flex;
			flex-direction: column;
			width: var(--rail-w);
			background: var(--c-bg);
			border-right: 2px solid var(--c-ink);
			overflow-y: auto;
		}
		.rail-link {
			display: flex;
			align-items: baseline;
			gap: 0.75rem;
			padding: 0.75rem 1rem 0.625rem;
			border-bottom: 1px solid var(--c-line);
			color: var(--c-dim);
			text-decoration: none;
		}
		.rail-link:hover {
			color: var(--c-ink);
			background: var(--c-panel);
		}
		.rail-link.active {
			color: var(--c-on-fill);
			background: var(--c-pink);
		}
		.topbar,
		.tabs {
			display: none;
		}
		.stage {
			margin-left: var(--rail-w);
			padding-bottom: 3rem;
		}
	}
</style>
