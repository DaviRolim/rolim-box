<script lang="ts">
	import { ICONS, type IconName } from './icons';

	interface Props {
		name: IconName;
		/** Size in px. Icons scale with the text when omitted (1.25em). */
		size?: number;
		/** Stroke width. Bump it for small icons or icons seen from a distance. */
		stroke?: number;
		/** Fill the shape (play / pause read better solid). */
		solid?: boolean;
		class?: string;
	}

	let { name, size, stroke = 2, solid = false, class: className = '' }: Props = $props();

	const dimension = $derived(size ? `${size}px` : '1.25em');
</script>

<svg
	class="shrink-0 {className}"
	width={dimension}
	height={dimension}
	viewBox="0 0 24 24"
	fill={solid ? 'currentColor' : 'none'}
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each ICONS[name] as d (d)}
		<path {d} />
	{/each}
</svg>
