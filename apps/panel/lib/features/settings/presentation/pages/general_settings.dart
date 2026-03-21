import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
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
				icon: MdiIcons.monitorDashboard,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				route: 'display-settings',
			),
			_TileData(
				label: localizations.settings_general_settings_button_language_settings,
				icon: MdiIcons.translate,
				iconColor: infoColor,
				iconBgColor: infoBg,
				route: 'language-settings',
			),
			if (hasAudioSupport)
				_TileData(
					label: localizations.settings_general_settings_button_audio_settings,
					icon: MdiIcons.volumeHigh,
					iconColor: warningColor,
					iconBgColor: warningBg,
					route: 'audio-settings',
				),
			if (hasAudioSupport)
				_TileData(
					label: localizations.settings_general_settings_button_voice_activation,
					icon: MdiIcons.accountVoice,
					iconColor: primaryColor,
					iconBgColor: primaryBg,
					route: 'voice-activation-settings',
				),
			_TileData(
				label: localizations.settings_general_settings_button_weather_settings,
				icon: MdiIcons.cloudOutline,
				iconColor: infoColor,
				iconBgColor: infoBg,
				route: 'weather-settings',
			),
			_TileData(
				label: localizations.settings_general_settings_button_about,
				icon: MdiIcons.informationOutline,
				iconColor: successColor,
				iconBgColor: successBg,
				route: 'about',
			),
			_TileData(
				label: localizations.settings_general_settings_button_maintenance,
				icon: MdiIcons.wrenchOutline,
				iconColor: dangerColor,
				iconBgColor: dangerBg,
				route: 'maintenance',
			),
		];

		return ListenableBuilder(
			listenable: locator<ScreenService>(),
			builder: (context, _) {
				final isLandscape = locator<ScreenService>().isLandscape;
				final columns = isLandscape ? 3 : 2;

				// Split tiles into rows
				final List<List<_TileData>> rows = [];
				for (var i = 0; i < tiles.length; i += columns) {
					rows.add(tiles.sublist(i, (i + columns).clamp(0, tiles.length)));
				}

				return Scaffold(
					backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
					body: Column(
						children: [
							PageHeader(
								title: localizations.settings_general_settings_title,
								leading: HeaderMainIcon(
									icon: MdiIcons.cog,
								),
								trailing: HeaderIconButton(
									icon: MdiIcons.close,
									onTap: () => Navigator.of(context, rootNavigator: true).pop(),
								),
							),
							Expanded(
								child: VerticalScrollWithGradient(
									padding: EdgeInsets.only(
										left: AppSpacings.pMd,
										right: AppSpacings.pMd,
										bottom: AppSpacings.pMd,
									),
									separatorHeight: AppSpacings.pMd,
									itemCount: rows.length,
									itemBuilder: (context, rowIndex) {
										final row = rows[rowIndex];

										return IntrinsicHeight(
											child: Row(
												children: [
													for (var i = 0; i < row.length; i++) ...[
														if (i > 0) SizedBox(width: AppSpacings.pMd),
														Expanded(
															child: AspectRatio(
																aspectRatio: isLandscape ? 1.8 : 1.3,
																child: SettingsTile(
																	label: row[i].label,
																	icon: row[i].icon,
																	iconColor: row[i].iconColor,
																	iconBgColor: row[i].iconBgColor,
																	onTap: () {
																		Navigator.of(context).pushNamed(row[i].route);
																	},
																),
															),
														),
													],
													// Fill remaining space in incomplete rows
													for (var i = row.length; i < columns; i++) ...[
														SizedBox(width: AppSpacings.pMd),
														const Expanded(child: SizedBox.shrink()),
													],
												],
											),
										);
									},
								),
							),
						],
					),
				);
			},
		);
	}
}

class _TileData {
	final String label;
	final IconData icon;
	final Color iconColor;
	final Color iconBgColor;
	final String route;

	const _TileData({
		required this.label,
		required this.icon,
		required this.iconColor,
		required this.iconBgColor,
		required this.route,
	});
}
