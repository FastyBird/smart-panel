import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_slider.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_toggle.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/wake_word_service.dart';

/// Settings page for wake word detection configuration.
///
/// Allows the user to:
/// - Enable/disable wake word detection
/// - Adjust sensitivity (amplitude threshold)
/// - View wake word engine status
class WakeWordSettingsPage extends StatefulWidget {
	const WakeWordSettingsPage({super.key});

	@override
	State<WakeWordSettingsPage> createState() => _WakeWordSettingsPageState();
}

class _WakeWordSettingsPageState extends State<WakeWordSettingsPage> {
	late final WakeWordService _wakeWordService;

	late bool _enabled;
	late double _sensitivity;

	@override
	void initState() {
		super.initState();

		_wakeWordService = locator<WakeWordService>();
		_syncState();
		_wakeWordService.addListener(_syncState);
	}

	@override
	void dispose() {
		_wakeWordService.removeListener(_syncState);
		super.dispose();
	}

	void _syncState() {
		setState(() {
			_enabled = _wakeWordService.config.enabled;
			// Convert threshold (-50 to -10 range) to 0.0-1.0 slider value.
			// -50 = most sensitive (slider = 1.0), -10 = least sensitive (slider = 0.0)
			_sensitivity = ((_wakeWordService.config.sensitivityThreshold - (-10)) / (-50 - (-10)))
				.clamp(0.0, 1.0);
		});
	}

	void _handleEnabledChanged(bool value) {
		HapticFeedback.lightImpact();

		_wakeWordService.updateConfig(
			_wakeWordService.config.copyWith(enabled: value),
		);
	}

	void _handleSensitivityChanged(double value) {
		// Convert 0.0-1.0 slider to -50 to -10 dBFS threshold
		final threshold = -10 + value * (-50 - (-10));

		setState(() {
			_sensitivity = value;
		});

		_wakeWordService.updateConfig(
			_wakeWordService.config.copyWith(sensitivityThreshold: threshold),
		);
	}

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return ListenableBuilder(
			listenable: locator<ScreenService>(),
			builder: (context, _) {
				return Scaffold(
					backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
					body: Column(
						children: [
							PageHeader(
								title: 'Wake Word',
								leading: HeaderIconButton(
									icon: Icons.arrow_back,
									onTap: () => Navigator.of(context).pop(),
								),
							),
							Expanded(
								child: VerticalScrollWithGradient(
									itemCount: 1,
									padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
									itemBuilder: (context, index) => Column(
										crossAxisAlignment: CrossAxisAlignment.start,
										children: [
											..._buildEnableSection(isDark),
											SizedBox(height: AppSpacings.pLg),
											..._buildSensitivitySection(isDark),
											SizedBox(height: AppSpacings.pLg),
											..._buildStatusSection(isDark),
										],
									),
								),
							),
						],
					),
				);
			},
		);
	}

	List<Widget> _buildEnableSection(bool isDark) {
		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
		final infoBg = isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9;

		return [
			SectionTitle(
				title: 'Wake Word Detection',
				icon: Icons.record_voice_over_outlined,
			),
			AppSpacings.spacingSmVertical,
			SettingsCard(
				icon: Icons.record_voice_over_outlined,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: 'Enable Wake Word',
				description: 'Say "${_wakeWordService.config.wakeWord}" to activate voice commands without touching the panel.',
				trailing: SettingsToggle(
					value: _enabled,
					onChanged: _handleEnabledChanged,
				),
			),
		];
	}

	List<Widget> _buildSensitivitySection(bool isDark) {
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
		final warningBg = isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight9;

		return [
			SectionTitle(
				title: 'Sensitivity',
				icon: Icons.tune,
			),
			AppSpacings.spacingSmVertical,
			SettingsCard(
				icon: Icons.tune,
				iconColor: warningColor,
				iconBgColor: warningBg,
				label: 'Detection Sensitivity',
				description: 'Higher sensitivity detects quieter speech but may trigger on background noise.',
				opacity: _enabled ? 1.0 : 0.4,
				bottom: SettingsSlider(
					value: _sensitivity,
					iconSmall: Icons.mic_none,
					iconLarge: Icons.mic,
					onChanged: _enabled ? _handleSensitivityChanged : null,
				),
			),
		];
	}

	List<Widget> _buildStatusSection(bool isDark) {
		final successColor = isDark ? AppColorsDark.success : AppColorsLight.success;
		final successBg = isDark ? AppColorsDark.successLight5 : AppColorsLight.successLight9;
		final placeholderColor = isDark
			? AppTextColorDark.placeholder
			: AppTextColorLight.placeholder;

		final state = _wakeWordService.state;
		final String statusText;
		final Color statusColor;

		switch (state) {
			case WakeWordState.stopped:
				statusText = 'Stopped';
				statusColor = placeholderColor;
			case WakeWordState.listening:
				statusText = 'Listening for wake word...';
				statusColor = successColor;
			case WakeWordState.recording:
				statusText = 'Recording speech...';
				statusColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
			case WakeWordState.processing:
				statusText = 'Processing audio...';
				statusColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
		}

		return [
			SectionTitle(
				title: 'Status',
				icon: Icons.info_outline,
			),
			AppSpacings.spacingSmVertical,
			SettingsCard(
				icon: Icons.radio_button_checked,
				iconColor: successColor,
				iconBgColor: successBg,
				label: 'Engine Status',
				description: statusText,
				trailing: Container(
					width: AppSpacings.scale(10),
					height: AppSpacings.scale(10),
					decoration: BoxDecoration(
						color: statusColor,
						shape: BoxShape.circle,
					),
				),
			),
		];
	}
}
