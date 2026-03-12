import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/suggestions/services/suggestion_notification_service.dart';
import 'package:fastybird_smart_panel/features/suggestions/types/suggestion.dart';

/// Toast notification widget for proactive suggestions.
///
/// Appears at the top of the deck UI when a new suggestion arrives.
/// Supports:
/// - Tap to trigger the provider's tap callback
/// - Horizontal swipe to dismiss (sends feedback via provider)
/// - Warning-colored border for conflicts and anomalies
/// - Neutral styling for general tips and suggestions
class SuggestionToast extends StatefulWidget {
	const SuggestionToast({super.key});

	@override
	State<SuggestionToast> createState() => _SuggestionToastState();
}

class _SuggestionToastState extends State<SuggestionToast>
		with SingleTickerProviderStateMixin {
	late final AnimationController _slideController;
	late final Animation<Offset> _slideAnimation;
	late final SuggestionNotificationService _notificationService;

	AppSuggestion? _displayedSuggestion;
	bool _isAnimatingOut = false;

	@override
	void initState() {
		super.initState();

		_slideController = AnimationController(
			vsync: this,
			duration: const Duration(milliseconds: 300),
		);
		_slideAnimation = Tween<Offset>(
			begin: const Offset(0, -1.5),
			end: Offset.zero,
		).animate(CurvedAnimation(
			parent: _slideController,
			curve: Curves.easeOut,
		));

		_notificationService = locator<SuggestionNotificationService>();
		_notificationService.addListener(_onNotificationChanged);

		// If there's already a notification when this widget mounts, show it
		if (_notificationService.hasNotification) {
			_displayedSuggestion = _notificationService.current;
			_slideController.forward(from: 0);
		}
	}

	@override
	void dispose() {
		_notificationService.removeListener(_onNotificationChanged);
		_slideController.dispose();
		super.dispose();
	}

	void _onNotificationChanged() {
		if (!mounted) return;

		final current = _notificationService.current;

		if (current != null && _displayedSuggestion?.id != current.id) {
			// New notification to show
			if (_isAnimatingOut) {
				// Wait for exit animation to finish before showing new one
				return;
			}
			setState(() {
				_displayedSuggestion = current;
			});
			_slideController.forward(from: 0);
		} else if (current == null && _displayedSuggestion != null && !_isAnimatingOut) {
			// Notification was dismissed - animate out
			_isAnimatingOut = true;
			_slideController.reverse().then((_) {
				if (mounted) {
					setState(() {
						_displayedSuggestion = null;
						_isAnimatingOut = false;
					});
					// Check if a new notification arrived while animating out
					if (_notificationService.hasNotification) {
						_onNotificationChanged();
					}
				}
			});
		}
	}

	@override
	Widget build(BuildContext context) {
		if (_displayedSuggestion == null) {
			return const SizedBox.shrink();
		}

		return Positioned(
			top: AppSpacings.pMd,
			left: AppSpacings.pLg,
			right: AppSpacings.pLg,
			child: SafeArea(
				bottom: false,
				child: SlideTransition(
					position: _slideAnimation,
					child: _SuggestionToastCard(
						suggestion: _displayedSuggestion!,
						onAccept: () => _notificationService.tapCurrent(),
						onDismiss: () => _notificationService.dismissCurrent(),
					),
				),
			),
		);
	}
}

/// Internal card widget rendering the toast content.
class _SuggestionToastCard extends StatelessWidget {
	final AppSuggestion suggestion;
	final VoidCallback onAccept;
	final VoidCallback onDismiss;

	const _SuggestionToastCard({
		required this.suggestion,
		required this.onAccept,
		required this.onDismiss,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final isWarning = suggestion.isWarning;

		final cardBg = isDark ? AppFillColorDark.base : AppFillColorLight.blank;
		final borderColor = isWarning
				? (isDark ? AppColorsDark.warning : AppColorsLight.warning)
				: (isDark ? AppBorderColorDark.light : AppBorderColorLight.light);
		final titleColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final bodyColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		final iconColor = isWarning
				? (isDark ? AppColorsDark.warning : AppColorsLight.warning)
				: ThemeColorFamily.get(
						isDark ? Brightness.dark : Brightness.light,
						ThemeColors.primary,
					).base;
		final accentColor = ThemeColorFamily.get(
				isDark ? Brightness.dark : Brightness.light,
				ThemeColors.primary,
			).base;

		return Dismissible(
			key: ValueKey('toast_${suggestion.id}'),
			direction: DismissDirection.horizontal,
			onDismissed: (_) => onDismiss(),
			child: Material(
				elevation: 4,
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
				shadowColor: AppShadowColor.strong,
				child: Container(
					padding: EdgeInsets.only(
						left: AppSpacings.pLg,
						right: AppSpacings.pMd,
						top: AppSpacings.pMd,
						bottom: AppSpacings.pSm,
					),
					decoration: BoxDecoration(
						color: cardBg,
						borderRadius: BorderRadius.circular(AppBorderRadius.medium),
						border: Border.all(
							color: borderColor,
							width: isWarning ? 2.0 : 1.0,
						),
					),
					child: Column(
						mainAxisSize: MainAxisSize.min,
						children: [
							Row(
								children: [
									Icon(
										suggestion.icon,
										size: AppSpacings.scale(22),
										color: iconColor,
									),
									SizedBox(width: AppSpacings.pMd),
									Expanded(
										child: Column(
											crossAxisAlignment: CrossAxisAlignment.start,
											mainAxisSize: MainAxisSize.min,
											children: [
												Text(
													suggestion.title,
													style: TextStyle(
														fontSize: AppFontSize.base,
														fontWeight: FontWeight.w600,
														color: titleColor,
													),
													maxLines: 1,
													overflow: TextOverflow.ellipsis,
												),
												SizedBox(height: AppSpacings.pXs),
												Text(
													suggestion.reason,
													style: TextStyle(
														fontSize: AppFontSize.small,
														color: bodyColor,
														height: 1.3,
													),
													maxLines: 2,
													overflow: TextOverflow.ellipsis,
												),
											],
										),
									),
								],
							),
							SizedBox(height: AppSpacings.pSm),
							Row(
								mainAxisAlignment: MainAxisAlignment.end,
								children: [
									TextButton(
										onPressed: onDismiss,
										style: TextButton.styleFrom(
											foregroundColor: bodyColor,
											padding: EdgeInsets.symmetric(
												horizontal: AppSpacings.pMd,
											),
											minimumSize: Size.zero,
											tapTargetSize: MaterialTapTargetSize.shrinkWrap,
										),
										child: Text(
											'Dismiss',
											style: TextStyle(fontSize: AppFontSize.small),
										),
									),
									SizedBox(width: AppSpacings.pSm),
									TextButton(
										onPressed: onAccept,
										style: TextButton.styleFrom(
											foregroundColor: accentColor,
											padding: EdgeInsets.symmetric(
												horizontal: AppSpacings.pMd,
											),
											minimumSize: Size.zero,
											tapTargetSize: MaterialTapTargetSize.shrinkWrap,
										),
										child: Text(
											suggestion.actionLabel,
											style: TextStyle(
												fontSize: AppFontSize.small,
												fontWeight: FontWeight.w600,
											),
										),
									),
								],
							),
						],
					),
				),
			),
		);
	}
}
