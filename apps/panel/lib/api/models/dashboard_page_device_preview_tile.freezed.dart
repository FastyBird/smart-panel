// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_page_device_preview_tile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardPageDevicePreviewTile _$DashboardPageDevicePreviewTileFromJson(
    Map<String, dynamic> json) {
  return _DashboardPageDevicePreviewTile.fromJson(json);
}

/// @nodoc
mixin _$DashboardPageDevicePreviewTile {
  /// A unique identifier for the dashboard tile.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the tile type
  String get type => throw _privateConstructorUsedError;

  /// The row position of the tile in the grid.
  int get row => throw _privateConstructorUsedError;

  /// The column position of the tile in the grid.
  int get col => throw _privateConstructorUsedError;

  /// A list of data sources used by the tile, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// The timestamp when the dashboard tile was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard tile was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The icon representing the device tile.
  String? get icon => throw _privateConstructorUsedError;

  /// The unique identifier of the associated page.
  String get page => throw _privateConstructorUsedError;

  /// The number of rows the tile spans.
  @JsonKey(name: 'row_span')
  int get rowSpan => throw _privateConstructorUsedError;

  /// The number of columns the tile spans.
  @JsonKey(name: 'col_span')
  int get colSpan => throw _privateConstructorUsedError;

  /// Serializes this DashboardPageDevicePreviewTile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardPageDevicePreviewTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardPageDevicePreviewTileCopyWith<DashboardPageDevicePreviewTile>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardPageDevicePreviewTileCopyWith<$Res> {
  factory $DashboardPageDevicePreviewTileCopyWith(
          DashboardPageDevicePreviewTile value,
          $Res Function(DashboardPageDevicePreviewTile) then) =
      _$DashboardPageDevicePreviewTileCopyWithImpl<$Res,
          DashboardPageDevicePreviewTile>;
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String? icon,
      String page,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class _$DashboardPageDevicePreviewTileCopyWithImpl<$Res,
        $Val extends DashboardPageDevicePreviewTile>
    implements $DashboardPageDevicePreviewTileCopyWith<$Res> {
  _$DashboardPageDevicePreviewTileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardPageDevicePreviewTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? icon = freezed,
    Object? page = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
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
abstract class _$$DashboardPageDevicePreviewTileImplCopyWith<$Res>
    implements $DashboardPageDevicePreviewTileCopyWith<$Res> {
  factory _$$DashboardPageDevicePreviewTileImplCopyWith(
          _$DashboardPageDevicePreviewTileImpl value,
          $Res Function(_$DashboardPageDevicePreviewTileImpl) then) =
      __$$DashboardPageDevicePreviewTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String? icon,
      String page,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardPageDevicePreviewTileImplCopyWithImpl<$Res>
    extends _$DashboardPageDevicePreviewTileCopyWithImpl<$Res,
        _$DashboardPageDevicePreviewTileImpl>
    implements _$$DashboardPageDevicePreviewTileImplCopyWith<$Res> {
  __$$DashboardPageDevicePreviewTileImplCopyWithImpl(
      _$DashboardPageDevicePreviewTileImpl _value,
      $Res Function(_$DashboardPageDevicePreviewTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardPageDevicePreviewTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? icon = freezed,
    Object? page = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardPageDevicePreviewTileImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
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
class _$DashboardPageDevicePreviewTileImpl
    implements _DashboardPageDevicePreviewTile {
  const _$DashboardPageDevicePreviewTileImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      required this.icon,
      required this.page,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardPageDevicePreviewTileImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardPageDevicePreviewTileImplFromJson(json);

  /// A unique identifier for the dashboard tile.
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The icon representing the device tile.
  @override
  final String? icon;

  /// The unique identifier of the associated page.
  @override
  final String page;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  @override
  String toString() {
    return 'DashboardPageDevicePreviewTile(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, icon: $icon, page: $page, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardPageDevicePreviewTileImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      device,
      icon,
      page,
      rowSpan,
      colSpan);

  /// Create a copy of DashboardPageDevicePreviewTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardPageDevicePreviewTileImplCopyWith<
          _$DashboardPageDevicePreviewTileImpl>
      get copyWith => __$$DashboardPageDevicePreviewTileImplCopyWithImpl<
          _$DashboardPageDevicePreviewTileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardPageDevicePreviewTileImplToJson(
      this,
    );
  }
}

abstract class _DashboardPageDevicePreviewTile
    implements DashboardPageDevicePreviewTile {
  const factory _DashboardPageDevicePreviewTile(
          {required final String id,
          required final String type,
          required final int row,
          required final int col,
          @JsonKey(name: 'data_source')
          required final List<DashboardTileBaseDataSourceUnion> dataSource,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
          required final String device,
          required final String? icon,
          required final String page,
          @JsonKey(name: 'row_span') final int rowSpan,
          @JsonKey(name: 'col_span') final int colSpan}) =
      _$DashboardPageDevicePreviewTileImpl;

  factory _DashboardPageDevicePreviewTile.fromJson(Map<String, dynamic> json) =
      _$DashboardPageDevicePreviewTileImpl.fromJson;

  /// A unique identifier for the dashboard tile.
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource;

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// The icon representing the device tile.
  @override
  String? get icon;

  /// The unique identifier of the associated page.
  @override
  String get page;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardPageDevicePreviewTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardPageDevicePreviewTileImplCopyWith<
          _$DashboardPageDevicePreviewTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
