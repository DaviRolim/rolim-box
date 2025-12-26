<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	type Workspace = {
		id: string;
		name: string;
		role: string;
	};

	let { workspaces, activeWorkspaceId }: { workspaces: Workspace[]; activeWorkspaceId: string | undefined } = $props();

	let isOpen = $state(false);

	const activeWorkspace = $derived(workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0]);

	async function switchWorkspace(workspaceId: string) {
		// Update localStorage
		localStorage.setItem('activeWorkspaceId', workspaceId);

		// Update cookie via API
		await fetch('/api/workspaces/active', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ workspaceId })
		});

		isOpen = false;

		// Reload page data
		invalidateAll();
	}

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.workspace-switcher')) {
			isOpen = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="workspace-switcher relative">
	{#if workspaces.length <= 1}
		<!-- Single workspace: just show name -->
		<div class="flex flex-col items-end">
			<span class="text-[10px] font-bold tracking-widest text-accent-400 uppercase">Workspace</span>
			<span class="text-xs font-medium text-text-secondary">{activeWorkspace?.name || 'No workspace'}</span>
		</div>
	{:else}
		<!-- Multiple workspaces: show dropdown -->
		<button
			onclick={toggleDropdown}
			class="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition-colors hover:bg-white/10"
		>
			<div class="flex flex-col items-start">
				<span class="text-[10px] font-bold tracking-widest text-accent-400 uppercase">Workspace</span>
				<span class="text-xs font-medium text-text-secondary">{activeWorkspace?.name}</span>
			</div>
			<svg class="h-4 w-4 text-text-muted transition-transform" class:rotate-180={isOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if isOpen}
			<div class="absolute right-0 top-full z-50 mt-2 min-w-48 rounded-lg border border-white/10 bg-bg-surface shadow-xl">
				{#each workspaces as workspace}
					<button
						onclick={() => switchWorkspace(workspace.id)}
						class="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-white/5 {workspace.id === activeWorkspaceId ? 'bg-accent-500/10' : ''}"
					>
						<span class="font-medium text-white">{workspace.name}</span>
						<span class="text-xs text-text-muted">{workspace.role}</span>
					</button>
				{/each}
				<div class="border-t border-white/5">
					<a
						href="/settings/workspace"
						class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						Workspace Settings
					</a>
				</div>
			</div>
		{/if}
	{/if}
</div>
