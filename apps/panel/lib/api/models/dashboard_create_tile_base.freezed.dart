// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_tile_base.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateTileBase _$DashboardCreateTileBaseFromJson(
    Map<String, dynamic> json) {
  return _DashboardCreateTileBase.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateTileBase {
  /// Unique identifier for the dashboard tile (optional during creation).
  String get id => throw _privateConstructorUsedError;

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

  /// A list of data sources used by the tile, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateTileBase to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateTileBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateTileBaseCopyWith<DashboardCreateTileBase> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateTileBaseCopyWith<$Res> {
  factory $DashboardCreateTileBaseCopyWith(DashboardCreateTileBase value,
          $Res Function(DashboardCreateTileBase) then) =
      _$DashboardCreateTileBaseCopyWithImpl<$Res, DashboardCreateTileBase>;
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource});
}

/// @nodoc
class _$DashboardCreateTileBaseCopyWithImpl<$Res,
        $Val extends DashboardCreateTileBase>
    implements $DashboardCreateTileBaseCopyWith<$Res> {
  _$DashboardCreateTileBaseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateTileBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
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
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateTileBaseImplCopyWith<$Res>
    implements $DashboardCreateTileBaseCopyWith<$Res> {
  factory _$$DashboardCreateTileBaseImplCopyWith(
          _$DashboardCreateTileBaseImpl value,
          $Res Function(_$DashboardCreateTileBaseImpl) then) =
      __$$DashboardCreateTileBaseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource});
}

/// @nodoc
class __$$DashboardCreateTileBaseImplCopyWithImpl<$Res>
    extends _$DashboardCreateTileBaseCopyWithImpl<$Res,
        _$DashboardCreateTileBaseImpl>
    implements _$$DashboardCreateTileBaseImplCopyWith<$Res> {
  __$$DashboardCreateTileBaseImplCopyWithImpl(
      _$DashboardCreateTileBaseImpl _value,
      $Res Function(_$DashboardCreateTileBaseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTileBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
  }) {
    return _then(_$DashboardCreateTileBaseImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateTileBaseImpl implements _DashboardCreateTileBase {
  const _$DashboardCreateTileBaseImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource})
      : _dataSource = dataSource;

  factory _$DashboardCreateTileBaseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCreateTileBaseImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

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

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  @override
  String toString() {
    return 'DashboardCreateTileBase(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTileBaseImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, row, col, rowSpan, colSpan,
      const DeepCollectionEquality().hash(_dataSource));

  /// Create a copy of DashboardCreateTileBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTileBaseImplCopyWith<_$DashboardCreateTileBaseImpl>
      get copyWith => __$$DashboardCreateTileBaseImplCopyWithImpl<
          _$DashboardCreateTileBaseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTileBaseImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreateTileBase implements DashboardCreateTileBase {
  const factory _DashboardCreateTileBase(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion>
          dataSource}) = _$DashboardCreateTileBaseImpl;

  factory _DashboardCreateTileBase.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateTileBaseImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

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

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// Create a copy of DashboardCreateTileBase
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTileBaseImplCopyWith<_$DashboardCreateTileBaseImpl>
      get copyWith => throw _privateConstructorUsedError;
}
