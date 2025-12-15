/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/user/form',
        destination: '/maintenance-form.html?mode=user',
        permanent: false,
      },
      {
        source: '/admin/form',
        destination: '/maintenance-form.html?mode=admin',
        permanent: false,
      },
    ]
  },
  async rewrites() {
    return [
      { source: '/user/form', destination: '/maintenance-form.html?mode=user' },
      { source: '/admin/form', destination: '/maintenance-form.html?mode=admin' },
    ]
  },
}

module.exports = nextConfig
