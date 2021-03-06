/**
 * @module html
 */

import { getLogger } from '@stencila/logga'
// eslint-disable-next-line import/no-duplicates
import * as stencila from '@stencila/schema'
import {
  isA,
  isArticle,
  isCreativeWork,
  isInlineContent,
  markTypes,
  microdata,
  microdataItemtype,
  microdataRoot,
  microdataType,
  nodeType,
  thematicBreak,
  microdataProperty
  // eslint-disable-next-line import/no-duplicates
} from '@stencila/schema'
import collapse from 'collapse-whitespace'
import escape from 'escape-html'
import { flatten, isNonEmpty } from 'fp-ts/lib/Array'
// @ts-ignore
import GithubSlugger from 'github-slugger'
import h from 'hyperscript'
import { html as beautifyHtml } from 'js-beautify'
import jsdom from 'jsdom'
import JSON5 from 'json5'
// @ts-ignore
import MathJax from 'mathjax-node'
import { VFileContents } from 'vfile'
import { columnIndexToName } from '../../codecs/xlsx'
import { logWarnLossIfAny } from '../../log'
import { isDefined } from '../../util'
import { getThemeAssets } from '../../util/html'
import { truncate } from '../../util/truncate'
import * as vfile from '../../util/vfile'
import { TxtCodec } from '../txt'
import { Codec, CommonEncodeOptions } from '../types'
import { fromFiles } from '../../util/media/fromFiles'

export const stencilaItemType = 'data-itemtype'
export const stencilaItemProp = 'data-itemprop'

const window = new jsdom.JSDOM().window
const document = window.document

const log = getLogger('encoda:html')

// The maximum length for a Article headline
const headlineMaxLength = 110

// Ensures unique `id` attributes (e.g. for headings)
const slugger = new GithubSlugger()

/**
 * MathJax typesetting promises.
 *
 * A global list of promises that need to be awaited when encoding a
 * node. See `mathJaxTypeset`. This is a bit hackish but allows the use
 * of async MathJax rendering within a deeply nested `encode*` function,
 * with out having to make all the `encode*` functions async.
 */
let mathJaxPromises: Promise<unknown>[] = []

/**
 * Reset the set of MathJax promises to be awaited.
 */
function mathJaxInit(): void {
  mathJaxPromises = []
}

/**
 * Render math as HTML using MathJax and set the `innerHTML` of the
 * `elem`.
 */
function mathJaxTypeset(elem: HTMLElement, options: unknown): void {
  mathJaxPromises.push(
    MathJax.typeset(options)
      .then((result: any) => {
        elem.innerHTML = result.html
      })
      .catch((error: Error) => log.error(error))
  )
}

/**
 * Wait for all MathJax typesetting promises.
 */
async function mathJaxFinish(): Promise<unknown> {
  return Promise.all(mathJaxPromises)
}

/**
 * Generate placeholder using given dimensions and text.
 */
const placeholderImg = (text: string, width: number, height = width): string =>
  `https://via.placeholder.com/${width}x${height}/dbdbdb/4a4a4a.png?text=${encodeURI(
    truncate(text, headlineMaxLength)
  )}`

/**
 * Given a possibly undefined value, or empty array, return the HTML provided as the second argument
 * otherwise returns undefined.
 *
 * @param {unknown} value - Any possibly falsy value, most often an optional Stencila Schema node property
 * @param {HTMLElement} html - `HTMLElement` (usually a direct call to `hyperscript`) or function that produces it
 */
const encodeMaybe = <T>(
  value: T | undefined,
  html: HTMLElement | ((defined: T) => HTMLElement | HTMLElement[])
): HTMLElement | HTMLElement[] | undefined => {
  return value !== undefined && (Array.isArray(value) ? value.length > 0 : true)
    ? typeof html === 'function'
      ? html(value)
      : html
    : undefined
}

/**
 * Given a string tries to find and return an HTML element with a matching `itemprop` attribute value
 * @param {HTMLElement} el - HTML element to search within
 * @param {string} itemprop - Value of the `itemprop` attribute to find
 */
const propSelector = (el: HTMLElement) => (
  itemprop: string
): HTMLElement | undefined => {
  const match = el.querySelector<HTMLElement>(`[itemprop=${itemprop}]`)
  return match ?? undefined
}

/**
 * Given a string tries to find and return all HTML element with a matching `itemprop` attribute valu
 * @param {HTMLElement} el - HTML element to search within
 * @param {string} itemprop - Value of the `itemprop` attribute to find
 */
const propSelectorAll = (el: HTMLElement) => (
  itemprop: string
): HTMLElement[] => {
  const match = el.querySelectorAll<HTMLElement>(`[itemprop=${itemprop}]`)
  return match.length > 0 ? [...match] : []
}

/**
 * Given a string tries to find and return an HTML element with a matching `itemprop` attribute value.
 * If a matching element is found, will attempt to return the `textContent`, falling back to `undefined`.
 * @param {HTMLElement} el - HTML element to search within
 * @param {string} itemprop - Value of the `itemprop` attribute to find
 */
const propValue = (el: HTMLElement) => (
  itemprop: string
): string | undefined => {
  const match = propSelector(el)(itemprop)
  return match?.textContent ?? undefined
}

/**
 * Given a list of itemprop values, tries to find and return the matching HTML element's `textContent`.
 * If the found HTMLElement does not contain `textContent`, then `undefined` will be returned for that element.
 * @param {HTMLElement} el - HTML element to search within
 * @param {string} itemprops - Value of the `itemprop` attribute to find
 */
const propsToValues = (el: HTMLElement) => (
  itemprops: string[]
): { [key: string]: string | number } => {
  const selector = propSelector(el)

  return itemprops.reduce(
    (foundProps: { [key: string]: string | number }, prop) => {
      const match = selector(prop)
      const value = match?.textContent
      return typeof value === 'string'
        ? { ...foundProps, [prop]: value }
        : foundProps
    },
    {}
  )
}

export class HTMLCodec extends Codec implements Codec {
  public readonly mediaTypes = ['text/html']

  /**
   * Decode HTML content.
   *
   * Note that, if the HTML does not contain any handled elements, this will
   * return `undefined`.
   */
  public decodeHtml = (htmlContent: VFileContents): stencila.Node => {
    const dom = new jsdom.JSDOM(htmlContent)
    const document = dom.window.document
    collapse(document)
    const node = decodeNode(document)
    if (Array.isArray(node)) {
      if (node.length === 0) {
        log.warn(
          `No node could be decoded from HTML: ${
            htmlContent.length > 10
              ? htmlContent.toString().substr(0, 10) + '...'
              : htmlContent
          }`
        )
        return ''
      } else if (node.length === 1) {
        return node[0]
      }
    }
    return node
  }

  /**
   * Decode a `VFile` with HTML contents to a `stencila.Node`.
   *
   * @param file The `VFile` to decode
   * @returns A promise that resolves to a `stencila.Node`
   */
  public readonly decode = async (
    file: vfile.VFile
  ): Promise<stencila.Node> => {
    const html = await vfile.dump(file)
    return this.decodeHtml(html)
  }

  /**
   * Encode a Stencila `Node` to a `VFile` with HTML contents.
   *
   * The attribute `data-itemscope="root"` is added to the root node
   * of the encoded HTML. This attribute can be used to scope CSS variables
   * to within the top-level Stencila Node.
   *
   * @param node The `Node` to encode.
   * @returns A promise that resolves to a `VFile`
   */
  public readonly encode = async (
    node: stencila.Node,
    options: CommonEncodeOptions = this.commonEncodeDefaults
  ): Promise<vfile.VFile> => {
    const { isStandalone, isBundle, theme } = {
      ...this.commonEncodeDefaults,
      ...options
    }

    // Reset the slugger to avoid unnecessarily adding numbers to ids
    // in order to make them unique
    slugger.reset()

    if (isBundle) node = await fromFiles(node)

    mathJaxInit()

    const fragment = Array.isArray(node)
    let dom = Array.isArray(node)
      ? h('div', encodeNodes(node))
      : (encodeNode(node) as HTMLElement)

    const [name, value] = Object.entries(microdataRoot())[0]
    dom.setAttribute(name, value as string)

    await mathJaxFinish()

    if (isStandalone) {
      const { title = 'Untitled' } = getArticleMetaData(node)
      dom = await generateHtmlElement(
        TxtCodec.stringify(title),
        [dom],
        isBundle,
        theme
      )
    }

    const html = fragment ? dom.innerHTML : dom.outerHTML
    const beautifulHtml = beautify(html)
    return vfile.load(beautifulHtml)
  }
}

export const beautify = (html: string): string =>
  /* eslint-disable @typescript-eslint/camelcase */
  beautifyHtml(html, {
    indent_size: 2,
    indent_inner_html: true, // Indent <head> and <body> sections
    wrap_line_length: 100,
    preserve_newlines: false // Preserve existing line-breaks
  })
/* eslint-enable @typescript-eslint/camelcase */

const getArticleMetaData = (
  node: stencila.Node
): Exclude<stencila.Article, 'content'> => {
  const article = isArticle(node) ? node : stencila.article()
  const { content, ...metadata } = article
  return metadata
}

const decodeNodes = (nodes: Node[]): stencila.Node[] =>
  nodes
    .map(decodeNode)
    .reduce(
      (prev: Node[], curr) => [
        ...prev,
        ...(Array.isArray(curr) ? curr : [curr])
      ],
      []
    )

const decodeChildNodes = (node: Node): stencila.Node[] =>
  decodeNodes([...node.childNodes])

const decodeBlockChildNodes = (node: Node): stencila.BlockContent[] =>
  decodeChildNodes(node).map(n => n as stencila.BlockContent)

const decodeInlineChildNodes = (node: Node): stencila.InlineContent[] =>
  decodeChildNodes(node)
    .map(n => n as stencila.InlineContent)
    .filter(n => n !== '')

function decodeNode(node: Node): stencila.Node | stencila.Node[] {
  // TODO: Avoid the following use of `@ts-ignore` and `as`
  // With major version upgrade to jsdom (and others 7b8399a791b5b8c9e6cd7e146b143c0ebd1c9257)
  // the `test node instanceof window.HTMLElement` was always falsy and
  // the `typeof node.getAttribute === 'function'` is intended as a temporary workaround
  const itemtype =
    node instanceof window.HTMLElement ||
    // @ts-ignore
    typeof node.getAttribute === 'function'
      ? (node as HTMLElement).getAttribute('itemtype')
      : null
  const type = itemtype !== null ? microdataType(itemtype) : undefined
  const tag = node.nodeName.toLowerCase()
  const name = type ?? tag
  switch (name) {
    case '#document':
      return decodeDocument(node as HTMLDocument)

    case 'article':
    case 'Article':
      return decodeArticle(node as HTMLElement)

    case 'p':
    case 'Paragraph':
      return decodeParagraph(node as HTMLParagraphElement)

    case 'blockquote':
    case 'QuoteBlock':
      return decodeBlockquote(node as HTMLQuoteElement)

    case 'pre':
      if (node.firstChild?.nodeName === 'CODE') {
        return decodeCodeBlock(node as HTMLPreElement)
      }
      break
    case 'CodeBlock':
      return decodeCodeBlock(node as HTMLPreElement)

    case 'stencila-code-chunk':
    case 'CodeChunk':
      return decodeCodeChunk(node as HTMLElement)

    case 'ul':
    case 'ol':
    case 'List':
      return decodeList(node as HTMLUListElement)
    case 'Collection':
      return decodeCollection(node as HTMLOListElement)

    case 'li':
    case 'ListItem':
      return decodeListItem(node as HTMLLIElement)

    case 'table':
    case 'Table':
      return decodeTable(node as HTMLTableElement)

    case 'th':
    case 'tr':
    case 'TableRow':
      return decodeTableRow(node as HTMLTableRowElement)

    case 'td':
    case 'TableCell':
      return decodeTableCell(node as HTMLTableCellElement)

    case 'Datatable':
      return decodeDatatable(node as HTMLDivElement)

    case 'hr':
    case 'ThematicBreak':
      return decodeHR()

    case 'em':
    case 'Emphasis':
    case 'Mark':
      return decodeMark(node as HTMLElement, 'Emphasis')
    case 'strong':
    case 'Strong':
      return decodeMark(node as HTMLElement, 'Strong')
    case 'del':
    case 'Delete':
      return decodeMark(node as HTMLElement, 'Delete')
    case 'sup':
    case 'Superscript':
      return decodeMark(node as HTMLElement, 'Superscript')
    case 'sub':
    case 'Subscript':
      return decodeMark(node as HTMLElement, 'Subscript')

    case 'a':
    case 'Link':
      return decodeLink(node as HTMLAnchorElement)

    case 'q':
    case 'Quote':
      return decodeQuote(node as HTMLQuoteElement)

    case 'cite':
    case 'Cite':
      return decodeCite(node as HTMLElement)

    case 'CiteGroup':
      return decodeCiteGroup(node as HTMLOListElement)

    case 'stencila-code-expression':
    case 'CodeExpression':
      return decodeCodeExpression(node as HTMLElement)

    case 'code':
    case 'CodeFragment':
      return decodeCodeFragment(node as HTMLElement)

    case 'img':
    case 'ImageObject':
      return decodeImage(node as HTMLImageElement)

    case 'figure':
    case 'Figure':
      return decodeFigure(node as HTMLElement)

    case 'figcaption':
      return decodeFigCaption(node as HTMLElement)
    case 'math':
      return decodeMath(node as HTMLElement)

    case 'Person':
      return decodePerson(node as HTMLElement)

    case 'Null':
      return decodeNull()
    case 'Boolean':
      return decodeBoolean(node as HTMLElement)
    case 'Number':
      return decodeNumber(node as HTMLElement)
    case 'Array':
      return decodeArray(node as HTMLElement)
    case 'Object':
      return decodeObject(node as HTMLElement)

    // Container elements which are 'unwrapped'
    // by simply decoding their children
    case 'div':
    case 'span':
    case 'time':
      return decodeChildNodes(node)

    // Elements that are explicitly ignored
    // i.e. no warning
    case 'script':
      return []

    case '#text':
      return decodeText(node as Text)
  }

  const match = (s: string): RegExpExecArray | null => /^h(\d)$/i.exec(s)
  if (match(name) !== null || name === 'Heading') {
    const tag = match(node.nodeName)
    const level = tag !== null ? tag[1] : '1'
    const depth = parseInt(level, 10)
    return decodeHeading(node as HTMLHeadingElement, depth)
  }

  if (itemtype !== null) return decodeEntity(node as HTMLElement)

  log.warn(`No handler for HTML element <${name}>`)
  return []
}

const encodeNodes = (nodes: stencila.Node[]): Node[] => nodes.map(encodeNode)

const encodeNode = (node: stencila.Node): Node => {
  switch (nodeType(node)) {
    case 'Article':
      return encodeArticle(node as stencila.Article)

    case 'Include':
      return encodeInclude(node as stencila.Include)

    case 'Heading':
      return encodeHeading(node as stencila.Heading)
    case 'Paragraph':
      return encodeParagraph(node as stencila.Paragraph)
    case 'QuoteBlock':
      return encodeQuoteBlock(node as stencila.QuoteBlock)
    case 'Cite':
      return encodeCite(node as stencila.Cite)
    case 'CiteGroup':
      return encodeCiteGroup(node as stencila.CiteGroup)
    case 'CodeBlock':
      return encodeCodeBlock(node as stencila.CodeBlock)
    case 'CodeChunk':
      return encodeCodeChunk(node as stencila.CodeChunk)
    case 'CodeExpression':
      return encodeCodeExpression(node as stencila.CodeExpression)
    case 'CodeFragment':
      return encodeCodeFragment(node as stencila.CodeFragment)
    case 'Person':
      return encodePerson(node as stencila.Person)
    case 'CreativeWork':
    case 'Periodical':
    case 'PublicationIssue':
    case 'PublicationVolume':
    case 'SoftwareSourceCode':
    case 'AudioObject':
    case 'VideoObject':
    case 'MediaObject':
      return encodeCreativeWork(node as stencila.CreativeWork)
    case 'Collection':
      return encodeCollection(node as stencila.Collection)
    case 'Figure':
      return encodeFigure(node as stencila.Figure)
    case 'List':
      return encodeList(node as stencila.List)
    case 'ListItem':
      return encodeListItem(node as stencila.ListItem)
    case 'Table':
      return encodeTable(node as stencila.Table)
    case 'TableRow':
      return encodeTableRow(node as stencila.TableRow)
    case 'TableCell':
      return encodeTableCell(node as stencila.TableCell)
    case 'Datatable':
      return encodeDatatable(node as stencila.Datatable)
    case 'Date':
      return encodeDate(node as stencila.Date)
    case 'ThematicBreak':
      return encodeThematicBreak()
    case 'Organization':
      return encodeOrganization(node as stencila.Organization)

    case 'Mark':
    case 'Emphasis':
      return encodeMark(node as stencila.Emphasis, 'em')
    case 'Strong':
      return encodeMark(node as stencila.Strong, 'strong')
    case 'Delete':
      return encodeMark(node as stencila.Strong, 'del')
    case 'Superscript':
      return encodeMark(node as stencila.Superscript, 'sup')
    case 'Subscript':
      return encodeMark(node as stencila.Subscript, 'sub')
    case 'Link':
      return encodeLink(node as stencila.Link)
    case 'Quote':
      return encodeQuote(node as stencila.Quote)

    case 'MathBlock':
    case 'MathFragment':
      return encodeMath(node as stencila.Math)

    case 'ImageObject':
      return encodeImageObject(node as stencila.ImageObject)

    case 'Null':
      return encodeNull()
    case 'Boolean':
      return encodeBoolean(node as boolean)
    case 'Number':
      return encodeNumber(node as number)
    case 'Text':
      return encodeString(node as string)
    case 'Array':
      return encodeArray(node as unknown[])
    case 'Object':
      return encodeObject(node as object)
    default:
      return encodeEntity(node as stencila.Entity)
  }
}

/**
 * Decode a `#document` node to a `stencila.Node`.
 */
function decodeDocument(doc: HTMLDocument): stencila.Node {
  const body = doc.querySelector('body')
  if (body === null) throw new Error('Document does not have a <body>!')
  const children = [...body.childNodes]
  return children.length === 0 ? [] : decodeNodes([...body.childNodes])
}

/**
 * Generate a `<html>` element with supplied title, metadata, body content, and
 * optionally custom CSS to style the document with.
 *
 * Conforms to https://dequeuniversity.com/rules/axe/3.5/landmark-one-main?
 * by placing the root element in a `<main role="main">`.
 *
 * TODO: This function needs refactoring. It only called from one location
 * and it may be better to move some of all of it there.
 */
async function generateHtmlElement(
  title: string,
  root: Node[],
  isBundle: boolean,
  theme?: string
): Promise<HTMLHtmlElement> {
  let themeCss: HTMLElement[] = []
  let themeJs: HTMLElement[] = []
  if (theme !== undefined) {
    const { styles, scripts } = await getThemeAssets(theme, isBundle)
    if (isBundle) {
      // Bundle the theme into the document
      themeCss = styles.map(style =>
        h('style', {
          innerHTML: style
        })
      )

      themeJs = scripts.map(src =>
        h('script', {
          innerHTML: src
        })
      )
    } else {
      themeCss = styles.map(style =>
        h('link', {
          href: style,
          rel: 'stylesheet'
        })
      )

      themeJs = scripts.map(src =>
        h('script', {
          src: src,
          type: 'text/javascript'
        })
      )
    }
  }

  return h(
    'html',
    { lang: 'en' },
    h(
      'head',
      h('title', title),
      h('meta', { charset: 'utf-8' }),
      h('meta', {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0'
      }),
      h('meta', { 'http-equiv': 'X-UA-Compatible', content: 'ie=edge' }),
      ...themeCss,
      ...themeJs,
      h('script', {
        src:
          'https://unpkg.com/@stencila/components@<=1/dist/stencila-components/stencila-components.esm.js',
        type: 'module'
      }),
      h('script', {
        nomodule: '',
        src:
          'https://unpkg.com/@stencila/components@<=1/dist/stencila-components/stencila-components.js',
        type: 'text/javascript'
      })
    ),
    h('body', h('main', { attrs: { role: 'main' } }, root))
  )
}

/**
 * Decode an `<article>` element to a `Article` node.
 */
const decodeArticle = (element: HTMLElement): stencila.Article => {
  const prop = propSelector(element)

  let title = 'Untitled'
  const headline = prop('headline')
  if (headline !== undefined) {
    title = headline.textContent ?? 'Untitled'
    headline.remove()
  }

  const references = element.querySelectorAll<HTMLOListElement>(
    'ol[data-itemprop="references"] > li'
  )

  const refItems =
    references.length > 0 ? [...references].map(decodeCreativeWork) : []

  return stencila.article({
    title,
    references: isNonEmpty(refItems) ? refItems : undefined,
    content: decodeChildNodes(element)
  })
}

/**
 * Encode an `Article` node to a `<article>` element.
 */
function encodeArticle(article: stencila.Article): HTMLElement {
  const {
    type,
    title,
    authors,
    publisher,
    datePublished,
    identifiers,
    description,
    content = [],
    references,
    ...lost
  } = article
  logWarnLossIfAny('html', 'encode', article, lost)

  return h(
    'article',
    encodeAttrs(article),
    encodeTitleProperty(title),
    encodeImageProperty(article),
    encodeMaybe(authors, authors => encodeAuthorsProperty(authors)),
    encodePublisherProperty(publisher),
    encodeMaybe(datePublished, date => encodeDate(date, 'datePublished')),
    encodeIdentifiersProperty(identifiers),
    encodeMaybe(description, desc => encodeDescriptionProperty(desc)),
    ...encodeNodes(content),
    encodeMaybe(references, refs => encodeReferencesProperty(refs))
  )
}

/**
 * Encode the `Article.publisher` property to HTML.
 *
 * The GSDTT requires an `Article` to have a `publisher` property
 * with a `name` and `logo.url`.
 *
 * If a publisher logo is found, insert as an image,
 * otherwise as an invisible `meta` tag with a placeholder image.
 */
function encodePublisherProperty(
  publisher: stencila.Article['publisher']
): HTMLElement {
  publisher = publisher ?? stencila.organization()

  const { name = 'Unknown' } = publisher
  const nameTag = isDefined(publisher.name) ? 'span' : 'meta'

  let logo = stencila.isA('Organization', publisher)
    ? publisher.logo
    : undefined

  let logoTag = 'img'
  if (logo === undefined) {
    logoTag = 'meta'
    logo = stencila.imageObject({
      contentUrl: placeholderImg(name, 600, 60)
    })
  } else if (typeof logo === 'string')
    logo = stencila.imageObject({ contentUrl: logo })

  return h(
    'span',
    encodeAttrs(publisher, { itemprop: 'publisher' }),
    h(nameTag, { itemprop: 'name', content: name }, name),
    h(
      'span',
      encodeAttrs(logo, { itemprop: 'logo' }),
      // Both `content` and `src` are necessary here if `logoTag`
      // is `img`
      h(logoTag, {
        attrs: {
          itemprop: 'url',
          content: logo.contentUrl,
          ...(logoTag === 'img' ? { src: logo.contentUrl } : {})
        }
      })
    )
  )
}

/**
 * Encode the `Article.title` property to HTML.
 *
 * The GSDTT requires that the `Article.headline` property be a string
 * less than 110 characters so, if it isn't (to long, or structured content),
 * stringify and/or truncate it and use the* `content` attribute.
 */
function encodeTitleProperty(
  title: stencila.Article['title'],
  tag: 'h1' | 'span' = 'h1'
): HTMLElement | undefined {
  if (title === undefined) return undefined

  const content = truncate(TxtCodec.stringify(title), headlineMaxLength)
  return h(
    tag,
    {
      attrs: {
        ...microdata(title, 'title'),
        ...(content !== title ? { content } : {})
      }
    },
    typeof title === 'string' ? title : encodeNodes(title)
  )
}

/**
 * Encode the `Article.image` property to HTML.
 *
 * The GSDTT requires an `Article` to have a `image` property.
 * This scans the article and finds the first `ImageObject`
 * and uses that. If no images in the article then uses a placeholder.
 */
function encodeImageProperty(article: stencila.Article): HTMLElement {
  const img = article.content?.find(node => isA('ImageObject', node))
  const headline = typeof article.title === 'string' ? article.title : ''
  const fallback = placeholderImg(headline, 1200, 714)
  const contentUrl = isA('ImageObject', img) ? img.contentUrl : fallback
  return h('meta', { itemprop: 'image', content: contentUrl })
}

/**
 * Encode authors and their organizational affiliations.
 *
 * This function takes the usual approach of representing
 * authors and their affiliations as two separate lists with links
 * between them.
 */
function encodeAuthorsProperty(
  authors: (stencila.Person | stencila.Organization)[]
): HTMLElement[] {
  const init: { [key: string]: [number, stencila.Organization] } = {}
  const orgs = authors
    .map(author =>
      stencila.isA('Person', author) && author.affiliations !== undefined
        ? author.affiliations
        : []
    )
    .reduce((prev, curr) => [...prev, ...curr], [])
    .reduce((prev, curr) => {
      const { name, meta } = curr
      if (name !== undefined && prev[name] === undefined) {
        const index = Object.keys(prev).length + 1
        prev[name] = [
          index,
          {
            ...curr,
            meta: {
              ...meta,
              /**
               * The [`itemid`](https://www.w3.org/TR/microdata/#dfn-itemid) attribute
               * must be a valid URL. So we prefix the node's `id` with a hash. Changing
               * this will break links between entities. See https://moz.com/blog/search-marketers-guide-to-itemref-itemid
               * for more.
               */
              itemid: `#author-organization-${index}`
            }
          }
        ]
      }
      return prev
    }, init)

  return [
    h(
      'ol',
      {
        attrs: {
          [stencilaItemProp]: 'authors'
        }
      },
      ...authors.map(author =>
        author.type === 'Person'
          ? encodePerson(author, 'authors', orgs, 'li')
          : encodeOrganization(author, 'authors', 'li')
      )
    ),
    ...(Object.keys(orgs).length > 0
      ? [
          h(
            'ol',
            microdata(orgs, 'affiliations', 'array'),
            Object.values(orgs).map(([_, org]) =>
              // Do not give a property since these are linked.
              encodeOrganization(org, undefined, 'li')
            )
          )
        ]
      : [])
  ]
}

/**
 * Encode the `CreativeWork.isPartOf` property to HTML.
 *
 * This function is intended primarily for encoding the `isPartOf`
 * property of works that are themselves in the `references`
 * property of another work.
 *
 * It encodes the property "recursively upwards"
 * so that the ancestor `Periodical`, `PublicationVolume` and
 * `PublicationIssue` and `pageStart` etc nodes appear in that
 * order. e.g. `Peptides, 32(6), 1335-1355`
 */
function encodeIsPartOfProperty(
  work: stencila.CreativeWork['isPartOf'],
  tag: keyof HTMLElementTagNameMap = 'span'
): HTMLElement | undefined {
  if (work === undefined) return undefined

  const md = { attrs: microdata(work, 'isPartOf') }
  if (stencila.isA('PublicationIssue', work)) {
    const { issueNumber, isPartOf } = work
    return h(
      tag,
      md,
      encodeMaybe(issueNumber, issueNumber =>
        h('span', microdata(issueNumber, 'issueNumber'), issueNumber)
      ),
      encodeIsPartOfProperty(isPartOf)
    )
  } else if (stencila.isA('PublicationVolume', work)) {
    const { volumeNumber, isPartOf } = work
    return h(
      tag,
      md,
      encodeMaybe(volumeNumber, volumeNumber =>
        h('span', microdata(volumeNumber, 'volumeNumber'), volumeNumber)
      ),
      encodeIsPartOfProperty(isPartOf)
    )
  } else if (stencila.isA('Periodical', work)) {
    const { name } = work
    return h(
      tag,
      md,
      encodeMaybe(name, name => h('span', microdata(name, 'name'), name))
    )
  }
}

/**
 * Encode the pagination related properties of an article
 */
function endodePaginationProperties(
  article: stencila.Article
): (HTMLElement | undefined)[] {
  const { pageStart, pageEnd, pagination } = article
  if (pagination !== undefined)
    return [h('span', microdata(pagination, 'pagination'), pagination)]
  return [
    pageStart !== undefined
      ? h('span', microdata(pageStart, 'pageStart'), pageStart)
      : undefined,
    pageEnd !== undefined
      ? h('span', microdata(pageEnd, 'pageEnd'), pageEnd)
      : undefined
  ]
}

/**
 * Encode the `identifiers` property of a `Thing` node
 * as a HTML `<ul>` element.
 */
function encodeIdentifiersProperty(
  identifiers: stencila.Thing['identifiers']
): HTMLElement | undefined {
  if (identifiers === undefined) return undefined

  return h(
    'ul',
    microdata(identifiers, 'identifiers', 'array'),
    identifiers.map(identifier => {
      const md = microdata(identifier, 'identifiers', 'item')

      if (typeof identifier === 'string')
        return h('li', { attrs: md }, identifier)

      const { name, propertyID, value, ...lost } = identifier
      logWarnLossIfAny('html', 'encode', identifier, lost)

      return h(
        'li',
        { attrs: md },
        encodeMaybe(propertyID, propertyID =>
          h('meta', {
            ...microdata(propertyID, 'propertyID'),
            content: propertyID
          })
        ),
        encodeMaybe(name, name => h('span', microdata(name, 'name'), name)),
        encodeMaybe(value, value => h('span', microdata(value, 'value'), value))
      )
    })
  )
}

/**
 * Encode a `Date` node as a HTML `<time>` element.
 *
 * Note that since a `Date` is a basic, atomic https://schema.org/DataType
 * it does not have an `itemtype` property.
 *
 * @param date The date to encode
 * @param property The property the data belongs to
 */
function encodeDate(
  date: string | stencila.Date,
  property?: string
): HTMLElement {
  const value = stencila.isA('Date', date) ? date.value : date
  return h('time', { ...microdata(value, property), datetime: value }, value)
}

function encodeDescriptionProperty(
  desc: string | stencila.Node[]
): HTMLElement {
  return h(
    'section',
    { [stencilaItemProp]: 'description' },
    h('h2', { [stencilaItemType]: microdataItemtype('Heading') }, 'Abstract'),
    h('meta', {
      itemprop: 'description',
      content: TxtCodec.stringify(desc)
    }),
    encodeNodes(typeof desc === 'string' ? [desc] : desc)
  )
}

function encodeReferencesProperty(
  references: (string | stencila.CreativeWork)[]
): HTMLElement {
  return h(
    'section',
    { attrs: microdata(references, 'references', 'array') },
    h('h2', { [stencilaItemType]: microdataItemtype('Heading') }, 'References'),
    h(
      'ol',
      references.map(ref => {
        const md = microdata(ref, 'references', 'item')
        if (typeof ref === 'string') return h('li', md, ref)
        const {
          authors = [],
          datePublished,
          title,
          url,
          isPartOf,
          publisher
        } = ref
        return h(
          'li',
          { attrs: { ...md, id: ref.id } },
          encodeAuthorsProperty(authors),
          encodeMaybe(datePublished, date => encodeDate(date, 'datePublished')),
          encodeTitleProperty(title, 'span'),
          encodeIsPartOfProperty(isPartOf),
          stencila.isArticle(ref) ? endodePaginationProperties(ref) : undefined,
          encodeMaybe(url, h('a', { itemprop: 'url', href: url }, url)),
          encodePublisherProperty(publisher),
          isA('Article', ref) ? encodeImageProperty(ref) : []
        )
      })
    )
  )
}

interface CreativeWorkOptions {
  attrs?: { [key: string]: unknown }
  as?: keyof HTMLElementTagNameMap
}

const defaultCreativeWorkOptions: CreativeWorkOptions = {
  attrs: {}
}

type CreativeWorkTagMap = {
  [key in stencila.CreativeWork['type']]: keyof HTMLElementTagNameMap
}

const creativeWorkTagMap: CreativeWorkTagMap = {
  Article: 'article',
  AudioObject: 'audio',
  Collection: 'div',
  CreativeWork: 'div',
  Datatable: 'div',
  Figure: 'figure',
  ImageObject: 'div',
  MediaObject: 'div',
  Periodical: 'div',
  PublicationIssue: 'div',
  PublicationVolume: 'div',
  SoftwareApplication: 'div',
  SoftwareSourceCode: 'div',
  Table: 'div',
  VideoObject: 'video'
}

function decodeCreativeWork(work: HTMLElement): stencila.CreativeWork {
  const workSelectorAll = propSelectorAll(work)
  const workSelector = propSelector(work)
  const headline = workSelector('headline')
  const url = workSelector('url')

  return stencila.creativeWork({
    title: headline?.textContent ?? 'Untitled',
    authors: workSelectorAll('author').map(decodePerson),
    funders: workSelectorAll('funder').map(decodePerson),
    editors: workSelectorAll('editor').map(decodePerson),
    url: url?.getAttribute('href') ?? undefined,
    ...propsToValues(work)(['dateCreated', 'dateModified', 'datePublished'])
  })
}

function encodeCreativeWork(
  work: stencila.CreativeWork,
  { attrs, as }: CreativeWorkOptions = defaultCreativeWorkOptions
): HTMLElement {
  const {
    title,
    url,
    authors = [],
    publisher,
    datePublished,
    content = []
  } = work
  return h(
    as ?? creativeWorkTagMap[work.type] ?? 'div',
    // @ts-ignore
    encodeAttrs(work, attrs),
    encodePublisherProperty(publisher),
    encodeTitleProperty(title, 'span'),
    isA('Article', work) ? encodeImageProperty(work) : [],
    encodeAuthorsProperty(authors),
    encodeMaybe(datePublished, date => encodeDate(date, 'datePublished')),
    encodeMaybe(url, h('a', { itemprop: 'url', href: url }, url)),
    encodeNodes(content)
  )
}

function decodePerson(person: HTMLElement): stencila.Person {
  const url = person.querySelector('a')
  const href = url?.getAttribute('href')
  const personProps = propValue(person)

  return stencila.person({
    url: href ?? undefined,
    familyNames: [personProps('familyName')].filter(isDefined),
    givenNames: [personProps('givenName')].filter(isDefined)
  })
}

/**
 * Encode a `Person` node.
 *
 * - Ensures an `itemprop=name` for conformance with GSDTT.
 *
 * - Creates a link between the `Person` and the `Organization`
 *   that they are affiliated with.
 *
 * @param person The `Person` to encode
 * @param property The property that the person belongs to
 * @param organizations A map of `Organization`s to allow linking
 * @param tag The tag to use for the element
 */
function encodePerson(
  person: stencila.Person,
  property = 'authors',
  organizations?: { [key: string]: [number, stencila.Organization] },
  tag: keyof HTMLElementTagNameMap = 'span'
): HTMLElement {
  const {
    name,
    givenNames = [],
    familyNames = [],
    url,
    emails,
    affiliations,
    ...lost
  } = person
  logWarnLossIfAny('html', 'encode', person, lost)

  const nameString =
    name !== undefined
      ? name
      : familyNames.length !== 0
      ? givenNames.length !== 0
        ? [...givenNames, ...familyNames].join(' ')
        : familyNames.join(' ')
      : 'Anonymous'

  const nameElem =
    familyNames.length === 0 && givenNames.length === 0
      ? // Display the calculated `nameString` if no given or family names
        h('span', microdata(nameString, 'name'), nameString)
      : // Otherwise, use a <meta> tag
        h('meta', { ...microdata(nameString, 'name'), content: nameString })

  const givenNamesElem =
    givenNames.length !== 0
      ? h(
          'span',
          microdata(givenNames, 'givenNames', 'array'),
          givenNames.map(givenName =>
            h('span', microdata(givenName, 'givenNames', 'item'), givenName)
          )
        )
      : undefined

  const familyNamesElem =
    familyNames.length !== 0
      ? h(
          'span',
          microdata(familyNames, 'familyNames', 'array'),
          familyNames.map(familyName =>
            h('span', microdata(familyName, 'familyNames', 'item'), familyName)
          )
        )
      : undefined

  const emailsElem =
    emails !== undefined
      ? h(
          'span',
          microdata(emails, 'emails', 'array'),
          emails.map(email =>
            h(
              'a',
              {
                ...microdata(email, 'emails', 'item'),
                href: `mailto:${email}`
              },
              email
            )
          )
        )
      : undefined

  const affiliationsElem =
    affiliations !== undefined && organizations !== undefined
      ? h(
          'span',
          microdata(affiliations, 'affiliations', 'array'),
          affiliations.map(affiliation => {
            const entry = organizations[affiliation.name ?? '']
            if (entry !== undefined) {
              const [index, org] = entry
              return h(
                'a',
                {
                  ...microdata(affiliation, 'affiliations', 'item'),
                  href: org?.meta?.itemid
                },
                index
              )
            }
          })
        )
      : undefined

  return h(
    tag,
    { attrs: microdata(person, property) },
    nameElem,
    givenNamesElem,
    familyNamesElem,
    emailsElem,
    affiliationsElem
  )
}

function encodeOrganization(
  org: stencila.Organization,
  property?: string,
  tag: keyof HTMLElementTagNameMap = 'span'
): HTMLElement {
  const { id, name, url, address, meta, parentOrganization, ...lost } = org
  logWarnLossIfAny('html', 'encode', org, lost)

  const nameElem = h('span', { itemprop: 'name' }, name)
  const linkElem =
    url !== undefined
      ? h('a', { itemprop: 'url', content: url, href: url }, nameElem)
      : nameElem

  return h(
    tag,
    encodeAttrs(org, {
      itemid: meta?.itemid,
      id: meta?.itemid.replace(/^#/, '') ?? id,
      ...(property !== undefined ? microdataProperty(property) : {})
    }),
    linkElem,
    encodeMaybe(parentOrganization, org =>
      encodeOrganization(org, 'parentOrganization')
    ),
    encodeAddressProperty(address)
  )
}

/**
 * Encode an `address` property.
 *
 * For `PostalAddress` types, this follows the
 * Microdata examples at https://schema.org/address
 * except that it uses an `<address>` element instead of a `<div>`.
 */
function encodeAddressProperty(
  address: stencila.Organization['address'],
  tag: keyof HTMLElementTagNameMap = 'address',
  property = 'address'
): HTMLElement | undefined {
  if (address === undefined) return undefined

  if (typeof address === 'string')
    return h(tag, { attrs: microdata(address, property) }, address)

  const {
    postOfficeBoxNumber,
    streetAddress,
    addressLocality,
    addressRegion,
    addressCountry,
    ...lost
  } = address
  logWarnLossIfAny('html', 'encode', address, lost)

  const parts = {
    postOfficeBoxNumber,
    streetAddress,
    addressLocality,
    addressRegion,
    addressCountry
  }

  return h(
    tag,
    { attrs: microdata(address, property) },
    ...Object.entries(parts).map(([property, value]) =>
      value !== undefined
        ? h('span', { attrs: microdata(value, property) }, value)
        : undefined
    )
  )
}

/**
 * Encode a Stencila `Include` node to a Microdata `div[itemtype]` element.
 *
 * TODO: This is an initial implementation and it is probably better to generalize
 * it into a default encoding function to replace `encodeThing`.
 */
function encodeInclude(include: stencila.Include): HTMLElement {
  const content = include.content ?? []
  const contentDiv = h('div', content.map(encodeNode))
  contentDiv.setAttribute('itemprop', 'content')
  return h(`div`, encodeAttrs(include), contentDiv)
}

/**
 * Decode a `<h1-6>` element to a `Heading` node.
 *
 * This assumes that the document uses `<h1>` for the document's
 * title (extracted elsewhere) only and
 *  `<h2>, <h3>,...` for level sections headings.
 * See `encodeHeading` for rationale.
 */
function decodeHeading(
  heading: HTMLHeadingElement,
  depth: number
): stencila.Heading {
  return stencila.heading({
    depth: Math.max(1, depth - 1),
    content: decodeInlineChildNodes(heading)
  })
}

/**
 * Encode a `Heading` node to a `<h2>`, `<h3>` etc element.
 *
 * > Generally, it is a best practice to ensure that the beginning of a
 * > page's main content starts with a h1 element, and also to ensure
 * > that the page contains only one h1 element.
 * > From https://dequeuniversity.com/rules/axe/3.5/page-has-heading-one
 *
 * This codec follows that recommendation and reserves `<h1>` for the
 * `title` property of a document.
 *
 * In rare cases that there is no content in the heading, return an empty
 * text node to avoid the 'Heading tag found with no content' accessibility error.
 */
function encodeHeading(heading: stencila.Heading): HTMLHeadingElement | Text {
  let { id, depth = 0, content } = heading

  if (content.length === 0) return document.createTextNode('')

  const text = TxtCodec.stringify(heading)
  id = id !== undefined ? id : slugger.slug(text)
  return h<HTMLHeadingElement>(
    `h${Math.min(depth + 1, 6)}`,
    { attrs: { ...microdata(heading), id } },
    content.map(encodeNode)
  )
}

/**
 * Decode a `<p>` element to a `stencila.Paragraph`.
 */
function decodeParagraph(para: HTMLParagraphElement): stencila.Paragraph {
  return stencila.paragraph({ content: decodeInlineChildNodes(para) })
}

/**
 * Encode a `stencila.Paragraph` to a `<p>` element.
 */
function encodeParagraph(para: stencila.Paragraph): HTMLParagraphElement {
  return h('p', { attrs: microdata(para) }, para.content.map(encodeNode))
}

/**
 * Decode a `<blockquote>` element to a `stencila.QuoteBlock`.
 */
function decodeBlockquote(elem: HTMLQuoteElement): stencila.QuoteBlock {
  return stencila.quoteBlock({
    content: decodeBlockChildNodes(elem),
    cite: elem.getAttribute('cite') ?? undefined
  })
}

/**
 * Encode a `stencila.QuoteBlock` to a `<blockquote>` element.
 */
function encodeQuoteBlock(block: stencila.QuoteBlock): HTMLQuoteElement {
  return h(
    'blockquote',
    { attrs: microdata(block), cite: block.cite },
    block.content.map(encodeNode)
  )
}

// Regex to test if a string is a URL. Thanks to https://stackoverflow.com/a/3809435
const urlRegex = new RegExp(
  /[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)?/gi
)

export const decodeHref = (href?: string | null): string => {
  if (!isDefined(href)) return '#'
  return href.startsWith('#') ? href.substring(1) : href
}

export const encodeHref = (href?: string | null): string => {
  if (!isDefined(href)) return '#'
  return href.startsWith('#') || urlRegex.test(href) ? href : `#${href}`
}

/**
 * Decode a `<cite>` element to a `stencila.Cite`.
 */
function decodeCite(elem: HTMLElement): stencila.Cite {
  const target = elem.querySelector('a')
  const prefix = elem.querySelector('[itemprop="citePrefix"]')
  const suffix = elem.querySelector('[itemprop="citeSuffix"]')

  return stencila.cite({
    target: decodeHref(target?.getAttribute('href') ?? '#'),
    prefix: isDefined(prefix) ? prefix.textContent ?? undefined : undefined,
    suffix: isDefined(suffix) ? suffix.textContent ?? undefined : undefined
  })
}

/**
 * Encode a `stencila.Cite` to a `<cite>` element.
 */
function encodeCite(cite: stencila.Cite): HTMLElement {
  const { prefix, target, suffix, content, ...lost } = cite
  logWarnLossIfAny('html', 'encode', cite, lost)

  return h(
    'cite',
    encodeAttrs(cite),
    encodeMaybe(prefix, h('span', { itemprop: 'citePrefix' }, [prefix])),
    h('a', { href: encodeHref(target) }, content ?? target),
    encodeMaybe(suffix, h('span', { itemprop: 'citeSuffix' }, [suffix]))
  )
}

/**
 * Decode a `<ol itemtype="https://schema.stenci.la/CiteGroup">` element to a `stencila.CiteGroup`.
 */
function decodeCiteGroup(citeGroup: HTMLOListElement): stencila.CiteGroup {
  return stencila.citeGroup({
    items: [...citeGroup.querySelectorAll<HTMLElement>('cite')].map(decodeCite)
  })
}

/**
 * Encode a `stencila.CiteGroup` element to a `<ol itemtype="https://schema.stenci.la/CiteGroup">`.
 */
function encodeCiteGroup(citeGroup: stencila.CiteGroup): HTMLElement {
  return h('span', encodeAttrs(citeGroup), citeGroup.items.map(encodeCite))
}

/**
 * Decode a `<figure>` element to a `stencila.Figure`.
 */
function decodeFigure(elem: HTMLElement): stencila.Figure {
  const content = decodeNodes(
    [...elem.childNodes].filter(n => n.nodeName.toLowerCase() !== 'figcaption')
  )

  const caption = elem.querySelector('figcaption')

  return stencila.figure({
    id: elem.getAttribute('id') ?? undefined,
    content,
    caption: caption !== null ? decodeFigCaption(caption) : undefined
  })
}

/**
 * Decode a `<figcaption>` element to a list of `stencila.Node`s.
 */
function decodeFigCaption(elem: HTMLElement): stencila.Node[] {
  return decodeChildNodes(elem)
}

/**
 * Encode a `stencila.Figure` element to a `<figure>`.
 */
function encodeFigure(figure: stencila.Figure): HTMLElement {
  const { id, label: title, caption = [], content = [] } = figure
  return h('figure', encodeAttrs(figure, { id, title }), [
    ...encodeNodes(content),
    // TODO: determine best placement of figure label
    // encodeMaybe(label, h('label', label)),
    encodeMaybe(
      caption,
      h(
        'figcaption',
        typeof caption === 'string' ? caption : caption.map(encodeNode)
      )
    )
  ])
}

/**
 * Decode a `<ol itemtype="https://schema.stenci.la/Collection">` element to a `stencila.Collection`.
 */
function decodeCollection(collection: HTMLOListElement): stencila.Collection {
  const parts = flatten(
    [...collection.childNodes].map(decodeChildNodes)
  ).filter(isCreativeWork)
  return stencila.collection({ parts })
}

/**
 * Encode a `stencila.Collection` node to a `<ol itemtype="https://schema.stenci.la/Collection">` element.
 */
function encodeCollection(collection: stencila.Collection): HTMLOListElement {
  return h(
    'ol',
    encodeAttrs(collection),
    collection.parts.map(entry => h('li', encodeNode(entry)))
  )
}

/**
 * Decode a `<pre><code class="language-xxx">` element to a `stencila.CodeBlock`.
 */
function decodeCodeBlock(elem: HTMLPreElement): stencila.CodeBlock {
  const code = elem.querySelector('code')
  if (code === null) throw new Error('Woaah, this should never happen!')
  const { programmingLanguage, text } = decodeCodeFragment(code)
  const meta = decodeDataAttrs(elem)
  return stencila.codeBlock({ programmingLanguage, text, meta })
}

/**
 * Encode a `CodeBlock` to a `<pre class="language-xxx"><code>` element.
 *
 * If the `CodeBlock` has a `meta` property, any keys are added as attributes to
 * the `<pre>` element with a `data-` prefix.
 */
function encodeCodeBlock(block: stencila.CodeBlock): HTMLElement {
  return encodeCode(block, 'pre', h('code', { innerHTML: escape(block.text) }))
}

/**
 * Decode a `<stencila-code-chunk>` element to a Stencila `CodeChunk`.
 */
function decodeCodeChunk(chunk: HTMLElement): stencila.CodeChunk {
  const codeElem = chunk.querySelector('[slot="text"]')
  const codeFrag = decodeCodeFragment(codeElem as HTMLElement)
  const { text, programmingLanguage } = codeFrag

  const outputElems = chunk.querySelectorAll('[slot="outputs"] > *')
  const outputs = Array.from(outputElems).map(elem =>
    decodeCodeOutput(elem as HTMLElement)
  )

  return stencila.codeChunk({ text, programmingLanguage, outputs })
}

/**
 * Encode a Stencila `CodeChunk` to a `<stencila-code-chunk>` element.
 */
function encodeCodeChunk(chunk: stencila.CodeChunk): HTMLElement {
  const { text = '', meta = {}, programmingLanguage, outputs } = chunk

  const codeElem = encodeCodeBlock(
    stencila.codeBlock({ text, programmingLanguage })
  )
  codeElem.setAttribute('slot', 'text')

  const outputsElem = encodeMaybe(outputs, outputs =>
    h(
      'figure',
      {
        attrs: {
          slot: 'outputs'
        }
      },
      outputs.map(encodeCodeOutput)
    )
  )

  return h(
    'stencila-code-chunk',
    encodeAttrs(chunk, { ...meta, programmingLanguage }),
    codeElem,
    outputsElem
  )
}

/**
 * Decode a `<stencila-code-expression>` element to a Stencila `CodeExpression`.
 */
function decodeCodeExpression(elem: HTMLElement): stencila.CodeExpression {
  const codeElem = elem.querySelector('[slot="text"]')
  const { text, ...codeFragment } = decodeCodeFragment(codeElem as HTMLElement)
  const programmingLanguage =
    elem.getAttribute('programming-language') ??
    codeFragment.programmingLanguage

  const outputElem = elem.querySelector('[slot="output"]')
  const output =
    outputElem !== null
      ? decodeCodeOutput(outputElem as HTMLElement)
      : undefined

  return stencila.codeExpression({ text, programmingLanguage, output })
}

/**
 * Encode a Stencila `CodeExpression` to a `<stencila-code-expression>` element.
 */
function encodeCodeExpression(expr: stencila.CodeExpression): HTMLElement {
  const { meta = {}, text, programmingLanguage, output = '' } = expr

  const attrs = encodeDataAttrs(meta)
  if (programmingLanguage !== undefined)
    attrs['programming-language'] = programmingLanguage

  let outputElem
  if (isInlineContent(output)) outputElem = encodeNode(output)
  else {
    log.warn(`CodeExpression output is not InlineContent: ${nodeType(output)}`)
    outputElem = ''
  }

  return h(
    'stencila-code-expression',
    {
      attrs: { ...attrs, ...microdata(expr) }
    },
    [
      h('code', { class: programmingLanguage, attrs: { slot: 'text' } }, text),
      h('output', { attrs: { slot: 'output' } }, outputElem)
    ]
  )
}

/**
 * Decode an output element of a `<stencila-code-chunk>` or
 * `<stencila-code-expression>` to Stencila Node.
 */
const decodeCodeOutput = (elem: HTMLElement): stencila.Node => {
  switch (elem.nodeName.toLowerCase()) {
    case 'output':
    case 'pre':
    case 'span':
      return elem.textContent ?? ''
    default:
      return decodeNode(elem)
  }
}

/**
 * Encode an output of a `CodeChunk` as an `HTMLElement`.
 */
const encodeCodeOutput = (node: stencila.Node): Node => {
  switch (nodeType(node)) {
    case 'Text':
      return h('pre', h('output', node as string))
    default:
      return encodeNode(node)
  }
}

/**
 * Decode a `<ul>` or `<ol>` element to a `stencila.List`.
 */
function decodeList(list: HTMLUListElement | HTMLOListElement): stencila.List {
  const order = list.tagName === 'UL' ? 'unordered' : 'ascending'
  return stencila.list({
    order,
    items: [...list.querySelectorAll('li')].map(decodeListItem)
  })
}

/**
 * Encode a `stencila.List` to a `<ul>` or `<ol>` element.
 *
 * GSDTT requires that each `ListItem` have a `position`.
 * So this function generates a default position (overridden
 * if an item has one) based on the order of items.
 */
function encodeList(list: stencila.List): HTMLUListElement | HTMLOListElement {
  return h(
    list.order === 'unordered' ? 'ul' : 'ol',
    { attrs: microdata(list) },
    list.items.map((item, index) =>
      encodeNode({
        position: item.position ?? index + 1,
        ...item
      })
    )
  )
}

/**
 * Decode a `<li>` element to a `stencila.ListItem`.
 */
function decodeListItem(li: HTMLLIElement): stencila.ListItem {
  return stencila.listItem({ content: decodeChildNodes(li) })
}

/**
 * Encode a `stencila.ListItem` to a `<li>` element.
 *
 * If the `content` of the `ListItem` is a single `Paragraph`
 * then it is "unwrapped".
 *
 * GSDTT requires `position` and `url` on each item.
 * This function ensures that.
 */
function encodeListItem(
  listItem: stencila.ListItem,
  property = 'items'
): HTMLLIElement {
  const { content = [], isChecked, id, position, url } = listItem
  return h(
    'li',
    { attrs: microdata(listItem, property), id: id ?? null },
    h('meta', { attrs: { itemprop: 'position', content: position } }),
    h('meta', { attrs: { itemprop: 'url', content: url ?? `#${position}` } }),
    isChecked === undefined
      ? undefined
      : h('input', { type: 'checkbox', ...(isChecked ? { checked: '' } : {}) }),
    content.length === 1 && stencila.isA('Paragraph', content[0])
      ? encodeNodes(content[0].content)
      : content.map(encodeNode)
  )
}

/**
 * Decode a `<table>` element to a `stencila.Table`.
 */
function decodeTable(table: HTMLTableElement): stencila.Table {
  return stencila.table({
    id: table.getAttribute('id') ?? undefined,
    rows: Array.from(table.querySelectorAll('tr')).map(decodeTableRow)
  })
}

/**
 * Encode a `stencila.Table` to a `<table>` element.
 */
function encodeTable(table: stencila.Table): HTMLTableElement {
  return h(
    'table',
    { id: table.id, attrs: microdata(table) },
    h('tbody', table.rows.map(encodeTableRow))
  )
}

/**
 * Decode a `<tr>` element to a `stencila.TableRow`.
 */
function decodeTableRow(row: HTMLTableRowElement): stencila.TableRow {
  return stencila.tableRow({
    cells: Array.from(row.querySelectorAll('td')).map(decodeTableCell)
  })
}

/**
 * Encode a `stencila.TableRow` to a `<tr>` element.
 */
function encodeTableRow(row: stencila.TableRow): HTMLTableRowElement {
  return h('tr', { attrs: microdata(row) }, row.cells.map(encodeTableCell))
}

/**
 * Decode a `<td>` element to a `stencila.TableCell`.
 */
function decodeTableCell(cell: HTMLTableDataCellElement): stencila.TableCell {
  return stencila.tableCell({
    content: decodeInlineChildNodes(cell)
  })
}

/**
 * Encode a `stencila.TableCell` to a `<td>` element.
 */
function encodeTableCell(cell: stencila.TableCell): HTMLTableDataCellElement {
  return h('td', { attrs: microdata(cell) }, cell.content.map(encodeNode))
}

/**
 * Decode a `<div itemtype="https://schema.stenci.la/Datatable">` element to a Stencila `Datatable` node.
 */
function decodeDatatable(elem: HTMLElement): stencila.Datatable {
  let columns: stencila.DatatableColumn[] = []
  const table = elem.querySelector('table')
  if (table !== null) {
    const thead = table.querySelector('thead')
    if (thead !== null) {
      columns = Array.from(thead.querySelectorAll('tr th')).map(
        (row, index): stencila.DatatableColumn => {
          const th = row.querySelector('th')
          const name = th?.innerText ?? columnIndexToName(index)
          return stencila.datatableColumn({
            name,
            values: []
          })
        }
      )
    }

    const tbody = table.querySelector('tbody')
    if (tbody !== null) {
      let rowi = 0
      for (const row of tbody.querySelectorAll('tr')) {
        let coli = 0
        for (const col of row.querySelectorAll('td')) {
          // TODO: Is further parsing e.g. to a number
          // required here?
          columns[coli].values[rowi] = col.innerHTML
          coli += 1
        }
        rowi += 1
      }
    }
  }

  return stencila.datatable({ columns })
}

/**
 * Encode a Stencila `Datatable` node to a `<div itemtype="https://schema.stenci.la/Datatable">` element.
 *
 * Note: currently this function is lossy for `DatatableColumn` properties
 * other than `name` and `value` (e.g. `schema`). These could be encoded into
 * the `<thead>`.
 */
function encodeDatatable(datatable: stencila.Datatable): HTMLElement {
  const cols = datatable.columns
  const rows = cols?.[0].values.map((_, row) => row) ?? []

  // prettier-ignore
  return h('div',
    encodeAttrs(datatable),
    h('table',
      h('thead',
        h('tr', cols.map(col => (
          h('th', col.name)
        )))
      ),
      h('tbody',rows.map((_, row) => (
        h('tr', cols.map(col => (
          h('td', {attrs: microdata(col)}, col.values[row])
        )))
      )))
    )
  )
}

/**
 * Decode a `<hr>` element to a `stencila.ThematicBreak`.
 */
function decodeHR(): stencila.ThematicBreak {
  return stencila.thematicBreak()
}

/**
 * Encode a `stencila.ThematicBreak` to a `<hr>` element.
 */
function encodeThematicBreak(): HTMLHRElement {
  return h('hr', { attrs: microdata(thematicBreak()) })
}

/**
 * Decode an inline element e.g `<em>` to a `Mark` node e.g. `Emphasis`.
 */
function decodeMark<Type extends keyof typeof markTypes>(
  elem: HTMLElement,
  type: Type
): stencila.Mark {
  return { type, content: decodeInlineChildNodes(elem) }
}

/**
 * Encode a `Mark` node to an inline element e.g. `<em>`.
 */
function encodeMark(node: stencila.Mark, tag: string): HTMLElement {
  return h(tag, { attrs: microdata(node) }, node.content.map(encodeNode))
}

/**
 * Decode a `<a>` element to a `stencila.Link`.
 */
function decodeLink(elem: HTMLAnchorElement): stencila.Link {
  return stencila.link({
    target: elem.getAttribute('href') ?? '#',
    content: decodeInlineChildNodes(elem),
    meta: decodeDataAttrs(elem)
  })
}

/**
 * Encode a `stencila.Link` to a `<a>` element.
 */
function encodeLink(link: stencila.Link): HTMLAnchorElement {
  const attrs = {
    ...encodeDataAttrs(link.meta ?? {}),
    href: link.target,
    attrs: microdata(link)
  }
  return h('a', attrs, link.content.map(encodeNode))
}

/**
 * Decode a `<q>` element to a `stencila.Quote`.
 */
function decodeQuote(elem: HTMLQuoteElement): stencila.Quote {
  return stencila.quote({
    content: [elem.innerHTML],
    cite: elem.getAttribute('cite') ?? undefined
  })
}

/**
 * Encode a `stencila.Quote` to a `<q>` element.
 */
function encodeQuote(quote: stencila.Quote): HTMLQuoteElement {
  return h('q', { attrs: microdata(quote), cite: quote.cite }, quote.content)
}

/**
 * Decode a `<code>` element to a `stencila.CodeFragment`.
 */
function decodeCodeFragment(elem: HTMLElement): stencila.CodeFragment {
  const codeFrag = stencila.codeFragment({ text: elem.textContent ?? '' })
  const clas = elem.getAttribute('class')
  if (clas !== null) {
    const match = /^language-(\w+)$/.exec(clas)
    if (match !== null) {
      codeFrag.programmingLanguage = match[1]
    }
  }
  const meta = decodeDataAttrs(elem)
  if (meta !== undefined) codeFrag.meta = meta
  return codeFrag
}

/**
 * Encode a `CodeFragment` or `CodeBlock` to an element.
 */
function encodeCode(
  node: stencila.CodeFragment | stencila.CodeBlock,
  tag: keyof HTMLElementTagNameMap,
  ...children: HTMLElement[]
): HTMLElement {
  const { meta = {}, programmingLanguage } = node
  return h(
    tag,
    {
      attrs: { ...microdata(node), ...encodeDataAttrs(meta) },
      class:
        programmingLanguage !== undefined
          ? `language-${programmingLanguage}`
          : undefined
    },
    children
  )
}

/**
 * Encode a `stencila.CodeFragment` to a `<code>` element.
 */
function encodeCodeFragment(codeFrag: stencila.CodeFragment): HTMLElement {
  const elem = encodeCode(codeFrag, 'code')
  elem.innerHTML = escape(codeFrag.text)
  return elem
}

/**
 * Decode a HTML `<img>` element to a Stencila `ImageObject`.
 */
function decodeImage(elem: HTMLImageElement): stencila.ImageObject {
  const src = elem.getAttribute('src') ?? ''
  const { title, alt } = elem
  return stencila.imageObject({
    contentUrl: src,
    title: title.length > 0 ? title : undefined,
    text: alt.length > 0 ? alt : undefined
  })
}

/**
 * Encode a Stencila `ImageObject` to a HTML `<img>` element.
 *
 * Ensures that the `alt` attribute is always set (with empty string
 * if there is no other source).
 */
function encodeImageObject(
  image: stencila.ImageObject,
  property?: string
): HTMLImageElement {
  const { contentUrl: src, title, text } = image
  const titleString = title !== undefined ? TxtCodec.stringify(title) : null
  return h('img', {
    attrs: microdata(image, property),
    src,
    title: titleString,
    alt: text ?? titleString ?? property ?? ''
  })
}

/**
 * Decode a HTML `<math>` element (i.e. embedded MathML) to either a
 * Stencila `MathFragment` or `MathBlock` depending on the
 * [`display`](https://developer.mozilla.org/en-US/docs/Web/MathML/Element/math#attr-display)
 * attribute.
 *
 * TODO: This, and `encodeMath`, are preliminary implementations, mainly to try
 * out the new `MathFragment` and `MatchBlock` schema types with HTML. They need
 * to be able to deal with languages other than MathML e.g. TeX, ASCIIMath, probably by encoding
 * `text` in HTML and using KaTeX for genenerating display HTML (since MathMl is
 * not widely supported).
 */
function decodeMath(elem: HTMLElement): stencila.Math {
  const text = elem.innerHTML
  const mathLanguage = 'mathml'
  const display = elem.getAttribute('display')
  return (display === 'block' ? stencila.mathBlock : stencila.mathFragment)({
    text,
    mathLanguage
  })
}

/**
 * Encode a Stencila `Math` node to a HTML.
 *
 * Uses MathJax to render math as HTML because (a) native MathML support is
 * [limited](https://caniuse.com/#feat=mathml) and (b) MathJax rendering in the browser is slow.
 * See https://joa.sh/posts/2015-09-14-prerender-mathjax.html for pros and
 * cons of this approach.
 *
 * In the future this may be replace by a custom web component to allow for
 * editing math, similar to `encodeCodeChunk`.
 */
function encodeMath(math: stencila.Math): HTMLElement {
  const { text, mathLanguage } = math
  const format = mathLanguage?.toLowerCase()
  const elem = h('span', {
    attrs: {
      ...microdata(math)
    }
  })
  mathJaxTypeset(elem, {
    math: text,
    format:
      format === 'mathml'
        ? 'MathML'
        : format === 'asciimath'
        ? 'AsciiMath'
        : stencila.isA('MathFragment', math)
        ? 'inline-TeX'
        : 'TeX',

    html: true,
    css: true
  })
  return elem
}

/**
 * Decode a `<span itemtype="https://schema.stenci.la/Null>` element to a `null`.
 */
function decodeNull(): null {
  return null
}

/**
 * Encode a `null` to a `<span itemtype="https://schema.stenci.la/Null>` element.
 */
function encodeNull(): HTMLElement {
  return h('span', encodeAttrs(null), 'null')
}

/**
 * Decode a `<span itemtype="https://schema.org/Boolean>` element to a `boolean`.
 */
function decodeBoolean(elem: HTMLElement): boolean {
  return elem.innerHTML === 'true'
}

/**
 * Encode a `boolean` to a `<span itemtype="https://schema.org/Boolean>` element.
 */
function encodeBoolean(value: boolean): HTMLElement {
  return h('span', encodeAttrs(value), value === true ? 'true' : 'false')
}

/**
 * Decode a `<span itemtype="https://schema.org/Number>` element to a `number`.
 */
function decodeNumber(elem: HTMLElement): number {
  return parseFloat(elem.innerHTML.length > 0 ? elem.innerHTML : '0')
}

/**
 * Encode a `number` to a `<span itemtype="https://schema.org/Number>` element.
 */
function encodeNumber(value: number): HTMLElement {
  return h('span', encodeAttrs(value), value.toString())
}

/**
 * Decode a `<span itemtype="https://schema.stenci.la/Array>` element to a `array`.
 *
 * Wrap the decoded array with an array to prevent it getting flattened by `decodeNodes`
 */
function decodeArray(elem: HTMLElement): [any[]] {
  return [JSON5.parse(elem.innerHTML.length > 0 ? elem.innerHTML : '[]')]
}

/**
 * Encode a `array` to a `<span itemtype="https://schema.stenci.la/Array>` element.
 */
function encodeArray(value: any[]): HTMLElement {
  return h('span', encodeAttrs(value), JSON5.stringify(value))
}

/**
 * Decode a `<span itemtype="https://schema.stenci.la/Object>` element to a `object`.
 */
function decodeObject(elem: HTMLElement): object {
  return JSON5.parse(elem.innerHTML.length > 0 ? elem.innerHTML : '{}')
}

/**
 * Encode a `object` to a `<span itemtype="https://schema.stenci.la/Object>` element.
 */
function encodeObject(value: object): HTMLElement {
  return h('span', encodeAttrs(value), JSON5.stringify(value))
}

/**
 * Decode a `<span itemtype="...">` element to a `Entity`.
 */
function decodeEntity(elem: HTMLElement): stencila.Entity {
  const json = elem.textContent ?? '{}'
  try {
    return JSON5.parse(json)
  } catch (error) {
    const { stack } = error
    log.error({
      message: `Error parsing JSON: ${json}`,
      stack
    })
    return stencila.entity()
  }
}

/**
 * Encode a node type not handled explicitly by one of the
 * other `encode*` function to a `<span itemtype="https://schema.stenci.la/Entity">` element.
 * We use `itemtype` `Entity` because usually you want to hide these
 * nodes in HTML and the `type` is stored in the JSON anyway.
 */
function encodeEntity(entity: stencila.Entity): HTMLElement {
  return h('span', encodeAttrs(stencila.entity()), JSON5.stringify(entity))
}

/**
 * Decode a `#text` node to a `string`.
 */
function decodeText(text: Text): string {
  return text.data
}

/**
 * Encode a `string` to a `#text` node.
 */
function encodeString(value: string): Text {
  return document.createTextNode(escape(value))
}

/**
 * Create an object with Microdata and other attributes for
 * a node to pass to Hyperscript's `h` functions.
 */
function encodeAttrs(
  node: stencila.Node,
  propertyOrExtra?: string | Record<string, string | undefined>,
  extra?: Record<string, string | undefined>
) {
  const [property, extras] =
    typeof propertyOrExtra === 'string'
      ? [propertyOrExtra, extra]
      : [undefined, propertyOrExtra]
  return {
    attrs: {
      ...microdata(node, property),
      ...encodeDataAttrs(extras ?? {})
    }
  }
}

/**
 * Decode the `data-` attributes of an element into a dictionary
 * of strings.
 */
function decodeDataAttrs(
  elem: HTMLElement
): Record<string, string> | undefined {
  const dict: Record<string, string> = {}
  Array.from(elem.attributes)
    .filter(attr => attr.name.startsWith('data-'))
    .forEach(attr => (dict[attr.name.slice(5)] = attr.value))
  return Object.keys(dict).length > 0 ? dict : undefined
}

// These attribute names are fully-formed, and should not be prefixed with `data-`
const reservedAttrs = [
  'id',
  'slot',
  'name',
  'title',
  'itemscope',
  'itemtype',
  'itemid',
  'itemprop',
  'itemref'
]

/**
 * Encode a dictionary of strings to `data-` attributes to add to
 * an element (the inverse of `decodeDataAttrs`).
 */
function encodeDataAttrs(
  meta: Record<string, string | undefined>
): typeof meta {
  return Object.entries(meta).reduce(
    (attrs, [key, value]) =>
      value !== undefined
        ? {
            ...attrs,
            [reservedAttrs.includes(key) ? key : `data-${key}`]: value
          }
        : attrs,
    {}
  )
}
