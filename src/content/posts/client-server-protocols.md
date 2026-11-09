---
title: "REST 로 충분한 줄 알았는데, 모바일 앱은 프로토콜을 하나씩 더 쓰게 됩니다"
description: "TCP, UDP 와 TLS 1.3 위에서 HTTP/1.1, HTTP/2, HTTP/3 이 어떻게 달라졌는지 보고, 그 위에 올라가는 REST, GraphQL, gRPC, WebSocket, SSE, MQTT, 푸시를 요청-응답, 서버 푸시, 양방향 스트리밍으로 나눠 언제 무엇을 고를지 정리했습니다."
pubDatetime: 2026-11-09T08:09:00+09:00
category: server
tags:
  - HTTP
  - WebSocket
  - gRPC
  - 네트워크
  - API
---

앱을 처음 만들 때는 서버와 주고받는 방법이 거의 REST 하나입니다. Retrofit 이나 Ktor 로 GET, POST 를 보내고 JSON 을 받으면 화면이 그려지니까요. 그런데 채팅이 붙고, 주문 상태를 실시간으로 보여 줘야 하고, 백그라운드에서도 알림이 와야 하면 "그냥 HTTP 로 계속 물어보자"가 금방 한계에 부딪힙니다. 그때부터 WebSocket, SSE, gRPC, MQTT 같은 이름이 나오는데, 이들이 서로 같은 층에 있는 경쟁자는 아닙니다. 어떤 건 전송 방식이고, 어떤 건 메시지 규약이고, 어떤 건 HTTP 위에 얹힌 사용 패턴입니다. 이 글에서는 층부터 정리하고, 요청-응답 / 서버 푸시 / 양방향 스트리밍 중 무엇이 필요한지에 맞춰 고르는 기준을 적었습니다.

## 층부터 정리하면

![아래에서 위로 IP, TCP 와 UDP, TLS 1.3 과 QUIC, HTTP/1.1 과 HTTP/2 와 HTTP/3, 그리고 REST, GraphQL, gRPC, WebSocket, SSE 가 쌓이는 프로토콜 스택 그림입니다. HTTP/3 은 UDP 위의 QUIC 에 얹히고 TLS 1.3 이 QUIC 안에 들어 있다는 점이 강조되어 있습니다.](@/assets/images/client-server-protocols-stack.png)

가장 아래에서 서버와 클라이언트는 IP 패킷을 주고받습니다. 그 위의 전송 계층에서 갈림길이 하나 나옵니다. TCP 는 순서가 보장되는 바이트 스트림을 주고, 유실된 패킷은 알아서 재전송합니다. UDP 는 데이터그램을 던질 뿐 아무것도 보장하지 않습니다. 그래서 UDP 위에서는 신뢰성이 필요하면 직접 만들어야 하는데, 뒤에서 볼 QUIC 이 바로 그걸 한 프로토콜입니다.

보안은 TLS 1.3(RFC 8446, 2018년 8월)이 맡습니다. 1-RTT 핸드셰이크로 암호화된 연결을 세우고, 이전에 접속한 서버라면 첫 번째 비행에 데이터를 실어 보내는 0-RTT 도 가능합니다. 다만 RFC 에는 0-RTT 데이터가 재전송 공격(replay)에 대한 보장이 없다고 분명히 적혀 있어서, 아무 요청이나 0-RTT 로 보내면 안 됩니다. 이 얘기는 HTTP/3 쪽에서 다시 나옵니다.

## HTTP/1.1 은 텍스트이고 한 번에 하나입니다

HTTP/1.1(RFC 9112)은 사람이 읽을 수 있는 텍스트 프로토콜입니다. 시작 줄, 헤더, 빈 줄, 본문으로 이뤄집니다. 실제 요청과 응답은 이렇게 생겼습니다.

```http
POST /v1/orders HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer <token>
Content-Length: 41

{"productId":1001,"quantity":2,"memo":""}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json
Content-Length: 52
Location: /v1/orders/7731

{"orderId":7731,"status":"PENDING","productId":1001}
```

`Host` 헤더는 HTTP/1.1 요청에 반드시 있어야 하고, 본문 길이는 `Content-Length` 나 chunked 전송으로 알려 줍니다. 연결은 기본적으로 유지되지만, 한 연결에서 응답은 요청이 나간 순서대로 와야 합니다. 앞 응답이 느리면 뒤 응답이 줄을 서는 셈이라, 브라우저는 서버마다 연결을 여러 개 열어서 이 문제를 우회해 왔습니다. 페이로드가 JSON 이든 XML 이든 이 층은 상관하지 않는데, 형식 선택은 [XML 과 JSON](/posts/xml-to-json/)에서 따로 다뤘습니다.

## HTTP/2: 연결 하나에 스트림 여러 개

HTTP/2(RFC 9113, 2022년 6월)는 의미는 그대로 두고 표현을 바꿨습니다. 텍스트 대신 바이너리 프레임을 쓰고, 요청 하나마다 스트림을 하나씩 부여해서 **한 연결 안에서 여러 요청이 동시에 오갑니다.** 헤더는 HPACK(RFC 7541)으로 압축합니다. 같은 서버에 보내는 요청은 `Authorization`, `User-Agent` 같은 헤더가 거의 똑같은데, 이걸 양쪽이 상태를 공유하는 테이블로 줄여 주니 모바일 회선에서는 작지 않은 이득입니다.

문제는 TCP 입니다. HTTP/2 스펙에도 TCP 레벨의 head-of-line blocking 은 이 프로토콜이 해결하지 않는다고 적혀 있습니다. 스트림은 여러 개여도 아래의 TCP 는 하나의 바이트 스트림이라, 패킷 하나가 유실되면 그게 재전송될 때까지 다른 스트림의 데이터도 같이 멈춥니다. 와이파이에서 LTE 로 넘어가거나 신호가 약한 곳에서 패킷 손실이 잦아지면 이 지연이 체감됩니다.

## HTTP/3: TCP 를 버리고 QUIC 을 씁니다

HTTP/3(RFC 9114, 2022년 6월)은 HTTP 의미를 TCP 가 아니라 QUIC(RFC 9000, 2021년 5월) 위에 올립니다. QUIC 은 UDP 위에서 스트림 다중화, 스트림별 흐름 제어, 빠른 연결 설정을 제공하고 TLS 1.3 을 안에 품고 있습니다. 요청-응답 쌍마다 QUIC 스트림이 따로 있고 신뢰성도 스트림 단위라서, 패킷 하나가 유실돼도 **그 스트림만** 늦어집니다. RFC 9114 가 말하는 대로 막히거나 손실이 난 스트림 하나가 다른 스트림의 진행을 막지 않습니다.

모바일 개발자에게 더 반가운 건 두 가지입니다.

- **연결 이전(connection migration).** TCP 연결은 출발지 IP, 포트, 목적지 IP, 포트로 식별되기 때문에 와이파이에서 셀룰러로 넘어가면 연결이 끊깁니다. QUIC 은 연결 ID 로 연결을 식별해서 경로가 바뀌어도 이어 갈 수 있습니다. RFC 9000 은 이 버전의 QUIC 에서는 클라이언트만 migrate 할 수 있다고 적어 두었습니다. 엘리베이터에서 내려 와이파이가 LTE 로 바뀌는 순간 업로드가 끊기던 경험이 있다면 이게 무슨 얘기인지 아실 겁니다.
- **핸드셰이크 단축.** 전송 파라미터와 암호 파라미터를 같이 협상하므로 TCP 핸드셰이크 뒤에 TLS 를 하던 것보다 왕복이 적습니다. 이전에 접속한 서버에는 0-RTT 로 첫 요청을 같이 보낼 수 있지만, 위에서 말한 재전송 문제 때문에 GET 처럼 반복돼도 괜찮은 요청에만 써야 합니다. 주문 POST 를 0-RTT 에 실었다가 두 번 처리되면 곤란하니까요.

실무에서 걸리는 건 서버와 클라이언트 라이브러리의 지원 여부입니다. 서버 앞단(CDN, 로드 밸런서)이 HTTP/3 을 받아 주고 클라이언트 스택이 같이 지원해야 하므로, 내 앱의 HTTP 클라이언트가 어떤 버전까지 말하는지는 따로 확인해야 합니다. 안 되는 환경에서는 HTTP/2 나 1.1 로 내려가게 설계되어 있어서, 바꿔도 기능 쪽 위험은 크지 않습니다.

## 그 위의 API 스타일

여기까지가 "어떻게 실어 나르나"였다면, 이제부터는 "무엇을 어떤 모양으로 주고받나"입니다.

### REST: HTTP 의미를 그대로 쓰는 방식

REST 는 프로토콜이 아니라 HTTP 의 의미(RFC 9110)를 자원 중심으로 활용하는 스타일입니다. 자원은 URL 로, 동작은 메서드로 표현하고 결과는 상태 코드로 알립니다. 클라이언트 개발자가 가장 자주 부딪히는 건 **멱등성**입니다.

| 메서드             | 안전(safe) | 멱등(idempotent) | 비고                                  |
| ------------------ | ---------- | ---------------- | ------------------------------------- |
| GET, HEAD, OPTIONS | O          | O                | 읽기 전용                             |
| PUT, DELETE        | X          | O                | 같은 요청을 반복해도 서버 상태가 같음 |
| POST               | X          | X                | 반복하면 효과도 반복될 수 있음        |

RFC 9110 은 멱등하지 않은 요청을 클라이언트가 자동으로 재시도하면 안 된다고 합니다. 그래서 타임아웃이 났을 때 OkHttp 의 재시도나 내가 짠 retry 로직이 POST 에 돌면 결제가 두 번 나갈 수 있습니다. 주문 생성처럼 POST 를 재시도해야 한다면 멱등 키를 서버와 약속하는 식으로 설계해야 합니다. 상태 코드는 1xx 정보, 2xx 성공, 3xx 리다이렉션, 4xx 클라이언트 오류, 5xx 서버 오류 다섯 부류인데, 재시도할 가치가 있는 건 대개 5xx 와 네트워크 오류 쪽입니다.

### GraphQL: 클라이언트가 필드를 고릅니다

GraphQL 은 데이터 요구를 기술하는 질의 언어이고, 스펙이 정의하는 작업은 query, mutation, subscription 세 가지입니다. 화면이 필요한 필드만 한 번에 요청할 수 있어서 REST 로 엔드포인트 여러 개를 오가던 화면에 잘 맞습니다. 스펙 자체는 요청이 어떤 전송으로 가는지는 정하지 않고, 현실에서는 대부분 HTTP 위에 JSON 을 얹어 씁니다. subscription 은 장기 요청이라, 구현은 따로 WebSocket 이나 SSE 같은 전송을 붙이게 됩니다. 캐싱이 URL 단위로 안 먹고 서버 쪽 쿼리 비용 관리가 필요하다는 점은 감수해야 합니다.

### gRPC: HTTP/2 위의 Protobuf RPC

gRPC 는 `.proto` 파일로 서비스와 메시지를 정의하고 클라이언트 스텁과 서버 코드를 생성하는 방식입니다. 호출 하나는 HTTP/2 POST 이고 메시지는 압축 여부 1바이트와 길이 4바이트가 앞에 붙은 Protobuf 바이너리입니다. 응답의 끝에는 `grpc-status` 가 트레일러로 붙어서, HTTP 상태가 200 이어도 RPC 의 성패는 이 값으로 읽어야 합니다.

호출 형태는 네 가지입니다. 단항(unary), 서버 스트리밍, 클라이언트 스트리밍, 양방향 스트리밍. 클라이언트가 정하는 deadline 과 취소도 기본으로 들어 있습니다. 서버끼리 부르거나 안드로이드 앱에서 자체 백엔드를 호출할 때는 타입 안전성과 크기 면에서 좋습니다. 브라우저는 gRPC 를 직접 말하지 못해서 gRPC-Web 을 써야 하고, 기본 구성에서는 Envoy 같은 프록시가 필요합니다. 게다가 gRPC-Web 은 클라이언트 스트리밍과 양방향 스트리밍을 지원하지 않습니다. 웹까지 같은 API 로 가려면 이 제약을 먼저 알고 있어야 합니다.

### WebSocket: 한 번 열고 양쪽이 보냅니다

WebSocket(RFC 6455, 2011년 12월)은 HTTP 로 시작해서 TCP 연결 위의 양방향 메시지 채널로 바뀝니다. 시작은 평범한 HTTP Upgrade 요청입니다.

```http
GET /chat HTTP/1.1
Host: server.example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

서버는 클라이언트의 키에 고정된 GUID 를 붙여 SHA-1 로 해시하고 base64 한 값을 `Sec-WebSocket-Accept` 로 돌려줘서 핸드셰이크를 읽었음을 증명합니다. 이후에는 프레임으로 통신하고, ping/pong 컨트롤 프레임으로 연결이 살아 있는지 확인할 수 있습니다. 클라이언트가 보내는 프레임은 마스킹해야 한다는 규칙도 있는데, 이건 라이브러리가 알아서 처리합니다.

HTTP/2 에는 `Upgrade` 헤더와 101 응답이 없어서 같은 방식이 안 됩니다. 그래서 RFC 8441(2018년 9월)이 확장 CONNECT 를 정의했습니다. 서버가 `SETTINGS_ENABLE_CONNECT_PROTOCOL` 을 1 로 알리면 클라이언트가 `:protocol` 이 `websocket` 인 CONNECT 요청을 보내고, 하나의 HTTP/2 스트림이 WebSocket 연결 역할을 합니다. 덕분에 WebSocket 이 다른 HTTP/2 요청과 연결 하나를 같이 쓸 수 있습니다.

안드로이드에서는 OkHttp 가 WebSocket 클라이언트를 제공합니다.

```kotlin
val client = OkHttpClient.Builder()
    .pingInterval(30, TimeUnit.SECONDS)
    .build()

val request = Request.Builder().url("wss://api.example.com/chat").build()

val socket = client.newWebSocket(request, object : WebSocketListener() {
    override fun onOpen(webSocket: WebSocket, response: Response) {
        webSocket.send("""{"type":"join","room":"general"}""")
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
        // 수신 메시지 처리
    }

    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
        webSocket.close(code, reason)
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        // 재연결 정책은 여기서 정한다
    }
})
```

`pingInterval` 은 연결 생존 확인용입니다. 모바일에서는 NAT 나 통신사 장비가 오래 조용한 연결을 끊어 버리는 일이 흔해서 주기적인 ping 이 사실상 필수에 가깝습니다. 그리고 `onFailure` 에서의 재연결(백오프, 마지막으로 받은 메시지부터 이어받기)은 라이브러리가 해 주지 않으니 직접 설계해야 합니다. WebSocket 을 쓰는 비용의 대부분이 여기에 있습니다.

### SSE: 서버에서 클라이언트로 한 방향이면 충분할 때

Server-Sent Events 는 WHATWG HTML 표준에 정의된 방식입니다. 서버가 `text/event-stream` 으로 응답을 끊지 않고 계속 내려 주고, 형식은 UTF-8 텍스트입니다. `data:`, `event:`, `id:` 필드로 이뤄지고 빈 줄이 하나의 이벤트의 끝입니다.

```text
id: 42
event: orderStatus
data: {"orderId":7731,"status":"SHIPPED"}

: keep-alive
```

콜론으로 시작하는 줄은 주석이라, 중간에서 유휴 연결을 끊는 프록시를 막으려고 15초 정도마다 하나씩 보내라고 표준이 권합니다. 연결이 끊기면 클라이언트가 자동으로 재연결하면서 마지막 이벤트 ID 를 `Last-Event-ID` 헤더로 보내고, `retry:` 로 재연결 간격도 정할 수 있습니다. WebSocket 에서 직접 만들어야 하던 재연결과 이어받기가 규격에 들어 있는 셈입니다. 그냥 HTTP 응답이라 인증 헤더, 프록시, 로깅도 기존 HTTP 인프라 그대로 쓸 수 있습니다.

Ktor 클라이언트에는 SSE 플러그인이 있습니다.

```kotlin
val client = HttpClient(CIO) {
    install(SSE) {
        maxReconnectionAttempts = 4
        reconnectionTime = 2.seconds
    }
}

client.sse(host = "api.example.com", path = "/events") {
    incoming.collect { event ->
        when (event.event) {
            "orderStatus" -> handleOrderStatus(event.data)
            else -> Unit
        }
    }
}
```

주문 상태, 알림 피드, 진행률처럼 서버가 일방적으로 밀어 주는 데이터라면 WebSocket 보다 SSE 가 단순합니다. 클라이언트가 서버로 자주 보내야 한다면 그 부분만 일반 HTTP 요청으로 보내면 됩니다. 브라우저에서는 HTTP/1.1 에서 서버당 연결 수 제한 때문에 탭이 많을 때 불편하다는 얘기가 표준에도 나옵니다. HTTP/2 이상이면 이 문제는 줄어듭니다.

### 롱 폴링, 그리고 WebTransport

롱 폴링은 서버가 새 데이터가 생길 때까지 응답을 붙들고 있다가 주는 방식입니다. 특별한 프로토콜이 필요 없어서 최후의 호환 수단으로 남아 있지만, 응답이 올 때마다 요청을 새로 맺어야 해서 새 프로젝트에서 먼저 고를 이유는 없습니다.

WebTransport 는 HTTP/3 위에서 신뢰성 있는 스트림과 신뢰성 없는 데이터그램을 둘 다 쓰는 브라우저 API 입니다. MDN 에는 2026년 3월에 Baseline 으로 올라왔다고 표시되어 있습니다. 서버가 따로 WebTransport 를 지원해야 하고 아직은 라이브러리 선택지가 좁아서, 모바일 앱의 일반적인 API 통신에서 쓸 일은 많지 않습니다.

## 모바일에서만 따로 고민할 것들

### MQTT

MQTT(OASIS 5.0, 2019년 3월)는 발행-구독 방식의 가벼운 메시징 프로토콜입니다. 클라이언트가 토픽을 구독하면 브로커가 메시지를 전달합니다. QoS 가 세 단계(최대 한 번, 최소 한 번, 정확히 한 번)로 나뉘어 있고 Keep Alive 로 죽은 연결을 감지하며, Will Message 로 비정상 종료를 다른 구독자에게 알릴 수 있습니다. 세션 만료 시간(Session Expiry Interval)을 정해 두면 재접속했을 때 구독 상태를 이어 갈 수 있습니다. 불안정한 회선과 작은 기기를 염두에 두고 만든 규약이라 IoT 쪽에서 많이 쓰이고, 앱에서 쓴다면 센서나 기기 제어 계열일 때입니다. 브라우저에서는 WebSocket 위로 접속합니다.

### 푸시(FCM, APNs)

푸시는 프로토콜이라기보다 OS 벤더가 운영하는 서비스입니다. 안드로이드는 FCM, iOS 는 APNs 를 거칩니다. 앱이 서버와 소켓을 계속 열어 두지 않아도 OS 가 하나의 연결로 대신 받아서 깨워 주기 때문에, 배터리 면에서는 이 방식을 이길 수 없습니다. Android 문서도 변경을 폴링하는 대신 FCM 으로 알리고, 알림을 받으면 그때 WorkManager 로 동기화하라고 권합니다. FCM 의 `onMessageReceived` 는 실행 시간이 짧아서 몇 초 안에 끝나지 않는 작업은 WorkManager 에 넘겨야 하고, 앱이 백그라운드일 때는 notification 메시지와 data 메시지의 동작이 서로 다르다는 것도 알아 둘 필요가 있습니다.

### 배터리와 백그라운드

화면이 꺼지고 앱이 백그라운드로 가면 WebSocket 이나 SSE 연결은 유지되지 않을 수 있다고 생각하고 설계하는 편이 맞습니다. 앱이 보이는 동안만 실시간 연결을 유지하고, 백그라운드에서는 푸시로 깨운 뒤 필요한 데이터를 가져오는 구성이 가장 흔합니다. 오래 도는 연결이 정말 필요하면 포그라운드 서비스를 쓰게 되는데, 사용자에게 보이는 알림이 필요하고 OS 제약도 많습니다. 그래서 "알림 하나 받으려고 소켓을 상시 유지"는 거의 항상 잘못된 선택입니다.

## 무엇을 고를까

![REST, GraphQL, gRPC, WebSocket, SSE, MQTT 를 방향, 전송, 페이로드, 브라우저 지원, 대표 용도로 비교한 표 그림입니다.](@/assets/images/client-server-protocols-matrix.png)

저는 먼저 데이터가 어느 방향으로 흐르는지부터 봅니다.

- **요청하면 응답이 오는 구조**라면 REST 가 기본입니다. 화면마다 필요한 데이터 모양이 크게 다르고 왕복이 부담이면 GraphQL, 내부 서비스 간 호출이나 타입 안전성이 중요하면 gRPC 를 검토합니다.
- **서버가 알려 줘야 하는 구조**에서 앱이 켜져 있을 때만 필요하면 SSE, 꺼져 있을 때도 필요하면 푸시입니다.
- **양쪽이 수시로 주고받는 구조**(채팅, 협업 편집, 게임)라면 WebSocket 이고, 기기와 브로커 사이의 가벼운 메시징이라면 MQTT 가 후보입니다. 서버-서버 스트리밍이면 gRPC 의 양방향 스트리밍도 있습니다.

웬만한 앱은 REST 와 푸시, 그리고 한두 곳의 SSE 나 WebSocket 으로 충분합니다. 프로토콜을 늘릴수록 재연결, 인증 갱신, 프록시 호환, 서버 쪽 연결 수 관리 같은 운영 비용이 따라붙기 때문에, 폴링으로 시작해서 정말 부족할 때 올라가는 순서가 대체로 후회가 적습니다.

## 참고 자료

- [RFC 9112: HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112.html)
- [RFC 9113: HTTP/2](https://www.rfc-editor.org/rfc/rfc9113.html)
- [RFC 9114: HTTP/3](https://www.rfc-editor.org/rfc/rfc9114.html)
- [RFC 9000: QUIC: A UDP-Based Multiplexed and Secure Transport](https://www.rfc-editor.org/rfc/rfc9000.html)
- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 8446: TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446.html)
- [RFC 6455: The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455.html)
- [RFC 8441: Bootstrapping WebSockets with HTTP/2](https://www.rfc-editor.org/rfc/rfc8441.html)
- [HTML Standard: Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [GraphQL Specification (October 2021)](https://spec.graphql.org/October2021/)
- [gRPC: Core concepts](https://grpc.io/docs/what-is-grpc/core-concepts/)
- [gRPC over HTTP/2 protocol](https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md)
- [grpc-web](https://github.com/grpc/grpc-web)
- [MDN: WebTransport API](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API)
- [MQTT Version 5.0 (OASIS)](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html)
- [Ktor: Server-sent events (client)](https://ktor.io/docs/client-server-sent-events.html)
- [Firebase: Receive messages in an Android app](https://firebase.google.com/docs/cloud-messaging/android/receive-messages)
- [Android Developers: Background work overview](https://developer.android.com/develop/background-work/background-tasks)
