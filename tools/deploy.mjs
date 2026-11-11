// Creates deploy/: a ready-to-deploy Vercel folder with the prebuilt static site.
import { cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
const vercel = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: null,
  installCommand: "echo 'prebuilt static site: nothing to install'",
  buildCommand: "echo 'prebuilt static site: site/ is committed'",
  outputDirectory: 'site',
  cleanUrls: true,
  headers: [
    { source: '/(.*)', headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
    ] },
    { source: '/fonts/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/vendor/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
    { source: '/models/(.*).3dm', headers: [{ key: 'Content-Type', value: 'application/octet-stream' }, { key: 'Content-Disposition', value: 'attachment' }] },
  ],
};
rmSync('deploy', { recursive: true, force: true });
mkdirSync('deploy', { recursive: true });
cpSync('site-dist', 'deploy/site', { recursive: true });
writeFileSync('deploy/vercel.json', JSON.stringify(vercel, null, 2));
writeFileSync('deploy/package.json', JSON.stringify({ name: 'rhino-design-agent-demo', private: true, version: '1.0.0', description: 'Rhino design agent proof of concept: prebuilt static site in site/.', scripts: { build: "echo 'prebuilt: site/ is committed'", start: 'npx --yes serve site' } }, null, 2));
writeFileSync('deploy/README.md', `# Rhino design agent demo (prebuilt)

Static site in \`site/\`. Deploy this folder as a Vercel project:

\`\`\`
cd deploy
npx vercel deploy --prod
\`\`\`

Or import the repo in Vercel and set **Root Directory** to \`deploy\`. No build step runs.
\`vercel.json\` sends \`X-Robots-Tag: noindex, nofollow\` on every response; \`robots.txt\` disallows all crawling.

Source, tests and the "measured vs not measured" section are in the README at the repo root.
`);
console.log('deploy/ ready');
