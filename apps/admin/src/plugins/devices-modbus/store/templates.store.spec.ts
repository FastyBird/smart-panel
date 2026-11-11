import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useModbusTemplates } from './templates.store';

const get = vi.fn();
const post = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: get, POST: post } }),
		getErrorReason: (_error: unknown, fallback: string) => (_error as { reason?: string })?.reason ?? fallback,
	};
});

const wireCatalog = {
	templates: [
		{
			id: 'acme-relay',
			name: 'Acme relay',
			manufacturer: 'Acme',
			model: 'R1',
			description: null,
			category: 'switcher',
			source: 'builtin',
			revision: 'abc123',
			path: 'builtin/acme.yaml',
			overrides_builtin: false,
			channel_count: 1,
			point_count: 2,
			defaults: {
				framing: 'tcp',
				port: 502,
				unit_id: { default: 1, min: 1, max: 247, hint: null },
				poll_interval_ms: 1000,
				byte_order: 'big',
				word_order: 'big',
			},
		},
	],
	files: [{ source: 'user', path: 'user/broken.yaml', loaded: 0, errors: ['Unexpected token'], warnings: [] }],
};

describe('Modbus templates store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('fetch returns the camelCase catalog and keeps file errors', async () => {
		get.mockResolvedValue({ data: { data: wireCatalog }, response: { status: 200 } });
		const store = useModbusTemplates();

		const catalog = await store.fetch();

		expect(get).toHaveBeenCalledWith('/plugins/devices-modbus/templates');
		expect(catalog.templates[0]).toMatchObject({
			id: 'acme-relay',
			overridesBuiltin: false,
			channelCount: 1,
			pointCount: 2,
			defaults: { framing: 'tcp', pollIntervalMs: 1000, byteOrder: 'big', unitId: { default: 1, min: 1, max: 247, hint: null } },
		});
		expect(catalog.files).toEqual([{ source: 'user', path: 'user/broken.yaml', loaded: 0, errors: ['Unexpected token'], warnings: [] }]);
		expect(store.catalog).toEqual(catalog);
	});

	it('fetch surfaces the backend reason on failure', async () => {
		get.mockResolvedValue({ error: { reason: 'Templates unavailable' }, response: { status: 500 } });
		const store = useModbusTemplates();

		await expect(store.fetch()).rejects.toMatchObject({ message: 'Templates unavailable', code: 500 });
	});

	it('reload posts the reload route and replaces the catalog', async () => {
		post.mockResolvedValue({ data: { data: { ...wireCatalog, files: [] } }, response: { status: 200 } });
		const store = useModbusTemplates();

		const catalog = await store.reload();

		expect(post).toHaveBeenCalledWith('/plugins/devices-modbus/templates/reload');
		expect(catalog.files).toEqual([]);
		expect(store.catalog?.templates).toHaveLength(1);
	});

	it('an older fetch that finishes after a reload does not replace the reloaded catalog', async () => {
		let finishFetch!: () => void;
		get.mockImplementationOnce(
			() => new Promise((resolve) => (finishFetch = () => resolve({ data: { data: wireCatalog }, response: { status: 200 } })))
		);
		post.mockResolvedValue({ data: { data: { ...wireCatalog, templates: [] } }, response: { status: 200 } });
		const store = useModbusTemplates();

		const pending = store.fetch();
		await store.reload();

		expect(store.catalog?.templates).toEqual([]);

		finishFetch();
		const fetched = await pending;

		expect(fetched.templates).toHaveLength(1);
		expect(store.catalog?.templates).toEqual([]);
	});

	it('preview passes the overrides in the data wrapper and keeps channels, properties and bindings', async () => {
		post.mockResolvedValue({
			data: {
				data: {
					template_id: 'acme-relay',
					template_revision: 'abc123',
					category: 'switcher',
					manufacturer: 'Acme',
					model: 'R1',
					endpoint_defaults: { framing: 'tcp', port: 502 },
					unit_id: 7,
					poll_interval_ms: 500,
					byte_order: 'big',
					word_order: 'little',
					max_read_registers: null,
					max_read_bits: null,
					max_read_gap: null,
					channels: [
						{
							identifier: 'switch',
							name: 'Switch',
							category: 'switcher',
							properties: [
								{
									category: 'on',
									data_type: 'bool',
									permissions: ['read_write'],
									read: { register_type: 'coil', address: 0, data_type: 'bool' },
									write: { register_type: 'coil', address: 0, data_type: 'bool', write_function: 'single' },
								},
							],
						},
					],
				},
			},
			response: { status: 200 },
		});
		const store = useModbusTemplates();

		const preview = await store.preview('acme-relay', { unitId: 7, pollIntervalMs: 500 });

		expect(post).toHaveBeenCalledWith('/plugins/devices-modbus/templates/{id}/preview', {
			params: { path: { id: 'acme-relay' } },
			body: { data: { unit_id: 7, poll_interval_ms: 500 } },
		});
		expect(preview).toMatchObject({
			templateId: 'acme-relay',
			templateRevision: 'abc123',
			endpointDefaults: { framing: 'tcp', port: 502 },
			unitId: 7,
			wordOrder: 'little',
		});
		expect(preview.channels[0]?.properties[0]).toMatchObject({
			dataType: 'bool',
			read: { registerType: 'coil', address: 0, dataType: 'bool' },
			write: { registerType: 'coil', writeFunction: 'single' },
		});
	});

	it('preview sends an empty data object when no overrides are given', async () => {
		post.mockResolvedValue({ error: { reason: 'Unknown template' }, response: { status: 404 } });
		const store = useModbusTemplates();

		await expect(store.preview('missing')).rejects.toThrow('Unknown template');
		expect(post.mock.calls[0]?.[1].body).toEqual({ data: {} });
	});
});
