/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ModuleRef } from '@nestjs/core';

import { SpaceLightingToolService } from './space-lighting-tool.service';
import { SpacesService } from './spaces.service';

describe('SpaceLightingToolService', () => {
	let service: SpaceLightingToolService;
	let spacesService: Record<string, jest.Mock>;
	let spaceIntentService: Record<string, jest.Mock>;

	beforeEach(async () => {
		spacesService = {
			findOne: jest.fn(),
		};

		spaceIntentService = {
			executeLightingIntent: jest.fn(),
		};

		const moduleRef = {
			get: jest.fn().mockReturnValue(spaceIntentService),
		};

		service = new SpaceLightingToolService(
			spacesService as unknown as SpacesService,
			moduleRef as unknown as ModuleRef,
		);

		// Simulate onModuleInit which resolves SpaceIntentService lazily
		await service.onModuleInit();
	});

	describe('getToolDefinitions', () => {
		it('should return one tool definition', () => {
			const tools = service.getToolDefinitions();

			expect(tools).toHaveLength(1);
			expect(tools[0].name).toBe('set_space_lighting');
		});

		it('should define set_space_lighting with required parameters and mode enum', () => {
			const tools = service.getToolDefinitions();
			const setLighting = tools.find((t) => t.name === 'set_space_lighting');

			expect(setLighting).toBeDefined();
			expect(setLighting?.parameters).toEqual(
				expect.objectContaining({
					type: 'object',
					required: ['space_id', 'mode'],
				}),
			);

			const modeParam = (setLighting?.parameters as any).properties.mode;

			expect(modeParam.enum).toEqual(['off', 'on', 'work', 'relax', 'night']);
		});
	});

	describe('executeTool - set_space_lighting', () => {
		it('should set lighting mode to off', async () => {
			spaceIntentService.executeLightingIntent.mockResolvedValue({
				success: true,
				affectedDevices: 3,
				failedDevices: 0,
			});
			spacesService.findOne.mockResolvedValue({ id: 'space-1', name: 'Living Room' });

			const result = await service.executeTool({
				id: 'call-1',
				name: 'set_space_lighting',
				arguments: { space_id: 'space-1', mode: 'off' },
			});

			expect(result.success).toBe(true);
			expect(result.message).toContain('Living Room');
			expect(result.message).toContain('"off"');
			expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(
				'space-1',
				expect.objectContaining({ type: 'off' }),
			);
		});

		it('should set lighting mode to relax', async () => {
			spaceIntentService.executeLightingIntent.mockResolvedValue({
				success: true,
				affectedDevices: 2,
				failedDevices: 0,
			});
			spacesService.findOne.mockResolvedValue({ id: 'space-1', name: 'Bedroom' });

			const result = await service.executeTool({
				id: 'call-1',
				name: 'set_space_lighting',
				arguments: { space_id: 'space-1', mode: 'relax' },
			});

			expect(result.success).toBe(true);
			expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(
				'space-1',
				expect.objectContaining({ type: 'set_mode', mode: 'relax' }),
			);
		});

		it('should return failure for non-existent space', async () => {
			spaceIntentService.executeLightingIntent.mockResolvedValue(null);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'set_space_lighting',
				arguments: { space_id: 'nonexistent', mode: 'off' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('not found');
		});

		it('should return failure for invalid mode', async () => {
			const result = await service.executeTool({
				id: 'call-1',
				name: 'set_space_lighting',
				arguments: { space_id: 'space-1', mode: 'disco' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Invalid lighting mode');
		});

		it('should return failure when missing parameters', async () => {
			const result = await service.executeTool({
				id: 'call-1',
				name: 'set_space_lighting',
				arguments: { space_id: 'space-1' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Missing required parameters');
		});
	});

	describe('executeTool - unknown tool', () => {
		it('should return null for unknown tool name', async () => {
			const result = await service.executeTool({
				id: 'call-1',
				name: 'unknown_tool',
				arguments: {},
			});

			expect(result).toBeNull();
		});
	});
});
