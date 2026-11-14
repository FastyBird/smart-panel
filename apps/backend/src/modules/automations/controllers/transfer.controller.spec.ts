import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
	AUTOMATION_GRAPH_INVALID_ERROR_CODE,
	AUTOMATION_IMPORT_INVALID_ERROR_CODE,
	AutomationMode,
} from '../automations.constants';
import {
	AutomationsGraphValidationException,
	AutomationsImportException,
	AutomationsNotFoundException,
} from '../automations.exceptions';
import { AutomationTransferService } from '../services/automation-transfer.service';

import { AutomationTransferController } from './transfer.controller';

const ID = 'a0000000-0000-4000-8000-000000000000';
const GRAPH = { version: 1, nodes: [], edges: [] };

describe('AutomationTransferController', () => {
	let exportAutomation: jest.Mock;
	let prepareImport: jest.Mock;
	let controller: AutomationTransferController;

	beforeEach(() => {
		exportAutomation = jest.fn(() => Promise.resolve({ fileName: 'night.yaml', content: 'version: 1\n' }));
		prepareImport = jest.fn(() =>
			Promise.resolve({
				draft: {
					name: 'Night',
					description: null,
					icon: null,
					mode: AutomationMode.RESTART,
					spaceId: null,
					graph: GRAPH,
				},
				missingReferences: [{ kind: 'scene', id: 's1', usages: [{ nodeId: 'n1', field: 'scene_id' }] }],
				issues: [],
			}),
		);

		controller = new AutomationTransferController({
			exportAutomation,
			prepareImport,
		} as unknown as AutomationTransferService);
	});

	it('exports the automation as a YAML file', async () => {
		expect((await controller.exportAutomation(ID)).data).toEqual({
			file_name: 'night.yaml',
			content_type: 'application/yaml',
			content: 'version: 1\n',
		});
	});

	it('answers an automation that does not exist with 404', async () => {
		exportAutomation.mockRejectedValue(new AutomationsNotFoundException('gone'));

		await expect(controller.exportAutomation(ID)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('prepares an import with its draft and the references that are missing', async () => {
		const mappings = [{ kind: 'scene' as const, id: 's0', to: 's1' }];

		const response = await controller.prepareImport({ data: { yaml: 'x', mappings } });

		expect(prepareImport).toHaveBeenCalledWith('x', mappings);
		expect(response.data).toEqual({
			draft: { name: 'Night', description: null, icon: null, mode: 'restart', space_id: null, graph: GRAPH },
			missing_references: [{ kind: 'scene', id: 's1', usages: [{ node_id: 'n1', field: 'scene_id' }] }],
			issues: [],
		});
	});

	it.each([
		[
			new AutomationsImportException('bad file', [{ field: 'kind', reason: 'Wrong kind.' }]),
			AUTOMATION_IMPORT_INVALID_ERROR_CODE,
		],
		[
			new AutomationsGraphValidationException('bad graph', [
				{ severity: 'error', code: 'unknown_node_type', message: 'Unknown.', blocking: true, node_id: 'n1' } as never,
			]),
			AUTOMATION_GRAPH_INVALID_ERROR_CODE,
		],
	])('answers a refused import with 422 and the code %#', async (error, code) => {
		prepareImport.mockRejectedValue(error);

		const rejection = await controller.prepareImport({ data: { yaml: 'x' } }).catch((caught: unknown) => caught);

		expect(rejection).toBeInstanceOf(UnprocessableEntityException);
		expect((rejection as UnprocessableEntityException).getResponse()).toEqual({
			code,
			message: error.message,
			issues: error.issues,
		});
	});
});
