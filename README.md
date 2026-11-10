# MarkoPad

A private Markdown editor and viewer in one file. Type or paste Markdown on the left, read the
formatted document on the right. Everything happens inside the browser tab: no account, no server
code, and nothing you type or open is ever sent anywhere.

It is built for two jobs: writing a Markdown document quickly, and safely reading one that somebody
sent you.

## The name

MARKO stands for Markdown And Rendering, Kept On-device. The left pane is the Markdown, the right
pane is the rendering, and together they are the pad. A pad is where you put your notes, tear a sheet
from, and walk away with. It keeps nothing, and neither does MarkoPad.

## Use it

Take the single file [`dist/index.html`](dist/index.html). That is the whole program.

- **On a web server.** Put the file in any folder a web server serves. There is nothing to install,
  build or configure.
- **On StartOS.** Put the file in a folder in one of the file services Start9 Pages can read, then
  use Start9 Pages' *Manage Websites* action to point a site at that folder.
- **From a disk.** Double-click the file. It works with no web server and no internet connection.

The built-in **Help** button opens the full user guide, and **How do I…?** is a searchable cheat
sheet for Markdown itself.

## What it does

- Two panes with a divider you can drag by mouse, finger or keyboard. One pane at a time on a phone.
- GitHub-Flavored Markdown: headings, emphasis, lists, task lists, tables, code blocks, links, images.
- Open a file, drop a file, or paste. Copy as Markdown, formatted text or HTML. Download as `.md`
  or as a standalone `.html`. Print or save as PDF.
- Every browser tab is its own independent document.
- A searchable "How do I…?" panel that inserts examples at the cursor.
- Light and dark appearance.

## Privacy and safety

**Nothing is stored permanently.** Each tab keeps a recovery copy of its own text in the browser's
session storage, so a reload does not lose it. The copy is discarded when the tab is closed. There
is no document list, no history, no cookies and no analytics.

**Nothing is sent.** After the page loads it makes no network request of its own. The page carries
a content security policy that makes the browser refuse any data connection and any script other
than the one in the file. The server that hands out the file learns only that it was fetched.

**Documents from other people are treated as hostile.**

- All formatted output passes through [DOMPurify](https://github.com/cure53/DOMPurify) with a short
  list of allowed elements. Scripts, frames, forms, styling and positioning are removed.
- Remote images are blocked until the reader allows them: one image, every image from one exact
  site name, or all of them. They can be blocked again at any time. Loading an image tells its
  host your network address and when you opened the document.
- Links never open on their own. Every click is confirmed with the real destination shown, and
  links that display one site while leading to another are flagged.

MarkoPad cannot tell you whether a site is trustworthy. It shows you where a link really goes and
leaves the decision to you.

One thing you may notice in the browser's developer console: when a document contains styling,
the browser logs that it "refused to apply inline style". That is the page policy meeting the
styling while the document is still being cleaned, before it is removed. Nothing was applied.

## Limits

- The panes scroll together by proportion, so they can drift slightly in documents with long
  tables or many images.
- Documents of a few hundred kilobytes stay smooth. A 1 MB document works, but typing can lag,
  mostly because browsers slow down with that much text in a single text box.
- JavaScript is required.
- No formatting toolbar, footnotes, math, diagrams or code colouring in this version.

## Develop

Requires Node 18 or later. The build itself has no dependencies.

```
node build.mjs        # joins src/ and vendor/ into dist/index.html
npm install           # only needed for the tests
npx playwright install chromium firefox
npm test              # builds, then runs the browser tests
```

To run the same tests against a copy that is already hosted, give its address:

```
MARKOPAD_URL=https://markopad.example.com npx playwright test
```

Safari's engine is an optional extra project, because on Linux it needs system libraries:
`npx playwright install --with-deps webkit`, then `MARKOPAD_WEBKIT=1 npm test`.

| Path | What it is |
| --- | --- |
| `src/index.html` | The page skeleton, with markers the build fills in |
| `src/app.js` | All application code |
| `src/style.css`, `src/markdown.css` | The interface, and the look of formatted documents |
| `src/help.md` | The user guide shown by the Help button |
| `src/howto.mjs` | The entries of the "How do I…?" panel |
| `vendor/` | The two bundled libraries, pinned by hash, with their licenses |
| `build.mjs` | Produces `dist/index.html` and computes the policy hashes |
| `test/` | Browser tests; their names carry the requirement IDs from `REQUIREMENTS.md` |
| `REQUIREMENTS.md` | What MarkoPad must do, and the record of what was verified |

`dist/index.html` is committed on purpose, so that someone who only wants to host MarkoPad never
has to build it. Rebuild and commit it together with any change to `src/` or `vendor/`.

The safety rules the code must keep are listed at the top of `src/app.js`.

## License

MIT. See [`LICENSE`](LICENSE).

MarkoPad includes [marked](https://github.com/markedjs/marked) (MIT) and
[DOMPurify](https://github.com/cure53/DOMPurify) (used under MPL-2.0), both unmodified. Their
license texts are in [`vendor/`](vendor/).
