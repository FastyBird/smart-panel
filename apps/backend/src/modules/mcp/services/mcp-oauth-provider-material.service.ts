import { generateKeyPairSync, randomBytes } from 'node:crypto';
import {
	chmodSync,
	existsSync,
	linkSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type { JWK } from 'oidc-provider';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';
import { MCP_OAUTH_PROVIDER_MATERIAL_FILENAME } from '../mcp.constants';

const MATERIAL_VERSION = 1;
const COOKIE_KEY_PATTERN = /^[A-Za-z0-9_-]{43,}$/;

interface StoredMcpOAuthProviderMaterial {
	version: number;
	cookieKeys: string[];
	jwks: { keys: JWK[] };
}

export interface McpOAuthProviderMaterial {
	cookieKeys: string[];
	jwks: { keys: JWK[] };
}

@Injectable()
export class McpOAuthProviderMaterialService {
	private material: StoredMcpOAuthProviderMaterial | null = null;

	constructor(private readonly configService: NestConfigService) {}

	get(): McpOAuthProviderMaterial {
		const material = this.material ?? this.loadOrCreate();
		this.material = material;

		return {
			cookieKeys: [...material.cookieKeys],
			jwks: { keys: material.jwks.keys.map((key) => ({ ...key })) },
		};
	}

	private loadOrCreate(): StoredMcpOAuthProviderMaterial {
		mkdirSync(this.configPath, { recursive: true, mode: 0o700 });

		if (existsSync(this.materialPath)) return this.load();

		const material = this.generate();
		const temporaryPath = `${this.materialPath}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;

		try {
			writeFileSync(temporaryPath, `${JSON.stringify(material)}\n`, {
				encoding: 'utf8',
				flag: 'wx',
				mode: 0o600,
			});
			linkSync(temporaryPath, this.materialPath);
			unlinkSync(temporaryPath);
		} catch (error) {
			if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
			if ((error as NodeJS.ErrnoException).code === 'EEXIST') return this.load();

			throw new ServiceUnavailableException('Persistent MCP OAuth provider material could not be created');
		}

		return material;
	}

	private load(): StoredMcpOAuthProviderMaterial {
		try {
			const file = lstatSync(this.materialPath);

			if (!file.isFile() || file.isSymbolicLink()) {
				throw new Error('Provider material path is not a regular file');
			}

			if ((file.mode & 0o077) !== 0) chmodSync(this.materialPath, 0o600);

			const material = JSON.parse(readFileSync(this.materialPath, 'utf8')) as unknown;

			if (!this.isValid(material)) throw new Error('Provider material has an invalid shape');

			return material;
		} catch {
			throw new ServiceUnavailableException('Persistent MCP OAuth provider material is unavailable or invalid');
		}
	}

	private generate(): StoredMcpOAuthProviderMaterial {
		const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'jwk' });
		const signingKey: JWK = {
			...privateKey,
			alg: 'RS256',
			kid: randomBytes(16).toString('base64url'),
			use: 'sig',
		};

		return {
			version: MATERIAL_VERSION,
			cookieKeys: [randomBytes(32).toString('base64url'), randomBytes(32).toString('base64url')],
			jwks: { keys: [signingKey] },
		};
	}

	private isValid(value: unknown): value is StoredMcpOAuthProviderMaterial {
		if (!value || typeof value !== 'object') return false;

		const candidate = value as Partial<StoredMcpOAuthProviderMaterial>;
		const cookieKeys = candidate.cookieKeys;
		const keys = candidate.jwks?.keys;

		return (
			candidate.version === MATERIAL_VERSION &&
			Array.isArray(cookieKeys) &&
			cookieKeys.length >= 2 &&
			new Set(cookieKeys).size === cookieKeys.length &&
			cookieKeys.every((key) => typeof key === 'string' && COOKIE_KEY_PATTERN.test(key)) &&
			Array.isArray(keys) &&
			keys.length === 1 &&
			this.isPrivateSigningKey(keys[0])
		);
	}

	private isPrivateSigningKey(value: unknown): value is JWK {
		if (!value || typeof value !== 'object') return false;

		const key = value as Record<string, unknown>;
		const privateParts = ['n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi', 'kid'];

		return (
			key.kty === 'RSA' &&
			key.use === 'sig' &&
			key.alg === 'RS256' &&
			privateParts.every((part) => typeof key[part] === 'string' && key[part].length > 0)
		);
	}

	private get configPath(): string {
		return getEnvValue<string>(
			this.configService,
			'FB_CONFIG_PATH',
			path.resolve(__dirname, '../../../../../../var/data'),
		);
	}

	private get materialPath(): string {
		return path.resolve(this.configPath, MCP_OAUTH_PROVIDER_MATERIAL_FILENAME);
	}
}
