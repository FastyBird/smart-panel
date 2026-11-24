import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Defines the orientation of the mode selector
enum ModeSelectorOrientation {
  /// Modes arranged horizontally in a row
  horizontal,

  /// Modes arranged vertically in a column
  vertical,
}

/// Defines where the icon is placed relative to the label
enum ModeSelectorIconPlacement {
  /// Icon on the left, label on the right (for horizontal orientation)
  left,

  /// Icon on top, label below (for vertical orientation or compact horizontal)
  top,
}

/// Represents a single mode option in the selector
class ModeOption<T> {
  /// The value this option represents
  final T value;

  /// Icon to display for this mode
  final IconData icon;

  /// Label text for this mode
  final String label;

  /// Optional override color for this specific mode
  /// If null, uses the selector's default color
  final ThemeColors? color;

  /// Optional override for the icon size (in already-scaled logical pixels).
  /// If null, the default size is scaled automatically for the current layout.
  final double? iconSize;

  /// Optional custom label builder that replaces the default [Text] widget.
  /// Receives [isSelected] and the computed [contentColor] so the custom widget
  /// can adapt to selection state and theme.
  final Widget Function(bool isSelected, Color contentColor)? labelBuilder;

  /// What screen readers hear after [label], for a [labelBuilder] that shows
  /// more than the name ("50%", "Off").
  final String? semanticValue;

  const ModeOption({
    required this.value,
    required this.icon,
    required this.label,
    this.color,
    this.iconSize,
    this.labelBuilder,
    this.semanticValue,
  });
}

/// The segmented control (docs/display-ui-design-spec.md §5): one button per
/// mode, 36 high with a 4 px gap, radius 8. Unselected segments sit on
/// `fill.light` with a `border.light` outline; the selected one takes the
/// soft tint and the outline and label of the accent, or of the domain colour
/// inside a domain view ([color]).
///
/// Horizontal it is the segmented control (arm, range, theme, presets);
/// vertical the same buttons stack. Labels hide on their own when a segment
/// is narrower than [minButtonWidth]. A row too narrow for every segment to
/// keep the 36 px touch floor scrolls sideways instead of compressing.
///
/// - [ControlState.pending]: the selected segment shows the refresh icon,
///   and screen readers hear "Sending".
/// - [ControlState.unconfirmed]: it shows the warning alert icon, and screen
///   readers hear "Not confirmed".
/// - [ControlState.disabled]: every segment is on `fill.light` in
///   `text.disabled` and nothing reacts.
///
/// Each segment takes focus and selects on Enter and Space.
class ModeSelector<T> extends StatefulWidget {
  /// List of mode options to display
  final List<ModeOption<T>> modes;

  /// Currently selected value (null means no selection)
  final T? selectedValue;

  /// Callback when a mode is selected
  final ValueChanged<T> onChanged;

  /// Orientation of the selector (horizontal or vertical)
  final ModeSelectorOrientation orientation;

  /// Where to place the icon relative to the label
  final ModeSelectorIconPlacement iconPlacement;

  /// The selected segment's colour (can be overridden per mode):
  /// [ThemeColors.primary] (the default) is the accent, a domain key is that
  /// domain's colour.
  final ThemeColors color;

  /// Whether to show labels (if false, only icons are shown)
  /// When null, labels are shown/hidden automatically based on available space
  final bool? showLabels;

  /// Minimum width for each mode button in horizontal orientation.
  /// When [scrollable] is true, this is enforced so labels don't shrink to ellipsis;
  /// otherwise used only to decide if labels should be hidden when space is tight.
  final double minButtonWidth;

  /// Minimum height for each mode button in vertical scrollable orientation.
  final double minButtonHeight;

  /// Whether the selector should be scrollable when content doesn't fit
  final bool scrollable;

  /// Whether to show icons (defaults to true)
  /// When false, only labels are shown (showLabels is forced to true)
  final bool showIcon;

  /// Optional status icons to display in the top-right corner of mode buttons.
  final Map<T, (IconData, Color)>? statusIcons;

  /// Pending, not confirmed or disabled look.
  final ControlState state;

  const ModeSelector({
    super.key,
    required this.modes,
    required this.selectedValue,
    required this.onChanged,
    this.orientation = ModeSelectorOrientation.horizontal,
    this.iconPlacement = ModeSelectorIconPlacement.left,
    this.color = ThemeColors.primary,
    this.showLabels,
    this.showIcon = true,
    this.minButtonWidth = 80.0,
    this.minButtonHeight = 56.0,
    this.scrollable = false,
    this.statusIcons,
    this.state = ControlState.idle,
  });

  /// Segment height and the gap between segments, in design px.
  static const double segmentHeight = 36;
  static const double gap = 4;

  /// The narrowest a segment gets (spec §4, touch floor); below it the row
  /// scrolls.
  static const double minSegmentWidth = 36;

  @override
  State<ModeSelector<T>> createState() => _ModeSelectorState<T>();
}

class _ModeSelectorState<T> extends State<ModeSelector<T>> {
  /// Key used to scroll to the selected item when scrollable and after first frame.
  final GlobalKey _selectedKey = GlobalKey();

  /// Whether the last horizontal layout scrolled because it was too narrow.
  bool _compressed = false;

  ScrollController? _scrollController;

  @override
  void initState() {
    super.initState();
    if (widget.scrollable) {
      _scrollController = ScrollController();
      _scheduleScrollToSelected();
    }
  }

  @override
  void didUpdateWidget(ModeSelector<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.scrollable && _scrollController == null) {
      _scrollController = ScrollController();
    }
    if (widget.scrollable &&
        (!oldWidget.scrollable ||
            widget.selectedValue != oldWidget.selectedValue ||
            widget.modes != oldWidget.modes)) {
      _scheduleScrollToSelected();
    }
  }

  void _scheduleScrollToSelected() {
    if (widget.scrollable && widget.selectedValue != null) {
      WidgetsBinding.instance.addPostFrameCallback(_scrollToSelected);
    }
  }

  @override
  void dispose() {
    _scrollController?.dispose();
    super.dispose();
  }

  /// Scroll only the selector's list to center the selected item (does not scroll the page).
  void _scrollToSelected(_) {
    final ctx = _selectedKey.currentContext;
    final controller = _scrollController;
    if (ctx == null || !mounted || controller == null || !controller.hasClients) {
      return;
    }

    final box = ctx.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize || box.parent == null) return;

    RenderObject? contentAncestor = box.parent;
    while (contentAncestor != null && contentAncestor is! RenderFlex) {
      contentAncestor = contentAncestor.parent;
    }
    if (contentAncestor == null) return;

    final position = controller.position;
    final isHorizontal =
        widget.orientation == ModeSelectorOrientation.horizontal;
    final itemOffsetInContent =
        box.localToGlobal(Offset.zero, ancestor: contentAncestor);
    final itemOffset =
        isHorizontal ? itemOffsetInContent.dx : itemOffsetInContent.dy;
    final itemSize = isHorizontal ? box.size.width : box.size.height;

    final scrollOffset =
        (itemOffset + itemSize / 2 - position.viewportDimension / 2)
            .clamp(0.0, position.maxScrollExtent);

    controller.animateTo(
      scrollOffset,
      duration: AppAnimation.slow,
      curve: Curves.easeInOut,
    );
  }

  /// The corner icon of a segment. On the selected segment the pending /
  /// not confirmed icon comes first, so command feedback is never hidden;
  /// otherwise the caller's status icon.
  (IconData, Color)? _statusIcon(ThemeData theme, ModeOption<T> mode) {
    if (mode.value == widget.selectedValue) {
      final command = switch (widget.state) {
        ControlState.pending => (
          MdiIcons.refresh,
          theme.neutrals.textSecondary,
        ),
        ControlState.unconfirmed => (
          MdiIcons.alert,
          theme.status(AppStatus.warning).text,
        ),
        _ => null,
      };
      if (command != null) return command;
    }

    return widget.statusIcons?[mode.value];
  }

  @override
  Widget build(BuildContext context) {
    if (widget.modes.isEmpty) return const SizedBox.shrink();

    return widget.orientation == ModeSelectorOrientation.horizontal
        ? _buildHorizontal(context)
        : _buildVertical(context);
  }

  Widget _buildHorizontal(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final gap = AppSpacings.scale(ModeSelector.gap);
        final count = widget.modes.length;
        final widthPerButton = constraints.hasBoundedWidth
            ? (constraints.maxWidth - gap * (count - 1)) / count
            : double.infinity;
        final showLabels = !widget.showIcon
            ? true
            : (widget.showLabels ?? (widthPerButton >= widget.minButtonWidth));
        // Too narrow for the touch floor: scroll rather than compress.
        final compressed = !widget.scrollable &&
            widthPerButton < AppSpacings.scale(ModeSelector.minSegmentWidth);
        final scrolls = widget.scrollable || compressed;
        if (compressed) {
          _scrollController ??= ScrollController();
          if (!_compressed) {
            WidgetsBinding.instance.addPostFrameCallback(_scrollToSelected);
          }
        }
        _compressed = compressed;

        final buttons = <Widget>[];
        for (var i = 0; i < count; i++) {
          final mode = widget.modes[i];
          Widget button = _ModeSegment<T>(
            mode: mode,
            isSelected: widget.selectedValue == mode.value,
            color: mode.color ?? widget.color,
            showIcon: widget.showIcon,
            showLabel: showLabels,
            iconOnTop: widget.iconPlacement == ModeSelectorIconPlacement.top,
            shrinkWrap: scrolls,
            statusIcon: _statusIcon(Theme.of(context), mode),
            state: widget.state,
            onTap: () => widget.onChanged(mode.value),
          );

          if (scrolls) {
            button = ConstrainedBox(
              constraints: BoxConstraints(
                minWidth: showLabels || !widget.showIcon
                    ? widget.minButtonWidth
                    : AppSpacings.scale(48),
              ),
              child: button,
            );
            if (mode.value == widget.selectedValue) {
              button = KeyedSubtree(key: _selectedKey, child: button);
            }
          } else {
            button = Expanded(child: button);
          }

          buttons.add(button);
        }

        final row = Row(spacing: gap, children: buttons);

        if (scrolls) {
          return SingleChildScrollView(
            controller: _scrollController,
            scrollDirection: Axis.horizontal,
            child: row,
          );
        }

        return row;
      },
    );
  }

  Widget _buildVertical(BuildContext context) {
    final buttons = <Widget>[];
    for (final mode in widget.modes) {
      Widget button = _ModeSegment<T>(
        mode: mode,
        isSelected: widget.selectedValue == mode.value,
        color: mode.color ?? widget.color,
        showIcon: widget.showIcon,
        showLabel: !widget.showIcon ? true : (widget.showLabels ?? false),
        iconOnTop: true,
        shrinkWrap: false,
        statusIcon: _statusIcon(Theme.of(context), mode),
        state: widget.state,
        onTap: () => widget.onChanged(mode.value),
      );

      if (widget.scrollable) {
        button = ConstrainedBox(
          constraints: BoxConstraints(minHeight: widget.minButtonHeight),
          child: button,
        );
        if (mode.value == widget.selectedValue) {
          button = KeyedSubtree(key: _selectedKey, child: button);
        }
      }

      buttons.add(button);
    }

    final column = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: AppSpacings.scale(ModeSelector.gap),
      children: buttons,
    );

    if (widget.scrollable) {
      return SingleChildScrollView(
        controller: _scrollController,
        child: IntrinsicWidth(child: column),
      );
    }

    return Center(child: column);
  }
}

/// One segment of [ModeSelector].
class _ModeSegment<T> extends StatelessWidget {
  const _ModeSegment({
    required this.mode,
    required this.isSelected,
    required this.color,
    required this.showIcon,
    required this.showLabel,
    required this.iconOnTop,
    required this.shrinkWrap,
    required this.statusIcon,
    required this.state,
    required this.onTap,
  });

  final ModeOption<T> mode;
  final bool isSelected;
  final ThemeColors color;
  final bool showIcon;
  final bool showLabel;
  final bool iconOnTop;
  final bool shrinkWrap;
  final (IconData, Color)? statusIcon;
  final ControlState state;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final tint = ControlTint.of(theme, color);
    final disabled = state == ControlState.disabled;
    final selected = isSelected && !disabled;

    final background = selected ? tint.soft : neutrals.fillLight;
    final outline = selected ? tint.text : neutrals.borderLight;
    final foreground = disabled
        ? neutrals.textDisabled
        : selected
        ? tint.text
        : neutrals.textPrimary;

    Widget label() => mode.labelBuilder != null
        ? mode.labelBuilder!(isSelected, foreground)
        : Text(
            mode.label,
            style: TextStyle(
              color: foreground,
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.w500,
            ),
            overflow: shrinkWrap ? TextOverflow.visible : TextOverflow.ellipsis,
            maxLines: 1,
            softWrap: false,
            textAlign: TextAlign.center,
          );

    final icon = Icon(
      mode.icon,
      color: foreground,
      size: mode.iconSize ?? AppSpacings.scale(16),
    );

    final Widget content;
    if (!showIcon) {
      content = Center(child: label());
    } else if (!showLabel) {
      content = Center(child: icon);
    } else if (iconOnTop) {
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.pXs,
        children: [icon, Flexible(child: label())],
      );
    } else {
      content = Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: shrinkWrap ? MainAxisSize.min : MainAxisSize.max,
        spacing: AppSpacings.scale(5),
        children: [icon, shrinkWrap ? label() : Flexible(child: label())],
      );
    }

    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
      side: BorderSide(color: outline, width: AppSpacings.scale(1)),
    );

    // The segment's own value, then the command outcome on the selected one.
    final localizations = AppLocalizations.of(context);
    final outcome = !isSelected || localizations == null
        ? null
        : switch (state) {
            ControlState.pending => localizations.control_state_pending,
            ControlState.unconfirmed => localizations.control_state_unconfirmed,
            _ => null,
          };
    final spokenValue = [
      ?mode.semanticValue,
      ?outcome,
    ].join(', ');

    return Semantics(
      button: true,
      selected: isSelected,
      inMutuallyExclusiveGroup: true,
      enabled: !disabled,
      label: mode.label,
      value: spokenValue.isEmpty ? null : spokenValue,
      onTap: disabled ? null : onTap,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: AppSpacings.scale(ModeSelector.segmentHeight),
        ),
        child: Material(
          color: background,
          shape: shape,
          child: InkWell(
            onTap: disabled ? null : onTap,
            customBorder: shape,
            child: Stack(
              alignment: Alignment.center,
              clipBehavior: Clip.none,
              children: [
                Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: shrinkWrap ? AppSpacings.pMd : AppSpacings.pSm,
                    vertical: iconOnTop && showLabel
                        ? AppSpacings.pSmMd
                        : AppSpacings.pSm,
                  ),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: AppSpacings.scale(
                            ModeSelector.segmentHeight,
                          ) -
                          2 * AppSpacings.pSm -
                          2 * AppSpacings.scale(1),
                    ),
                    child: Center(widthFactor: 1, heightFactor: 1, child: content),
                  ),
                ),
                if (statusIcon != null)
                  Positioned(
                    top: AppSpacings.scale(2),
                    right: AppSpacings.scale(2),
                    child: Icon(
                      statusIcon!.$1,
                      color: statusIcon!.$2,
                      size: AppSpacings.scale(12),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
