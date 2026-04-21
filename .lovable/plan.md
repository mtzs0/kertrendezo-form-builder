

## Embed the form on a live site via GitHub Pages + iframe

Yes, the project can be embedded via iframe — but a few things need to change first. The app is currently a Vite SPA that uses `BrowserRouter`, has `DEFAULT_VIEW = "editor"` as the landing screen, and isn't configured for GitHub Pages' subpath hosting. Here's what we'll do.

### What needs to change in the code

1. **Make the public form the default view (not the editor).**
   In `src/pages/Index.tsx`, flip `DEFAULT_VIEW` to `"form"`. Visitors hitting the embedded URL must see the form, not the editor UI. The double-Ctrl+K shortcut still opens the editor for you.

2. **Add a dedicated `/embed` route with a stripped-down chrome.**
   In `src/App.tsx`, add a route `/embed` that renders only the `FormView` (no outer header card, no editor hotkey hint, transparent background). This is the URL the iframe will point at. The existing `/` keeps the full page for direct visits.

3. **Switch from `BrowserRouter` to `HashRouter`.**
   GitHub Pages doesn't do SPA fallback — refreshing `/embed` would 404. `HashRouter` (`/#/embed`) sidesteps this entirely and works on any static host.

4. **Configure Vite for GitHub Pages subpath.**
   In `vite.config.ts`, set `base: "/<repo-name>/"` so built asset URLs resolve correctly when the site is served from `https://<user>.github.io/<repo-name>/`. If you use a custom domain or `<user>.github.io` root repo, `base` stays `/`.

5. **Iframe-friendly styles.**
   - Remove `min-height: 800px` forcing on the embed route.
   - Make the embed body background transparent so the host page shows through.
   - Auto-resize: post the document height to the parent via `postMessage` on resize/mutation, so the parent can set the iframe height (no scrollbars-inside-scrollbars).

6. **Add a GitHub Actions workflow** (`.github/workflows/deploy.yml`) that on every push to `main` runs `npm ci && npm run build` and publishes `dist/` to the `gh-pages` branch (or uses the official `actions/deploy-pages`).

7. **Add `public/404.html`** as a copy of `index.html` — belt-and-suspenders fallback for GitHub Pages even with HashRouter.

### What you do on GitHub / your website

1. **Push to GitHub** — already connected via Lovable's GitHub integration, so this is automatic.
2. **Enable GitHub Pages** — repo Settings → Pages → Source: "GitHub Actions" (or `gh-pages` branch, depending on workflow choice).
3. **Wait for the workflow to finish.** Your form will be live at `https://<user>.github.io/<repo-name>/#/embed`.
4. **Embed on your live website** with:
   ```html
   <iframe
     src="https://<user>.github.io/<repo-name>/#/embed"
     style="width:100%;border:0;"
     id="kertrendezo-form"
     title="Kertrendező űrlap"
   ></iframe>
   <script>
     window.addEventListener("message", (e) => {
       if (e.data?.type === "kr-form-height") {
         document.getElementById("kertrendezo-form").style.height = e.data.height + "px";
       }
     });
   </script>
   ```

### Caveats you should know about

- **Supabase still works from the iframe** — the client uses the public anon key and talks directly to `dszwidenccggatcyuabr.supabase.co` from the browser. No backend hosting needed.
- **Security findings remain.** The "TEMP" RLS policies + open editor are still wide-open; anyone who finds your editor URL (or just opens devtools) can edit forms. You chose to defer this, which is fine for prototyping but worth fixing before the form is publicly linked from a real site. At minimum, after this change the editor is no longer the default landing page.
- **Custom fonts (Fraunces, Inter)** are loaded from Google Fonts in `index.html` — works inside iframes without changes.
- **CSP on the host site:** if your live site sets a strict Content-Security-Policy with `frame-src`, you'll need to allow `https://<user>.github.io` (and Supabase if anything embeds it further).
- **`/mnt/documents`-style file uploads**: image uploads go to Supabase Storage, which works cross-origin from the iframe — no extra config.

### Files that will be created or modified

- modify `src/pages/Index.tsx` (flip default view, optional embed mode)
- modify `src/App.tsx` (add `/embed` route, switch to HashRouter)
- create `src/pages/Embed.tsx` (stripped-chrome form + height postMessage)
- modify `vite.config.ts` (`base` for GH Pages subpath)
- create `.github/workflows/deploy.yml` (build + publish)
- create `public/404.html` (SPA fallback safety net)

