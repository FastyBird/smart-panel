import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_dropdown_value.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_selection_dialog.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_two_column_layout.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/weather/models/location.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class WeatherSettingsPage extends StatefulWidget {
	const WeatherSettingsPage({super.key});

	@override
	State<WeatherSettingsPage> createState() => _WeatherSettingsPageState();
}

class _WeatherSettingsPageState extends State<WeatherSettingsPage> {
	final WeatherService _weatherService = locator<WeatherService>();
	final DisplayRepository _displayRepository = locator<DisplayRepository>();

	String? _weatherLocationId;
	List<WeatherLocationModel> _locations = [];

	@override
	void initState() {
		super.initState();

		_syncState();

		_weatherService.addListener(_syncState);
		_displayRepository.addListener(_syncState);
	}

	@override
	void dispose() {
		_weatherService.removeListener(_syncState);
		_displayRepository.removeListener(_syncState);

		super.dispose();
	}

	void _syncState() {
		setState(() {
			_locations = _weatherService.locations;
			_weatherLocationId = _displayRepository.weatherLocationId;
		});
	}

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
		final infoBg = isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9;

		final systemDefaultLabel = localizations.unit_system_default;

		// Sentinel value for "System default" (primary from weather config)
		const systemDefaultValue = '';

		final selectedName = _weatherLocationId != null
				? _locations
						.where((l) => l.id == _weatherLocationId)
						.map((l) => l.name)
						.firstOrNull ?? _weatherLocationId!
				: systemDefaultLabel;

		final cards = <Widget>[
			SettingsCard(
				icon: Icons.location_on_outlined,
				iconColor: infoColor,
				iconBgColor: infoBg,
				label: localizations.settings_weather_settings_temperature_location_title,
				description: localizations.settings_weather_settings_temperature_location_description,
				trailing: _locations.length > 1
						? GestureDetector(
								onTap: () async {
									final result = await showSettingsSelectionDialog<String>(
										context: context,
										title: localizations.settings_weather_settings_temperature_location_title,
										currentValue: _weatherLocationId ?? systemDefaultValue,
										options: [
											SelectionOption(value: systemDefaultValue, label: systemDefaultLabel),
											..._locations
													.map((l) => SelectionOption(value: l.id, label: l.name)),
										],
									);
									if (result != null && context.mounted) {
										_handleLocationChange(context, result.isEmpty ? null : result);
									}
								},
								child: SettingsDropdownValue(
									value: selectedName,
								),
							)
						: null,
			),
		];

		return ListenableBuilder(
			listenable: locator<ScreenService>(),
			builder: (context, _) {
				final isLandscape = locator<ScreenService>().isLandscape;

				return Scaffold(
					backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
					body: Column(
						children: [
							PageHeader(
								title: localizations.settings_weather_settings_title,
								leading: HeaderIconButton(
									icon: Icons.arrow_back,
									onTap: () => Navigator.of(context).pop(),
								),
							),
							Expanded(
								child: isLandscape
										? VerticalScrollWithGradient(
												itemCount: 1,
												padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
												itemBuilder: (context, index) => SettingsTwoColumnLayout(cards: cards),
											)
										: VerticalScrollWithGradient(
												itemCount: cards.length,
												separatorHeight: AppSpacings.pMd,
												padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
												itemBuilder: (context, index) => cards[index],
											),
							),
						],
					),
				);
			},
		);
	}

	Future<void> _handleLocationChange(BuildContext context, String? locationId) async {
		HapticFeedback.lightImpact();

		final String? backup = _weatherLocationId;

		setState(() {
			_weatherLocationId = locationId;
		});

		final success = await _displayRepository.setWeatherLocationId(locationId);

		Future.microtask(
			() async {
				await Future.delayed(const Duration(milliseconds: 500));

				if (!context.mounted) return;

				if (!success) {
					setState(() {
						_weatherLocationId = backup;
					});

					Toast.showError(context, message: AppLocalizations.of(context)!.action_failed);
				}
			},
		);
	}
}
