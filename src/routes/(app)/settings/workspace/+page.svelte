<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let creatingInvite = $state(false);
	let inviteRole = $state<'coach' | 'member'>('member');
	let newInviteCode = $state('');
	let copySuccess = $state(false);

	async function createInvite() {
		creatingInvite = true;
		try {
			const res = await fetch(`/api/workspaces/${data.workspace.id}/invites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: inviteRole })
			});
			const result = await res.json();
			if (res.ok) {
				newInviteCode = result.code;
				invalidateAll();
			}
		} finally {
			creatingInvite = false;
		}
	}

	async function revokeInvite(code: string) {
		await fetch(`/api/workspaces/${data.workspace.id}/invites/${code}`, {
			method: 'DELETE'
		});
		invalidateAll();
	}

	async function removeMember(userId: string) {
		if (!confirm('Remove this member from the workspace?')) return;

		await fetch(`/api/workspaces/${data.workspace.id}/members/${userId}`, {
			method: 'DELETE'
		});
		invalidateAll();
	}

	function getInviteLink(code: string) {
		return `${window.location.origin}/join/${code}`;
	}

	async function copyInviteLink(code: string) {
		await navigator.clipboard.writeText(getInviteLink(code));
		copySuccess = true;
		setTimeout(() => (copySuccess = false), 2000);
	}

	function formatDate(date: Date) {
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(date));
	}
</script>

<div class="p-4">
	<h1 class="text-2xl font-bold text-white">Workspace Settings</h1>
	<p class="mt-1 text-text-secondary">{data.workspace.name}</p>

	<!-- Invite Section (Owner Only) -->
	{#if data.isOwner}
		<section class="mt-8">
			<h2 class="text-lg font-bold text-white">Invite Members</h2>

			<div class="mt-4 flex flex-wrap gap-4">
				<select
					bind:value={inviteRole}
					class="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white"
				>
					<option value="member">Member (view only)</option>
					<option value="coach">Coach (can edit)</option>
				</select>
				<button
					onclick={createInvite}
					disabled={creatingInvite}
					class="rounded-lg bg-accent-500 px-4 py-2 font-bold text-white hover:bg-accent-600 disabled:opacity-50"
				>
					{creatingInvite ? 'Creating...' : 'Generate Invite Link'}
				</button>
			</div>

			{#if newInviteCode}
				<div class="mt-4 rounded-lg border border-accent-500/30 bg-accent-500/10 p-4">
					<p class="text-sm text-text-secondary">Share this link:</p>
					<div class="mt-2 flex items-center gap-2">
						<code class="flex-1 rounded bg-black/30 px-3 py-2 text-sm text-white">
							{getInviteLink(newInviteCode)}
						</code>
						<button
							onclick={() => copyInviteLink(newInviteCode)}
							class="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
						>
							{copySuccess ? 'Copied!' : 'Copy'}
						</button>
					</div>
					<p class="mt-2 text-xs text-text-muted">Expires in 7 days</p>
				</div>
			{/if}

			<!-- Active Invites -->
			{#if data.invites.length > 0}
				<div class="mt-6">
					<h3 class="text-sm font-bold uppercase text-text-secondary">Active Invites</h3>
					<div class="mt-2 space-y-2">
						{#each data.invites as invite}
							<div
								class="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3"
							>
								<div>
									<code class="text-sm text-white">{invite.code}</code>
									<span class="ml-2 text-xs text-text-muted">({invite.role})</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="text-xs text-text-muted">
										Expires {formatDate(invite.expiresAt)}
									</span>
									<button
										onclick={() => revokeInvite(invite.code)}
										class="text-xs text-error hover:underline"
									>
										Revoke
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	{/if}

	<!-- Members Section -->
	<section class="mt-8">
		<h2 class="text-lg font-bold text-white">Members</h2>
		<div class="mt-4 space-y-2">
			{#each data.members as member}
				<div
					class="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-4"
				>
					<div>
						<p class="font-medium text-white">{member.email}</p>
						<p class="text-xs text-text-muted">
							{member.role} · Joined {formatDate(member.joinedAt)}
						</p>
					</div>
					{#if data.isOwner && member.userId !== data.currentUserId}
						<button
							onclick={() => removeMember(member.userId)}
							class="text-sm text-error hover:underline"
						>
							Remove
						</button>
					{/if}
					{#if member.userId === data.currentUserId}
						<span class="text-xs text-text-muted">(you)</span>
					{/if}
				</div>
			{/each}
		</div>
	</section>
</div>
