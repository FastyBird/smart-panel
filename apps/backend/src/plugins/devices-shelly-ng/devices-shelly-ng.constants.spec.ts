import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Device, Shelly3EmGen3, ShellyEmGen3, ShellyPro3Em, ShellyProEm } from 'shellies-ds9';

import { devicesSchema } from '../../spec/devices';

import { ComponentType, DESCRIPTORS } from './devices-shelly-ng.constants';

const findDescriptor = (model: string) =>
	Object.values(DESCRIPTORS).find((descriptor) => descriptor.models.includes(model.toUpperCase())) ?? null;

describe('Shelly NG energy meters', () => {
	// A model missing from DESCRIPTORS is rejected outright by
	// DeviceManagerService with "Provided device is not supported", which is what
	// made every EM model unadoptable.
	it.each([
		['SPEM-002CEBEU50', 'Shelly Pro EM'],
		['SPEM-003CEBEU', 'Shelly Pro 3EM'],
		['SPEM-003CEBEU400', 'Shelly Pro 3EM-400'],
		['SPEM-003CEBEU63', 'Shelly Pro 3EM-3CT63'],
		['S3EM-002CXCEU', 'Shelly EM Gen3'],
		['S3EM-003CXCEU63', 'Shelly 3EM-63 G3'],
	])('resolves %s to a descriptor', (model) => {
		expect(findDescriptor(model)).not.toBeNull();
	});

	it('keeps the model strings in step with the library', () => {
		// The descriptors reference the library constants directly, so this only
		// fails if a library upgrade renames a model we hard-coded above.
		expect([
			ShellyProEm.model.toUpperCase(),
			ShellyPro3Em.model.toUpperCase(),
			ShellyEmGen3.model.toUpperCase(),
			Shelly3EmGen3.model.toUpperCase(),
		]).toEqual(['SPEM-002CEBEU50', 'SPEM-003CEBEU', 'S3EM-002CXCEU', 'S3EM-003CXCEU63']);
	});

	it('declares the three-phase and per-phase components for the 3EM models', () => {
		for (const model of ['SPEM-003CEBEU', 'S3EM-003CXCEU63']) {
			const descriptor = findDescriptor(model);

			const byType = new Map(descriptor.components.map((component) => [component.type, component.ids]));

			// Both profiles are declared: the device reports only the set matching
			// the profile it currently runs.
			expect(byType.get(ComponentType.EM)).toEqual([0]);
			expect(byType.get(ComponentType.EM_DATA)).toEqual([0]);
			expect(byType.get(ComponentType.EM1)).toEqual([0, 1, 2]);
			expect(byType.get(ComponentType.EM1_DATA)).toEqual([0, 1, 2]);
		}
	});

	it('declares two meters and a relay for the single-phase models', () => {
		for (const model of ['SPEM-002CEBEU50', 'S3EM-002CXCEU']) {
			const descriptor = findDescriptor(model);

			const byType = new Map(descriptor.components.map((component) => [component.type, component.ids]));

			expect(byType.get(ComponentType.EM1)).toEqual([0, 1]);
			expect(byType.get(ComponentType.EM1_DATA)).toEqual([0, 1]);
			expect(byType.get(ComponentType.SWITCH)).toEqual([0]);
			expect(byType.has(ComponentType.EM)).toBe(false);
		}
	});

	// The delegate builds `${type}:${id}` and looks the component up by that key,
	// and DeviceManagerService compares the type against the key prefix the device
	// reports. A value whose casing differs from the library's therefore disables
	// the component on both paths, silently.
	it('declares every component type using the key the library reports', () => {
		const instantiate = (cls: unknown): string => {
			const ctor = cls as new (device: unknown, id: number) => { key: string };

			return new ctor({}, 0).key.split(':')[0];
		};

		const mismatches = new Set<string>();

		for (const descriptor of Object.values(DESCRIPTORS)) {
			for (const component of descriptor.components) {
				const key = instantiate(component.cls);

				if (key !== String(component.type)) {
					mismatches.add(`${String(component.type)} != ${key}`);
				}
			}
		}

		expect([...mismatches]).toEqual([]);
	});

	// SystemSpec types are only ever compared against other descriptors - nothing
	// looks a system component up by key - so ETHERNET declaring `ethernet` while
	// the library uses `eth` is inert. Pinned so a future use of it as a lookup
	// key has to confront this first.
	it('never looks a system component up by key', () => {
		const source = readFileSync(join(__dirname, 'delegates', 'shelly-device.delegate.ts'), 'utf8');

		expect(source).not.toContain('DESCRIPTOR.system');
	});

	it('only assigns categories whose device spec permits the electrical channels', () => {
		const models = [
			'SPEM-002CEBEU50',
			'SPEM-003CEBEU',
			'SPEM-003CEBEU400',
			'SPEM-003CEBEU63',
			'S3EM-002CXCEU',
			'S3EM-003CXCEU63',
		];

		for (const model of models) {
			const descriptor = findDescriptor(model);

			expect(descriptor.categories.length).toBeGreaterThan(0);

			for (const category of descriptor.categories) {
				const channels = (devicesSchema as Record<string, { channels: Record<string, unknown> }>)[category]?.channels;

				// A category that forbids these channels - `generic` does - produces a
				// device that fails spec validation once the meter reports.
				expect(Object.keys(channels ?? {})).toEqual(expect.arrayContaining(['electrical_power', 'electrical_energy']));
			}
		}
	});

	it('defaults the relay models to a category that keeps the relay mappable', () => {
		for (const model of ['SPEM-002CEBEU50', 'S3EM-002CXCEU']) {
			const descriptor = findDescriptor(model);

			// Discovery adopts categories[0]; SENSOR would leave switch:0 unmapped
			// because the sensor spec permits no outlet or switcher channel.
			expect(descriptor.categories[0]).toBe('switcher');
		}
	});

	it('declares only component ids the library device class exposes', () => {
		// Regression guard: verify declared component IDs actually exist in the library device classes.
		// For each model in each descriptor, construct the device and check that all
		// declared component IDs are present. This catches bugs like pm1:1 being
		// declared when the library only exposes pm1:0.
		//
		// Per plan §16 decision 2: fail only if declared IDs are missing; undeclared
		// components (issue #978 follow-up) are logged, not failed.

		// Known pre-existing drift (descriptor declares component IDs the library lacks).
		// These are tracked in issue #978 and NOT fixed in this epic per plan §16 decision 2.
		// The regression guard still reports them but allows them to pass the test suite.
		const knownDrift = new Set<string>([
			'SNDM-0013US:input:0', // SHELLYPLUSWALLDIMMER: input:0 not exposed by library
			'SNDM-00100WW:light:1', // SHELLYPLUSDIMMER: light:1 not exposed by library
			'SNSX-0043X:input:3', // SHELLYPLUSUNI: input:3 not exposed by library
		]);

		// Minimal stub RpcHandler for testing. We don't need real RPC; just the interface.
		class StubRpcHandler {
			on(): StubRpcHandler {
				return this;
			}

			off(): StubRpcHandler {
				return this;
			}

			get connected(): boolean {
				return false;
			}

			// eslint-disable-next-line @typescript-eslint/require-await
			async request<T>(): Promise<T> {
				throw new Error('Not implemented');
			}

			async destroy(): Promise<void> {
				// noop
			}

			resetReconnectInterval(): void {
				// noop
			}
		}

		const errors: string[] = [];
		const undeclaredComponents: string[] = [];
		const knownDriftFound: string[] = [];

		for (const descriptor of Object.values(DESCRIPTORS)) {
			for (const model of descriptor.models) {
				try {
					// Get the device class for this model from the library

					const DeviceClass = (Device as unknown as { getClass: (model: string) => unknown }).getClass(model);

					if (!DeviceClass) {
						errors.push(`Model ${model}: Device.getClass() returned undefined`);
						continue;
					}

					// Construct an instance with minimal info and our stub handler

					const instance = new (DeviceClass as new (
						info: { id: string; mac: string; model?: string },
						handler: unknown,
					) => {
						hasComponent: (key: string) => boolean;
						[Symbol.iterator]: () => IterableIterator<[string, unknown]>;
					})({ id: 'test-' + model, mac: '00:00:00:00:00:00', model }, new StubRpcHandler());

					// Check all declared IDs are present in the device
					for (const component of descriptor.components) {
						for (const id of component.ids) {
							const key = `${String(component.type)}:${id}`;

							if (!instance.hasComponent(key)) {
								const driftKey = `${model}:${key}`;

								if (knownDrift.has(driftKey)) {
									// Known drift, log it but don't fail (issue #978)
									knownDriftFound.push(
										`Model ${model}: descriptor declares ${key} but library device class does not expose it`,
									);
								} else {
									// New drift, fail the test
									errors.push(`Model ${model}: descriptor declares ${key} but library device class does not expose it`);
								}
							}
						}
					}

					// Log any components the device has that aren't declared (issue #978)
					for (const [key] of instance) {
						const [type, idStr] = key.split(':') as [string, string];
						const id = parseInt(idStr, 10);
						const isDeclared = descriptor.components.some((c) => String(c.type) === type && c.ids.includes(id));

						if (!isDeclared) {
							undeclaredComponents.push(`Model ${model}: library exposes ${key} (not in descriptor — issue #978)`);
						}
					}
				} catch (e) {
					errors.push(`Model ${model}: ${String(e)}`);
				}
			}
		}

		// Log known drift as informational (tracked in issue #978)
		if (knownDriftFound.length > 0) {
			console.warn('Known descriptor drift (issue #978, not fixed per plan §16 decision 2):', knownDriftFound);
		}

		// Log undeclared components as informational (follow-up #978)
		if (undeclaredComponents.length > 0) {
			console.warn('Components exposed by library but not declared in descriptor (issue #978):', undeclaredComponents);
		}

		// Fail only if there are NEW declared-but-absent issues (not in knownDrift allowlist)
		expect(errors).toEqual([]);
	});
});
