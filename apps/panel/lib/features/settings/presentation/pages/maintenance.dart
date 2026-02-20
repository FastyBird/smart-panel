import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/app/routes.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_action_button.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/system/module.dart';
import 'package:flutter/material.dart';

class MaintenancePage extends StatelessWidget {
	final SystemModuleService _systemModuleService =
			locator<SystemModuleService>();

	MaintenancePage({super.key});

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

		final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final primaryBg = isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight9;
		final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
		final dangerBg = isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight9;

		final systemCards = <Widget>[
			SettingsCard(
				icon: Icons.restart_alt,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_maintenance_restart_title,
				description: localizations.settings_maintenance_restart_description,
				trailing: SettingsActionButton(
					color: primaryColor,
					bgColor: primaryBg,
					onTap: () {
						_showConfirmationDialog(
							context: context,
							title: localizations.settings_maintenance_restart_confirm_title,
							content: localizations.settings_maintenance_restart_confirm_description,
							onConfirm: () {
								locator<NavigationService>().navigateTo(
									AppRouteNames.reboot,
								);

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
				icon: Icons.power_settings_new,
				iconColor: primaryColor,
				iconBgColor: primaryBg,
				label: localizations.settings_maintenance_power_off_title,
				description: localizations.settings_maintenance_power_off_description,
				trailing: SettingsActionButton(
					color: primaryColor,
					bgColor: primaryBg,
					onTap: () {
						_showConfirmationDialog(
							context: context,
							title: localizations.settings_maintenance_power_off_confirm_title,
							content: localizations.settings_maintenance_power_off_confirm_description,
							onConfirm: () {
								locator<NavigationService>().navigateTo(
									AppRouteNames.powerOff,
								);

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
				icon: Icons.warning_amber,
				iconColor: dangerColor,
				iconBgColor: dangerBg,
				label: localizations.settings_maintenance_factory_reset_title,
				description: localizations.settings_maintenance_factory_reset_description,
				isDanger: true,
				trailing: SettingsActionButton(
					color: dangerColor,
					bgColor: dangerBg,
					onTap: () {
						_showConfirmationDialog(
							context: context,
							title: localizations.settings_maintenance_factory_reset_confirm_title,
							content: localizations.settings_maintenance_factory_reset_confirm_description,
							onConfirm: () {
								locator<NavigationService>().navigateTo(
									AppRouteNames.factoryReset,
								);

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

		return Scaffold(
			backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
			body: Column(
				children: [
					PageHeader(
						title: localizations.settings_maintenance_title,
						leading: HeaderIconButton(
							icon: Icons.arrow_back,
							onTap: () => Navigator.of(context).pop(),
						),
					),
					Expanded(
						child: isLandscape
								? VerticalScrollWithGradient(
										gradientHeight: AppSpacings.pLg,
										itemCount: 1,
										padding: EdgeInsets.only(
													left: AppSpacings.pMd,
													right: AppSpacings.pMd,
													bottom: AppSpacings.pMd,
												),
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
																icon: Icons.build_outlined,
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
																icon: Icons.warning_amber_outlined,
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
										gradientHeight: AppSpacings.pLg,
										itemCount: 1,
										padding: EdgeInsets.only(
													left: AppSpacings.pMd,
													right: AppSpacings.pMd,
													bottom: AppSpacings.pMd,
												),
										itemBuilder: (context, index) => Column(
											crossAxisAlignment: CrossAxisAlignment.start,
											children: [
												SectionTitle(
													title: localizations.settings_maintenance_system_heading,
													icon: Icons.build_outlined,
												),
												AppSpacings.spacingSmVertical,
												for (int i = 0; i < systemCards.length; i++) ...[
													systemCards[i],
													if (i < systemCards.length - 1) SizedBox(height: AppSpacings.pMd),
												],
												SizedBox(height: AppSpacings.pLg),
												SectionTitle(
													title: localizations.settings_maintenance_danger_heading,
													icon: Icons.warning_amber_outlined,
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
										vertical: AppSpacings.pSm,
										horizontal: AppSpacings.pMd,
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

	void _handleCommandError({
		required BuildContext context,
	}) {
		final localizations = AppLocalizations.of(context)!;

		Future.delayed(
			const Duration(milliseconds: 2000),
			() {
				if (!context.mounted) return;

				Navigator.of(context, rootNavigator: true).pop();

				AppToast.showError(
					context,
					message: localizations.action_failed,
				);
			},
		);
	}
}
