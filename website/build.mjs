#!/usr/bin/env node
/**
 *   devChat documentation site builder.
 *
 *   Why it exists: the docs site is plain static HTML so it loads fast and is
 *   fully indexable by search engines, but every page needs the same layout,
 *   navigation and SEO tags (canonical URL, Open Graph, Twitter, JSON-LD).
 *   This zero-dependency script stitches each `pages/*.html` fragment into
 *   the layout and writes `dist/` together with `sitemap.xml` and
 *   `robots.txt`.
 *
 *   Page fragments start with metadata comments:
 *     <!-- title: Getting started -->
 *     <!-- description: One sentence for search results. -->
 *     <!-- order: 2 -->            (position in the sidebar)
 *     <!-- nav: Getting started --> (sidebar label, defaults to title)
 *
 *   Usage: `node website/build.mjs`. Set SITE_URL to change the canonical
 *   origin (default below). Vercel runs this as the project build command.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT     = dirname(fileURLToPath(import.meta.url))
const OUT      = join(ROOT, 'dist')
const SITE_URL = (process.env.SITE_URL || 'https://devchat-docs.vercel.app').replace(/\/$/, '')
const REPO_URL = 'https://github.com/jrnoorbaloch/devChat'
const SITE     = 'devChat'
const TODAY    = new Date().toISOString().slice(0, 10)

/** Parse `<!-- key: value -->` header comments off the top of a fragment. */
function parsePage (file) {
  const raw  = readFileSync(join(ROOT, 'pages', file), 'utf8')
  const meta = {}
  const body = raw.replace(/^\s*<!--\s*(\w+):\s*([\s\S]*?)\s*-->\s*/gm, (_m, k, v) => {
    meta[k] = v
    return ''
  })
  const slug = file.replace(/\.html$/, '')
  return {
    body,
    description: meta.description ?? '',
    nav: meta.nav ?? meta.title,
    order: Number(meta.order ?? 99),
    path: slug === 'index' ? '/' : `/${slug}`,
    slug,
    title: meta.title ?? slug,
  }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const pages = readdirSync(join(ROOT, 'pages'))
  .filter(f => f.endsWith('.html'))
  .map(parsePage)
  .sort((a, b) => a.order - b.order)

const docPages = pages.filter(p => p.slug !== 'index')

/** Build the per-page JSON-LD block. */
function jsonLd (page) {
  const url = SITE_URL + page.path
  const data = page.slug === 'index'
    ? {
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        name: SITE,
        description: page.description,
        url,
        codeRepository: REPO_URL,
        programmingLanguage: 'TypeScript',
        runtimePlatform: 'Node.js',
        license: 'https://www.apache.org/licenses/LICENSE-2.0',
        keywords: 'chatbot SDK, TypeScript chatbot, bot framework, RPA, WeChat bot, WhatsApp bot',
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: `${page.title} | ${SITE}`,
        description: page.description,
        url,
        dateModified: TODAY,
        isPartOf: { '@type': 'WebSite', name: `${SITE} Docs`, url: SITE_URL + '/' },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
            { '@type': 'ListItem', position: 2, name: page.title, item: url },
          ],
        },
      }
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`
}

function layout (page) {
  const isHome   = page.slug === 'index'
  const fullTitle = isHome ? `${SITE} – TypeScript Chatbot SDK & Bot Framework` : `${page.title} | ${SITE} Docs`
  const url      = SITE_URL + page.path
  const sidebar  = docPages.map(p =>
    `<a href="${p.path}"${p.slug === page.slug ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`).join('\n          ')
  const idx  = docPages.findIndex(p => p.slug === page.slug)
  const prev = idx > 0 ? docPages[idx - 1] : undefined
  const next = idx >= 0 && idx < docPages.length - 1 ? docPages[idx + 1] : undefined
  const pager = isHome ? '' : `
        <nav class="pager" aria-label="Pagination">
          ${prev ? `<a class="prev" href="${prev.path}"><small>Previous</small>${esc(prev.nav)}</a>` : '<span></span>'}
          ${next ? `<a class="next" href="${next.path}"><small>Next</small>${esc(next.nav)}</a>` : '<span></span>'}
        </nav>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(page.description)}">
  <meta name="keywords" content="devChat, chatbot SDK, TypeScript chatbot framework, Node.js bot, RPA, WeChat bot, WhatsApp bot, WeCom bot, Lark bot, command router, auto reply bot">
  <meta name="author" content="jrnoorbaloch">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#0b0f14">
  <link rel="canonical" href="${url}">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/og.png">
  <meta property="og:type" content="${isHome ? 'website' : 'article'}">
  <meta property="og:site_name" content="${SITE} Docs">
  <meta property="og:title" content="${esc(fullTitle)}">
  <meta property="og:description" content="${esc(page.description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE_URL}/assets/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(fullTitle)}">
  <meta name="twitter:description" content="${esc(page.description)}">
  <meta name="twitter:image" content="${SITE_URL}/assets/og.png">
  <link rel="stylesheet" href="/assets/style.css">
  ${jsonLd(page)}
</head>
<body class="${isHome ? 'home' : 'doc'}">
  <a class="skip" href="#main">Skip to content</a>
  <header class="topbar">
    <a class="brand" href="/" aria-label="${SITE} home"><img src="/assets/favicon.svg" alt="" width="26" height="26"><span>dev<b>Chat</b></span></a>
    <nav class="toplinks" aria-label="Primary">
      <a href="/getting-started">Docs</a>
      <a href="/plugins">Plugins</a>
      <a href="/api">API</a>
      <a class="gh" href="${REPO_URL}" rel="noopener">GitHub ↗</a>
    </nav>
    <button class="menu" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">☰</button>
  </header>
  ${isHome
    ? `<main id="main">${page.body}</main>`
    : `<div class="shell">
      <aside id="sidebar" class="sidebar">
        <p class="side-h">Documentation</p>
        <nav aria-label="Documentation">
          ${sidebar}
        </nav>
      </aside>
      <main id="main" class="content">
        <article>
${page.body}
        </article>${pager}
        <p class="edit"><a href="${REPO_URL}/edit/main/website/pages/${page.slug}.html" rel="noopener">Edit this page on GitHub</a></p>
      </main>
    </div>`}
  <footer class="footer">
    <p>devChat is open source under the <a href="${REPO_URL}/blob/main/LICENSE">Apache-2.0 license</a> · <a href="${REPO_URL}/blob/main/NOTICE">Credits &amp; notices</a></p>
  </footer>
  <script src="/assets/site.js" defer></script>
</body>
</html>
`
}

rmSync(OUT, { force: true, recursive: true })
mkdirSync(OUT, { recursive: true })
cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true })
// Standalone pages copied as-is (no layout), e.g. the login QR page.
cpSync(join(ROOT, 'static'), OUT, { recursive: true })

for (const page of pages) {
  const file = page.slug === 'index' ? 'index.html' : `${page.slug}.html`
  writeFileSync(join(OUT, file), layout(page))
}

writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${SITE_URL}${p.path}</loc><lastmod>${TODAY}</lastmod><priority>${p.slug === 'index' ? '1.0' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`)
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
writeFileSync(join(OUT, '404.html'), layout({
  body: '<h1>Page not found</h1><p>That page does not exist. Try the <a href="/getting-started">getting started guide</a>.</p>',
  description: 'Page not found.',
  nav: 'Not found',
  order: 999,
  path: '/404',
  slug: '404',
  title: 'Page not found',
}).replace('content="index, follow, max-image-preview:large"', 'content="noindex"'))

console.info(`Built ${pages.length} pages for ${SITE_URL} into ${OUT}`)
