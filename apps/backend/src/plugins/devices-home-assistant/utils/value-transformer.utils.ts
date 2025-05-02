export class HomeAssistantValueTransformer {
	static toHa(attribute: string, value: string | number | boolean): string | number | boolean {
		switch (attribute) {
			case 'brightness':
				return Math.round(((value as number) / 100) * 255);
			case 'hue':
				return Math.min(360, Math.max(0, value as number));
			case 'saturation':
				return Math.round(((value as number) / 100) * 255);
			default:
				return value;
		}
	}

	static fromHa(attribute: string, value: string | number | boolean): string | number | boolean {
		switch (attribute) {
			case 'brightness':
				return Math.round(((value as number) / 255) * 100);
			case 'saturation':
				return Math.round(((value as number) / 255) * 100);
			default:
				return value;
		}
	}
}
