// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_update_time_tile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardUpdateTimeTile _$DashboardUpdateTimeTileFromJson(
    Map<String, dynamic> json) {
  return _DashboardUpdateTimeTile.fromJson(json);
}

/// @nodoc
mixin _$DashboardUpdateTimeTile {
  /// Discriminator for the tile type
  String get type => throw _privateConstructorUsedError;

  /// The row position of the tile in the grid.
  int get row => throw _privateConstructorUsedError;

  /// The column position of the tile in the grid.
  int get col => throw _privateConstructorUsedError;

  /// The number of rows the tile spans in the grid.
  @JsonKey(name: 'row_span')
  int get rowSpan => throw _privateConstructorUsedError;

  /// The number of columns the tile spans in the grid.
  @JsonKey(name: 'col_span')
  int get colSpan => throw _privateConstructorUsedError;

  /// Serializes this DashboardUpdateTimeTile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardUpdateTimeTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardUpdateTimeTileCopyWith<DashboardUpdateTimeTile> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardUpdateTimeTileCopyWith<$Res> {
  factory $DashboardUpdateTimeTileCopyWith(DashboardUpdateTimeTile value,
          $Res Function(DashboardUpdateTimeTile) then) =
      _$DashboardUpdateTimeTileCopyWithImpl<$Res, DashboardUpdateTimeTile>;
  @useResult
  $Res call(
      {String type,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class _$DashboardUpdateTimeTileCopyWithImpl<$Res,
        $Val extends DashboardUpdateTimeTile>
    implements $DashboardUpdateTimeTileCopyWith<$Res> {
  _$DashboardUpdateTimeTileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardUpdateTimeTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardUpdateTimeTileImplCopyWith<$Res>
    implements $DashboardUpdateTimeTileCopyWith<$Res> {
  factory _$$DashboardUpdateTimeTileImplCopyWith(
          _$DashboardUpdateTimeTileImpl value,
          $Res Function(_$DashboardUpdateTimeTileImpl) then) =
      __$$DashboardUpdateTimeTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String type,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardUpdateTimeTileImplCopyWithImpl<$Res>
    extends _$DashboardUpdateTimeTileCopyWithImpl<$Res,
        _$DashboardUpdateTimeTileImpl>
    implements _$$DashboardUpdateTimeTileImplCopyWith<$Res> {
  __$$DashboardUpdateTimeTileImplCopyWithImpl(
      _$DashboardUpdateTimeTileImpl _value,
      $Res Function(_$DashboardUpdateTimeTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardUpdateTimeTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardUpdateTimeTileImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardUpdateTimeTileImpl implements _DashboardUpdateTimeTile {
  const _$DashboardUpdateTimeTileImpl(
      {required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan});

  factory _$DashboardUpdateTimeTileImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardUpdateTimeTileImplFromJson(json);

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  @override
  String toString() {
    return 'DashboardUpdateTimeTile(type: $type, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdateTimeTileImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, type, row, col, rowSpan, colSpan);

  /// Create a copy of DashboardUpdateTimeTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateTimeTileImplCopyWith<_$DashboardUpdateTimeTileImpl>
      get copyWith => __$$DashboardUpdateTimeTileImplCopyWithImpl<
          _$DashboardUpdateTimeTileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateTimeTileImplToJson(
      this,
    );
  }
}

abstract class _DashboardUpdateTimeTile implements DashboardUpdateTimeTile {
  const factory _DashboardUpdateTimeTile(
          {required final String type,
          required final int row,
          required final int col,
          @JsonKey(name: 'row_span') required final int rowSpan,
          @JsonKey(name: 'col_span') required final int colSpan}) =
      _$DashboardUpdateTimeTileImpl;

  factory _DashboardUpdateTimeTile.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateTimeTileImpl.fromJson;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardUpdateTimeTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateTimeTileImplCopyWith<_$DashboardUpdateTimeTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
