<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The front door: a painted pink wall with the box's name on it, and the form beside it
	 * (below it on a phone, where the thumbs are).
	 */
	let { children }: { children: Snippet } = $props();
</script>

<div class="door">
	<div class="wall">
		<svg class="mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
			<path d="M3 19 24 3l21 16v26H3z" fill="#0c0c0d" />
			<path
				fill="#ff2e93"
				fill-rule="evenodd"
				d="M14.5 40V19h11.2a6.6 6.6 0 0 1 2.6 12.7L33 40h-6.1l-4-7h-2.8v7zm5.6-16.2v4.6h5a2.3 2.3 0 0 0 0-4.6z"
			/>
		</svg>
		<div>
			<p class="name display">Rolim<br />Box</p>
			<p class="mt-3 legend" lang="pt-BR">CrossFit na casa da vó · João Pessoa, PB</p>
		</div>
		<p class="hello sign" lang="pt-BR" aria-hidden="true">Chega mais!</p>
	</div>

	<main class="form">
		<div class="inner">
			{@render children()}
		</div>
	</main>
</div>

<style>
	.door {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}
	.wall {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 1.25rem;
		padding: calc(1.25rem + var(--safe-top)) calc(1rem + var(--safe-right)) 1.25rem
			calc(1rem + var(--safe-left));
		background: #ff2e93;
		color: #0c0c0d;
		border-bottom: 4px solid #0c0c0d;
		overflow: hidden;
	}
	.mark {
		width: 3.25rem;
		height: 3.25rem;
	}
	.name {
		font-size: clamp(4.5rem, 24vw, 7rem);
		line-height: 0.8;
	}
	.hello {
		position: absolute;
		top: calc(1.5rem + var(--safe-top));
		right: 1rem;
		font-size: 2.25rem;
		color: #0c0c0d;
		text-shadow: 0.05em 0.05em 0 #f3efe6;
		transform: rotate(-7deg);
	}
	.form {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 1.5rem calc(1rem + var(--safe-right)) calc(1.5rem + var(--safe-bottom))
			calc(1rem + var(--safe-left));
	}
	.inner {
		width: 100%;
		max-width: 26rem;
	}
	@media (min-width: 900px) {
		.door {
			flex-direction: row;
		}
		.wall {
			flex: 1;
			padding: 3rem;
			border-bottom: 0;
			border-right: 4px solid #0c0c0d;
		}
		.mark {
			width: 5rem;
			height: 5rem;
		}
		.name {
			font-size: clamp(8rem, 17vw, 17rem);
		}
		.hello {
			top: 3rem;
			right: 3rem;
			font-size: clamp(3rem, 5vw, 5rem);
		}
		.form {
			flex: 1;
			justify-content: center;
			align-items: center;
			padding: 3rem;
		}
	}
</style>
