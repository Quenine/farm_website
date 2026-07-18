import Link from "next/link";
import { siteConfig } from "@/src/config/site";
export default function OfflinePage(){return <main className="grid min-h-screen place-items-center bg-[#fbf7ed] p-6 text-center"><div><h1 className="text-3xl font-bold text-green-950">{siteConfig.name} is offline</h1><p className="mt-3 text-stone-700">Reconnect to browse products, track orders, or use admin tools.</p><Link href="/" className="mt-6 inline-flex rounded-full bg-green-800 px-5 py-3 font-bold text-white">Try again</Link></div></main>;}
