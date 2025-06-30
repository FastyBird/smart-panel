import fs from 'fs';
import path from 'path';

const inputPath = path.join(__dirname, '../../../spec/devices/devices.json');
const outputPath = path.join(__dirname, '../src/spec/devices.ts');

const raw = fs.readFileSync(inputPath, 'utf-8');
const json = JSON.parse(raw);

const output = `
// This file is generated from devices.json
// Do not edit manually!

export const devicesSchema = ${JSON.stringify(json, null, 2)} as const;

export type DeviceCategory = keyof typeof devicesSchema;
export type DeviceDefinition = typeof devicesSchema[DeviceCategory];
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, 'utf-8');

console.log('✅ Generated devices.ts');
