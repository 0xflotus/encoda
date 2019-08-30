import * as stencila from '@stencila/schema'
import {getLogger} from '@stencila/logga'
import mime from 'mime'
import path from 'path'
import {
  Codec,
  defaultEncodeOptions,
  GlobalEncodeOptions
} from './codecs/types'
import * as vfile from './util/vfile'
// eslint-disable-next-line import/no-named-default
import { default as log } from './log'

const log = getLogger('encoda')

type VFile = vfile.VFile

/**
 * A list of all codecs.
 *
 * Note that order is of importance for matching. More "generic"
 * formats should go last. See the `match` function.
 */
export const codecList: string[] = [
  // Publishers of content
  'elife',
  'doi',
  'orcid',
  'plos',

  // HTTP. Comes after publishers so that it does not match urls
  // that are specific to a publisher e.g. https://elifesciences.org
  'http',

  // Directories
  'dir',
  'dar',

  // Tabular data, spreadsheets etc
  'csv',
  'ods',
  'tdp',
  'xlsx',

  // Articles, textual documents etc
  'docx',
  'gdoc',
  'html',
  'ipynb',
  'jats',
  'jats-pandoc',
  'latex',
  'md',
  'odt',
  'pdf',
  'txt',
  'xmd',

  // Scripts
  'dmagic',

  // Images
  'rpng',

  // Data interchange formats
  'yaml',
  'pandoc',
  'json5',
  'jsonld',
  'json'
]

/**
 * Match the codec based on file name, extension name, media type or by content sniffing.
 *
 * Iterates through the list of codecs and returns the first that matches based on any
 * of the above criteria.
 *
 * If the supplied format contains a forward slash then it is assumed to be a media type,
 * otherwise an extension name.
 *
 * If trying to find a codec for an output, then `content` is more likely to be a path than
 * actual content. This is passed through to `vfile.isPath` for detection.
 *
 * @param content The content as a file path (e.g. `../folder/file.txt`) or raw content
 * @param format The format as a media type (e.g. `text/plain`) or extension name (e.g. `txt`)
 * @param isOutput `true` if attempting to find a match for an output file
 * @returns A promise that resolves to the `Codec` to use
 */
export async function match(
  content?: string,
  format?: string,
  isOutput: boolean = false
): Promise<Codec> {
  // Resolve variables used to match a codec...
  let fileName
  let extName
  let mediaType

  // If the content is a path then begin with derived values
  if (content && (vfile.isPath(content) || isOutput)) {
    fileName = path.basename(content)
    extName = path
      .extname(content)
      .slice(1)
      .toLowerCase()
    mediaType = mime.getType(content) || undefined
  }

  if (format) {
    // Override with supplied format assuming that
    // media types always have a forward slash and extension names
    // never do.
    if (format.includes('/')) mediaType = format
    else {
      extName = format
      mediaType = mime.getType(extName) || undefined
    }
  }

  /**
   * Get a `Codec` instance from a codec name
   */
  const getCodec = async (name: string): Promise<Codec | undefined> => {
    const exports: { [key: string]: unknown } = await import(`./codecs/${name}`)
    for (const C in exports) {
      // @ts-ignore
      if (exports[C].prototype instanceof Codec) {
        // @ts-ignore
        return new exports[C]()
      }
    }
  }

  const handleGetCodecError = (error: any) => {
    // Do not log MODULE_NOT_FOUND warnings here since not finding a matching module
    // is normal behavior and doing so causes unnecessary noise and anxiety :)

    if (error.code !== 'MODULE_NOT_FOUND') {
      log.warn(error)
    }
  }

  let codec: Codec | undefined

  /**
   * The following try/catch, as well as the for loop is in place for
   * performance optimizations and avoiding loading unnecessary modules. If we
   * find a matching Codec, short-circuit the module loading logic by returning
   * the dynamically imported Codec
   */
  if (extName !== undefined) {
    try {
      codec = await getCodec(extName)
    } catch (error) {
    handleGetCodecError(error)
    }
  }

  if (codec) return codec

  for (const codecName of codecList) {
    try {
      codec = await getCodec(codecName)
    } catch (error) {
      handleGetCodecError(error)
    }

    if (!codec) break

    if (fileName && codec.fileNames && codec.fileNames.includes(fileName)) {
      return codec
    }

    if (extName && codec.extNames && codec.extNames.includes(extName)) {
      return codec
    }

    if (mediaType && codec.mediaTypes && codec.mediaTypes.includes(mediaType)) {
      return codec
    }

    if (content && codec.sniff && (await codec.sniff(content))) {
      return codec
    }
  }

  let message = 'No codec could be found'
  if (content) message += ` for content "${content}"`
  if (format) message += ` for format "${format}"`
  message += '. Falling back to plain text codec.'
  log.warn(message)

  // @ts-ignore
  return getCodec('txt')
}

/**
 * Is the file path, or media type handled? (i.e. is there a codec for it?)
 *
 * @param content The file path
 * @param format The media type
 */
export async function handled(
  content?: string,
  format?: string
): Promise<boolean> {
  try {
    await match(content, format)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Decode a virtual file to a `stencila.Node`
 *
 * @param file The `VFile` to decode
 * @param content The file path
 * @param format The media type
 */
export async function decode(
  file: VFile,
  content?: string,
  format?: string
): Promise<stencila.Node> {
  const codec = await match(content, format)
  return codec.decode(file)
}

/**
 * Encode (i.e. serialize) a `stencila.Node` to a virtual file.
 *
 * @param node The node to encode
 * @param options Encoding options. Should include at least one of:
 *    - filePath The file path to encode the node to.
 *               Only required for some codecs e.g. those encoding to more than one file.
 *    - format The format to encode the node as.
 *             If undefined then determined from filePath or file path.
 */
export const encode = async (
  node: stencila.Node,
  options: GlobalEncodeOptions = defaultEncodeOptions
): Promise<VFile> => {
  const { filePath, format } = options
  if (!(filePath || format)) {
    throw new Error(
      'At least one of "filePath" or "format" option must be provided'
    )
  }
  const codec = await match(filePath, format, true)
  return codec.encode(node, options)
}

/**
 * Load a `stencila.Node` from a string of content.
 *
 * @param content The content to load.
 * @param format The format to load the content as.
 */
export async function load(
  content: string,
  format: string
): Promise<stencila.Node> {
  const file = vfile.load(content)
  return decode(file, undefined, format)
}

/**
 * Dump a `stencila.Node` to a string of content.
 *
 * @param node The node to dump.
 * @param format The format to dump the node as.
 * @param options Encoding options.
 */
export async function dump(
  node: stencila.Node,
  format: string,
  options: GlobalEncodeOptions = defaultEncodeOptions
): Promise<string> {
  const file = await encode(node, { ...options, format })
  return vfile.dump(file)
}

/**
 * Read a file to a `stencila.Node`.
 *
 * @param content The raw content or file path to read.
 *                Use `-` to read from standard input.
 * @param format The format to read the file as.
 *               If undefined then determined from content or file path.
 */
export async function read(
  content: string,
  format?: string
): Promise<stencila.Node> {
  const file = await vfile.read(content)
  return decode(file, content, format)
}

/**
 * Write a `stencila.Node` to a file.
 *
 * @param node The node to write.
 * @param filePath The file system path to write to.
 *                 Use `-` write to standard output.
 * @param options Encoding options.
 */
export async function write(
  node: stencila.Node,
  filePath: string,
  options: GlobalEncodeOptions = defaultEncodeOptions
): Promise<VFile> {
  const file = await encode(node, { ...options, filePath })
  await vfile.write(file, filePath)
  return file
}

interface ConvertOptions {
  to?: string
  from?: string
  encodeOptions?: GlobalEncodeOptions
}

/**
 * Convert content from one format to another.
 *
 * @param input The input content (raw or file path).
 * @param outputPath The output file path.
 * @param options Conversion options e.g `from` and `to`: to specify the formats to convert from/to
 * @returns The converted content, or file path (for converters that only write to files).
 */
export async function convert(
  input: string,
  outputPath?: string,
  { to, from, encodeOptions }: ConvertOptions = {}
): Promise<string | undefined> {
  const inputFile = vfile.create(input)
  const node = await decode(inputFile, input, from)

  const outputFile = await encode(node, {
    ...defaultEncodeOptions,
    format: to,
    filePath: outputPath,
    ...encodeOptions
  })
  if (outputPath) await vfile.write(outputFile, outputPath)
  return outputFile.contents ? vfile.dump(outputFile) : outputFile.path
}
