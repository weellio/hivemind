# Default action images

Drop one image per agent state here and they become the **built‑in template** for the
"Your image" avatar mode (Mosaic view). Users can still override any of them from the
dashboard's **Action images…** button (stored per‑browser), and these stay as the default.

Expected files (PNG recommended, ~256×256, square):

```
idle.png  thinking.png  coding.png  spawning.png  reading.png  testing.png  error.png  done.png
```

Anything in `web/public/` is copied to `dashboard/dist/` on `npm run build`, so they're
served at `/actions/<state>.png`. Missing files fall back to a lettered placeholder — no breakage.
