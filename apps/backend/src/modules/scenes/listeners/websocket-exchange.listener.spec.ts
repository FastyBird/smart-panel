/* eslint-disable @typescript-eslint/unbound-method */
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { SceneExecutionStatus } from '../scenes.constants';
import { SceneExecutorService } from '../services/scene-executor.service';

import { ScenesWsEventType, ScenesWsHandlerName, WebsocketExchangeListener } from './websocket-exchange.listener';

describe('WebsocketExchangeListener (Scenes)', () => {
	let listener: WebsocketExchangeListener;
	let commandEventRegistry: jest.Mocked<CommandEventRegistryService>;
	let sceneExecutorService: jest.Mocked<SceneExecutorService>;

	const createMockUser = (overrides: Partial<ClientUserDto> = {}): ClientUserDto => ({
		id: 'user-123',
		role: UserRole.USER,
		type: 'token',
		ownerType: TokenOwnerType.DISPLAY,
		...overrides,
	});

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WebsocketExchangeListener,
				{
					provide: CommandEventRegistryService,
					useValue: {
						register: jest.fn(),
					},
				},
				{
					provide: SceneExecutorService,
					useValue: {
						triggerScene: jest.fn(),
					},
				},
			],
		}).compile();

		listener = module.get<WebsocketExchangeListener>(WebsocketExchangeListener);
		commandEventRegistry = module.get(CommandEventRegistryService);
		sceneExecutorService = module.get(SceneExecutorService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(listener).toBeDefined();
	});

	describe('onModuleInit', () => {
		it('should register command handler for trigger scene', () => {
			listener.onModuleInit();

			expect(commandEventRegistry.register).toHaveBeenCalledWith(
				ScenesWsEventType.TRIGGER_SCENE,
				ScenesWsHandlerName.TRIGGER_SCENE,
				expect.any(Function),
			);
		});
	});

	describe('handleTriggerScene', () => {
		let handleTriggerScene: (user: any, payload: any) => Promise<any>;

		beforeEach(() => {
			listener.onModuleInit();
			handleTriggerScene = commandEventRegistry.register.mock.calls[0][2];
		});

		it('should return unauthorized for undefined user', async () => {
			const result = await handleTriggerScene(undefined, { sceneId: 'scene-1' });

			expect(result).toEqual({
				success: false,
				reason: 'Unauthorized: insufficient permissions',
			});
		});

		it('should return unauthorized for regular user', async () => {
			const user = createMockUser({ type: 'user', role: UserRole.USER, ownerType: undefined });

			const result = await handleTriggerScene(user, { sceneId: 'scene-1' });

			expect(result).toEqual({
				success: false,
				reason: 'Unauthorized: insufficient permissions',
			});
		});

		it('should allow display client', async () => {
			const user = createMockUser({ type: 'token', ownerType: TokenOwnerType.DISPLAY });
			const sceneId = uuid();

			sceneExecutorService.triggerScene.mockResolvedValue({
				sceneId,
				status: SceneExecutionStatus.COMPLETED,
				totalActions: 3,
				successfulActions: 3,
				failedActions: 0,
				triggeredAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				actionResults: [],
			});

			const result = await handleTriggerScene(user, { sceneId });

			expect(result.success).toBe(true);
			expect(sceneExecutorService.triggerScene).toHaveBeenCalledWith(sceneId, user.id);
		});

		it('should allow admin user', async () => {
			const user = createMockUser({ type: 'user', role: UserRole.ADMIN, ownerType: undefined });
			const sceneId = uuid();

			sceneExecutorService.triggerScene.mockResolvedValue({
				sceneId,
				status: SceneExecutionStatus.COMPLETED,
				totalActions: 1,
				successfulActions: 1,
				failedActions: 0,
				triggeredAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				actionResults: [],
			});

			const result = await handleTriggerScene(user, { sceneId });

			expect(result.success).toBe(true);
		});

		it('should allow owner user', async () => {
			const user = createMockUser({ type: 'user', role: UserRole.OWNER, ownerType: undefined });
			const sceneId = uuid();

			sceneExecutorService.triggerScene.mockResolvedValue({
				sceneId,
				status: SceneExecutionStatus.COMPLETED,
				totalActions: 1,
				successfulActions: 1,
				failedActions: 0,
				triggeredAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				actionResults: [],
			});

			const result = await handleTriggerScene(user, { sceneId });

			expect(result.success).toBe(true);
		});

		it('should return error when sceneId is missing', async () => {
			const user = createMockUser();

			const result = await handleTriggerScene(user, {});

			expect(result).toEqual({
				success: false,
				reason: 'Scene ID is required',
			});
		});

		it('should return success for completed execution', async () => {
			const user = createMockUser();
			const sceneId = uuid();
			const triggeredAt = new Date().toISOString();
			const completedAt = new Date().toISOString();

			sceneExecutorService.triggerScene.mockResolvedValue({
				sceneId,
				status: SceneExecutionStatus.COMPLETED,
				totalActions: 5,
				successfulActions: 5,
				failedActions: 0,
				triggeredAt,
				completedAt,
				actionResults: [],
			});

			const result = await handleTriggerScene(user, { sceneId });

			expect(result).toEqual({
				success: true,
				data: {
					scene_id: sceneId,
					status: SceneExecutionStatus.COMPLETED,
					total_actions: 5,
					successful_actions: 5,
					failed_actions: 0,
					triggered_at: triggeredAt,
					completed_at: completedAt,
				},
			});
		});

		it('should return success for partially completed execution', async () => {
			const user = createMockUser();
			const sceneId = uuid();

			sceneExecutorService.triggerScene.mockResolvedValue({
				sceneId,
				status: SceneExecutionStatus.PARTIALLY_COMPLETED,
				totalActions: 5,
				successfulActions: 3,
				failedActions: 2,
				triggeredAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				actionResults: [],
			});

			const result = await handleTriggerScene(user, { sceneId });

			expect(result.success).toBe(true);
			expect(result.data.failed_actions).toBe(2);
		});

		it('should return failure for failed execution', async () => {
			const user = createMockUser();
			const sceneId = uuid();

			sceneExecutorService.triggerScene.mockResolvedValue({
				sceneId,
				status: SceneExecutionStatus.FAILED,
				totalActions: 5,
				successfulActions: 0,
				failedActions: 5,
				triggeredAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				actionResults: [],
			});

			const result = await handleTriggerScene(user, { sceneId });

			expect(result.success).toBe(false);
		});

		it('should use websocket as triggeredBy when user has no id', async () => {
			const user = createMockUser({ id: undefined });
			const sceneId = uuid();

			sceneExecutorService.triggerScene.mockResolvedValue({
				sceneId,
				status: SceneExecutionStatus.COMPLETED,
				totalActions: 1,
				successfulActions: 1,
				failedActions: 0,
				triggeredAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				actionResults: [],
			});

			await handleTriggerScene(user, { sceneId });

			expect(sceneExecutorService.triggerScene).toHaveBeenCalledWith(sceneId, 'websocket');
		});

		it('should handle service exceptions', async () => {
			const user = createMockUser();
			const sceneId = uuid();

			sceneExecutorService.triggerScene.mockRejectedValue(new Error('Scene not found'));

			const result = await handleTriggerScene(user, { sceneId });

			expect(result).toEqual({
				success: false,
				reason: 'Scene not found',
			});
		});
	});
});
