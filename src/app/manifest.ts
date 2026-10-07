import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tempify",
    short_name: "Tempify",
    description: "Flexible vehicle cover in minutes.",
    start_url: "/",
    display: "standalone",
    background_color: "#07080b",
    theme_color: "#07080b",
    icons: [
      { src: "/brand/tempify-mark.png", sizes: "256x256", type: "image/png" },
    ],
  };
}
