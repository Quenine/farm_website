import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createOperationalNotification } from "@/src/lib/operational-notifications";
export async function POST(){await requireAdmin();await createOperationalNotification({type:"system",severity:"info",event:`admin-test-${Date.now()}`,title:"Admin notification test",message:"Browser and in-app notification delivery is being tested.",targetUrl:"/admin/notifications"});return NextResponse.json({ok:true});}
