<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { timeAgo } from '$lib/date';
	import { audioService } from '$lib/services/audio.svelte';
	import { retrySync } from '$lib/services/sync-queue';
	import { invalidatePRCache } from '$lib/services/pr';
	import { syncStore } from '$lib/stores/sync.svelte';
	import { themeStore, type ThemeChoice } from '$lib/stores/theme.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { wodStore } from '$lib/stores/wods.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import LogoutButton from '$lib/components/shell/LogoutButton.svelte';
	import type { UnitPreference } from '$lib/types/pr';

	let { data } = $props();

	const GROUNDS: { value: ThemeChoice; label: string; hint: string }[] = [
		{ value: 'auto', label: 'Auto', hint: 'Follows the phone' },
		{ value: 'sol', label: 'Sol', hint: 'Light, for a bright box' },
		{ value: 'noite', label: 'Noite', hint: 'Dark' }
	];
	const UNITS: { value: UnitPreference; label: string; hint: string }[] = [
		{ value: 'metric', label: 'Metric', hint: 'kg, metres' },
		{ value: 'imperial', label: 'Imperial', hint: 'lb, miles' }
	];
	const ROLE: Record<string, string> = { owner: 'Owner', coach: 'Coach', member: 'Athlete' };
	const CHANGE = { create: 'New', update: 'Edit to', delete: 'Delete of' } as const;

	let savingUnits = $state(false);
	let syncing = $state(false);
	let discardOpen = $state(false);
	let now = $state(Date.now());

	$effect(() => {
		const interval = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(interval);
	});

	async function setUnits(next: UnitPreference) {
		if (next === data.unitPreference || savingUnits) return;
		savingUnits = true;
		try {
			const response = await fetch('/api/user/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ unitPreference: next })
			});
			if (!response.ok) throw new Error(String(response.status));
			await invalidatePRCache().catch(() => {});
			await invalidateAll();
			toastStore.success(next === 'metric' ? 'PRs now show in kg.' : 'PRs now show in lb.');
		} catch {
			toastStore.error('Could not save. This setting needs a connection.');
		} finally {
			savingUnits = false;
		}
	}

	async function syncNow() {
		syncing = true;
		try {
			await retrySync();
			const ok = await wodStore.refresh();
			if (ok) toastStore.success('Everything is up to date.');
			else if (syncStore.isOffline) toastStore.info('Still offline. It will sync by itself later.');
			else toastStore.error('The server did not answer. Try again in a moment.');
		} finally {
			syncing = false;
		}
	}

	async function discardFailed() {
		discardOpen = false;
		await wodStore.discardFailedChanges();
		toastStore.success('Refused changes discarded. The board matches the server again.');
	}

	const statusLine = $derived.by(() => {
		switch (syncStore.status) {
			case 'offline':
				return 'Offline. Changes are kept on this phone and sent when the signal is back.';
			case 'error':
				return 'The server refused some changes. They need a decision below.';
			case 'unreachable':
				return 'Online, but the server is not answering. It will keep trying.';
			case 'syncing':
				return 'Sending changes to the server.';
			case 'pending':
				return `${syncStore.pending} ${syncStore.pending === 1 ? 'change is' : 'changes are'} waiting to be sent.`;
			default:
				return 'Everything on this phone is on the server.';
		}
	});
</script>

<svelte:head>
	<title>Settings - RolimBox</title>
</svelte:head>

<div class="page">
	<header>
		<p class="truncate legend text-mute">{data.user.email}</p>
		<h1 class="mt-2 display text-[4.5rem] lg:text-[6rem]">Settings</h1>
	</header>

	<div class="mt-6 grid gap-x-12 lg:grid-cols-2">
		<div>
			<!-- Ground -->
			<section class="module pb-6">
				<div class="module-head">
					<h2>Ground</h2>
					<span>{themeStore.ground === 'sol' ? 'Sol' : 'Noite'}</span>
				</div>
				<div class="choices" role="radiogroup" aria-label="Ground (theme)">
					{#each GROUNDS as option (option.value)}
						<button
							type="button"
							role="radio"
							aria-checked={themeStore.choice === option.value}
							class="choice"
							class:on={themeStore.choice === option.value}
							onclick={() => themeStore.set(option.value)}
						>
							<span class="display text-[1.75rem]">{option.label}</span>
							<span class="mt-1 block text-sm leading-tight opacity-80">{option.hint}</span>
						</button>
					{/each}
				</div>
				<p class="mt-3 text-base leading-snug text-mute">
					Sol is the light ground: easier to read when the morning sun hits the box.
				</p>
			</section>

			<!-- Units -->
			<section class="module pb-6">
				<div class="module-head">
					<h2>Units</h2>
					<span>For your PRs</span>
				</div>
				<div class="choices" role="radiogroup" aria-label="Units">
					{#each UNITS as option (option.value)}
						<button
							type="button"
							role="radio"
							aria-checked={data.unitPreference === option.value}
							class="choice"
							class:on={data.unitPreference === option.value}
							disabled={savingUnits}
							onclick={() => setUnits(option.value)}
						>
							<span class="display text-[1.75rem]">{option.label}</span>
							<span class="mt-1 block text-sm leading-tight opacity-80">{option.hint}</span>
						</button>
					{/each}
				</div>
			</section>

			<!-- Sound -->
			<section class="module pb-6">
				<div class="module-head">
					<h2>Clock sound</h2>
					<span>{audioService.isMuted ? 'Off' : 'On'}</span>
				</div>
				<button
					type="button"
					class="btn w-full justify-between {audioService.isMuted ? 'btn-quiet' : 'btn-ink'}"
					role="switch"
					aria-checked={!audioService.isMuted}
					onclick={() => audioService.toggleMute()}
				>
					<span class="flex items-center gap-2.5">
						<Icon name={audioService.isMuted ? 'volume-off' : 'volume'} size={20} stroke={2.6} />
						Beeps and voice cues
					</span>
					<span>{audioService.isMuted ? 'Off' : 'On'}</span>
				</button>
				<p class="mt-3 text-base leading-snug text-mute">
					3-2-1, "halfway", "ten seconds" and "time". Turn the phone's volume up: the music in the
					box is loud.
				</p>
			</section>
		</div>

		<div>
			<!-- This phone -->
			<section class="module pb-6" id="sync">
				<div class="module-head">
					<h2>This phone</h2>
					<span>
						{syncStore.lastSyncedAt
							? `Checked ${timeAgo(syncStore.lastSyncedAt, now)}`
							: 'Not checked yet'}
					</span>
				</div>
				<div
					class="notice {syncStore.status === 'error'
						? 'notice-danger'
						: syncStore.status === 'synced'
							? ''
							: 'notice-warn'}"
				>
					<span class="mt-0.5 flex-none">
						<Icon
							name={syncStore.status === 'synced'
								? 'check'
								: syncStore.isOffline
									? 'wifi-off'
									: syncStore.status === 'error'
										? 'alert'
										: 'cloud'}
							size={20}
							stroke={2.8}
						/>
					</span>
					<p>{statusLine}</p>
				</div>

				{#if syncStore.failed.length > 0}
					<ul class="mt-3 border-t border-line">
						{#each syncStore.failed as change (change.id)}
							<li class="border-b border-line py-3">
								<p class="legend text-danger-ink">
									{CHANGE[change.type]}
									{change.entity === 'wod' ? 'a WoD' : 'a PR'}
								</p>
								<p class="mt-1 text-base leading-snug">{change.error}</p>
							</li>
						{/each}
					</ul>
				{/if}

				<div class="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						class="btn flex-1"
						disabled={syncing || syncStore.isOffline}
						onclick={syncNow}
					>
						<Icon name="refresh" size={18} stroke={2.8} />
						{syncing ? 'Syncing' : 'Sync now'}
					</button>
					{#if syncStore.failed.length > 0}
						<button
							type="button"
							class="btn btn-danger flex-1"
							onclick={() => (discardOpen = true)}
						>
							Discard refused
						</button>
					{/if}
				</div>
				<p class="mt-3 text-base leading-snug text-mute">
					WoDs and PRs are saved on this phone, so the app opens and the timers run with no signal.
				</p>
			</section>

			<!-- Box -->
			{#if data.activeWorkspace}
				<section class="module pb-6">
					<div class="module-head">
						<h2>Your box</h2>
						<span>{ROLE[data.activeWorkspace.role] ?? data.activeWorkspace.role}</span>
					</div>
					<p class="display text-[2.5rem] break-words">{data.activeWorkspace.name}</p>
					<a href={resolve('/settings/workspace')} class="btn mt-4 w-full justify-between">
						<span class="flex items-center gap-2.5">
							<Icon name="users" size={20} stroke={2.6} />
							Members and invites
						</span>
						<Icon name="arrow-right" size={20} stroke={2.8} />
					</a>
				</section>
			{/if}

			<!-- Account -->
			<section class="module pb-6 lg:hidden">
				<div class="module-head">
					<h2>Account</h2>
					<span class="truncate normal-case">{data.user.email}</span>
				</div>
				<LogoutButton class="btn btn-quiet w-full" />
			</section>
		</div>
	</div>
</div>

<ConfirmDialog
	bind:open={discardOpen}
	title="Discard refused changes?"
	message="The changes the server refused are thrown away and this phone goes back to what the server has. Changes still waiting to be sent are kept."
	confirmLabel="Discard"
	cancelLabel="Keep them"
	danger
	onconfirm={discardFailed}
/>

<style>
	.page {
		padding: 1.5rem calc(1rem + var(--safe-right)) 0 calc(1rem + var(--safe-left));
		max-width: 72rem;
	}
	.choices {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		border: 2px solid var(--c-ink);
	}
	.choice {
		min-height: 5rem;
		padding: 0.75rem 0.75rem 0.625rem;
		text-align: left;
		color: var(--c-ink);
	}
	.choice + .choice {
		border-left: 2px solid var(--c-ink);
	}
	.choice.on {
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
	.choice:focus-visible {
		outline-offset: -5px;
		box-shadow: none;
	}
	.choice:disabled {
		cursor: progress;
	}
	@media (hover: hover) {
		.choice:not(.on):hover {
			background: var(--c-panel);
		}
	}
	@media (min-width: 1024px) {
		.page {
			padding: 2.25rem 2.5rem 0;
		}
	}
</style>
