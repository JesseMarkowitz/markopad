# MarkoPad Help

MarkoPad is a Markdown editor and viewer with two panes. You type or paste plain text on the left and read the formatted document on the right. It runs entirely inside this browser tab. **Nothing you type or open is ever sent anywhere.**

You are reading this help inside MarkoPad itself. The left pane shows the Markdown that produces what you see on the right, so every part of this page is also a worked example. Change anything you like; this copy is yours and disappears when you close the tab.

Version {{VERSION}}.

## Contents

- [Quick start](#quick-start)
- [The screen](#the-screen)
- [Getting text in](#getting-text-in)
- [Getting text out](#getting-text-out)
- [Several documents at once](#several-documents-at-once)
- [What is kept, and what is not](#what-is-kept-and-what-is-not)
- [Links](#links)
- [Remote images and your privacy](#remote-images-and-your-privacy)
- [Markdown reference](#markdown-reference)
- [Keyboard](#keyboard)
- [Hosting MarkoPad, or running it from a disk](#hosting-markopad-or-running-it-from-a-disk)
- [Limits worth knowing](#limits-worth-knowing)
- [About](#about)

## Quick start

1. Type in the left pane, or paste text into it.
2. Read the result in the right pane. It updates as you type.
3. When you are done, use **Download** or **Copy** at the top.

If you do not know how to write something, press **How do I…?** and type what you want, such as *table* or *bold*. Each answer has an **Insert** button that places the example where your cursor is.

## The screen

| Control | What it does |
| --- | --- |
| **New** | Starts an empty document and wipes the old text from this tab. |
| **Open** | Opens a text or Markdown file from this device. |
| **Download** | Saves the raw text as a `.md` file, saves the formatted document as a web page, or prints it. |
| **Copy** | Copies the whole document as Markdown, as formatted text, or as HTML code. |
| **New window** | Opens another, empty MarkoPad in a new tab. |
| **Edit / Both / Preview** | Chooses which panes are shown. |
| **Sync scroll** | Keeps the two panes at the same place. Click to turn it off. |
| **Dark / Light** | Switches the colours for this tab. |
| **How do I…?** | A searchable cheat sheet with Insert and Copy buttons. |
| **Help** | Opens this document in a new tab. |

**The divider.** Drag the bar between the panes with a mouse or a finger. With the keyboard, move to it with Tab and use the arrow keys; Home and End jump to the ends, and Enter centres it. Double-click or double-tap also centres it.

**On a phone.** A narrow screen starts with one pane. Use **Edit** and **Preview** to switch. **Both** stacks the panes, text on top, with the same draggable divider.

**The bottom line** shows the number of lines, words and characters, whether the recovery copy is on, and short messages such as "Copied". The version of MarkoPad you are running is at its right-hand end.

## Getting text in

- **Paste** into the left pane.
- **Open** a file with the Open button or <kbd>Ctrl</kbd> + <kbd>O</kbd>.
- **Drop** a file anywhere on the page.

If the document is not empty, MarkoPad asks before replacing it. It never merges two documents.

## Getting text out

- **Copy → Markdown text** copies the raw text.
- **Copy → Formatted text** copies the formatted document. Paste it into an email or a word processor and the headings, lists and tables come with it.
- **Copy → HTML code** copies the formatted document as HTML source.
- **Download → Markdown file** saves a `.md` file. The name comes from the file you opened, or from the first heading.
- **Download → Web page** saves one `.html` file that shows the formatted document in any browser, with nothing else needed. It contains no scripts.
- **Download → Print or save as PDF** opens the browser's print window. Only the formatted document is printed. Choose "Save as PDF" there to make a PDF.

A web page you download keeps any remote images as ordinary image addresses. Whoever opens that file will load those images from their original sites. See [Remote images and your privacy](#remote-images-and-your-privacy).

## Several documents at once

Every tab or window that holds MarkoPad is a separate document. What you do in one never touches another. Press **New window** for another empty one, and use the browser's own tabs and windows to arrange them.

The tab title shows the document name, so you can tell tabs apart. MarkoPad picks the name in this order:

1. the name of the file you opened;
2. the first heading in the text;
3. the first line of the text;
4. "Untitled" and the time the tab was started.

A dot in front of the name (●) means there are changes you have not downloaded.

## What is kept, and what is not

MarkoPad stores no document permanently. There is no document list, no history and no account.

Two things protect you from losing work by accident:

- **The leaving warning.** If you close or leave a tab with unsaved changes, the browser asks whether you really want to leave. The browser chooses the wording. Some phone browsers do not show this warning at all.
- **The recovery copy.** While a tab is open, it keeps a copy of its own text so that a reload or a browser crash does not lose it. The copy is discarded when the tab is closed.

"Unsaved" means you have edited the text since you last opened a file, downloaded the Markdown file, or pressed New. Pasting a document into an empty page so you can read it does not count as an edit.

Things to know about the recovery copy:

- While the tab is open, the browser writes the copy into its own profile on this device's disk.
- If you close a tab and then use the browser's "reopen closed tab", the text may come back.
- A private or incognito window leaves nothing behind once it is closed.
- **New** wipes the text and its recovery copy at once.
- A very large document may not fit. The bottom line then says the recovery copy is off, and everything else keeps working.

The **Download → Markdown file** button is the only real way to keep a document.

## Links

A Markdown link can show one address and lead to another. To protect you, MarkoPad does the following.

- **It asks before opening any link.** The question shows the site the link really goes to, in large type, and the full address beneath it.
- **It shows the real destination** when you point at a link or move to it with the keyboard. Any tooltip supplied by the document is thrown away.
- **It marks suspicious links** with a warning sign (⚠) when:
  - the visible text names one site but the link goes to another;
  - the site name uses lookalike letters from another alphabet;
  - the link goes to a bare numeric address;
  - the address hides a name in front of an `@` sign.
- Only web links and email links work. Anything else is shown as plain text.
- A link opens in a new tab that cannot reach back into MarkoPad, and the site is not told where you came from.

MarkoPad cannot tell you whether a site is trustworthy. Checking that would mean sending your links to an outside service. Read the site name in the question before you press Open.

Try it. This link claims to go to one site and goes to another: [https://www.example.com](https://example.org/somewhere-else)

## Remote images and your privacy

**Loading an image from another site tells that site your network address, what browser you use, and the moment you opened the document.** Someone who sends you a document can use an image this way to learn that you read it, and roughly where you are.

For that reason MarkoPad blocks remote images until you choose otherwise. Each blocked image is replaced by a box naming the site it would come from. You can then:

- **Load** that one image;
- **Load all from that site**, which loads every image in the document that comes from exactly the same site name;
- **Load all**, at the top of the preview, for every image in the document.

Your choice applies to this document in this tab only. Opening another document clears it.

**Changing your mind.** While remote images are showing, the bar at the top of the preview says how many and offers **Block again**. That removes them from view and forgets which sites you allowed, so nothing more is loaded. It cannot take back what has already happened: a site that sent you an image has already seen your address.

Images that are embedded inside the document itself need no network and are always shown.

Here is a remote image to try it with:

![A sample remote picture](https://example.com/sample-picture.png)

## Markdown reference

MarkoPad uses GitHub-Flavored Markdown. The **How do I…?** panel has every item below with an Insert button.

### Text

| To get | Type |
| --- | --- |
| **Bold** | `**Bold**` |
| *Italic* | `*Italic*` |
| ~~Crossed out~~ | `~~Crossed out~~` |
| `Code` | `` `Code` `` |
| A [link](https://example.com) | `[link](https://example.com)` |
| <kbd>Ctrl</kbd> | `<kbd>Ctrl</kbd>` |
| <mark>Highlight</mark> | `<mark>Highlight</mark>` |
| H<sub>2</sub>O, x<sup>2</sup> | `H<sub>2</sub>O, x<sup>2</sup>` |

### Headings

```
# Biggest heading
## Second level
### Third level
```

### Lists

- A bulleted item starts with a hyphen and a space.
- Another item.
    - Indent to put a list inside a list.

1. A numbered item starts with a number, a full stop and a space.
2. Another step.

- [x] A finished task
- [ ] A task still to do

Press Enter inside a list and MarkoPad starts the next item for you. Press Enter on an empty item to end the list.

### Quotations

> Start each line with a greater-than sign.

### Code blocks

Put three backticks on the line before and the line after:

```
anything in here is shown exactly as typed
```

### Tables

```
| Name | Role     |
| ---- | -------- |
| Ada  | Engineer |
```

| Name | Role     |
| ---- | -------- |
| Ada  | Engineer |

### Dividing line

Three hyphens on a line of their own:

---

### Things MarkoPad leaves out on purpose

Colours, fonts, sizes and positioning written into a document are removed, so that a document from someone else cannot disguise itself or cover MarkoPad's own controls. Scripts, forms and embedded pages are removed for the same reason. Footnotes, math and diagrams are not part of this version.

## Keyboard

| Keys | Action |
| --- | --- |
| <kbd>Ctrl</kbd> + <kbd>O</kbd> | Open a file |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Download the Markdown file |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | Print the formatted document |
| <kbd>Tab</kbd> | Indent the current line or the selected lines |
| <kbd>Shift</kbd> + <kbd>Tab</kbd> | Remove one level of indent |
| <kbd>Esc</kbd> then <kbd>Tab</kbd> | Leave the text pane with the keyboard |
| <kbd>Esc</kbd> | Close a menu, a question or the How do I…? panel |

On a Mac, use <kbd>⌘</kbd> in place of <kbd>Ctrl</kbd>. Undo, redo, find and spell check are the browser's own and work as they do in any text box.

## Hosting MarkoPad, or running it from a disk

MarkoPad is one file, `index.html`. Everything it needs is inside that file.

- **On a web server.** Put the file in any folder that a web server serves. There is nothing to install, build or configure. On StartOS, put it in a folder and point Start9 Pages at that folder.
- **From a disk.** Double-click the file. It opens in your browser and works with no web server and no internet connection.

The server that hands out the file learns only that the page was fetched. It never receives a document, and the page contains no way to send one. The page also carries a rule that tells the browser to refuse any data connection, so this does not depend on trusting the page alone. You can check it yourself: open the browser's developer tools, choose the Network tab, and use MarkoPad. Nothing appears after the page itself, apart from any image you chose to load.

**Secure pages.** Browsers allow full clipboard access only on a page served over HTTPS, or opened from a disk or from `localhost`. On a plain `http://` address MarkoPad falls back to an older copying method, and tells you if that fails.

## Limits worth knowing

- The two panes scroll together by proportion. In a document with long tables or many images they may be a little out of step.
- Checkboxes in the preview are for display. Change `[ ]` to `[x]` in the text to tick one.
- A link or an image with no site name in its address, such as `pictures/cat.png`, has nothing to be found relative to, so it is shown as unavailable.
- Documents of a few hundred kilobytes, which is hundreds of pages, stay smooth. A 1 MB document opens and works, but typing can lag on a slower device, because browsers themselves slow down with that much text in one box.
- JavaScript must be on. With a browser set to block it, such as Tor Browser at its Safest level, MarkoPad cannot work.

## About

MarkoPad {{VERSION}}. Free software under the MIT license.

It includes two open-source libraries, copied into the file rather than loaded from elsewhere:

- **marked**, which turns Markdown into HTML. MIT license.
- **DOMPurify**, which removes anything unsafe from that HTML. Used under the Mozilla Public License 2.0; its source is at <https://github.com/cure53/DOMPurify>.
