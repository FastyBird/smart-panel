import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_action_button.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/displays/module.dart';
import 'package:fastybird_smart_panel/modules/system/module.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MaintenancePage extends StatelessWidget {
	final SystemModuleService _systemModuleService =
			locator<SystemModuleService>();

	MaintenancePage({super.key});

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final primaryBg = isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight9;
		final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
		final dangerBg = isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight9;

		final isGateway = _isGatewayMode();

		final restartDescription = isGateway
				? localizations.settings_maintenance_restart_display_description
				: localizations.settings_maintenance_restart_description;
		final restartConfirmTitle = isGateway
				? localizations.settings_maintenance_restart_display_confirm_title
				: localizations.settings_maintenance_restart_confirm_title;
		final restartConfirmDescription = isGateway
				? localizations.settings_maintenance_restart_display_confirm_description
				: localizations.settings_maintenance_restart_confirm_description;

		final powerOffDescription = isGateway
				? localizations.settings_maintenance_power_off_display_description
				: localizations.settings_maintenance_power_off_description;
		final powerOffConfirmTitle = isGateway
				? localizations.settings_maintenance_power_off_display_confirm_title
				: localizations.settings_maintenance_power_off_confirm_title;
		final powerOffConfirmDescription = isGateway
				? localizations.settings_maintenance_power_off_display_confirm_description
				: localizations.settings_maintenance_power_off_confirm_description;

		final factoryResetDescription = isGateway
				? localizations.settings_maintenance_factory_reset_display_description
				: localizations.settings_maintenance_factory_reset_description;
		final factoryResetConfirmTitle = isGateway
				? localizations.settings_maintenance_factory_reset_display_confirm_title
				: localizations.settings_maintenance_factory_reset_confirm_title;
		final factoryResetConfirmDescription = isGateway
				? localizations.settings_maintenance_factory_reset_display_confirm_description
				: localizations.settings_maintenance_factory_reset_confirm_description;

		final systemCards = <Widget>[
			SettingsCard(
				icon: MdiIcons.restart,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_maintenance_restart_title,
				description: restartDescription,
				trailing: SettingsActionButton(
					color: primaryColor,
					bgColor: primaryBg,
					onTap: () {
						_showConfirmationDialog(
							context: context,
							title: restartConfirmTitle,
							content: restartConfirmDescription,
							onConfirm: () {
								_systemModuleService.rebootDevice().then((bool result) {
									if (!result) {
										if (!context.mounted) return;

										_handleCommandError(context: context);
									}
								});
							},
						);
					},
				),
			),
			SettingsCard(
				icon: MdiIcons.power,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_maintenance_power_off_title,
				description: powerOffDescription,
				trailing: SettingsActionButton(
					color: primaryColor,
					bgColor: primaryBg,
					onTap: () {
						_showConfirmationDialog(
							context: context,
							title: powerOffConfirmTitle,
							content: powerOffConfirmDescription,
							onConfirm: () {
								_systemModuleService.powerOffDevice().then((bool result) {
									if (!result) {
										if (!context.mounted) return;

										_handleCommandError(context: context);
									}
								});
							},
						);
					},
				),
			),
		];

		final dangerCards = <Widget>[
			SettingsCard(
				icon: MdiIcons.alert,
				iconColor: dangerColor,
				iconBgColor: dangerBg,
				label: localizations.settings_maintenance_factory_reset_title,
				description: factoryResetDescription,
				isDanger: true,
				trailing: SettingsActionButton(
					color: dangerColor,
					bgColor: dangerBg,
					onTap: () {
						_showConfirmationDialog(
							context: context,
							title: factoryResetConfirmTitle,
							content: factoryResetConfirmDescription,
							onConfirm: () {
								_systemModuleService.factoryResetDevice().then((bool result) {
									if (!result) {
										if (!context.mounted) return;

										_handleCommandError(context: context);
									}
								});
							},
						);
					},
				),
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
								title: localizations.settings_maintenance_title,
								leading: HeaderIconButton(
									icon: MdiIcons.arrowLeft,
									onTap: () => Navigator.of(context).pop(),
								),
							),
							Expanded(
								child: isLandscape
										? VerticalScrollWithGradient(
												itemCount: 1,
												padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
												itemBuilder: (context, index) => Row(
													crossAxisAlignment: CrossAxisAlignment.start,
													children: [
														Expanded(
															child: Column(
																crossAxisAlignment: CrossAxisAlignment.start,
																mainAxisSize: MainAxisSize.min,
																children: [
																	SectionTitle(
																		title: localizations.settings_maintenance_system_heading,
																		icon: MdiIcons.wrenchOutline,
																	),
																	AppSpacings.spacingSmVertical,
																	for (int i = 0; i < systemCards.length; i++) ...[
																		systemCards[i],
																		if (i < systemCards.length - 1) SizedBox(height: AppSpacings.pMd),
																	],
																],
															),
														),
														SizedBox(width: AppSpacings.pMd),
														Expanded(
															child: Column(
																crossAxisAlignment: CrossAxisAlignment.start,
																mainAxisSize: MainAxisSize.min,
																children: [
																	SectionTitle(
																		title: localizations.settings_maintenance_danger_heading,
																		icon: MdiIcons.alertOutline,
																		color: dangerColor,
																	),
																	AppSpacings.spacingSmVertical,
																	...dangerCards,
																],
															),
														),
													],
												),
											)
										: VerticalScrollWithGradient(
												itemCount: 1,
												padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
												itemBuilder: (context, index) => Column(
													crossAxisAlignment: CrossAxisAlignment.start,
													children: [
														SectionTitle(
															title: localizations.settings_maintenance_system_heading,
															icon: MdiIcons.wrenchOutline,
														),
														AppSpacings.spacingSmVertical,
														for (int i = 0; i < systemCards.length; i++) ...[
															systemCards[i],
															if (i < systemCards.length - 1) SizedBox(height: AppSpacings.pMd),
														],
														SizedBox(height: AppSpacings.pLg),
														SectionTitle(
															title: localizations.settings_maintenance_danger_heading,
															icon: MdiIcons.alertOutline,
															color: dangerColor,
														),
														AppSpacings.spacingSmVertical,
														for (final card in dangerCards) card,
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

	void _showConfirmationDialog({
		required BuildContext context,
		required String title,
		required String content,
		required VoidCallback onConfirm,
	}) {
		final localizations = AppLocalizations.of(context)!;

		showDialog(
			context: context,
			builder: (BuildContext context) {
				return AlertDialog(
					title: Text(title),
					content: Text(
						content,
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
						),
						textAlign: TextAlign.justify,
					),
					shape: RoundedRectangleBorder(
						borderRadius: BorderRadius.circular(AppBorderRadius.medium),
					),
					actions: <Widget>[
						Theme(
							data: ThemeData(
								outlinedButtonTheme:
										Theme.of(context).brightness == Brightness.light
												? AppOutlinedButtonsLightThemes.primary
												: AppOutlinedButtonsDarkThemes.primary,
							),
							child: OutlinedButton(
								onPressed: () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.pMd,
                    vertical: AppSpacings.pMd,
                  ),
                ),
								child: Text(
									localizations.button_cancel.toUpperCase(),
									style: TextStyle(
										fontSize: AppFontSize.extraSmall,
									),
								),
							),
						),
						AppSpacings.spacingSmHorizontal,
						Theme(
							data: ThemeData(
								filledButtonTheme:
										Theme.of(context).brightness == Brightness.light
												? AppFilledButtonsLightThemes.primary
												: AppFilledButtonsDarkThemes.primary,
							),
							child: FilledButton(
								onPressed: () {
									Navigator.of(context).pop();
									onConfirm();
								},
                style: FilledButton.styleFrom(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.pMd,
                    vertical: AppSpacings.pMd,
                  ),
                ),
								child: Text(
									localizations.button_confirm.toUpperCase(),
									style: TextStyle(
										fontSize: AppFontSize.extraSmall,
									),
								),
							),
						),
					],
				);
			},
		);
	}

	bool _isGatewayMode() {
		try {
			final displaysModule = locator<DisplaysModuleService>();
			return displaysModule.isGatewayMode;
		} catch (_) {
			return false;
		}
	}

	void _handleCommandError({
		required BuildContext context,
	}) {
		final localizations = AppLocalizations.of(context)!;

		Toast.showError(
			context,
			message: localizations.action_failed,
		);
	}
}
