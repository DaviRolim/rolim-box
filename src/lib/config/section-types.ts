import type { SectionType } from '$lib/types/wod';
import type { IconName } from '$lib/components/ui/icons';
import { t } from '$lib/i18n';

const icons: Record<SectionType, IconName> = {
	warmup: 'flame',
	skill: 'target',
	wod: 'barbell',
	cooldown: 'wind',
	stretches: 'stretch',
	custom: 'shapes'
};

/**
 * How each kind of section is named on the board and in the editor. `label` is read in the
 * active language every time, so it follows the EN | PT switch.
 */
export const sectionTypes = Object.fromEntries(
	(Object.keys(icons) as SectionType[]).map((type) => [
		type,
		{
			get label() {
				return t.format.sectionTypes[type];
			},
			icon: icons[type]
		}
	])
) as Record<SectionType, { readonly label: string; icon: IconName }>;
