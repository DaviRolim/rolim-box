<script lang="ts">
	/**
	 * RolimBox mark: a house (the box lives in grandma's house) with a block "R" cut into it.
	 * The same geometry is used for the app icons in static/ (see scripts/generate-icons.mjs).
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

<span class="inline-flex items-center gap-2 {className}">
	<svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
		<path d="M3 19 24 3l21 16v26H3z" fill="var(--c-pink)" />
		<path
			fill="var(--c-on-fill)"
			fill-rule="evenodd"
			d="M14.5 40V19h11.2a6.6 6.6 0 0 1 2.6 12.7L33 40h-6.1l-4-7h-2.8v7zm5.6-16.2v4.6h5a2.3 2.3 0 0 0 0-4.6z"
		/>
	</svg>
	{#if wordmark}
		<span class="display text-ink" style="font-size: {Math.round(size * 0.86)}px; line-height: 0.8">
			Rolim<span class="text-pink-ink">Box</span>
		</span>
	{:else}
		<span class="sr-only">RolimBox</span>
	{/if}
</span>
