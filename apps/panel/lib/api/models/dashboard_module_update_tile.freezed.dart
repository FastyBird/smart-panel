// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_module_update_tile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardModuleUpdateTile _$DashboardModuleUpdateTileFromJson(
    Map<String, dynamic> json) {
  return _DashboardModuleUpdateTile.fromJson(json);
}

/// @nodoc
mixin _$DashboardModuleUpdateTile {
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

  /// Mark the tile as hidden and will not be displayed on the display application.
  bool get hidden => throw _privateConstructorUsedError;

  /// Serializes this DashboardModuleUpdateTile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardModuleUpdateTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardModuleUpdateTileCopyWith<DashboardModuleUpdateTile> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardModuleUpdateTileCopyWith<$Res> {
  factory $DashboardModuleUpdateTileCopyWith(DashboardModuleUpdateTile value,
          $Res Function(DashboardModuleUpdateTile) then) =
      _$DashboardModuleUpdateTileCopyWithImpl<$Res, DashboardModuleUpdateTile>;
  @useResult
  $Res call(
      {String type,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      bool hidden});
}

/// @nodoc
class _$DashboardModuleUpdateTileCopyWithImpl<$Res,
        $Val extends DashboardModuleUpdateTile>
    implements $DashboardModuleUpdateTileCopyWith<$Res> {
  _$DashboardModuleUpdateTileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardModuleUpdateTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? hidden = null,
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
      hidden: null == hidden
          ? _value.hidden
          : hidden // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardModuleUpdateTileImplCopyWith<$Res>
    implements $DashboardModuleUpdateTileCopyWith<$Res> {
  factory _$$DashboardModuleUpdateTileImplCopyWith(
          _$DashboardModuleUpdateTileImpl value,
          $Res Function(_$DashboardModuleUpdateTileImpl) then) =
      __$$DashboardModuleUpdateTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String type,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      bool hidden});
}

/// @nodoc
class __$$DashboardModuleUpdateTileImplCopyWithImpl<$Res>
    extends _$DashboardModuleUpdateTileCopyWithImpl<$Res,
        _$DashboardModuleUpdateTileImpl>
    implements _$$DashboardModuleUpdateTileImplCopyWith<$Res> {
  __$$DashboardModuleUpdateTileImplCopyWithImpl(
      _$DashboardModuleUpdateTileImpl _value,
      $Res Function(_$DashboardModuleUpdateTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardModuleUpdateTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? hidden = null,
  }) {
    return _then(_$DashboardModuleUpdateTileImpl(
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
      hidden: null == hidden
          ? _value.hidden
          : hidden // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardModuleUpdateTileImpl implements _DashboardModuleUpdateTile {
  const _$DashboardModuleUpdateTileImpl(
      {required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      this.hidden = false});

  factory _$DashboardModuleUpdateTileImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardModuleUpdateTileImplFromJson(json);

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

  /// Mark the tile as hidden and will not be displayed on the display application.
  @override
  @JsonKey()
  final bool hidden;

  @override
  String toString() {
    return 'DashboardModuleUpdateTile(type: $type, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, hidden: $hidden)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardModuleUpdateTileImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            (identical(other.hidden, hidden) || other.hidden == hidden));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, type, row, col, rowSpan, colSpan, hidden);

  /// Create a copy of DashboardModuleUpdateTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardModuleUpdateTileImplCopyWith<_$DashboardModuleUpdateTileImpl>
      get copyWith => __$$DashboardModuleUpdateTileImplCopyWithImpl<
          _$DashboardModuleUpdateTileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardModuleUpdateTileImplToJson(
      this,
    );
  }
}

abstract class _DashboardModuleUpdateTile implements DashboardModuleUpdateTile {
  const factory _DashboardModuleUpdateTile(
      {required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      final bool hidden}) = _$DashboardModuleUpdateTileImpl;

  factory _DashboardModuleUpdateTile.fromJson(Map<String, dynamic> json) =
      _$DashboardModuleUpdateTileImpl.fromJson;

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

  /// Mark the tile as hidden and will not be displayed on the display application.
  @override
  bool get hidden;

  /// Create a copy of DashboardModuleUpdateTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardModuleUpdateTileImplCopyWith<_$DashboardModuleUpdateTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
