import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Symbasis MM",
  description: "Horizen testnet market-making simulator for Symbasis"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
