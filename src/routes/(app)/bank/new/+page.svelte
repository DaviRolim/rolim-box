<script lang="ts">
	import { resolve } from '$app/paths';
	import WodEditor from '$lib/components/editor/WodEditor.svelte';
	import { t } from '$lib/i18n';

	let { data } = $props();
</script>

<svelte:head>
	<title>{t.common.pageTitle(t.bank.editor.pageTitleNew)}</title>
</svelte:head>

{#if data.canEdit && data.activeWorkspaceId}
	{#key data.activeWorkspaceId}
		<WodEditor
			mode="bank"
			bankWod={null}
			workspaceId={data.activeWorkspaceId}
			aiEnabled={data.aiEnabled}
		/>
	{/key}
{:else}
	<div class="px-4 py-8 lg:px-10">
		<p class="legend text-mute">{t.editor.guard.coachesOnly}</p>
		<h1 class="mt-3 display text-[3.5rem]">{t.editor.guard.title}</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">
			{t.bank.guard.body(data.activeWorkspace?.name ?? t.editor.guard.thisBox)}
		</p>
		<a href={resolve('/dashboard')} class="btn btn-ink mt-6">{t.editor.guard.backToToday}</a>
	</div>
{/if}
