import 'dart:ui' as ui;

import 'package:flutter/material.dart';

class ColorPicker extends StatefulWidget {
  final Function(Color) onColorChanged;

  const ColorPicker({super.key, required this.onColorChanged});

  @override
  State<ColorPicker> createState() => _ColorPickerState();
}

class _ColorPickerState extends State<ColorPicker> {
  double thumbPositionX = 150; // Horizontal position (Hue)
  double thumbPositionY = 75; // Vertical position (Brightness)
  final double pickerWidth = 300;
  final double pickerHeight = 150;

  ui.Image? pickerImage;

  @override
  void initState() {
    super.initState();
    _generatePickerImage();
  }

  // Generate an image of the picker to sample pixel colors
  Future<void> _generatePickerImage() async {
    final recorder = ui.PictureRecorder();
    final canvas =
        Canvas(recorder, Rect.fromLTWH(0, 0, pickerWidth, pickerHeight));
    final painter = TwoDimensionalColorPainter();
    painter.paint(canvas, Size(pickerWidth, pickerHeight));
    final picture = recorder.endRecording();
    final image =
        await picture.toImage(pickerWidth.toInt(), pickerHeight.toInt());
    setState(() {
      pickerImage = image;
    });
  }

  // Get color at thumb position
  Future<Color> _getColorAtPosition(double x, double y) async {
    if (pickerImage == null) return Colors.transparent;

    final byteData =
        await pickerImage!.toByteData(format: ui.ImageByteFormat.rawRgba);
    if (byteData == null) return Colors.transparent;

    final int pixelIndex = (y.toInt() * pickerWidth.toInt() + x.toInt()) * 4;

    final int r = byteData.getUint8(pixelIndex);
    final int g = byteData.getUint8(pixelIndex + 1);
    final int b = byteData.getUint8(pixelIndex + 2);
    final int a = byteData.getUint8(pixelIndex + 3);

    return Color.fromARGB(a, r, g, b);
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: GestureDetector(
        onPanUpdate: (details) {
          setState(() {
            thumbPositionX =
                (thumbPositionX + details.delta.dx).clamp(0.0, pickerWidth);
            thumbPositionY =
                (thumbPositionY + details.delta.dy).clamp(0.0, pickerHeight);
          });
          _getColorAtPosition(thumbPositionX, thumbPositionY).then((color) {
            widget.onColorChanged(color);
          });
        },
        onTapDown: (details) {
          setState(() {
            thumbPositionX = details.localPosition.dx.clamp(0.0, pickerWidth);
            thumbPositionY = details.localPosition.dy.clamp(0.0, pickerHeight);
          });
          _getColorAtPosition(thumbPositionX, thumbPositionY).then((color) {
            widget.onColorChanged(color);
          });
        },
        child: Stack(
          children: [
            // Picker background
            CustomPaint(
              size: Size(pickerWidth, pickerHeight),
              painter: TwoDimensionalColorPainter(),
            ),
            // Thumb (Indicator)
            Positioned(
              left: thumbPositionX - 10,
              top: thumbPositionY - 10,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: Colors.transparent, // Color is updated dynamically
                  border: Border.all(color: Colors.white, width: 2),
                  shape: BoxShape.circle,
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 4,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Custom Painter for 2D Color Picker
class TwoDimensionalColorPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint();

    // Horizontal Hue Gradient
    final Shader hueShader = LinearGradient(
      colors: [
        const Color(0xFFFF0000), // Red
        const Color(0xFFFFFF00), // Yellow
        const Color(0xFF00FF00), // Green
        const Color(0xFF00FFFF), // Cyan
        const Color(0xFF0000FF), // Blue
        const Color(0xFFFF00FF), // Magenta
        const Color(0xFFFF0000), // Red (Wrap around)
      ],
    ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    // Vertical White Transparency Gradient
    final Shader whiteToTransparentShader = LinearGradient(
      colors: [
        const Color(0xFFFFFFFF), // White
        const Color(0x00FFFFFF), // Transparent White
      ],
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
    ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    // Draw horizontal hue gradient
    paint.shader = hueShader;
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), paint);

    // Overlay vertical white gradient
    paint.shader = whiteToTransparentShader;
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), paint);
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}
