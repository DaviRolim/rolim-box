<script lang="ts">
	let { data, children } = $props();
</script>

<div class="min-h-screen bg-secondary-900">
	<header class="border-b border-gray-800 bg-secondary-800 px-4 py-3">
		<div class="mx-auto flex max-w-4xl items-center justify-between">
			<h1 class="text-xl font-bold text-white">RolimBox</h1>
			<div class="flex items-center gap-4">
				<span class="text-sm text-gray-400">{data.user?.email}</span>
				<form action="/logout" method="POST">
					<button
						type="submit"
						class="text-sm text-gray-400 transition hover:text-white"
					>
						Logout
					</button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-4xl p-4">
		{@render children()}
	</main>
</div>
