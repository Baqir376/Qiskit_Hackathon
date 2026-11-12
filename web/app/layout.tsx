import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], axes: ["SOFT", "WONK", "opsz"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: "FloodQAOA — Quantum dispatch for flood relief",
  description:
    "Multi-objective flood-relief team dispatch with QAOA in Qiskit. Sindh, 2022 Pakistan floods. Qiskit Fall Fest 2026.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${jetbrains.variable} ${fraunces.variable} grain antialiased`}>
        {children}
      </body>
    </html>
  );
}
