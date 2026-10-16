import { instanceToPlain } from 'class-transformer';
import 'reflect-metadata';

import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ModelPropertiesAccessor } from '@nestjs/swagger/dist/services/model-properties-accessor';
import { SchemaObjectFactory } from '@nestjs/swagger/dist/services/schema-object-factory';
import { SwaggerTypesMapper } from '@nestjs/swagger/dist/services/swagger-types-mapper';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ActivityActivationStatus, ActivityMode } from '../activity/space-activity.constants';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';
import { ActivityStateResponseModel } from '../models/activity-response.model';

import { SpaceModesController } from './space-modes.controller';

describe('activity controller permissions and authenticated identity', () => {
	it('restricts configuration writes and reset to owner/admin', () => {
		for (const name of ['update', 'reset']) {
			const handler = Reflect.get(SpaceModesController.prototype, name) as object;
			expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		}
	});
	it('uses authenticated actor, returns envelope and refuses ordinary users', async () => {
		const activateMode = jest.fn().mockResolvedValue({ activationId: 'server-activation' });
		const controller = new SpaceModesController({ activateMode } as never, {} as never);
		const body = { data: { expected_revision: 2, actor: 'spoofed', owner_id: 'spoofed' } };
		expect(
			await controller.activate('space', ActivityMode.WORK, body, {
				auth: { type: 'user', id: 'trusted', role: UserRole.ADMIN },
			} as never),
		).toMatchObject({ data: { activationId: 'server-activation' } });
		expect(activateMode).toHaveBeenCalledWith('space', ActivityMode.WORK, 2, 'user:trusted');
		await expect(
			controller.activate('space', ActivityMode.WORK, body, {
				auth: { type: 'user', id: 'ordinary', role: UserRole.USER },
			} as never),
		).rejects.toThrow();
	});
});

describe('deactivated activity state contract', () => {
	it('emits exactly the five activity modes plus canonical null while requiring the field', () => {
		const schemas: Record<string, SchemaObject> = {};
		const factory = new SchemaObjectFactory(new ModelPropertiesAccessor(), new SwaggerTypesMapper());
		const name = factory.exploreModelSchema(SpaceActivityStateEntity, schemas);
		const property = schemas[name].properties?.selected_activity_mode as SchemaObject;
		expect(property.anyOf).toEqual([
			{ type: 'string', enum: ['work', 'relax', 'sleep', 'entertainment', 'away'] },
			{ type: 'null' },
		]);
		expect(property).not.toHaveProperty('nullable');
		expect(property).not.toHaveProperty('enum');
		expect(property).not.toHaveProperty('type');
		expect(schemas[name].required).toContain('selected_activity_mode');
	});
	it('serializes a deactivated data object with null selection independently of a null active envelope', () => {
		const state = Object.assign(new SpaceActivityStateEntity(), {
			selectedActivityMode: null,
			activityStatus: ActivityActivationStatus.DEACTIVATED,
			activityResults: [],
		});
		const response = Object.assign(new ActivityStateResponseModel(), { data: state });
		expect(instanceToPlain(response)).toMatchObject({
			data: {
				type: 'activity_state',
				selected_activity_mode: null,
				activity_status: 'deactivated',
				activity_results: [],
			},
		});
		expect(instanceToPlain(Object.assign(new ActivityStateResponseModel(), { data: null }))).toMatchObject({
			data: null,
		});
	});
});
