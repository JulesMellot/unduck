# Tllm's Search Engine

This is a fork of [Unduck](https://github.com/t3dotgg/unduck) by [theo](https://x.com/theo), customized for personal use. It provides a fast, client-side search redirection tool that uses DuckDuckGo's "bang" shortcuts without relying on DuckDuckGo's servers for redirection.

## What is this?

DuckDuckGo's bang redirects are too slow. This project solves this by doing all of the work client-side. Once you've visited the site once, the JS is all cached and will never need to be downloaded again. Your device does the redirects, not a server.

## Features

- Fast bang redirects processed directly in the browser
- Customizable search bangs
- Default search engine configuration
- Responsive design with dark mode support
- Progressive Web App (PWA) capabilities
- Optional Supabase integration for syncing custom bangs across devices

## How is it that much faster?

DuckDuckGo does their redirects server side. Their DNS is...not always great. Result is that it often takes ages.

This project solves this by doing all of the work client-side. Once you've visited the site once, the JS is all cached and will never need to be downloaded again. Your device does the redirects, not a server.

## Setup

1. Add the following URL as a custom search engine in your browser:
   ```
   https://your-deployed-url.com/?q=%s
   ```

2. Use bangs in your searches like:
   - `!g search term` for Google
   - `!ddg search term` for DuckDuckGo
   - Any custom bangs you've added

## Deployment

### Option 1: Using Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/JulesMellot/tllm-search-engine.git
   cd tllm-search-engine
   ```

2. Build and run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

3. The application will be available at `http://localhost:3000`

### Option 2: Manual Deployment

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build the application:
   ```bash
   pnpm run build
   ```

3. Serve the built files:
   ```bash
   pnpm run preview
   ```

### Environment Variables

If you want to use the Supabase sync feature, set these environment variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
# Edit .env with your values
```

## Development

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm run dev
   ```

## Customization

- Add custom bangs through the UI
- Modify the default search engine
- Customize the CSS in `index.html` and `customize.html`

## License

This project is a fork of Unduck, which is MIT licensed. See the [LICENSE](LICENSE) file for details.