export function formatDateDots(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date(value))
    .replace(/\.\s?/g, ".")
    .replace(/\.$/, "");
}
