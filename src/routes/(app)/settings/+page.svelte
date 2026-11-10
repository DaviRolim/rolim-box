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
	import { bankStore } from '$lib/stores/bank.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import LogoutButton from '$lib/components/shell/LogoutButton.svelte';
	import type { UnitPreference } from '$lib/types/pr';
	import { LOCALES, HTML_LANG, t, type Locale } from '$lib/i18n';
	import { localeStore } from '$lib/i18n/store.svelte';

	let { data } = $props();

	// Sol and Noite are the grounds' own names, in both languages.
	const GROUNDS: { value: ThemeChoice; label: string; hint: string }[] = $derived([
		{ value: 'auto', label: t.settings.ground.auto, hint: t.settings.ground.autoHint },
		{ value: 'sol', label: 'Sol', hint: t.settings.ground.solHint },
		{ value: 'noite', label: 'Noite', hint: t.settings.ground.noiteHint }
	]);
	const UNITS: { value: UnitPreference; label: string; hint: string }[] = $derived([
		{ value: 'metric', label: t.settings.units.metric, hint: t.settings.units.metricHint },
		{ value: 'imperial', label: t.settings.units.imperial, hint: t.settings.units.imperialHint }
	]);
	const LANGUAGE_HINT: Record<Locale, () => string> = {
		en: () => t.settings.language.englishHint,
		pt: () => t.settings.language.portugueseHint
	};

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
			toastStore.success(next === 'metric' ? t.settings.units.nowKg : t.settings.units.nowLb);
		} catch {
			toastStore.error(t.settings.units.saveFailed);
		} finally {
			savingUnits = false;
		}
	}

	async function syncNow() {
		syncing = true;
		try {
			await retrySync();
			const ok = await wodStore.refresh();
			void bankStore.refresh();
			if (ok) toastStore.success(t.settings.phone.upToDate);
			else if (syncStore.isOffline) toastStore.info(t.settings.phone.stillOffline);
			else toastStore.error(t.settings.phone.noAnswer);
		} finally {
			syncing = false;
		}
	}

	async function discardFailed() {
		discardOpen = false;
		await wodStore.discardFailedChanges();
		await bankStore.reload();
		toastStore.success(t.settings.phone.discarded);
	}

	const statusLine = $derived.by(() => {
		const status = t.settings.phone.status;
		switch (syncStore.status) {
			case 'offline':
				return status.offline;
			case 'error':
				return status.error;
			case 'unreachable':
				return status.unreachable;
			case 'syncing':
				return status.syncing;
			case 'pending':
				return status.pending(syncStore.pending);
			default:
				return status.synced;
		}
	});
</script>

<svelte:head>
	<title>{t.common.pageTitle(t.settings.title)}</title>
</svelte:head>

<div class="page">
	<header>
		<p class="truncate legend text-mute">{data.user.email}</p>
		<h1 class="mt-2 display text-[4.5rem] lg:text-[6rem]">{t.settings.title}</h1>
	</header>

	<div class="mt-6 grid gap-x-12 lg:grid-cols-2">
		<div>
			<!-- Ground -->
			<section class="module pb-6">
				<div class="module-head">
					<h2>{t.settings.ground.heading}</h2>
					<span>{themeStore.ground === 'sol' ? 'Sol' : 'Noite'}</span>
				</div>
				<div class="choices" role="radiogroup" aria-label={t.settings.ground.aria}>
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
				<p class="mt-3 text-base leading-snug text-mute">{t.settings.ground.note}</p>
			</section>

			<!-- Language (the same switch as EN | PT in the header) -->
			<section class="module pb-6">
				<div class="module-head">
					<h2>{t.settings.language.heading}</h2>
					<span>{localeStore.current.toUpperCase()}</span>
				</div>
				<div class="choices" role="radiogroup" aria-label={t.settings.language.heading}>
					{#each LOCALES as locale (locale)}
						<button
							type="button"
							role="radio"
							aria-checked={localeStore.current === locale}
							class="choice"
							class:on={localeStore.current === locale}
							lang={HTML_LANG[locale]}
							onclick={() => localeStore.set(locale)}
						>
							<span class="display text-[1.75rem]">{t.shell.languageNames[locale]}</span>
							<span class="mt-1 block text-sm leading-tight opacity-80"
								>{LANGUAGE_HINT[locale]()}</span
							>
						</button>
					{/each}
				</div>
			</section>

			<!-- Units -->
			<section class="module pb-6">
				<div class="module-head">
					<h2>{t.settings.units.heading}</h2>
					<span>{t.settings.units.forPrs}</span>
				</div>
				<div class="choices" role="radiogroup" aria-label={t.settings.units.heading}>
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
					<h2>{t.settings.sound.heading}</h2>
					<span>{audioService.isMuted ? t.settings.sound.off : t.settings.sound.on}</span>
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
						{t.settings.sound.toggle}
					</span>
					<span>{audioService.isMuted ? t.settings.sound.off : t.settings.sound.on}</span>
				</button>
				<p class="mt-3 text-base leading-snug text-mute">{t.settings.sound.note}</p>
			</section>
		</div>

		<div>
			<!-- This phone -->
			<section class="module pb-6" id="sync">
				<div class="module-head">
					<h2>{t.settings.phone.heading}</h2>
					<span>
						{syncStore.lastSyncedAt
							? t.settings.phone.checked(timeAgo(syncStore.lastSyncedAt, now))
							: t.settings.phone.notChecked}
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
									{t.settings.phone.change[change.type][change.entity]}
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
						{syncing ? t.settings.phone.syncing : t.settings.phone.syncNow}
					</button>
					{#if syncStore.failed.length > 0}
						<button
							type="button"
							class="btn btn-danger flex-1"
							onclick={() => (discardOpen = true)}
						>
							{t.settings.phone.discardRefused}
						</button>
					{/if}
				</div>
				<p class="mt-3 text-base leading-snug text-mute">{t.settings.phone.note}</p>
			</section>

			<!-- Box -->
			{#if data.activeWorkspace}
				<section class="module pb-6">
					<div class="module-head">
						<h2>{t.settings.box.heading}</h2>
						<span>{t.common.roles[data.activeWorkspace.role] ?? data.activeWorkspace.role}</span>
					</div>
					<p class="display text-[2.5rem] break-words">{data.activeWorkspace.name}</p>
					<a href={resolve('/settings/workspace')} class="btn mt-4 w-full justify-between">
						<span class="flex items-center gap-2.5">
							<Icon name="users" size={20} stroke={2.6} />
							{t.settings.box.membersAndInvites}
						</span>
						<Icon name="arrow-right" size={20} stroke={2.8} />
					</a>
				</section>
			{/if}

			<!-- Account -->
			<section class="module pb-6 lg:hidden">
				<div class="module-head">
					<h2>{t.settings.account}</h2>
					<span class="truncate normal-case">{data.user.email}</span>
				</div>
				<LogoutButton class="btn btn-quiet w-full" />
			</section>
		</div>
	</div>
</div>

<ConfirmDialog
	bind:open={discardOpen}
	title={t.settings.phone.discardTitle}
	message={t.settings.phone.discardMessage}
	confirmLabel={t.settings.phone.discard}
	cancelLabel={t.settings.phone.keepThem}
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
