import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Top UGC Creators became the Creator Leaderboard inside the UGC section.
    return [{ source: "/top-creators", destination: "/ugc/leaderboard", permanent: false }];
  },
};

export default nextConfig;
