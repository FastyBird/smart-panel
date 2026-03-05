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
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/voice_activation_service.dart';

/// Settings page for voice activation detection configuration.
///
/// Allows the user to:
/// - Enable/disable voice activation detection
/// - Adjust sensitivity (amplitude threshold)
/// - View voice activation engine status
class VoiceActivationSettingsPage extends StatefulWidget {
	const VoiceActivationSettingsPage({super.key});

	@override
	State<VoiceActivationSettingsPage> createState() => _VoiceActivationSettingsPageState();
}

class _VoiceActivationSettingsPageState extends State<VoiceActivationSettingsPage> {
	late final VoiceActivationService _voiceActivationService;

	late bool _enabled;
	late double _sensitivity;

	@override
	void initState() {
		super.initState();

		_voiceActivationService = locator<VoiceActivationService>();
		_syncState();
		_voiceActivationService.addListener(_syncState);
	}

	@override
	void dispose() {
		_voiceActivationService.removeListener(_syncState);
		super.dispose();
	}

	void _syncState() {
		setState(() {
			_enabled = _voiceActivationService.config.enabled;
			// Convert threshold (-50 to -10 range) to 0.0-1.0 slider value.
			// -50 = most sensitive (slider = 1.0), -10 = least sensitive (slider = 0.0)
			_sensitivity = ((_voiceActivationService.config.sensitivityThreshold - (-10)) / (-50 - (-10)))
				.clamp(0.0, 1.0);
		});
	}

	Future<void> _handleEnabledChanged(bool value) async {
		HapticFeedback.lightImpact();

		await _voiceActivationService.updateConfig(
			_voiceActivationService.config.copyWith(enabled: value),
		);
	}

	void _handleSensitivityChanged(double value) {
		// Convert 0.0-1.0 slider to -50 to -10 dBFS threshold
		final threshold = -10 + value * (-50 - (-10));

		setState(() {
			_sensitivity = value;
		});

		_voiceActivationService.updateConfig(
			_voiceActivationService.config.copyWith(sensitivityThreshold: threshold),
		);
	}

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;

		return ListenableBuilder(
			listenable: locator<ScreenService>(),
			builder: (context, _) {
				return Scaffold(
					backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
					body: Column(
						children: [
							PageHeader(
								title: localizations.settings_voice_activation_settings_title,
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
											..._buildEnableSection(isDark, localizations),
											SizedBox(height: AppSpacings.pLg),
											..._buildSensitivitySection(isDark, localizations),
											SizedBox(height: AppSpacings.pLg),
											..._buildStatusSection(isDark, localizations),
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

	List<Widget> _buildEnableSection(bool isDark, AppLocalizations localizations) {
		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
		final infoBg = isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9;

		return [
			SectionTitle(
				title: localizations.settings_voice_activation_section_detection,
				icon: Icons.record_voice_over_outlined,
			),
			AppSpacings.spacingSmVertical,
			SettingsCard(
				icon: Icons.record_voice_over_outlined,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_voice_activation_enable_label,
				description: localizations.settings_voice_activation_enable_description(_voiceActivationService.config.wakeWord),
				trailing: SettingsToggle(
					value: _enabled,
					onChanged: _handleEnabledChanged,
				),
			),
		];
	}

	List<Widget> _buildSensitivitySection(bool isDark, AppLocalizations localizations) {
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
		final warningBg = isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight9;

		return [
			SectionTitle(
				title: localizations.settings_voice_activation_section_sensitivity,
				icon: Icons.tune,
			),
			AppSpacings.spacingSmVertical,
			SettingsCard(
				icon: Icons.tune,
				iconColor: warningColor,
				iconBgColor: warningBg,
				label: localizations.settings_voice_activation_sensitivity_label,
				description: localizations.settings_voice_activation_sensitivity_description,
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

	List<Widget> _buildStatusSection(bool isDark, AppLocalizations localizations) {
		final successColor = isDark ? AppColorsDark.success : AppColorsLight.success;
		final successBg = isDark ? AppColorsDark.successLight5 : AppColorsLight.successLight9;
		final placeholderColor = isDark
			? AppTextColorDark.placeholder
			: AppTextColorLight.placeholder;

		final state = _voiceActivationService.state;
		final String statusText;
		final Color statusColor;

		switch (state) {
			case VoiceActivationState.stopped:
				statusText = localizations.settings_voice_activation_status_stopped;
				statusColor = placeholderColor;
			case VoiceActivationState.listening:
				statusText = localizations.settings_voice_activation_status_listening;
				statusColor = successColor;
			case VoiceActivationState.recording:
				statusText = localizations.settings_voice_activation_status_recording;
				statusColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
			case VoiceActivationState.processing:
				statusText = localizations.settings_voice_activation_status_processing;
				statusColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
		}

		return [
			SectionTitle(
				title: localizations.settings_voice_activation_section_status,
				icon: Icons.info_outline,
			),
			AppSpacings.spacingSmVertical,
			SettingsCard(
				icon: Icons.radio_button_checked,
				iconColor: successColor,
				iconBgColor: successBg,
				label: localizations.settings_voice_activation_status_label,
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
