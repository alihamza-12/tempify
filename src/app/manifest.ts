import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cuvvafy",
    short_name: "Cuvvafy",
    description: "Flexible vehicle cover in minutes.",
    start_url: "/",
    display: "standalone",
    background_color: "#060812",
    theme_color: "#060812",
    icons: [
      { src: "/brand/cuvvafy-mark.png", sizes: "256x256", type: "image/png" },
      { src: "/brand/tempify-mark.png", sizes: "256x256", type: "image/png" },
    ],
  };
}
