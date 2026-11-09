---
title: "Server-Driven UI: 서버가 화면 구조를 내려줄 때 Android 에서 생기는 일"
description: "Server-Driven UI 가 데이터 중심 UI 와 무엇이 다른지, 스키마를 어떻게 설계하는지, Jetpack Compose 렌더러와 kotlinx.serialization 으로 어떻게 받는지, 그리고 비용과 쓰지 말아야 할 경우까지 정리했습니다."
pubDatetime: 2026-10-14T21:30:00+09:00
category: android
tags:
  - SDUI
  - Jetpack Compose
  - kotlinx.serialization
  - Android
---

일반적인 모바일 앱에서 서버는 데이터를 내려주고, 그 데이터를 어떤 화면에 어떻게 배치할지는 앱 코드가 정합니다. Server-Driven UI(SDUI)는 이 경계를 한 칸 옮겨서 서버가 화면의 구조까지 내려주는 방식입니다. 앱은 받은 구조를 해석해 그리기만 합니다. 이 글은 SDUI 가 무엇인지, 스키마와 Android 렌더러를 어떻게 구성하는지, 어떤 비용이 따르고 언제 쓰지 말아야 하는지를 정리합니다.

## 데이터 중심 UI 와 무엇이 다른가

데이터 중심 클라이언트에서는 서버가 `{ "title": "...", "items": [...] }` 같은 비즈니스 모델을 주고, 클라이언트가 "이 데이터는 이 컴포저블로 그린다"를 코드로 가지고 있습니다. 화면을 바꾸려면 앱을 새로 배포해야 합니다.

SDUI 에서는 서버가 "제목 텍스트 하나, 그 아래 버튼 둘, 버튼을 누르면 이 화면으로 이동"처럼 화면 구성 자체를 응답에 담습니다. 클라이언트는 `type` 에 맞는 렌더러를 골라 그리는 범용 컨테이너가 됩니다. Thoughtworks Technology Radar(2026년 4월, Vol. 34)는 이 방식을 이렇게 설명합니다. 앱 안의 범용 컨테이너가 서버가 준 구조와 데이터로 화면을 렌더링하므로, 모바일 팀이 앱 스토어 심사를 기다리지 않고 변경을 내보낼 수 있다는 것입니다.

![서버가 화면 정의를 만들어 JSON 스키마로 내려주면 클라이언트가 sealed 모델로 파싱하고 Composable 렌더러가 그리며, 사용자 입력은 Action 모델로 전달되어 이동이나 URL 열기로 처리되는 흐름도](@/assets/images/server-driven-ui-flow.png)

## 왜 쓰는가

흔히 드는 이유는 세 가지입니다.

- **배포 주기**: 화면 구성이 서버에 있으면 앱 릴리스와 스토어 심사 없이 바꿀 수 있습니다. 위 Radar 항목이 말하는 이점이 바로 이것입니다.
- **실험**: 같은 앱 버전 안에서 사용자 그룹마다 다른 화면 구조를 내려줄 수 있어 A/B 테스트에 맞습니다. 서버가 응답을 정하기 때문입니다.
- **플랫폼 일관성**: 화면 정의가 한 곳에서 나오면 Android, iOS, 웹이 같은 구조를 받습니다.

공개된 사례로는 Airbnb 의 Ghost Platform 이 있습니다. The Airbnb Tech Blog 의 [A Deep Dive into Airbnb's Server-Driven UI System](https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5)(Ryan Brooks, 2021-06-29)은 Ghost Platform 을 웹, iOS, Android 에서 빠르게 반복하고 안전하게 출시하게 해 주는 통합 SDUI 시스템으로 소개합니다. 세 플랫폼은 하나의 공유 GraphQL 스키마를 씁니다. UI 를 기술하는 주요 개념은 sections(화면에 표시할 데이터까지 담은, 서로 관련된 UI 컴포넌트 묶음)와 screens(섹션을 어디에 어떻게 배치할지 정의)이고, 여기에 사용자 상호작용을 처리하는 actions 가 더해집니다. 데이터 계층으로는 Viaduct 라는 데이터 서비스 메시를 씁니다. 이 구성은 [InfoQ 의 요약 기사](https://www.infoq.com/news/2021/07/airbnb-server-driven-ui)에도 같은 내용으로 정리되어 있습니다.

## 스키마 설계

SDUI 의 품질은 대부분 스키마에서 결정됩니다. 위 Airbnb 글의 용어를 빌리면 응답은 화면(screen)과 섹션(section)으로 구조를 기술하고, 사용자 상호작용은 액션(action)으로 따로 표현합니다. 이 글의 예시는 이를 단순화해 화면 아래에 컴포넌트 목록을 두고, `column` 같은 컨테이너 컴포넌트가 자식을 갖는 구조로 씁니다.

![Screen 아래에 text, column, 알 수 없는 type 의 carousel3d 컴포넌트가 있고, column 은 text 와 button 을 자식으로 가지며, carousel3d 는 숨김 또는 기본 UI 로 처리되는 Fallback 으로 넘어가는 컴포넌트 트리](@/assets/images/server-driven-ui-tree.png)

화면 응답 하나는 대략 이런 JSON 입니다. 필드 이름은 이 글이 정한 예시이며 표준이 아닙니다.

```json
{
  "version": 1,
  "sections": [
    { "type": "text", "id": "t1", "value": "이번 주 추천", "style": "title" },
    {
      "type": "column",
      "id": "c1",
      "children": [
        { "type": "text", "id": "t2", "value": "자세히 보기" },
        {
          "type": "button",
          "id": "b1",
          "label": "열기",
          "action": { "type": "navigate", "route": "detail/42" }
        }
      ]
    },
    { "type": "carousel3d", "id": "x1" }
  ]
}
```

마지막 `carousel3d` 는 이 앱 버전이 모르는 타입이라고 가정한 것입니다. 스키마를 짤 때 정해 둘 것은 다음과 같습니다.

**타입 식별자**: 컴포넌트와 액션은 모두 `type` 으로 구분합니다. kotlinx.serialization 의 기본 클래스 구분자도 `type` 입니다.

**안정적인 id**: 컴포넌트마다 id 를 두면 리스트의 key 와 테스트, 로깅에 같은 값을 쓸 수 있습니다.

**버전**: 스키마 전체에 `version` 을 두거나, 클라이언트가 요청 헤더로 자신의 버전과 지원 컴포넌트 목록을 알리는 방식을 쓸 수 있습니다. 서버가 아직 새 컴포넌트를 모르는 옛 앱에는 그 컴포넌트를 내려주지 않게 하는 것이 가장 안전합니다.

**하위 호환 규칙**: 필드는 추가만 하고, 새 필드에는 기본값을 둡니다. 기존 필드의 의미를 바꾸거나 제거하면 이미 설치된 앱이 깨집니다. 앱은 오래된 버전이 계속 살아 있다는 점이 웹과 가장 다릅니다.

**알 수 없는 컴포넌트**: 옛 앱이 새 `type` 을 만났을 때의 동작을 스키마 차원에서 정해야 합니다. 무시하고 건너뛸지, 서버가 준 대체 컴포넌트를 쓸지, 화면 전체를 오류 처리할지입니다.

## Android 에서 받기: kotlinx.serialization

kotlinx.serialization 의 [다형성 문서](https://kotlinlang.org/docs/serialization-polymorphism.html)에 따르면 sealed 계층의 하위 클래스는 `@SerialName` 으로 구분자 값을 지정하고, 직렬화된 JSON 에는 기본으로 `type` 프로퍼티가 들어갑니다. 같은 문서는 등록되지 않은 `type` 값을 만나면 디코딩이 `SerializationException` 으로 실패한다고 설명합니다. SDUI 에서는 이 동작이 곧 "새 컴포넌트가 하나 섞인 화면 전체가 안 열리는" 사고가 되므로, 알 수 없는 타입을 받아 줄 장치가 필요합니다.

문서는 등록되지 않은 하위 타입을 받기 위해 `SerializersModule` 의 `polymorphic` 블록에서 `defaultDeserializer` 를 지정하는 방법을 소개합니다. 이 방법은 sealed 계층에도 쓸 수 있습니다. 이 글은 대신 `type` 값을 직접 읽어 디코더를 고르는 [`JsonContentPolymorphicSerializer`](https://kotlinlang.org/api/kotlinx.serialization/kotlinx-serialization-json/kotlinx.serialization.json/-json-content-polymorphic-serializer/)를 씁니다. 매핑과 폴백이 직렬화기 한 곳에 모이기 때문입니다. 이 클래스는 JSON 내용을 보고 역직렬화기를 고르는 기반 클래스이며 `Json` 형식에서만 동작합니다. 직렬화할 때는 `type` 을 다시 써 넣지 않으므로, 디코딩 전용으로 쓰는 것이 안전합니다.

```kotlin
import kotlinx.serialization.*
import kotlinx.serialization.json.*

@Serializable(with = ComponentSerializer::class)
sealed interface Component {
    val id: String

    @Serializable
    data class Text(override val id: String, val value: String, val style: String = "body") : Component

    @Serializable
    data class Button(override val id: String, val label: String, val action: Action) : Component

    @Serializable
    data class Column(override val id: String, val children: List<Component>) : Component

    @Serializable
    data class Unknown(override val id: String = "") : Component
}

object ComponentSerializer : JsonContentPolymorphicSerializer<Component>(Component::class) {
    override fun selectDeserializer(element: JsonElement) =
        when (element.jsonObject["type"]?.jsonPrimitive?.content) {
            "text" -> Component.Text.serializer()
            "button" -> Component.Button.serializer()
            "column" -> Component.Column.serializer()
            else -> Component.Unknown.serializer()
        }
}

@Serializable
sealed interface Action {
    @Serializable @SerialName("navigate")
    data class Navigate(val route: String) : Action

    @Serializable @SerialName("open_url")
    data class OpenUrl(val url: String) : Action
}

@Serializable
data class ScreenDto(val version: Int, val sections: List<Component>)

val sduiJson = Json { ignoreUnknownKeys = true }
```

`ignoreUnknownKeys` 는 [Json 설정 문서](https://kotlinlang.org/api/kotlinx.serialization/kotlinx-serialization-json/kotlinx.serialization.json/-json-builder/)에 따르면 입력 JSON 의 알 수 없는 프로퍼티를 예외 대신 무시하는 옵션이고 기본값은 `false` 입니다. 여기서는 두 가지 이유로 켭니다. `type` 키가 하위 클래스의 프로퍼티가 아니라는 점, 그리고 서버가 필드를 추가해도 옛 앱이 깨지지 않아야 한다는 점입니다.

`Action` 은 기본 다형성 방식을 그대로 썼기 때문에, 서버가 새 액션 `type` 을 내려주면 `SerializationException` 이 납니다. 액션은 `Button` 의 프로퍼티이므로 이 예외는 버튼 하나가 아니라 화면 응답 전체의 디코딩을 실패시킵니다. `Action` 에도 `Unknown` 을 두고, `polymorphic(Action::class) { defaultDeserializer { Action.Unknown.serializer() } }` 처럼 기본 역직렬화기를 지정하거나 `Component` 와 같은 방식의 직렬화기를 두어 아무 일도 하지 않게 처리해야 합니다. 여기서는 길이 때문에 생략했습니다.

## Android 에서 그리기: Compose 렌더러

렌더러는 모델을 컴포저블로 옮기는 `when` 하나입니다. sealed 타입이라 컴파일러가 분기 누락을 알려 주고, `Unknown` 분기가 폴백 자리입니다.

```kotlin
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
fun RenderComponent(
    component: Component,
    onAction: (Action) -> Unit,
    modifier: Modifier = Modifier,
) {
    when (component) {
        is Component.Text -> Text(component.value, modifier)
        is Component.Button -> Button(onClick = { onAction(component.action) }, modifier = modifier) {
            Text(component.label)
        }
        is Component.Column -> Column(modifier) {
            component.children.forEach { RenderComponent(it, onAction) }
        }
        is Component.Unknown -> Unit
    }
}
```

`Unknown` 을 `Unit` 으로 두면 모르는 컴포넌트는 그냥 그려지지 않습니다. 건너뛰어도 되는 장식 요소에는 이 처리가 맞지만, 결제 버튼처럼 빠지면 화면이 의미를 잃는 요소라면 화면 단위로 오류 UI 를 보여 주거나 서버가 대체 컴포넌트를 함께 내려주는 편이 맞습니다. 어느 쪽을 택할지는 스키마 규칙으로 정해 두어야 합니다.

섹션 목록이 길면 `LazyColumn` 에 넣습니다. Android 의 [리스트 문서](https://developer.android.com/develop/ui/compose/lists)는 아이템마다 안정적이고 고유한 `key` 를 주면 데이터셋이 바뀌어도 아이템 상태가 일관되게 유지된다고 설명합니다. 스키마의 `id` 를 `key` 로 쓰는 것이 자연스럽지만, `key` 는 목록 안에서 고유해야 하고 중복되면 `LazyColumn` 이 예외를 던집니다. 위 모델의 `Unknown` 은 `id` 기본값이 빈 문자열이라 id 없는 미지 컴포넌트가 둘만 와도 키가 겹칩니다. 그래서 그리지 않을 `Unknown` 은 목록에서 먼저 걸러 냅니다. 서버 쪽에서도 화면 안 `id` 의 고유성을 계약으로 보장해야 합니다.

```kotlin
LazyColumn {
    items(screen.sections.filterNot { it is Component.Unknown }, key = { it.id }) { section ->
        RenderComponent(section, onAction)
    }
}
```

## 액션, 내비게이션, 상태

액션은 "탭하면 무엇을 한다"를 데이터로 표현한 것입니다. 위 코드에서 렌더러는 액션을 실행하지 않고 `onAction` 으로 올리기만 합니다. 실제 실행은 화면을 소유한 쪽(보통 ViewModel 과 내비게이션 계층)이 `Action` 을 `when` 으로 풀어 처리합니다. 렌더러가 내비게이션이나 네트워크를 직접 알지 않으므로 컴포넌트를 미리보기와 테스트에서 따로 그릴 수 있습니다. `Navigate` 의 `route` 가 가리킬 수 있는 목적지는 앱이 알고 있는 것으로 한정해야 하고, 모르는 route 는 무시하거나 오류로 처리하는 규칙이 필요합니다.

상태는 둘로 나뉩니다. 화면 구조와 텍스트 같은 서버 소유 상태는 응답을 `UiState` 로 들고 있는 ViewModel 에서 내려보내고, 입력 중인 텍스트나 펼침 여부 같은 클라이언트 소유 상태는 컴포저블 안의 `remember` 로 둡니다. 서버가 같은 화면을 다시 내려줄 때 클라이언트 상태가 지워지지 않으려면 위의 안정적인 `id` 와 `key` 가 필요합니다.

## 비용과 한계

- **디버깅**: 화면이 이상할 때 원인이 앱 코드인지 서버 응답인지 JSON 을 봐야 알 수 있습니다. 응답 원문을 로그로 남길 수 있어야 합니다.
- **성능**: 렌더링 전에 파싱 단계가 하나 더 있고, 트리가 깊거나 컴포넌트 수가 많으면 그만큼 그립니다. 큰 화면은 `LazyColumn` 으로 지연 구성하는 것이 기본입니다.
- **테스트**: 서버가 어떤 조합을 내려줄지 앱 빌드 시점에는 알 수 없습니다. 컴포넌트 단위 테스트에 더해 스키마 샘플(알 수 없는 타입 포함)을 입력으로 쓰는 테스트가 필요하고, 서버 쪽에서는 클라이언트 버전별 응답 계약을 검증해야 합니다.
- **오프라인과 캐시**: 구조도 응답이므로 오프라인이면 마지막으로 받은 응답을 디스크에 두고 보여 줄지 결정해야 합니다. 캐시된 스키마는 옛 버전일 수 있어서 같은 파서가 읽을 수 있어야 합니다. 이때는 디코딩한 모델을 다시 직렬화하지 말고 응답 원문 문자열을 저장해야 합니다. `JsonContentPolymorphicSerializer` 는 직렬화할 때 `type` 을 쓰지 않으므로, 모델을 다시 인코딩해 저장하면 다음에 읽을 때 모든 컴포넌트가 `Unknown` 으로 바뀝니다.
- **접근성**: 서버가 접근성 정보를 내려주지 않으면 렌더러가 만들 수 없습니다. Compose 의 [시맨틱 문서](https://developer.android.com/develop/ui/compose/accessibility/semantics)는 시맨틱이 접근성, 자동완성, 테스트 같은 서비스에 컴포저블의 의미를 전달하는 수단이라고 설명하고 `Icon` 의 `contentDescription` 예를 듭니다. 이미지 같은 컴포넌트의 스키마에 설명 필드를 필수로 두는 식의 규칙이 필요합니다.
- **스토어 정책**: Google Play 의 [기기 및 네트워크 악용 정책](https://support.google.com/googleplay/android-developer/answer/9888379)은 앱이 Google Play 이외의 출처에서 실행 코드(dex, JAR, .so 파일 등)를 다운로드할 수 없다고 정하고, 런타임에 로드되는 JavaScript, Python, Lua 같은 해석형 언어 코드도 정책 위반을 허용해서는 안 된다고 정합니다. 같은 정책은 가상 머신이나 인터프리터 안에서 실행되며 Android API 에 간접 접근만 주는 코드(예: WebView 안의 JavaScript)를 다운로드 제한의 예외로 둡니다. 이 글의 JSON 은 스크립트가 아니라 앱 안의 고정된 렌더러가 해석하는 데이터이지만, 서버가 내려주는 값에 표현식이나 스크립트를 넣기 시작하면 이 조항 쪽으로 가까워집니다. 정확한 적용 여부는 정책 원문을 확인해야 합니다.

## 쓰지 않는 편이 나은 경우

Thoughtworks Radar 는 2026년 4월판에서 SDUI 를 다시 Trial 로 분류하면서(2022년 10월판에서는 Assess) 강한 비즈니스 근거와 엄격한 엔지니어링 규율이 없으면 유지보수가 어려운 "god-protocol" 이 되기 쉽다고 경고하고, 앱 전체를 대체하기보다 변화가 잦은 일부 영역에 쓰라고 권합니다. 이 권고를 바탕으로 판단하면 다음 경우는 SDUI 가 맞지 않습니다.

- 화면이 거의 바뀌지 않거나 앱 릴리스 주기로 충분한 경우
- 제스처, 애니메이션, 카메라처럼 상호작용이 복잡해서 선언형 JSON 으로 표현하면 스키마가 곧 새 프로그래밍 언어가 되는 경우
- 오프라인에서 완전히 동작해야 하고 마지막 응답이 없을 때 화면을 그릴 수 없는 경우
- 서버와 클라이언트를 함께 운영하며 컴포넌트 계약을 관리할 인력이 없는 경우

모든 화면을 SDUI 로 만드는 것보다, 홈의 배너와 프로모션 영역처럼 자주 바뀌는 섹션에만 컨테이너를 두고 나머지는 일반 Compose 화면으로 두는 구성이 위 권고와 맞습니다.

## 참고 자료

- [A Deep Dive into Airbnb's Server-Driven UI System (Airbnb Engineering, 2021-06-29)](https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5)
- [Airbnb's Server-Driven UI (InfoQ, 2021-07)](https://www.infoq.com/news/2021/07/airbnb-server-driven-ui)
- [Server-driven UI (Thoughtworks Technology Radar, 2026-04 Trial)](https://www.thoughtworks.com/radar/techniques/server-driven-ui)
- [Serialize polymorphic classes (kotlinlang.org)](https://kotlinlang.org/docs/serialization-polymorphism.html)
- [JsonContentPolymorphicSerializer (kotlinx.serialization API)](https://kotlinlang.org/api/kotlinx.serialization/kotlinx-serialization-json/kotlinx.serialization.json/-json-content-polymorphic-serializer/)
- [JsonBuilder (kotlinx.serialization API)](https://kotlinlang.org/api/kotlinx.serialization/kotlinx-serialization-json/kotlinx.serialization.json/-json-builder/)
- [Lists and grids in Compose (developer.android.com)](https://developer.android.com/develop/ui/compose/lists)
- [Semantics in Compose (developer.android.com)](https://developer.android.com/develop/ui/compose/accessibility/semantics)
- [Device and Network Abuse (Google Play Console Help)](https://support.google.com/googleplay/android-developer/answer/9888379)
- [A Deep Dive into Airbnb's Server-Driven UI System — Internet Archive 사본](https://web.archive.org/web/2021/https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5)
- [Thoughtworks Technology Radar Vol. 34 PDF (2026-04)](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)
- [JsonContentPolymorphicSerializer.kt 소스 (kotlinx.serialization GitHub)](https://github.com/Kotlin/kotlinx.serialization/blob/master/formats/json/commonMain/src/kotlinx/serialization/json/JsonContentPolymorphicSerializer.kt)
- [PolymorphicModuleBuilder.defaultDeserializer (kotlinx.serialization API)](https://kotlinlang.org/api/kotlinx.serialization/kotlinx-serialization-core/kotlinx.serialization.modules/-polymorphic-module-builder/default-deserializer.html)
- [Sealed classes and interfaces (kotlinlang.org)](https://kotlinlang.org/docs/sealed-classes.html)
