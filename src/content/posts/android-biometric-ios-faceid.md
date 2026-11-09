---
title: "지문 인증 성공 콜백만 믿으면 안 됩니다, Android BiometricPrompt 과 iOS Face ID 를 나란히 놓고 보기"
description: "Android BiometricPrompt 의 인증 강도 등급과 CryptoObject, iOS LocalAuthentication 의 LAContext 와 Keychain 접근 제어를 비교하고, 생체 인증 결과를 boolean 이 아니라 Keystore 와 Secure Enclave 의 키에 묶어 서버가 서명으로 검증하는 방법을 적었습니다."
pubDatetime: 2026-11-09T10:18:00+09:00
category: mobile
tags:
  - Android
  - iOS
  - BiometricPrompt
  - Face ID
  - 생체 인증
---

Android 개발자가 iOS 쪽 생체 인증을 읽다 보면 이상하리만치 익숙합니다. `BiometricPrompt` 는 성공 콜백을, `LAContext.evaluatePolicy` 는 `success` 불리언을 줍니다. 그래서 두 플랫폼 모두 "성공이 오면 로그인 처리" 로 구현한 앱이 많습니다. 문제는 그 성공 신호가 **앱 프로세스 안의 값 하나**라는 점입니다. 콜백이 불렸다는 사실은 사용자 확인이 끝났다는 증거가 되지 못합니다. 이 글은 두 플랫폼의 API 를 비교하되, 결론을 하나로 모읍니다. 생체 인증은 보안 하드웨어 안의 키를 여는 열쇠로 써야 하고, 그 키로 만든 서명을 서버가 확인해야 합니다.

## 콜백의 boolean 은 보안이 아닙니다

생체 인증 결과를 불리언으로만 받는 구조를 그려 보면 약점이 바로 보입니다. 센서 판정은 TEE(Android)나 Secure Enclave(iOS) 안에서 일어나지만, 앱에는 "성공했다" 는 사실만 돌아옵니다. 앱이 그 뒤에 하는 일, 즉 저장해 둔 토큰을 꺼내거나 화면을 여는 일은 판정과 아무 암호학적 연결이 없습니다. 루팅·탈옥된 기기에서 Frida 같은 도구로 성공 콜백을 직접 호출하면 지문 없이도 같은 코드 경로가 실행됩니다.

![왼쪽은 시스템 프롬프트가 앱으로 success = true 만 돌려주고 앱이 저장된 토큰을 서버로 보내는 흐름이고, 오른쪽은 서버가 준 challenge 를 보안 하드웨어의 키가 서명하고 서버가 공개키로 검증하는 흐름이다](@/assets/images/android-biometric-ios-faceid-flow.png)

오른쪽 구조에서는 생체 인증이 키 사용 허가가 됩니다. 인증을 통과해야만 개인키로 서명을 만들 수 있고, 개인키는 보안 하드웨어 밖으로 나오지 않습니다. 성공 콜백을 위조해도 서명은 나오지 않으니, 서버는 서명이 있느냐만 보면 됩니다. 이 구조를 만드는 방법이 두 플랫폼에서 어떻게 다른지가 이 글의 본론입니다.

## Android: BiometricPrompt 과 인증 강도

`androidx.biometric` 은 API 23 까지 `BiometricPrompt` 와 `BiometricManager` 를 호환 제공하는 라이브러리입니다. 안정 버전은 2021년 1월 27일에 나온 1.1.0 이고, 1.4 계열은 아직 알파·베타입니다. 2025년 3월 알파 03 에서 Activity Result API 모양의 `registerForAuthenticationResult()` 가 들어와 `biometric-ktx` 를 대체하는 방향이 잡혔고, 2026년 11월 4일에 1.4.0-beta01 이 나왔습니다. 알파 05 부터는 Compose 용 `biometric-compose` 도 같이 배포되고, 같은 버전에서 기본 minSdk 가 21 에서 23 으로 올라갔습니다. 새 프로젝트에서 어떤 쪽을 고를지는 팀이 베타를 받아들일 수 있는지에 달려 있습니다. 이 글의 코드는 1.1.0 의 `BiometricPrompt` 기준입니다.

생체 인증이라고 다 같은 급이 아닙니다. 앱이 허용할 인증 종류는 `setAllowedAuthenticators()` 로 정합니다.

| 상수                | 의미                                          |
| ------------------- | --------------------------------------------- |
| `BIOMETRIC_STRONG`  | Android CDD 의 Class 3 생체 인증              |
| `BIOMETRIC_WEAK`    | Class 2 이상의 생체 인증 (STRONG 의 상위집합) |
| `DEVICE_CREDENTIAL` | 화면 잠금 PIN, 패턴, 비밀번호                 |

CDD 의 분류 기준은 스푸핑 공격 수용률(SAR) 입니다. Class 3 은 최대 7%, Class 2 는 최대 20% 까지 허용합니다. 권한도 다릅니다. Class 3 은 앱에 API 를 노출할 수 있지만 Class 2 는 BiometricPrompt 에는 붙어도 **Keystore 의 앱 인증 키를 풀 수는 없습니다.** 얼굴 인식이 이 지점에서 자주 걸립니다. 제조사 구현에 따라 얼굴 인식은 Class 2 에 머무르는 기기가 흔하고, 그런 기기에서 `BIOMETRIC_STRONG` 으로 키를 묶은 앱은 얼굴 인증으로 로그인되지 않고 지문이나 PIN 으로 넘어갑니다. 기기 목록을 외울 수는 없으니 `canAuthenticate(BIOMETRIC_STRONG)` 로 기기에 직접 묻는 수밖에 없습니다.

```kotlin
val result = BiometricManager.from(context).canAuthenticate(BIOMETRIC_STRONG)
when (result) {
    BiometricManager.BIOMETRIC_SUCCESS -> { /* 키 묶기 가능 */ }
    BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
        val enroll = Intent(Settings.ACTION_BIOMETRIC_ENROLL).putExtra(
            Settings.EXTRA_BIOMETRIC_AUTHENTICATORS_ALLOWED, BIOMETRIC_STRONG,
        )
        // 등록 화면으로 안내
    }
    else -> { /* 비밀번호 로그인으로 */ }
}
```

폴백 쪽에도 함정이 있습니다. `DEVICE_CREDENTIAL` 을 허용하면 `setNegativeButtonText()` 를 같이 쓸 수 없고, Android 10(API 29) 이하에서는 `DEVICE_CREDENTIAL` 단독이나 `BIOMETRIC_STRONG | DEVICE_CREDENTIAL` 조합이 지원되지 않습니다. 구형 기기까지 지원한다면 화면 잠금 존재 여부는 `KeyguardManager.isDeviceSecure()` 로 따로 확인해야 합니다. 같은 문서는 `setConfirmationRequired(false)` 로 얼굴 인증 직후 확인 버튼을 생략하는 힌트도 줄 수 있다고 하는데, 이건 구매 같은 고위험 동작에는 쓰지 않는 쪽이 맞습니다. 시스템이 값을 무시할 수도 있습니다.

## Android: CryptoObject 로 Keystore 키에 묶기

불리언을 넘어서는 방법은 `BiometricPrompt.authenticate(promptInfo, CryptoObject)` 입니다. `CryptoObject` 는 `Signature`, `Cipher`, `Mac`, `KeyAgreement` 를 담을 수 있고, 인증에 성공해야 그 객체의 키가 열립니다. 로그인용이라면 서명 키 쌍이 어울립니다.

```kotlin
private const val KEY_ALIAS = "biometric_login"

fun createKey(): ByteArray {
    val spec = KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_SIGN)
        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
        .setDigests(KeyProperties.DIGEST_SHA256)
        .setUserAuthenticationRequired(true)
        .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
        .setInvalidatedByBiometricEnrollment(true)
        .build()
    val pair = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        .apply { initialize(spec) }
        .generateKeyPair()
    return pair.public.encoded
}
```

반환한 공개키를 서버에 등록해 두면 준비가 끝납니다. 옵션 몇 개가 의미를 갖는 부분입니다. `setUserAuthenticationRequired(true)` 는 사용자 인증을 거친 뒤에만 키를 쓰게 합니다. 이 옵션을 켜면 화면 잠금이 있어야 하고, 화면 잠금을 해제하면 키가 되돌릴 수 없게 무효화됩니다. `setUserAuthenticationParameters(timeout, type)` 은 API 30 에서 들어왔고 timeout 이 0 이면 키를 쓸 때마다 인증해야 합니다. 이 형태를 auth-per-use 키라고 부르며, 결제처럼 한 번의 동작마다 확인이 필요한 곳에 씁니다. API 29 이하에서는 `setUserAuthenticationRequired(true)` 만으로도 기본이 매번 인증이라 같은 효과입니다.

`setInvalidatedByBiometricEnrollment` 는 API 24 이상에서 쓰고 기본값이 `true` 입니다. 생체 인증만 허용하고 유효 시간이 없는 키는 새 지문이 등록되거나 기존 생체 정보가 모두 삭제되면 영구 무효화됩니다. 누군가 폰을 잠깐 쥐고 자기 지문을 추가한 뒤 앱을 여는 시나리오를 막아 줍니다. 이 경우 서명 객체 초기화에서 `KeyPermanentlyInvalidatedException` 이 던져지므로 반드시 잡아서 재등록 흐름으로 넘겨야 합니다.

```kotlin
fun signChallenge(
    activity: FragmentActivity,
    challenge: ByteArray,
    onSigned: (ByteArray) -> Unit,
    onKeyInvalid: () -> Unit,
) {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val privateKey = keyStore.getKey(KEY_ALIAS, null) as PrivateKey
    val signature = Signature.getInstance("SHA256withECDSA")
    try {
        signature.initSign(privateKey)
    } catch (e: KeyPermanentlyInvalidatedException) {
        onKeyInvalid()
        return
    }

    val prompt = BiometricPrompt(
        activity,
        ContextCompat.getMainExecutor(activity),
        object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                val signed = result.cryptoObject?.signature ?: return
                signed.update(challenge)
                onSigned(signed.sign())
            }
        },
    )
    val info = BiometricPrompt.PromptInfo.Builder()
        .setTitle("로그인 확인")
        .setAllowedAuthenticators(BIOMETRIC_STRONG)
        .setNegativeButtonText("비밀번호로 로그인")
        .build()
    prompt.authenticate(info, BiometricPrompt.CryptoObject(signature))
}
```

콜백을 위조해서 `onAuthenticationSucceeded` 를 직접 불러도 `Signature` 의 키는 인증되지 않은 상태라 `sign()` 에서 예외가 납니다. 앞에서 그린 오른쪽 흐름 중 앱 쪽 구현이 이게 전부입니다.

`setIsStrongBoxBacked(true)` 는 API 28 부터 키를 StrongBox 보안 칩에 두라고 요청하는 옵션입니다. 칩이 없는 기기가 많아서 실패를 가정하고 일반 Keystore 로 되돌리는 처리를 함께 둬야 합니다. 모든 키에 필수라고 보기보다, 보안 요구가 높은 서비스에서 선택적으로 켜는 쪽입니다.

## iOS: LocalAuthentication 의 LAContext

iOS 의 입구는 `LAContext` 입니다. 정책이 둘로 갈립니다. `.deviceOwnerAuthenticationWithBiometrics` 는 Face ID 나 Touch ID 만 쓰고 기기 패스코드로 되돌아가지 않습니다. `.deviceOwnerAuthentication` 은 생체 인증이 실패하거나 쓸 수 없을 때 패스코드로 내려갑니다. Android 에서 `DEVICE_CREDENTIAL` 포함 여부로 정하던 폴백을 iOS 에서는 정책 선택으로 정하는 셈입니다.

```swift
let context = LAContext()
var error: NSError?

guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
    // 미등록, 하드웨어 없음, 잠금 상태 등. error 를 보고 다른 로그인 수단으로
    return
}

switch context.biometryType {
case .faceID: break   // 안내 문구를 Face ID 기준으로
case .touchID: break
case .opticID: break  // visionOS
case .none: break
@unknown default: break
}
```

`biometryType` 은 `canEvaluatePolicy` 를 한 번 호출한 뒤에야 의미 있는 값이 들어갑니다. 기본값은 `.none` 입니다. Face ID 는 스캔을 즉시 시작해서 사용자가 최종 취소할 틈이 거의 없으므로 Touch ID 와 안내 문구를 구분하라는 것이 Apple 샘플의 취지입니다. Apple Vision Pro 의 Optic ID 도 같은 `LAContext` 와 같은 정책으로 다루며 `biometryType` 이 `.opticID` 로 나올 뿐입니다.

Face ID 를 쓰려면 Info.plist 에 `NSFaceIDUsageDescription` 이 있어야 하고, 앱이 처음 Face ID 를 쓰려 할 때 이 문구가 시스템 팝업에 나옵니다. 키가 없으면 Face ID 자체를 쓸 수 없습니다. Touch ID 에는 대응하는 키가 없습니다. 반대로 Android 에는 권한 팝업이 없으니 이 점은 Android 개발자에게 낯설 만한 부분입니다. Apple 문서는 생체 인증을 유일한 인증 수단으로 두지 말고 기존 로그인을 보완하는 용도로 쓰라고 조언합니다.

### 여기서도 evaluatePolicy 는 boolean 입니다

`evaluatePolicy` 의 콜백이 주는 것은 `success` 와 에러뿐입니다. 이 값으로 로그인을 처리하면 Android 의 `onAuthenticationSucceeded` 만 믿는 구조와 완전히 같은 약점을 갖습니다. 키를 묶으려면 Keychain 쪽을 써야 합니다. Secure Enclave 안에 개인키를 만들고 접근 제어 플래그로 인증을 요구하면, 그 키로 서명할 때 시스템이 알아서 Face ID 프롬프트를 띄웁니다.

```swift
let tag = Data("com.example.biometric-login".utf8)

func createKey() throws -> Data {
    var error: Unmanaged<CFError>?
    guard let access = SecAccessControlCreateWithFlags(
        nil,
        kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        [.privateKeyUsage, .biometryCurrentSet],
        &error
    ) else { throw error!.takeRetainedValue() }

    let attributes: [String: Any] = [
        kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
        kSecAttrKeySizeInBits as String: 256,
        kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
        kSecPrivateKeyAttrs as String: [
            kSecAttrIsPermanent as String: true,
            kSecAttrApplicationTag as String: tag,
            kSecAttrAccessControl as String: access,
        ],
    ]
    guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error),
          let publicKey = SecKeyCopyPublicKey(privateKey),
          let raw = SecKeyCopyExternalRepresentation(publicKey, &error) as Data?
    else { throw error!.takeRetainedValue() }
    return raw
}

func sign(challenge: Data) throws -> Data {
    let context = LAContext()
    context.localizedReason = "로그인 확인"
    let query: [String: Any] = [
        kSecClass as String: kSecClassKey,
        kSecAttrApplicationTag as String: tag,
        kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
        kSecReturnRef as String: true,
        kSecUseAuthenticationContext as String: context,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess else {
        throw NSError(domain: NSOSStatusErrorDomain, code: Int(errSecItemNotFound))
    }
    let key = item as! SecKey
    var error: Unmanaged<CFError>?
    guard let signature = SecKeyCreateSignature(
        key, .ecdsaSignatureMessageX962SHA256, challenge as CFData, &error
    ) as Data? else { throw error!.takeRetainedValue() }
    return signature
}
```

Secure Enclave 가 다루는 키는 P-256 타원곡선 키이고, 개인키는 칩 밖으로 나오지 않습니다. 그래서 Android 예제와 같은 ECDSA P-256 을 골랐고, 서버에서는 두 플랫폼의 서명을 같은 검증 코드로 처리할 수 있습니다. 공개키의 바이트 표현만 다릅니다. Android 의 `encoded` 는 X.509 SubjectPublicKeyInfo 이고 iOS 의 외부 표현은 비압축 점(X9.63) 형식이라, 서버에서 등록 시 플랫폼별로 파싱해야 합니다. 시뮬레이터에는 Secure Enclave 가 없어서 이 코드는 실기기에서만 돌아갑니다.

플래그 선택에서 Android 의 `setInvalidatedByBiometricEnrollment` 와 같은 갈림길이 나옵니다. `.biometryCurrentSet` 은 지금 등록된 생체 정보 집합에 묶이므로 지문이 추가되거나 얼굴이 다시 등록되면 키를 쓸 수 없게 됩니다. `.biometryAny` 는 등록 내용이 바뀌어도 생체 인증이 가능하기만 하면 통과시킵니다. 로그인용 키라면 `.biometryCurrentSet` 이 안전한 쪽입니다. 패스코드까지 허용하려면 `.userPresence` 가 있고, 여러 조건을 `.and` 나 `.or` 로 묶을 수도 있습니다.

`LAContext.evaluatedPolicyDomainState` 로 등록 변경을 감지하는 방식도 오래 쓰여 왔습니다. 성공한 생체 정책 평가 뒤에 값을 저장해 두고 다음에 비교하는 식입니다. 이 프로퍼티는 iOS 18.0 에서 deprecated 로 표시되었고 문서에 대체 API 안내가 없습니다. 값이 앱마다 다르게 나오는 점도 있어서, 새로 만든다면 키 접근 제어 플래그로 무효화를 맡기는 쪽이 낫습니다.

## 두 플랫폼을 한 표로

![Android 와 iOS 를 API, 강도 구분, 프롬프트 UI, 키 바인딩, 등록 변경 처리, 패스코드 폴백, 선언 요건으로 비교한 표](@/assets/images/android-biometric-ios-faceid-matrix.png)

겉모습은 다르지만 뼈대는 같습니다. 시스템 프롬프트가 있고, 보안 하드웨어가 있고, 키에 인증 조건을 거는 방법이 있습니다. 가장 큰 차이는 Android 쪽에 인증 강도 등급이 노출되고 iOS 쪽에는 없다는 점입니다. Android 에서는 기기마다 얼굴 인식 등급이 달라 `BIOMETRIC_STRONG` 을 요구하면 일부 기기에서 얼굴 인증이 빠집니다. iOS 는 Apple 이 하드웨어를 정하니 그런 분기가 필요 없습니다.

## 서버가 검증해야 완성됩니다

키를 묶어도 서버가 서명을 확인하지 않으면 의미가 반쪽입니다. 흐름은 단순합니다.

1. 생체 로그인을 켤 때 앱이 키를 만들고 공개키를 서버에 등록합니다. 이 시점에는 이미 비밀번호 같은 기존 수단으로 인증된 상태여야 합니다.
2. 로그인할 때 서버가 일회용 challenge 를 줍니다. 짧은 만료 시간을 두고 한 번 쓰면 폐기합니다.
3. 앱이 생체 인증 후 challenge 에 서명해 보냅니다.
4. 서버가 등록된 공개키로 서명을 검증하고, 통과하면 세션이나 토큰을 발급합니다.

이 구조에서 `KeyPermanentlyInvalidatedException` 이나 Keychain 접근 실패는 버그가 아니라 정상 경로입니다. 지문이 추가되면 기존 키가 죽으니 비밀번호로 다시 로그인한 뒤 새 키 쌍을 만들어 공개키를 교체 등록하는 화면이 있어야 합니다. 앱 삭제나 기기 변경 때도 같은 경로를 탑니다. 4번에서 발급하는 토큰 설계는 [JWT 와 서버 세션](/posts/jwt-vs-session/)에서 다뤘습니다.

크로스플랫폼 프레임워크의 생체 인증 플러그인 중에는 불리언 하나만 돌려주는 래퍼가 흔합니다. [React Native, Flutter, Compose Multiplatform 비교](/posts/react-native-flutter-cmp/)에서 본 것처럼 결국 네이티브 API 위에 얹는 계층이라, 키 바인딩이 필요하면 네이티브 모듈을 직접 쓰거나 플러그인이 `Signature` 와 `SecKey` 수준을 열어 주는지 먼저 확인해야 합니다.

패스키는 이 패턴의 표준화된 형태입니다. 기기의 개인키로 서명하고 서버가 공개키로 검증하며, 생체 인증은 그 개인키를 여는 단계에 쓰입니다. Android 공식 가이드는 기기에서의 첫 로그인에는 Credential Manager 를 쓰고, 이후 재인증은 BiometricPrompt 와 Credential Manager 중 고르라고 안내합니다. BiometricPrompt 쪽이 커스터마이징 옵션이 많고, Credential Manager 는 두 흐름을 하나의 구현으로 처리합니다. 직접 만든 서명 로그인과 패스키 중에는 서버 쪽 FIDO 지원 여부와 기존 계정 체계가 기준이 됩니다. 앞으로 새로 설계한다면 패스키를 먼저 보고, 앱 내 재인증이나 거래 승인 같은 곳에서 위 구조를 쓰는 편이 자연스럽습니다.

## 최근 달라진 것들

Android 에는 Identity Check 가 들어왔습니다. 2025년 1월 23일 Google 발표 기준으로 Pixel 의 Android 15 부터 배포가 시작되었고, 신뢰하는 장소 밖에서 기기 PIN 변경이나 패스키 접근 같은 민감한 동작에 생체 인증을 요구하는 기능입니다. 앱 개발자와 닿는 부분은 API 36 에 추가된 `BiometricManager.Authenticators.IDENTITY_CHECK` 입니다. 사용자가 설정에서 기능을 켰고, Class 3 생체 정보가 하나 이상 등록되어 있고, 기기가 신뢰 장소 밖 같은 고위험 환경이고, 앱이 이 비트를 요청했을 때 `BIOMETRIC_STRONG` 만 인증에 쓰이고 기기 자격증명 폴백이 사라집니다. 폴백을 허용하던 앱이 이 모드에서 PIN 으로 넘어가지 못하는 경우가 생기므로, 고위험 동작에서는 폴백 없는 실패 경로도 화면으로 준비해야 합니다.

`androidx.biometric` 1.4.0-alpha06(2026년 3월 25일)에는 Android 36.1 부터 프롬프트가 최대 네 개의 커스텀 폴백 옵션을 지원하고, 선택 결과가 에러 코드 대신 `AuthenticationResult.CustomFallbackSelected` 로 전달되는 변경이 들어갔습니다. 같은 버전에서 `CryptoObject` 에 `KeyAgreement` 도 추가되었습니다. 베타 단계 API 라 시그니처가 바뀔 수 있어, 도입 전에 릴리스 노트를 한 번 더 확인하시길 권합니다.

## 정리

생체 인증 API 의 반환값을 믿는 구조와 키에 묶는 구조는 코드 양이 크게 다르지 않은데 방어하는 범위가 완전히 다릅니다. 새로 만드는 기능이라면 처음부터 서명 방식으로 가는 편이 이후 수정이 덜 듭니다.

## 참고 자료

- [Show a biometric authentication dialog — Android Developers](https://developer.android.com/identity/sign-in/biometric-auth)
- [Biometric — AndroidX release notes](https://developer.android.com/jetpack/androidx/releases/biometric)
- [BiometricManager.Authenticators — Android Developers](https://developer.android.com/reference/android/hardware/biometrics/BiometricManager.Authenticators)
- [KeyGenParameterSpec.Builder — Android Developers](https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec.Builder)
- [Credential Manager — Android Developers](https://developer.android.com/identity/sign-in/credential-manager)
- [Measuring biometric unlock security — Android Open Source Project](https://source.android.com/docs/security/features/biometric/measure)
- [Android enhances theft protection with Identity Check and expanded features — Google](https://blog.google/security/android-theft-protection-identity-check-expanded-features/)
- [Logging a user into your app with Face ID or Touch ID — Apple Developer](https://developer.apple.com/documentation/localauthentication/logging-a-user-into-your-app-with-face-id-or-touch-id)
- [LAContext.evaluatedPolicyDomainState — Apple Developer](https://developer.apple.com/documentation/localauthentication/lacontext/evaluatedpolicydomainstate)
- [LAContext.biometryType — Apple Developer](https://developer.apple.com/documentation/localauthentication/lacontext/biometrytype)
- [SecAccessControlCreateFlags — Apple Developer](https://developer.apple.com/documentation/security/secaccesscontrolcreateflags)

위 다이어그램과 표는 모두 이 글을 위해 직접 그린 것이며, 공식 문서의 이미지를 복사하지 않았습니다.
