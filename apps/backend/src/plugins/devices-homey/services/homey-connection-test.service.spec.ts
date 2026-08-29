import { instanceToPlain } from 'class-transformer';

import { ConfigService } from '../../../modules/config/services/config.service';
import { HomeyConnectorFactory } from '../connectors/homey-connector.factory';
import { HomeyConnector } from '../connectors/homey-connector.interface';
import { DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS, HomeyConnectionMode } from '../devices-homey.constants';
import {
	HomeyTestCandidateConnectionDto,
	HomeyTestConnectionDto,
	HomeyTestConnectionMode,
	HomeyTestSavedConnectionDto,
} from '../dto/test-connection.dto';
import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../errors/homey-connector.error';
import { HomeyConfigModel } from '../models/config.model';

import { HomeyConnectionTestService } from './homey-connection-test.service';

const systemInfo = {
	id: 'homey-system',
	name: 'Homey Pro',
	version: '13.4.0',
	tier: 'pro',
	model: 'Homey Pro',
};

const savedConfig = Object.assign(new HomeyConfigModel(), {
	enabled: false,
	url: 'http://homey.local:4859',
	apiKey: 'stored-secret',
	connectionTimeout: 60000,
});

const savedRequest = (): HomeyTestSavedConnectionDto =>
	Object.assign(new HomeyTestSavedConnectionDto(), { mode: HomeyTestConnectionMode.SAVED });

const candidateRequest = (overrides: Partial<HomeyTestCandidateConnectionDto> = {}): HomeyTestCandidateConnectionDto =>
	Object.assign(new HomeyTestCandidateConnectionDto(), {
		mode: HomeyTestConnectionMode.CANDIDATE,
		url: 'http://candidate-homey.local:4859',
		apiKey: 'candidate-secret',
		...overrides,
	});

const createHarness = () => {
	const connect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
	const disconnect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
	const getSystemInfo = jest.fn().mockResolvedValue(systemInfo);
	const connector = {
		connect,
		disconnect,
		getSystemInfo,
	} as unknown as jest.Mocked<HomeyConnector>;
	const create = jest.fn().mockReturnValue(connector);
	const connectorFactory = { create };
	const getPluginConfig = jest.fn().mockReturnValue(savedConfig);
	const configService = { getPluginConfig };
	const service = new HomeyConnectionTestService(
		configService as unknown as ConfigService,
		connectorFactory as unknown as HomeyConnectorFactory,
	);

	return {
		configService,
		connect,
		connector,
		connectorFactory,
		create,
		disconnect,
		getPluginConfig,
		getSystemInfo,
		service,
	};
};

describe('HomeyConnectionTestService', () => {
	it('tests the fully saved connector with the persisted key and a short bounded timeout', async () => {
		const { connect, create, disconnect, getPluginConfig, getSystemInfo, service } = createHarness();

		const result = await service.testConnection(savedRequest());

		expect(getPluginConfig).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			mode: HomeyConnectionMode.LOCAL,
			url: savedConfig.url,
			apiKey: 'stored-secret',
			connectionTimeout: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
		});
		expect(connect).toHaveBeenCalledTimes(1);
		expect(getSystemInfo).toHaveBeenCalledTimes(1);
		expect(disconnect).toHaveBeenCalledTimes(1);
		expect(result).toMatchObject({
			mode: HomeyTestConnectionMode.SAVED,
			success: true,
			homeyId: systemInfo.id,
			homeyName: systemInfo.name,
			homeyVersion: systemInfo.version,
			errorCategory: null,
			error: null,
		});
		expect(JSON.stringify(instanceToPlain(result))).not.toContain('stored-secret');
	});

	it('tests a complete candidate without reading or sending the stored key', async () => {
		const { create, disconnect, getPluginConfig, service } = createHarness();
		const request = candidateRequest();

		const result = await service.testConnection(request);

		expect(getPluginConfig).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledWith({
			mode: HomeyConnectionMode.LOCAL,
			url: request.url,
			apiKey: 'candidate-secret',
			connectionTimeout: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
		});
		expect(disconnect).toHaveBeenCalledTimes(1);
		expect(result).toMatchObject({ mode: HomeyTestConnectionMode.CANDIDATE, success: true });
		expect(JSON.stringify(instanceToPlain(result))).not.toContain('candidate-secret');
	});

	it('tests the saved cloud connector without requiring or forwarding local credentials', async () => {
		const { create, getPluginConfig, service } = createHarness();
		getPluginConfig.mockReturnValue(
			Object.assign(new HomeyConfigModel(), {
				mode: HomeyConnectionMode.CLOUD,
				url: null,
				apiKey: null,
				connectionTimeout: 60000,
			}),
		);

		await expect(service.testConnection(savedRequest())).resolves.toMatchObject({ success: true });
		expect(create).toHaveBeenCalledWith({
			mode: HomeyConnectionMode.CLOUD,
			connectionTimeout: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
		});
		expect(JSON.stringify(create.mock.calls)).not.toContain('stored-secret');
	});

	it('keeps a canonical-equivalent candidate isolated from the persisted secret', async () => {
		const { create, getPluginConfig, service } = createHarness();
		const request = candidateRequest({ url: 'http://homey.local:4859/' });

		await service.testConnection(request);

		expect(getPluginConfig).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledWith(expect.objectContaining({ url: request.url, apiKey: 'candidate-secret' }));
		expect(create).not.toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'stored-secret' }));
	});

	it.each([
		{
			label: 'candidate URL without a key',
			request: Object.assign(new HomeyTestCandidateConnectionDto(), {
				mode: HomeyTestConnectionMode.CANDIDATE,
				url: 'http://candidate-homey.local:4859',
			}),
		},
		{
			label: 'candidate key without a URL',
			request: Object.assign(new HomeyTestCandidateConnectionDto(), {
				mode: HomeyTestConnectionMode.CANDIDATE,
				apiKey: 'candidate-secret',
			}),
		},
		{
			label: 'candidate URL with embedded credentials',
			request: candidateRequest({ url: 'http://user:password@candidate-homey.local:4859' }),
		},
		{
			label: 'saved URL override',
			request: Object.assign(savedRequest(), { url: 'http://candidate-homey.local:4859' }),
		},
		{
			label: 'mixed saved URL and key overrides',
			request: Object.assign(savedRequest(), {
				url: 'http://candidate-homey.local:4859',
				apiKey: 'candidate-secret',
			}),
		},
	])('rejects $label before config or connector access', async ({ request }) => {
		const { create, getPluginConfig, service } = createHarness();

		const result = await service.testConnection(request as HomeyTestConnectionDto);

		expect(result).toMatchObject({
			success: false,
			errorCategory: HomeyConnectorErrorCategory.VALIDATION,
		});
		expect(getPluginConfig).not.toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
	});

	it('returns validation when the saved configuration is incomplete', async () => {
		const { create, getPluginConfig, service } = createHarness();
		getPluginConfig.mockReturnValue(Object.assign(new HomeyConfigModel(), { url: null, apiKey: null }));

		const result = await service.testConnection(savedRequest());

		expect(result).toMatchObject({
			success: false,
			errorCategory: HomeyConnectorErrorCategory.VALIDATION,
		});
		expect(create).not.toHaveBeenCalled();
	});

	it.each(Object.values(HomeyConnectorErrorCategory))(
		'returns the sanitized connector category %s and always disconnects',
		async (category) => {
			const { connect, disconnect, service } = createHarness();
			connect.mockRejectedValueOnce(new HomeyConnectorError(category, HomeyConnectorOperation.CONNECT));

			const result = await service.testConnection(candidateRequest());

			expect(result).toMatchObject({ success: false, errorCategory: category });
			expect(result.error).not.toContain('candidate-secret');
			expect(disconnect).toHaveBeenCalledTimes(1);
		},
	);

	it('reports a sanitized cleanup failure after a successful probe', async () => {
		const { disconnect, service } = createHarness();
		disconnect.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.DISCONNECT),
		);

		const result = await service.testConnection(candidateRequest());

		expect(result).toMatchObject({
			success: false,
			homeyId: null,
			errorCategory: HomeyConnectorErrorCategory.UNAVAILABLE,
		});
		expect(disconnect).toHaveBeenCalledTimes(1);
	});
});
