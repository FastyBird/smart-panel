import { validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { VIRTUAL_MAX_COMPATIBILITY_CANDIDATES } from '../devices-virtual.constants';

import { CompatibilityDto } from './compatibility-request.dto';

/**
 * The preview resolves every candidate the request carries: a property lookup plus a multi-hop
 * ownership resolution each, run one after another on the connection the whole app shares. The
 * route's request-count throttle counts requests, not the work inside one, so without a bound a
 * single accepted body turns into thousands of serialized queries that starve everything else.
 */
describe('candidate count on CompatibilityDto', () => {
	const candidates = (count: number): Record<string, string>[] =>
		Array.from({ length: count }, () => ({
			spec_channel: ChannelCategory.LIGHT,
			spec_property: PropertyCategory.ON,
			source_property: '11111111-1111-4111-8111-111111111111',
		}));

	const violationsFor = async (count: number): Promise<string[]> => {
		const dto = toInstance(CompatibilityDto, {
			category: DeviceCategory.LIGHTING,
			candidates: candidates(count),
		});

		return (await validate(dto)).map((error) => error.property);
	};

	// Generous against the widest category — `sensor` expands to around a hundred slots — so no
	// genuine request from the wizard meets it.
	it('accepts a request carrying the maximum number of candidates', async () => {
		await expect(violationsFor(VIRTUAL_MAX_COMPATIBILITY_CANDIDATES)).resolves.toEqual([]);
	});

	it('refuses one candidate more', async () => {
		await expect(violationsFor(VIRTUAL_MAX_COMPATIBILITY_CANDIDATES + 1)).resolves.toContain('candidates');
	});

	// The bound is an addition to the existing constraints, not a replacement: class-validator replaces
	// a redeclared property's decorators rather than merging them, and an empty array must still be
	// refused for the reason it always was.
	it('still refuses an empty candidates array', async () => {
		await expect(violationsFor(0)).resolves.toContain('candidates');
	});
});
