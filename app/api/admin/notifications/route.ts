import "server-only";
import { NextResponse } from "next/server";
import { loadAdminNotifications } from "@/src/lib/admin-notifications";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(await loadAdminNotifications(8),{headers:{"cache-control":"no-store"}});}
