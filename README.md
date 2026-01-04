# MinWrite

A lightweight, local-first writing app meant for clarity and progress.

MinWrite gives you:

- a clean writing space
- automatic progress tracking
- word-goal milestones
- timed writing sprints
- optional Focus Mode
- simple exports when you're ready to save or share your work

MinWrite is designed for writers who want a dependable, distraction-free place to get words down without friction.

---

## Features

- Local-first (all data stored in your browser)
- Goal tracking with automatic updates
- Built-in writing sprints
- Focus Mode for an immersive workspace
- Exports: .txt, .md, .docx (when CDN libraries reachable)
- Fully offline-friendly (except DOCX import/export)

---

## Privacy

MinWrite does not collect, transmit, or store your writing anywhere.  
All content stays on your device unless you export it.

Note for iPhone/iPad (Safari):  
iOS may automatically clear site data if the app hasn’t been opened in ~7 days.  
Export regularly if you want to keep your work long-term.

Privacy Policy · Terms of Use

---

## Project Structure

    /index.html
    /styles.css
    /script.js
    /_headers
    /_redirects
    /sounds/
        mixkit-uplifting-bells-notification-938.wav
    /privacy.html (optional)
    /terms.html   (optional)

---

## Deployment (Cloudflare Pages)

Framework preset: None  
Build command: (leave empty)  
Output directory: /

After deployment:

- Root URL loads the app
- .txt/.md exports always work
- .docx requires CDN reachability
- /privacy and /terms should resolve or be removed

---

## Redirects

File: `_redirects`

    /*   /index.html   200

---

## Headers

File: `_headers`

    /*
      Strict-Transport-Security: max-age=31536000
      X-Content-Type-Options: nosniff
      X-Frame-Options: DENY
      Referrer-Policy: strict-origin-when-cross-origin
      Permissions-Policy: geolocation=(), camera=(), microphone=()
      Content-Security-Policy: default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests

    /*.css
      Cache-Control: public, max-age=3600

    /*.js
      Cache-Control: public, max-age=3600

    /sounds/*
      Cache-Control: public, max-age=31536000, immutable

---

## CDN Libraries

Placed at the bottom of index.html, before js script:

    <script src="https://unpkg.com/docx@8.1.3/build/index.min.js" crossorigin="anonymous"></script>
    <script src="https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js" crossorigin="anonymous"></script>

Notes:

- .txt/.md exports use native browser APIs
- .docx import/export requires CDN access
- If offline/blocked, the feature is hidden automatically

---

## CDN Update Checklist

1. Read the library’s changelog
2. Update the version number in script tags
3. Test DOCX import/export
4. Revert if needed

---

## Accessibility & UX Notes

- Export menu supports keyboard navigation and focus trapping
- Sidebar/About close on Escape and outside clicks
- Toggles use proper ARIA attributes
- Focus Mode maintains accessible exit controls
- Layout remains usable if fonts are blocked

---

## Troubleshooting

- DOCX option missing → offline or CDN blocked
- iOS cleared data → Safari may purge unused storage

---

## About the Project

MinWrite was built as a straightforward, encouraging place to write — something fast, friendly, and free of friction. It grew from the desire to have a tool that respects a writer’s momentum and makes progress feel visible without getting in the way.

---

## License

© 2025 Sarah Filipiak LLC. All rights reserved. See `LICENSE` for full terms.
