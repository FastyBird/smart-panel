// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'pages_cards_plugin_update_cards_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

PagesCardsPluginUpdateCardsPage _$PagesCardsPluginUpdateCardsPageFromJson(
    Map<String, dynamic> json) {
  return _PagesCardsPluginUpdateCardsPage.fromJson(json);
}

/// @nodoc
mixin _$PagesCardsPluginUpdateCardsPage {
  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the page.
  String get title => throw _privateConstructorUsedError;

  /// The display order of the page.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this PagesCardsPluginUpdateCardsPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PagesCardsPluginUpdateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PagesCardsPluginUpdateCardsPageCopyWith<PagesCardsPluginUpdateCardsPage>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PagesCardsPluginUpdateCardsPageCopyWith<$Res> {
  factory $PagesCardsPluginUpdateCardsPageCopyWith(
          PagesCardsPluginUpdateCardsPage value,
          $Res Function(PagesCardsPluginUpdateCardsPage) then) =
      _$PagesCardsPluginUpdateCardsPageCopyWithImpl<$Res,
          PagesCardsPluginUpdateCardsPage>;
  @useResult
  $Res call({String type, String title, int order, String? icon});
}

/// @nodoc
class _$PagesCardsPluginUpdateCardsPageCopyWithImpl<$Res,
        $Val extends PagesCardsPluginUpdateCardsPage>
    implements $PagesCardsPluginUpdateCardsPageCopyWith<$Res> {
  _$PagesCardsPluginUpdateCardsPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PagesCardsPluginUpdateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PagesCardsPluginUpdateCardsPageImplCopyWith<$Res>
    implements $PagesCardsPluginUpdateCardsPageCopyWith<$Res> {
  factory _$$PagesCardsPluginUpdateCardsPageImplCopyWith(
          _$PagesCardsPluginUpdateCardsPageImpl value,
          $Res Function(_$PagesCardsPluginUpdateCardsPageImpl) then) =
      __$$PagesCardsPluginUpdateCardsPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String type, String title, int order, String? icon});
}

/// @nodoc
class __$$PagesCardsPluginUpdateCardsPageImplCopyWithImpl<$Res>
    extends _$PagesCardsPluginUpdateCardsPageCopyWithImpl<$Res,
        _$PagesCardsPluginUpdateCardsPageImpl>
    implements _$$PagesCardsPluginUpdateCardsPageImplCopyWith<$Res> {
  __$$PagesCardsPluginUpdateCardsPageImplCopyWithImpl(
      _$PagesCardsPluginUpdateCardsPageImpl _value,
      $Res Function(_$PagesCardsPluginUpdateCardsPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of PagesCardsPluginUpdateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$PagesCardsPluginUpdateCardsPageImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PagesCardsPluginUpdateCardsPageImpl
    implements _PagesCardsPluginUpdateCardsPage {
  const _$PagesCardsPluginUpdateCardsPageImpl(
      {required this.type,
      required this.title,
      required this.order,
      this.icon});

  factory _$PagesCardsPluginUpdateCardsPageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$PagesCardsPluginUpdateCardsPageImplFromJson(json);

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'PagesCardsPluginUpdateCardsPage(type: $type, title: $title, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PagesCardsPluginUpdateCardsPageImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type, title, order, icon);

  /// Create a copy of PagesCardsPluginUpdateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PagesCardsPluginUpdateCardsPageImplCopyWith<
          _$PagesCardsPluginUpdateCardsPageImpl>
      get copyWith => __$$PagesCardsPluginUpdateCardsPageImplCopyWithImpl<
          _$PagesCardsPluginUpdateCardsPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PagesCardsPluginUpdateCardsPageImplToJson(
      this,
    );
  }
}

abstract class _PagesCardsPluginUpdateCardsPage
    implements PagesCardsPluginUpdateCardsPage {
  const factory _PagesCardsPluginUpdateCardsPage(
      {required final String type,
      required final String title,
      required final int order,
      final String? icon}) = _$PagesCardsPluginUpdateCardsPageImpl;

  factory _PagesCardsPluginUpdateCardsPage.fromJson(Map<String, dynamic> json) =
      _$PagesCardsPluginUpdateCardsPageImpl.fromJson;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of PagesCardsPluginUpdateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PagesCardsPluginUpdateCardsPageImplCopyWith<
          _$PagesCardsPluginUpdateCardsPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
