# ArwaEduc product guide

Source of `../ArwaEduc-Guide.pdf` (Moroccan Darija, RTL, A4). Written for the promo-video team.

- `index.html` + `style.css`: the whole guide (one `<section class="chapter">` per chapter; a chapter is a page break).
- `images/`: screenshots (JPEG, 1300 px wide max). Fictional demo data only; never put passwords, tokens or real people's emails/phones in the guide.

## Updating

1. Edit `index.html` (text) and/or retake screenshots with the demo accounts (desktop 1440x900, phone 390x844) and drop them in `images/`.
2. Regenerate the PDF from `apps/education-apps`:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --no-pdf-header-footer --virtual-time-budget=20000 \
  --print-to-pdf=docs/ArwaEduc-Guide.pdf "file://$PWD/docs/guide/index.html"
```

The fonts (Cairo, Inter) come from Google Fonts, so the machine needs internet access while printing; there is a system Arabic fallback otherwise.
