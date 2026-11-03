# nevasini.github.io

Personal website of Nevasini Sasikumar: https://nevasini1.github.io

A plain static site with no build step:

| File | What it holds |
| --- | --- |
| `index.html` | All page content: about, news, research, experience, education, talks, projects, service |
| `assets/css/site.css` | Styles, including light and dark themes |
| `assets/js/site.js` | Theme toggle, copy-email button, active section highlight |
| `assets/img/` | Portrait, social preview image, favicon |

## Editing

- **Add a news item:** copy an `<li>` at the top of the list under `id="news"` in `index.html`.
- **Add a paper:** copy an `<article class="pub">` block under the right year in `id="research"`.
  Use `pub pub-feature` for papers you want highlighted with a summary.
- **Add your CV:** put the PDF at `assets/pdf/Nevasini_Sasikumar_CV.pdf` and add a link to it in the
  contact row near the top of `index.html`.

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploying

GitHub Pages serves this repository's `main` branch directly, so every push to `main` goes live
within a minute or two. If the site ever stops updating, check **Settings → Pages** and make sure the
source is **Deploy from a branch**, `main`, `/ (root)`.
