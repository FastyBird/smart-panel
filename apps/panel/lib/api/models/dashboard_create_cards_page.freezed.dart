// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_cards_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateCardsPage _$DashboardCreateCardsPageFromJson(
    Map<String, dynamic> json) {
  return _DashboardCreateCardsPage.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateCardsPage {
  /// The unique identifier for the dashboard page (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// A list of cards associated with the page.
  List<DashboardCreateCard> get cards => throw _privateConstructorUsedError;

  /// A list of data sources associated with the page.
  @JsonKey(name: 'data_source')
  List<DashboardCreateCardsPageDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// Indicates that this is a cards dashboard page.
  String get type => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateCardsPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateCardsPageCopyWith<DashboardCreateCardsPage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateCardsPageCopyWith<$Res> {
  factory $DashboardCreateCardsPageCopyWith(DashboardCreateCardsPage value,
          $Res Function(DashboardCreateCardsPage) then) =
      _$DashboardCreateCardsPageCopyWithImpl<$Res, DashboardCreateCardsPage>;
  @useResult
  $Res call(
      {String id,
      String title,
      int order,
      List<DashboardCreateCard> cards,
      @JsonKey(name: 'data_source')
      List<DashboardCreateCardsPageDataSourceUnion> dataSource,
      String type,
      String? icon});
}

/// @nodoc
class _$DashboardCreateCardsPageCopyWithImpl<$Res,
        $Val extends DashboardCreateCardsPage>
    implements $DashboardCreateCardsPageCopyWith<$Res> {
  _$DashboardCreateCardsPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? order = null,
    Object? cards = null,
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
      cards: null == cards
          ? _value.cards
          : cards // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateCard>,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateCardsPageDataSourceUnion>,
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
abstract class _$$DashboardCreateCardsPageImplCopyWith<$Res>
    implements $DashboardCreateCardsPageCopyWith<$Res> {
  factory _$$DashboardCreateCardsPageImplCopyWith(
          _$DashboardCreateCardsPageImpl value,
          $Res Function(_$DashboardCreateCardsPageImpl) then) =
      __$$DashboardCreateCardsPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      int order,
      List<DashboardCreateCard> cards,
      @JsonKey(name: 'data_source')
      List<DashboardCreateCardsPageDataSourceUnion> dataSource,
      String type,
      String? icon});
}

/// @nodoc
class __$$DashboardCreateCardsPageImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardsPageCopyWithImpl<$Res,
        _$DashboardCreateCardsPageImpl>
    implements _$$DashboardCreateCardsPageImplCopyWith<$Res> {
  __$$DashboardCreateCardsPageImplCopyWithImpl(
      _$DashboardCreateCardsPageImpl _value,
      $Res Function(_$DashboardCreateCardsPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? order = null,
    Object? cards = null,
    Object? dataSource = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardCreateCardsPageImpl(
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
      cards: null == cards
          ? _value._cards
          : cards // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateCard>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateCardsPageDataSourceUnion>,
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
class _$DashboardCreateCardsPageImpl implements _DashboardCreateCardsPage {
  const _$DashboardCreateCardsPageImpl(
      {required this.id,
      required this.title,
      required this.order,
      required final List<DashboardCreateCard> cards,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateCardsPageDataSourceUnion> dataSource,
      this.type = 'cards',
      this.icon})
      : _cards = cards,
        _dataSource = dataSource;

  factory _$DashboardCreateCardsPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCreateCardsPageImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// The title of the dashboard page.
  @override
  final String title;

  /// The position of the page in the dashboard’s list.
  @override
  final int order;

  /// A list of cards associated with the page.
  final List<DashboardCreateCard> _cards;

  /// A list of cards associated with the page.
  @override
  List<DashboardCreateCard> get cards {
    if (_cards is EqualUnmodifiableListView) return _cards;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_cards);
  }

  /// A list of data sources associated with the page.
  final List<DashboardCreateCardsPageDataSourceUnion> _dataSource;

  /// A list of data sources associated with the page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateCardsPageDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// Indicates that this is a cards dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardCreateCardsPage(id: $id, title: $title, order: $order, cards: $cards, dataSource: $dataSource, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateCardsPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            const DeepCollectionEquality().equals(other._cards, _cards) &&
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
      const DeepCollectionEquality().hash(_cards),
      const DeepCollectionEquality().hash(_dataSource),
      type,
      icon);

  /// Create a copy of DashboardCreateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateCardsPageImplCopyWith<_$DashboardCreateCardsPageImpl>
      get copyWith => __$$DashboardCreateCardsPageImplCopyWithImpl<
          _$DashboardCreateCardsPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateCardsPageImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreateCardsPage implements DashboardCreateCardsPage {
  const factory _DashboardCreateCardsPage(
      {required final String id,
      required final String title,
      required final int order,
      required final List<DashboardCreateCard> cards,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateCardsPageDataSourceUnion> dataSource,
      final String type,
      final String? icon}) = _$DashboardCreateCardsPageImpl;

  factory _DashboardCreateCardsPage.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateCardsPageImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// The title of the dashboard page.
  @override
  String get title;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// A list of cards associated with the page.
  @override
  List<DashboardCreateCard> get cards;

  /// A list of data sources associated with the page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateCardsPageDataSourceUnion> get dataSource;

  /// Indicates that this is a cards dashboard page.
  @override
  String get type;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of DashboardCreateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateCardsPageImplCopyWith<_$DashboardCreateCardsPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
