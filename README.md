# Encoda

[![Build status](https://travis-ci.org/stencila/encoda.svg?branch=master)](https://travis-ci.org/stencila/encoda)
[![Build status](https://ci.appveyor.com/api/projects/status/f1hx694pxm0fyqni/branch/master?svg=true)](https://ci.appveyor.com/project/nokome/encoda)
[![Code coverage](https://codecov.io/gh/stencila/encoda/branch/master/graph/badge.svg)](https://codecov.io/gh/stencila/encoda)
[![NPM](https://img.shields.io/npm/v/@stencila/encoda.svg?style=flat)](https://www.npmjs.com/package/@stencila/encoda)
[![Contributors](https://img.shields.io/badge/contributors-6-orange.svg)](#contribute)
[![Docs](https://img.shields.io/badge/docs-latest-blue.svg)](https://stencila.github.io/encoda/)
[![Chat](https://badges.gitter.im/stencila/stencila.svg)](https://gitter.im/stencila/stencila) [![Greenkeeper badge](https://badges.greenkeeper.io/stencila/encoda.svg)](https://greenkeeper.io/)

Encoda allows you to convert between a range of formats commonly used for "executable documents" (those containing some type of source code or calculation).

<!-- Automatically generated TOC. Don't edit, `make docs` instead>

<!-- toc -->

- [Formats](#formats)
- [Install](#install)
- [Use](#use)
- [Develop](#develop)
- [Contribute](#contribute)
- [Contributors](#contributors)
- [Acknowledgments](#acknowledgments)

<!-- tocstop -->

## Formats

| Format                    | Name         | Approach | Status | Issues             | Coverage        |
| ------------------------- | ------------ | -------- | ------ | ------------------ | --------------- |
| **Text**                  |
| Plain text                | `txt`        | None     | α      | [⚠][txt-issues]    | ![][txt-cov]    |
| Markdown                  | `md`         | Extens   | α      | [⚠][md-issues]     | ![][md-cov]     |
| Latex                     | `tex`        | -        | α      | [⚠][tex-issues]    | ![][latex-cov]  |
| Microsoft Word            | `docx`       | rPNG     | α      | [⚠][docx-issues]   | ![][docx-cov]   |
| Google Docs               | `gdoc`       | rPNG     | α      | [⚠][gdoc-issues]   | ![][gdoc-cov]   |
| Open Document Text        | `odt`        | rPNG     | α      | [⚠][odt-issues]    | ![][odt-cov]    |
| HTML                      | `html`       | Extens   | α      | [⚠][html-issues]   | ![][html-cov]   |
| Journal Archiving Tag Set | `jats`       | Extens   | α      | [⚠][jats-issues]   | ![][jats-cov]   |
| Portable Document Format  | `pdf`        | rPNG     | α      | [⚠][pdf-issues]    | ![][pdf-cov]    |
| **Notebooks**             |
| Jupyter                   | `ipynb`      | Native   | α      | [⚠][ipynb-issues]  | ![][ipynb-cov]  |
| RMarkdown                 | `rmd`, `xmd` | Native   | α      | [⚠][rmd-issues]    | ![][xmd-cov]    |
| **Presentations**         |
| Microsoft Powerpoint      | `pptx`       | rPNG     | ✗      | [⚠][pptx-issues]   |
| Demo Magic                | `dmagic`     | Native   | β      | [⚠][dmagic-issues] | ![][dmagic-cov] |
| **Spreadsheets**          |
| Microsoft Excel           | `xlsx`       | Formula  | α      | [⚠][xlsx-issues]   | ![][xlsx-cov]   |
| Google Sheets             | `gsheet`     | Formula  | ✗      | [⚠][gsheet-issues] |
| Open Document Spreadsheet | `ods`        | Formula  | α      | [⚠][ods-issues]    | ![][ods-cov]    |
| **Tabular data**          |
| CSV                       | `csv`        | None     | β      | [⚠][csv-issues]    | ![][csv-cov]    |
| [CSVY]                    | `csvy`       | None     | ✗      | [⚠][csvy-issues]   |
| [Tabular Data Package]    | `tdp`        | None     | β      | [⚠][tdp-issues]    | ![][tdp-cov]    |
| **Collections**           |
| Document Archive          | `dar`        | Extens   | ω      | [⚠][dar-issues]    | ![][dar-cov]    |
| Filesystem Directory      | `dir`        | Extens   | ω      | [⚠][dir-issues]    | ![][dir-cov]    |
| **Data interchange**      |
| JSON                      | `json`       | Native   | ✔      | [⚠][json-issues]   | ![][json-cov]   |
| JSON5                     | `json5`      | Native   | ✔      | [⚠][json5-issues]  | ![][json5-cov]  |
| YAML                      | `yaml`       | Native   | ✔      | [⚠][yaml-issues]   | ![][yaml-cov]   |

**Key**

<details>
<summary><b id="format-approach">Approach</b>...</summary>
How executable nodes (e.g. `CodeChunk` and `CodeExpr` nodes) are represented

- Native: the format natively supports executable nodes
- Extens.: executable nodes are supported via extensions to the format e.g. in HTML and DAR, a `CodeChunk` is represented using a `<stencila-chunk>` element
- rPNG: executable nodes are supported via reproducible PNG images inserted into the document
- Formula: executable `CodeExpr` nodes are represented using formulae
  </details>

<details>
<summary><b id="format-status">Status</b>...</summary>

- ✗: Not yet implemented
- ω: Work in progress
- α: Alpha, initial implementation
- β: Beta, ready for user testing
- ✔: Ready for production use
  </details>

<details>
<summary><b id="format-issues">Issues</b>...</summary>
Link to open issues and PRs for the format (please check there before submitting a new issue 🙏)
</details>

If you'd like to see a converter for your favorite format, look at the [listed issues](https://github.com/stencila/encoda/issues) and comment under the relevant one. If there is no issue regarding the converter you need, [create one](https://github.com/stencila/encoda/issues/new).

## Install

```bash
npm install @stencila/encoda --global
```

## Use

```bash
encoda convert document.md document.jats.xml
```

You can use the `--from` and `--to` flag options to explicitly specify formats. For example,

| Option      | Description                                                                             |
| ----------- | --------------------------------------------------------------------------------------- |
| `--to yaml` | Convert into YAML format of [Stencila Schema](https://github.com/stencila/schema) JSON. |
| `--to tdp`  | Convert into [Tabular Data Package] JSON.                                               |

API documentation is available at https://stencila.github.io/encoda.

## Develop

Check how to [contribute back to the project](https://github.com/stencila/encoda/blob/master/CONTRIBUTING.md). All PRs are most welcome! Thank you!

Clone the repository and install a development environment:

```bash
git clone https://github.com/stencila/encoda.git
cd encoda
npm install
```

Run the test suite:

```bash
npm test
```

Or, run a single test file:

```bash
npx jest tests/xlsx.test.ts
```

To get coverage statistics:

```bash
npm run cover
```

Or, manually test conversion using the `ts-node` and the `cli.ts` script:

```bash
npx ts-node --files src/cli convert simple.md simple.html
```

If that is a bit slow, compile the Typescript to Javascript first and use `node` directly:

```bash
npm run build
node dist/cli convert simple.md simple.html
```

There's also a `Makefile` if you prefer to run tasks that way e.g.

```bash
make lint cover check
```

You can also test using the Docker image for a self-contained, host-independent test environment:

```bash
docker build --tag stencila/encoda .
docker run stencila/encoda
```

## Contribute

We 💕 contributions! All contributions: ideas 🤔, examples 💡, bug reports 🐛, documentation 📖, code 💻, questions 💬. See [CONTRIBUTING.md](CONTRIBUTING.md) for more on where to start. You can also provide your feedback on the [Community Forum](https://community.stenci.la)
and [Gitter channel](https://gitter.im/stencila/stencila).

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore -->
<table><tr><td align="center"><a href="http://stenci.la"><img src="https://avatars2.githubusercontent.com/u/2358535?v=4" width="50px;" alt="Aleksandra Pawlik"/><br /><sub><b>Aleksandra Pawlik</b></sub></a><br /><a href="https://github.com/stencila/encoda/commits?author=apawlik" title="Code">💻</a> <a href="https://github.com/stencila/encoda/commits?author=apawlik" title="Documentation">📖</a> <a href="https://github.com/stencila/encoda/issues?q=author%3Aapawlik" title="Bug reports">🐛</a></td><td align="center"><a href="https://github.com/nokome"><img src="https://avatars0.githubusercontent.com/u/1152336?v=4" width="50px;" alt="Nokome Bentley"/><br /><sub><b>Nokome Bentley</b></sub></a><br /><a href="https://github.com/stencila/encoda/commits?author=nokome" title="Code">💻</a> <a href="https://github.com/stencila/encoda/commits?author=nokome" title="Documentation">📖</a> <a href="https://github.com/stencila/encoda/issues?q=author%3Anokome" title="Bug reports">🐛</a></td><td align="center"><a href="http://toki.io"><img src="https://avatars1.githubusercontent.com/u/10161095?v=4" width="50px;" alt="Jacqueline"/><br /><sub><b>Jacqueline</b></sub></a><br /><a href="https://github.com/stencila/encoda/commits?author=jwijay" title="Documentation">📖</a> <a href="#design-jwijay" title="Design">🎨</a></td><td align="center"><a href="https://github.com/hamishmack"><img src="https://avatars2.githubusercontent.com/u/620450?v=4" width="50px;" alt="Hamish Mackenzie"/><br /><sub><b>Hamish Mackenzie</b></sub></a><br /><a href="https://github.com/stencila/encoda/commits?author=hamishmack" title="Code">💻</a> <a href="https://github.com/stencila/encoda/commits?author=hamishmack" title="Documentation">📖</a></td><td align="center"><a href="http://ketch.me"><img src="https://avatars2.githubusercontent.com/u/1646307?v=4" width="50px;" alt="Alex Ketch"/><br /><sub><b>Alex Ketch</b></sub></a><br /><a href="https://github.com/stencila/encoda/commits?author=alex-ketch" title="Code">💻</a> <a href="https://github.com/stencila/encoda/commits?author=alex-ketch" title="Documentation">📖</a> <a href="#design-alex-ketch" title="Design">🎨</a></td><td align="center"><a href="https://github.com/beneboy"><img src="https://avatars1.githubusercontent.com/u/292725?v=4" width="50px;" alt="Ben Shaw"/><br /><sub><b>Ben Shaw</b></sub></a><br /><a href="https://github.com/stencila/encoda/commits?author=beneboy" title="Code">💻</a> <a href="https://github.com/stencila/encoda/issues?q=author%3Abeneboy" title="Bug reports">🐛</a></td><td align="center"><a href="http://humanrights.washington.edu"><img src="https://avatars2.githubusercontent.com/u/16355618?v=4" width="50px;" alt="Phil Neff"/><br /><sub><b>Phil Neff</b></sub></a><br /><a href="https://github.com/stencila/encoda/issues?q=author%3Aphilneff" title="Bug reports">🐛</a></td></tr><tr><td align="center"><a href="https://people.unipi.it/lorenzo_cangiano/"><img src="https://avatars1.githubusercontent.com/u/11914162?v=4" width="50px;" alt="Lorenzo Cangiano"/><br /><sub><b>Lorenzo Cangiano</b></sub></a><br /><a href="https://github.com/stencila/encoda/issues?q=author%3Alollopus" title="Bug reports">🐛</a></td></tr></table>

<!-- ALL-CONTRIBUTORS-LIST:END -->

<details>
<summary><b id="format-approach">Add a contributor</b>...</summary>

To add youself, or someone else, to the above list, either,

1. Ask the [@all-contributors bot](https://allcontributors.org/docs/en/bot/overview) to do it for you by commenting on an issue or PR like this:

   > @all-contributors please add @octocat for bugs, tests and code

2. Use the [`all-contributors` CLI](https://allcontributors.org/docs/en/cli/overview) to do it yourself:

   ```bash
   npx all-contributors add octocat bugs, tests, code
   ```

See the list of [contribution types](https://allcontributors.org/docs/en/emoji-key).

</details>

## Acknowledgments

Encoda relies on many awesome opens source tools (see `package.json` for the complete list). We are grateful ❤ to their developers and contributors for all their time and energy. In particular, these tools do a lot of the heavy lifting 💪 under the hood.

| Tool                                                                                                               | Use                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Ajv](https://ajv.js.org/images/ajv_logo.png)                                                                     | [Ajv](https://ajv.js.org/) is "the fastest JSON Schema validator for Node.js and browser". Ajv is not only fast, it also has an impressive breadth of functionality. We use Ajv for the `validate()` and `coerce()` functions to ensure that ingested data is valid against the Stencila [schema](https://github.com/stencila/schema).                                                                                                                                                                                                                                                                         |
| ![Frictionless Data](https://avatars0.githubusercontent.com/u/5912125?s=200&v=4)                                   | [`datapackage-js`](https://github.com/frictionlessdata/datapackage-js) from the team at [Frictionless Data](https://frictionlessdata.io/) is a Javascript library for working with [Data Packages](https://frictionlessdata.io/specs/data-package/). It does a lot of the work in converting between Tabular Data Packages and Stencila Datatables.                                                                                                                                                                                                                                                            |
| **Pandoc**                                                                                                         | [Pandoc](https://pandoc.org/) is a "universal document converter". It's able to convert between an impressive number of formats for textual documents. Our [Typescript definitions for Pandoc's AST](https://github.com/stencila/encoda/blob/c400d798e6b54ea9f88972b038489df79e38895b/src/pandoc-types.ts) allow us to leverage this functionality from within Node.js while maintaining type safety. Pandoc powers our converters for Word, JATS and Latex. We have contributed to Pandoc, including developing its [JATS reader](https://github.com/jgm/pandoc/blob/master/src/Text/Pandoc/Readers/JATS.hs). |
| ![Puppeteer](https://user-images.githubusercontent.com/10379601/29446482-04f7036a-841f-11e7-9872-91d1fc2ea683.png) | [Puppeteer](https://pptr.dev/) is a Node library which provides a high-level API to control Chrome. We use it to take screenshots of HTML snippets as part of generating rPNGs and we plan to use it for [generating PDFs](https://github.com/stencila/encoda/issues/53).                                                                                                                                                                                                                                                                                                                                      |
| ![Remark](https://avatars2.githubusercontent.com/u/16309564?s=200&v=4)                                             | [`Remark`](https://remark.js.org/) is an ecosystem of plugins for processing Markdown. It's part of the [unified](https://unifiedjs.github.io/) framework for processing text with syntax trees - a similar approach to Pandoc but in Javascript. We use Remark as our Markdown parser because of it's extensibility.                                                                                                                                                                                                                                                                                          |
| ![SheetJs](https://sheetjs.com/sketch128.png)                                                                      | [SheetJs](https://sheetjs.com) is a Javascript library for parsing and writing various spreadhseet formats. We use their [community edition](https://github.com/sheetjs/js-xlsx) to power converters for CSV, Excel, and Open Document Spreadsheet formats. They also have a [pro version](https://sheetjs.com/pro) if you need extra support and functionality.                                                                                                                                                                                                                                               |

Many thanks ❤ to the [Alfred P. Sloan Foundation](https://sloan.org) and [eLife](https://elifesciences.org) for funding development of this tool.

<p align="left">
  <img width="250" src="https://sloan.org/storage/app/media/Logos/Sloan-Logo-stacked-black-web.png">
  <img width="250" src="https://www.force11.org/sites/default/files/elife-full-color-horizontal.png">
</p>

[csvy]: http://csvy.org/
[csvy-issue]: https://github.com/stencila/encoda/issues/26
[dar]: https://github.com/substance/dar
[dar-pr]: https://github.com/stencila/encoda/pull/124
[tabular data package]: https://frictionlessdata.io/specs/tabular-data-package/
[csv-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/csv
[csv-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+csv
[csvy-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/csvy
[csvy-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+csvy
[dar-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/dar
[dar-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+dar
[dir-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/dir
[dir-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+dir
[dmagic-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/dmagic
[dmagic-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+dmagic
[docx-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/docx
[docx-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+docx
[gdoc-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/gdoc
[gdoc-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+gdoc
[gsheet-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/gsheet
[gsheet-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+gsheet
[html-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/html
[html-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+html
[ipynb-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/ipynb
[ipynb-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+ipynb
[jats-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/jats
[jats-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+jats
[json-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/json
[json-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+json
[json5-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/json5
[json5-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+json5
[latex-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/latex
[md-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/md
[md-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+markdown
[ods-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/ods
[ods-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+ods
[odt-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/odt
[odt-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+odt
[pdf-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/pdf
[pdf-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+pdf
[pptx-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/pptx
[pptx-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+pptx
[xmd-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/xmd
[rmd-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+rmd
[tdp-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/tdp
[tdp-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+tdp
[tex-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+tex
[txt-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/txt
[txt-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+txt
[xlsx-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/xlsx
[xlsx-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+xlsx
[yaml-cov]: https://badger.nokome.now.sh/codecov-folder/stencila/encoda/src/codecs/yaml
[yaml-issues]: https://github.com/stencila/encoda/issues?q=is%3Aopen+yaml
