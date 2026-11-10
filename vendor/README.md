# Bundled libraries

These two files are copied into `dist/index.html` by `build.mjs`. They are the files published on
npm, unmodified. The build refuses to run if either file's SHA-256 differs from the value below.

| File | Package | Version | License used | SHA-256 |
| --- | --- | --- | --- | --- |
| `marked.umd.js` | [marked](https://github.com/markedjs/marked) | 18.1.3 (`lib/marked.umd.js`) | MIT, see `marked.LICENSE` | `c34a221dc89e91833a88822e7717b8a0cf27118f8c9a8779dffb48a6be31f97a` |
| `purify.min.js` | [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.17 (`dist/purify.min.js`) | MPL-2.0, see `dompurify.LICENSE-MPL`. It is offered under Apache-2.0 or MPL-2.0; `dompurify.LICENSE-APACHE` is included too. | `cd37898f9782adf54820c413191b5691803f0f137c799d6edcfd38523b4c2c31` |

## Updating a library

DOMPurify is the security boundary of this project, so keep it current.

1. Download the new package and check it against the hash npm publishes:
   `npm pack dompurify@<version>` then compare `npm view dompurify@<version> dist.integrity`
   with `openssl dgst -sha512 -binary dompurify-<version>.tgz | base64 -w0`.
2. Copy the one file named in the table over the file here, and its license files if they changed.
3. Put the new `sha256sum` in this table and in the `VENDOR` list in `build.mjs`, and the new
   version number in the license comment there.
4. Run `npm test`. Every test must pass, the hostile-document test above all.
