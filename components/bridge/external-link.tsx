"use client";
import { createExternalNavigationMessage } from "@/lib/bridge/external-navigation";
export function ExternalLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={(event) => { const channel = (window as Window & { FlutterWebView?: { postMessage(message: string): void } }).FlutterWebView; if (!channel) return; event.preventDefault(); channel.postMessage(JSON.stringify(createExternalNavigationMessage(href))); }}>{children}</a>;
}
