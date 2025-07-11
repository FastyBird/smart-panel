import fs from 'fs';
import path from 'path';

const inputPath = path.join(__dirname, '../../../spec/devices/channels.json');
const outputPath = path.join(__dirname, '../src/spec/channels.ts');

const raw = fs.readFileSync(inputPath, 'utf-8');
const json = JSON.parse(raw);

const output = `
// This file is generated from channels.json
// Do not edit manually!

export const channelsSchema = ${JSON.stringify(json, null, 2)} as const;

export type ChannelCategory = keyof typeof channelsSchema;
export type ChannelDefinition = typeof channelsSchema[ChannelCategory];
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, 'utf-8');

console.log('✅ Generated channels.ts');
