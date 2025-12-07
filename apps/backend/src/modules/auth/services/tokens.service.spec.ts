/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-argument
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType, TokenType } from '../auth.constants';
import { AuthException, AuthNotFoundException } from '../auth.exceptions';
import { CreateLongLiveTokenDto, CreateTokenDto } from '../dto/create-token.dto';
import { UpdateLongLiveTokenDto, UpdateTokenDto } from '../dto/update-token.dto';
import { LongLiveTokenEntity, TokenEntity } from '../entities/auth.entity';

import { TokensTypeMapperService } from './tokens-type-mapper.service';
import { TokensService } from './tokens.service';

jest.mock('../utils/token.utils', () => ({
	hashToken: jest.fn((token) => `hashed-${token}`),
}));

jest.mock('bcrypt', () => ({
	hash: jest.fn(),
	compare: jest.fn(),
}));

describe('TokensService', () => {
	let service: TokensService;
	let repository: Repository<TokenEntity>;
	let mapper: TokensTypeMapperService;
	let dataSource: DataSource;

	const mockToken: LongLiveTokenEntity = {
		id: uuid().toString(),
		type: TokenType.LONG_LIVE,
		name: 'Token name',
		description: 'Token description',
		hashedToken: 'hashed-test-token',
		expiresAt: new Date(),
		createdAt: new Date(),
		ownerType: TokenOwnerType.USER,
		ownerId: null,
		revoked: false,
		updateToken: (): void => {},
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn(),
				getOne: jest.fn(),
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TokensService,
				{ provide: getRepositoryToken(TokenEntity), useFactory: mockRepository },
				{
					provide: TokensTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({
							type: 'mock',
							class: LongLiveTokenEntity,
							createDto: CreateLongLiveTokenDto,
							updateDto: UpdateLongLiveTokenDto,
						})),
					},
				},
				{
					provide: DataSource,
					useValue: {
						getRepository: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<TokensService>(TokensService);
		repository = module.get<Repository<TokenEntity>>(getRepositoryToken(TokenEntity));
		mapper = module.get<TokensTypeMapperService>(TokensTypeMapperService);
		dataSource = module.get<DataSource>(DataSource);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(repository).toBeDefined();
		expect(mapper).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('getOneOrThrow', () => {
		it('should return a token if found', async () => {
			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(LongLiveTokenEntity, mockToken)),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.getOneOrThrow(mockToken.id);

			expect(result).toEqual(toInstance(LongLiveTokenEntity, mockToken));
		});

		it('should throw an error if token not found', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(null);

			await expect(service.getOneOrThrow('invalid-id')).rejects.toThrow(AuthNotFoundException);
		});
	});

	describe('create', () => {
		it('should create and return a new token', async () => {
			const createDto: CreateLongLiveTokenDto = {
				type: TokenType.LONG_LIVE,
				token: 'test-token',
				name: 'Token name',
				description: 'Token description',
				ownerType: TokenOwnerType.USER,
				ownerId: null,
				expiresAt: new Date(),
			};
			const mockCreateToken: Partial<LongLiveTokenEntity> = {
				type: createDto.type,
				token: createDto.token,
				name: createDto.name,
				description: createDto.description,
				expiresAt: createDto.expiresAt,
				ownerType: TokenOwnerType.USER,
				ownerId: null,
			};
			const mockCreatedToken: LongLiveTokenEntity = {
				id: uuid().toString(),
				type: mockCreateToken.type,
				name: mockCreateToken.name,
				description: mockCreateToken.description,
				token: mockCreateToken.token,
				hashedToken: mockCreateToken.token,
				expiresAt: mockCreateToken.expiresAt,
				revoked: false,
				createdAt: new Date(),
				ownerType: TokenOwnerType.USER,
				ownerId: null,
				updateToken: (): void => {},
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(LongLiveTokenEntity, mockCreatedToken)),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'create').mockReturnValue(toInstance(LongLiveTokenEntity, mockCreatedToken));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(LongLiveTokenEntity, mockCreatedToken));

			jest.spyOn(service, 'findAll').mockResolvedValue([]);

			const result = await service.create(createDto);

			expect(result).toEqual(toInstance(LongLiveTokenEntity, mockCreatedToken));
			expect(repository.create).toHaveBeenCalledWith(toInstance(LongLiveTokenEntity, mockCreateToken));
			const saveToken = toInstance(LongLiveTokenEntity, mockCreatedToken);
			saveToken.hashedToken = mockCreateToken.token;
			expect(repository.save).toHaveBeenCalledWith(saveToken);
			expect(repository.createQueryBuilder).toHaveBeenCalledWith('token');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('token.id = :fieldValue', {
				fieldValue: mockCreatedToken.id,
			});
			expect(queryBuilderMock.getOne).toHaveBeenCalledTimes(1);
		});

		it('should throw an error if token already exists', async () => {
			const createDto: CreateTokenDto = { token: 'test-token', type: 'mock', expiresAt: new Date() };

			jest.spyOn(service, 'findAll').mockResolvedValue([{} as TokenEntity]);

			// @ts-expect-error: bcrypt is mocked, but TypeScript still reports an error when mocking the method
			jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

			await expect(service.create(createDto)).rejects.toThrow(AuthException);
		});
	});

	describe('update', () => {
		it('should update and return the token', async () => {
			const updateDto: UpdateLongLiveTokenDto = {
				type: TokenType.LONG_LIVE,
				revoked: true,
			};
			const mockUpdateToken: LongLiveTokenEntity = {
				id: mockToken.id,
				type: mockToken.type,
				name: 'Token name',
				description: 'Token description',
				hashedToken: mockToken.hashedToken,
				expiresAt: mockToken.expiresAt,
				revoked: updateDto.revoked,
				createdAt: mockToken.createdAt,
				ownerType: TokenOwnerType.USER,
				ownerId: null,
				updateToken: (): void => {},
			};
			const mockUpdatedToken: LongLiveTokenEntity = {
				id: mockUpdateToken.id,
				type: mockUpdateToken.type,
				name: mockUpdateToken.name,
				description: mockUpdateToken.description,
				hashedToken: mockUpdateToken.hashedToken,
				expiresAt: mockUpdateToken.expiresAt,
				revoked: mockUpdateToken.revoked,
				createdAt: mockUpdateToken.createdAt,
				updatedAt: new Date(),
				ownerType: TokenOwnerType.USER,
				ownerId: null,
				updateToken: (): void => {},
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(toInstance(LongLiveTokenEntity, mockToken))
					.mockResolvedValueOnce(toInstance(LongLiveTokenEntity, mockUpdatedToken)),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(LongLiveTokenEntity, mockUpdatedToken));

			const result = await service.update(mockToken.id, updateDto);

			expect(result).toEqual(toInstance(LongLiveTokenEntity, mockUpdatedToken));
			expect(repository.save).toHaveBeenCalledWith(toInstance(LongLiveTokenEntity, mockUpdateToken));
			expect(repository.createQueryBuilder).toHaveBeenCalledWith('token');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('token.id = :fieldValue', { fieldValue: mockToken.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalledTimes(2);
		});

		it('should throw an error if token not found', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new AuthNotFoundException('Token not found'));

			await expect(service.update('invalid-id', {} as UpdateTokenDto)).rejects.toThrow(AuthNotFoundException);
		});
	});

	describe('remove', () => {
		it('should remove a token and its children', async () => {
			const token = { id: 'token-id', children: [{ id: 'child-token-id' }] } as unknown as TokenEntity;

			jest.spyOn(service, 'getOneOrThrow').mockResolvedValue(token);
			jest.spyOn(repository, 'remove').mockResolvedValue(undefined);

			await service.remove(token.id);

			expect(service.getOneOrThrow).toHaveBeenCalledWith(token.id);
			expect(repository.remove).toHaveBeenCalledWith(token);
			expect(repository.remove).toHaveBeenCalledWith(token['children'][0]);
		});

		it('should throw an error if token not found', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new AuthNotFoundException('Token not found'));

			await expect(service.remove('invalid-id')).rejects.toThrow(AuthNotFoundException);
		});
	});

	describe('findAllByOwnerType', () => {
		it('should return all tokens for a specific owner type', async () => {
			const mockDisplayTokens: LongLiveTokenEntity[] = [
				{
					...mockToken,
					id: uuid().toString(),
					type: TokenType.LONG_LIVE,
					ownerType: TokenOwnerType.DISPLAY,
					ownerId: uuid().toString(),
					updateToken: (): void => {},
				},
				{
					...mockToken,
					id: uuid().toString(),
					type: TokenType.LONG_LIVE,
					ownerType: TokenOwnerType.DISPLAY,
					ownerId: uuid().toString(),
					updateToken: (): void => {},
				},
			];

			const mockRepo = {
				find: jest.fn().mockResolvedValue(mockDisplayTokens.map((t) => toInstance(LongLiveTokenEntity, t))),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(mockRepo as any);

			const result = await service.findAllByOwnerType(TokenOwnerType.DISPLAY);

			expect(result).toHaveLength(2);
			expect(result[0].ownerType).toBe(TokenOwnerType.DISPLAY);
			expect(mockRepo.find).toHaveBeenCalledWith({ where: { ownerType: TokenOwnerType.DISPLAY } });
		});

		it('should return empty array when no tokens for owner type', async () => {
			const mockRepo = {
				find: jest.fn().mockResolvedValue([]),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(mockRepo as any);

			const result = await service.findAllByOwnerType(TokenOwnerType.THIRD_PARTY);

			expect(result).toHaveLength(0);
		});
	});

	describe('findByOwnerId', () => {
		it('should return tokens for a specific owner ID and type', async () => {
			const ownerId = uuid().toString();
			const mockDisplayTokens: LongLiveTokenEntity[] = [
				{
					...mockToken,
					id: uuid().toString(),
					type: TokenType.LONG_LIVE,
					ownerType: TokenOwnerType.DISPLAY,
					ownerId,
					updateToken: (): void => {},
				},
			];

			const mockRepo = {
				find: jest.fn().mockResolvedValue(mockDisplayTokens.map((t) => toInstance(LongLiveTokenEntity, t))),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(mockRepo as any);

			const result = await service.findByOwnerId(ownerId, TokenOwnerType.DISPLAY);

			expect(result).toHaveLength(1);
			expect(result[0].ownerId).toBe(ownerId);
			expect(result[0].ownerType).toBe(TokenOwnerType.DISPLAY);
			expect(mockRepo.find).toHaveBeenCalledWith({ where: { ownerId, ownerType: TokenOwnerType.DISPLAY } });
		});

		it('should return empty array when no tokens for owner ID', async () => {
			const mockRepo = {
				find: jest.fn().mockResolvedValue([]),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(mockRepo as any);

			const result = await service.findByOwnerId('non-existent-id', TokenOwnerType.DISPLAY);

			expect(result).toHaveLength(0);
		});
	});

	describe('revokeByOwnerId', () => {
		it('should revoke all tokens for a specific owner', async () => {
			const ownerId = uuid().toString();

			const mockRepo = {
				update: jest.fn().mockResolvedValue({ affected: 2 }),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(mockRepo as any);

			await service.revokeByOwnerId(ownerId, TokenOwnerType.DISPLAY);

			expect(mockRepo.update).toHaveBeenCalledWith(
				{ ownerId, ownerType: TokenOwnerType.DISPLAY },
				{ revoked: true },
			);
		});
	});

	describe('findByHashedToken', () => {
		it('should find a token by its hash', async () => {
			const tokenValue = 'test-token-value';
			const mockTokenWithHash: LongLiveTokenEntity = {
				...mockToken,
				type: TokenType.LONG_LIVE,
				hashedToken: `hashed-${tokenValue}`,
				updateToken: (): void => {},
			};

			// Return the mock directly without toInstance transformation to preserve hashedToken
			jest.spyOn(service, 'findAll').mockResolvedValue([mockTokenWithHash]);

			const result = await service.findByHashedToken(tokenValue, LongLiveTokenEntity);

			expect(result).toEqual(mockTokenWithHash);
		});

		it('should return null when token not found', async () => {
			jest.spyOn(service, 'findAll').mockResolvedValue([]);

			const result = await service.findByHashedToken('non-existent-token', LongLiveTokenEntity);

			expect(result).toBeNull();
		});

		it('should return null when hash does not match', async () => {
			const mockTokenWithHash: LongLiveTokenEntity = {
				...mockToken,
				type: TokenType.LONG_LIVE,
				hashedToken: 'different-hash',
				updateToken: (): void => {},
			};

			// Return the mock directly without toInstance transformation to preserve hashedToken
			jest.spyOn(service, 'findAll').mockResolvedValue([mockTokenWithHash]);

			const result = await service.findByHashedToken('test-token', LongLiveTokenEntity);

			expect(result).toBeNull();
		});
	});
});
