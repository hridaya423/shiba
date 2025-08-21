/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable Next.js dev UI indicators
  devIndicators: false,
  async headers() {
    return [
      {
        // Apply headers only to My Games and Global Games pages
        source: '/(my-games|global-games)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          }
        ]
      }
    ];
  },
};

export default nextConfig;
