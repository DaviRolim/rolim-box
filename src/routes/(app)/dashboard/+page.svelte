<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Dashboard - RolimBox</title>
</svelte:head>

<div class="space-y-6">
	<h2 class="text-2xl font-bold text-white">Dashboard</h2>

	<div class="rounded-lg border border-gray-800 bg-secondary-800 p-6">
		<h3 class="mb-2 text-lg font-semibold text-white">Welcome to RolimBox</h3>
		<p class="text-gray-400">
			Your CrossFit workout management system. WoD creation and timer features coming soon.
		</p>
	</div>

	{#if data.workspace}
		<div class="rounded-lg border border-gray-800 bg-secondary-800 p-6">
			<h3 class="mb-2 text-sm font-medium text-gray-400">Current Workspace</h3>
			<p class="text-white">{data.workspace.name}</p>
		</div>
	{/if}
</div>
