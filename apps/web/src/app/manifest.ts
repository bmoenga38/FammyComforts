import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Fammy Comforts",
    short_name: "Fammy Comforts",
    description:
      "Accommodation & rental operations — booking, front desk, housekeeping, payments, and reporting.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#282a36",
    theme_color: "#282a36",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/maskable-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
