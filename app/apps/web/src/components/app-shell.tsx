// The single shell every page lives inside.
//
// Layout: <header /><main>{children}</main><footer />
//
// body locks itself to exactly viewport height (h-screen + overflow-hidden in
// root layout). This component composes header + main + footer in that order.
// main is the single scroll region — non-sidebar pages scroll vertically
// inside it; sidebar layouts (Wiki, Chats) use a flex row that takes main's
// full height, sidebar stretches to fill, content has its own overflow.

import { AppChrome } from "@/components/app-chrome";
import { Footer } from "@/components/footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <AppChrome footer={<Footer />}>{children}</AppChrome>;
}
