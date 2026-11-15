import { X509Certificate } from 'crypto';
import { readFileSync } from 'fs';
import * as https from 'https';
import { join } from 'path';
import * as tls from 'tls';

import { normalizeProtectFingerprint } from '../../src/plugins/devices-unifi-protect/validators/protect-config.validators';

// TEST MATERIAL ONLY. The committed keys under test/fixtures/unifi-protect-tls protect nothing and must never be
// loaded outside tests (regenerate with generate.sh).

export const PROTECT_TEST_DIRECT_DOMAIN = 'fakeconsole.id.ui.direct';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'unifi-protect-tls');

const read = (name: string): string => readFileSync(join(FIXTURE_DIR, name), 'utf8');

const fingerprintOf = (pem: string): string => {
	const fingerprint = normalizeProtectFingerprint(new X509Certificate(pem).fingerprint256);

	if (fingerprint === null) {
		throw new Error('Test certificate has no SHA-256 fingerprint');
	}

	return fingerprint;
};

const consoleCert = read('console.crt');
const selfSignedCert = read('self-signed.crt');

export const PROTECT_TEST_TLS = {
	ca: read('ca.crt'),
	console: { cert: consoleCert, key: read('console.key') },
	selfSigned: { cert: selfSignedCert, key: read('self-signed.key') },
	fingerprints: { console: fingerprintOf(consoleCert), selfSigned: fingerprintOf(selfSignedCert) },
};

/** SNI `fakeconsole.id.ui.direct` gets the CA-signed console certificate; anything else the self-signed one. */
export function protectTlsServerOptions(): https.ServerOptions {
	const consoleContext = tls.createSecureContext(PROTECT_TEST_TLS.console);
	const selfSignedContext = tls.createSecureContext(PROTECT_TEST_TLS.selfSigned);

	return {
		key: PROTECT_TEST_TLS.selfSigned.key,
		cert: PROTECT_TEST_TLS.selfSigned.cert,
		SNICallback: (servername, callback) => {
			callback(null, servername === PROTECT_TEST_DIRECT_DOMAIN ? consoleContext : selfSignedContext);
		},
	};
}
