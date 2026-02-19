import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/system/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

class AboutPage extends StatefulWidget {
	const AboutPage({super.key});

	@override
	State<AboutPage> createState() => _AboutPageState();
}

class _AboutPageState extends State<AboutPage> {
	String _appVersion = 'Loading...';

	@override
	void initState() {
		super.initState();

		_fetchDeviceInfo();
	}

	Future<void> _fetchDeviceInfo() async {
		try {
			final packageInfo = await PackageInfo.fromPlatform();

			setState(() {
				_appVersion = packageInfo.version;
			});
		} catch (e) {
			setState(() {
				_appVersion = 'Error';
			});
		}
	}

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

		final successColor = isDark ? AppColorsDark.success : AppColorsLight.success;
		final successBg = isDark ? AppColorsDark.successLight5 : AppColorsLight.successLight9;
		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
		final infoBg = isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9;
		final textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final subColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		return Scaffold(
			backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
			body: Column(
				children: [
					PageHeader(
						title: localizations.settings_about_title,
						leading: HeaderIconButton(
							icon: Icons.arrow_back,
							onTap: () => Navigator.of(context).pop(),
						),
					),
					Expanded(
						child: isLandscape
								? _buildLandscapeBody(
										localizations, isDark, successColor, successBg, infoColor, infoBg, textColor, subColor)
								: _buildPortraitBody(
										localizations, isDark, successColor, successBg, infoColor, infoBg, textColor, subColor),
					),
				],
			),
		);
	}

	Widget _buildPortraitBody(
		AppLocalizations localizations,
		bool isDark,
		Color successColor,
		Color successBg,
		Color infoColor,
		Color infoBg,
		Color textColor,
		Color subColor,
	) {
		return SingleChildScrollView(
			padding: EdgeInsets.only(
				left: AppSpacings.pMd,
				right: AppSpacings.pMd,
				bottom: AppSpacings.pMd,
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					_buildBrandingSection(localizations, isDark, textColor, subColor),
					SizedBox(height: AppSpacings.pLg),
					_buildAboutSection(localizations, isDark, successColor, successBg),
					SizedBox(height: AppSpacings.pLg),
					_buildDeviceInfoSection(localizations, isDark, infoColor, infoBg),
				],
			),
		);
	}

	Widget _buildLandscapeBody(
		AppLocalizations localizations,
		bool isDark,
		Color successColor,
		Color successBg,
		Color infoColor,
		Color infoBg,
		Color textColor,
		Color subColor,
	) {
		return Padding(
			padding: EdgeInsets.only(
				left: AppSpacings.pMd,
				right: AppSpacings.pMd,
				bottom: AppSpacings.pMd,
			),
			child: Row(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Expanded(
						child: SingleChildScrollView(
							child: Column(
								crossAxisAlignment: CrossAxisAlignment.start,
								children: [
									_buildBrandingSection(localizations, isDark, textColor, subColor),
									SizedBox(height: AppSpacings.pLg),
									_buildAboutSection(localizations, isDark, successColor, successBg),
								],
							),
						),
					),
					SizedBox(width: AppSpacings.pMd),
					Expanded(
						child: SingleChildScrollView(
							child: _buildDeviceInfoSection(localizations, isDark, infoColor, infoBg),
						),
					),
				],
			),
		);
	}

	Widget _buildBrandingSection(
		AppLocalizations localizations,
		bool isDark,
		Color textColor,
		Color subColor,
	) {
		return Center(
			child: Column(
				spacing: AppSpacings.pMd,
				children: [
					Icon(
						MdiIcons.cogOutline,
						size: AppSpacings.scale(60),
						color: isDark ? AppColorsDark.primary : AppColorsLight.primary,
					),
					Text(
						'FastyBird! Smart Panel',
						style: TextStyle(
							fontSize: AppFontSize.large,
							fontWeight: FontWeight.bold,
							color: textColor,
						),
					),
					Text(
						'Version $_appVersion',
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							color: subColor,
						),
					),
				],
			),
		);
	}

	Widget _buildAboutSection(
		AppLocalizations localizations,
		bool isDark,
		Color successColor,
		Color successBg,
	) {
		final subColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			children: [
				SettingsCard(
					icon: Icons.info_outline,
					iconColor: successColor,
					iconBgColor: successBg,
					label: localizations.settings_about_about_heading,
					description: localizations.settings_about_about_info,
				),
				SizedBox(height: AppSpacings.pMd),
				SettingsCard(
					icon: Icons.code,
					iconColor: successColor,
					iconBgColor: successBg,
					label: localizations.settings_about_developed_by_heading,
					description: 'FastyBird Team',
					trailing: Text(
						'fastybird.com',
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							color: subColor,
						),
					),
				),
				SizedBox(height: AppSpacings.pMd),
				SettingsCard(
					icon: Icons.article_outlined,
					iconColor: successColor,
					iconBgColor: successBg,
					label: localizations.settings_about_license_heading,
					description: 'Apache License 2.0',
					trailing: Theme(
						data: ThemeData(
							outlinedButtonTheme: isDark
									? AppOutlinedButtonsDarkThemes.base
									: AppOutlinedButtonsLightThemes.base,
						),
						child: OutlinedButton(
							onPressed: () => _showLicenseDialog(context, localizations, isDark),
							style: OutlinedButton.styleFrom(
								textStyle: TextStyle(fontSize: AppFontSize.extraSmall),
								padding: EdgeInsets.symmetric(
									vertical: AppSpacings.pSm,
									horizontal: AppSpacings.pMd,
								),
							),
							child: Text(
								localizations.settings_about_show_license_button,
							),
						),
					),
				),
			],
		);
	}

	void _showLicenseDialog(
		BuildContext context,
		AppLocalizations localizations,
		bool isDark,
	) {
		final bgColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
		final borderColor = isDark ? AppFillColorDark.light : AppBorderColorLight.light;
		final titleColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final textColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		final dividerColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

		showDialog(
			context: context,
			builder: (context) {
				return Dialog(
					backgroundColor: bgColor,
					shape: RoundedRectangleBorder(
						borderRadius: BorderRadius.circular(AppBorderRadius.base),
						side: BorderSide(color: borderColor),
					),
					child: ConstrainedBox(
						constraints: BoxConstraints(
							maxWidth: AppSpacings.scale(400),
							maxHeight: MediaQuery.of(context).size.height * 0.7,
						),
						child: Column(
							mainAxisSize: MainAxisSize.min,
							crossAxisAlignment: CrossAxisAlignment.stretch,
							children: [
								Padding(
									padding: EdgeInsets.symmetric(
										horizontal: AppSpacings.pLg,
										vertical: AppSpacings.pMd,
									),
									child: Text(
										'Apache License 2.0',
										style: TextStyle(
											fontSize: AppFontSize.base,
											fontWeight: FontWeight.w600,
											color: titleColor,
										),
									),
								),
								Divider(height: 1, color: dividerColor),
								Flexible(
									child: SingleChildScrollView(
										padding: EdgeInsets.all(AppSpacings.pLg),
										child: Text(
											'Copyright 2024 FastyBird s.r.o.\n\n'
											'Licensed under the Apache License, Version 2.0 (the "License"); '
											'you may not use this file except in compliance with the License. '
											'You may obtain a copy of the License at\n\n'
											'    http://www.apache.org/licenses/LICENSE-2.0\n\n'
											'Unless required by applicable law or agreed to in writing, software '
											'distributed under the License is distributed on an "AS IS" BASIS, '
											'WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. '
											'See the License for the specific language governing permissions and '
											'limitations under the License.',
											style: TextStyle(
												fontSize: AppFontSize.extraSmall,
												color: textColor,
												height: 1.5,
											),
										),
									),
								),
							],
						),
					),
				);
			},
		);
	}

	Widget _buildDeviceInfoSection(
		AppLocalizations localizations,
		bool isDark,
		Color infoColor,
		Color infoBg,
	) {
		final infoCards = [
			_buildDeviceInfoCard(
				isDark: isDark,
				infoColor: infoColor,
				infoBg: infoBg,
				icon: MdiIcons.lan,
				title: localizations.settings_about_ip_address_title,
				builder: (systemService) {
					final ip = systemService.getSystemInfo()?.ipAddress;
					return Text(
						ip ?? localizations.value_not_available,
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							fontFamily: 'monospace',
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					);
				},
			),
			_buildDeviceInfoCard(
				isDark: isDark,
				infoColor: infoColor,
				infoBg: infoBg,
				icon: MdiIcons.server,
				title: localizations.settings_about_mac_address_title,
				builder: (systemService) {
					final mac = systemService.getSystemInfo()?.macAddress;
					return Text(
						mac ?? localizations.value_not_available,
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							fontFamily: 'monospace',
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					);
				},
			),
			_buildDeviceInfoCard(
				isDark: isDark,
				infoColor: infoColor,
				infoBg: infoBg,
				icon: MdiIcons.gauge,
				title: localizations.settings_about_cpu_usage_title,
				builder: (systemService) {
					final cpuLoad = systemService.getSystemInfo()?.cpuLoad;
					return Text(
						cpuLoad != null
								? '${NumberUtils.formatNumber(cpuLoad, 2)}%'
								: NumberUtils.formatUnavailableNumber(2),
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					);
				},
			),
			_buildDeviceInfoCard(
				isDark: isDark,
				infoColor: infoColor,
				infoBg: infoBg,
				icon: MdiIcons.memory,
				title: localizations.settings_about_memory_usage_title,
				builder: (systemService) {
					final memoryUsed = systemService.getSystemInfo()?.memoryUsed.toDouble();
					return Text(
						memoryUsed != null
								? '${NumberUtils.formatNumber(memoryUsed / 1024 / 1024, 0)} MB'
								: NumberUtils.formatUnavailableNumber(0),
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					);
				},
			),
		];

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			children: [
				SectionTitle(title: localizations.settings_about_device_information_heading, icon: MdiIcons.informationOutline),
				AppSpacings.spacingSmVertical,
				for (int i = 0; i < infoCards.length; i++) ...[
					infoCards[i],
					if (i < infoCards.length - 1) SizedBox(height: AppSpacings.pMd),
				],
			],
		);
	}

	Widget _buildDeviceInfoCard({
		required bool isDark,
		required Color infoColor,
		required Color infoBg,
		required IconData icon,
		required String title,
		required Widget Function(SystemService) builder,
	}) {
		return Consumer<SystemService>(
			builder: (context, systemService, _) {
				return SettingsCard(
					icon: icon,
					iconColor: infoColor,
					iconBgColor: infoBg,
					label: title,
					trailing: builder(systemService),
				);
			},
		);
	}
}
