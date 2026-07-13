import { permanentRedirect } from "next/navigation";

export default function ContentOverviewRedirect() {
  permanentRedirect("/admin/content");
}
