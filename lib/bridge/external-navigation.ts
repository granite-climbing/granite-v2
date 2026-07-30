export function createExternalNavigationMessage(url: string) {
  return { version: 1, type: "navigation.open.external.requested", direction: "web-to-native", payload: { url } };
}
