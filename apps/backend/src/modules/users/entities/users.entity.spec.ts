import { validateSync } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { toInstance } from '../../../common/utils/transform.utils';
import { UserRole } from '../users.constants';

import { DisplayInstanceEntity, UserEntity } from './users.entity';

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Users module entity and OpenAPI component synchronization', () => {
	const validateEntityAgainstModel = <T extends object, U extends object>(entity: T, component: U) => {
		// Convert component keys from snake_case to camelCase
		const componentKeys = Object.keys(component).map((attribute) =>
			attribute.replaceAll(caseRegex, (g) => g[1].toUpperCase()),
		);

		// Check that all keys in the component (converted to camelCase) exist in the entity
		componentKeys.forEach((key) => {
			expect(entity).toHaveProperty(key);
		});

		// Convert entity keys to snake_case and compare against the component keys
		const entityKeys = Object.keys(entity).map((key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));

		const originalModelKeys = Object.keys(component);
		entityKeys.forEach((key) => {
			expect(originalModelKeys).toContain(key);
		});
	};

	test('UserEntity matches UsersUser', () => {
		const openApiModel = {
			id: uuid().toString(),
			username: 'username',
			first_name: 'John',
			last_name: 'Doe',
			email: 'john@doe.com',
			is_hidden: false,
			role: UserRole.USER,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = toInstance(UserEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('DisplayEntity matches UsersDisplay', () => {
		const openApiModel = {
			id: uuid().toString(),
			uid: uuid().toString(),
			mac: '00:1A:2B:3C:4D:5E',
			version: '1.0.0',
			build: '42',
			user: uuid().toString(),
			display_profile: uuid().toString(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = toInstance(DisplayInstanceEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});
});
