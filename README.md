# Asciimator

ASCII art editor with DOS-style palette and drawing tools.

Production domain: [asciimator.com](https://asciimator.com)

## Local Development

Requirements:
- Node.js 18+
- npm

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

## Deploy to Cloudflare Pages

Use Git integration and configure:

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `dist`

Then attach custom domain `asciimator.com` in Cloudflare Pages.
