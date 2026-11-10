<script lang="ts">
	/**
	 * RolimBox mark: a box with a roof (the box lives in a family house) and a block "R".
	 * The same geometry is used for the app icons in static/icons (see scripts/generate-icons.mjs).
	 */
	interface Props {
		/** Height of the mark in px. */
		size?: number;
		/** Show the ROLIMBOX wordmark next to the mark. */
		wordmark?: boolean;
		class?: string;
	}

	let { size = 32, wordmark = true, class: className = '' }: Props = $props();
</script>

<span class="inline-flex items-center gap-2.5 {className}">
	<svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
		<path d="M4 19.5 24 4l20 15.5V42a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="var(--color-pink)" />
		<path
			fill="#fff"
			fill-rule="evenodd"
			d="M15.5 38V19h10.2a6.3 6.3 0 0 1 2.5 12.1L32.6 38h-5.5l-3.7-6.2h-3.1V38zm4.8-14.8v4.4h4.9a2.2 2.2 0 0 0 0-4.4z"
		/>
	</svg>
	{#if wordmark}
		<span
			class="display leading-none text-chalk"
			style="font-size: {Math.round(size * 0.78)}px; letter-spacing: 0.01em"
		>
			Rolim<span class="text-pink-bright">Box</span>
		</span>
	{:else}
		<span class="sr-only">RolimBox</span>
	{/if}
</span>
