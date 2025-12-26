<script lang="ts">
	let inviteCode = $state('');
	let error = $state('');
	let loading = $state(false);

	async function joinWithCode() {
		if (!inviteCode.trim()) return;

		loading = true;
		error = '';

		// Redirect to join page
		window.location.href = `/join/${inviteCode.trim().toUpperCase()}`;
	}
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
	<h1 class="text-2xl font-bold text-white">No Workspace</h1>
	<p class="mt-2 text-text-secondary">You're not part of any workspace yet.</p>

	<div class="mt-8 w-full max-w-sm">
		<p class="text-sm text-text-muted">Have an invite code?</p>
		<div class="mt-2 flex gap-2">
			<input
				type="text"
				bind:value={inviteCode}
				placeholder="ABC-123"
				class="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-center text-white uppercase placeholder-text-muted"
			/>
			<button
				onclick={joinWithCode}
				disabled={loading || !inviteCode.trim()}
				class="rounded-lg bg-accent-500 px-4 py-2 font-bold text-white hover:bg-accent-600 disabled:opacity-50"
			>
				Join
			</button>
		</div>

		{#if error}
			<p class="mt-2 text-sm text-error">{error}</p>
		{/if}
	</div>
</div>
