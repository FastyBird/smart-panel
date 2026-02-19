import 'dart:async';

import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_dropdown_value.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_slider.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_toggle.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_two_column_layout.dart';
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

		final cards = <Widget>[
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
			// Brightness
			SettingsCard(
				icon: Icons.wb_sunny_outlined,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_display_settings_brightness_title,
				bottom: SettingsSlider(
					value: _brightness / 100.0,
					iconSmall: Icons.wb_sunny_outlined,
					iconLarge: Icons.wb_sunny,
					onChanged: (v) => _handleBrightnessChange(context, v * 100),
				),
			),
			// Screen Lock
			SettingsCard(
				icon: Icons.lock_outline,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_display_settings_screen_lock_title,
				description: localizations.settings_display_settings_screen_lock_description,
				trailing: DropdownButtonHideUnderline(
					child: DropdownButton2<int>(
						isExpanded: false,
						isDense: true,
						items: _getScreenLockDurationItems(),
						value: _screenLockDuration,
						onChanged: (int? value) async {
							_handleScreenLockDurationChange(context, value);
						},
						customButton: SettingsDropdownValue(
							value: _getScreenLockLabel(_screenLockDuration),
						),
						menuItemStyleData: MenuItemStyleData(
							padding: EdgeInsets.symmetric(
								vertical: 0,
								horizontal: AppSpacings.pLg,
							),
							height: AppSpacings.scale(35),
						),
						dropdownStyleData: DropdownStyleData(
							padding: EdgeInsets.all(0),
							maxHeight: AppSpacings.scale(200),
						),
					),
				),
			),
		];

		return AnimatedTheme(
			duration: const Duration(milliseconds: 500),
			curve: Curves.easeInOut,
			data: _isDarkMode ? AppTheme.darkTheme : AppTheme.lightTheme,
			child: Scaffold(
				appBar: AppTopBar(
					title: localizations.settings_display_settings_title,
				),
				body: isLandscape
						? Padding(
								padding: EdgeInsets.all(AppSpacings.pLg),
								child: SettingsTwoColumnLayout(cards: cards),
							)
						: ListView(
								padding: EdgeInsets.all(AppSpacings.pLg),
								children: [
									for (int i = 0; i < cards.length; i++) ...[
										cards[i],
										if (i < cards.length - 1) SizedBox(height: AppSpacings.pMd),
									],
								],
							),
			),
		);
	}

	String _getScreenLockLabel(int duration) {
		return _screenLockDurationLabels[duration] ?? '${duration}s';
	}

	List<DropdownMenuItem<int>> _getScreenLockDurationItems() {
		return _screenLockDurationLabels.entries.map((entry) {
			return DropdownMenuItem<int>(
				value: entry.key,
				child: Text(
					entry.value,
					style: TextStyle(
						fontSize: AppFontSize.extraSmall,
					),
				),
			);
		}).toList();
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
		HapticFeedback.lightImpact();

		if (!_savingBrightness) {
			setState(() {
				_brightnessBackup = _brightness;
				_savingBrightness = true;
			});
		}

		setState(() {
			_brightness = value.toInt();
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

					setState(() {
						_brightnessBackup = null;
						_savingBrightness = false;
					});

					if (!success) {
						setState(() {
							_brightness = _brightnessBackup ?? 0;
						});

						AppToast.showError(
							context,
							message: 'Save settings failed.',
						);
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
