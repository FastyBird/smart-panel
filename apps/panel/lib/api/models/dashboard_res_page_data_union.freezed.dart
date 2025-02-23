// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_res_page_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardResPageDataUnion _$DashboardResPageDataUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'cards':
      return DashboardResPageDataUnionCards.fromJson(json);
    case 'tiles':
      return DashboardResPageDataUnionTiles.fromJson(json);
    case 'device':
      return DashboardResPageDataUnionDevice.fromJson(json);

    default:
      throw CheckedFromJsonException(json, 'type', 'DashboardResPageDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardResPageDataUnion {
  /// A unique identifier for the dashboard page.
  String get id => throw _privateConstructorUsedError;

  /// The title of the dashboard page, displayed in the UI.
  String get title => throw _privateConstructorUsedError;

  /// The icon representing the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// The display order of the dashboard page in the navigation or list.
  int get order => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Indicates that this is a cards dashboard page.
  String get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)
        cards,
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)
        tiles,
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)
        device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)?
        cards,
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)?
        tiles,
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)?
        device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)?
        cards,
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)?
        tiles,
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)?
        device,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardResPageDataUnionCards value) cards,
    required TResult Function(DashboardResPageDataUnionTiles value) tiles,
    required TResult Function(DashboardResPageDataUnionDevice value) device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageDataUnionCards value)? cards,
    TResult? Function(DashboardResPageDataUnionTiles value)? tiles,
    TResult? Function(DashboardResPageDataUnionDevice value)? device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageDataUnionCards value)? cards,
    TResult Function(DashboardResPageDataUnionTiles value)? tiles,
    TResult Function(DashboardResPageDataUnionDevice value)? device,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardResPageDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardResPageDataUnionCopyWith<DashboardResPageDataUnion> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardResPageDataUnionCopyWith<$Res> {
  factory $DashboardResPageDataUnionCopyWith(DashboardResPageDataUnion value,
          $Res Function(DashboardResPageDataUnion) then) =
      _$DashboardResPageDataUnionCopyWithImpl<$Res, DashboardResPageDataUnion>;
  @useResult
  $Res call(
      {String id,
      String title,
      String? icon,
      int order,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String type});
}

/// @nodoc
class _$DashboardResPageDataUnionCopyWithImpl<$Res,
        $Val extends DashboardResPageDataUnion>
    implements $DashboardResPageDataUnionCopyWith<$Res> {
  _$DashboardResPageDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? icon = freezed,
    Object? order = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? type = null,
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
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardResPageDataUnionCardsImplCopyWith<$Res>
    implements $DashboardResPageDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageDataUnionCardsImplCopyWith(
          _$DashboardResPageDataUnionCardsImpl value,
          $Res Function(_$DashboardResPageDataUnionCardsImpl) then) =
      __$$DashboardResPageDataUnionCardsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String? icon,
      int order,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      List<DashboardCard> cards,
      @JsonKey(name: 'data_source')
      List<DashboardCardsPageDataSourceUnion> dataSource,
      String type});
}

/// @nodoc
class __$$DashboardResPageDataUnionCardsImplCopyWithImpl<$Res>
    extends _$DashboardResPageDataUnionCopyWithImpl<$Res,
        _$DashboardResPageDataUnionCardsImpl>
    implements _$$DashboardResPageDataUnionCardsImplCopyWith<$Res> {
  __$$DashboardResPageDataUnionCardsImplCopyWithImpl(
      _$DashboardResPageDataUnionCardsImpl _value,
      $Res Function(_$DashboardResPageDataUnionCardsImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? icon = freezed,
    Object? order = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? cards = null,
    Object? dataSource = null,
    Object? type = null,
  }) {
    return _then(_$DashboardResPageDataUnionCardsImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      cards: null == cards
          ? _value._cards
          : cards // ignore: cast_nullable_to_non_nullable
              as List<DashboardCard>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCardsPageDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageDataUnionCardsImpl
    implements DashboardResPageDataUnionCards {
  const _$DashboardResPageDataUnionCardsImpl(
      {required this.id,
      required this.title,
      required this.icon,
      required this.order,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required final List<DashboardCard> cards,
      @JsonKey(name: 'data_source')
      required final List<DashboardCardsPageDataSourceUnion> dataSource,
      this.type = 'cards'})
      : _cards = cards,
        _dataSource = dataSource;

  factory _$DashboardResPageDataUnionCardsImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageDataUnionCardsImplFromJson(json);

  /// A unique identifier for the dashboard page.
  @override
  final String id;

  /// The title of the dashboard page, displayed in the UI.
  @override
  final String title;

  /// The icon representing the dashboard page.
  @override
  final String? icon;

  /// The display order of the dashboard page in the navigation or list.
  @override
  final int order;

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// A list of cards associated with the page.
  final List<DashboardCard> _cards;

  /// A list of cards associated with the page.
  @override
  List<DashboardCard> get cards {
    if (_cards is EqualUnmodifiableListView) return _cards;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_cards);
  }

  /// A list of data sources associated with the page.
  final List<DashboardCardsPageDataSourceUnion> _dataSource;

  /// A list of data sources associated with the page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCardsPageDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// Indicates that this is a cards dashboard page.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardResPageDataUnion.cards(id: $id, title: $title, icon: $icon, order: $order, createdAt: $createdAt, updatedAt: $updatedAt, cards: $cards, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageDataUnionCardsImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            const DeepCollectionEquality().equals(other._cards, _cards) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      icon,
      order,
      createdAt,
      updatedAt,
      const DeepCollectionEquality().hash(_cards),
      const DeepCollectionEquality().hash(_dataSource),
      type);

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageDataUnionCardsImplCopyWith<
          _$DashboardResPageDataUnionCardsImpl>
      get copyWith => __$$DashboardResPageDataUnionCardsImplCopyWithImpl<
          _$DashboardResPageDataUnionCardsImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)
        cards,
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)
        tiles,
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)
        device,
  }) {
    return cards(id, title, icon, order, createdAt, updatedAt, this.cards,
        dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)?
        cards,
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)?
        tiles,
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)?
        device,
  }) {
    return cards?.call(id, title, icon, order, createdAt, updatedAt, this.cards,
        dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)?
        cards,
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)?
        tiles,
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)?
        device,
    required TResult orElse(),
  }) {
    if (cards != null) {
      return cards(id, title, icon, order, createdAt, updatedAt, this.cards,
          dataSource, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardResPageDataUnionCards value) cards,
    required TResult Function(DashboardResPageDataUnionTiles value) tiles,
    required TResult Function(DashboardResPageDataUnionDevice value) device,
  }) {
    return cards(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageDataUnionCards value)? cards,
    TResult? Function(DashboardResPageDataUnionTiles value)? tiles,
    TResult? Function(DashboardResPageDataUnionDevice value)? device,
  }) {
    return cards?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageDataUnionCards value)? cards,
    TResult Function(DashboardResPageDataUnionTiles value)? tiles,
    TResult Function(DashboardResPageDataUnionDevice value)? device,
    required TResult orElse(),
  }) {
    if (cards != null) {
      return cards(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardResPageDataUnionCardsImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageDataUnionCards
    implements DashboardResPageDataUnion {
  const factory DashboardResPageDataUnionCards(
      {required final String id,
      required final String title,
      required final String? icon,
      required final int order,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final List<DashboardCard> cards,
      @JsonKey(name: 'data_source')
      required final List<DashboardCardsPageDataSourceUnion> dataSource,
      final String type}) = _$DashboardResPageDataUnionCardsImpl;

  factory DashboardResPageDataUnionCards.fromJson(Map<String, dynamic> json) =
      _$DashboardResPageDataUnionCardsImpl.fromJson;

  /// A unique identifier for the dashboard page.
  @override
  String get id;

  /// The title of the dashboard page, displayed in the UI.
  @override
  String get title;

  /// The icon representing the dashboard page.
  @override
  String? get icon;

  /// The display order of the dashboard page in the navigation or list.
  @override
  int get order;

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// A list of cards associated with the page.
  List<DashboardCard> get cards;

  /// A list of data sources associated with the page.
  @JsonKey(name: 'data_source')
  List<DashboardCardsPageDataSourceUnion> get dataSource;

  /// Indicates that this is a cards dashboard page.
  @override
  String get type;

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageDataUnionCardsImplCopyWith<
          _$DashboardResPageDataUnionCardsImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardResPageDataUnionTilesImplCopyWith<$Res>
    implements $DashboardResPageDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageDataUnionTilesImplCopyWith(
          _$DashboardResPageDataUnionTilesImpl value,
          $Res Function(_$DashboardResPageDataUnionTilesImpl) then) =
      __$$DashboardResPageDataUnionTilesImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String? icon,
      int order,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      List<DashboardTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardTilesPageDataSourceUnion> dataSource,
      String type});
}

/// @nodoc
class __$$DashboardResPageDataUnionTilesImplCopyWithImpl<$Res>
    extends _$DashboardResPageDataUnionCopyWithImpl<$Res,
        _$DashboardResPageDataUnionTilesImpl>
    implements _$$DashboardResPageDataUnionTilesImplCopyWith<$Res> {
  __$$DashboardResPageDataUnionTilesImplCopyWithImpl(
      _$DashboardResPageDataUnionTilesImpl _value,
      $Res Function(_$DashboardResPageDataUnionTilesImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? icon = freezed,
    Object? order = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? tiles = null,
    Object? dataSource = null,
    Object? type = null,
  }) {
    return _then(_$DashboardResPageDataUnionTilesImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
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
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageDataUnionTilesImpl
    implements DashboardResPageDataUnionTiles {
  const _$DashboardResPageDataUnionTilesImpl(
      {required this.id,
      required this.title,
      required this.icon,
      required this.order,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required final List<DashboardTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardTilesPageDataSourceUnion> dataSource,
      this.type = 'tiles'})
      : _tiles = tiles,
        _dataSource = dataSource;

  factory _$DashboardResPageDataUnionTilesImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageDataUnionTilesImplFromJson(json);

  /// A unique identifier for the dashboard page.
  @override
  final String id;

  /// The title of the dashboard page, displayed in the UI.
  @override
  final String title;

  /// The icon representing the dashboard page.
  @override
  final String? icon;

  /// The display order of the dashboard page in the navigation or list.
  @override
  final int order;

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

  /// Indicates that this is a tiles dashboard page.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardResPageDataUnion.tiles(id: $id, title: $title, icon: $icon, order: $order, createdAt: $createdAt, updatedAt: $updatedAt, tiles: $tiles, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageDataUnionTilesImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            const DeepCollectionEquality().equals(other._tiles, _tiles) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      icon,
      order,
      createdAt,
      updatedAt,
      const DeepCollectionEquality().hash(_tiles),
      const DeepCollectionEquality().hash(_dataSource),
      type);

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageDataUnionTilesImplCopyWith<
          _$DashboardResPageDataUnionTilesImpl>
      get copyWith => __$$DashboardResPageDataUnionTilesImplCopyWithImpl<
          _$DashboardResPageDataUnionTilesImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)
        cards,
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)
        tiles,
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)
        device,
  }) {
    return tiles(id, title, icon, order, createdAt, updatedAt, this.tiles,
        dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)?
        cards,
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)?
        tiles,
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)?
        device,
  }) {
    return tiles?.call(id, title, icon, order, createdAt, updatedAt, this.tiles,
        dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)?
        cards,
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)?
        tiles,
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)?
        device,
    required TResult orElse(),
  }) {
    if (tiles != null) {
      return tiles(id, title, icon, order, createdAt, updatedAt, this.tiles,
          dataSource, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardResPageDataUnionCards value) cards,
    required TResult Function(DashboardResPageDataUnionTiles value) tiles,
    required TResult Function(DashboardResPageDataUnionDevice value) device,
  }) {
    return tiles(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageDataUnionCards value)? cards,
    TResult? Function(DashboardResPageDataUnionTiles value)? tiles,
    TResult? Function(DashboardResPageDataUnionDevice value)? device,
  }) {
    return tiles?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageDataUnionCards value)? cards,
    TResult Function(DashboardResPageDataUnionTiles value)? tiles,
    TResult Function(DashboardResPageDataUnionDevice value)? device,
    required TResult orElse(),
  }) {
    if (tiles != null) {
      return tiles(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardResPageDataUnionTilesImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageDataUnionTiles
    implements DashboardResPageDataUnion {
  const factory DashboardResPageDataUnionTiles(
      {required final String id,
      required final String title,
      required final String? icon,
      required final int order,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final List<DashboardTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardTilesPageDataSourceUnion> dataSource,
      final String type}) = _$DashboardResPageDataUnionTilesImpl;

  factory DashboardResPageDataUnionTiles.fromJson(Map<String, dynamic> json) =
      _$DashboardResPageDataUnionTilesImpl.fromJson;

  /// A unique identifier for the dashboard page.
  @override
  String get id;

  /// The title of the dashboard page, displayed in the UI.
  @override
  String get title;

  /// The icon representing the dashboard page.
  @override
  String? get icon;

  /// The display order of the dashboard page in the navigation or list.
  @override
  int get order;

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// A list of tiles associated with the tiles page.
  List<DashboardTilesPageTilesUnion> get tiles;

  /// A list of data sources associated with the tiles page.
  @JsonKey(name: 'data_source')
  List<DashboardTilesPageDataSourceUnion> get dataSource;

  /// Indicates that this is a tiles dashboard page.
  @override
  String get type;

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageDataUnionTilesImplCopyWith<
          _$DashboardResPageDataUnionTilesImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardResPageDataUnionDeviceImplCopyWith<$Res>
    implements $DashboardResPageDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageDataUnionDeviceImplCopyWith(
          _$DashboardResPageDataUnionDeviceImpl value,
          $Res Function(_$DashboardResPageDataUnionDeviceImpl) then) =
      __$$DashboardResPageDataUnionDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String? icon,
      int order,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String type});
}

/// @nodoc
class __$$DashboardResPageDataUnionDeviceImplCopyWithImpl<$Res>
    extends _$DashboardResPageDataUnionCopyWithImpl<$Res,
        _$DashboardResPageDataUnionDeviceImpl>
    implements _$$DashboardResPageDataUnionDeviceImplCopyWith<$Res> {
  __$$DashboardResPageDataUnionDeviceImplCopyWithImpl(
      _$DashboardResPageDataUnionDeviceImpl _value,
      $Res Function(_$DashboardResPageDataUnionDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? icon = freezed,
    Object? order = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? type = null,
  }) {
    return _then(_$DashboardResPageDataUnionDeviceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
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
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageDataUnionDeviceImpl
    implements DashboardResPageDataUnionDevice {
  const _$DashboardResPageDataUnionDeviceImpl(
      {required this.id,
      required this.title,
      required this.icon,
      required this.order,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      this.type = 'device'});

  factory _$DashboardResPageDataUnionDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageDataUnionDeviceImplFromJson(json);

  /// A unique identifier for the dashboard page.
  @override
  final String id;

  /// The title of the dashboard page, displayed in the UI.
  @override
  final String title;

  /// The icon representing the dashboard page.
  @override
  final String? icon;

  /// The display order of the dashboard page in the navigation or list.
  @override
  final int order;

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// Indicates that this is a device-specific dashboard page.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardResPageDataUnion.device(id: $id, title: $title, icon: $icon, order: $order, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageDataUnionDeviceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, title, icon, order, createdAt, updatedAt, device, type);

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageDataUnionDeviceImplCopyWith<
          _$DashboardResPageDataUnionDeviceImpl>
      get copyWith => __$$DashboardResPageDataUnionDeviceImplCopyWithImpl<
          _$DashboardResPageDataUnionDeviceImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)
        cards,
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)
        tiles,
    required TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)
        device,
  }) {
    return device(
        id, title, icon, order, createdAt, updatedAt, this.device, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)?
        cards,
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)?
        tiles,
    TResult? Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)?
        device,
  }) {
    return device?.call(
        id, title, icon, order, createdAt, updatedAt, this.device, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCardsPageDataSourceUnion> dataSource,
            String type)?
        cards,
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            List<DashboardTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardTilesPageDataSourceUnion> dataSource,
            String type)?
        tiles,
    TResult Function(
            String id,
            String title,
            String? icon,
            int order,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String type)?
        device,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(
          id, title, icon, order, createdAt, updatedAt, this.device, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardResPageDataUnionCards value) cards,
    required TResult Function(DashboardResPageDataUnionTiles value) tiles,
    required TResult Function(DashboardResPageDataUnionDevice value) device,
  }) {
    return device(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageDataUnionCards value)? cards,
    TResult? Function(DashboardResPageDataUnionTiles value)? tiles,
    TResult? Function(DashboardResPageDataUnionDevice value)? device,
  }) {
    return device?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageDataUnionCards value)? cards,
    TResult Function(DashboardResPageDataUnionTiles value)? tiles,
    TResult Function(DashboardResPageDataUnionDevice value)? device,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardResPageDataUnionDeviceImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageDataUnionDevice
    implements DashboardResPageDataUnion {
  const factory DashboardResPageDataUnionDevice(
      {required final String id,
      required final String title,
      required final String? icon,
      required final int order,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String device,
      final String type}) = _$DashboardResPageDataUnionDeviceImpl;

  factory DashboardResPageDataUnionDevice.fromJson(Map<String, dynamic> json) =
      _$DashboardResPageDataUnionDeviceImpl.fromJson;

  /// A unique identifier for the dashboard page.
  @override
  String get id;

  /// The title of the dashboard page, displayed in the UI.
  @override
  String get title;

  /// The icon representing the dashboard page.
  @override
  String? get icon;

  /// The display order of the dashboard page in the navigation or list.
  @override
  int get order;

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated device.
  String get device;

  /// Indicates that this is a device-specific dashboard page.
  @override
  String get type;

  /// Create a copy of DashboardResPageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageDataUnionDeviceImplCopyWith<
          _$DashboardResPageDataUnionDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
