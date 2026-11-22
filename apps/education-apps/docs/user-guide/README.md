# ArwaEduc user guide (for schools)

Step-by-step guide for school owners, administrators and secretaries, from the school signup to the last
service. Two PDFs with the same content: `../ArwaEduc-Guide-Utilisation-AR.pdf` (Arabic, RTL) and
`../ArwaEduc-Guide-Utilisation-FR.pdf` (French).

Not to be confused with `../guide/` (the product guide written for the promo-video team).

- `build.py`: the whole text, written once with Arabic and French side by side; generates `guide-ar.html` and `guide-fr.html`.
- `style.css`: A4 layout shared by both languages.
- `images/ar`, `images/fr`: screenshots with the same file names in each language (desktop 1440x900, phone 390x844).
  They come from a demo school with fictional data only (names, phones `06000001xx`, e-mails `@alwafa.example`).
  Never put passwords, access links or real people's data in the guide.

## Updating

1. Edit the text in `build.py` and/or replace screenshots (same names in both folders).
2. `python3 build.py`
3. Print both HTML files to PDF from `apps/education-apps` (needs internet for the Cairo / Inter fonts):

```bash
for l in ar fr; do L=$(echo $l | tr a-z A-Z)
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
    --no-pdf-header-footer --virtual-time-budget=20000 \
    --print-to-pdf=docs/ArwaEduc-Guide-Utilisation-$L.pdf "file://$PWD/docs/user-guide/guide-$l.html"
done
```
