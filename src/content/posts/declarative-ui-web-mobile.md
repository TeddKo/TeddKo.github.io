---
title: "선언형 UI 는 무엇이고, 웹과 모바일은 각자 어떻게 구현했나"
description: "명령형 UI 와 선언형 UI 의 차이에서 시작해 React, Vue, Svelte, SolidJS 같은 웹 프레임워크와 Jetpack Compose, SwiftUI, Flutter, React Native, Compose Multiplatform 이 상태 변화를 화면에 반영하는 방식을 나란히 비교했습니다."
pubDatetime: 2026-11-09T16:48:00+09:00
category: mobile
tags:
  - 선언형 UI
  - Jetpack Compose
  - SwiftUI
  - Flutter
  - React
---

Android 를 XML 과 `findViewById` 로 시작한 사람에게 Compose 는 처음에 꽤 낯섭니다. 그런데 웹 쪽에서 React 를 먼저 써 본 사람은 Compose 코드를 보자마자 익숙하다고 말합니다. SwiftUI 와 Flutter 도 비슷한 인상을 줍니다. 모두 "선언형 UI"라는 같은 생각에서 나왔기 때문입니다. 겉모양이 닮은 만큼 속은 꽤 다르기도 해서, 개념과 플랫폼별 구현을 한 번에 정리해 봤습니다.

## 명령형 UI 는 화면을 고치는 순서를 적습니다

XML 레이아웃과 View 로 만든 카운터 버튼은 이렇습니다.

```kotlin
var count = 0
binding.button.text = "눌린 횟수 $count"
binding.button.setOnClickListener {
    count++
    binding.button.text = "눌린 횟수 $count"
}
```

화면에는 이미 만들어진 `Button` 객체가 있고, 코드는 그 객체를 찾아가 텍스트를 바꾸라고 지시합니다. 상태(`count`)와 화면(`button.text`)이 따로 존재하고, 둘을 맞추는 일은 개발자 몫입니다. 버튼이 하나면 괜찮지만, 같은 값이 화면 세 군데에 나오고 로딩 중에는 버튼을 끄고 에러가 나면 문구를 바꿔야 한다면, 상태가 바뀌는 모든 경로에서 고쳐야 할 뷰를 빠짐없이 고쳐야 합니다. 하나라도 빠뜨리면 화면과 상태가 어긋납니다. 웹에서 jQuery 로 DOM 을 직접 고치던 시절의 문제와 같습니다.

## 선언형 UI 는 상태에 대한 화면을 적습니다

같은 버튼을 Compose 로 쓰면 이렇습니다.

```kotlin
@Composable
fun Counter() {
    var count by remember { mutableIntStateOf(0) }
    Button(onClick = { count++ }) {
        Text("눌린 횟수 $count")
    }
}
```

버튼 텍스트를 바꾸는 코드가 없습니다. "count 가 이 값이면 화면은 이렇다"만 적었고, `count` 가 바뀌면 프레임워크가 이 설명을 다시 계산해 화면을 맞춥니다. 흔히 `UI = f(state)` 라고 줄여 씁니다. 개발자는 상태를 바꾸기만 하고, 화면을 상태에 맞추는 일은 프레임워크가 맡습니다.

이 약속을 지키려면 프레임워크가 세 가지를 해결해야 합니다.

1. 상태가 바뀌었을 때 설명 중 **어디를 다시 계산할지**
2. 새 설명과 지난 설명을 비교해 **무엇이 바뀌었는지** 어떻게 찾을지
3. 바뀐 부분을 **실제 화면에 어떻게 반영할지**

모든 선언형 프레임워크는 이 세 질문에 각자 다른 답을 냈습니다. 다른 점은 거의 다 여기서 갈립니다.

![상태가 바뀌면 UI = f(상태)를 다시 계산하고 바뀐 부분만 실제 화면에 반영하는 공통 흐름 아래, 웹은 React 와 Vue 가 가상 DOM 을 비교하거나 Svelte 와 SolidJS 가 signal 을 읽은 곳만 갱신해 브라우저 DOM 을 고치고, 모바일 네이티브는 Jetpack Compose 가 state 를 읽은 재시작 범위만 재실행하고 SwiftUI 가 의존이 바뀐 View 의 body 를 재계산하며, 크로스플랫폼은 Flutter 가 Element 로 Widget 을 비교해 RenderObject 를 갱신하고 React Native 가 Fabric shadow tree 를 거쳐 네이티브 뷰를 고치는 그림](@/assets/images/declarative-ui-pipeline.png)

## 웹: 출력은 언제나 DOM 입니다

웹 프레임워크의 출력 대상은 브라우저 DOM 하나입니다. DOM 은 이미 만들어진 노드 트리이고, 노드를 고치는 API 는 명령형입니다. 그래서 웹의 선언형 프레임워크는 "선언형 설명을 DOM 에 대한 최소한의 명령으로 바꾸는 장치"라고 볼 수 있고, 그 장치를 어떻게 만들었는지가 갈립니다. 프레임워크별 자세한 비교는 [React, Vue, Svelte, Angular, SolidJS 중 무엇을 고를까](/posts/react-vue-svelte/)에 적었고 여기서는 선언형 UI 관점만 봅니다.

**React** 는 상태가 바뀐 컴포넌트 함수를 다시 실행해 새 가상 DOM 트리를 만들고 지난 트리와 비교(reconciliation)합니다. 같은 위치에 같은 `type` 이 있으면 같은 노드로 보고 속성만 고치며, 목록에서는 `key` 로 정체성을 판단합니다. 부모가 다시 렌더링되면 자식도 기본적으로 같이 실행되므로 불필요한 실행을 줄이는 것이 숙제였고, React Compiler 가 빌드 단계에서 메모이제이션을 넣어 이를 줄여 줍니다.

**Vue** 는 반응형 시스템이 컴포넌트가 렌더링 중 어떤 값을 읽었는지 추적합니다. 값이 바뀌면 그 값에 의존하는 컴포넌트만 다시 렌더링하고, 그 결과는 가상 DOM 으로 비교합니다. 템플릿 컴파일러가 정적인 부분을 표시해 두어 비교할 범위도 줄입니다.

**Svelte** 와 **SolidJS** 는 컴포넌트를 다시 실행하는 단계 자체를 없앴습니다. Svelte 는 컴파일러가 컴포넌트를 "이 값이 바뀌면 이 노드를 고친다"는 코드로 바꿔 버리고, Svelte 5 의 `$state` 같은 runes 가 그 의존 관계를 알려 줍니다. SolidJS 는 컴포넌트 함수를 처음 한 번만 실행하고, 이후에는 signal 을 읽은 표현식만 다시 계산해 해당 DOM 노드를 직접 고칩니다. 가상 DOM 비교가 없으니 "무엇이 바뀌었나"를 찾는 비용이 거의 없습니다.

```jsx
// React
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>눌린 횟수 {count}</button>;
}
```

```svelte
<!-- Svelte 5 -->
<script>
  let count = $state(0);
</script>
<button onclick={() => count++}>눌린 횟수 {count}</button>
```

코드는 거의 같아 보여도 버튼을 누른 뒤 일어나는 일은 다릅니다. React 는 `Counter` 함수 전체를 다시 실행하고 가상 DOM 을 비교한 뒤 텍스트 노드를 고칩니다. Svelte 는 `count` 를 읽는 텍스트 노드 하나를 바로 고칩니다.

## 모바일 네이티브: 플랫폼이 직접 만든 선언형 UI

모바일에서는 플랫폼 회사가 기존 View 시스템 위에 선언형 UI 를 새로 만들었습니다. 웹과 달리 출력 대상도 직접 정할 수 있었습니다.

**Jetpack Compose** 는 React 처럼 함수를 다시 실행하는 모델이지만 단위가 더 작습니다. 컴포저블이 실행되며 읽은 state 를 스냅샷 시스템이 기록해 두고, state 가 바뀌면 그 state 를 읽은 재시작 범위만 다시 실행합니다. 재시작 범위는 컴포저블 함수일 수도 있고 그 안의 composable 람다일 수도 있어서, 부모는 그대로 두고 안쪽 람다만 다시 도는 일이 흔합니다. 다시 실행되는 범위 안의 자식은 인자를 지난 값과 비교해 같으면 건너뜁니다. 정체성은 가상 트리의 `key` 가 아니라 코드에서의 호출 위치로 판단하고, 그 결과를 slot table 이라는 자료 구조에 저장합니다. 출력은 Android `View` 위젯이 아니라 Compose 자신의 `LayoutNode` 트리이고, 측정과 배치와 그리기를 Compose 가 직접 합니다. 재구성 범위와 건너뛰기 규칙은 [Compose 재구성과 stability](/posts/compose-recomposition-stability/)에 따로 정리했습니다.

**SwiftUI** 의 `View` 는 클래스가 아니라 값 타입인 구조체입니다. 화면 요소를 들고 있는 객체가 아니라 "이렇게 생겼다"는 가벼운 설명이고, 상태가 바뀌면 그 상태에 의존하는 View 의 `body` 를 다시 계산합니다. `@State` 는 View 가 직접 소유하는 상태이고, 모델 객체는 Observation 프레임워크의 `@Observable` 매크로를 쓰면 `body` 가 실제로 읽은 프로퍼티가 바뀔 때만 다시 계산됩니다. 정체성은 View 계층 안의 구조적 위치와 `id` 로 판단합니다. 그 아래에서 실제 화면을 어떻게 그리는지는 Apple 이 공개하지 않은 내부 구현입니다.

```swift
struct Counter: View {
    @State private var count = 0

    var body: some View {
        Button("눌린 횟수 \(count)") { count += 1 }
    }
}
```

Compose 와 SwiftUI 는 출발점이 비슷합니다. 둘 다 언어 기능(Kotlin 컴파일러 플러그인, Swift 의 result builder 와 매크로)을 적극적으로 써서 선언형 문법을 만들었고, 둘 다 "다시 실행할 범위"를 실제로 읽은 상태 기준으로 좁히는 쪽으로 발전했습니다.

## 크로스플랫폼: 화면을 누가 그리느냐가 갈립니다

크로스플랫폼 프레임워크에는 질문이 하나 더 붙습니다. 설명을 바탕으로 화면을 그릴 때 각 OS 의 네이티브 위젯을 쓸지, 직접 그릴지입니다. 렌더링 구조 비교는 [Android 개발자가 다시 보는 React Native, Flutter, Compose Multiplatform](/posts/react-native-flutter-cmp/)에서 자세히 다뤘습니다.

**Flutter** 는 트리가 세 겹입니다. `Widget` 은 불변 설정 객체이고, `build()` 가 돌 때마다 새로 만들어집니다. `Element` 는 화면 위의 위치를 차지하는 오래 사는 객체로, 새 Widget 이 오면 지난 Widget 과 `runtimeType` 과 `key` 가 같은지 보고 같으면 자신을 재사용해 설정만 갱신합니다. 실제 레이아웃과 페인트는 `RenderObject` 가 맡고, 그리기는 Impeller 엔진이 합니다. 네이티브 위젯을 쓰지 않으니 모든 플랫폼에서 같은 렌더링 경로를 탑니다.

```dart
class Counter extends StatefulWidget {
  const Counter({super.key});

  @override
  State<Counter> createState() => _CounterState();
}

class _CounterState extends State<Counter> {
  int count = 0;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: () => setState(() => count++),
      child: Text('눌린 횟수 $count'),
    );
  }
}
```

`setState` 를 부른 `State` 의 `build()` 가 다시 실행되는 구조라, 다시 실행하는 단위는 React 의 컴포넌트에 가깝습니다. 큰 화면을 `StatefulWidget` 하나로 만들면 작은 변경에도 넓은 범위의 `build()` 가 다시 돌기 때문에 위젯을 잘게 나누고 `const` 생성자를 쓰는 것이 기본 습관이 됩니다.

**React Native** 는 웹의 React 를 그대로 가져왔습니다. 선언형 부분, 즉 컴포넌트 재실행과 재조정은 React 와 같고, 출력 대상만 DOM 대신 네이티브 뷰입니다. New Architecture 의 Fabric 렌더러가 C++ 로 된 shadow tree 를 만들어 레이아웃을 계산하고, 바뀐 부분을 Android 와 iOS 의 실제 뷰에 반영합니다. 그래서 버튼은 각 OS 의 진짜 뷰로 보입니다.

**Compose Multiplatform** 은 선언형 부분이 Jetpack Compose 와 같은 런타임입니다. 재구성, 스냅샷, 건너뛰기 규칙이 모두 같고, Android 에서는 Jetpack Compose 그 자체입니다. iOS 에서는 Skia 를 감싼 Skiko 위에 Compose 가 직접 그리므로, 렌더링 방식만 보면 Flutter 와 같은 쪽에 속합니다.

## 나란히 놓으면

![React, Vue, Svelte 와 SolidJS, Jetpack Compose, SwiftUI, Flutter, React Native 를 다시 실행하는 단위, 바뀐 곳을 찾는 방법, 최종 출력의 세 기준으로 비교한 표](@/assets/images/declarative-ui-matrix.png)

표를 세로로 읽으면 흐름이 하나 보입니다. 처음 나온 선언형 프레임워크들, 즉 React 와 Flutter 는 컴포넌트나 위젯 단위로 다시 실행하고 트리를 비교했습니다. 이 방식은 단순하고 예측하기 쉽지만 다시 실행할 필요가 없는 코드까지 돌립니다. 그 뒤에 나온 것들은 "상태를 실제로 읽은 곳"을 추적해 범위를 좁히는 쪽으로 갔습니다. SolidJS 와 Svelte 5 는 표현식 단위까지 내려갔고, Compose 는 함수 재실행 모델을 유지하면서 스냅샷 읽기 추적으로 범위를 람다 단위까지 줄였고, SwiftUI 는 Observation 으로 프로퍼티 단위 의존을 추적합니다. React 는 반대로 실행 모델을 그대로 두고 컴파일러가 메모이제이션을 자동으로 넣는 길을 택했습니다.

정체성을 판단하는 방법도 비교해 볼 만합니다. 같은 자리의 같은 요소인지 알아야 상태를 보존하고 애니메이션을 이어 갈 수 있기 때문입니다.

- React 와 React Native: 트리 안의 위치와 `type`, 목록에서는 `key`
- Flutter: `runtimeType` 과 `Key`
- Compose: 코드에서의 호출 위치, 목록이나 조건문에서는 `key()` 와 `LazyColumn` 의 `key`
- SwiftUI: View 계층의 구조적 위치, `ForEach` 의 `Identifiable` 이나 `id`

이름은 다르지만 하는 일은 같습니다. 그래서 목록 항목에 안정적인 키를 주지 않으면 항목 상태가 엉뚱한 줄로 옮겨 가는 버그도 프레임워크마다 똑같이 생깁니다.

## 하나를 알면 나머지가 빨리 읽힙니다

선언형 UI 를 처음 배울 때 가장 어려운 부분은 문법이 아니라 "화면을 고치지 말고 상태를 고친다"는 습관입니다. 이 습관은 웹에서 익혔든 Android 에서 익혔든 그대로 옮겨 갑니다. 상태를 한곳에 두고 아래로 내려보내며 이벤트는 위로 올린다는 단방향 흐름도 React, Compose, SwiftUI, Flutter 문서가 모두 같은 말로 권합니다.

반대로 성능 문제를 볼 때는 차이를 알아야 합니다. React 에서 통하던 "부모 렌더링을 줄여라"는 조언이 SolidJS 에서는 거의 의미가 없고, Compose 에서는 부모 리렌더보다 state 를 어디서 읽는지가 더 중요합니다. Flutter 에서는 `build()` 범위를 나누는 것이, SwiftUI 에서는 `body` 가 무엇에 의존하는지가 핵심입니다. 같은 `UI = f(state)` 라도 "f 를 어디까지 다시 부르나"가 프레임워크마다 다르기 때문입니다.

## 참고 자료

- [Thinking in Compose (Android Developers)](https://developer.android.com/develop/ui/compose/mental-model)
- [Render and Commit (React)](https://react.dev/learn/render-and-commit)
- [Preserving and Resetting State (React)](https://react.dev/learn/preserving-and-resetting-state)
- [Reactivity in Depth (Vue)](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [$state (Svelte)](https://svelte.dev/docs/svelte/$state)
- [Fine-grained reactivity (SolidJS)](https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity)
- [SwiftUI (Apple Developer)](https://developer.apple.com/documentation/swiftui)
- [Managing model data in your app (Apple Developer)](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)
- [Flutter architectural overview (Flutter)](https://docs.flutter.dev/resources/architectural-overview)
- [Render, Commit, and Mount (React Native)](https://reactnative.dev/architecture/render-pipeline)
- [Compose Multiplatform (Kotlin)](https://kotlinlang.org/docs/multiplatform/compose-multiplatform.html)
