import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2M_ACCESS } from '../../devices-zigbee2mqtt.constants';
import { Z2mExpose, Z2mExposeEnum } from '../../interfaces/zigbee2mqtt.interface';
import { BaseConverter } from '../base.converter';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel } from '../converter.interface';

/**
 * Button action pattern parsed from action string
 */
interface ActionPattern {
	button: string;
	pressType: string;
}

/**
 * Action/Button Converter
 *
 * Handles remote controls and button devices with action properties.
 * Parses action strings to identify button and press type.
 *
 * Action patterns supported:
 * - "button_1_single", "button_2_double", "button_3_hold"
 * - "1_single", "2_double", "3_hold"
 * - "single", "double", "hold", "release"
 * - "left_single", "right_double", "center_hold"
 * - "on", "off", "brightness_up", "brightness_down"
 *
 * Inspired by homebridge-z2m's StatelessProgrammableSwitchCreator.
 */
export class ActionConverter extends BaseConverter {
	readonly type = 'action';

	// Press type patterns to detect
	private readonly pressTypes = ['single', 'double', 'triple', 'quadruple', 'hold', 'release', 'long', 'short'];

	// Button name patterns
	private readonly buttonPatterns = [
		'button_1',
		'button_2',
		'button_3',
		'button_4',
		'button_5',
		'button_6',
		'button_7',
		'button_8',
		'left',
		'right',
		'center',
		'middle',
		'up',
		'down',
		'on',
		'off',
	];

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (this.shouldSkipExpose(expose)) {
			return this.cannotHandle();
		}

		// Action is an enum expose with property "action"
		if (expose.type !== 'enum') {
			return this.cannotHandle();
		}

		const propertyName = this.getPropertyName(expose);
		if (propertyName === 'action' || propertyName === 'click') {
			return this.canHandleWith(ConverterPriority.ACTION);
		}

		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, _context: ConversionContext): MappedChannel[] {
		const enumExpose = expose as Z2mExposeEnum;
		const values = enumExpose.values || [];

		if (values.length === 0) {
			return [];
		}

		// Analyze action values to determine button structure
		const buttonGroups = this.groupActionsByButton(values);

		// If we can identify distinct buttons, create channels per button
		if (buttonGroups.size > 1) {
			return this.createMultiButtonChannels(buttonGroups, enumExpose);
		}

		// Single button or unstructured actions - create single channel
		return this.createSingleActionChannel(values, enumExpose);
	}

	/**
	 * Group actions by their button identifier
	 */
	private groupActionsByButton(values: string[]): Map<string, string[]> {
		const groups = new Map<string, string[]>();

		for (const value of values) {
			const pattern = this.parseAction(value);
			const buttonKey = pattern?.button ?? 'default';

			let list = groups.get(buttonKey);
			if (!list) {
				list = [];
				groups.set(buttonKey, list);
			}
			list.push(value);
		}

		return groups;
	}

	/**
	 * Parse an action string to extract button and press type
	 *
	 * Examples:
	 * - "button_1_single" -> { button: "button_1", pressType: "single" }
	 * - "1_double" -> { button: "1", pressType: "double" }
	 * - "left_hold" -> { button: "left", pressType: "hold" }
	 * - "single" -> { button: "default", pressType: "single" }
	 */
	private parseAction(action: string): ActionPattern | null {
		const lower = action.toLowerCase();

		// Check for button_N_pressType pattern
		const buttonMatch = lower.match(/^(button_\d+)_(\w+)$/);
		if (buttonMatch) {
			return { button: buttonMatch[1], pressType: buttonMatch[2] };
		}

		// Check for N_pressType pattern (e.g., "1_single")
		const numericMatch = lower.match(/^(\d+)_(\w+)$/);
		if (numericMatch) {
			return { button: `button_${numericMatch[1]}`, pressType: numericMatch[2] };
		}

		// Check for named button patterns (left, right, etc.)
		for (const buttonName of this.buttonPatterns) {
			if (lower.startsWith(buttonName + '_')) {
				const pressType = lower.substring(buttonName.length + 1);
				return { button: buttonName, pressType };
			}
		}

		// Check for simple press type (just the action without button)
		for (const pressType of this.pressTypes) {
			if (lower === pressType) {
				return { button: 'default', pressType };
			}
		}

		// Could not parse - treat as unknown action
		return { button: 'default', pressType: action };
	}

	/**
	 * Create channels for multi-button remotes
	 */
	private createMultiButtonChannels(buttonGroups: Map<string, string[]>, expose: Z2mExposeEnum): MappedChannel[] {
		const channels: MappedChannel[] = [];

		for (const [button, actions] of buttonGroups) {
			const buttonName = this.formatButtonName(button);
			const identifier = `action_${button.replace(/\s+/g, '_').toLowerCase()}`;

			const property = this.createProperty({
				identifier: 'event',
				name: 'Action',
				category: PropertyCategory.EVENT,
				channelCategory: ChannelCategory.DOORBELL,
				dataType: DataTypeType.STRING,
				z2mProperty: expose.property ?? 'action',
				access: expose.access ?? Z2M_ACCESS.STATE,
				format: actions,
			});

			channels.push(
				this.createChannel({
					identifier,
					name: buttonName,
					category: ChannelCategory.DOORBELL,
					endpoint: expose.endpoint,
					properties: [property],
				}),
			);
		}

		return channels;
	}

	/**
	 * Create a single action channel for simple remotes
	 */
	private createSingleActionChannel(values: string[], expose: Z2mExposeEnum): MappedChannel[] {
		const property = this.createProperty({
			identifier: 'event',
			name: 'Action',
			category: PropertyCategory.EVENT,
			channelCategory: ChannelCategory.DOORBELL,
			dataType: DataTypeType.STRING,
			z2mProperty: expose.property ?? 'action',
			access: expose.access ?? Z2M_ACCESS.STATE,
			format: values,
		});

		return [
			this.createChannel({
				identifier: 'action',
				name: 'Remote',
				category: ChannelCategory.DOORBELL,
				endpoint: expose.endpoint,
				properties: [property],
			}),
		];
	}

	/**
	 * Format button name for display
	 */
	private formatButtonName(button: string): string {
		if (button === 'default') {
			return 'Button';
		}

		// Convert button_1 -> Button 1, left -> Left, etc.
		return button
			.replace(/_/g, ' ')
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
}
