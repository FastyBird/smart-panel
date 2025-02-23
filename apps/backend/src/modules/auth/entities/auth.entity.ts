import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BeforeInsert, ChildEntity, Column, Entity, Index, ManyToOne, OneToMany, TableInheritance } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from '../../users/entities/users.entity';
import { TokenType } from '../auth.constants';
import { AuthException } from '../auth.exceptions';
import { hashToken } from '../utils/token.utils';

@Entity('auth_module_tokens')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class TokenEntity extends BaseEntity {
	@Expose()
	@IsNotEmpty()
	@IsString()
	token?: string;

	@IsNotEmpty()
	@IsString()
	@Index()
	@Column()
	hashedToken: string;

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

	@Expose()
	@IsBoolean()
	@Index()
	@Column({ default: false })
	revoked: boolean = false;

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

@ChildEntity()
export class AccessTokenEntity extends TokenEntity {
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

	@Expose()
	get type(): TokenType {
		return TokenType.ACCESS;
	}
}

@ChildEntity()
export class RefreshTokenEntity extends TokenEntity {
	@Expose()
	@IsOptional()
	@Type(() => UserEntity)
	@Transform(({ value }: { value: UserEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
	owner: UserEntity;

	@Expose()
	@IsOptional()
	@Type(() => AccessTokenEntity)
	@Transform(({ value }: { value: AccessTokenEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => AccessTokenEntity, (token) => token.children, { onDelete: 'CASCADE' })
	parent: AccessTokenEntity;

	@Expose()
	get type(): TokenType {
		return TokenType.REFRESH;
	}
}

@ChildEntity()
export class LongLiveTokenEntity extends TokenEntity {
	@Expose()
	@IsOptional()
	@Type(() => UserEntity)
	@Transform(({ value }: { value: UserEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
	owner: UserEntity;

	@Expose()
	@IsNotEmpty()
	@IsString()
	@Column()
	name: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty()
	@IsString()
	@Column({ nullable: true })
	description: string | null;

	@Expose()
	get type(): TokenType {
		return TokenType.LONG_LIVE;
	}
}
