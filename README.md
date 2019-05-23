# Convert: a format converter for reproducible documents

[![Build status](https://travis-ci.org/stencila/convert.svg?branch=master)](https://travis-ci.org/stencila/convert)
[![Build status](https://ci.appveyor.com/api/projects/status/f1hx694pxm0fyqni?svg=true)](https://ci.appveyor.com/project/nokome/convert)
[![Code coverage](https://codecov.io/gh/stencila/convert/branch/master/graph/badge.svg)](https://codecov.io/gh/stencila/convert)
[![NPM](https://img.shields.io/npm/v/stencila-convert.svg?style=flat)](https://www.npmjs.com/package/stencila-convert)
[![Contributors](https://img.shields.io/badge/contributors-6-orange.svg)](#contribute)
[![Docs](https://img.shields.io/badge/docs-latest-blue.svg)](https://stencila.github.io/convert/)
[![Chat](https://badges.gitter.im/stencila/stencila.svg)](https://gitter.im/stencila/stencila)

Stencila Converters allow you to convert between a range of formats commonly used for "executable documents" (those containing some type of source code or calculation).

<!-- Automatically generated TOC. Don't edit, `make docs` instead>

<!-- toc -->

- [Status](#status)
  - [Documents, markup, and notebook formats](#documents-markup-and-notebook-formats)
  - [Tabular data and spreadsheet formats](#tabular-data-and-spreadsheet-formats)
  - [Other formats](#other-formats)
- [Demo](#demo)
- [Install](#install)
  - [CLI](#cli)
    - [Windows](#windows)
    - [MacOS](#macos)
    - [Linux](#linux)
  - [Package](#package)
- [Use](#use)
  - [Example](#example)
  - [Help](#help)
- [Develop](#develop)
- [Roadmap](#roadmap)
- [Contribute](#contribute)
- [See also](#see-also)
- [FAQ](#faq)
- [Acknowledgments](#acknowledgments)

<!-- tocstop -->

## Status

The following tables list the status of converters that have been developed, are in development, or are being considered for development.
We'll be developing converters based on demand from users. So if you'd like to see a converter for your favorite format, look at the [listed issues](https://github.com/stencila/convert/issues) and comment under the relevant one. If there is no
issue regarding the converter you need, [create one](https://github.com/stencila/convert/issues/new).

When the converters have been better tested, the plan is to integrate them into [Stencila Desktop](https://github.com/stencila/desktop) as a menu item e.g. `Save as... > Jupyter Notebook`

You can also provide your feedback on the friendly [Stencila Community Forum](https://community.stenci.la)
and [Stencila Gitter channel](https://gitter.im/stencila/stencila).

#### Documents, markup, and notebook formats

| Format     |                           Status                            |
| ---------- | :---------------------------------------------------------: |
| Markdown   | ![alpha](https://img.shields.io/badge/status-alpha-red.svg) |
| RMarkdown  | ![alpha](https://img.shields.io/badge/status-alpha-red.svg) |
| Latex      | ![alpha](https://img.shields.io/badge/status-alpha-red.svg) |
| HTML       | ![alpha](https://img.shields.io/badge/status-alpha-red.svg) |
| PDF        |                              -                              |
| Google Doc | ![alpha](https://img.shields.io/badge/status-alpha-red.svg) |

#### Tabular data and spreadsheet formats

| Format                                                                          |                           Status                            |
| ------------------------------------------------------------------------------- | :---------------------------------------------------------: |
| CSV                                                                             | ![alpha](https://img.shields.io/badge/status-alpha-red.svg) |
| Yaml front matter for CSV [CSVY](http://csvy.org/)                              |    [#25](https://github.com/stencila/convert/issues/25)     |
| Excel (.xlsx)                                                                   | ![alpha](https://img.shields.io/badge/status-alpha-red.svg) |
| OpenDocument Spreadsheet                                                        | ![alpha](https://img.shields.io/badge/status-alpha-red.svg) |
| [Tabular Data Package](https://frictionlessdata.io/specs/tabular-data-package/) | ![alpha](https://img.shields.io/badge/status-alpha-red.svg) |

#### Other formats

| Format                                                                                 |                           Status                            |
| -------------------------------------------------------------------------------------- | :---------------------------------------------------------: |
| Reproducible PNG ([rPNG](https://github.com/stencila/convert/blob/master/src/rpng.ts)) | ![alpha](https://img.shields.io/badge/status-alpha-red.svg) |

## Demo

> :sparkles: Coming soon!

## Install

Convert is available as a pre-compiled, standalone command line tool ([CLI](#cli)), or as a Node.js [package](#package).

### CLI

#### Windows

To install the latest release of the `convert` command line tool, download `convert-win-x64.zip` for the [latest release](https://github.com/stencila/convert/releases/) and place it somewhere on your `PATH`.

#### MacOS

To install the latest release of the `convert` command line tool to `/usr/local/bin` just use,

```bash
curl -L https://raw.githubusercontent.com/stencila/convert/master/install.sh | bash
```

To install a specific version, append `-s vX.X.X` e.g.

```bash
curl -L https://raw.githubusercontent.com/stencila/convert/master/install.sh | bash -s v0.33.0
```

Or, if you'd prefer to do things manually, download `convert-macos-x64.tar.gz` for the [latest release](https://github.com/stencila/convert/releases/) and then,

```bash
tar xvf convert-macos-x64.tar.gz
sudo mv -f stencila-convert /usr/local/bin # or wherever you like
```

#### Linux

To install the latest release of the `convert` command line tool to `~/.local/bin/` just use,

```bash
curl -L https://raw.githubusercontent.com/stencila/convert/master/install.sh | bash
```

To install a specific version, append `-s vX.X.X` e.g.

```bash
curl -L https://raw.githubusercontent.com/stencila/convert/master/install.sh | bash -s v0.33.0
```

Or, if you'd prefer to do things manually, or place Convert elsewhere, download `convert-linux-x64.tar.gz` for the [latest release](https://github.com/stencila/convert/releases/) and then,

```bash
tar xvf convert-linux-x64.tar.gz
mv -f stencila-convert ~/.local/bin/ # or wherever you like
```

### Package

If you want to integrate Convert into another application or package, it is also available as a Node.js package :

```bash
npm install stencila-convert
```

## Use

### Example

```bash
stencila-convert document.md document.jats.xml
```

You can use the `--from` and `--to` flag options to explicitly specify formats. For example,

| Option      | Description                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------- |
| `--to yaml` | Convert into YAML format of [Stencila Schema](https://github.com/stencila/schema) JSON.            |
| `--to tdp`  | Convert into [Tabular Data Package](https://frictionlessdata.io/specs/tabular-data-package/) JSON. |

### Help

To get an overview of the commands available use the `--help` option i.e.

```bash
stencila-convert --help
```

API documentation is available at https://stencila.github.io/convert.

## Develop

Check how to [contribute back to the project](https://github.com/stencila/convert/blob/master/CONTRIBUTING.md). All PRs are most welcome! Thank you!

Clone the repository and install a development environment:

```bash
git clone https://github.com/stencila/convert.git
cd convert
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
npx ts-node --files src/cli tests/fixtures/datatable/simple/simple.csv --to yaml
```

If that is a bit slow, compile the Typescript to Javascript first and use `node` directly:

```bash
npm run build:ts
node dist/cli tests/fixtures/datatable/simple/simple.csv --to yaml
```

There's also a `Makefile` if you prefer to run tasks that way e.g.

```bash
make lint cover check
```

You can also test using the Docker image for a self-contained, host-independent test environment:

```bash
docker build --tag stencila/convert .
docker run stencila/convert
```

## Roadmap

> :sparkles: Coming soon!

## Contribute

We 💕 contributions! All contributions: ideas 🤔, examples 💡, bug reports 🐛, documentation 📖, code 💻, questions 💬. See [CONTRIBUTING.md](CONTRIBUTING.md) for more on where to start.

We recognize [all contributors](https://allcontributors.org/) - including those that don't push code! ✨

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore -->
<table><tr><td align="center"><a href="http://stenci.la"><img src="https://avatars2.githubusercontent.com/u/2358535?v=4" width="50px;" alt="Aleksandra Pawlik"/><br /><sub><b>Aleksandra Pawlik</b></sub></a><br /><a href="https://github.com/stencila/convert/commits?author=apawlik" title="Code">💻</a> <a href="https://github.com/stencila/convert/commits?author=apawlik" title="Documentation">📖</a> <a href="https://github.com/stencila/convert/issues?q=author%3Aapawlik" title="Bug reports">🐛</a></td><td align="center"><a href="https://github.com/nokome"><img src="https://avatars0.githubusercontent.com/u/1152336?v=4" width="50px;" alt="Nokome Bentley"/><br /><sub><b>Nokome Bentley</b></sub></a><br /><a href="https://github.com/stencila/convert/commits?author=nokome" title="Code">💻</a> <a href="https://github.com/stencila/convert/commits?author=nokome" title="Documentation">📖</a> <a href="https://github.com/stencila/convert/issues?q=author%3Anokome" title="Bug reports">🐛</a></td><td align="center"><a href="http://toki.io"><img src="https://avatars1.githubusercontent.com/u/10161095?v=4" width="50px;" alt="Jacqueline"/><br /><sub><b>Jacqueline</b></sub></a><br /><a href="https://github.com/stencila/convert/commits?author=jwijay" title="Documentation">📖</a> <a href="#design-jwijay" title="Design">🎨</a></td><td align="center"><a href="https://github.com/hamishmack"><img src="https://avatars2.githubusercontent.com/u/620450?v=4" width="50px;" alt="Hamish Mackenzie"/><br /><sub><b>Hamish Mackenzie</b></sub></a><br /><a href="https://github.com/stencila/convert/commits?author=hamishmack" title="Code">💻</a> <a href="https://github.com/stencila/convert/commits?author=hamishmack" title="Documentation">📖</a></td><td align="center"><a href="http://ketch.me"><img src="https://avatars2.githubusercontent.com/u/1646307?v=4" width="50px;" alt="Alex Ketch"/><br /><sub><b>Alex Ketch</b></sub></a><br /><a href="https://github.com/stencila/convert/commits?author=alex-ketch" title="Code">💻</a> <a href="https://github.com/stencila/convert/commits?author=alex-ketch" title="Documentation">📖</a> <a href="#design-alex-ketch" title="Design">🎨</a></td><td align="center"><a href="https://github.com/beneboy"><img src="https://avatars1.githubusercontent.com/u/292725?v=4" width="50px;" alt="Ben Shaw"/><br /><sub><b>Ben Shaw</b></sub></a><br /><a href="https://github.com/stencila/convert/commits?author=beneboy" title="Code">💻</a> <a href="https://github.com/stencila/convert/issues?q=author%3Abeneboy" title="Bug reports">🐛</a></td></tr></table>

<!-- ALL-CONTRIBUTORS-LIST:END -->

## See also

> :sparkles: Coming soon!

## FAQ

> :sparkles: Coming soon!

## Acknowledgments

Convert relies on many awesome opens source tools (see `package.json` for the complete list). We are grateful ❤ to their developers and contributors for all their time and energy. In particular, these tools do a lot of the heavy lifting 💪 under the hood.

|                                                                                                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Ajv](https://ajv.js.org/images/ajv_logo.png)                                                                     | [Ajv](https://ajv.js.org/) is "the fastest JSON Schema validator for Node.js and browser". Ajv is not only fast, it also has an impressive breadth of functionality. We use Ajv for the `validate()` and `coerce()` functions to ensure that ingested data is valid against the Stencila [schema](https://github.com/stencila/schema).                                                                                                                                                                                                                                                                         |
| ![Frictionless Data](https://avatars0.githubusercontent.com/u/5912125?s=200&v=4)                                   | [`datapackage-js`](https://github.com/frictionlessdata/datapackage-js) from the team at [Frictionless Data](https://frictionlessdata.io/) is a Javascript library for working with [Data Packages](https://frictionlessdata.io/specs/data-package/). It does a lot of the work in converting between Tabular Data Packages and Stencila Datatables.                                                                                                                                                                                                                                                            |
| **Pandoc**                                                                                                         | [Pandoc](https://pandoc.org/) is a "universal document converter". It's able to convert between an impressive number of formats for textual documents. Our [Typescript definitions for Pandoc's AST](https://github.com/stencila/convert/blob/c400d798e6b54ea9f88972b038489df79e38895b/src/pandoc-types.ts) allow us to leverage this functionality from within Node.js while maintaining type safety. Pandoc powers our converters for Word, JATS and Latex. We have contributed to Pandoc, including developing it [JATS reader](https://github.com/jgm/pandoc/blob/master/src/Text/Pandoc/Readers/JATS.hs). |
| ![Puppeteer](https://user-images.githubusercontent.com/10379601/29446482-04f7036a-841f-11e7-9872-91d1fc2ea683.png) | [Puppeteer](https://pptr.dev/) is a Node library which provides a high-level API to control Chrome. We use it to take screenshots of HTML snippets as part of generating rPNGs and we plan to use it for [generating PDFs](https://github.com/stencila/convert/issues/53).                                                                                                                                                                                                                                                                                                                                     |
| ![Remark](https://avatars2.githubusercontent.com/u/16309564?s=200&v=4)                                             | [`Remark`](https://remark.js.org/) is an ecosystem of plugins for processing Markdown. It's part of the [unified](https://unifiedjs.github.io/) framework for processing text with syntax trees - a similar approach to Pandoc but in Javascript. We use Remark as our Markdown parser because of it's extensibility.                                                                                                                                                                                                                                                                                          |
| ![SheetJs](https://sheetjs.com/sketch128.png)                                                                      | [SheetJs](https://sheetjs.com) is a Javascript library for parsing and writing various spreadhseet formats. We use their [community edition](https://github.com/sheetjs/js-xlsx) to power converters for CSV, Excel, and Open Document Spreadsheet formats. They also have a [pro version](https://sheetjs.com/pro) if you need extra support and functionality.                                                                                                                                                                                                                                               |

Many thanks ❤ to the [Alfred P. Sloan Foundation](https://sloan.org) and [eLife](https://elifesciences.org) for funding development of this tool.

<p align="left">
  <img width="250" src="https://sloan.org/storage/app/media/Logos/Sloan-Logo-stacked-black-web.png">
  <img width="250" src="https://www.force11.org/sites/default/files/elife-full-color-horizontal.png">
</p>
