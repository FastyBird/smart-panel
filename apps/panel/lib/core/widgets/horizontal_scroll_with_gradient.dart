import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A horizontal scrollable list with gradient overlays on the edges.
///
/// Gradients appear dynamically: the left gradient shows only when content
/// is scrolled right (hidden to the left), and the right gradient shows only
/// when more content is available to the right. When all content fits on
/// screen, no gradients are shown.
///
/// Example usage:
/// ```dart
/// HorizontalScrollWithGradient(
///   height: 64,
///   itemCount: items.length,
///   separatorWidth: AppSpacings.pSm,
///   padding: EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
///   itemBuilder: (context, index) => MyTile(item: items[index]),
/// )
/// ```
class HorizontalScrollWithGradient extends StatefulWidget {
	/// Height of the scrollable area
	final double height;

	/// The layout padding to extend beyond (gradient width matches this).
	/// Kept for backward compatibility — when set, the widget uses the legacy
	/// OverflowBox approach that extends beyond parent padding.
	final double layoutPadding;

	/// Number of items in the list
	final int itemCount;

	/// Builder for each item
	final Widget Function(BuildContext context, int index) itemBuilder;

	/// Width of separator between items
	final double separatorWidth;

	/// Optional background color for gradients (defaults to page background)
	final Color? backgroundColor;

	/// Width of the gradient overlay on each side (defaults to [AppSpacings.pLg])
	final double? gradientWidth;

	/// Padding around the list content (applied to first/last items)
	final EdgeInsetsGeometry padding;

	/// Optional scroll controller for programmatic scroll control
	final ScrollController? controller;

	const HorizontalScrollWithGradient({
		super.key,
		required this.height,
		this.layoutPadding = 0,
		required this.itemCount,
		required this.itemBuilder,
		this.separatorWidth = 0,
		this.backgroundColor,
		this.gradientWidth,
		this.padding = EdgeInsets.zero,
		this.controller,
	});

	@override
	State<HorizontalScrollWithGradient> createState() =>
			_HorizontalScrollWithGradientState();
}

class _HorizontalScrollWithGradientState
		extends State<HorizontalScrollWithGradient> {
	late ScrollController _scrollController;
	bool _ownsController = false;
	bool _showLeftGradient = false;
	bool _showRightGradient = false;

	@override
	void initState() {
		super.initState();

		_initController();

		WidgetsBinding.instance.addPostFrameCallback((_) => _checkGradients());
	}

	@override
	void didUpdateWidget(HorizontalScrollWithGradient oldWidget) {
		super.didUpdateWidget(oldWidget);

		if (widget.controller != oldWidget.controller) {
			_scrollController.removeListener(_checkGradients);

			if (_ownsController) {
				_scrollController.dispose();
			}

			_initController();
		}

		WidgetsBinding.instance.addPostFrameCallback((_) => _checkGradients());
	}

	@override
	void dispose() {
		_scrollController.removeListener(_checkGradients);

		if (_ownsController) {
			_scrollController.dispose();
		}

		super.dispose();
	}

	void _initController() {
		if (widget.controller != null) {
			_scrollController = widget.controller!;
			_ownsController = false;
		} else {
			_scrollController = ScrollController();
			_ownsController = true;
		}

		_scrollController.addListener(_checkGradients);
	}

	void _checkGradients() {
		if (!mounted) return;
		if (!_scrollController.hasClients) return;

		final position = _scrollController.position;
		final showLeft = position.pixels > 0;
		final showRight = position.pixels < position.maxScrollExtent;

		if (showLeft != _showLeftGradient || showRight != _showRightGradient) {
			setState(() {
				_showLeftGradient = showLeft;
				_showRightGradient = showRight;
			});
		}
	}

	@override
	Widget build(BuildContext context) {
		// Legacy mode: layoutPadding > 0 uses the OverflowBox approach
		if (widget.layoutPadding > 0) {
			return _buildLegacy(context);
		}

		return _buildModern(context);
	}

	Widget _buildModern(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final bgColor = widget.backgroundColor ??
				(isDark ? AppBgColorDark.page : AppBgColorLight.page);
		final effectiveGradientWidth = widget.gradientWidth ?? AppSpacings.pLg;

		final resolvedPadding = widget.padding.resolve(TextDirection.ltr);

		return SizedBox(
			height: widget.height,
			child: Stack(
				children: [
					ListView.separated(
						controller: _scrollController,
						scrollDirection: Axis.horizontal,
						itemCount: widget.itemCount,
						separatorBuilder: (_, __) =>
								SizedBox(width: widget.separatorWidth),
						itemBuilder: (context, index) {
							final isFirst = index == 0;
							final isLast = index == widget.itemCount - 1;

							return Padding(
								padding: EdgeInsets.only(
									left: isFirst ? resolvedPadding.left : 0,
									right: isLast ? resolvedPadding.right : 0,
								),
								child: widget.itemBuilder(context, index),
							);
						},
					),
					// Left gradient overlay
					Positioned(
						left: 0,
						top: 0,
						bottom: 0,
						width: effectiveGradientWidth,
						child: IgnorePointer(
							child: AnimatedOpacity(
								opacity: _showLeftGradient ? 1.0 : 0.0,
								duration: const Duration(milliseconds: 200),
								child: Container(
									decoration: BoxDecoration(
										gradient: LinearGradient(
											begin: Alignment.centerLeft,
											end: Alignment.centerRight,
											colors: [
												bgColor,
												bgColor.withValues(alpha: 0.7),
												bgColor.withValues(alpha: 0),
											],
											stops: const [0.0, 0.5, 1.0],
										),
									),
								),
							),
						),
					),
					// Right gradient overlay
					Positioned(
						right: 0,
						top: 0,
						bottom: 0,
						width: effectiveGradientWidth,
						child: IgnorePointer(
							child: AnimatedOpacity(
								opacity: _showRightGradient ? 1.0 : 0.0,
								duration: const Duration(milliseconds: 200),
								child: Container(
									decoration: BoxDecoration(
										gradient: LinearGradient(
											begin: Alignment.centerRight,
											end: Alignment.centerLeft,
											colors: [
												bgColor,
												bgColor.withValues(alpha: 0.7),
												bgColor.withValues(alpha: 0),
											],
											stops: const [0.0, 0.5, 1.0],
										),
									),
								),
							),
						),
					),
				],
			),
		);
	}

	/// Legacy mode for backward compatibility with existing callers that use
	/// [layoutPadding] to extend beyond parent padding.
	Widget _buildLegacy(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final bgColor = widget.backgroundColor ??
				(isDark ? AppBgColorDark.page : AppBgColorLight.page);
		final effectiveGradientWidth = widget.gradientWidth ?? widget.layoutPadding;

		return LayoutBuilder(
			builder: (context, constraints) {
				final totalWidth = constraints.maxWidth + 2 * widget.layoutPadding;

				return SizedBox(
					height: widget.height,
					child: OverflowBox(
						maxWidth: totalWidth,
						alignment: Alignment.centerLeft,
						child: Transform.translate(
							offset: Offset(-widget.layoutPadding, 0),
							child: SizedBox(
								width: totalWidth,
								height: widget.height,
								child: Stack(
									children: [
										ListView.separated(
											controller: _scrollController,
											scrollDirection: Axis.horizontal,
											itemCount: widget.itemCount,
											separatorBuilder: (_, __) =>
													SizedBox(width: widget.separatorWidth),
											itemBuilder: (context, index) {
												final isFirst = index == 0;
												final isLast = index == widget.itemCount - 1;

												return Padding(
													padding: EdgeInsets.only(
														left: isFirst ? widget.layoutPadding : 0,
														right: isLast ? widget.layoutPadding : 0,
													),
													child: widget.itemBuilder(context, index),
												);
											},
										),
										// Left gradient overlay
										Positioned(
											left: 0,
											top: 0,
											bottom: 0,
											width: effectiveGradientWidth,
											child: IgnorePointer(
												child: AnimatedOpacity(
													opacity: _showLeftGradient ? 1.0 : 0.0,
													duration: const Duration(milliseconds: 200),
													child: Container(
														decoration: BoxDecoration(
															gradient: LinearGradient(
																begin: Alignment.centerLeft,
																end: Alignment.centerRight,
																colors: [
																	bgColor,
																	bgColor.withValues(alpha: 0.7),
																	bgColor.withValues(alpha: 0),
																],
																stops: const [0.0, 0.5, 1.0],
															),
														),
													),
												),
											),
										),
										// Right gradient overlay
										Positioned(
											right: 0,
											top: 0,
											bottom: 0,
											width: effectiveGradientWidth,
											child: IgnorePointer(
												child: AnimatedOpacity(
													opacity: _showRightGradient ? 1.0 : 0.0,
													duration: const Duration(milliseconds: 200),
													child: Container(
														decoration: BoxDecoration(
															gradient: LinearGradient(
																begin: Alignment.centerRight,
																end: Alignment.centerLeft,
																colors: [
																	bgColor,
																	bgColor.withValues(alpha: 0.7),
																	bgColor.withValues(alpha: 0),
																],
																stops: const [0.0, 0.5, 1.0],
															),
														),
													),
												),
											),
										),
									],
								),
							),
						),
					),
				);
			},
		);
	}
}
