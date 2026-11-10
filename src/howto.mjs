// The "How do I…?" cheat sheet. Each entry:
//   t     title shown in the panel
//   k     extra search words
//   md    the Markdown shown, copied and inserted
//   demo  optional: Markdown used for the rendered sample instead of md
//   block true when the snippet needs a line of its own
//   note  optional explanation
//   none  true for an effect MarkoPad does not offer (no sample, no Insert)
// A small picture carried inside the address itself, so the sample needs no network.
// Fully percent-encoded: a Markdown image address cannot contain spaces.
const SAMPLE_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" rx="8" fill="#0b5cad"/>' +
  '<circle cx="30" cy="24" r="9" fill="#ffd866"/><path d="M10 52l28-26 18 16 14-10 40 20z" fill="#fff" opacity=".85"/></svg>');

export default [
  { t: 'Heading', k: 'title header h1 h2 h3 section big', block: true,
    md: '# Biggest heading\n\n## Second level\n\n### Third level',
    note: 'One to six # signs, then a space.' },
  { t: 'Bold', k: 'strong heavy thick', md: '**bold text**' },
  { t: 'Italic', k: 'emphasis slanted', md: '*italic text*' },
  { t: 'Bold and italic together', k: 'strong emphasis', md: '***bold and italic***' },
  { t: 'Strikethrough', k: 'cross out crossed delete line through', md: '~~crossed out~~' },
  { t: 'Link', k: 'url hyperlink website web address', md: '[link text](https://example.com)',
    note: 'MarkoPad asks before it opens any link and shows where the link really goes.' },
  { t: 'Link that shows its own address', k: 'autolink bare url plain', md: 'https://example.com' },
  { t: 'Email link', k: 'mailto mail address', md: '<someone@example.com>' },
  { t: 'Link to a heading in this document', k: 'anchor jump contents toc internal', md: '[Jump to the summary](#summary)',
    note: 'After the # write the heading in lower case, with hyphens instead of spaces.' },
  { t: 'Image', k: 'picture photo graphic screenshot',
    md: '![Description of the picture](https://example.com/picture.png)',
    demo: `![Description of the picture](${SAMPLE_IMAGE})`,
    note: 'Pictures on other sites stay blocked until you choose to load them.' },
  { t: 'Bulleted list', k: 'unordered bullets points dots', block: true, md: '- First item\n- Second item\n- Third item' },
  { t: 'Numbered list', k: 'ordered steps sequence', block: true, md: '1. First step\n2. Second step\n3. Third step' },
  { t: 'List inside a list', k: 'nested sub item indent outline', block: true,
    md: '- Fruit\n    - Apple\n    - Pear\n- Vegetables',
    note: 'Indent the inner items. The Tab key indents the line you are on.' },
  { t: 'Checklist', k: 'task list todo to-do checkbox tick box', block: true, md: '- [x] Finished\n- [ ] Still to do' },
  { t: 'Quotation', k: 'block quote blockquote cite indent', block: true, md: '> Quoted text.\n> A second line of it.' },
  { t: 'Code inside a sentence', k: 'inline monospace literal command', md: 'Run `git status` first.' },
  { t: 'Code block', k: 'fenced preformatted monospace snippet program', block: true, md: '```\nfirst line\nsecond line\n```' },
  { t: 'Table', k: 'grid columns rows cells', block: true,
    md: '| Name | Role |\n| --- | --- |\n| Ada | Engineer |\n| Lin | Designer |',
    note: 'The second row of dashes is required. The columns do not need to line up.' },
  { t: 'Table column alignment', k: 'left right center centre', block: true,
    md: '| Left | Centre | Right |\n| :--- | :---: | ---: |\n| a | b | c |' },
  { t: 'Dividing line', k: 'horizontal rule separator hr', block: true, md: '---' },
  { t: 'New paragraph', k: 'blank line spacing gap', block: true, md: 'First paragraph.\n\nSecond paragraph.',
    note: 'Leave one blank line between paragraphs.' },
  { t: 'Line break inside a paragraph', k: 'newline br soft break address poem', md: 'First line\\\nSecond line',
    note: 'End the line with a backslash.' },
  { t: 'Show a symbol instead of formatting', k: 'escape literal asterisk underscore backslash hash', md: '\\*not italic\\* and \\# not a heading' },
  { t: 'Collapsible section', k: 'details summary expand fold spoiler hide', block: true,
    md: '<details>\n<summary>Click to expand</summary>\n\nHidden until opened.\n\n</details>' },
  { t: 'Keyboard key', k: 'kbd shortcut keys', md: 'Press <kbd>Ctrl</kbd> + <kbd>S</kbd>' },
  { t: 'Subscript and superscript', k: 'sub sup small raised lowered power', md: 'H<sub>2</sub>O and x<sup>2</sup>' },
  { t: 'Highlight', k: 'mark marker yellow', md: '<mark>highlighted words</mark>' },
  { t: 'Underline', k: 'underscore ins', md: '<u>underlined words</u>' },
  { t: 'Centred text', k: 'center align middle', block: true, md: '<p align="center">Centred line</p>' },
  { t: 'Hidden note', k: 'comment invisible private remark', block: true, md: '<!-- This note does not appear in the formatted document -->',
    note: 'The note stays in the raw text only.' },
  { t: 'Coloured text, fonts and sizes', k: 'color colour red blue font size style css', none: true,
    note: 'Not available. MarkoPad removes styling from every document, so that a document from someone else cannot disguise itself or cover the page.' },
  { t: 'Footnotes, math and diagrams', k: 'footnote latex equation formula mermaid chart graph', none: true,
    note: 'Not in this version of MarkoPad.' },
];
