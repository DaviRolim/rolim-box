<script lang="ts">
	import { formatDayMonth } from '$lib/date';
	import { type ExerciseRankingsResponse, type UnitPreference } from '$lib/types/pr';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import RankRow from './RankRow.svelte';
	import { CATEGORY_LABELS, MEASUREMENT_LABELS, athleteName, prParts } from './pr-format';

	/** The whole box ranked on one exercise. */
	interface Props {
		open: boolean;
		data: ExerciseRankingsResponse | null;
		unitPreference: UnitPreference;
		onClose: () => void;
	}

	let { open = $bindable(), data, unitPreference, onClose }: Props = $props();

	const missing = $derived(data ? data.totalMembers - data.membersWithPR : 0);
</script>

<Sheet
	bind:open
	title={data?.exercise.name ?? 'Ranking'}
	legend={data
		? `Ranking · ${CATEGORY_LABELS[data.exercise.category]} · ${MEASUREMENT_LABELS[data.exercise.measurementType]}`
		: undefined}
	onclose={onClose}
>
	{#if data}
		{#if data.rankings.length === 0}
			<div class="border-2 border-line-strong px-4 py-6">
				<h3 class="display text-[2rem]">Open podium</h3>
				<p class="mt-2 text-lg leading-snug text-dim">
					Nobody in the box has logged this one yet. First to log it takes first place.
				</p>
			</div>
		{:else}
			<div class="module-head border-t-2 border-ink">
				<span>{data.membersWithPR} of {data.totalMembers} logged</span>
				<span>{MEASUREMENT_LABELS[data.exercise.measurementType]}</span>
			</div>
			<ol>
				{#each data.rankings as entry (entry.userId)}
					{@const parts = prParts(entry.value, data.exercise.measurementType, unitPreference)}
					<li>
						<RankRow
							rank={entry.rank}
							name={athleteName(entry.email)}
							you={entry.userId === data.currentUserId}
							figure={parts.figure}
							unit={parts.unit}
							sub={formatDayMonth(entry.date)}
						/>
					</li>
				{/each}
			</ol>

			{#if missing > 0}
				<p class="mt-4 border-t border-line pt-3 legend text-mute">
					{missing}
					{missing === 1 ? 'athlete has' : 'athletes have'} not logged this one yet
				</p>
			{/if}
		{/if}
	{/if}
</Sheet>
