<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { t } from '$lib/i18n';

	type Workspace = { id: string; name: string; role: string };

	interface Props {
		workspaces: Workspace[];
		activeWorkspaceId: string | null;
		/** 'bar' is the compact trigger for the phone top bar, 'rail' the desktop one. */
		variant?: 'bar' | 'rail';
	}

	let { workspaces, activeWorkspaceId, variant = 'rail' }: Props = $props();

	let open = $state(false);
	let switching = $state<string | null>(null);

	const active = $derived(workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0]);

	async function choose(workspaceId: string) {
		if (workspaceId === activeWorkspaceId) {
			open = false;
			return;
		}
		switching = workspaceId;
		try {
			const response = await fetch('/api/workspaces/active', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ workspaceId })
			});
			if (!response.ok) throw new Error(String(response.status));
			await invalidateAll();
			open = false;
		} catch {
			toastStore.error(t.shell.box.switchFailed);
		} finally {
			switching = null;
		}
	}
</script>

{#if active}
	{#if workspaces.length > 1}
		<button
			type="button"
			class="trigger {variant}"
			onclick={() => (open = true)}
			aria-label={t.shell.box.switchAria(active.name)}
		>
			<span class="min-w-0">
				{#if variant === 'rail'}<span class="block legend text-mute">{t.shell.box.label}</span>{/if}
				<span class="name">{active.name}</span>
			</span>
			<Icon name="chevron-down" size={18} stroke={3} />
		</button>
	{:else if variant === 'rail'}
		<div class="trigger rail">
			<span class="min-w-0">
				<span class="block legend text-mute">{t.shell.box.label}</span>
				<span class="name">{active.name}</span>
			</span>
		</div>
	{/if}

	<Sheet
		bind:open
		title={t.shell.box.switchTitle}
		legend={t.shell.box.youTrainIn(workspaces.length)}
	>
		<ul class="flex flex-col gap-2">
			{#each workspaces as workspace (workspace.id)}
				{@const current = workspace.id === activeWorkspaceId}
				<li>
					<button
						type="button"
						class="choice"
						class:current
						disabled={switching !== null}
						aria-pressed={current}
						onclick={() => choose(workspace.id)}
					>
						<span class="min-w-0 truncate display text-[1.75rem]">{workspace.name}</span>
						<span class="flex-none legend">
							{switching === workspace.id
								? t.shell.box.switching
								: (t.common.roles[workspace.role] ?? workspace.role)}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</Sheet>
{/if}

<style>
	.trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
		color: var(--c-ink);
		text-align: left;
	}
	.trigger.rail {
		width: 100%;
		padding: 0.75rem 1rem;
		border-block: 1px solid var(--c-line);
	}
	.trigger.bar {
		min-height: 2.75rem;
		padding-inline: 0.25rem;
	}
	.name {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-stretch: 75%;
		font-weight: 800;
		font-size: 1.0625rem;
		line-height: 1.2;
		text-transform: uppercase;
	}
	.bar .name {
		font-stretch: 62%;
		font-weight: 900;
		font-size: 1.5rem;
		line-height: 1;
		padding-top: 0.12em;
	}
	.choice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		min-height: 4.5rem;
		padding: 0.75rem 1rem;
		border: 2px solid var(--c-line-strong);
		border-radius: 2px;
		color: var(--c-ink);
		text-align: left;
	}
	.choice.current {
		border-color: var(--c-pink);
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
</style>
