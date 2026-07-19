"use client";
import {GoogleAnalytics} from "@next/third-parties/google";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";
import {getConsentPreferences,googleIntegration} from "@/src/lib/analytics";
import {marketingConfig} from "@/src/config/site";

export function ConsentAwareGoogleAnalytics(){const pathname=usePathname();const[allowed,setAllowed]=useState(false);useEffect(()=>{const sync=()=>setAllowed(Boolean(getConsentPreferences()?.analytics));queueMicrotask(sync);window.addEventListener("farm-consent-changed",sync);return()=>window.removeEventListener("farm-consent-changed",sync)},[]);const integration=googleIntegration();const active=allowed&&marketingConfig.enabled&&!pathname.startsWith("/admin")&&integration.valid&&integration.type==="google_tag"&&integration.prefix==="G";useEffect(()=>{if(active)document.documentElement.dataset.googleAnalytics="mounted";else delete document.documentElement.dataset.googleAnalytics},[active]);if(!active)return null;return <GoogleAnalytics gaId={integration.id}/>}
