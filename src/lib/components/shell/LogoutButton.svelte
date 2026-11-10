<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { forgetDevice } from '$lib/services/session';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n';

	let { class: className = 'btn btn-quiet' }: { class?: string } = $props();
</script>

<form
	action={resolve('/logout')}
	method="POST"
	use:enhance={() => {
		void forgetDevice();
		return async ({ result }) => {
			// A full page load, so nothing of the previous session survives in memory.
			window.location.href = result.type === 'redirect' ? result.location : '/login';
		};
	}}
>
	<button type="submit" class={className}>
		<Icon name="logout" size={20} stroke={2.5} />
		{t.shell.logOut}
	</button>
</form>
