#!/usr/bin/env node
/**
 * Validates device and channel YAML specifications against their schemas.
 *
 * Usage: node validate.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ajv = new Ajv({ allErrors: true, strict: false });

function loadYaml(filePath) {
	const content = fs.readFileSync(filePath, 'utf8');
	return YAML.parse(content);
}

function validate(schemaPath, dataPath) {
	const schema = loadYaml(schemaPath);
	const data = loadYaml(dataPath);

	const valid = ajv.validate(schema, data);

	if (!valid) {
		console.error(`❌ Validation failed for ${path.basename(dataPath)}:`);
		console.error(ajv.errorsText(ajv.errors, { separator: '\n' }));
		return false;
	}

	console.log(`✅ ${path.basename(dataPath)} is valid`);
	return true;
}

console.log('Validating device and channel specifications...\n');

const results = [
	validate(
		path.join(__dirname, 'devices.schema.yaml'),
		path.join(__dirname, 'devices.yaml')
	),
	validate(
		path.join(__dirname, 'channels.schema.yaml'),
		path.join(__dirname, 'channels.yaml')
	),
];

if (results.every(Boolean)) {
	console.log('\n✅ All specifications are valid');
	process.exit(0);
} else {
	console.error('\n❌ Some specifications failed validation');
	process.exit(1);
}
