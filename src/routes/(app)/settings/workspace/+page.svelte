<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toastStore } from '$lib/stores/toast.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';

	let { data } = $props();

	const ROLE: Record<string, string> = { owner: 'Owner', coach: 'Coach', member: 'Athlete' };
	const RANK: Record<string, number> = { owner: 0, coach: 1, member: 2 };

	let inviteRole = $state<'coach' | 'member'>('member');
	let creating = $state(false);
	let fresh = $state<string | null>(null);
	let copied = $state<string | null>(null);
	let removing = $state<{ userId: string; email: string } | null>(null);
	let removeOpen = $state(false);
	let revoking = $state<string | null>(null);
	let revokeOpen = $state(false);
	let busy = $state(false);

	const members = $derived(
		[...data.members].sort(
			(a, b) =>
				(RANK[a.role] ?? 9) - (RANK[b.role] ?? 9) ||
				new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
		)
	);

	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	const formatDate = (value: Date | string) => day.format(new Date(value));
	const linkFor = (code: string) => `${window.location.origin}/join/${code}`;

	async function createInvite() {
		creating = true;
		try {
			const response = await fetch(`/api/workspaces/${data.workspace.id}/invites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: inviteRole })
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.error ?? 'Could not create the invite.');
			fresh = result.code;
			await invalidateAll();
		} catch (error) {
			toastStore.error(error instanceof Error ? error.message : 'Could not create the invite.');
		} finally {
			creating = false;
		}
	}

	async function copyLink(code: string) {
		try {
			await navigator.clipboard.writeText(linkFor(code));
			copied = code;
			setTimeout(() => {
				if (copied === code) copied = null;
			}, 2000);
		} catch {
			toastStore.error('Could not copy. Select the link and copy it by hand.');
		}
	}

	async function shareLink(code: string) {
		const url = linkFor(code);
		if (navigator.share) {
			try {
				await navigator.share({ title: `Join ${data.workspace.name} on RolimBox`, url });
			} catch {
				// closed the share sheet
			}
		} else {
			await copyLink(code);
		}
	}

	async function confirmRevoke() {
		if (!revoking) return;
		busy = true;
		try {
			const response = await fetch(`/api/workspaces/${data.workspace.id}/invites/${revoking}`, {
				method: 'DELETE'
			});
			if (!response.ok) throw new Error();
			if (fresh === revoking) fresh = null;
			await invalidateAll();
			toastStore.success('Invite cancelled.');
		} catch {
			toastStore.error('Could not cancel the invite.');
		} finally {
			busy = false;
			revokeOpen = false;
			revoking = null;
		}
	}

	async function confirmRemove() {
		if (!removing) return;
		busy = true;
		try {
			const response = await fetch(
				`/api/workspaces/${data.workspace.id}/members/${removing.userId}`,
				{ method: 'DELETE' }
			);
			if (!response.ok) throw new Error();
			await invalidateAll();
			toastStore.success(`${removing.email} removed from the box.`);
		} catch {
			toastStore.error('Could not remove this member.');
		} finally {
			busy = false;
			removeOpen = false;
			removing = null;
		}
	}
</script>

<svelte:head>
	<title>{data.workspace.name} · Members - RolimBox</title>
</svelte:head>

<div class="page">
	<a
		href={resolve('/settings')}
		class="inline-flex min-h-11 items-center gap-2 legend text-dim no-underline"
	>
		<Icon name="arrow-left" size={16} stroke={3} />
		Settings
	</a>

	<header class="mt-1">
		<p class="legend text-mute">{data.members.length} on the board</p>
		<h1 class="mt-2 display text-[3.5rem] break-words lg:text-[5rem]">{data.workspace.name}</h1>
	</header>

	<div class="mt-6 grid gap-x-12 lg:grid-cols-[5fr_7fr]">
		{#if data.isOwner}
			<div>
				<section class="module pb-6">
					<div class="module-head">
						<h2>Invite someone</h2>
						<span>Link lasts 7 days</span>
					</div>
					<div class="choices" role="radiogroup" aria-label="Invite as">
						<button
							type="button"
							role="radio"
							aria-checked={inviteRole === 'member'}
							class="choice"
							class:on={inviteRole === 'member'}
							onclick={() => (inviteRole = 'member')}
						>
							<span class="display text-[1.75rem]">Athlete</span>
							<span class="mt-1 block text-sm leading-tight opacity-80"
								>Reads WoDs, runs timers, logs PRs</span
							>
						</button>
						<button
							type="button"
							role="radio"
							aria-checked={inviteRole === 'coach'}
							class="choice"
							class:on={inviteRole === 'coach'}
							onclick={() => (inviteRole = 'coach')}
						>
							<span class="display text-[1.75rem]">Coach</span>
							<span class="mt-1 block text-sm leading-tight opacity-80"
								>Also programs and edits WoDs</span
							>
						</button>
					</div>
					<button
						type="button"
						class="btn btn-pink mt-3 w-full"
						disabled={creating}
						onclick={createInvite}
					>
						<Icon name="link" size={20} stroke={2.6} />
						{creating ? 'Creating' : 'Create invite link'}
					</button>

					{#if fresh}
						<div class="fresh mt-4" role="status">
							<p class="legend">New invite · send it to them</p>
							<p class="mt-2 display text-[3rem]">{fresh}</p>
							<p class="mt-2 text-sm leading-snug break-all">{linkFor(fresh)}</p>
							<div class="mt-3 grid grid-cols-2 gap-2">
								<button type="button" class="btn btn-sm" onclick={() => shareLink(fresh!)}>
									<Icon name="share" size={16} stroke={2.8} />
									Share
								</button>
								<button type="button" class="btn btn-sm" onclick={() => copyLink(fresh!)}>
									<Icon name={copied === fresh ? 'check' : 'copy'} size={16} stroke={2.8} />
									{copied === fresh ? 'Copied' : 'Copy link'}
								</button>
							</div>
						</div>
					{/if}
				</section>

				<section class="module pb-6">
					<div class="module-head">
						<h2>Open invites</h2>
						<span>{data.invites.length}</span>
					</div>
					{#if data.invites.length === 0}
						<p class="text-base text-mute">No invites waiting.</p>
					{:else}
						<ul>
							{#each data.invites as invite (invite.code)}
								<li class="row">
									<div class="min-w-0 flex-1">
										<p class="display text-[1.5rem]">{invite.code}</p>
										<p class="mt-1 legend text-dim">
											{ROLE[invite.role] ?? invite.role} · until {formatDate(invite.expiresAt)}
										</p>
									</div>
									<button
										type="button"
										class="icon-btn"
										onclick={() => copyLink(invite.code)}
										aria-label="Copy the link for invite {invite.code}"
										title="Copy link"
									>
										<Icon name={copied === invite.code ? 'check' : 'copy'} size={20} stroke={2.4} />
									</button>
									<button
										type="button"
										class="icon-btn"
										onclick={() => {
											revoking = invite.code;
											revokeOpen = true;
										}}
										aria-label="Cancel invite {invite.code}"
										title="Cancel invite"
									>
										<Icon name="x" size={20} stroke={2.6} />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>
		{/if}

		<section class="module pb-6 {data.isOwner ? '' : 'lg:col-span-2 lg:max-w-3xl'}">
			<div class="module-head">
				<h2>Members</h2>
				<span>{data.members.length}</span>
			</div>
			<ul>
				{#each members as member, index (member.userId)}
					<li class="row">
						<span class="w-6 flex-none legend text-mute">{String(index + 1).padStart(2, '0')}</span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-lg leading-tight font-bold">
								{member.email}
							</p>
							<p class="mt-1 legend text-dim">
								Since {formatDate(member.joinedAt)}{member.userId === data.currentUserId
									? ' · you'
									: ''}
							</p>
						</div>
						<span
							class="tag {member.role === 'owner'
								? 'tag-pink'
								: member.role === 'coach'
									? 'tag-ink'
									: ''}"
						>
							{ROLE[member.role] ?? member.role}
						</span>
						{#if data.isOwner && member.userId !== data.currentUserId}
							<button
								type="button"
								class="icon-btn"
								onclick={() => {
									removing = { userId: member.userId, email: member.email };
									removeOpen = true;
								}}
								aria-label="Remove {member.email} from the box"
								title="Remove"
							>
								<Icon name="trash" size={20} stroke={2.4} />
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	</div>
</div>

<ConfirmDialog
	bind:open={removeOpen}
	title="Remove from the box?"
	legend={removing?.email}
	message="They lose access to this box's WoDs and leaderboard. Their own PRs are kept on their account."
	confirmLabel={busy ? 'Removing' : 'Remove'}
	cancelLabel="Keep them"
	danger
	{busy}
	onconfirm={confirmRemove}
/>

<ConfirmDialog
	bind:open={revokeOpen}
	title="Cancel this invite?"
	legend={revoking ?? undefined}
	message="The link stops working straight away. People who already joined with it stay in the box."
	confirmLabel={busy ? 'Cancelling' : 'Cancel invite'}
	cancelLabel="Keep it"
	danger
	{busy}
	onconfirm={confirmRevoke}
/>

<style>
	.page {
		padding: 0.5rem calc(1rem + var(--safe-right)) 0 calc(1rem + var(--safe-left));
		max-width: 76rem;
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		border: 2px solid var(--c-ink);
	}
	.choice {
		min-height: 5.5rem;
		padding: 0.75rem 0.75rem 0.625rem;
		text-align: left;
		color: var(--c-ink);
	}
	.choice + .choice {
		border-left: 2px solid var(--c-ink);
	}
	.choice.on {
		background: var(--c-ink);
		color: var(--c-bg);
	}
	.choice:focus-visible {
		outline-offset: -5px;
		box-shadow: none;
	}
	.fresh {
		padding: 1rem;
		background: var(--c-pink);
		color: var(--c-on-fill);
		--c-ink: var(--c-on-fill);
		--c-bg: #ff2e93;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-height: 4.25rem;
		padding-block: 0.5rem;
		border-top: 1px solid var(--c-line);
	}
	@media (min-width: 1024px) {
		.page {
			padding: 1.25rem 2.5rem 0;
		}
	}
</style>
