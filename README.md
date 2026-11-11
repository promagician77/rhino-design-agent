# Rhino design agent demo (prebuilt)

Static site in `site/`. Deploy this folder as a Vercel project:

```
cd deploy
npx vercel deploy --prod
```

Or import the repo in Vercel and set **Root Directory** to `deploy`. No build step runs.
`vercel.json` sends `X-Robots-Tag: noindex, nofollow` on every response; `robots.txt` disallows all crawling.

Source, tests and the "measured vs not measured" section are in the README at the repo root.
