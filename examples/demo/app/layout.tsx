import "./globals.css";
import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import Providers from "./providers";

export const metadata: Metadata = {
  title: "stack-link demo",
  description: "View Transitions 기반 스택 전환 데모",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
