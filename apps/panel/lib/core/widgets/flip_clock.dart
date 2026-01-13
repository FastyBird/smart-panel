import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

enum FlipDirection { up, down }

typedef DigitBuilder = Widget Function(BuildContext context, int? digit);

// ignore: must_be_immutable
class FlipClock extends StatelessWidget {
  late DateTime startTime;

  final double spacing;
  final Duration duration;

  final FlipDirection flipDirection;

  late DigitBuilder _digitBuilder;
  late Widget _separator;

  FlipClock({
    super.key,
    required this.startTime,
    required double digitSize,
    required Color digitColor,
    required Color backgroundColor,
    required Color? borderColor,
    BorderRadius borderRadius = const BorderRadius.all(Radius.circular(0.0)),
    Widget? separator,
    this.flipDirection = FlipDirection.down,
    this.spacing = 0.0,
    this.duration = const Duration(milliseconds: 500),
  }) {
    _digitBuilder = (context, digit) => Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: borderRadius,
            border: Border.all(
              color: borderColor ?? AppColors.blank,
            ),
          ),
          padding: EdgeInsets.symmetric(
            vertical: AppSpacings.pXs,
            horizontal: AppSpacings.pMd,
          ),
          child: Text(
            '$digit',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: digitSize,
              color: digitColor,
            ),
          ),
        );

    _separator = separator ??
        Container(
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: borderRadius,
            border: Border.all(
              color: borderColor ?? AppColors.blank,
            ),
          ),
          padding: EdgeInsets.symmetric(
            vertical: AppSpacings.pXs,
            horizontal: AppSpacings.pMd,
          ),
          alignment: Alignment.center,
          child: Text(
            ':',
            style: TextStyle(
              fontSize: digitSize,
              color: digitColor,
              height: 1.0,
            ),
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    var time = startTime;

    final initStream = Stream<DateTime>.periodic(
      const Duration(milliseconds: 1000),
      (_) {
        return time = time.add(const Duration(seconds: 1));
      },
    );

    final timeStream = initStream.asBroadcastStream();

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _buildSegment(
          timeStream,
          (DateTime time) => (time.hour) ~/ 10,
          (DateTime time) => (time.hour) % 10,
          startTime,
        ),
        Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 2.0),
              child: _separator,
            ),
          ],
        ),
        _buildSegment(
          timeStream,
          (DateTime time) => (time.minute) ~/ 10,
          (DateTime time) => (time.minute) % 10,
          startTime,
        ),
      ],
    );
  }

  _buildSegment(
    Stream<DateTime> stream,
    Function tensDigit,
    Function onesDigit,
    DateTime startTime,
  ) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pXs),
              child: FlipPanel(
                stream: stream.map<int>(tensDigit as int Function(DateTime)),
                itemBuilder: _digitBuilder,
                initValue: tensDigit(startTime),
                duration: duration,
                direction: FlipDirection.down,
                spacing: spacing,
              ),
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pXs),
              child: FlipPanel(
                stream: stream.map<int>(onesDigit as int Function(DateTime)),
                itemBuilder: _digitBuilder,
                initValue: onesDigit(startTime),
                duration: duration,
                direction: FlipDirection.down,
                spacing: spacing,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class FlipPanel extends StatefulWidget {
  final Stream<int> stream;
  final DigitBuilder itemBuilder;
  final int initValue;
  final Duration duration;
  final FlipDirection direction;
  final double spacing;

  const FlipPanel({
    super.key,
    required this.stream,
    required this.itemBuilder,
    required this.initValue,
    required this.duration,
    required this.direction,
    required this.spacing,
  });

  @override
  State<FlipPanel> createState() => _FlipPanelState();
}

class _FlipPanelState extends State<FlipPanel>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation _animation;
  late bool _isReversePhase;
  late bool _running;

  final _perspective = 0.003;
  final _zeroAngle = 0.0001;

  int? _currentValue, _nextValue;

  Widget? _child1, _child2;
  Widget? _upperChild1, _upperChild2;
  Widget? _lowerChild1, _lowerChild2;

  late StreamSubscription<int> _subscription;

  @override
  void initState() {
    super.initState();

    _isReversePhase = false;
    _running = false;

    _controller = AnimationController(duration: widget.duration, vsync: this)
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          _isReversePhase = true;
          _controller.reverse();
        }
        if (status == AnimationStatus.dismissed) {
          _currentValue = _nextValue;
          _running = false;
        }
      })
      ..addListener(() {
        setState(() {
          _running = true;
        });
      });

    _animation = Tween(
      begin: _zeroAngle,
      end: math.pi / 2,
    ).animate(
      _controller,
    );

    _currentValue = widget.initValue;

    _subscription = widget.stream.distinct().listen((value) {
      if (_currentValue == null) {
        _currentValue = value;
      } else if (value != _currentValue) {
        _nextValue = value;
        _child1 = null;
        _isReversePhase = false;
        _controller.forward();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _subscription.cancel();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _buildChildWidgetsIfNeed(context);

    return _buildPanel();
  }

  Widget _buildUpperClip(Widget widget) {
    return ClipRect(
      child: Align(
        alignment: Alignment.topCenter,
        heightFactor: 0.5,
        child: widget,
      ),
    );
  }

  Widget _buildLowerClip(Widget widget) {
    return ClipRect(
      child: Align(
        alignment: Alignment.bottomCenter,
        heightFactor: 0.5,
        child: widget,
      ),
    );
  }

  void _buildChildWidgetsIfNeed(BuildContext context) {
    if (_running) {
      if (_child1 == null) {
        if (_child2 != null) {
          _child1 = _child2;
        } else {
          _child1 = widget.itemBuilder(context, _currentValue);
        }

        _child2 = null;

        _upperChild1 = _upperChild2 ?? _buildUpperClip(_child1!);
        _lowerChild1 = _lowerChild2 ?? _buildLowerClip(_child1!);
      }

      if (_child2 == null) {
        _child2 = widget.itemBuilder(context, _nextValue);

        _upperChild2 = _buildUpperClip(_child2!);
        _lowerChild2 = _buildLowerClip(_child2!);
      }
    } else {
      if (_child2 != null) {
        _child1 = _child2;
      } else {
        _child1 = widget.itemBuilder(context, _currentValue);
      }

      _upperChild1 = _upperChild2 ?? _buildUpperClip(_child1!);
      _lowerChild1 = _lowerChild2 ?? _buildLowerClip(_child1!);
    }
  }

  Widget _buildPanel() {
    return _running
        ? Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _buildUpperFlipPanelPlus(),
              SizedBox(height: widget.spacing),
              _buildLowerFlipPanelPlus(),
            ],
          )
        : _currentValue == null
            ? Container()
            : Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Transform(
                    alignment: Alignment.bottomCenter,
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, _perspective)
                      ..rotateX(_zeroAngle),
                    child: _upperChild1,
                  ),
                  SizedBox(height: widget.spacing),
                  Transform(
                    alignment: Alignment.topCenter,
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, _perspective)
                      ..rotateX(_zeroAngle),
                    child: _lowerChild1,
                  )
                ],
              );
  }

  Widget _buildUpperFlipPanelPlus() => widget.direction == FlipDirection.up
      ? Stack(
          children: [
            Transform(
                alignment: Alignment.bottomCenter,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, _perspective)
                  ..rotateX(_zeroAngle),
                child: _upperChild1),
            Transform(
              alignment: Alignment.bottomCenter,
              transform: Matrix4.identity()
                ..setEntry(3, 2, _perspective)
                ..rotateX(_isReversePhase ? _animation.value : math.pi / 2),
              child: _upperChild2,
            ),
          ],
        )
      : Stack(
          children: [
            Transform(
                alignment: Alignment.bottomCenter,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, _perspective)
                  ..rotateX(_zeroAngle),
                child: _upperChild2),
            Transform(
              alignment: Alignment.bottomCenter,
              transform: Matrix4.identity()
                ..setEntry(3, 2, _perspective)
                ..rotateX(_isReversePhase ? math.pi / 2 : _animation.value),
              child: _upperChild1,
            ),
          ],
        );

  Widget _buildLowerFlipPanelPlus() => widget.direction == FlipDirection.up
      ? Stack(
          children: [
            Transform(
                alignment: Alignment.topCenter,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, _perspective)
                  ..rotateX(_zeroAngle),
                child: _lowerChild2),
            Transform(
              alignment: Alignment.topCenter,
              transform: Matrix4.identity()
                ..setEntry(3, 2, _perspective)
                ..rotateX(_isReversePhase ? math.pi / 2 : -_animation.value),
              child: _lowerChild1,
            )
          ],
        )
      : Stack(
          children: [
            Transform(
                alignment: Alignment.topCenter,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, _perspective)
                  ..rotateX(_zeroAngle),
                child: _lowerChild1),
            Transform(
              alignment: Alignment.topCenter,
              transform: Matrix4.identity()
                ..setEntry(3, 2, _perspective)
                ..rotateX(_isReversePhase ? -_animation.value : math.pi / 2),
              child: _lowerChild2,
            )
          ],
        );
}
