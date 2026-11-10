"use client";

import * as React from "react";
import { markSeen } from "@/features/account/use-new-badge";

/** Хуудсыг нээмэгц цэсний «Шинэ» тэмдгийг энэ төхөөрөмж дээр нууна. */
export function MarkSeen({ seenKey }: { seenKey: string }) {
  React.useEffect(() => markSeen(seenKey), [seenKey]);
  return null;
}
