import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_slider.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_toggle.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class AudioSettingsPage extends StatefulWidget {
	const AudioSettingsPage({super.key});

	@override
	State<AudioSettingsPage> createState() => _AudioSettingsPageState();
}

class _AudioSettingsPageState extends State<AudioSettingsPage> {
	final DisplayRepository _repository = locator<DisplayRepository>();

	late bool _audioOutputSupported;
	late bool _audioInputSupported;

	late bool _hasSpeakerEnabled;
	late int _speakerVolume;
	late int? _speakerVolumeBackup;
	late bool _savingSpeakerVolume = false;

	late bool _hasMicrophoneEnabled;
	late int _microphoneVolume;
	late int? _microphoneVolumeBackup;
	late bool _savingMicrophoneVolume = false;

	Timer? _speakerDebounce;
	Timer? _microphoneDebounce;

	@override
	void initState() {
		super.initState();

		_syncStateWithRepository();

		_repository.addListener(_syncStateWithRepository);
	}

	@override
	void dispose() {
		super.dispose();

		_speakerDebounce?.cancel();
		_microphoneDebounce?.cancel();

		_repository.removeListener(_syncStateWithRepository);
	}

	void _syncStateWithRepository() {
		setState(() {
			_audioOutputSupported = _repository.audioOutputSupported;
			_audioInputSupported = _repository.audioInputSupported;
			_hasSpeakerEnabled = _repository.hasSpeakerEnabled;
			_speakerVolume = _repository.speakerVolume;
			_hasMicrophoneEnabled = _repository.hasMicrophoneEnabled;
			_microphoneVolume = _repository.microphoneVolume;
		});
	}

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Scaffold(
			backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
			body: Column(
				children: [
					PageHeader(
						title: localizations.settings_audio_settings_title,
						leading: HeaderIconButton(
							icon: Icons.arrow_back,
							onTap: () => Navigator.of(context).pop(),
						),
					),
					Expanded(
						child: !_audioOutputSupported && !_audioInputSupported
								? _buildNoAudioSupportMessage(localizations)
								: isLandscape
										? VerticalScrollWithGradient(
												itemCount: 1,
												padding: EdgeInsets.only(
													left: AppSpacings.pMd,
													right: AppSpacings.pMd,
													bottom: AppSpacings.pMd,
												),
												itemBuilder: (context, index) => Row(
													crossAxisAlignment: CrossAxisAlignment.start,
													children: [
														if (_audioOutputSupported)
															Expanded(child: _buildSpeakerColumn(localizations)),
														if (_audioOutputSupported && _audioInputSupported)
															SizedBox(width: AppSpacings.pMd),
														if (_audioInputSupported)
															Expanded(child: _buildMicColumn(localizations)),
													],
												),
											)
										: VerticalScrollWithGradient(
												itemCount: 1,
												padding: EdgeInsets.only(
													left: AppSpacings.pMd,
													right: AppSpacings.pMd,
													bottom: AppSpacings.pMd,
												),
												itemBuilder: (context, index) => Column(
													crossAxisAlignment: CrossAxisAlignment.start,
													children: [
														if (_audioOutputSupported) ...[
															..._buildSpeakerCards(localizations),
															SizedBox(height: AppSpacings.pLg),
														],
														if (_audioInputSupported)
															..._buildMicCards(localizations),
													],
												),
											),
					),
				],
			),
		);
	}

	Widget _buildNoAudioSupportMessage(AppLocalizations localizations) {
		return Center(
			child: Padding(
				padding: AppSpacings.paddingLg,
				child: Column(
					mainAxisAlignment: MainAxisAlignment.center,
					spacing: AppSpacings.pMd,
					children: [
						Icon(
							MdiIcons.volumeOff,
							size: AppSpacings.scale(48),
							color: Theme.of(context).disabledColor,
						),
						Text(
							localizations.settings_audio_settings_no_support,
							textAlign: TextAlign.center,
							style: TextStyle(
								fontSize: AppFontSize.small,
								color: Theme.of(context).disabledColor,
							),
						),
					],
				),
			),
		);
	}

	Widget _buildSpeakerColumn(AppLocalizations localizations) {
		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			mainAxisSize: MainAxisSize.min,
			children: _buildSpeakerCards(localizations),
		);
	}

	Widget _buildMicColumn(AppLocalizations localizations) {
		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			mainAxisSize: MainAxisSize.min,
			children: _buildMicCards(localizations),
		);
	}

	List<Widget> _buildSpeakerCards(AppLocalizations localizations) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
		final warningBg = isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight9;

		return [
			SectionTitle(title: localizations.settings_audio_settings_speaker_title, icon: Icons.volume_up_outlined),
			AppSpacings.spacingSmVertical,
			SettingsCard(
				icon: Icons.volume_up_outlined,
				iconColor: warningColor,
				iconBgColor: warningBg,
				label: localizations.settings_audio_settings_speaker_title,
				description: localizations.settings_audio_settings_speaker_description,
				trailing: SettingsToggle(
					value: _hasSpeakerEnabled,
					onChanged: (v) => _handleSpeakerStateChange(context, v),
				),
			),
			SizedBox(height: AppSpacings.pMd),
			SettingsCard(
				icon: Icons.volume_mute_outlined,
				iconColor: warningColor,
				iconBgColor: warningBg,
				label: localizations.settings_audio_settings_speaker_volume_title,
				description: localizations.settings_audio_settings_speaker_volume_description,
				opacity: _hasSpeakerEnabled ? 1.0 : 0.4,
				bottom: SettingsSlider(
					value: _speakerVolume / 100.0,
					iconSmall: Icons.volume_mute,
					iconLarge: Icons.volume_up,
					onChanged: _hasSpeakerEnabled
							? (v) => _handleSpeakerVolumeChange(context, v * 100)
							: null,
				),
			),
		];
	}

	List<Widget> _buildMicCards(AppLocalizations localizations) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
		final warningBg = isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight9;

		return [
			SectionTitle(title: localizations.settings_audio_settings_microphone_title, icon: Icons.mic_outlined),
			AppSpacings.spacingSmVertical,
			SettingsCard(
				icon: Icons.mic_outlined,
				iconColor: warningColor,
				iconBgColor: warningBg,
				label: localizations.settings_audio_settings_microphone_title,
				description: localizations.settings_audio_settings_microphone_description,
				trailing: SettingsToggle(
					value: _hasMicrophoneEnabled,
					onChanged: (v) => _handleMicrophoneStateChange(context, v),
				),
			),
			SizedBox(height: AppSpacings.pMd),
			SettingsCard(
				icon: Icons.mic_none,
				iconColor: warningColor,
				iconBgColor: warningBg,
				label: localizations.settings_audio_settings_microphone_volume_title,
				description: localizations.settings_audio_settings_microphone_volume_description,
				opacity: _hasMicrophoneEnabled ? 1.0 : 0.4,
				bottom: SettingsSlider(
					value: _microphoneVolume / 100.0,
					iconSmall: Icons.mic_none,
					iconLarge: Icons.mic,
					onChanged: _hasMicrophoneEnabled
							? (v) => _handleMicrophoneVolumeChange(context, v * 100)
							: null,
				),
			),
		];
	}

	Future<void> _handleSpeakerStateChange(
		BuildContext context,
		bool state,
	) async {
		HapticFeedback.lightImpact();

		setState(() {
			_hasSpeakerEnabled = !_hasSpeakerEnabled;
		});

		final success = await _repository.setSpeakerState(_hasSpeakerEnabled);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_hasSpeakerEnabled = !_hasSpeakerEnabled;
					});

					AppToast.showError(context, message: 'Save settings failed.');
				}
			},
		);
	}

	Future<void> _handleSpeakerVolumeChange(
		BuildContext context,
		double value,
	) async {
		if (!_savingSpeakerVolume) {
			setState(() {
				_speakerVolumeBackup = _speakerVolume;
				_savingSpeakerVolume = true;
			});
		}

		setState(() {
			_speakerVolume = value.round();
		});

		_speakerDebounce?.cancel();

		_speakerDebounce = Timer(
			const Duration(milliseconds: 500),
			() async {
				final success = await _repository.setSpeakerVolume(_speakerVolume);

				Future.microtask(() async {
					await Future.delayed(
						const Duration(milliseconds: 500),
					);

					if (!context.mounted) return;

					if (!success) {
						setState(() {
							_speakerVolume = _speakerVolumeBackup ?? 50;
							_speakerVolumeBackup = null;
							_savingSpeakerVolume = false;
						});

						AppToast.showError(
							context,
							message: 'Save settings failed.',
						);
					} else {
						setState(() {
							_speakerVolumeBackup = null;
							_savingSpeakerVolume = false;
						});
					}
				});
			},
		);
	}

	Future<void> _handleMicrophoneStateChange(
		BuildContext context,
		bool state,
	) async {
		HapticFeedback.lightImpact();

		setState(() {
			_hasMicrophoneEnabled = !_hasMicrophoneEnabled;
		});

		final success = await _repository.setMicrophoneState(_hasMicrophoneEnabled);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_hasMicrophoneEnabled = !_hasMicrophoneEnabled;
					});

					AppToast.showError(context, message: 'Save settings failed.');
				}
			},
		);
	}

	Future<void> _handleMicrophoneVolumeChange(
		BuildContext context,
		double value,
	) async {
		if (!_savingMicrophoneVolume) {
			setState(() {
				_microphoneVolumeBackup = _microphoneVolume;
				_savingMicrophoneVolume = true;
			});
		}

		setState(() {
			_microphoneVolume = value.round();
		});

		_microphoneDebounce?.cancel();

		_microphoneDebounce = Timer(
			const Duration(milliseconds: 500),
			() async {
				final success = await _repository.setMicrophoneVolume(_microphoneVolume);

				Future.microtask(() async {
					await Future.delayed(
						const Duration(milliseconds: 500),
					);

					if (!context.mounted) return;

					if (!success) {
						setState(() {
							_microphoneVolume = _microphoneVolumeBackup ?? 50;
							_microphoneVolumeBackup = null;
							_savingMicrophoneVolume = false;
						});

						AppToast.showError(
							context,
							message: 'Save settings failed.',
						);
					} else {
						setState(() {
							_microphoneVolumeBackup = null;
							_savingMicrophoneVolume = false;
						});
					}
				});
			},
		);
	}
}
