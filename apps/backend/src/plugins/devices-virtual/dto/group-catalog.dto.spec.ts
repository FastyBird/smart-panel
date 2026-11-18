import { validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { PropertyCategory } from '../../../modules/devices/devices.constants';

import { GroupCatalogDto } from './group-catalog.dto';

describe('group catalog exclusions', () => {
	it('accepts optional snake-case exclusions without changing explicit requirements', async () => {
		const dto = toInstance(GroupCatalogDto, {
			capabilities: [PropertyCategory.ON],
			excluded_capabilities: [PropertyCategory.BRIGHTNESS],
		});
		expect(dto.excludedCapabilities).toEqual([PropertyCategory.BRIGHTNESS]);
		expect(dto.capabilities).toEqual([PropertyCategory.ON]);
		expect(await validate(dto)).toEqual([]);
		expect(await validate(toInstance(GroupCatalogDto, {}))).toEqual([]);
	});

	it.each([
		['not-a-control'],
		[PropertyCategory.BRIGHTNESS, PropertyCategory.BRIGHTNESS],
		Object.values(PropertyCategory).slice(0, 9),
	])('rejects invalid, duplicate or excessive exclusions: %j', async (...excluded) => {
		const errors = await validate(toInstance(GroupCatalogDto, { excluded_capabilities: excluded }));
		expect(errors.map(({ property }) => property)).toContain('excludedCapabilities');
	});
});
