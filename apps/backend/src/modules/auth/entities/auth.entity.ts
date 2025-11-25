import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BeforeInsert, ChildEntity, Column, Entity, Index, ManyToOne, OneToMany, TableInheritance } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from '../../users/entities/users.entity';
import { TokenType } from '../auth.constants';
import { AuthException } from '../auth.exceptions';
import { hashToken } from '../utils/token.utils';

@ApiSchema({ name: 'AuthModuleToken' })
@Entity('auth_module_tokens')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class TokenEntity extends BaseEntity {
	@ApiPropertyOptional({
		description: 'Plain text token value',
		type: 'string',
		example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
	})
	@Expose()
	@IsNotEmpty()
	@IsString()
	token?: string;

	@IsNotEmpty()
	@IsString()
	@Transform(
		({ obj }: { obj: { hashed_token?: string; hashedToken?: string } }) => {
			return obj.hashed_token || obj.hashedToken;
		},
		{ toClassOnly: true },
	)
	@Index()
	@Column()
	hashedToken: string;

	@ApiProperty({
		name: 'expires_at',
		description: 'Token expiration timestamp',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-18T12:00:00Z',
	})
	@Expose({ name: 'expires_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { expires_at?: string | Date; expiresAt?: string | Date } }) => {
			const value: string | Date = obj.expires_at || obj.expiresAt;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Index()
	@Column({ type: 'datetime', nullable: true })
	expiresAt: Date | null;

	@ApiProperty({
		description: 'Whether the token has been revoked',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	@Index()
	@Column({ default: false })
	revoked: boolean;

	@ApiProperty({
		description: 'Token type',
		type: 'string',
		example: 'access',
	})
	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}

	@BeforeInsert()
	updateToken() {
		if (this.hashedToken && !this.hashedToken.startsWith('$2b$')) {
			this.hashedToken = hashToken(this.hashedToken);
		}
	}
}

@ApiSchema({ name: 'AuthModuleAccessToken' })
@ChildEntity()
export class AccessTokenEntity extends TokenEntity {
	@ApiProperty({
		description: 'Token owner user ID',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsOptional()
	@Type(() => UserEntity)
	@Transform(({ value }: { value: UserEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
	owner: UserEntity;

	@OneToMany(() => RefreshTokenEntity, (token) => token.parent, { cascade: true })
	children: TokenEntity[];

	get refreshToken(): RefreshTokenEntity {
		if (this.children.length !== 1 || !(this.children[0] instanceof RefreshTokenEntity)) {
			throw new AuthException('Refresh token is required');
		}

		return this.children[0];
	}

	@ApiProperty({
		description: 'Token type',
		enum: [TokenType.ACCESS],
		example: TokenType.ACCESS,
	})
	@Expose()
	get type(): TokenType {
		return TokenType.ACCESS;
	}
}

@ApiSchema({ name: 'AuthModuleRefreshToken' })
@ChildEntity()
export class RefreshTokenEntity extends TokenEntity {
	@ApiProperty({
		description: 'Token owner user ID',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsOptional()
	@Type(() => UserEntity)
	@Transform(({ value }: { value: UserEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
	owner: UserEntity;

	@ApiProperty({
		description: 'Parent access token ID',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsOptional()
	@Type(() => AccessTokenEntity)
	@Transform(({ value }: { value: AccessTokenEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => AccessTokenEntity, (token) => token.children, { onDelete: 'CASCADE' })
	parent: AccessTokenEntity;

	@ApiProperty({
		description: 'Token type',
		enum: [TokenType.REFRESH],
		example: TokenType.REFRESH,
	})
	@Expose()
	get type(): TokenType {
		return TokenType.REFRESH;
	}
}

@ApiSchema({ name: 'AuthModuleLongLiveToken' })
@ChildEntity()
export class LongLiveTokenEntity extends TokenEntity {
	@ApiProperty({
		description: 'Token owner user ID',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsOptional()
	@Type(() => UserEntity)
	@Transform(({ value }: { value: UserEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
	owner: UserEntity;

	@ApiProperty({
		description: 'Token name',
		type: 'string',
		example: 'My API Token',
	})
	@Expose()
	@IsNotEmpty()
	@IsString()
	@Column()
	name: string;

	@ApiProperty({
		description: 'Token description',
		type: 'string',
		nullable: true,
		example: 'Token for accessing the API from external services',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty()
	@IsString()
	@Column({ nullable: true })
	description: string | null;

	@ApiProperty({
		description: 'Token type',
		enum: [TokenType.LONG_LIVE],
		example: TokenType.LONG_LIVE,
	})
	@Expose()
	get type(): TokenType {
		return TokenType.LONG_LIVE;
	}
}
