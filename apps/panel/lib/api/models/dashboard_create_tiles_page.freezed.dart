// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_tiles_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateTilesPage _$DashboardCreateTilesPageFromJson(
    Map<String, dynamic> json) {
  return _DashboardCreateTilesPage.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateTilesPage {
  /// The unique identifier for the dashboard page (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// A list of tiles associated with the tiles page.
  List<DashboardCreateTilesPageTilesUnion> get tiles =>
      throw _privateConstructorUsedError;

  /// A list of data sources associated with the tiles page.
  @JsonKey(name: 'data_source')
  List<DashboardCreateTilesPageDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// Indicates that this is a tiles dashboard page.
  String get type => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateTilesPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateTilesPageCopyWith<DashboardCreateTilesPage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateTilesPageCopyWith<$Res> {
  factory $DashboardCreateTilesPageCopyWith(DashboardCreateTilesPage value,
          $Res Function(DashboardCreateTilesPage) then) =
      _$DashboardCreateTilesPageCopyWithImpl<$Res, DashboardCreateTilesPage>;
  @useResult
  $Res call(
      {String id,
      String title,
      int order,
      List<DashboardCreateTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTilesPageDataSourceUnion> dataSource,
      String type,
      String? icon});
}

/// @nodoc
class _$DashboardCreateTilesPageCopyWithImpl<$Res,
        $Val extends DashboardCreateTilesPage>
    implements $DashboardCreateTilesPageCopyWith<$Res> {
  _$DashboardCreateTilesPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? order = null,
    Object? tiles = null,
    Object? dataSource = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      tiles: null == tiles
          ? _value.tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTilesPageTilesUnion>,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTilesPageDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateTilesPageImplCopyWith<$Res>
    implements $DashboardCreateTilesPageCopyWith<$Res> {
  factory _$$DashboardCreateTilesPageImplCopyWith(
          _$DashboardCreateTilesPageImpl value,
          $Res Function(_$DashboardCreateTilesPageImpl) then) =
      __$$DashboardCreateTilesPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      int order,
      List<DashboardCreateTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTilesPageDataSourceUnion> dataSource,
      String type,
      String? icon});
}

/// @nodoc
class __$$DashboardCreateTilesPageImplCopyWithImpl<$Res>
    extends _$DashboardCreateTilesPageCopyWithImpl<$Res,
        _$DashboardCreateTilesPageImpl>
    implements _$$DashboardCreateTilesPageImplCopyWith<$Res> {
  __$$DashboardCreateTilesPageImplCopyWithImpl(
      _$DashboardCreateTilesPageImpl _value,
      $Res Function(_$DashboardCreateTilesPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? order = null,
    Object? tiles = null,
    Object? dataSource = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardCreateTilesPageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      tiles: null == tiles
          ? _value._tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTilesPageTilesUnion>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTilesPageDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateTilesPageImpl implements _DashboardCreateTilesPage {
  const _$DashboardCreateTilesPageImpl(
      {required this.id,
      required this.title,
      required this.order,
      required final List<DashboardCreateTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTilesPageDataSourceUnion> dataSource,
      this.type = 'tiles',
      this.icon})
      : _tiles = tiles,
        _dataSource = dataSource;

  factory _$DashboardCreateTilesPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCreateTilesPageImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// The title of the dashboard page.
  @override
  final String title;

  /// The position of the page in the dashboard’s list.
  @override
  final int order;

  /// A list of tiles associated with the tiles page.
  final List<DashboardCreateTilesPageTilesUnion> _tiles;

  /// A list of tiles associated with the tiles page.
  @override
  List<DashboardCreateTilesPageTilesUnion> get tiles {
    if (_tiles is EqualUnmodifiableListView) return _tiles;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tiles);
  }

  /// A list of data sources associated with the tiles page.
  final List<DashboardCreateTilesPageDataSourceUnion> _dataSource;

  /// A list of data sources associated with the tiles page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTilesPageDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// Indicates that this is a tiles dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardCreateTilesPage(id: $id, title: $title, order: $order, tiles: $tiles, dataSource: $dataSource, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTilesPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            const DeepCollectionEquality().equals(other._tiles, _tiles) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      order,
      const DeepCollectionEquality().hash(_tiles),
      const DeepCollectionEquality().hash(_dataSource),
      type,
      icon);

  /// Create a copy of DashboardCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTilesPageImplCopyWith<_$DashboardCreateTilesPageImpl>
      get copyWith => __$$DashboardCreateTilesPageImplCopyWithImpl<
          _$DashboardCreateTilesPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTilesPageImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreateTilesPage implements DashboardCreateTilesPage {
  const factory _DashboardCreateTilesPage(
      {required final String id,
      required final String title,
      required final int order,
      required final List<DashboardCreateTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTilesPageDataSourceUnion> dataSource,
      final String type,
      final String? icon}) = _$DashboardCreateTilesPageImpl;

  factory _DashboardCreateTilesPage.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateTilesPageImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// The title of the dashboard page.
  @override
  String get title;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// A list of tiles associated with the tiles page.
  @override
  List<DashboardCreateTilesPageTilesUnion> get tiles;

  /// A list of data sources associated with the tiles page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTilesPageDataSourceUnion> get dataSource;

  /// Indicates that this is a tiles dashboard page.
  @override
  String get type;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of DashboardCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTilesPageImplCopyWith<_$DashboardCreateTilesPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
