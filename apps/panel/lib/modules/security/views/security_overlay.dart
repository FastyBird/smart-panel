import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_event_ui.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_ui.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class SecurityOverlay extends StatelessWidget {
	final VoidCallback onAcknowledge;
	final VoidCallback onOpenSecurity;

	const SecurityOverlay({
		super.key,
		required this.onAcknowledge,
		required this.onOpenSecurity,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final screenService = locator<ScreenService>();
		final localizations = AppLocalizations.of(context)!;

		return Consumer<SecurityOverlayController>(
			builder: (context, controller, _) {
				if (!controller.shouldShowOverlay) {
					return const SizedBox.shrink();
				}

				final displayAlerts = controller.overlayAlerts;
				final totalCount = controller.sortedAlerts.length;

				return Material(
					type: MaterialType.transparency,
					child: Container(
						color: isDark
							? AppOverlayColorDark.lighter
							: AppOverlayColorLight.lighter,
						child: Center(
							child: Container(
								margin: EdgeInsets.all(AppSpacings.pLg),
								padding: EdgeInsets.all(AppSpacings.pLg),
								constraints: BoxConstraints(
									maxWidth: screenService.scale(340),
								),
								decoration: BoxDecoration(
									color: SystemPagesTheme.card(isDark),
									borderRadius: BorderRadius.circular(AppBorderRadius.base),
									boxShadow: [
										BoxShadow(
											color: AppShadowColor.strong,
											blurRadius: screenService.scale(20),
											offset: Offset(0, screenService.scale(4)),
										),
									],
								),
								child: SingleChildScrollView(
									child: Column(
										mainAxisSize: MainAxisSize.min,
										children: [
										_buildIcon(isDark, screenService),
										AppSpacings.spacingLgVertical,
										Text(
											controller.overlayTitle(localizations),
											style: TextStyle(
												color: SystemPagesTheme.error(isDark),
												fontSize: AppFontSize.extraLarge,
												fontWeight: FontWeight.w600,
											),
											textAlign: TextAlign.center,
										),
										AppSpacings.spacingMdVertical,
										...displayAlerts.map(
											(alert) => _buildAlertRow(alert, isDark, screenService, context),
										),
										if (totalCount > 3)
											Padding(
												padding: EdgeInsets.only(top: AppSpacings.pSm),
												child: Text(
													'+${totalCount - 3} more alerts',
													style: TextStyle(
														color: SystemPagesTheme.textMuted(isDark),
														fontSize: AppFontSize.small,
													),
												),
											),
										SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
										SizedBox(
											width: double.infinity,
											child: Theme(
												data: Theme.of(context).copyWith(
													filledButtonTheme: isDark
														? AppFilledButtonsDarkThemes.primary
														: AppFilledButtonsLightThemes.primary,
												),
												child: FilledButton.icon(
													onPressed: onAcknowledge,
													icon: Icon(
														MdiIcons.check,
														size: AppFontSize.base,
														color: isDark
															? AppFilledButtonsDarkThemes.primaryForegroundColor
															: AppFilledButtonsLightThemes.primaryForegroundColor,
													),
													label: Text('Acknowledge'),
                          style: FilledButton.styleFrom(
                            padding: EdgeInsets.symmetric(
                              horizontal: AppSpacings.pMd,
                              vertical: AppSpacings.pMd,
                            ),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
												),
											),
										),
										AppSpacings.spacingMdVertical,
										SizedBox(
											width: double.infinity,
											child: Theme(
												data: Theme.of(context).copyWith(
													outlinedButtonTheme: isDark
														? AppOutlinedButtonsDarkThemes.primary
														: AppOutlinedButtonsLightThemes.primary,
												),
												child: OutlinedButton.icon(
													onPressed: onOpenSecurity,
													icon: Icon(
														MdiIcons.shieldAlert,
														size: AppFontSize.base,
														color: isDark
															? AppOutlinedButtonsDarkThemes.primaryForegroundColor
															: AppOutlinedButtonsLightThemes.primaryForegroundColor,
													),
													label: Text('Open Security'),
                          style: FilledButton.styleFrom(
                            padding: EdgeInsets.symmetric(
                              horizontal: AppSpacings.pMd,
                              vertical: AppSpacings.pMd,
                            ),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
												),
											),
										),
										],
									),
								),
							),
						),
					),
				);
			},
		);
	}

	Widget _buildIcon(bool isDark, ScreenService screenService) {
		return Container(
			width: screenService.scale(48),
			height: screenService.scale(48),
			decoration: BoxDecoration(
				color: SystemPagesTheme.errorLight(isDark),
				shape: BoxShape.circle,
			),
			child: Icon(
				MdiIcons.shieldAlert,
				size: screenService.scale(24),
				color: SystemPagesTheme.error(isDark),
			),
		);
	}

	Widget _buildAlertRow(
		SecurityAlertModel alert,
		bool isDark,
		ScreenService screenService,
		BuildContext context,
	) {
		final localizations = AppLocalizations.of(context)!;

		return Padding(
			padding: EdgeInsets.symmetric(vertical: AppSpacings.pXs),
			child: Row(
				children: [
					Icon(
						alertTypeIcon(alert.type),
						size: screenService.scale(16),
						color: severityColor(alert.severity, isDark),
					),
					AppSpacings.spacingSmHorizontal,
					Expanded(
						child: Text(
							alert.message ?? securityAlertTypeTitle(alert.type, localizations),
							style: TextStyle(
								color: SystemPagesTheme.textPrimary(isDark),
								fontSize: AppFontSize.small,
							),
							maxLines: 1,
							overflow: TextOverflow.ellipsis,
						),
					),
					AppSpacings.spacingSmHorizontal,
					Text(
						DatetimeUtils.formatTimeAgo(alert.timestamp, localizations),
						style: TextStyle(
							color: SystemPagesTheme.textMuted(isDark),
							fontSize: AppFontSize.extraSmall,
						),
					),
				],
			),
		);
	}
}
