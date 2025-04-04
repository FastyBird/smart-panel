// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_tiles_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardTilesPage _$DashboardTilesPageFromJson(Map<String, dynamic> json) {
  return _DashboardTilesPage.fromJson(json);
}

/// @nodoc
mixin _$DashboardTilesPage {
  /// A unique identifier for the dashboard page.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page, displayed in the UI.
  String get title => throw _privateConstructorUsedError;

  /// The icon representing the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// A list of tiles associated with the tiles page.
  List<DashboardTilesPageTilesUnion> get tiles =>
      throw _privateConstructorUsedError;

  /// A list of data sources associated with the tiles page.
  @JsonKey(name: 'data_source')
  List<DashboardTilesPageDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// The display order of the dashboard page in the navigation or list.
  int get order => throw _privateConstructorUsedError;

  /// Serializes this DashboardTilesPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardTilesPageCopyWith<DashboardTilesPage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardTilesPageCopyWith<$Res> {
  factory $DashboardTilesPageCopyWith(
          DashboardTilesPage value, $Res Function(DashboardTilesPage) then) =
      _$DashboardTilesPageCopyWithImpl<$Res, DashboardTilesPage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String? icon,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      List<DashboardTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardTilesPageDataSourceUnion> dataSource,
      int order});
}

/// @nodoc
class _$DashboardTilesPageCopyWithImpl<$Res, $Val extends DashboardTilesPage>
    implements $DashboardTilesPageCopyWith<$Res> {
  _$DashboardTilesPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? icon = freezed,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? tiles = null,
    Object? dataSource = null,
    Object? order = null,
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
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      tiles: null == tiles
          ? _value.tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardTilesPageTilesUnion>,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTilesPageDataSourceUnion>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardTilesPageImplCopyWith<$Res>
    implements $DashboardTilesPageCopyWith<$Res> {
  factory _$$DashboardTilesPageImplCopyWith(_$DashboardTilesPageImpl value,
          $Res Function(_$DashboardTilesPageImpl) then) =
      __$$DashboardTilesPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String? icon,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      List<DashboardTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardTilesPageDataSourceUnion> dataSource,
      int order});
}

/// @nodoc
class __$$DashboardTilesPageImplCopyWithImpl<$Res>
    extends _$DashboardTilesPageCopyWithImpl<$Res, _$DashboardTilesPageImpl>
    implements _$$DashboardTilesPageImplCopyWith<$Res> {
  __$$DashboardTilesPageImplCopyWithImpl(_$DashboardTilesPageImpl _value,
      $Res Function(_$DashboardTilesPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? icon = freezed,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? tiles = null,
    Object? dataSource = null,
    Object? order = null,
  }) {
    return _then(_$DashboardTilesPageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      tiles: null == tiles
          ? _value._tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardTilesPageTilesUnion>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTilesPageDataSourceUnion>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardTilesPageImpl implements _DashboardTilesPage {
  const _$DashboardTilesPageImpl(
      {required this.id,
      required this.type,
      required this.title,
      required this.icon,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required final List<DashboardTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardTilesPageDataSourceUnion> dataSource,
      this.order = 0})
      : _tiles = tiles,
        _dataSource = dataSource;

  factory _$DashboardTilesPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardTilesPageImplFromJson(json);

  /// A unique identifier for the dashboard page.
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page, displayed in the UI.
  @override
  final String title;

  /// The icon representing the dashboard page.
  @override
  final String? icon;

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// A list of tiles associated with the tiles page.
  final List<DashboardTilesPageTilesUnion> _tiles;

  /// A list of tiles associated with the tiles page.
  @override
  List<DashboardTilesPageTilesUnion> get tiles {
    if (_tiles is EqualUnmodifiableListView) return _tiles;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tiles);
  }

  /// A list of data sources associated with the tiles page.
  final List<DashboardTilesPageDataSourceUnion> _dataSource;

  /// A list of data sources associated with the tiles page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTilesPageDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The display order of the dashboard page in the navigation or list.
  @override
  @JsonKey()
  final int order;

  @override
  String toString() {
    return 'DashboardTilesPage(id: $id, type: $type, title: $title, icon: $icon, createdAt: $createdAt, updatedAt: $updatedAt, tiles: $tiles, dataSource: $dataSource, order: $order)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardTilesPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            const DeepCollectionEquality().equals(other._tiles, _tiles) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.order, order) || other.order == order));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      title,
      icon,
      createdAt,
      updatedAt,
      const DeepCollectionEquality().hash(_tiles),
      const DeepCollectionEquality().hash(_dataSource),
      order);

  /// Create a copy of DashboardTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardTilesPageImplCopyWith<_$DashboardTilesPageImpl> get copyWith =>
      __$$DashboardTilesPageImplCopyWithImpl<_$DashboardTilesPageImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardTilesPageImplToJson(
      this,
    );
  }
}

abstract class _DashboardTilesPage implements DashboardTilesPage {
  const factory _DashboardTilesPage(
      {required final String id,
      required final String type,
      required final String title,
      required final String? icon,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final List<DashboardTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardTilesPageDataSourceUnion> dataSource,
      final int order}) = _$DashboardTilesPageImpl;

  factory _DashboardTilesPage.fromJson(Map<String, dynamic> json) =
      _$DashboardTilesPageImpl.fromJson;

  /// A unique identifier for the dashboard page.
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page, displayed in the UI.
  @override
  String get title;

  /// The icon representing the dashboard page.
  @override
  String? get icon;

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// A list of tiles associated with the tiles page.
  @override
  List<DashboardTilesPageTilesUnion> get tiles;

  /// A list of data sources associated with the tiles page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTilesPageDataSourceUnion> get dataSource;

  /// The display order of the dashboard page in the navigation or list.
  @override
  int get order;

  /// Create a copy of DashboardTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardTilesPageImplCopyWith<_$DashboardTilesPageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
