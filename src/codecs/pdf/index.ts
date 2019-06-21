/**
 * # PDF encoder
 *
 * @module pdf
 */

/** A comment required for above to be included in docs.
 * See https://github.com/christopherthielen/typedoc-plugin-external-module-name/issues/300
 */

import * as stencila from '@stencila/schema'
import { dump, Encode, EncodeOptions } from '../..'
import * as puppeteer from '../../puppeteer'
import bundle from '../../util/bundle'
import { load, VFile } from '../../vfile'

/**
 * The media types that this codec can decode/encode.
 */
export const mediaTypes = ['application/pdf']

// The above media type is registered in the `mime` module
// so there is no need to specify `extNames`

/**
 * This function is required (currently) but is (and probably never will be)
 * implemented.
 */
export async function decode(file: VFile): Promise<stencila.Node> {
  throw new Error(`Parsing of PDF files is not supported.`)
}

/**
 * Encode a Stencila `Node` to a `VFile` with PDF content.
 *
 * @param node The Stencila `Node` to encode
 * @param filePath The file system path to write the PDF to
 * @returns A promise that resolves to a `VFile`
 */
export const encode: Encode = async (
  node: stencila.Node,
  options: EncodeOptions = {}
): Promise<VFile> => {
  const bundled = await bundle(node)
  const html = await dump(bundled, { ...options, format: 'html' })

  const page = await puppeteer.page()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const buffer = await page.pdf({
    path: options.filePath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '2.54cm',
      bottom: '2.54cm',
      left: '2.54cm',
      right: '2.54cm'
    }
  })
  await page.close()

  return load(buffer)
}
