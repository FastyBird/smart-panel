import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

import { UserRole } from '../users.constants';
import { UsersValidationException } from '../users.exceptions';

import type { IUserRes, IUsersAddActionPayload, IUsersEditActionPayload } from './users.store.types';
import { transformUserCreateRequest, transformUserResponse, transformUserUpdateRequest } from './users.transformers';

const userId = uuid();

const validUserResponse: IUserRes = {
	id: userId,
	username: 'testuser',
	email: 'test@example.com',
	first_name: 'John',
	last_name: 'Doe',
	is_hidden: false,
	role: UserRole.USER,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validUserCreatePayload: IUsersAddActionPayload['data'] = {
	username: 'newuser',
	password: 'securepassword',
	email: 'new@example.com',
	firstName: 'New',
	lastName: 'User',
	role: UserRole.ADMIN,
};

const validUserUpdatePayload: IUsersEditActionPayload['data'] = {
	username: 'updateduser',
	password: 'newpassword',
	email: 'updated@example.com',
	firstName: 'Updated',
	lastName: 'User',
	role: UserRole.USER,
};

describe('Users Transformers', (): void => {
	describe('transformUserResponse', (): void => {
		it('should transform a valid user response', (): void => {
			const result = transformUserResponse(validUserResponse);

			expect(result).toEqual({
				id: userId,
				username: 'testuser',
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
				isHidden: false,
				draft: false,
				role: UserRole.USER,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid user response', (): void => {
			expect(() => transformUserResponse({ ...validUserResponse, id: null } as unknown as IUserRes)).toThrow(UsersValidationException);
		});
	});

	describe('transformUserCreateRequest', (): void => {
		it('should transform a valid user create request', (): void => {
			const result = transformUserCreateRequest(validUserCreatePayload);

			expect(result).toEqual({
				username: 'newuser',
				password: 'securepassword',
				email: 'new@example.com',
				first_name: 'New',
				last_name: 'User',
				role: UserRole.ADMIN,
			});
		});

		it('should throw an error for an invalid user create request', (): void => {
			expect(() =>
				transformUserCreateRequest({ ...validUserCreatePayload, username: '' } as unknown as IUsersAddActionPayload['data'] & { id?: string })
			).toThrow(UsersValidationException);
		});
	});

	describe('transformUserUpdateRequest', (): void => {
		it('should transform a valid user update request', (): void => {
			const result = transformUserUpdateRequest(validUserUpdatePayload);

			expect(result).toEqual({
				username: 'updateduser',
				password: 'newpassword',
				email: 'updated@example.com',
				first_name: 'Updated',
				last_name: 'User',
				role: UserRole.USER,
			});
		});

		it('should throw an error for an invalid user update request', (): void => {
			expect(() =>
				transformUserUpdateRequest({ ...validUserUpdatePayload, email: 'invalid-email' } as unknown as IUsersEditActionPayload['data'])
			).toThrow(UsersValidationException);
		});
	});
});
