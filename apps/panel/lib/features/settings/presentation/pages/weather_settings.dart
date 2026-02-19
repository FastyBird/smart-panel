import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_dropdown_value.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_selection_dialog.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_two_column_layout.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
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

	String? _selectedLocationId;
	List<WeatherLocationModel> _locations = [];

	@override
	void initState() {
		super.initState();

		_syncLocations();

		_weatherService.addListener(_syncLocations);
	}

	@override
	void dispose() {
		_weatherService.removeListener(_syncLocations);

		super.dispose();
	}

	void _syncLocations() {
		setState(() {
			_locations = _weatherService.locations;
			_selectedLocationId = _weatherService.selectedLocationId;
		});
	}

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
		final infoBg = isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9;

		final selectedName = _locations
				.where((l) => l.id == _selectedLocationId)
				.map((l) => l.name)
				.firstOrNull ?? '—';

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
										currentValue: _selectedLocationId,
										options: _locations
												.map((l) => SelectionOption(value: l.id, label: l.name))
												.toList(),
									);
									if (result != null && context.mounted) {
										_handleLocationChange(result);
									}
								},
								child: SettingsDropdownValue(
									value: selectedName,
								),
							)
						: null,
			),
		];

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
								? SingleChildScrollView(
										padding: EdgeInsets.only(
													left: AppSpacings.pMd,
													right: AppSpacings.pMd,
													bottom: AppSpacings.pMd,
												),
										child: SettingsTwoColumnLayout(cards: cards),
									)
								: ListView(
										padding: EdgeInsets.only(
													left: AppSpacings.pMd,
													right: AppSpacings.pMd,
													bottom: AppSpacings.pMd,
												),
										children: [
											for (int i = 0; i < cards.length; i++) ...[
												cards[i],
												if (i < cards.length - 1) SizedBox(height: AppSpacings.pMd),
											],
										],
									),
					),
				],
			),
		);
	}

	void _handleLocationChange(String? locationId) {
		if (locationId == null) return;

		HapticFeedback.lightImpact();

		_weatherService.selectLocation(locationId);
	}
}
