#!/usr/bin/env tsx
/**
 * Generates documentation pages from device and channel YAML specifications.
 * This script creates MDX files for the website documentation.
 *
 * Usage: pnpm --filter @fastybird/smart-panel-website run generate:docs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths
const SPEC_DIR = path.join(__dirname, '../../../spec/devices');
const DOCS_DIR = path.join(__dirname, '../app/docs/system-architecture');
const DEVICES_DOCS_DIR = path.join(DOCS_DIR, 'supported-devices');
const CHANNELS_DOCS_DIR = path.join(DOCS_DIR, 'supported-channels');

// Load YAML files
const devicesYaml = fs.readFileSync(path.join(SPEC_DIR, 'devices.yaml'), 'utf8');
const channelsYaml = fs.readFileSync(path.join(SPEC_DIR, 'channels.yaml'), 'utf8');

interface DeviceChannel {
	category: string;
	required: boolean;
	multiple: boolean;
	description: { en: string };
}

interface DeviceSpec {
	category: string;
	name: { en: string };
	description: { en: string };
	docGroup: string;
	constraints?: {
		oneOrMoreOf?: string[][];
		mutuallyExclusiveGroups?: string[][][];
	};
	useCases?: { en: Array<{ title: string; description: string }> };
	developerNotes?: { en: string[] };
	channels: Record<string, DeviceChannel>;
}

interface ChannelProperty {
	category: string;
	required: boolean;
	description: { en: string };
	permissions?: string[];
	data_type?: string;
	data_types?: Array<{
		id: string;
		data_type: string;
		unit?: string;
		format?: unknown;
		step?: number;
		description?: { en: string };
	}>;
	unit?: string | null;
	format?: unknown;
	step?: number | null;
}

interface ChannelSpec {
	category: string;
	name: { en: string };
	description: { en: string };
	docGroup: string;
	constraints?: {
		oneOrMoreOf?: string[][];
		oneOf?: string[][];
		mutuallyExclusiveGroups?: string[][][];
	};
	properties: Record<string, ChannelProperty>;
}

const devices: Record<string, DeviceSpec> = parseYaml(devicesYaml);
const channels: Record<string, ChannelSpec> = parseYaml(channelsYaml);

// Helper functions
function toKebabCase(str: string): string {
	return str.replace(/_/g, '-');
}

function toTitleCase(str: string): string {
	return str
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPermissions(permissions?: string[]): string {
	if (!permissions) return '-';
	return permissions
		.map((p) => {
			switch (p) {
				case 'ro':
					return 'RO (Read-Only)';
				case 'rw':
					return 'RW (Read-Write)';
				case 'wo':
					return 'WO (Write-Only)';
				default:
					return p.toUpperCase();
			}
		})
		.join(', ');
}

function formatDataType(dataType?: string): string {
	if (!dataType) return '-';
	const typeMap: Record<string, string> = {
		bool: 'Bool',
		uchar: 'Uchar',
		ushort: 'Ushort',
		uint: 'Uint',
		char: 'Char',
		short: 'Short',
		int: 'Int',
		float: 'Float',
		string: 'String',
		enum: 'Enum',
		date: 'Date',
		time: 'Time',
		datetime: 'DateTime',
		color: 'Color',
		button: 'Button',
	};
	return typeMap[dataType] || dataType;
}

function formatRange(format: unknown, dataType?: string): string {
	if (format === null || format === undefined) return '-';
	if (Array.isArray(format)) {
		if (dataType === 'enum') {
			return format.map((v) => `\`${v}\``).join(', ');
		}
		if (format.length === 2) {
			const min = format[0] ?? '-∞';
			const max = format[1] ?? '∞';
			return `${min}–${max}`;
		}
		return format.join(', ');
	}
	return String(format);
}

function formatUnit(unit?: string | null): string {
	if (!unit) return '-';
	return unit;
}

// Generate device documentation page
function generateDevicePage(deviceKey: string, device: DeviceSpec): string {
	const name = device.name?.en || toTitleCase(deviceKey);
	const description = device.description?.en || '';
	const kebabName = toKebabCase(deviceKey);

	const requiredChannels = Object.entries(device.channels).filter(([_, ch]) => ch.required);
	const optionalChannels = Object.entries(device.channels).filter(([_, ch]) => !ch.required);

	let mdx = `import { Callout } from 'nextra/components'

# ${name} Device

<Callout type="info">
	**Device Category**: \`${deviceKey}\`
</Callout>

${description}

---

`;

	// Required Channels
	if (requiredChannels.length > 0) {
		mdx += `## Required Channels

These channels are mandatory for the functionality of the ${name.toLowerCase()}:

| **Channel** | **Description** | **Multiple** | **Details** |
|-------------|-----------------|--------------|-------------|
`;
		requiredChannels.forEach(([chKey, ch]) => {
			const chName = toKebabCase(ch.category);
			const desc = ch.description?.en || '';
			const multiple = ch.multiple ? 'Yes' : 'No';
			mdx += `| \`${ch.category}\` | ${desc} | ${multiple} | [See details](/docs/system-architecture/supported-channels/${chName}-channel) |\n`;
		});
		mdx += '\n---\n\n';
	}

	// Optional Channels
	if (optionalChannels.length > 0) {
		mdx += `## Optional Channels

These channels are optional and provide additional features:

| **Channel** | **Description** | **Multiple** | **Details** |
|-------------|-----------------|--------------|-------------|
`;
		optionalChannels.forEach(([chKey, ch]) => {
			const chName = toKebabCase(ch.category);
			const desc = ch.description?.en || '';
			const multiple = ch.multiple ? 'Yes' : 'No';
			mdx += `| \`${ch.category}\` | ${desc} | ${multiple} | [See details](/docs/system-architecture/supported-channels/${chName}-channel) |\n`;
		});
		mdx += '\n---\n\n';
	}

	// Constraints (if any)
	if (device.constraints) {
		mdx += `## Channel Constraints

`;
		if (device.constraints.oneOrMoreOf) {
			mdx += `### One or More Required

At least one channel from each of the following groups must be present:

`;
			device.constraints.oneOrMoreOf.forEach((group) => {
				mdx += `- ${group.map((c) => `\`${c}\``).join(' or ')}\n`;
			});
			mdx += '\n';
		}
		if (device.constraints.mutuallyExclusiveGroups) {
			mdx += `### Mutually Exclusive

The following channel groups cannot be used together:

`;
			device.constraints.mutuallyExclusiveGroups.forEach((groups) => {
				const groupStrs = groups.map((g) => g.map((c) => `\`${c}\``).join(' + '));
				mdx += `- ${groupStrs.join(' **OR** ')}\n`;
			});
			mdx += '\n';
		}
		mdx += '---\n\n';
	}

	// Use Cases
	if (device.useCases?.en && device.useCases.en.length > 0) {
		mdx += `## Use Case Scenarios

`;
		device.useCases.en.forEach((useCase, idx) => {
			mdx += `${idx + 1}. **${useCase.title}**:\n`;
			mdx += `    - ${useCase.description.trim().replace(/\n/g, '\n    - ')}\n\n`;
		});
		mdx += '---\n\n';
	}

	// Developer Notes
	if (device.developerNotes?.en && device.developerNotes.en.length > 0) {
		mdx += `## Developer Notes

`;
		device.developerNotes.en.forEach((note, idx) => {
			mdx += `${idx + 1}. ${note}\n`;
		});
		mdx += '\n';
	}

	return mdx;
}

// Generate channel documentation page
function generateChannelPage(channelKey: string, channel: ChannelSpec): string {
	const name = channel.name?.en || toTitleCase(channelKey);
	const description = channel.description?.en || '';

	const requiredProps = Object.entries(channel.properties).filter(([_, p]) => p.required);
	const optionalProps = Object.entries(channel.properties).filter(([_, p]) => !p.required);

	let mdx = `import { Callout } from 'nextra/components'

# ${name} Channel

<Callout type="info">
	**Channel Category**: \`${channelKey}\`
</Callout>

${description}

---

`;

	// Constraints (if any)
	if (channel.constraints) {
		mdx += `## Property Constraints

`;
		if (channel.constraints.oneOrMoreOf) {
			mdx += `<Callout type="warning">
At least one property from each of the following groups must be present:
${channel.constraints.oneOrMoreOf.map((group) => `- ${group.map((p) => `\`${p}\``).join(' or ')}`).join('\n')}
</Callout>

`;
		}
		if (channel.constraints.oneOf) {
			mdx += `<Callout type="warning">
Only one property from each of the following groups can be present:
${channel.constraints.oneOf.map((group) => `- ${group.map((p) => `\`${p}\``).join(' or ')}`).join('\n')}
</Callout>

`;
		}
		if (channel.constraints.mutuallyExclusiveGroups) {
			mdx += `<Callout type="warning">
The following property groups are mutually exclusive:
${channel.constraints.mutuallyExclusiveGroups
	.map((groups) => {
		const groupStrs = groups.map((g) => g.map((p) => `\`${p}\``).join(' + '));
		return `- ${groupStrs.join(' **OR** ')}`;
	})
	.join('\n')}
</Callout>

`;
		}
	}

	// Required Properties
	if (requiredProps.length > 0) {
		mdx += `## Required Properties

| **Property** | **Data Type** | **Range/Values** | **Unit** | **Permissions** |
|--------------|---------------|------------------|----------|-----------------|
`;
		requiredProps.forEach(([propKey, prop]) => {
			if (prop.data_types) {
				// Multi-type property - show first variant
				const dt = prop.data_types[0];
				mdx += `| \`${propKey}\` | ${formatDataType(dt.data_type)} | ${formatRange(dt.format, dt.data_type)} | ${formatUnit(dt.unit)} | ${formatPermissions(prop.permissions)} |\n`;
			} else {
				mdx += `| \`${propKey}\` | ${formatDataType(prop.data_type)} | ${formatRange(prop.format, prop.data_type)} | ${formatUnit(prop.unit)} | ${formatPermissions(prop.permissions)} |\n`;
			}
		});
		mdx += '\n---\n\n';

		// Required Property Details
		mdx += `### Property Details

`;
		requiredProps.forEach(([propKey, prop]) => {
			mdx += `#### \`${propKey}\`

`;
			if (prop.description?.en) {
				mdx += `${prop.description.en}\n\n`;
			}
			if (prop.data_types && prop.data_types.length > 1) {
				mdx += `This property supports multiple data type variants:\n\n`;
				prop.data_types.forEach((dt) => {
					mdx += `- **${dt.id}**: ${formatDataType(dt.data_type)}`;
					if (dt.format) mdx += ` (${formatRange(dt.format, dt.data_type)})`;
					if (dt.unit) mdx += ` in ${dt.unit}`;
					if (dt.description?.en) mdx += ` - ${dt.description.en}`;
					mdx += '\n';
				});
				mdx += '\n';
			}
		});
	}

	// Optional Properties
	if (optionalProps.length > 0) {
		mdx += `## Optional Properties

| **Property** | **Data Type** | **Range/Values** | **Unit** | **Permissions** |
|--------------|---------------|------------------|----------|-----------------|
`;
		optionalProps.forEach(([propKey, prop]) => {
			if (prop.data_types) {
				const dt = prop.data_types[0];
				mdx += `| \`${propKey}\` | ${formatDataType(dt.data_type)} | ${formatRange(dt.format, dt.data_type)} | ${formatUnit(dt.unit)} | ${formatPermissions(prop.permissions)} |\n`;
			} else {
				mdx += `| \`${propKey}\` | ${formatDataType(prop.data_type)} | ${formatRange(prop.format, prop.data_type)} | ${formatUnit(prop.unit)} | ${formatPermissions(prop.permissions)} |\n`;
			}
		});
		mdx += '\n---\n\n';

		// Optional Property Details
		mdx += `### Property Details

`;
		optionalProps.forEach(([propKey, prop]) => {
			mdx += `#### \`${propKey}\`

`;
			if (prop.description?.en) {
				mdx += `${prop.description.en}\n\n`;
			}
			if (prop.data_types && prop.data_types.length > 1) {
				mdx += `This property supports multiple data type variants:\n\n`;
				prop.data_types.forEach((dt) => {
					mdx += `- **${dt.id}**: ${formatDataType(dt.data_type)}`;
					if (dt.format) mdx += ` (${formatRange(dt.format, dt.data_type)})`;
					if (dt.unit) mdx += ` in ${dt.unit}`;
					if (dt.description?.en) mdx += ` - ${dt.description.en}`;
					mdx += '\n';
				});
				mdx += '\n';
			}
		});
	}

	return mdx;
}

// Generate _meta.js for devices
function generateDevicesMeta(): string {
	const groups: Record<string, { title: string; devices: Array<{ key: string; name: string }> }> = {
		climate_control: { title: 'Climate Control', devices: [] },
		security: { title: 'Security & Monitoring', devices: [] },
		home_automation: { title: 'Home Automation & Utilities', devices: [] },
		entertainment: { title: 'Entertainment & Media', devices: [] },
		robotics: { title: 'Robotics & Specialized', devices: [] },
		sensors: { title: 'Sensors & Environmental Monitoring', devices: [] },
		other: { title: 'Other', devices: [] },
	};

	Object.entries(devices).forEach(([key, device]) => {
		if (key === 'generic') return; // Skip generic
		const group = device.docGroup || 'other';
		const name = device.name?.en || toTitleCase(key);
		if (groups[group]) {
			groups[group].devices.push({ key, name });
		} else {
			groups.other.devices.push({ key, name });
		}
	});

	let meta = 'export default {\n';
	meta += '  overview: "Overview",\n';

	Object.entries(groups).forEach(([groupKey, group]) => {
		if (group.devices.length === 0) return;

		meta += `  "${toKebabCase(groupKey)}": {\n`;
		meta += `    type: "separator",\n`;
		meta += `    title: "${group.title}",\n`;
		meta += `  },\n`;

		group.devices.forEach(({ key, name }) => {
			const kebabKey = toKebabCase(key);
			meta += `  "${kebabKey}-device": "${name}",\n`;
		});
	});

	meta += '};\n';
	return meta;
}

// Generate _meta.js for channels
function generateChannelsMeta(): string {
	const groups: Record<string, { title: string; channels: Array<{ key: string; name: string }> }> = {
		environmental: { title: 'Environmental Monitoring', channels: [] },
		security: { title: 'Security & Safety', channels: [] },
		control: { title: 'Control & Automation', channels: [] },
		power: { title: 'Power & Energy', channels: [] },
		media: { title: 'Media & Communication', channels: [] },
		misc: { title: 'Miscellaneous', channels: [] },
		other: { title: 'Other', channels: [] },
	};

	Object.entries(channels).forEach(([key, channel]) => {
		if (key === 'generic') return; // Skip generic
		const group = channel.docGroup || 'other';
		const name = channel.name?.en || toTitleCase(key);
		if (groups[group]) {
			groups[group].channels.push({ key, name });
		} else {
			groups.other.channels.push({ key, name });
		}
	});

	let meta = 'export default {\n';
	meta += '  overview: "Overview",\n';

	Object.entries(groups).forEach(([groupKey, group]) => {
		if (group.channels.length === 0) return;

		meta += `  "${toKebabCase(groupKey)}-channels": {\n`;
		meta += `    type: "separator",\n`;
		meta += `    title: "${group.title}",\n`;
		meta += `  },\n`;

		group.channels.forEach(({ key, name }) => {
			const kebabKey = toKebabCase(key);
			meta += `  "${kebabKey}-channel": "${name}",\n`;
		});
	});

	meta += '};\n';
	return meta;
}

// Main execution
console.log('🚀 Generating documentation from spec files...\n');

// Ensure directories exist
fs.mkdirSync(DEVICES_DOCS_DIR, { recursive: true });
fs.mkdirSync(CHANNELS_DOCS_DIR, { recursive: true });

// Generate device pages
let deviceCount = 0;
Object.entries(devices).forEach(([key, device]) => {
	if (key === 'generic') return; // Skip generic device
	const kebabKey = toKebabCase(key);
	const dirPath = path.join(DEVICES_DOCS_DIR, `${kebabKey}-device`);
	const filePath = path.join(dirPath, 'page.mdx');

	fs.mkdirSync(dirPath, { recursive: true });
	fs.writeFileSync(filePath, generateDevicePage(key, device), 'utf8');
	deviceCount++;
});
console.log(`✅ Generated ${deviceCount} device documentation pages`);

// Generate device meta
fs.writeFileSync(path.join(DEVICES_DOCS_DIR, '_meta.js'), generateDevicesMeta(), 'utf8');
console.log('✅ Generated devices _meta.js');

// Generate channel pages
let channelCount = 0;
Object.entries(channels).forEach(([key, channel]) => {
	if (key === 'generic') return; // Skip generic channel
	const kebabKey = toKebabCase(key);
	const dirPath = path.join(CHANNELS_DOCS_DIR, `${kebabKey}-channel`);
	const filePath = path.join(dirPath, 'page.mdx');

	fs.mkdirSync(dirPath, { recursive: true });
	fs.writeFileSync(filePath, generateChannelPage(key, channel), 'utf8');
	channelCount++;
});
console.log(`✅ Generated ${channelCount} channel documentation pages`);

// Generate channel meta
fs.writeFileSync(path.join(CHANNELS_DOCS_DIR, '_meta.js'), generateChannelsMeta(), 'utf8');
console.log('✅ Generated channels _meta.js');

console.log('\n📖 Documentation generation complete!');
