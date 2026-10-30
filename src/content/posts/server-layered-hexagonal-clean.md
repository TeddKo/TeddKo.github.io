---
title: "서버 아키텍처의 의존 방향: 계층형, 헥사고날, 어니언, 클린 아키텍처와 Kotlin 패키지 구조"
description: "계층형 아키텍처가 만드는 의존 방향과 한계, Cockburn 의 헥사고날(포트와 어댑터), Palermo 의 어니언, Martin 의 클린 아키텍처가 공유하는 의존성 규칙을 비교합니다. Spring 에 묶이지 않는 Kotlin 패키지 구조와 테스트 이점, 과하게 느껴지는 경우를 함께 봅니다."
pubDatetime: 2023-05-30T22:00:00+09:00
category: server
tags:
  - 아키텍처
  - 헥사고날
  - 클린 아키텍처
  - Kotlin
---

서버 코드에서 비즈니스 규칙이 컨트롤러와 SQL 사이에 흩어지기 시작하면 테스트를 돌리는 데 데이터베이스와 웹 서버가 필요해집니다. 계층형, 헥사고날, 어니언, 클린 아키텍처는 이 문제에 같은 방향으로 답하는 설계 패턴들로, 핵심은 코드의 의존 방향을 어디에 두느냐입니다. [모놀리스와 마이크로서비스 글](/posts/monolith-vs-microservices/)에서 다룬 모듈 경계가 서비스 사이의 경계였다면, 여기서 보는 경계는 하나의 서비스 안쪽 경계입니다.

## 계층형은 위에서 아래로 의존합니다

가장 흔한 형태는 프레젠테이션, 도메인, 데이터 접근의 세 계층입니다. Martin Fowler 의 글(2015)은 이 구조를 프레젠테이션이 도메인에 의존하고 도메인이 데이터 접근에 의존하는 것으로 설명합니다. 계층의 가장 큰 이점은 개발자가 신경 써야 할 범위가 줄어드는 것이고 바꿔 끼우기와 테스트 용이성은 부가적인 이점이라고 적습니다. 계층은 논리적 구분일 뿐이라서 한 머신에서 돌 수도 있고 여러 티어로 나뉠 수도 있습니다.

그런데 이 구조에서는 의존이 아래로 계속 이어집니다. Jeffrey Palermo 는 2008년 어니언 아키텍처를 제안하면서 전통적인 계층형이 UI 와 비즈니스 로직, 데이터 접근 사이에 불필요한 결합을 만든다고 지적했습니다. 이행적 의존성도 의존성이라서 UI 가 데이터 접근 기술까지 간접적으로 알게 되고 그가 보기에 데이터 접근 기술은 3년 정도 주기로 바뀌기 때문에 이 결합이 업그레이드를 어렵게 만듭니다. Fowler 의 글도 도메인이 데이터 소스에 의존하지 않도록 둘 사이에 매퍼를 두는 변형이 있고 이를 흔히 헥사고날 아키텍처라고 부른다고 언급합니다. 같은 글은 프레젠테이션-도메인-데이터를 대규모 시스템의 최상위 모듈 구조로 삼지 말고 계층이 복잡해지면 최상위를 도메인 중심 모듈로 나눈 뒤 각 모듈 안에서 계층화하라고도 경고합니다.

## 헥사고날은 애플리케이션을 안쪽에 두고 포트로 말합니다

Alistair Cockburn 이 2005년에 쓴 「Hexagonal Architecture」의 의도는 애플리케이션이 사용자, 프로그램, 자동화 테스트, 배치 스크립트 어느 쪽에서든 똑같이 구동될 수 있고 실행 시점의 장치와 데이터베이스에서 떨어져 개발하고 테스트할 수 있게 하는 것입니다. 그가 문제로 든 것은 비즈니스 로직이 UI 코드로 스며드는 일입니다. 그렇게 되면 시각적 세부 사항에 의존하는 테스트를 쓸 수밖에 없고 프로그램으로 애플리케이션을 구동하기도 막힙니다. 데이터베이스가 내려가 있거나 교체 중일 때 일이 멈추는 문제도 같은 뿌리에서 나오며 데이터베이스를 갈아 끼울 수 있는 또 하나의 어댑터로 보자는 것이 그의 제안입니다.

구조는 이렇습니다. 애플리케이션은 안쪽에 있고 바깥과는 포트를 통해 대화합니다. 포트는 목적을 가진 대화를 식별하는 것으로, 기술별 어댑터가 포트에 꽂혀 바깥 기술과 애플리케이션 API 사이를 변환합니다. 애플리케이션을 먼저 호출하는 쪽이 주도(primary, driving) 포트와 어댑터로, 사용자나 테스트 스크립트가 여기에 속합니다. 애플리케이션이 호출하는 쪽은 피주도(secondary, driven) 포트와 어댑터로 데이터베이스와 알림 서비스가 해당합니다. 육각형이라는 모양은 여섯이라는 숫자에 의미가 있어서가 아니고 포트를 그릴 공간이 넉넉해서 고른 것이며 글은 포트가 보통 두 개에서 네 개이고 자신이 본 가장 많은 수가 네 개였다고 적습니다.

![헥사고날 아키텍처 도식. 가운데 육각형이 유스케이스와 도메인 모델을 담은 애플리케이션 코어이고, 왼쪽 포트에는 REST 컨트롤러, 배치, 테스트 코드 어댑터가 연결되며, 오른쪽 포트에는 JPA 저장소, 메시지 발행기, 외부 결제 API 어댑터가 연결된다](@/assets/images/server-hexagonal-ports-adapters.png)

## 어니언과 클린 아키텍처는 의존성 규칙으로 같은 말을 합니다

Palermo 의 어니언은 도메인 모델을 중심에 두고 모든 결합이 중심을 향하게 만듭니다. 도메인 모델은 자기 자신에만 의존하고 그 바깥 층이 저장소 인터페이스 같은 동작을 더합니다. 인터페이스의 구현은 코어 밖에 있고 실행 시점에 의존성 역전으로 주입됩니다. UI 와 인프라, 테스트는 가장자리에 있고 데이터베이스는 중심에서 빠져 외부 서비스로 취급됩니다. Palermo 는 이 접근이 Cockburn 의 헥사고날과 전제를 공유한다고 밝히고 어니언을 오래 가는 복잡한 업무 애플리케이션을 위한 패턴으로 규정하고 작은 웹사이트는 대상에서 뺍니다.

Robert C. Martin 의 「The Clean Architecture」(2012)는 헥사고날, 어니언, Screaming, DCI, BCE 가 세부는 다르지만 관심사를 계층으로 분리한다는 같은 목표를 공유한다고 말하며 시작합니다. 글의 중심은 의존성 규칙입니다. 소스 코드 의존성은 안쪽으로만 향할 수 있고 안쪽 원은 바깥 원의 어떤 이름도 알지 못합니다. 원은 안에서 바깥으로 Entities(전사 비즈니스 규칙), Use Cases(애플리케이션 고유 규칙), Interface Adapters(컨트롤러, 프레젠터, 게이트웨이처럼 데이터를 변환하는 계층), Frameworks and Drivers(데이터베이스와 웹 프레임워크 같은 세부 사항)입니다. 원의 개수는 도식일 뿐이어서 더 필요하면 늘려도 되지만 의존성 규칙은 유지됩니다.

제어 흐름은 바깥으로 나가는데 의존은 안쪽을 향해야 하는 경우가 있습니다. 유스케이스가 저장소를 호출하는 경우가 그렇습니다. Martin 은 이를 의존성 역전으로 풉니다. 안쪽 계층이 인터페이스를 정의하고 바깥 계층이 구현하면, 호출은 바깥으로 가도 소스 코드 의존성은 안쪽으로 남습니다. 경계를 넘는 데이터는 단순하고 독립적인 구조(DTO, 함수 인자, 해시맵)여야 하고 엔티티나 데이터베이스 행을 그대로 넘기면 안쪽이 바깥의 형식에 끌려갑니다.

![계층형과 헥사고날의 의존성 방향 비교. 계층형은 Controller 에서 Service, Repository, DB 로 위에서 아래로 의존한다. 헥사고날은 Web 어댑터와 Persistence 어댑터가 모두 코어의 포트를 향해 안쪽으로 의존한다](@/assets/images/server-layered-vs-hexagonal-dependency.png)

계층형에서는 도메인 로직이 저장소 기술을 향해 의존하는 반면 헥사고날에서는 어댑터가 포트를 구현하며 코어를 향해 의존합니다. 화살표 방향이 달라지는 것이 두 구조의 실질적인 차이입니다.

## Kotlin 으로 짜 보는 패키지 구조

프레임워크에 묶이지 않는 최소 구조는 도메인, 애플리케이션, 어댑터 세 묶음입니다. 포트는 코어가 소유하므로 애플리케이션 패키지 안에 둡니다.

```text
com.example.order
├── domain
│   ├── Order.kt
│   └── OrderLine.kt
├── application
│   ├── port
│   │   ├── input
│   │   │   └── PlaceOrderUseCase.kt
│   │   └── output
│   │       ├── OrderRepository.kt
│   │       └── PaymentGateway.kt
│   └── PlaceOrderService.kt
└── adapter
    ├── input
    │   └── OrderHttpAdapter.kt
    └── output
        ├── JdbcOrderRepository.kt
        └── HttpPaymentGateway.kt
```

패키지 이름을 `in`/`out` 으로 짓는 예가 흔하지만 `in` 은 Kotlin 의 키워드라서 백틱이 필요하므로 `input`/`output` 으로 적었습니다. 도메인 모델은 외부 라이브러리를 import 하지 않는 순수 코드입니다.

```kotlin
data class OrderLine(val sku: String, val quantity: Int, val unitPrice: Long)

enum class OrderStatus { PLACED, CANCELLED }

class Order(val id: String, val lines: List<OrderLine>) {
    init {
        require(lines.isNotEmpty()) { "주문 항목이 비어 있습니다" }
    }

    var status: OrderStatus = OrderStatus.PLACED
        private set

    val total: Long get() = lines.sumOf { it.quantity * it.unitPrice }

    fun cancel() {
        check(status == OrderStatus.PLACED) { "이미 취소된 주문입니다" }
        status = OrderStatus.CANCELLED
    }
}
```

포트는 코어가 필요한 것을 코어의 언어로 선언한 인터페이스입니다. 주도 포트는 유스케이스이고 피주도 포트는 코어가 바깥에 요구하는 기능입니다.

```kotlin
data class PlaceOrderCommand(val orderId: String, val lines: List<OrderLine>)

sealed interface OrderResult {
    data class Placed(val orderId: String) : OrderResult
    data class Rejected(val reason: String) : OrderResult
}

interface PlaceOrderUseCase {
    fun place(command: PlaceOrderCommand): OrderResult
}

enum class PaymentResult { APPROVED, DECLINED }

interface PaymentGateway {
    fun charge(orderId: String, amount: Long): PaymentResult
}

interface OrderRepository {
    fun save(order: Order)
    fun findById(id: String): Order?
}
```

유스케이스 구현은 포트에만 의존합니다. HTTP 나 SQL 에 관한 단어가 한 줄도 없습니다.

```kotlin
class PlaceOrderService(
    private val orders: OrderRepository,
    private val payments: PaymentGateway,
) : PlaceOrderUseCase {
    override fun place(command: PlaceOrderCommand): OrderResult {
        val order = Order(command.orderId, command.lines)
        return when (payments.charge(order.id, order.total)) {
            PaymentResult.APPROVED -> {
                orders.save(order)
                OrderResult.Placed(order.id)
            }
            PaymentResult.DECLINED -> OrderResult.Rejected("결제가 거절되었습니다")
        }
    }
}
```

어댑터는 바깥 세계의 형식을 포트 모양으로 바꿉니다. 입력 어댑터는 요청 DTO 를 커맨드로 변환해 유스케이스를 호출하고 출력 어댑터는 `OrderRepository` 를 JDBC 나 JPA 로 구현합니다. 어떤 웹 프레임워크를 쓰든 입력 어댑터가 하는 일은 같습니다.

```kotlin
data class PlaceOrderRequest(val orderId: String, val items: List<ItemRequest>)
data class ItemRequest(val sku: String, val qty: Int, val price: Long)

class OrderHttpAdapter(private val placeOrder: PlaceOrderUseCase) {
    fun handle(request: PlaceOrderRequest): Int {
        val command = PlaceOrderCommand(
            orderId = request.orderId,
            lines = request.items.map { OrderLine(it.sku, it.qty, it.price) },
        )
        return when (placeOrder.place(command)) {
            is OrderResult.Placed -> 201
            is OrderResult.Rejected -> 422
        }
    }
}
```

마지막으로 구현체를 조립하는 일은 가장 바깥인 애플리케이션 진입점에서 합니다. DI 컨테이너를 쓴다면 이 조립을 컨테이너 설정으로 옮길 뿐, 코어는 컨테이너를 모릅니다.

```kotlin
fun main(dataSource: DataSource, baseUrl: String) {
    val repository = JdbcOrderRepository(dataSource)
    val payments = HttpPaymentGateway(baseUrl)
    val useCase = PlaceOrderService(repository, payments)
    val http = OrderHttpAdapter(useCase)
}
```

## 테스트가 쉬워지는 지점

Cockburn 은 애플리케이션을 API 로 구동하는 자동 테스트로 회귀를 잡고 프레젠테이션 쪽으로 샌 비즈니스 로직도 드러낼 수 있다고 썼습니다. 그가 소개한 개발 순서는 FIT 테스트와 가짜(mock) 데이터베이스로 시작해 GUI 를 붙이고 이후 테스트 데이터베이스와의 통합 테스트를 거쳐 운영으로 가는 것입니다. 위 구조에서는 출력 포트의 가짜 구현이 이 역할을 합니다.

```kotlin
class InMemoryOrderRepository : OrderRepository {
    private val store = mutableMapOf<String, Order>()
    override fun save(order: Order) { store[order.id] = order }
    override fun findById(id: String): Order? = store[id]
}

class FakePaymentGateway(private val result: PaymentResult) : PaymentGateway {
    override fun charge(orderId: String, amount: Long) = result
}

class PlaceOrderServiceTest {
    private val line = OrderLine(sku = "A-1", quantity = 2, unitPrice = 500)

    @Test
    fun `결제가 승인되면 주문이 저장됩니다`() {
        val orders = InMemoryOrderRepository()
        val service = PlaceOrderService(orders, FakePaymentGateway(PaymentResult.APPROVED))

        val result = service.place(PlaceOrderCommand("o-1", listOf(line)))

        assertEquals(OrderResult.Placed("o-1"), result)
        assertEquals(1000L, orders.findById("o-1")?.total)
    }

    @Test
    fun `결제가 거절되면 저장하지 않습니다`() {
        val orders = InMemoryOrderRepository()
        val service = PlaceOrderService(orders, FakePaymentGateway(PaymentResult.DECLINED))

        service.place(PlaceOrderCommand("o-2", listOf(line)))

        assertNull(orders.findById("o-2"))
    }
}
```

Martin 이 말한 "UI, 데이터베이스, 웹 서버, 그 밖의 어떤 외부 요소 없이도 비즈니스 규칙을 테스트할 수 있다"는 성질이 위 테스트로 나타납니다. 데이터베이스 컨테이너도 서버 기동도 없이 밀리초 단위로 끝납니다. 어댑터는 어댑터대로, 실제 DB 를 붙인 통합 테스트로 따로 검증합니다.

## 비용과 과한 경우

이 구조는 공짜가 아닙니다. 인터페이스와 매핑 코드가 늘어납니다. 위 예제에서도 요청 DTO 에서 커맨드로, 도메인 객체에서 저장용 행으로 변환하는 코드가 계층마다 필요하고 필드 몇 개를 추가하려면 여러 파일을 고쳐야 합니다. 도메인 규칙이 거의 없이 입력을 받아 테이블에 저장하고 꺼내 주는 CRUD 서비스라면 포트와 어댑터는 얇은 통과 코드만 늘립니다. Palermo 가 어니언을 오래 가는 복잡한 업무 애플리케이션용으로 한정한 것도 같은 맥락이고 Fowler 가 계층형을 단순한 범위 축소 도구로도 쓸 가치가 있다고 말한 것도 이 선택의 폭을 보여 줍니다.

도입 수준도 단계적으로 고를 수 있습니다. 가장 가벼운 시작은 도메인 코드가 프레임워크와 영속성 어노테이션을 import 하지 않게 하는 것 하나입니다. 외부 시스템 연동이나 저장소 교체 가능성이 실제로 생겼을 때 해당 지점에만 포트를 도입해도 됩니다. 모듈러 모놀리스라면 모듈마다 이 구조를 적용하되 모듈 사이에는 공개 API 포트만 두는 식으로 나눌 수 있습니다.

## 참고 자료

- Alistair Cockburn, Hexagonal architecture (2005) — https://alistair.cockburn.us/hexagonal-architecture/
- Robert C. Martin, The Clean Architecture (2012) — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- Jeffrey Palermo, The Onion Architecture: part 1 (2008) — https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- Martin Fowler, Presentation Domain Data Layering (2015) — https://martinfowler.com/bliki/PresentationDomainDataLayering.html
