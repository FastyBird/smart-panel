import { describe, expect, it } from 'vitest';

import { AuthValidationException } from '../auth.exceptions';

import type { IAuthTokenPairRes, ISessionLoginReq } from './session.store.types';
import { transformLoginRequest, transformTokenPairResponse } from './session.transformers';

describe('Session Transformers', (): void => {
	describe('transformTokenPairResponse', (): void => {
		it('should transform a valid token pair response', (): void => {
			const mockResponse: IAuthTokenPairRes = {
				access_token: 'mockAccessToken',
				refresh_token: 'mockRefreshToken',
				expiration: new Date(1712345678).toISOString(),
				type: 'Bearer',
			};

			const result = transformTokenPairResponse(mockResponse);

			expect(result).toEqual({
				accessToken: 'mockAccessToken',
				refreshToken: 'mockRefreshToken',
				expiration: new Date(1712345678),
				type: 'Bearer',
			});
		});

		it('should throw AuthValidationException for invalid token pair response', (): void => {
			const mockInvalidResponse = {
				access_token: 'mockAccessToken',
				refresh_token: '', // Invalid because the refresh token is empty
				expiration: null, // Invalid expiration
				type: 'Bearer',
			};

			expect(() => transformTokenPairResponse(mockInvalidResponse as unknown as IAuthTokenPairRes)).toThrow(AuthValidationException);
		});
	});

	describe('transformLoginRequest', (): void => {
		it('should transform a valid user object into a login request', (): void => {
			const mockCredentials = {
				username: 'testUser',
				password: 'securePassword123',
			};

			const result = transformLoginRequest(mockCredentials);

			expect(result).toEqual<ISessionLoginReq>({
				username: 'testUser',
				password: 'securePassword123',
			});
		});

		it('should throw AuthValidationException for invalid login request', (): void => {
			const mockCredentials = {
				username: 'testUser',
				password: '', // Empty password is invalid
			};

			expect(() => transformLoginRequest(mockCredentials)).toThrow(AuthValidationException);
		});
	});
});
