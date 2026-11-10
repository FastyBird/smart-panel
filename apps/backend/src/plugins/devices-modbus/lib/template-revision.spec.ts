import { ModbusTemplate } from '../templates/modbus-template.types';

import { modbusTemplateRevision } from './template-revision';

const template = (base = 4): ModbusTemplate => ({
	id: 'sample',
	name: 'Sample',
	manufacturer: 'Acme',
	model: 'S1',
	category: 'input_controller',
	channels: [
		{
			category: 'binary_input',
			identifier: 'di',
			name: 'DI',
			properties: [
				{
					category: 'state',
					read: { register_type: 'holding_register', address: { base }, data_type: 'bool' },
				} as never,
			],
		},
	],
});

describe('modbusTemplateRevision', () => {
	it('is equal for the same template with keys in a different order', () => {
		const a = template();
		const b = JSON.parse(
			JSON.stringify({
				channels: a.channels,
				category: a.category,
				model: a.model,
				manufacturer: a.manufacturer,
				name: a.name,
				id: a.id,
			}),
		) as ModbusTemplate;

		expect(modbusTemplateRevision(b)).toBe(modbusTemplateRevision(a));
	});

	it('differs when address.base changes', () => {
		expect(modbusTemplateRevision(template(5))).not.toBe(modbusTemplateRevision(template(4)));
	});

	it('is 16 lowercase hex characters', () => {
		expect(modbusTemplateRevision(template())).toMatch(/^[0-9a-f]{16}$/);
	});
});
