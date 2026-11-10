import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ModbusTemplatesService } from '../services/modbus-templates.service';

import { ModbusTemplatesController } from './modbus-templates.controller';

describe('ModbusTemplatesController', () => {
	const loaded = {
		template: {
			id: 'qingjun-32di',
			name: 'Qingjun 32DI',
			manufacturer: 'Qingjun',
			model: '32DI',
			category: 'sensor',
			defaults: { unit_id: { default: 1, min: 1, max: 31, hint: 'DIP switches' } },
			channels: [],
		},
		revision: 'abcdef0123456789',
		source: 'builtin',
		path: '/definitions/qingjun.yaml',
		overridesBuiltin: false,
		channelCount: 32,
		pointCount: 32,
	};
	const catalog = {
		templates: [loaded],
		files: [{ source: 'builtin', path: '/definitions/qingjun.yaml', loaded: 1, errors: [], warnings: [] }],
	};

	let service: { catalog: jest.Mock; get: jest.Mock; preview: jest.Mock; reload: jest.Mock };
	let controller: ModbusTemplatesController;

	beforeEach(() => {
		service = {
			catalog: jest.fn().mockReturnValue(catalog),
			get: jest.fn().mockReturnValue(loaded),
			preview: jest.fn().mockReturnValue({
				template_id: 'qingjun-32di',
				template_revision: 'abcdef0123456789',
				category: 'sensor',
				manufacturer: 'Qingjun',
				model: '32DI',
				unit_id: 2,
				poll_interval_ms: 200,
				channels: [],
			}),
			reload: jest.fn().mockReturnValue(catalog),
		};
		controller = new ModbusTemplatesController(service as unknown as ModbusTemplatesService);
	});

	it.each(['findAll', 'findOne', 'preview', 'reload'] as const)('restricts %s to owners and admins', (handler) => {
		expect(Reflect.getMetadata(ROLES_KEY, ModbusTemplatesController.prototype[handler])).toEqual([
			UserRole.OWNER,
			UserRole.ADMIN,
		]);
	});

	it('lists the catalog with defaults falling back to the plugin defaults', () => {
		const response = controller.findAll();

		expect(response.data.templates).toHaveLength(1);
		expect(response.data.files).toHaveLength(1);
		expect(response.data.templates[0]).toMatchObject({
			id: 'qingjun-32di',
			revision: 'abcdef0123456789',
			description: null,
			channel_count: 32,
			point_count: 32,
			overrides_builtin: false,
			defaults: {
				framing: 'tcp',
				port: 502,
				unit_id: { default: 1, min: 1, max: 31, hint: 'DIP switches' },
				poll_interval_ms: 1000,
				byte_order: 'big',
				word_order: 'big',
			},
		});
	});

	it('returns one template summary', () => {
		const response = controller.findOne('qingjun-32di');

		expect(service.get).toHaveBeenCalledWith('qingjun-32di');
		expect(response.data.id).toBe('qingjun-32di');
	});

	it('passes the body data to the service and wraps the preview', () => {
		const response = controller.preview('qingjun-32di', { data: { unit_id: 2, poll_interval_ms: 200 } });

		expect(service.preview).toHaveBeenCalledWith('qingjun-32di', { unit_id: 2, poll_interval_ms: 200 });
		expect(response.data).toMatchObject({
			template_id: 'qingjun-32di',
			template_revision: 'abcdef0123456789',
			unit_id: 2,
			poll_interval_ms: 200,
			byte_order: null,
			endpoint_defaults: { framing: 'tcp', port: 502 },
			channels: [],
		});
	});

	it('reloads and returns the catalog', () => {
		const response = controller.reload();

		expect(service.reload).toHaveBeenCalledTimes(1);
		expect(response.data.templates[0].id).toBe('qingjun-32di');
	});
});
