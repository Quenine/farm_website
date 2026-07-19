import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {marketingConfig} from "@/src/config/site";
import {AnalyticsTestClient} from "./test-client";
export const metadata:Metadata={title:"Analytics diagnostic",robots:{index:false,follow:false}};
export default function AnalyticsTestPage(){if(!marketingConfig.analyticsTestEnabled)notFound();return <main className="mx-auto min-h-screen max-w-2xl p-5 sm:p-8"><h1 className="text-3xl font-bold text-green-950">Analytics diagnostic</h1><p className="mt-2 text-stone-700">Temporary public-safe browser verification. Disable the diagnostic flag after production acceptance.</p><AnalyticsTestClient/></main>}
