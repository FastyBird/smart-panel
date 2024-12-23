import 'package:flutter/material.dart';

class GridItemModel {
  final Widget child;
  final int row;
  final int col;
  final int rowSpan;
  final int colSpan;

  GridItemModel({
    required this.child,
    required this.row,
    required this.col,
    this.rowSpan = 1,
    this.colSpan = 1,
  });
}
