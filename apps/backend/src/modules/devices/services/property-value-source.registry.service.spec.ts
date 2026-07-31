/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';

import { ChannelPropertyEntity } from '../entities/devices.entity';

import { IPropertyValueSource, PropertyValueSourceRegistryService } from './property-value-source.registry.service';

describe('PropertyValueSourceRegistryService', () => {
	let service: PropertyValueSourceRegistryService;

	const property = (id: string, type: string): ChannelPropertyEntity =>
		({ id, type }) as unknown as ChannelPropertyEntity;

	const source: IPropertyValueSource = {
		getType: () => 'mock-virtual',
		resolve: (p) => (p.id === 'linked' ? 'source-id' : null),
	};

	beforeEach(() => {
		service = new PropertyValueSourceRegistryService();
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('falls back to the property id when no source is registered', () => {
		expect(service.resolve(property('own', 'mock-virtual'))).toBe('own');
		expect(service.isProjected(property('own', 'mock-virtual'))).toBe(false);
	});

	it('resolves to the source key for a registered type', () => {
		service.register(source);

		expect(service.resolve(property('linked', 'mock-virtual'))).toBe('source-id');
		expect(service.isProjected(property('linked', 'mock-virtual'))).toBe(true);
	});

	it('falls back to the property id when the source returns null', () => {
		service.register(source);

		expect(service.resolve(property('owned', 'mock-virtual'))).toBe('owned');
		expect(service.isProjected(property('owned', 'mock-virtual'))).toBe(false);
	});

	it('ignores properties of an unregistered type', () => {
		service.register(source);

		expect(service.resolve(property('linked', 'shelly-ng'))).toBe('linked');
	});

	it('does not register a duplicate type', () => {
		expect(service.register(source)).toBe(true);
		expect(service.register(source)).toBe(false);
		expect(service.list()).toEqual(['mock-virtual']);
	});
});
