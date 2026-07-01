"use client";

import { Suspense } from "react";
import SettingsPageContent from "./settings-page-content";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageContent />
    </Suspense>
  );
}
