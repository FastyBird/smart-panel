import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A vertical scrollable list with gradient overlays on the edges.
///
/// Gradients appear dynamically: the top gradient shows only when content
/// is scrolled down (hidden above), and the bottom gradient shows only when
/// more content is available below. When all content fits on screen,
/// no gradients are shown.
///
/// Example usage:
/// ```dart
/// VerticalScrollWithGradient(
///   gradientHeight: AppSpacings.pLg,
///   itemCount: items.length,
///   separatorHeight: AppSpacings.pSm,
///   padding: AppSpacings.paddingLg,
///   itemBuilder: (context, index) => MyTile(item: items[index]),
/// )
/// ```
class VerticalScrollWithGradient extends StatefulWidget {
  /// Height of the gradient overlay at top and bottom
  final double gradientHeight;

  /// Number of items in the list
  final int itemCount;

  /// Builder for each item
  final Widget Function(BuildContext context, int index) itemBuilder;

  /// Height of separator between items
  final double separatorHeight;

  /// When set, draws a divider line between items using this color.
  final Color? separatorColor;

  /// Optional background color for gradients (defaults to page background)
  final Color? backgroundColor;

  /// Padding around the list content (applied to each item horizontally,
  /// and to first/last items vertically)
  final EdgeInsetsGeometry padding;

  /// Optional scroll controller for programmatic scroll control
  final ScrollController? controller;

  /// Optional border radius to clip the widget, preventing gradient overlays
  /// from covering parent container's rounded corners.
  final BorderRadius? borderRadius;

  /// When true, the list sizes to its content instead of expanding to fill
  /// available space. Useful inside bottom sheets or other min-size layouts.
  final bool shrinkWrap;

  const VerticalScrollWithGradient({
    super.key,
    required this.gradientHeight,
    required this.itemCount,
    required this.itemBuilder,
    this.separatorHeight = 0,
    this.separatorColor,
    this.backgroundColor,
    this.padding = EdgeInsets.zero,
    this.controller,
    this.borderRadius,
    this.shrinkWrap = false,
  });

  @override
  State<VerticalScrollWithGradient> createState() =>
      _VerticalScrollWithGradientState();
}

class _VerticalScrollWithGradientState
    extends State<VerticalScrollWithGradient> {
  late ScrollController _scrollController;
  bool _ownsController = false;
  bool _showTopGradient = false;
  bool _showBottomGradient = false;

  @override
  void initState() {
    super.initState();

    _initController();

    WidgetsBinding.instance.addPostFrameCallback((_) => _checkGradients());
  }

  @override
  void didUpdateWidget(VerticalScrollWithGradient oldWidget) {
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
    final showTop = position.pixels > 0;
    final showBottom = position.pixels < position.maxScrollExtent;

    if (showTop != _showTopGradient || showBottom != _showBottomGradient) {
      setState(() {
        _showTopGradient = showTop;
        _showBottomGradient = showBottom;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = widget.backgroundColor ??
        (isDark ? AppBgColorDark.page : AppBgColorLight.page);

    // Resolve padding to get individual values
    final resolvedPadding = widget.padding.resolve(TextDirection.ltr);

    final stack = Stack(
      children: [
        // Scrollable list
        ListView.separated(
          controller: _scrollController,
          scrollDirection: Axis.vertical,
          shrinkWrap: widget.shrinkWrap,
          physics: widget.shrinkWrap ? const ClampingScrollPhysics() : null,
          itemCount: widget.itemCount,
          separatorBuilder: (_, __) => widget.separatorColor != null
              ? Divider(
                  height: widget.separatorHeight,
                  thickness: AppSpacings.scale(1),
                  color: widget.separatorColor,
                )
              : SizedBox(height: widget.separatorHeight),
          itemBuilder: (context, index) {
            final isFirst = index == 0;
            final isLast = index == widget.itemCount - 1;

            return Padding(
              padding: EdgeInsets.only(
                left: resolvedPadding.left,
                right: resolvedPadding.right,
                top: isFirst ? resolvedPadding.top : 0,
                bottom: isLast ? resolvedPadding.bottom : 0,
              ),
              child: widget.itemBuilder(context, index),
            );
          },
        ),
        // Top gradient overlay
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          height: widget.gradientHeight,
          child: IgnorePointer(
            child: AnimatedOpacity(
              opacity: _showTopGradient ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 200),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
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
        // Bottom gradient overlay
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: widget.gradientHeight,
          child: IgnorePointer(
            child: AnimatedOpacity(
              opacity: _showBottomGradient ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 200),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
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
    );

    if (widget.borderRadius != null) {
      return ClipRRect(
        borderRadius: widget.borderRadius!,
        child: stack,
      );
    }

    return stack;
  }
}
