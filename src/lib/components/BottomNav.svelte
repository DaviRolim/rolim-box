<script lang="ts">
	import { page } from '$app/stores';

	interface NavItem {
		label: string;
		path: string;
		icon: string;
		disabled?: boolean;
		disabledMessage?: string;
	}

	const navItems: NavItem[] = [
		{
			label: 'Home',
			path: '/dashboard',
			icon: 'home'
		},
		{
			label: 'Workouts',
			path: '/workouts',
			icon: 'workouts'
		},
		{
			label: 'Timers',
			path: '/timers',
			icon: 'timers',
			disabled: true,
			disabledMessage: 'Coming in Phase 3'
		}
	];

	function isActive(itemPath: string): boolean {
		const currentPath = $page.url.pathname;
		if (itemPath === '/dashboard') {
			return currentPath === '/dashboard';
		}
		return currentPath.startsWith(itemPath);
	}
</script>

<nav class="bottom-nav" aria-label="Main navigation">
	<div class="nav-container">
		{#each navItems as item, index}
			{@const active = isActive(item.path)}
			<a
				href={item.disabled ? undefined : item.path}
				class="nav-item"
				class:active
				class:disabled={item.disabled}
				aria-label={item.label}
				aria-current={active ? 'page' : undefined}
				aria-disabled={item.disabled}
				title={item.disabled ? item.disabledMessage : item.label}
				style="--item-index: {index}"
			>
				<!-- Icon -->
				<div class="icon-container">
					{#if item.icon === 'home'}
						<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<path
								d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
								stroke-width="2"
								stroke-linecap="square"
								stroke-linejoin="miter"
							/>
							<polyline points="9 22 9 12 15 12 15 22" stroke-width="2" stroke-linejoin="miter" />
						</svg>
					{:else if item.icon === 'workouts'}
						<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<rect
								x="2"
								y="7"
								width="20"
								height="10"
								stroke-width="2"
								stroke-linecap="square"
								stroke-linejoin="miter"
							/>
							<line
								x1="8"
								y1="3"
								x2="8"
								y2="7"
								stroke-width="2"
								stroke-linecap="square"
							/>
							<line
								x1="16"
								y1="3"
								x2="16"
								y2="7"
								stroke-width="2"
								stroke-linecap="square"
							/>
							<line
								x1="8"
								y1="17"
								x2="8"
								y2="21"
								stroke-width="2"
								stroke-linecap="square"
							/>
							<line
								x1="16"
								y1="17"
								x2="16"
								y2="21"
								stroke-width="2"
								stroke-linecap="square"
							/>
							<circle cx="12" cy="12" r="2" fill="currentColor" />
						</svg>
					{:else if item.icon === 'timers'}
						<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<circle
								cx="12"
								cy="13"
								r="9"
								stroke-width="2"
								stroke-linecap="square"
								stroke-linejoin="miter"
							/>
							<polyline
								points="12 13 12 8"
								stroke-width="2"
								stroke-linecap="square"
								stroke-linejoin="miter"
							/>
							<polyline
								points="12 13 15 15"
								stroke-width="2"
								stroke-linecap="square"
								stroke-linejoin="miter"
							/>
							<line x1="12" y1="2" x2="12" y2="4" stroke-width="2" stroke-linecap="square" />
							<line x1="8" y1="3" x2="10" y2="5" stroke-width="2" stroke-linecap="square" />
							<line x1="16" y1="3" x2="14" y2="5" stroke-width="2" stroke-linecap="square" />
						</svg>
					{/if}

					{#if active}
						<div class="active-marker"></div>
					{/if}

					{#if item.disabled}
						<div class="disabled-overlay"></div>
					{/if}
				</div>

				<!-- Label -->
				<span class="label">{item.label}</span>

				{#if active}
					<div class="active-accent"></div>
				{/if}
			</a>
		{/each}
	</div>

	<!-- Decorative elements -->
	<div class="nav-edge nav-edge-left"></div>
	<div class="nav-edge nav-edge-right"></div>
</nav>

<style>
	/* ============================================================================
	   ATHLETIC BRUTALISM BOTTOM NAVIGATION
	   Design Language:
	   - Sharp, angular geometric forms
	   - Bold borders and hard edges
	   - Purple/Pink brand colors with high contrast
	   - Skewed elements and diagonal accents
	   - Strong typographic hierarchy
	   - Industrial, raw aesthetic with athletic energy
	   ============================================================================ */

	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 100;
		background: #1a1a1a;
		border-top: 3px solid #2a2a2a;
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		/* Safe area for mobile devices with notches/home indicators */
		padding-bottom: env(safe-area-inset-bottom);
	}

	.bottom-nav::before {
		content: '';
		position: absolute;
		top: -3px;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, #e91e8c 0%, #6e489f 50%, #e91e8c 100%);
		background-size: 200% 100%;
		animation: gradientShift 8s ease infinite;
	}

	@keyframes gradientShift {
		0%,
		100% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
	}

	.nav-container {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		max-width: 600px;
		margin: 0 auto;
		position: relative;
	}

	/* ============================================================================
	   NAV ITEMS
	   ============================================================================ */

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.875rem 0.5rem;
		text-decoration: none;
		color: #666666;
		position: relative;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		min-height: 64px; /* Ensures touch target >= 44px with padding */
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		/* Staggered entrance animation */
		animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: calc(var(--item-index) * 0.1s);
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.nav-item::before {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 2px;
		background: currentColor;
		transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.nav-item:hover:not(.disabled) {
		color: #8b7ab8;
		transform: translateY(-2px);
	}

	.nav-item:hover:not(.disabled)::before {
		width: 60%;
	}

	.nav-item:active:not(.disabled) {
		transform: translateY(0);
	}

	/* Active State */
	.nav-item.active {
		color: #e91e8c;
	}

	.nav-item.active::before {
		width: 80%;
		background: linear-gradient(90deg, #e91e8c 0%, #6e489f 100%);
	}

	/* Disabled State */
	.nav-item.disabled {
		color: #333333;
		cursor: not-allowed;
		opacity: 0.5;
	}

	.nav-item.disabled:hover {
		transform: none;
	}

	/* ============================================================================
	   ICON CONTAINER
	   ============================================================================ */

	.icon-container {
		position: relative;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid currentColor;
		background: transparent;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.nav-item:hover:not(.disabled) .icon-container {
		transform: rotate(-5deg) scale(1.1);
		border-width: 2px;
	}

	.nav-item.active .icon-container {
		background: rgba(233, 30, 140, 0.15);
		border-color: #e91e8c;
		transform: rotate(-5deg);
		box-shadow:
			0 0 0 2px rgba(233, 30, 140, 0.2),
			0 4px 12px rgba(233, 30, 140, 0.3);
	}

	.nav-item.disabled .icon-container {
		border-style: dashed;
		border-color: #333333;
	}

	.icon {
		width: 18px;
		height: 18px;
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.nav-item.active .icon {
		animation: iconPulse 2s ease-in-out infinite;
	}

	@keyframes iconPulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.05);
		}
	}

	/* Active Marker */
	.active-marker {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 6px;
		height: 6px;
		background: #6e489f;
		transform: rotate(45deg);
		animation: markerGlow 2s ease-in-out infinite;
	}

	@keyframes markerGlow {
		0%,
		100% {
			box-shadow: 0 0 4px rgba(110, 72, 159, 0.6);
		}
		50% {
			box-shadow: 0 0 8px rgba(110, 72, 159, 1);
		}
	}

	/* Disabled Overlay */
	.disabled-overlay {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			45deg,
			transparent,
			transparent 2px,
			rgba(26, 26, 26, 0.8) 2px,
			rgba(26, 26, 26, 0.8) 4px
		);
		pointer-events: none;
	}

	/* ============================================================================
	   LABEL
	   ============================================================================ */

	.label {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		line-height: 1;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
	}

	.nav-item:hover:not(.disabled) .label {
		letter-spacing: 0.12em;
	}

	.nav-item.active .label {
		color: #ffffff;
		text-shadow: 0 0 8px rgba(233, 30, 140, 0.5);
	}

	/* ============================================================================
	   ACTIVE ACCENT
	   ============================================================================ */

	.active-accent {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%) skewX(-10deg);
		width: 40px;
		height: 3px;
		background: linear-gradient(90deg, #e91e8c 0%, #6e489f 100%);
		animation: accentPulse 2s ease-in-out infinite;
	}

	@keyframes accentPulse {
		0%,
		100% {
			opacity: 1;
			width: 40px;
		}
		50% {
			opacity: 0.7;
			width: 50px;
		}
	}

	/* ============================================================================
	   DECORATIVE EDGES
	   ============================================================================ */

	.nav-edge {
		position: absolute;
		top: -3px;
		width: 0;
		height: 0;
		border-style: solid;
		animation: edgeFade 1s ease-in-out infinite alternate;
	}

	.nav-edge-left {
		left: 0;
		border-width: 0 0 20px 20px;
		border-color: transparent transparent #e91e8c transparent;
		animation-delay: 0s;
	}

	.nav-edge-right {
		right: 0;
		border-width: 0 20px 20px 0;
		border-color: transparent #6e489f transparent transparent;
		animation-delay: 0.5s;
	}

	@keyframes edgeFade {
		from {
			opacity: 0.4;
		}
		to {
			opacity: 0.8;
		}
	}

	/* ============================================================================
	   RESPONSIVE DESIGN
	   ============================================================================ */

	@media (min-width: 640px) {
		.nav-item {
			padding: 1rem 0.75rem;
		}

		.icon-container {
			width: 32px;
			height: 32px;
		}

		.icon {
			width: 20px;
			height: 20px;
		}

		.label {
			font-size: 0.75rem;
		}
	}

	@media (min-width: 768px) {
		.nav-container {
			max-width: 800px;
		}
	}

	/* ============================================================================
	   ACCESSIBILITY & REDUCED MOTION
	   ============================================================================ */

	@media (prefers-reduced-motion: reduce) {
		.nav-item,
		.icon,
		.icon-container,
		.label,
		.active-marker,
		.active-accent,
		.nav-edge,
		.bottom-nav::before {
			animation: none !important;
			transition-duration: 0.01ms !important;
		}

		.nav-item {
			opacity: 1 !important;
			transform: none !important;
		}
	}

	/* Focus visible for keyboard navigation */
	.nav-item:focus-visible {
		outline: 2px solid #e91e8c;
		outline-offset: 2px;
	}

	@media (prefers-contrast: high) {
		.bottom-nav {
			border-top-width: 4px;
		}

		.icon-container {
			border-width: 3px;
		}

		.nav-item.active .icon-container {
			border-width: 3px;
		}
	}

	/* Dark mode support (already dark, but ensuring consistency) */
	@media (prefers-color-scheme: light) {
		/* Keep dark theme for RolimBox brand identity */
	}
</style>
