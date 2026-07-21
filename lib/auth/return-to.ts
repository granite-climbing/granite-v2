/**
 * 로그인·가입·복구 흐름이 끝난 뒤 돌아갈 경로를 안전한 값으로 좁힌다.
 *
 * 오픈 리다이렉트 가드다. `//evil.example.com` 같은 프로토콜 상대 URL은
 * 브라우저가 외부 호스트로 읽으므로 앱 내부 절대 경로만 통과시킨다.
 * pending signup·pending recovery 토큰이 같은 규칙을 써야 해서 여기 모았다.
 */
export function sanitizeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/me";
  }

  return value;
}
