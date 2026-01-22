import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const inputPath = path.join(__dirname, '../../../spec/devices/channels.yaml');
const outputPath = path.join(__dirname, '../src/spec/channels.ts');

const raw = fs.readFileSync(inputPath, 'utf-8');
const yamlData = YAML.parse(raw);

// Strip documentation-only fields to keep generated code lean
function stripDocFields(obj: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		// Skip documentation-only fields
		if (['useCases', 'developerNotes', 'docGroup', 'name', 'description'].includes(key)) {
			continue;
		}

		if (value && typeof value === 'object' && !Array.isArray(value)) {
			result[key] = stripDocFields(value as Record<string, unknown>);
		} else {
			result[key] = value;
		}
	}

	return result;
}

const json = stripDocFields(yamlData);

const output = `
// This file is generated from channels.yaml
// Do not edit manually!

export const channelsSchema = ${JSON.stringify(json, null, 2)} as const;

export type ChannelCategory = keyof typeof channelsSchema;
export type ChannelDefinition = typeof channelsSchema[ChannelCategory];
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, 'utf-8');

console.log('✅ Generated channels.ts');
