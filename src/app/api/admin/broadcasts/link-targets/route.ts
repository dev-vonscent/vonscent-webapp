import { NextResponse } from "next/server";
import {
  broadcastAdminGate,
  searchBroadcastLinkTargets,
  serverError,
} from "@/features/notifications/broadcast-server";

export const dynamic = "force-dynamic";

/** Холбоосын сонгогч — `?q=` бараа/багцын нэр. */
export async function GET(req: Request) {
  const gate = await broadcastAdminGate();
  if ("response" in gate) return gate.response;
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 100);
  try {
    return NextResponse.json({
      items: await searchBroadcastLinkTargets(gate.supabase, q),
    });
  } catch (err) {
    return serverError(err, "admin.broadcasts.link-targets");
  }
}
