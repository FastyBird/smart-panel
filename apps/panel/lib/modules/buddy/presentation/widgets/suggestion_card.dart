import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/suggestion.dart';

/// Dismissible card widget for buddy suggestions.
///
/// Displays title, reason text, and accept/dismiss buttons.
/// Animates out on feedback submission.
class BuddySuggestionCard extends StatefulWidget {
	final BuddySuggestionModel suggestion;
	final Future<bool> Function(String suggestionId, String feedback) onFeedback;

	/// Called after the exit animation completes so the parent can remove
	/// the suggestion from the data layer without cutting the animation short.
	final void Function(String suggestionId)? onAnimationComplete;

	const BuddySuggestionCard({
		super.key,
		required this.suggestion,
		required this.onFeedback,
		this.onAnimationComplete,
	});

	@override
	State<BuddySuggestionCard> createState() => _BuddySuggestionCardState();
}

class _BuddySuggestionCardState extends State<BuddySuggestionCard>
	with SingleTickerProviderStateMixin {
	late final AnimationController _animController;
	late final Animation<double> _fadeAnim;
	late final Animation<double> _slideAnim;
	bool _isProcessing = false;

	@override
	void initState() {
		super.initState();
		_animController = AnimationController(
			vsync: this,
			duration: const Duration(milliseconds: 300),
		);
		_fadeAnim = Tween<double>(begin: 1.0, end: 0.0).animate(
			CurvedAnimation(parent: _animController, curve: Curves.easeOut),
		);
		_slideAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
			CurvedAnimation(parent: _animController, curve: Curves.easeOut),
		);
	}

	@override
	void dispose() {
		_animController.dispose();
		super.dispose();
	}

	Future<void> _submitFeedback(String feedback) async {
		if (_isProcessing) return;

		setState(() {
			_isProcessing = true;
		});

		final success = await widget.onFeedback(widget.suggestion.id, feedback);

		if (success && mounted) {
			await _animController.forward();

			// Notify parent to remove the suggestion from the data layer
			// only after the exit animation has fully completed.
			if (mounted) {
				widget.onAnimationComplete?.call(widget.suggestion.id);
			}
		} else if (mounted) {
			setState(() {
				_isProcessing = false;
			});
		}
	}

	IconData _iconForType(BuddySuggestionType type) {
		switch (type) {
			case BuddySuggestionType.patternSceneCreate:
				return Icons.auto_fix_high;
			case BuddySuggestionType.lightingOptimise:
				return Icons.lightbulb_outline;
			case BuddySuggestionType.anomalySensorDrift:
			case BuddySuggestionType.anomalyStuckSensor:
			case BuddySuggestionType.anomalyUnusualActivity:
				return Icons.sensors_off_outlined;
			case BuddySuggestionType.energyExcessSolar:
				return Icons.solar_power_outlined;
			case BuddySuggestionType.energyHighConsumption:
				return Icons.bolt_outlined;
			case BuddySuggestionType.energyBatteryLow:
				return Icons.battery_alert_outlined;
			case BuddySuggestionType.conflictHeatingWindow:
			case BuddySuggestionType.conflictAcWindow:
				return Icons.warning_amber_rounded;
			case BuddySuggestionType.conflictLightsUnoccupied:
				return Icons.light_outlined;
			case BuddySuggestionType.generalTip:
				return Icons.tips_and_updates_outlined;
		}
	}

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final accentColor = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			ThemeColors.primary,
		).base;

		final cardBg = isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
		final titleColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final bodyColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		return FadeTransition(
			opacity: _fadeAnim,
			child: AnimatedBuilder(
				animation: _slideAnim,
				builder: (context, child) {
					return Transform.translate(
						offset: Offset(_slideAnim.value * 100, 0),
						child: child,
					);
				},
				child: Container(
					margin: EdgeInsets.symmetric(
						horizontal: AppSpacings.pMd,
						vertical: AppSpacings.pSm,
					),
					padding: AppSpacings.paddingMd,
					decoration: BoxDecoration(
						color: cardBg,
						borderRadius: BorderRadius.circular(AppBorderRadius.medium),
						border: Border.all(color: borderColor),
					),
					child: Column(
						crossAxisAlignment: CrossAxisAlignment.start,
						children: [
							Row(
								children: [
									Icon(
										_iconForType(widget.suggestion.type),
										size: AppSpacings.scale(18),
										color: accentColor,
									),
									SizedBox(width: AppSpacings.pMd),
									Expanded(
										child: Text(
											widget.suggestion.title,
											style: TextStyle(
												fontSize: AppFontSize.base,
												fontWeight: FontWeight.w600,
												color: titleColor,
											),
										),
									),
								],
							),
							SizedBox(height: AppSpacings.pSm),
							Text(
								widget.suggestion.reason,
								style: TextStyle(
									fontSize: AppFontSize.small,
									color: bodyColor,
									height: 1.3,
								),
							),
							SizedBox(height: AppSpacings.pMd),
							Row(
								mainAxisAlignment: MainAxisAlignment.end,
								children: [
									TextButton(
										onPressed: _isProcessing
											? null
											: () => _submitFeedback('dismissed'),
										child: Text(
											'Dismiss',
											style: TextStyle(
												fontSize: AppFontSize.small,
												color: bodyColor,
											),
										),
									),
									SizedBox(width: AppSpacings.pMd),
									FilledButton.icon(
										onPressed: _isProcessing
											? null
											: () => _submitFeedback('applied'),
										icon: _isProcessing
											? SizedBox(
												width: AppSpacings.scale(14),
												height: AppSpacings.scale(14),
												child: CircularProgressIndicator(
													strokeWidth: 2,
													color: Colors.white,
												),
											)
											: Icon(
												Icons.check,
												size: AppSpacings.scale(16),
											),
										label: Text(
											'Accept',
											style: TextStyle(
												fontSize: AppFontSize.small,
											),
										),
										style: FilledButton.styleFrom(
											backgroundColor: accentColor,
											padding: EdgeInsets.symmetric(
												horizontal: AppSpacings.pLg,
												vertical: AppSpacings.pSm,
											),
											minimumSize: Size.zero,
											tapTargetSize: MaterialTapTargetSize.shrinkWrap,
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
