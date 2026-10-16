import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The unchanged Cuvva generator resolves fonts/images relative to itself.
  // Keep its source/assets outside Next's JS bundle and trace them explicitly.
  serverExternalPackages: ["pdfkit", "qrcode", "nodemailer"],
  outputFileTracingIncludes: {
    "/*": ["./vendor/cuvva/**/*"],
  },
};

export default nextConfig;
