import { v4 as uuid } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { SystemValidationException } from '../system.exceptions';

import type { IDisplayProfileRes, IDisplaysProfilesAddActionPayload, IDisplaysProfilesEditActionPayload } from './displays-profiles.store.types';
import {
	transformDisplayProfileCreateRequest,
	transformDisplayProfileResponse,
	transformDisplayProfileUpdateRequest,
} from './displays-profiles.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
		},
	};
});

const displayId = uuid();
const displayUid = uuid();

const validDisplayResponse: IDisplayProfileRes = {
	id: displayId,
	uid: displayUid,
	screen_width: 1280,
	screen_height: 720,
	pixel_ratio: 2,
	unit_size: 120,
	rows: 6,
	cols: 4,
	primary: true,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validDisplayCreatePayload: IDisplaysProfilesAddActionPayload['data'] = {
	uid: displayUid,
	screenWidth: 1280,
	screenHeight: 720,
	pixelRatio: 2,
	unitSize: 120,
	rows: 6,
	cols: 4,
	primary: true,
};

const validDisplayUpdatePayload: IDisplaysProfilesEditActionPayload['data'] = {
	rows: 6,
	cols: 6,
	primary: true,
};

describe('Displays Profiles Transformers', (): void => {
	describe('transformDisplayResponse', (): void => {
		it('should transform a valid display profile response', (): void => {
			const result = transformDisplayProfileResponse(validDisplayResponse);

			expect(result).toEqual({
				id: displayId,
				uid: displayUid,
				screenWidth: 1280,
				screenHeight: 720,
				pixelRatio: 2,
				unitSize: 120,
				rows: 6,
				cols: 4,
				primary: true,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid display profile response', (): void => {
			expect(() => transformDisplayProfileResponse({ ...validDisplayResponse, id: null } as unknown as IDisplayProfileRes)).toThrow(
				SystemValidationException
			);
		});
	});

	describe('transformDisplayCreateRequest', (): void => {
		it('should transform a valid display profile create request', (): void => {
			const result = transformDisplayProfileCreateRequest(validDisplayCreatePayload);

			expect(result).toEqual({
				uid: displayUid,
				screen_width: 1280,
				screen_height: 720,
				pixel_ratio: 2,
				unit_size: 120,
				rows: 6,
				cols: 4,
				primary: true,
			});
		});

		it('should throw an error for an invalid display profile create request', (): void => {
			expect(() =>
				transformDisplayProfileCreateRequest({ ...validDisplayCreatePayload, primary: '' } as unknown as IDisplaysProfilesAddActionPayload['data'] & {
					id?: string;
				})
			).toThrow(SystemValidationException);
		});
	});

	describe('transformDisplayUpdateRequest', (): void => {
		it('should transform a valid display profile update request', (): void => {
			const result = transformDisplayProfileUpdateRequest(validDisplayUpdatePayload);

			expect(result).toEqual({
				rows: 6,
				cols: 6,
				primary: true,
			});
		});

		it('should throw an error for an invalid display profile update request', (): void => {
			expect(() =>
				transformDisplayProfileUpdateRequest({ ...validDisplayUpdatePayload, primary: '' } as unknown as IDisplaysProfilesEditActionPayload['data'])
			).toThrow(SystemValidationException);
		});
	});
});
