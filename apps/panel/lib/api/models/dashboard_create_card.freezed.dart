// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_card.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateCard _$DashboardCreateCardFromJson(Map<String, dynamic> json) {
  return _DashboardCreateCard.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateCard {
  /// The unique identifier for the dashboard card (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// The title displayed on the dashboard card.
  String get title => throw _privateConstructorUsedError;

  /// Defines the position of the card relative to others on the dashboard page.
  int get order => throw _privateConstructorUsedError;

  /// A list of tiles associated with the dashboard card, representing widgets or functional components.
  List<dynamic> get tiles => throw _privateConstructorUsedError;

  /// A list of data sources used by the card, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardCreateCardDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// The icon representing the dashboard card.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateCard to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateCardCopyWith<DashboardCreateCard> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateCardCopyWith<$Res> {
  factory $DashboardCreateCardCopyWith(
          DashboardCreateCard value, $Res Function(DashboardCreateCard) then) =
      _$DashboardCreateCardCopyWithImpl<$Res, DashboardCreateCard>;
  @useResult
  $Res call(
      {String id,
      String title,
      int order,
      List<dynamic> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardCreateCardDataSourceUnion> dataSource,
      String? icon});
}

/// @nodoc
class _$DashboardCreateCardCopyWithImpl<$Res, $Val extends DashboardCreateCard>
    implements $DashboardCreateCardCopyWith<$Res> {
  _$DashboardCreateCardCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? order = null,
    Object? tiles = null,
    Object? dataSource = null,
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
              as List<dynamic>,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateCardDataSourceUnion>,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateCardImplCopyWith<$Res>
    implements $DashboardCreateCardCopyWith<$Res> {
  factory _$$DashboardCreateCardImplCopyWith(_$DashboardCreateCardImpl value,
          $Res Function(_$DashboardCreateCardImpl) then) =
      __$$DashboardCreateCardImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      int order,
      List<dynamic> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardCreateCardDataSourceUnion> dataSource,
      String? icon});
}

/// @nodoc
class __$$DashboardCreateCardImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardCopyWithImpl<$Res, _$DashboardCreateCardImpl>
    implements _$$DashboardCreateCardImplCopyWith<$Res> {
  __$$DashboardCreateCardImplCopyWithImpl(_$DashboardCreateCardImpl _value,
      $Res Function(_$DashboardCreateCardImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? order = null,
    Object? tiles = null,
    Object? dataSource = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardCreateCardImpl(
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
              as List<dynamic>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateCardDataSourceUnion>,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateCardImpl implements _DashboardCreateCard {
  const _$DashboardCreateCardImpl(
      {required this.id,
      required this.title,
      required this.order,
      required final List<dynamic> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateCardDataSourceUnion> dataSource,
      this.icon})
      : _tiles = tiles,
        _dataSource = dataSource;

  factory _$DashboardCreateCardImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCreateCardImplFromJson(json);

  /// The unique identifier for the dashboard card (optional during creation).
  @override
  final String id;

  /// The title displayed on the dashboard card.
  @override
  final String title;

  /// Defines the position of the card relative to others on the dashboard page.
  @override
  final int order;

  /// A list of tiles associated with the dashboard card, representing widgets or functional components.
  final List<dynamic> _tiles;

  /// A list of tiles associated with the dashboard card, representing widgets or functional components.
  @override
  List<dynamic> get tiles {
    if (_tiles is EqualUnmodifiableListView) return _tiles;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tiles);
  }

  /// A list of data sources used by the card, typically for real-time updates.
  final List<DashboardCreateCardDataSourceUnion> _dataSource;

  /// A list of data sources used by the card, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateCardDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The icon representing the dashboard card.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardCreateCard(id: $id, title: $title, order: $order, tiles: $tiles, dataSource: $dataSource, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateCardImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            const DeepCollectionEquality().equals(other._tiles, _tiles) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
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
      icon);

  /// Create a copy of DashboardCreateCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateCardImplCopyWith<_$DashboardCreateCardImpl> get copyWith =>
      __$$DashboardCreateCardImplCopyWithImpl<_$DashboardCreateCardImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateCardImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreateCard implements DashboardCreateCard {
  const factory _DashboardCreateCard(
      {required final String id,
      required final String title,
      required final int order,
      required final List<dynamic> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateCardDataSourceUnion> dataSource,
      final String? icon}) = _$DashboardCreateCardImpl;

  factory _DashboardCreateCard.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateCardImpl.fromJson;

  /// The unique identifier for the dashboard card (optional during creation).
  @override
  String get id;

  /// The title displayed on the dashboard card.
  @override
  String get title;

  /// Defines the position of the card relative to others on the dashboard page.
  @override
  int get order;

  /// A list of tiles associated with the dashboard card, representing widgets or functional components.
  @override
  List<dynamic> get tiles;

  /// A list of data sources used by the card, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateCardDataSourceUnion> get dataSource;

  /// The icon representing the dashboard card.
  @override
  String? get icon;

  /// Create a copy of DashboardCreateCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateCardImplCopyWith<_$DashboardCreateCardImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
