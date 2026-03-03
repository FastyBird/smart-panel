import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/suggestion.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/suggestion_notification_service.dart';

/// Toast notification widget for proactive buddy suggestions.
///
/// Appears at the top of the deck UI when a new suggestion arrives.
/// Supports:
/// - Tap to open the buddy drawer
/// - Horizontal swipe to dismiss (sends `dismissed` feedback)
/// - Warning-colored border for conflicts and anomalies
/// - Neutral styling for general tips and energy suggestions
class BuddySuggestionToast extends StatefulWidget {
	const BuddySuggestionToast({super.key});

	@override
	State<BuddySuggestionToast> createState() => _BuddySuggestionToastState();
}

class _BuddySuggestionToastState extends State<BuddySuggestionToast>
		with SingleTickerProviderStateMixin {
	late final AnimationController _slideController;
	late final Animation<Offset> _slideAnimation;
	late final SuggestionNotificationService _notificationService;

	BuddySuggestionModel? _displayedSuggestion;
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
			// Notification was dismissed — animate out
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
						onTap: () => _notificationService.tapCurrent(),
						onDismiss: () => _notificationService.dismissCurrent(),
					),
				),
			),
		);
	}
}

/// Internal card widget rendering the toast content.
class _SuggestionToastCard extends StatelessWidget {
	final BuddySuggestionModel suggestion;
	final VoidCallback onTap;
	final VoidCallback onDismiss;

	const _SuggestionToastCard({
		required this.suggestion,
		required this.onTap,
		required this.onDismiss,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final isWarning = suggestion.type.isWarning;

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

		return Dismissible(
			key: ValueKey('toast_${suggestion.id}'),
			direction: DismissDirection.horizontal,
			onDismissed: (_) => onDismiss(),
			child: GestureDetector(
				onTap: onTap,
				child: Material(
					elevation: 4,
					borderRadius: BorderRadius.circular(AppBorderRadius.medium),
					shadowColor: AppShadowColor.strong,
					child: Container(
						padding: EdgeInsets.symmetric(
							horizontal: AppSpacings.pLg,
							vertical: AppSpacings.pMd,
						),
						decoration: BoxDecoration(
							color: cardBg,
							borderRadius: BorderRadius.circular(AppBorderRadius.medium),
							border: Border.all(
								color: borderColor,
								width: isWarning ? 2.0 : 1.0,
							),
						),
						child: Row(
							children: [
								Icon(
									suggestion.type.icon,
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
								SizedBox(width: AppSpacings.pSm),
								Icon(
									Icons.chevron_right,
									size: AppSpacings.scale(20),
									color: isDark
											? AppTextColorDark.placeholder
											: AppTextColorLight.placeholder,
								),
							],
						),
					),
				),
			),
		);
	}

}
