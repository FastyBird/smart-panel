import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_dropdown_value.dart';
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
						? DropdownButtonHideUnderline(
								child: DropdownButton2<String>(
									isExpanded: false,
									isDense: true,
									items: _getLocationItems(),
									value: _selectedLocationId,
									onChanged: (String? value) {
										_handleLocationChange(value);
									},
									customButton: SettingsDropdownValue(
										value: selectedName,
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
										maxHeight: AppSpacings.scale(250),
									),
								),
							)
						: null,
			),
		];

		return Scaffold(
			appBar: AppTopBar(title: localizations.settings_weather_settings_title),
			body: isLandscape
					? Padding(
							padding: EdgeInsets.all(AppSpacings.pLg),
							child: _buildTwoColumnLayout(cards),
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
		);
	}

	Widget _buildTwoColumnLayout(List<Widget> cards) {
		if (cards.length <= 2) {
			return Row(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					for (int i = 0; i < cards.length; i++) ...[
						if (i > 0) SizedBox(width: AppSpacings.pMd),
						Expanded(child: cards[i]),
					],
				],
			);
		}

		return ConstrainedBox(
			constraints: BoxConstraints(maxWidth: AppSpacings.scale(640)),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				mainAxisSize: MainAxisSize.min,
				children: [
					Row(
						crossAxisAlignment: CrossAxisAlignment.start,
						children: [
							Expanded(child: cards[0]),
							SizedBox(width: AppSpacings.pMd),
							Expanded(child: cards[1]),
						],
					),
					for (int i = 2; i < cards.length; i++) ...[
						SizedBox(height: AppSpacings.pMd),
						cards[i],
					],
				],
			),
		);
	}

	List<DropdownMenuItem<String>> _getLocationItems() {
		return _locations.map((location) {
			return DropdownMenuItem<String>(
				value: location.id,
				child: Text(
					location.name,
					style: TextStyle(fontSize: AppFontSize.extraSmall),
				),
			);
		}).toList();
	}

	void _handleLocationChange(String? locationId) {
		if (locationId == null) return;

		HapticFeedback.lightImpact();

		_weatherService.selectLocation(locationId);
	}
}
