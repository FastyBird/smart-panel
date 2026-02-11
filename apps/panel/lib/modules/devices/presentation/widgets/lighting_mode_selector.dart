import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Lighting capabilities for mode selection.
enum LightCapability {
	power,
	brightness,
	colorTemp,
	color,
	white,
}

/// Mode selector widget for switching between lighting capabilities
/// (brightness, color temperature, color, white channel).
///
/// Used by both the lighting device detail and the light role detail page.
class LightingModeSelector extends StatelessWidget {
	final Set<LightCapability> capabilities;
	final LightCapability selectedCapability;
	final ValueChanged<LightCapability> onCapabilityChanged;
	final bool isVertical;
	final bool? showLabels;

	const LightingModeSelector({
		super.key,
		required this.capabilities,
		required this.selectedCapability,
		required this.onCapabilityChanged,
		this.isVertical = false,
		this.showLabels,
	});

	List<LightCapability> get _enabledCapabilities {
		return [
			LightCapability.brightness,
			LightCapability.colorTemp,
			LightCapability.color,
			LightCapability.white,
		].where((cap) => capabilities.contains(cap)).toList();
	}

	IconData _getCapabilityIcon(LightCapability cap) {
		switch (cap) {
			case LightCapability.brightness:
				return MdiIcons.brightness6;
			case LightCapability.colorTemp:
				return MdiIcons.thermometer;
			case LightCapability.color:
				return MdiIcons.palette;
			case LightCapability.white:
				return MdiIcons.ceilingLight;
			default:
				return MdiIcons.lightbulb;
		}
	}

	String _getCapabilityLabel(
			LightCapability cap, AppLocalizations localizations) {
		switch (cap) {
			case LightCapability.brightness:
				return localizations.light_mode_brightness;
			case LightCapability.colorTemp:
				return localizations.light_mode_temperature;
			case LightCapability.color:
				return localizations.light_mode_color;
			case LightCapability.white:
				return localizations.light_mode_white;
			default:
				return '';
		}
	}

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final enabledCaps = _enabledCapabilities;
		if (enabledCaps.length <= 1) return const SizedBox.shrink();
		final modes = enabledCaps.map((cap) {
			return ModeOption<LightCapability>(
				value: cap,
				icon: _getCapabilityIcon(cap),
				label: _getCapabilityLabel(cap, localizations),
			);
		}).toList();
		if (isVertical) return _buildVerticalSelector(context, modes);
		return _buildHorizontalSelector(context, modes);
	}

	Widget _buildVerticalSelector(
		BuildContext context,
		List<ModeOption<LightCapability>> modes,
	) {
		return ModeSelector<LightCapability>(
			modes: modes,
			selectedValue: selectedCapability,
			onChanged: (value) {
				HapticFeedback.selectionClick();
				onCapabilityChanged(value);
			},
			orientation: ModeSelectorOrientation.vertical,
			showLabels: showLabels ?? false,
		);
	}

	Widget _buildHorizontalSelector(
		BuildContext context,
		List<ModeOption<LightCapability>> modes,
	) {
		return ModeSelector<LightCapability>(
			modes: modes,
			selectedValue: selectedCapability,
			iconPlacement: ModeSelectorIconPlacement.top,
			onChanged: (value) {
				HapticFeedback.selectionClick();
				onCapabilityChanged(value);
			},
			orientation: ModeSelectorOrientation.horizontal,
			showLabels: true,
		);
	}
}
