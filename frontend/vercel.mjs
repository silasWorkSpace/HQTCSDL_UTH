const apiOrigin = process.env.LIVINGDOCS_API_ORIGIN?.replace(/\/$/, '');
if (!apiOrigin) {
  throw new Error('Set LIVINGDOCS_API_ORIGIN in Vercel for each environment.');
}

const parsedApiOrigin = new URL(apiOrigin);
if (parsedApiOrigin.protocol !== 'https:') {
  throw new Error('LIVINGDOCS_API_ORIGIN must use HTTPS.');
}

export const config = {
  rewrites: [
    { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
    { source: '/(.*)', destination: '/index.html' },
  ],
};
