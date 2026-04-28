"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    // Check auth by calling the API — cookie is sent automatically
    fetch("/api/user", { credentials: "include" })
      .then((res) => {
        router.replace(res.ok ? "/dashboard" : "/auth");
      })
      .catch(() => {
        router.replace("/auth");
      });
  }, [router]);
  return null;
}
