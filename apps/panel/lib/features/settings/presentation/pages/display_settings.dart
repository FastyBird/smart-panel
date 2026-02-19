import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_dropdown_value.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_selection_dialog.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_slider.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_toggle.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class DisplaySettingsPage extends StatefulWidget {
	const DisplaySettingsPage({super.key});

	@override
	State<DisplaySettingsPage> createState() => _DisplaySettingsPageState();
}

class _DisplaySettingsPageState extends State<DisplaySettingsPage> {
	final DisplayRepository _repository = locator<DisplayRepository>();

	late bool _isDarkMode;

	late int _brightness;
	late int? _brightnessBackup;
	late bool _savingBrightness = false;

	late int _screenLockDuration;

	late bool _hasScreenSaver;

	Timer? _debounce;

	@override
	void initState() {
		super.initState();

		_syncStateWithRepository();

		_repository.addListener(_syncStateWithRepository);
	}

	@override
	void dispose() {
		super.dispose();

		_repository.removeListener(_syncStateWithRepository);
	}

	void _syncStateWithRepository() {
		setState(() {
			_isDarkMode = _repository.hasDarkMode;
			_brightness = _repository.brightness;
			_screenLockDuration = _repository.screenLockDuration;
			_hasScreenSaver = _repository.hasScreenSaver;
		});
	}

	static const Map<int, String> _screenLockDurationLabels = {
		15: '15s',
		30: '30s',
		60: '1min',
		120: '2min',
		300: '5min',
		600: '10min',
		1800: '30min',
		0: 'Never',
	};

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

		final primaryColor = _isDarkMode ? AppColorsDark.primary : AppColorsLight.primary;
		final primaryBg = _isDarkMode ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight9;

		// Left column cards (landscape) / top cards (portrait)
		final leftCards = <Widget>[
			// Theme Mode
			SettingsCard(
				icon: Icons.dark_mode_outlined,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_display_settings_theme_mode_title,
				description: localizations.settings_display_settings_theme_mode_description,
				trailing: SettingsToggle(
					value: _isDarkMode,
					onChanged: (v) => _handleDarkModeChange(context, v),
				),
			),
			// Screen Saver
			SettingsCard(
				icon: Icons.desktop_mac_outlined,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_display_settings_screen_saver_title,
				description: localizations.settings_display_settings_screen_saver_description,
				trailing: SettingsToggle(
					value: _hasScreenSaver,
					onChanged: (v) => _handleScreenSaverChange(context, v),
				),
			),
		];

		// Screen Lock card — right column on landscape
		final screenLockCard = SettingsCard(
			icon: Icons.lock_outline,
			iconColor: primaryColor,
			iconBgColor: primaryBg,
			label: localizations.settings_display_settings_screen_lock_title,
			description: localizations.settings_display_settings_screen_lock_description,
			trailing: GestureDetector(
				onTap: () async {
					final result = await showSettingsSelectionDialog<int>(
						context: context,
						title: localizations.settings_display_settings_screen_lock_title,
						currentValue: _screenLockDuration,
						options: _screenLockDurationLabels.entries
								.map((e) => SelectionOption(value: e.key, label: e.value))
								.toList(),
					);
					if (result != null && context.mounted) {
						_handleScreenLockDurationChange(context, result);
					}
				},
				child: SettingsDropdownValue(
					value: _getScreenLockLabel(_screenLockDuration),
				),
			),
		);

		// Brightness card (with slider) — placed in right column on landscape
		final brightnessCard = SettingsCard(
			icon: Icons.wb_sunny_outlined,
			iconColor: primaryColor,
			iconBgColor: primaryBg,
			label: localizations.settings_display_settings_brightness_title,
			description: localizations.settings_display_settings_brightness_description,
			bottom: SettingsSlider(
				value: _brightness / 100.0,
				iconSmall: Icons.wb_sunny_outlined,
				iconLarge: Icons.wb_sunny,
				onChanged: (v) => _handleBrightnessChange(context, v * 100),
			),
		);

		return AnimatedTheme(
			duration: const Duration(milliseconds: 500),
			curve: Curves.easeInOut,
			data: _isDarkMode ? AppTheme.darkTheme : AppTheme.lightTheme,
			child: Scaffold(
				backgroundColor: _isDarkMode ? AppBgColorDark.page : AppBgColorLight.page,
				body: Column(
					children: [
						PageHeader(
							title: localizations.settings_display_settings_title,
							leading: HeaderIconButton(
								icon: Icons.arrow_back,
								onTap: () => Navigator.of(context).pop(),
							),
						),
						Expanded(
							child: isLandscape
									? Padding(
											padding: EdgeInsets.only(
												left: AppSpacings.pMd,
												right: AppSpacings.pMd,
												bottom: AppSpacings.pMd,
											),
											child: Row(
												crossAxisAlignment: CrossAxisAlignment.start,
												children: [
													Expanded(
														child: Column(
															mainAxisSize: MainAxisSize.min,
															children: [
																for (int i = 0; i < leftCards.length; i++) ...[
																	leftCards[i],
																	if (i < leftCards.length - 1) SizedBox(height: AppSpacings.pMd),
																],
															],
														),
													),
													SizedBox(width: AppSpacings.pMd),
													Expanded(
														child: Column(
															mainAxisSize: MainAxisSize.min,
															children: [
																brightnessCard,
																SizedBox(height: AppSpacings.pMd),
																screenLockCard,
															],
														),
													),
												],
											),
										)
									: ListView(
											padding: EdgeInsets.only(
												left: AppSpacings.pMd,
												right: AppSpacings.pMd,
												bottom: AppSpacings.pMd,
											),
											children: [
												for (int i = 0; i < leftCards.length; i++) ...[
													leftCards[i],
													if (i < leftCards.length - 1) SizedBox(height: AppSpacings.pMd),
												],
												SizedBox(height: AppSpacings.pMd),
												brightnessCard,
												SizedBox(height: AppSpacings.pMd),
												screenLockCard,
											],
										),
						),
					],
				),
			),
		);
	}

	String _getScreenLockLabel(int duration) {
		return _screenLockDurationLabels[duration] ?? '${duration}s';
	}

	Future<void> _handleDarkModeChange(
		BuildContext context,
		bool state,
	) async {
		HapticFeedback.lightImpact();

		setState(() {
			_isDarkMode = !_isDarkMode;
		});

		final success = await _repository.setDisplayDarkMode(_isDarkMode);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_isDarkMode = !_isDarkMode;
					});

					AppToast.showError(context, message: 'Save settings failed.');
				}
			},
		);
	}

	Future<void> _handleBrightnessChange(
		BuildContext context,
		double value,
	) async {
		if (!_savingBrightness) {
			setState(() {
				_brightnessBackup = _brightness;
				_savingBrightness = true;
			});
		}

		setState(() {
			_brightness = value.round();
		});

		_debounce?.cancel();

		_debounce = Timer(
			const Duration(milliseconds: 500),
			() async {
				final success = await _repository.setDisplayBrightness(_brightness);

				Future.microtask(() async {
					await Future.delayed(
						const Duration(milliseconds: 500),
					);

					if (!context.mounted) return;

					if (!success) {
						setState(() {
							_brightness = _brightnessBackup ?? 0;
							_brightnessBackup = null;
							_savingBrightness = false;
						});

						AppToast.showError(
							context,
							message: 'Save settings failed.',
						);
					} else {
						setState(() {
							_brightnessBackup = null;
							_savingBrightness = false;
						});
					}
				});
			},
		);
	}

	Future<void> _handleScreenLockDurationChange(
		BuildContext context,
		int? value,
	) async {
		if (value == null) return;

		HapticFeedback.lightImpact();

		final int backup = _screenLockDuration;

		setState(() {
			_screenLockDuration = value;
		});

		final success = await _repository.setDisplayScreenLockDuration(
			_screenLockDuration,
		);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_screenLockDuration = backup;
					});

					AppToast.showError(
						context,
						message: 'Save settings failed.',
					);
				}
			},
		);
	}

	Future<void> _handleScreenSaverChange(
		BuildContext context,
		bool state,
	) async {
		HapticFeedback.lightImpact();

		setState(() {
			_hasScreenSaver = !_hasScreenSaver;
		});

		final success = await _repository.setDisplayScreenSaver(_hasScreenSaver);

		Future.microtask(
			() async {
				await Future.delayed(
					const Duration(milliseconds: 500),
				);

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_hasScreenSaver = !_hasScreenSaver;
					});

					AppToast.showError(
						context,
						message: 'Save settings failed.',
					);
				}
			},
		);
	}
}
