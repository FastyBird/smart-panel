import { DeviceControlToolService } from '../../devices/services/device-control-tool.service';
import { PropertyCommandService } from '../../devices/services/property-command.service';
import { HomeCurrentStateQueryService } from '../../home-context/services/home-current-state-query.service';
import { HomeSearchQueryService } from '../../home-context/services/home-search-query.service';
import { ToolAccessKind, ToolAudience, ToolExecutionStatus } from '../../tools/platforms/tool-provider.platform';
import { ScopedShortIdTargetKind, ShortIdMappingService } from '../../tools/services/short-id-mapping.service';
import { ToolProviderRegistryService } from '../../tools/services/tool-provider-registry.service';

import { HomeContextToolProviderService, SEARCH_HOME_TOOL_NAME } from './home-context-tool-provider.service';

describe('Buddy home search action containment', () => {
	it('does not let a canonical property ID returned by search authorize a Buddy write', async () => {
		const canonicalPropertyId = 'property-canonical';
		const searchEntities = jest.fn().mockResolvedValue({
			query: 'kitchen light',
			entities: [
				{
					kind: 'property',
					id: canonicalPropertyId,
					name: 'Kitchen light power',
					score: 900,
					reasons: ['exact_name'],
					candidate_capabilities: ['read', 'write'],
					property_name: 'Power',
					identifier: 'power',
					category: 'on',
					data_type: 'bool',
					permissions: ['read_write'],
					device: { id: 'device-1', name: 'Kitchen light', enabled: true },
					channel: { id: 'channel-1', name: 'Light', category: 'light' },
				},
			],
			observed_at: '2026-08-15T12:00:00.000Z',
			total: 1,
			returned: 1,
			totals_by_kind: { space: 0, device: 0, property: 1, scene: 0 },
			partial: false,
			truncated: false,
			refine_required: false,
		});
		const executePropertyCommandById = jest.fn().mockResolvedValue({
			device: 'device-1',
			deviceName: 'Kitchen light',
			channel: 'channel-1',
			property: canonicalPropertyId,
			value: true,
			success: true,
		});
		const shortIdMapping = new ShortIdMappingService();
		const registry = new ToolProviderRegistryService();
		registry.register(
			new HomeContextToolProviderService(
				{ searchEntities } as unknown as HomeSearchQueryService,
				{ queryCurrentState: jest.fn() } as unknown as HomeCurrentStateQueryService,
				shortIdMapping,
			),
		);
		registry.register(
			new DeviceControlToolService({ executePropertyCommandById } as unknown as PropertyCommandService, shortIdMapping),
		);

		const search = await registry.executeTool(
			{ id: 'search-call', name: SEARCH_HOME_TOOL_NAME, arguments: { query: 'kitchen light' } },
			{
				audience: ToolAudience.BUDDY,
				source: ToolAudience.BUDDY,
				conversationId: 'conversation-1',
				allowedAccessKinds: [ToolAccessKind.READ],
			},
		);
		expect(search.data).toMatchObject({ entities: [{ id: canonicalPropertyId }] });

		const denied = await registry.executeTool(
			{
				id: 'write-canonical',
				name: 'control_device',
				arguments: { property_id: canonicalPropertyId, value: true },
			},
			{
				audience: ToolAudience.BUDDY,
				source: ToolAudience.BUDDY,
				conversationId: 'conversation-1',
				allowedAccessKinds: [ToolAccessKind.WRITE],
			},
		);
		expect(denied).toEqual({
			success: false,
			status: ToolExecutionStatus.DENIED,
			message: 'The requested target is not available in this Buddy conversation.',
			errorCode: 'BUDDY_TARGET_NOT_EXPOSED',
		});
		expect(executePropertyCommandById).not.toHaveBeenCalled();

		const exposedReference = shortIdMapping.exposeScoped(
			'conversation-1',
			canonicalPropertyId,
			ScopedShortIdTargetKind.PROPERTY,
		);
		expect(exposedReference).not.toBeNull();
		await registry.executeTool(
			{
				id: 'write-exposed',
				name: 'control_device',
				arguments: { property_id: exposedReference, value: true },
			},
			{
				audience: ToolAudience.BUDDY,
				source: ToolAudience.BUDDY,
				conversationId: 'conversation-1',
				allowedAccessKinds: [ToolAccessKind.WRITE],
			},
		);
		expect(executePropertyCommandById).toHaveBeenCalledWith(canonicalPropertyId, true, expect.any(Object));
	});
});
