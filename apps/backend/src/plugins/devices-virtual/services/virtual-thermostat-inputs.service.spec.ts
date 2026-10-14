import { DataSource } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { VirtualThermostatSourceEntity } from '../entities/virtual-thermostat.entity';

import { ThermostatInputBinding, VirtualThermostatInputsService } from './virtual-thermostat-inputs.service';

describe('thermostat input freshness frame', () => {
	const now = new Date('2026-10-14T12:00:00Z');
	const binding = (
		role: 'ambient' | 'floor' | 'contact',
		property: boolean,
		compatible = true,
	): ThermostatInputBinding => ({
		binding: {
			id: role,
			role,
			sourcePropertyId: property ? role : null,
			maximumAgeSeconds: 60,
			openValue: true,
			closedValue: false,
		} as VirtualThermostatSourceEntity,
		property: property ? ({ id: role, channel: { device: { enabled: true } } } as ChannelPropertyEntity) : null,
		compatible,
		producerRevision: null,
	});
	it('retains stale metadata and distinguishes missing and incompatible configured bindings without a value fallback', () => {
		const values = {
			readQualifiedSample: jest.fn(() => null),
			readSampleFreshness: jest.fn(() => ({
				status: 'stale',
				sampled_at: new Date(now.getTime() - 120000).toISOString(),
				age_seconds: 120,
				expires_at: new Date(now.getTime() - 60000).toISOString(),
				reasons: [],
			})),
		};
		const service = new VirtualThermostatInputsService({} as DataSource, values as unknown as PropertyValueService);
		const frame = service.read(
			[binding('ambient', true), binding('floor', false), binding('contact', true, false)],
			now.getTime(),
		);
		expect(frame.ambient).toBeNull();
		expect(frame.floor).toBeNull();
		expect(frame.contacts[0].value).toBeNull();
		expect(frame.inputs).toEqual([
			expect.objectContaining({
				role: 'ambient',
				status: 'stale',
				age_seconds: 120,
				maximum_age_seconds: 60,
				quality: 'unavailable',
			}),
			expect.objectContaining({ role: 'floor', status: 'missing', sampled_at: null }),
			expect.objectContaining({ role: 'contact', status: 'incompatible', sampled_at: null }),
		]);
		expect(values.readSampleFreshness).toHaveBeenCalledTimes(1);
	});
	it('does not label a changed derived producer revision fresh', () => {
		const values = {
			readQualifiedSample: () => ({ value: 21, quality: 'good', revision: 1 }),
			readSampleFreshness: () => ({
				status: 'fresh',
				sampled_at: now.toISOString(),
				age_seconds: 0,
				expires_at: null,
				reasons: [],
			}),
		};
		const service = new VirtualThermostatInputsService({} as DataSource, values as unknown as PropertyValueService);
		const frame = service.read([{ ...binding('ambient', true), producerRevision: 2 }], now.getTime());
		expect(frame.ambient).toBeNull();
		expect(frame.inputs[0]).toMatchObject({
			status: 'unavailable',
			quality: 'unavailable',
			reasons: ['producer_revision_mismatch'],
		});
	});
});
