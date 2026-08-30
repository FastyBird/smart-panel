import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { HomeyCloudGrantStateError } from '../errors/homey-cloud-grant.error';

import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';

const ALGORITHM = 'aes-256-gcm';
const ENVELOPE_PREFIX = 'fbsp-homey-oauth-v1';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const KEY_SALT = 'fastybird-smart-panel';
const KEY_CONTEXT = 'devices-homey/cloud-oauth-token-encryption/v1';

export type HomeyCloudCredentialField = 'access-token' | 'refresh-token';
export type HomeyCloudCredentialRecord = 'active' | 'pending';

export interface HomeyCloudCredentialContext {
	readonly field: HomeyCloudCredentialField;
	readonly recordId: string;
	readonly recordType: HomeyCloudCredentialRecord;
}

@Injectable()
export class HomeyCloudCredentialCipherService {
	constructor(private readonly clientConfig: HomeyCloudClientConfigService) {}

	encrypt(value: string, context: HomeyCloudCredentialContext): string {
		const iv = randomBytes(IV_LENGTH);
		const cipher = createCipheriv(ALGORITHM, this.getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
		cipher.setAAD(this.getAdditionalData(context));
		const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
		const authTag = cipher.getAuthTag();

		return [
			ENVELOPE_PREFIX,
			iv.toString('base64url'),
			authTag.toString('base64url'),
			encrypted.toString('base64url'),
		].join('.');
	}

	decrypt(value: string, context: HomeyCloudCredentialContext): string {
		try {
			const parts = value.split('.');
			if (parts.length !== 4 || parts[0] !== ENVELOPE_PREFIX) throw new HomeyCloudGrantStateError();

			const iv = this.decodeCanonical(parts[1]);
			const authTag = this.decodeCanonical(parts[2]);
			const encrypted = this.decodeCanonical(parts[3]);
			if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH || encrypted.length === 0) {
				throw new HomeyCloudGrantStateError();
			}

			const decipher = createDecipheriv(ALGORITHM, this.getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
			decipher.setAAD(this.getAdditionalData(context));
			decipher.setAuthTag(authTag);

			return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
		} catch {
			throw new HomeyCloudGrantStateError();
		}
	}

	isEncrypted(value: string): boolean {
		return value.startsWith(`${ENVELOPE_PREFIX}.`);
	}

	private getKey(): Buffer {
		const { clientSecret } = this.clientConfig.getConfiguration();

		return Buffer.from(hkdfSync('sha256', clientSecret, KEY_SALT, KEY_CONTEXT, KEY_LENGTH));
	}

	private getAdditionalData(context: HomeyCloudCredentialContext): Buffer {
		return Buffer.from(`${ENVELOPE_PREFIX}:${context.recordType}:${context.recordId}:${context.field}`, 'utf8');
	}

	private decodeCanonical(value: string | undefined): Buffer {
		if (!value) throw new HomeyCloudGrantStateError();

		const decoded = Buffer.from(value, 'base64url');
		if (decoded.toString('base64url') !== value) throw new HomeyCloudGrantStateError();

		return decoded;
	}
}
