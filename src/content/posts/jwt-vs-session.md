---
title: "JWT 냐 세션이냐, 웹 서비스라면 저는 세션부터 봅니다"
description: "서버 세션과 JWT 를 상태 저장 위치, 폐기, 확장, 쿠키 속성, XSS 와 CSRF 관점에서 비교하고, 짧은 access token 과 refresh token rotation, 안드로이드에서의 토큰 보관과 OkHttp Authenticator 까지 적었습니다."
pubDatetime: 2026-11-09T09:02:00+09:00
category: server
tags:
  - JWT
  - 세션
  - 인증
  - 보안
  - OAuth
---

로그인 기능을 만들 때 "JWT 쓸까요, 세션 쓸까요" 하는 질문은 거의 빠지지 않고 나옵니다. 그런데 이 질문은 반쯤 잘못 세워져 있습니다. 세션은 **상태를 서버에 두는 방식**이고 JWT 는 **상태를 토큰에 담아 클라이언트에 맡기는 방식**이라서, 어느 쪽이 더 현대적이냐의 문제가 아니라 폐기를 얼마나 쉽게 하고 싶은지, 검증을 어디서 하고 싶은지의 문제입니다. 저는 안드로이드 앱을 만들면서 서버 쪽도 같이 만지는데, 앱 입장에서는 토큰을 받아 보관하고 갱신하는 일이 되고 서버 입장에서는 폐기와 검증을 설계하는 일이 됩니다. 두 시점이 다 걸려 있어서 한 번 정리해 둡니다.

HTTP 와 REST 쪽 기본기는 [클라이언트와 서버는 어떻게 대화하는가](/posts/client-server-protocols/)와 [웹 서버와 WAS, API 서버는 무엇이 다른가](/posts/ws-was-api-server/)에서 먼저 다뤘습니다. 여기서는 그 위에 얹히는 인증만 봅니다.

## 세션은 번호표입니다

세션 방식은 단순합니다. 로그인에 성공하면 서버가 세션을 만들고, 사용자 정보와 만료 시각을 서버 저장소에 넣고, 그 레코드를 가리키는 무작위 ID 만 쿠키로 내려줍니다. 이후 요청에는 브라우저가 쿠키를 알아서 붙여 보내고, 서버는 그 ID 로 저장소를 찾아 누구인지 확인합니다. ID 자체에는 아무 의미가 없는 불투명(opaque)한 값이라, 훔쳐 봐야 번호표 숫자일 뿐이고 정보는 전부 서버에 있습니다.

![세션 방식은 로그인 후 서버가 세션을 저장소에 기록하고 sid 쿠키를 내려주며 요청마다 저장소를 조회하고, JWT 방식은 서명한 access token 을 발급해 요청마다 Bearer 로 보내면 서버가 서명과 exp, aud 만 검증하고 만료되면 refresh token 으로 새 access token 을 받는다](@/assets/images/jwt-vs-session-flow.png)

세션 ID 는 추측할 수 없어야 합니다. OWASP 세션 관리 치트시트는 최소 64비트 엔트로피를 요구하고, 직접 만든다면 CSPRNG 로 128비트 이상을 권합니다. 로그인 직후에는 ID 를 새로 발급해서 session fixation 을 막아야 하고, 로그아웃은 쿠키만 지우지 말고 서버 쪽 레코드를 반드시 무효화해야 합니다. 클라이언트 쿠키만 지우면 이미 유출된 ID 는 그대로 살아 있습니다.

저장소는 두 가지 선택지가 있습니다. 서버 메모리에 두면 가장 간단하지만 서버가 여러 대일 때 같은 사용자를 같은 서버로 보내야 하는데, 이게 sticky session 입니다. 로드밸런서가 쏠림을 감수해야 하고 서버 한 대가 죽으면 거기 있던 세션이 날아갑니다. 보통은 Redis 같은 공유 저장소에 세션을 모아 두고 서버는 무상태로 둡니다. 키-값 저장소 이야기는 [RDBMS 와 NoSQL](/posts/rdbms-vs-nosql/)에서 캐시와 세션 용도로 잠깐 다뤘습니다. 이렇게 하면 매 요청마다 저장소를 한 번 읽는 비용이 생기지만, 그 대가로 **사용자를 즉시 쫓아낼 수 있습니다.** 비밀번호를 바꾼 사용자의 다른 기기 세션을 전부 지우는 것도 레코드 삭제 한 줄입니다.

### 쿠키 속성이 보안의 절반입니다

세션이 안전한지는 쿠키를 어떻게 내려주느냐에 많이 달려 있습니다.

```http
HTTP/1.1 200 OK
Set-Cookie: __Host-sid=7f3a9c1e5b2d4e8aa0c6; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600
```

`HttpOnly` 는 JavaScript 의 `document.cookie` 가 이 쿠키를 읽지 못하게 합니다. XSS 로 스크립트가 심어져도 쿠키 값 자체를 훔쳐 가기는 어렵습니다. MDN 이 짚듯이 스크립트가 `fetch()` 로 보내는 요청에는 쿠키가 여전히 붙기 때문에, 값은 못 읽어도 그 세션으로 요청을 날리는 건 가능합니다. `Secure` 는 `https:` 요청에만 쿠키를 보내게 합니다. `SameSite` 는 다른 사이트에서 시작된 요청에 쿠키를 붙일지 정합니다. `Strict` 는 같은 사이트에서 온 요청에만, `Lax` 는 거기에 더해 안전한 메서드의 최상위 이동(링크 클릭)까지만 붙이고, `None` 은 전부 붙이되 `Secure` 가 필수입니다. `__Host-` 접두어를 쓰면 `Secure` 와 `Path=/` 가 강제되고 `Domain` 을 못 지정해서 그 호스트에만 쿠키가 갑니다.

## JWT 는 서명된 신분증입니다

JWT(JSON Web Token)는 RFC 7519(2015년 5월)가 정의한 토큰 형식입니다. 가장 흔한 형태는 점으로 이은 세 덩어리입니다.

```text
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.<payload>.<signature>
 └ header                              └ claims   └ 서명
```

앞의 두 덩어리는 JSON 을 base64url 로 인코딩한 것이고, 마지막이 서명입니다. 서명 방식은 JWS(RFC 7515)가 정합니다. 여기서 가장 많이 오해하는 부분이 있습니다. **payload 는 암호화된 게 아니라 인코딩만 된 것입니다.** 누구나 디코딩해서 읽을 수 있고, 서명은 "누가 바꾸지 못했다"를 보장할 뿐 "누가 못 본다"를 보장하지 않습니다. 비밀번호나 주민번호 같은 값은 넣으면 안 됩니다. 내용을 숨겨야 한다면 JWE(RFC 7516)로 암호화하는 방법이 있는데, 실무에서는 애초에 민감한 값을 토큰에 넣지 않는 쪽이 훨씬 흔합니다.

직접 열어 보면 별것 없습니다. 안드로이드에서 payload 를 읽는 코드는 이렇습니다.

```kotlin
import android.util.Base64
import org.json.JSONObject

fun decodeJwtPayload(token: String): JSONObject {
    val payload = token.split('.')[1]
    val bytes = Base64.decode(payload, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    return JSONObject(String(bytes, Charsets.UTF_8))
}
```

```json
{
  "iss": "https://auth.example.com",
  "sub": "user-1842",
  "aud": "api.example.com",
  "iat": 1762646400,
  "exp": 1762647300,
  "scope": "orders:read"
}
```

클라이언트가 이걸 디코딩해서 `exp` 를 보고 갱신 시점을 잡는 건 괜찮습니다. 하지만 클라이언트가 서명을 검증하지 못한 채 읽은 값으로 권한을 판단하면 안 됩니다. 권한 판단은 늘 서버 몫입니다.

### 클레임과 서명 알고리즘

RFC 7519 의 등록 클레임 중 자주 쓰는 건 이렇습니다. `iss` 는 발급자, `sub` 는 주체, `aud` 는 이 토큰을 받을 대상, `exp` 는 만료 시각, `nbf` 는 이 시각 전에는 거부, `iat` 는 발급 시각, `jti` 는 토큰 고유 ID 입니다. 전부 선택 항목이지만 `exp` 가 없는 토큰은 영원히 유효하니, 검증하는 쪽이 `exp`, `iss`, `aud` 를 반드시 확인하도록 만들어야 합니다.

서명 알고리즘은 크게 두 계열입니다. `HS256` 은 HMAC-SHA256 이라 서명할 때와 검증할 때 같은 비밀 키를 씁니다. 서버 하나가 발급하고 그 서버가 검증하는 구조라면 단순해서 좋습니다. `RS256`(RSA)과 `ES256`(ECDSA P-256)은 비대칭입니다. 발급자만 개인키로 서명하고, 검증하는 쪽은 공개키만 있으면 됩니다. 인증 서버와 여러 API 서버가 나뉘어 있을 때 API 서버에 비밀을 나눠 주지 않아도 된다는 점이 결정적입니다. 키가 바뀔 때를 대비해 헤더에 `kid` 를 넣고 공개키를 JWKS 엔드포인트로 배포하는 구성이 일반적입니다.

## 폐기가 안 되는 게 문제입니다

JWT 의 장점인 "조회 없이 검증"은 그대로 단점이 됩니다. 서버가 아무것도 기억하지 않으니 이미 발급한 토큰을 `exp` 전에 무효로 만들 방법이 없습니다. 기기를 분실했거나 비밀번호를 바꿨는데도 토큰은 만료까지 멀쩡히 통과합니다. 현실의 해법은 몇 가지를 섞는 것입니다.

가장 기본은 **access token 을 짧게, refresh token 을 길게** 가져가는 구조입니다. access token 은 5분에서 15분 정도로 짧게 두면 탈취당해도 피해 시간이 제한됩니다. 만료되면 refresh token 을 내고 새 access token 을 받습니다. 중요한 건 refresh token 은 JWT 일 필요가 없고, **서버가 저장소에 기록해 두는 불투명한 값**이라는 점입니다. 폐기는 이 refresh token 을 지우는 것으로 합니다. 결국 상태를 서버에 두는 부분이 refresh 쪽으로 옮겨 갔을 뿐입니다.

여기에 rotation 이 붙습니다. refresh 할 때마다 refresh token 도 새로 발급하고 이전 것은 폐기합니다. 이미 쓴 refresh token 이 다시 들어오면 탈취를 의심해서 그 계열의 토큰을 전부 무효로 만드는 방식입니다. RFC 9700(OAuth 2.0 보안 BCP)도 퍼블릭 클라이언트의 refresh token 은 sender-constrained 이거나 rotation 을 써야 한다고 못박고 있습니다. 모바일 앱이 바로 퍼블릭 클라이언트에 해당합니다.

즉시 폐기가 꼭 필요한 곳에는 보조 장치를 더합니다. 폐기한 `jti` 를 만료 시각까지만 보관하는 denylist 를 두면 검증할 때 저장소를 한 번 읽지만 목록이 작습니다. 또는 사용자 레코드에 token version 숫자를 두고 토큰의 클레임과 비교해서, 비밀번호 변경 시 숫자를 올려 이전 토큰을 한꺼번에 무효화하는 방법도 있습니다. 두 방법 모두 검증에 조회가 들어가니 "무상태"라는 장점은 줄어듭니다. 이쯤 되면 세션과 비용이 비슷해지는데, 그 지점을 알고 고르는 게 중요합니다.

## 실수가 터지는 곳

JWT 는 잘 쓰면 안전하지만 잘못 쓰기 쉬운 형식이라, 검증 쪽 실수로 터지는 사고가 많았습니다. RFC 8725(JWT BCP)가 이 목록을 정리해 놓았습니다.

- **`alg=none`**: RFC 7519 는 서명 없는 JWT 를 `alg: none` 으로 표현하는 걸 허용합니다. 라이브러리가 헤더의 값을 그대로 믿으면 공격자가 서명을 지우고 `none` 으로 바꾼 토큰이 통과합니다. BCP 는 호출자가 명시하지 않는 한 라이브러리가 none 토큰을 만들거나 받아들이지 말라고 합니다.
- **알고리즘 혼동**: 서버는 RS256 으로 발급하는데 검증 코드가 헤더의 `alg` 를 따라가면, 공격자가 `HS256` 으로 바꾸고 공개키를 HMAC 비밀로 써서 서명한 토큰이 통과할 수 있습니다. 해법은 허용 알고리즘을 서버 설정으로 고정하고 키마다 알고리즘을 묶어 두는 것입니다. 헤더는 참고 정보일 뿐 결정권이 없어야 합니다.
- **`iss`, `aud` 검증 누락**: 같은 인증 서버가 여러 서비스용 토큰을 발급한다면, A 서비스용 토큰으로 B 서비스를 호출할 수 있습니다. `aud` 를 확인하지 않아서 생기는 문제입니다. BCP 도 발급자와 대상을 검증하고, 종류가 다른 JWT 는 서로 거부되게 검증 규칙을 나누라고 합니다.
- **헤더 값 맹신**: `kid` 를 DB 조회나 파일 경로에 그대로 쓰거나 `jku`, `x5u` URL 을 무조건 따라가면 인젝션과 SSRF 통로가 됩니다.

저장 위치도 논쟁거리입니다. 브라우저에서 JWT 를 `localStorage` 에 넣으면 XSS 한 번에 JavaScript 가 토큰을 읽어 갑니다. 그렇다고 쿠키에 담으면 이번에는 CSRF 를 걱정해야 합니다. 어느 쪽이든 공짜는 없고, 쿠키에 담을 거라면 세션 쿠키와 똑같이 `HttpOnly`, `Secure`, `SameSite` 를 달아야 합니다. 그렇게까지 하면 JWT 를 쿠키로 나르는 것이라 세션과 크게 다를 게 없습니다.

토큰 크기도 현실적인 문제입니다. 권한 목록이나 프로필을 클레임에 계속 넣다 보면 토큰이 수 KB 까지 커지고, 이게 모든 요청의 헤더에 실립니다. 세션 ID 는 수십 바이트면 되니 대조적입니다.

![서버 세션과 JWT 를 상태 위치, 폐기, 확장, 요청 크기, XSS 노출, CSRF 노출, 잘 맞는 곳으로 나눠 비교한 표](@/assets/images/jwt-vs-session-matrix.png)

## 모바일 앱에서는 어떻게 다른가

앱에는 브라우저의 쿠키 자동 전송도, 다른 사이트에서 날아오는 CSRF 도 없습니다. 대신 토큰을 **어디에 안전하게 두느냐**가 문제입니다. access token 은 메모리에 들고 있어도 되지만, 앱이 재시작돼도 로그인을 유지하려면 refresh token 은 디스크에 있어야 합니다. 그 값이 평문으로 SharedPreferences 에 있으면 루팅된 기기나 백업 유출에서 바로 읽힙니다.

예전에는 `EncryptedSharedPreferences` 가 정석이었는데 지금은 사정이 달라졌습니다. `androidx.security:security-crypto` 는 1.1.0 안정판(2025년 7월 30일)에서 모든 API 가 deprecated 되었고, 이후 릴리스는 없을 거라고 Android 문서에 적혀 있습니다. 릴리스 노트의 이유는 "플랫폼 API 와 Android Keystore 직접 사용으로 대체"입니다. 그래서 새로 만든다면 Keystore 에 AES-GCM 키를 만들어 두고, 그 키로 refresh token 을 암호화한 바이트를 DataStore 나 파일에 저장하는 형태가 됩니다. Keystore 의 키는 앱 프로세스로 키 재료가 들어오지 않고, 기기에 따라 TEE 나 StrongBox 같은 보안 하드웨어에 묶여 꺼낼 수 없습니다. 기존 코드가 EncryptedSharedPreferences 를 쓰고 있어도 당장 깨지지는 않지만, 마이그레이션 계획은 세워 둘 시기입니다.

```kotlin
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

private const val KEY_ALIAS = "refresh_token_key"

private fun secretKey(): SecretKey {
    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (ks.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
        init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        generateKey()
    }
}

/** 반환값은 IV 와 암호문을 이어 붙인 바이트. 저장은 DataStore 든 파일이든 무관 */
fun encrypt(plain: ByteArray): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, secretKey()) }
    return cipher.iv + cipher.doFinal(plain)
}
```

복호화는 앞 12바이트를 IV 로 떼어내 `GCMParameterSpec(128, iv)` 로 초기화하는 반대 과정입니다. Keystore 호출은 느릴 수 있으니 메인 스레드에서는 부르지 않는 게 좋습니다. iOS 에서는 같은 자리에 Keychain 을 씁니다. 어느 쪽이든 원칙은 같습니다. 토큰은 앱 전용의 보호된 저장소에 두고, 로그에 찍지 않고, 백업 대상에서 빼야 합니다.

### OkHttp Authenticator 로 갱신 처리

access token 이 만료되어 서버가 401 을 주면, 사용자가 모르게 refresh 해서 요청을 다시 보내야 합니다. OkHttp 의 `Authenticator` 가 바로 이 용도입니다. 서버가 401 로 응답하면 호출되고, 인증 정보를 붙인 새 `Request` 를 돌려주면 OkHttp 가 그 요청으로 재시도하고, `null` 을 돌려주면 포기합니다.

```kotlin
class TokenAuthenticator(
    private val tokenStore: TokenStore,
    private val authApi: AuthApi, // 이 Authenticator 가 붙지 않은 별도 OkHttpClient 로 만든 것
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.responseCount() >= 2) return null

        synchronized(this) {
            val sent = response.request.header("Authorization")?.removePrefix("Bearer ")
            val current = tokenStore.accessToken
            // 기다리는 사이 다른 요청이 이미 갱신했다면 그 토큰으로 재시도
            if (current != null && current != sent) return response.request.withBearer(current)

            val refresh = tokenStore.refreshToken ?: return null
            val pair = authApi.refresh(refresh).execute().body()
            if (pair == null) {
                tokenStore.clear()
                return null
            }
            tokenStore.save(pair.accessToken, pair.refreshToken)
            return response.request.withBearer(pair.accessToken)
        }
    }

    private fun Request.withBearer(token: String) =
        newBuilder().header("Authorization", "Bearer $token").build()

    private fun Response.responseCount() = generateSequence(this) { it.priorResponse }.count()
}
```

신경 쓸 부분은 세 군데입니다. `synchronized` 로 감싸는 이유는, 화면이 열리면서 요청 여러 개가 동시에 401 을 받는 일이 흔하기 때문입니다. rotation 을 쓰는 서버에서는 같은 refresh token 을 두 번 내면 두 번째가 재사용으로 판정돼 로그인이 통째로 풀립니다. 그래서 먼저 락을 잡은 요청만 갱신하고, 나머지는 갱신된 토큰으로 재시도합니다. 갱신 호출은 이 Authenticator 가 없는 별도 클라이언트로 보내야 무한 루프가 안 생기고, `responseCount` 로 재시도 횟수도 제한해 둡니다. refresh 자체가 실패하면 저장된 토큰을 지우고 `null` 을 돌려주고, 이후 처리는 로그인 화면 이동으로 이어 가면 됩니다.

## OAuth 2.0 과 OIDC 안에서

이 논쟁은 OAuth 2.0 과 OIDC 맥락에서 한 번 더 헷갈립니다. OAuth 2.0 은 access token 의 형식을 정하지 않습니다. 불투명한 문자열일 수도, JWT 일 수도 있습니다. 불투명 토큰이면 리소스 서버가 인증 서버의 introspection 엔드포인트에 물어봐서 상태를 확인하고, JWT 면 서명을 로컬에서 검증합니다. 앞의 두 방식이 그대로 반복되는 셈입니다. 반면 OIDC 의 ID token 은 JWT 로 정해져 있고, 이건 로그인한 사용자가 누구인지를 **클라이언트**에게 알려 주는 용도입니다. API 에 인증할 때 보내는 건 access token 이고, ID token 을 API 호출 자격으로 쓰는 건 용도가 다릅니다.

RFC 9700 은 access token 의 권한을 필요한 최소로 제한하고, 가능하면 하나의 리소스 서버로 audience 를 제한하라고 권합니다. 앞에서 본 `aud` 검증이 OAuth 보안의 기본 요구이기도 하다는 뜻입니다.

## 그래서 무엇을 고를까

자사 웹 서비스를 같은 도메인에서 서빙하는 경우라면 저는 서버 세션 + 쿠키를 먼저 봅니다. 브라우저가 쿠키 관리를 해 주고, `HttpOnly` 로 토큰 탈취 경로를 막고, 폐기가 즉각적이고, 세션 저장소는 Redis 하나면 충분합니다. 이럴 때 JWT 로 가면 얻는 건 "무상태"라는 구호인데, 폐기를 구현하다 보면 저장소를 다시 들이게 됩니다. 인증 서버 하나에 서버 몇 대가 붙는 규모에서는 세션이 훨씬 덜 아픕니다.

JWT 가 잘 맞는 곳은 따로 있습니다. 마이크로서비스 사이에서 요청 주체와 권한을 전달할 때, 여러 조직이 걸친 페더레이션 로그인을 할 때, 인증 서버와 리소스 서버가 분리되어 공개키만으로 검증하고 싶을 때입니다. 그때도 access token 은 짧게, refresh 는 서버 상태로 두는 게 기본입니다. 모바일 앱은 어느 쪽 서버든 결국 토큰 한 쌍을 받아 Keystore 로 지킨 뒤 Authenticator 로 갱신하는 같은 모양이 되니, 서버가 세션이냐 JWT 냐보다 refresh 흐름을 얼마나 견고하게 만들었는지가 앱 안정성에 더 크게 작용합니다.

## 참고 자료

- [RFC 7519: JSON Web Token (JWT)](https://www.rfc-editor.org/rfc/rfc7519)
- [RFC 7515: JSON Web Signature (JWS)](https://www.rfc-editor.org/rfc/rfc7515)
- [RFC 8725: JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725)
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700)
- [OWASP: Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [Android Developers: Cryptography](https://developer.android.com/privacy-and-security/cryptography)
- [Android Developers: Android Keystore system](https://developer.android.com/privacy-and-security/keystore)
- [Android Developers: Security release notes (security-crypto)](https://developer.android.com/jetpack/androidx/releases/security)
