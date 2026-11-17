import { describe, expect, it } from 'vitest';

import type { GroupProfile } from '../composables/useGroupCatalog';

import type { GroupCategory } from './group-authoring.types';
import { groupCapabilityColumns, updateGroupCapabilitySelection } from './group-capability-presentation';

const categories = (...values: string[]) => values as GroupCategory[];
const rgb = categories('color_red', 'color_green', 'color_blue');

describe('group capability selection', () => {
	it('treats RGB and hue/saturation as atomic controls when toggling any component', () => {
		const available = categories('on', ...rgb, 'hue', 'saturation');
		expect(updateGroupCapabilitySelection(categories('on'), categories('on', 'color_red'), available, categories('on'))).toEqual(
			categories('on', ...rgb)
		);
		expect(
			updateGroupCapabilitySelection(categories('on', ...rgb), categories('on', 'color_red', 'color_blue'), available, categories('on'))
		).toEqual(categories('on'));
		expect(updateGroupCapabilitySelection(categories('on'), categories('on', 'hue'), available, categories('on'))).toEqual(
			categories('on', 'hue', 'saturation')
		);
		expect(updateGroupCapabilitySelection(categories('on', 'hue', 'saturation'), categories('on', 'hue'), available, categories('on'))).toEqual(
			categories('on')
		);
	});

	it('preserves mandatory controls and drops controls absent from the current backend contract', () => {
		expect(
			updateGroupCapabilitySelection(
				categories('on', 'brightness'),
				categories('brightness', 'speed'),
				categories('on', 'brightness'),
				categories('on')
			)
		).toEqual(categories('on', 'brightness'));
	});

	it('keeps unsupported columns visible after supported columns disappear from the intersection', () => {
		const columns = groupCapabilityColumns('light' as GroupProfile, categories('on', 'brightness', 'mode'));
		expect(columns).toContain('color_red');
		expect(columns.at(-1)).toBe('mode');
		expect(new Set(columns).size).toBe(columns.length);
	});
});
