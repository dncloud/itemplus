import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/app-context";

export const metadata: Metadata = {
  title: "item+",
  description: "Open-Source Inventory & Collection Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="h-full bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 antialiased">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
