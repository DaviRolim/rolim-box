<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { wodStore } from '$lib/stores/wods.svelte';
	import WodEditor from '$lib/components/editor/WodEditor.svelte';

	let { data } = $props();

	const initialDate = $derived(page.url.searchParams.get('date') ?? undefined);
</script>

<svelte:head>
	<title>New WoD - RolimBox</title>
</svelte:head>

{#if data.canEdit && data.activeWorkspaceId && wodStore.loading}
	<!-- The editor picks the first open day, so it waits until the board has been read. -->
	<div class="flex flex-col gap-3 px-4 py-6 lg:px-10" aria-busy="true" aria-label="Loading">
		<div class="led h-14 w-2/3"></div>
		<div class="led h-28"></div>
		<div class="led h-40"></div>
	</div>
{:else if data.canEdit && data.activeWorkspaceId}
	{#key data.activeWorkspaceId}
		<WodEditor
			wod={null}
			workspaceId={data.activeWorkspaceId}
			aiEnabled={data.aiEnabled}
			{initialDate}
		/>
	{/key}
{:else}
	<div class="px-4 py-8 lg:px-10">
		<p class="legend text-mute">Coaches only</p>
		<h1 class="mt-3 display text-[3.5rem]">Not your whiteboard</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">
			Only the coaches of {data.activeWorkspace?.name ?? 'this box'} can program WoDs. You can still read
			every one of them.
		</p>
		<a href={resolve('/dashboard')} class="btn btn-ink mt-6">Back to today</a>
	</div>
{/if}
