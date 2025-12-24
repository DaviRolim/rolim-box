<script lang="ts">
	import { type Snippet } from 'svelte';

	let {
		children,
		variant = 'primary',
		size = 'md',
		class: className = '',
		onclick,
		...props
	} = $props<{
		children: Snippet;
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
		size?: 'xs' | 'sm' | 'md' | 'lg';
		class?: string;
		onclick?: () => void;
		[key: string]: any;
	}>();

	const variants: Record<string, string> = {
		primary:
			'bg-accent-600 text-white hover:bg-accent-500 hover:shadow-[0_0_20px_rgba(219,39,119,0.5)] border-transparent',
		secondary: 'bg-primary-700 text-white hover:bg-primary-600 border-transparent',
		outline: 'bg-transparent border-accent-500 text-accent-400 hover:bg-accent-500/10',
		ghost:
			'bg-transparent text-text-secondary hover:text-white hover:bg-white/5 border-transparent',
		danger: 'bg-error/10 text-error border-error/50 hover:bg-error/20'
	};

	const sizes: Record<string, string> = {
		xs: 'px-2 py-1 text-[10px] font-bold',
		sm: 'px-3 py-1.5 text-sm font-medium',
		md: 'px-5 py-2.5 text-base font-medium',
		lg: 'px-8 py-3.5 text-lg font-semibold'
	};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<button
	class="
    relative inline-flex items-center justify-center gap-2 rounded-xl border transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-50
    {variants[variant]}
    {sizes[size]}
    {className}
  "
	{onclick}
	{...props}
>
	{@render children()}
</button>
