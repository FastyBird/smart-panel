import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

import { UsersValidationException } from '../users.exceptions';

import type { IDisplayInstanceRes, IDisplaysInstancesAddActionPayload, IDisplaysInstancesEditActionPayload } from './displays-instances.store.types';
import {
	transformDisplayInstanceCreateRequest,
	transformDisplayInstanceResponse,
	transformDisplayInstanceUpdateRequest,
} from './displays-instances.transformers';

const displayId = uuid();
const displayUid = uuid();
const userUid = uuid();

const validDisplayResponse: IDisplayInstanceRes = {
	id: displayId,
	uid: displayUid,
	mac: '00:1A:2B:3C:4D:5E',
	version: '1.0.0',
	build: '42',
	user: userUid,
	display_profile: null,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validDisplayCreatePayload: IDisplaysInstancesAddActionPayload['data'] = {
	uid: displayUid,
	mac: '00:1A:2B:3C:4D:5E',
	version: '1.0.0',
	build: '42',
	user: userUid,
};

const validDisplayUpdatePayload: IDisplaysInstancesEditActionPayload['data'] = {
	version: '1.0.0',
	build: '42',
};

describe('Displays Instances Transformers', (): void => {
	describe('transformDisplayInstanceResponse', (): void => {
		it('should transform a valid display instance response', (): void => {
			const result = transformDisplayInstanceResponse(validDisplayResponse);

			expect(result).toEqual({
				id: displayId,
				uid: displayUid,
				mac: '00:1A:2B:3C:4D:5E',
				version: '1.0.0',
				build: '42',
				user: userUid,
				displayProfile: null,
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid display instance response', (): void => {
			expect(() => transformDisplayInstanceResponse({ ...validDisplayResponse, id: null } as unknown as IDisplayInstanceRes)).toThrow(
				UsersValidationException
			);
		});
	});

	describe('transformDisplayCreateRequest', (): void => {
		it('should transform a valid display instance create request', (): void => {
			const result = transformDisplayInstanceCreateRequest(validDisplayCreatePayload);

			expect(result).toEqual({
				uid: displayUid,
				mac: '00:1A:2B:3C:4D:5E',
				version: '1.0.0',
				build: '42',
				user: userUid,
			});
		});

		it('should throw an error for an invalid display instance create request', (): void => {
			expect(() =>
				transformDisplayInstanceCreateRequest({ ...validDisplayCreatePayload, mac: '' } as unknown as IDisplaysInstancesAddActionPayload['data'] & {
					id?: string;
				})
			).toThrow(UsersValidationException);
		});
	});

	describe('transformDisplayUpdateRequest', (): void => {
		it('should transform a valid display instance update request', (): void => {
			const result = transformDisplayInstanceUpdateRequest(validDisplayUpdatePayload);

			expect(result).toEqual({
				version: '1.0.0',
				build: '42',
			});
		});

		it('should throw an error for an invalid display instance update request', (): void => {
			expect(() =>
				transformDisplayInstanceUpdateRequest({ ...validDisplayUpdatePayload, version: 22 } as unknown as IDisplaysInstancesEditActionPayload['data'])
			).toThrow(UsersValidationException);
		});
	});
});
