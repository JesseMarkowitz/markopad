# MarkoPad — Requirements

Version 1 requirements, 2026-11-10. Status: **released as 1.0.0**. Section 11 records what has been verified and what has not.

MarkoPad is a two-pane Markdown editor and viewer that runs entirely in the browser. You type or
paste Markdown on the left and read the rendered result on the right. It is one static page that
anyone can host, or open straight from a disk, and it never sends a document anywhere.

How to read this document: every requirement has an ID, and the browser tests carry the same IDs
in their names. Everything here was agreed in review on 2026-11-09 except three small items that
were built as first proposed and never discussed: the light/dark button (L-6), the 250 KB size
target (N-1), and the choice of libraries (section 8).

---

## 1. Purpose and principles

**Who it is for.** Someone who needs to write a Markdown document, or who has received one and wants
to read it properly, and who does not want to install an application or hand the text to a service.

**Principles, in priority order.** When two requirements pull against each other, the earlier
principle wins.

1. **Private.** A document never leaves the browser it was typed or opened in.
2. **Safe.** Opening a document from a stranger must not be able to harm the reader.
3. **Simple.** One screen, few controls, nothing to configure.
4. **Fast.** Loads at once, keeps up with typing.
5. **Easy to host.** One file, no build step, no server software beyond a plain web server.

## 2. Points that needed a decision

All seven recommendations were accepted on 2026-11-09.

| # | Question | Decision |
| --- | --- | --- |
| Q1 | What counts as "unsaved" for the close warning? (S-3) | Any edit since the last Open, Download or New. Pasting into an *empty* document does not count, so that paste-read-close raises no warning. |
| Q2 | Dropping or opening a file when the document is not empty (IO-4) | Ask "Replace the current document?" Never merge. |
| Q3 | Remote images in an exported HTML file (IO-9) | Keep them as ordinary image links, as the Markdown says, and state the consequence in the help. |
| Q4 | Task-list checkboxes in the preview (MD-3) | Display only. Ticking one in the preview does not edit the text in version 1. |
| Q5 | How the single file is produced (D-2) | Source kept in separate files; a small script joins them into `index.html`; the joined file is committed and attached to each release, so a person hosting it never runs the script. |
| Q6 | Which browsers must work (N-5) | Current Firefox, Chrome, Edge and Safari on desktop and phone, and Tor Browser at its Standard level. |
| Q7 | Largest document that must stay smooth (N-2) | 1 MB of text, about 500 pages. Larger documents still open but may lag. |

---

## 3. Functional requirements

### 3.1 Layout

- **L-1** Two panes side by side: raw text on the left, rendered preview on the right.
- **L-2** A divider between the panes can be dragged with a mouse or a finger, and moved with the
  keyboard when it has focus. Double-click or double-tap returns it to the middle.
- **L-3** Either pane can be collapsed entirely, giving text-only or preview-only.
- **L-4** On a narrow screen (a phone held upright) the page shows one pane at a time with an
  Edit / Preview / Both switch. "Both" stacks the panes top and bottom with the same draggable divider.
- **L-5** The layout adapts when the window is resized or the device is rotated, without losing the
  text, the cursor position or the scroll position.
- **L-6** Light and dark appearance follow the device setting. A button switches
  between them for the current tab.
- **L-7** A slim top bar holds every control. A formatting toolbar sits above the text pane
  (section 3.8).
- **L-8** The browser tab title shows the document name, with a mark (●) when there are
  unsaved changes, so several MarkoPad tabs can be told apart. The name is, in order: the name of
  the opened file; else the first heading; else the first line of text, shortened; else "Untitled"
  with the time the tab was started, such as "Untitled 14:05".

### 3.2 Editing

- **E-1** The left pane is a plain text box. No syntax colouring, no line numbers.
- **E-2** The browser's own undo, redo, spell check, selection and find all work as they do in any
  text box.
- **E-3** Tab indents and Shift+Tab outdents the current line or selection. Pressing
  Escape first lets Tab move focus out of the box, for keyboard-only users.
- **E-4** Pressing Enter inside a list starts the next list item; pressing Enter on an
  empty item ends the list.
- **E-5** The preview updates as you type, with no button to press.
- **E-6** Scrolling one pane scrolls the other to the matching place. A control turns this off.
- **E-7** A status line shows line count, word count and character count. It may carry more
  detail later.

### 3.8 Formatting toolbar

- **T-1** A toolbar above the text pane with: bold, italic, strikethrough, inline code; headings
  1 to 3; link, image; bulleted, numbered and check lists; quotation; code block; table; dividing
  line.
- **T-2** A button applies its Markdown to the selected text. Pressing it again on text that
  already carries that Markdown removes it.
- **T-3** With nothing selected, an inline button acts on the word under the cursor, or inserts a
  placeholder that is left selected so typing replaces it.
- **T-4** Line buttons (headings, lists, quotation) act on every selected line, or the current one.
- **T-5** Link and Image leave the address selected, ready to type. Selected text becomes the
  link text or the image description; a selected address becomes the link's address.
- **T-6** Every toolbar action is a single Undo step.
- **T-7** The toolbar can be hidden and shown from the top bar. The choice lasts for the tab.
- **T-8** Ctrl+B, Ctrl+I and Ctrl+K are bold, italic and link while the text pane has focus.
- **T-9** The toolbar is reachable by keyboard: Tab to it, arrow keys along it. Pressing a button
  with a mouse or finger does not take the selection away from the text.

### 3.3 Markdown

- **MD-1** GitHub-Flavored Markdown: headings, emphasis, strikethrough, lists, task lists, links,
  images, block quotes, inline code, fenced code blocks, tables, horizontal rules, and automatic
  linking of bare web addresses.
- **MD-2** Not in version 1: footnotes, math, diagrams, colouring of code blocks.
- **MD-3** Task-list checkboxes are shown but cannot be ticked in the preview. See Q4.
- **MD-4** HTML written inside the Markdown is displayed only after sanitizing (section 4).
- **MD-5** A link to a heading in the same document (`#section`) scrolls the preview and
  needs no confirmation.

### 3.4 Getting text in and out

- **IO-1** Paste: ordinary paste into the text box.
- **IO-2** Open: a button opens a file chooser. Any text file is accepted; `.md`, `.markdown` and
  `.txt` are offered first.
- **IO-3** Drop: dragging a file onto the page opens it.
- **IO-4** Opening or dropping a file when the document is not empty asks before
  replacing it. See Q2.
- **IO-5** Copy Markdown: copies the whole raw text.
- **IO-6** Copy formatted: copies the rendered result so it pastes into an email or a word processor
  with its formatting.
- **IO-7** Copy HTML: copies the rendered result as HTML source.
- **IO-8** Download Markdown: saves a `.md` file. The name comes from the opened
  file, or else from the first heading, or else `untitled.md`.
- **IO-9** Download HTML: saves a standalone `.html` file of the rendered document that needs
  nothing else to display. See Q3.
- **IO-10** Print / Save as PDF: prints the preview only, through the browser's own print dialog.
- **IO-11** New: clears the document, after confirmation if there are unsaved changes.
- **IO-12** Keyboard shortcuts: Ctrl/Cmd+O to open, Ctrl/Cmd+S to download Markdown,
  Ctrl/Cmd+P to print the preview.

### 3.5 Multiple documents

- **W-1** Every browser tab or window holding MarkoPad is a separate, independent document. Nothing
  typed in one affects another.
- **W-2** A New Window button opens a fresh, empty MarkoPad.
- **W-3** There are no document tabs inside the page; the browser's tabs and windows do that job.

### 3.6 Storage

- **S-1** MarkoPad stores no document permanently, anywhere. There is no document list, no history,
  no account.
- **S-2** Each tab keeps a recovery copy of its own text for as long as that tab exists, so a reload
  or a browser crash does not lose the work. It is cleared when the tab is closed.
- **S-3** Leaving or closing a tab with unsaved changes raises the browser's "Leave site?" prompt.
  See Q1 for what counts as unsaved.
- **S-4** A Clear Document control wipes the text and its recovery copy at once. This is the New
  button (IO-11): one control does both.
- **S-5** If the recovery copy cannot be kept (document too large, or the browser forbids it), the
  page says so plainly and carries on working.
- **S-6** Version 1 stores no settings. Divider position, appearance and scroll-sync choice last for
  the tab only.

Known limits of S-2, to be stated in the help: the browser writes the recovery copy into its own
profile on disk while the tab is open; a closed tab that is reopened with the browser's "reopen
closed tab" may bring the text back; a private window leaves nothing behind.

### 3.7 Help

- **H-1** Every control has a tooltip saying what it does.
- **H-2** A "How do I…?" panel: type a word such as *table*, *bold*, *link* or *strikethrough* and
  see the Markdown to type beside what it produces.
- **H-3** Each entry in that panel has an Insert button that places the example at the cursor, and a
  Copy button. The panel is part of the page it was opened from, so Insert always acts on that
  tab's own document.
- **H-4** With nothing typed in the search, the panel is a browsable cheat sheet of everything
  MarkoPad supports.
- **H-5** A full help document covers: how to use the page, the Markdown reference, how storage
  works and its limits (S-2), the privacy risk of loading remote images (P-4), how link
  confirmation works, and how to host MarkoPad or run it from a disk.
- **H-6** The help document is itself Markdown and opens in a new MarkoPad tab, so it is
  also a worked example. It is reading material and has no Insert buttons; H-3 belongs to the
  panel, not to the help.
- **H-7** The help shows the MarkoPad version number, and so does the right-hand end of the status
  line on every page.

---

## 4. Security

The threat: a Markdown document from an untrusted source that tries to run code, imitate the page,
or trick the reader into visiting a hostile site.

- **X-1** Everything shown in the preview passes through a sanitizer first. Scripts, event handlers,
  embedded frames, forms and form fields, and embedded objects are removed.
- **X-2** Styling, positioning and naming attributes are removed from document HTML, so a document
  cannot draw over the page's controls or imitate its dialogs.
- **X-3** The preview is confined to its pane. Nothing in a document can appear outside it.
- **X-4** Only web links (`http`, `https`) and email links (`mailto`) work. Every other kind of link
  is shown as plain text.
- **X-5** A link opens in a new tab that cannot reach back into MarkoPad and is not told where the
  click came from.
- **X-6** Hovering over or focusing a link shows its true destination. Tooltip text supplied by the
  document is discarded.
- **X-7** **Every** click on a web or email link is confirmed first: "This link goes to
  **example.com**. Open?", with the host name prominent, the full address visible, and a Copy
  Address choice.
- **X-8** A link is marked as suspicious in the preview, and again in the confirmation, when:
  the visible text names a different site from the destination; the host contains lookalike
  characters from another alphabet; the host is a bare numeric address; or the address hides a
  name before an `@` sign.
- **X-9** The page carries its own content security policy, so that even if the sanitizer missed
  something the browser refuses to run injected script or open any data connection.
- **X-10** A relative link or image (one with no site name) has nothing to resolve against and is
  shown as unavailable, never guessed.

What MarkoPad does not do: judge whether a destination is malicious. That would need a lookup
service, which would mean sending the reader's links elsewhere (principle 1).

## 5. Privacy

- **P-1** After the page has loaded, MarkoPad makes no network request of its own. No analytics, no
  fonts or scripts from other sites, no update check.
- **P-2** The only possible outbound requests are images the reader has approved (P-3) and links the
  reader has confirmed (X-7).
- **P-3** Remote images are blocked by default. Each is replaced by a placeholder naming its host,
  and a notice says how many are blocked and from how many hosts. The reader can:
  load one image; load every image from that exact host; or load every image in the document.
- **P-4** The notice links to a plain warning in the help: loading a remote image tells its host
  your network address, your browser, and the moment you opened the document, and a sender can use
  that to learn the document was read.
- **P-5** Approvals apply to the current document in the current tab only. Opening or starting
  another document clears them.
- **P-6** Hosts are matched by exact name. `img.example.com` and `cdn.example.com` are approved
  separately.
- **P-7** An image embedded in the document itself needs no network and is always shown.
- **P-10** While any remote image is showing, the preview says how many, and from how many hosts,
  and offers Block Again. That takes back every approval for the document and returns the images
  to placeholders. The help states that it cannot undo what a host has already learned.
- **P-8** Approved images are requested without telling the host what page asked for them.
- **P-9** The server hosting MarkoPad learns only that the page was fetched. It never receives
  document content, and the page gives it no way to.

---

## 6. Hosting and distribution

- **D-1** MarkoPad is a single self-contained HTML file. Everything it needs is inside it.
- **D-2** A person hosting it copies that one file into a folder. There is nothing to build,
  install or configure. See Q5.
- **D-3** It works on Start9 Pages and on any plain static web server.
- **D-4** It works when opened directly from a disk by double-click, with no web server and no
  internet connection. Any feature a browser withholds in that mode is listed in the help.
- **D-5** Public repository on GitHub, MIT license. Bundled libraries keep their own license
  notices inside the file.
- **D-6** Releases are numbered, and the number is visible in the page (H-7).

## 7. Other requirements

- **N-1** The file is small enough to load at once on a slow connection. Target:
  under 250 KB.
- **N-2** Typing stays smooth in a 1 MB document. See Q7. **Not fully met:** see the measurements
  in section 11.
- **N-3** Every control can be reached and used from the keyboard, and is labelled for screen
  readers. Text meets normal contrast guidelines in both appearances.
- **N-4** English only in version 1.
- **N-5** Supported browsers as in Q6. JavaScript is required; with it turned off the
  page shows a short explanation.
- **N-6** If a browser feature is missing (for example clipboard access on a page not served
  securely), the affected control says why instead of failing silently.

## 8. Technical approach

Kept short on purpose; this is for whoever builds it.

| Job | Choice | License | Size, minified |
| --- | --- | --- | --- |
| Markdown to HTML | `marked` 18.x | MIT | about 40 KB |
| Sanitizing | `DOMPurify` 3.x | Apache-2.0 or MPL-2.0 | about 30 KB |
| Everything else | Plain HTML, CSS and JavaScript, no framework | — | — |

Both libraries are copied into the file, never loaded from another site, and the build checks each
against a recorded hash. The recovery copy uses the browser's per-tab session storage. The close
warning uses the browser's standard leave-page prompt, whose wording browsers do not let a page
change.

**Block-by-block rendering.** The document is cut into small independent pieces, each cleaned on
its own and remembered, so an edit re-cleans one piece instead of the whole document and only the
changed part of the preview is replaced. A large document is prepared a slice at a time so the page
stays responsive. The preview, the exported files and the clipboard are assembled from the same
pieces. One visible consequence: an HTML tag left unclosed in one paragraph no longer spills its
effect over the rest of the document.

**A link in the preview has no address attached.** The destination is held separately and can only
be opened through the confirmation question, so no kind of click or browser menu can skip it.

## 9. Not in version 1

Document tabs inside the page · permanent settings · a list of trusted image
hosts · accounts, sharing links, collaboration · storing pasted images · footnotes, math, diagrams,
code colouring · languages other than English · installing as an offline app.

## 10. Settings to consider for a later version

Version 1 has none (S-6). This list is kept so the later work starts from it.

- Default divider position, and whether to remember the last one
- Layout: side by side or stacked, panes swapped, default view on phones
- Appearance: light, dark, or follow the device
- Editor font, size and line wrap; preview text size and width
- Synchronized scrolling on or off
- Image policy: block, allow, or a list of trusted hosts
- Link confirmation: always, suspicious only, or never
- Recovery copy on or off; close warning on or off
- Spell check on or off
- Tab key behaviour and indent width
- Default download file name and extension
- Whether a single line break becomes a visible break
- Markdown extras, once they exist: footnotes, math, diagrams, code colouring
- Start with a blank page or a welcome document
- Toolbar on or off, once it exists
- Exported HTML with MarkoPad's styling or bare
- Export and import settings as a file

Design idea to carry forward: let a person hosting MarkoPad set defaults in a small block at the top
of the HTML file. That gives site-wide defaults with no browser storage.

## 11. How version 1 will be checked

Nothing is called done because it compiles. Before release each of these is exercised in a real
browser and the result recorded.

1. **Requirements walk-through.** Every ID above is tried by hand on a desktop and on a phone.
2. **Hostile documents.** A collection of known script-injection and disguise tricks is opened;
   none may run code, escape the preview pane, or produce an unflagged disguised link.
3. **Silence on the network.** With the browser's network monitor open, a full session of typing,
   opening, exporting and printing produces no request after the first page load. Remote images
   produce requests only after approval.
4. **Independence.** Three tabs and two windows hold different documents; reloading, closing and
   crashing one leaves the others untouched.
5. **Hosting.** The file is served from Start9 Pages, from a plain web server, and opened from a
   disk; differences between the three are written into the help.
6. **Browsers.** The walk-through is repeated on each browser in Q6.

### Verification record, 2026-11-10 (release 1.0.0)

Run with `MARKOPAD_WEBKIT=1 npm test` (Playwright 1.65.0) on the new development machine, and
again with the same suite pointed at the hosted Start9 Pages copy: **126 passed, 0 skipped,
0 failed, both times.** That build carried the number 0.2.0; release 1.0.0 is the same code with
only the version number changed, and the suite was run once more on it before release.

| Check | Chromium 1254 | Firefox 1572 | WebKit 2388 (Safari's engine) |
| --- | --- | --- | --- |
| Desktop suite, 41 tests, including the six toolbar tests (T-1 to T-9) | 41 passed | 41 passed | 41 passed |
| Phone-size touch screen, 7 tests | 7 passed (emulated Pixel 7) | not run | not run |

The owner tried 0.2.0 by hand on the hosted copy and found it good. Android remains unverified:
no device is available.

Large documents on this machine, a real desktop rather than the earlier virtual machine, against
the hosted copy:

| Document | Browser | First display | Typing, per key | Preview caught up after typing |
| --- | --- | --- | --- | --- |
| 250 KB | Chromium | 1.1 s | 17 ms | 0.3 s |
| 250 KB | Firefox | 1.0 s | 5 ms | 0.3 s |
| 250 KB | WebKit | 1.2 s | 27 ms | 0.6 s |
| 1 MB | Chromium | 2.9 s | 109 ms | 1.0 s |
| 1 MB | Firefox | 2.5 s | 29 ms | 1.0 s |
| 1 MB | WebKit | 3.2 s | 105 ms | 1.1 s |

### Verification record, 2026-11-09

Run on the development machine with `MARKOPAD_WEBKIT=1 npm test`: **110 passed, 0 skipped, 0 failed.**

| Check | Chromium 1234 | Firefox 153 | WebKit 2336 (Safari's engine) |
| --- | --- | --- | --- |
| Desktop suite, 35 tests covering the requirement IDs above | 35 passed | 35 passed | 35 passed |
| Phone-size touch screen, 5 tests | 5 passed (emulated Pixel 7) | not run | not run |

One gap inside that result: the WebKit build used for testing keeps only plain text on its
clipboard, so **Copy → Formatted text cannot be checked in Safari's engine by these tests.** The
plain-text copies are checked there by pasting back with the keyboard. The owner's check on a real
iPhone, below, covers that gap.

Checked by hand by the owner on the hosted copy:

| Browser | What was done |
| --- | --- |
| Brave on Windows | General use |
| Safari on an iPhone | Editing, viewing, and copying into and out of MarkoPad, including Copy → Formatted text pasted with its formatting intact (2026-11-10) |
| Edge on Windows | General use (2026-11-10) |
| Tor Browser | General use (2026-11-10) |
| Safari on a Mac | General use (2026-11-10) |

What the numbered checks in this section found:

1. **Walk-through.** Automated, plus the hands-on use above. Not yet done systematically, ID by
   ID, on real devices.
2. **Hostile documents.** 32 injection and disguise tricks, alone and combined: none ran code, none
   left a disallowed element or attribute in the page, none made a request.
3. **Silence on the network.** Loading the page is one request. A full session of typing, opening,
   exporting, copying and printing made none. Remote images made requests only after approval, and
   without a referrer.
4. **Independence.** Separate tabs kept separate documents through reloads; nothing was written to
   permanent storage.
5. **Hosting.** Opened from a disk, served by a local web server, and **served from a real
   Start9 Pages site over HTTPS**. The hosted file was byte-for-byte the built file (version
   0.1.0, as released), compressed with Brotli, with plain HTTP redirected to HTTPS and no server
   policy header to clash with the page's own. The whole suite, all four browser projects, was
   pointed at the hosted copy and passed.
6. **Browsers.** Automated: Chromium, Firefox, and WebKit on Linux. By hand: Brave on Windows,
   Edge on Windows, Tor Browser, Safari on a Mac, Safari on an iPhone. **Not verified:** Android.

Large documents, measured on a 4-core virtual machine without graphics acceleration, which is slower
than most real computers:

| Document | Browser | First display | Typing, per key | Preview caught up after typing |
| --- | --- | --- | --- | --- |
| 250 KB | Chromium | 1.8 s | 30 ms | 0.6 s |
| 250 KB | Firefox | 1.6 s | 20 ms | 0.5 s |
| 1 MB | Chromium | 5.9 s | 141 ms | 1.1 s |
| 1 MB | Firefox | 4.8 s | 39 ms | 1.2 s |
| 250 KB | WebKit | 2.2 s | 48 ms | 1.1 s |
| 1 MB | WebKit | 6.2 s | 196 ms | 1.8 s |

A plain text box with nothing else on the page already costs about 60 ms per key in Chromium at
1 MB on this machine, so roughly half of that 141 ms is the browser itself. The page stays
responsive while a large document is prepared: the longest stall was about 0.3 s. N-2 is met at
250 KB and in Firefox at 1 MB; it is **not met in Chromium or WebKit at 1 MB on this machine**.

## 12. Decisions so far

| Date | Decision |
| --- | --- |
| 2026-11-09 | Build from scratch. No existing open-source editor met the storage, safety and simplicity requirements together. |
| 2026-11-09 | Plain text box for editing. GitHub-Flavored Markdown only. No toolbar in version 1. |
| 2026-11-09 | Independent tabs, a close warning, and a per-tab recovery copy. |
| 2026-11-09 | Remote images blocked by default; approve one, one exact host, or all. |
| 2026-11-09 | Every link click is confirmed. |
| 2026-11-09 | Help panel may insert examples at the cursor. |
| 2026-11-09 | Public GitHub repository, MIT license. Name: MarkoPad. |
| 2026-11-09 | Trusted-host list and all permanent settings deferred. |
| 2026-11-09 | All seven open questions (Q1 to Q7) accepted as recommended. L-8, E-3, E-4, MD-3, MD-5, IO-4, IO-8, IO-12 and H-6 accepted. |
| 2026-11-09 | Status line shows lines as well as words and characters (E-7). |
| 2026-11-09 | Tab title falls back from file name to first heading, to first line, to "Untitled" with the start time (L-8). |
| 2026-11-09 | Insert buttons live in the in-page panel only; the help document opens in its own tab without them (H-3, H-6). |
| 2026-11-09 | New is also the Clear Document control (S-4). |
| 2026-11-09 | The document is rendered and cleaned block by block, for speed in large documents (section 8). |
| 2026-11-09 | Approved images can be blocked again from the same bar that offers to load them (P-10). |
| 2026-11-09 | The status line shows the running version (H-7). |
| 2026-11-09 | The first version is 0.1.0. |
| 2026-11-10 | Formatting toolbar added (section 3.8), with a Toolbar button to hide it. Name explanation added to the help's About section. Version 0.2.0. |
| 2026-11-10 | No further enhancements for version 1. Released as 1.0.0 with the toolbar included. |
