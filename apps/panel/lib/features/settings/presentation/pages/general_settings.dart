import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class GeneralSettingsPage extends StatelessWidget {
	final DisplayRepository _displayRepository = locator<DisplayRepository>();

	GeneralSettingsPage({super.key});

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

		final hasAudioSupport = _displayRepository.audioOutputSupported ||
				_displayRepository.audioInputSupported;

		final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final primaryBg = isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight9;
		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
		final infoBg = isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9;
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
		final warningBg = isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight9;
		final successColor = isDark ? AppColorsDark.success : AppColorsLight.success;
		final successBg = isDark ? AppColorsDark.successLight5 : AppColorsLight.successLight9;
		final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
		final dangerBg = isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight9;

		final List<_TileData> tiles = [
			_TileData(
				label: localizations.settings_general_settings_button_display_settings,
				sublabel: localizations.settings_display_settings_title,
				icon: Icons.desktop_mac_outlined,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				route: 'display-settings',
			),
			_TileData(
				label: localizations.settings_general_settings_button_language_settings,
				sublabel: localizations.settings_language_settings_title,
				icon: Icons.language,
				iconColor: infoColor,
				iconBgColor: infoBg,
				route: 'language-settings',
			),
			if (hasAudioSupport)
				_TileData(
					label: localizations.settings_general_settings_button_audio_settings,
					sublabel: localizations.settings_audio_settings_title,
					icon: Icons.volume_up_outlined,
					iconColor: warningColor,
					iconBgColor: warningBg,
					route: 'audio-settings',
				),
			_TileData(
				label: localizations.settings_general_settings_button_weather_settings,
				sublabel: localizations.settings_weather_settings_title,
				icon: Icons.cloud_outlined,
				iconColor: infoColor,
				iconBgColor: infoBg,
				route: 'weather-settings',
			),
			_TileData(
				label: localizations.settings_general_settings_button_about,
				sublabel: localizations.settings_about_title,
				icon: Icons.info_outline,
				iconColor: successColor,
				iconBgColor: successBg,
				route: 'about',
			),
			_TileData(
				label: localizations.settings_general_settings_button_maintenance,
				sublabel: localizations.settings_maintenance_title,
				icon: Icons.build_outlined,
				iconColor: dangerColor,
				iconBgColor: dangerBg,
				route: 'maintenance',
			),
		];

		final columns = isLandscape ? 3 : 2;

		return Scaffold(
			appBar: AppTopBar(
				title: localizations.settings_general_settings_title,
				icon: MdiIcons.cog,
				actions: [
					Theme(
						data: ThemeData(
							iconButtonTheme: isDark
									? AppIconButtonsDarkThemes.primary
									: AppIconButtonsLightThemes.primary,
						),
						child: IconButton(
							onPressed: () => Navigator.of(context, rootNavigator: true).pop(),
							style: IconButton.styleFrom(
								padding: AppSpacings.paddingSm,
							),
							icon: Icon(
								MdiIcons.close,
								size: AppSpacings.scale(14),
							),
						),
					)
				],
			),
			body: SingleChildScrollView(
				padding: EdgeInsets.all(AppSpacings.pLg),
				child: Align(
					alignment: Alignment.topLeft,
					child: ConstrainedBox(
						constraints: BoxConstraints(
							maxWidth: isLandscape ? AppSpacings.scale(600) : double.infinity,
						),
						child: GridView.builder(
							shrinkWrap: true,
							physics: const NeverScrollableScrollPhysics(),
							gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
								crossAxisCount: columns,
								crossAxisSpacing: AppSpacings.pMd,
								mainAxisSpacing: AppSpacings.pMd,
								childAspectRatio: isLandscape ? 1.35 : 1.2,
							),
							itemCount: tiles.length,
							itemBuilder: (context, index) {
								final tile = tiles[index];

								return SettingsTile(
									label: tile.label,
									sublabel: tile.sublabel,
									icon: tile.icon,
									iconColor: tile.iconColor,
									iconBgColor: tile.iconBgColor,
									onTap: () {
										Navigator.of(context).pushNamed(tile.route);
									},
								);
							},
						),
					),
				),
			),
		);
	}
}

class _TileData {
	final String label;
	final String sublabel;
	final IconData icon;
	final Color iconColor;
	final Color iconBgColor;
	final String route;

	const _TileData({
		required this.label,
		required this.sublabel,
		required this.icon,
		required this.iconColor,
		required this.iconBgColor,
		required this.route,
	});
}
