import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/widgets.dart';

/// The reference canvases the gallery renders on, one per size class plus the
/// square (docs/display-ui-design-spec.md §4, supported panels).
enum GalleryCanvas {
  /// 4″ square panel.
  square('Square', Size(282, 282), ScreenSizeClass.compact),

  /// 7″ basic panel.
  compact('Compact', Size(471, 282), ScreenSizeClass.compact),

  /// 8″ WXGA panel.
  regular('Regular', Size(640, 400), ScreenSizeClass.regular),

  /// 11.6″ Full HD panel.
  expanded('Expanded', Size(960, 540), ScreenSizeClass.expanded);

  const GalleryCanvas(this.label, this.landscapeSize, this.sizeClass);

  final String label;

  /// The canvas in landscape, in design px.
  final Size landscapeSize;

  final ScreenSizeClass sizeClass;

  bool get isSquare => this == GalleryCanvas.square;

  /// The canvas in design px for [orientation]. The square does not rotate.
  Size sizeFor(Orientation orientation) =>
      orientation == Orientation.portrait && !isSquare
          ? landscapeSize.flipped
          : landscapeSize;
}

/// What the gallery preview is set to: canvas, orientation, theme and accent.
///
/// Gallery entries read it with [GalleryScope.of] and pass the class to the
/// component they show. The panel's own [ScreenService] keeps describing the
/// real screen, so a component that reads the class from the service renders
/// at the panel's class until it takes the class from its caller.
class GalleryScope extends InheritedWidget {
  const GalleryScope({
    super.key,
    required this.canvas,
    required this.orientation,
    required this.brightness,
    required this.accent,
    required super.child,
  });

  final GalleryCanvas canvas;
  final Orientation orientation;
  final Brightness brightness;
  final AppAccent accent;

  ScreenSizeClass get sizeClass => canvas.sizeClass;

  bool get isSquare => canvas.isSquare;

  /// The preview canvas in design px.
  Size get canvasSize => canvas.sizeFor(orientation);

  static GalleryScope? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<GalleryScope>();

  static GalleryScope of(BuildContext context) {
    final scope = maybeOf(context);

    assert(scope != null, 'No GalleryScope above this context.');

    return scope!;
  }

  @override
  bool updateShouldNotify(GalleryScope oldWidget) =>
      canvas != oldWidget.canvas ||
      orientation != oldWidget.orientation ||
      brightness != oldWidget.brightness ||
      accent != oldWidget.accent;
}
