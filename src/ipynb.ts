/**
 * # IPYNB codec
 *
 * @module ipynb
 */

/** A comment required for above to be included in docs.
 * See https://github.com/christopherthielen/typedoc-plugin-external-module-name/issues/300
 */

import stencila from '@stencila/schema'
import { VFile } from 'vfile'
import { Encode, load } from '.'
import * as md from './md'
import * as vfile from './vfile'

/**
 * The media types that this codec can decode/encode.
 */
export const mediaTypes = ['application/x-ipynb+json']

/**
 * The file extension names associated with this codec.
 */
export const extNames = ['ipynb']

/**
 * Decode a `VFile` with IPYNB content to a Stencila `Node`.
 *
 * @param file The `VFile` to decode
 * @returns A promise that resolves to a Stencila `Node`
 */
export async function decode(file: VFile): Promise<stencila.Node> {
  const json = await vfile.dump(file)
  const ipynb: nbformat.INotebookContent = JSON.parse(json)
  return decodeNotebookContent(ipynb)
}

/**
 * Encode a Stencila `Node` to a `VFile` with IPYNB content.
 *
 * @param thing The Stencila `Node` to encode
 * @returns A promise that resolves to a `VFile`
 */
export const encode: Encode = async (node: stencila.Node): Promise<VFile> => {
  const ipynb = await encodeNode(node)
  const json = JSON.stringify(ipynb, null, '  ')
  return vfile.load(json)
}

async function decodeNotebookContent(
  notebook: nbformat.INotebookContent
): Promise<stencila.Article> {
  const { title, authors } = decodeMetadata(notebook.metadata)

  let cells = notebook.cells
  if (!cells) {
    // For `nbformat` <=3 cells were in a worksheet
    // @ts-ignore
    cells = notebook.worksheets[0].cells
  }
  if (!cells)
    throw new Error('Unable to get cells. Is this a Jupyter Notebook?')

  const content = await decodeCells(cells)
  return {
    type: 'Article',
    title,
    authors,
    content
  }
}

async function encodeNode(
  node: stencila.Node
): Promise<nbformat.INotebookContent> {
  const metadata: nbformat.INotebookMetadata = {
    orig_nbformat: 1
  }
  const cells: nbformat.ICell[] = []
  return {
    nbformat: nbformat.MAJOR_VERSION,
    nbformat_minor: nbformat.MINOR_VERSION,
    metadata,
    cells
  }
}

/**
 *
 * https://github.com/jupyter/nbformat/blob/11903688167d21af96c92f7f5bf0634ab51819f1/nbformat/v4/nbformat.v4.schema.json
 *
 * title: string
 * authors: {name: string}[]
 *
 * @param metadata
 */
function decodeMetadata(metadata: nbformat.INotebookMetadata) {
  const title: string = metadata.title ? metadata.title.toString() : 'Untitled'
  // TODO: coerce authors to `Person[]`
  const authors: stencila.Person[] = []
  return { title, authors }
}

async function decodeCells(
  cells: nbformat.ICell[]
): Promise<stencila.BlockContent[]> {
  const blocks: stencila.BlockContent[] = []
  for (const cell of cells) {
    switch (cell.cell_type) {
      case 'markdown':
        blocks.push(
          ...(await decodeMarkdownCell(cell as nbformat.IMarkdownCell))
        )
        break
      case 'code':
        blocks.push(await decodeCodeCell(cell as nbformat.ICodeCell))
        break
      case 'raw':
        break
      default:
        // The above should handle all cell types but in case of an invalid
        // type, instead of throwing an error, return cell as a JSON code block of cell
        blocks.push({
          type: 'CodeBlock',
          language: 'json',
          value: JSON.stringify(cell)
        })
    }
  }
  return blocks
}

async function decodeMarkdownCell(
  cell: nbformat.IMarkdownCell
): Promise<stencila.BlockContent[]> {
  const { metadata, source } = cell
  const markdown = decodeMultilineString(source)
  const node = await md.decode(vfile.load(markdown))
  const article = node as stencila.Article
  return article.content as stencila.BlockContent[]
}

async function decodeCodeCell(
  cell: nbformat.ICodeCell
): Promise<stencila.CodeChunk> {
  const { metadata, source, outputs, execution_count } = cell
  const code = decodeMultilineString(source)
  const codeChunk: stencila.CodeChunk = {
    type: 'CodeChunk',
    text: code
  }
  if (outputs && outputs.length)
    codeChunk.outputs = await decodeOutputs(outputs)
  return codeChunk
}

function decodeMultilineString(source: nbformat.MultilineString): string {
  return Array.isArray(source) ? source.join('') : source
}

function decodeOutputs(outputs: nbformat.IOutput[]): Promise<stencila.Node[]> {
  return Promise.all(
    outputs.map(async output => {
      switch (output.output_type) {
        case 'execute_result':
        case 'display_data':
        case 'update_display_data':
        case 'pyout': // nbformat 3
          let data = output.data
          // nbformat 3: there is no separate data dictionary and
          // the output is `IMimeBundle` like (but with format name, not MIME types)
          if (!data) {
            const { output_type, prompt_number, ...rest } = output
            data = rest
          }
          return await decodeMimeBundle(data as nbformat.IMimeBundle)
        case 'stream':
          return await decodeMultilineString(
            output.text as nbformat.MultilineString
          )
        case 'error':
          return ''
        default:
          // The above should handle all output types but in case of an invalid
          // type, instead of throwing an error, return a JSON code block of output
          return {
            type: 'CodeBlock',
            language: 'json',
            value: JSON.stringify(output)
          }
      }
    })
  )
}

/**
 * Decode a Jupyter `MimeBundle` to a Stencila `Node`.
 *
 * The bundle is a dictionary of {mediaType : content}. We iterate over
 * the dictionary until we find the first media type that can be decoded.
 */
async function decodeMimeBundle(
  data: nbformat.IMimeBundle
): Promise<stencila.Node> {
  for (const [mediaType, content] of Object.entries(data)) {
    const contentString =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
        ? content.join('')
        : content.toString()
    if (mediaType === 'png') {
      const image: stencila.ImageObject = {
        type: 'ImageObject',
        contentUrl: `data:image/png;base64,${content}`
      }
      return image
    } else return await load(contentString, mediaType)
  }
  return ''
}

/**
 * The following type definitions have been vendored in from
 * `@jupyterlab/coreutils` because the current version fails to build.
 * Here the `JSONObject` is defined to fix those issues.
 *
 * import { nbformat } from '@jupyterlab/coreutils';
 */

type JSONObject = { [key: string]: any }

/**
 * A namespace for nbformat interfaces.
 */
export declare namespace nbformat {
  /**
   * The major version of the notebook format.
   */
  const MAJOR_VERSION: number
  /**
   * The minor version of the notebook format.
   */
  const MINOR_VERSION: number
  /**
   * The kernelspec metadata.
   */
  interface IKernelspecMetadata extends JSONObject {
    name: string
    display_name: string
  }
  /**
   * The language info metatda
   */
  interface ILanguageInfoMetadata extends JSONObject {
    name: string
    codemirror_mode?: string | JSONObject
    file_extension?: string
    mimetype?: string
    pygments_lexer?: string
  }
  /**
   * The default metadata for the notebook.
   */
  interface INotebookMetadata extends JSONObject {
    kernelspec?: IKernelspecMetadata
    language_info?: ILanguageInfoMetadata
    orig_nbformat: number
  }
  /**
   * The notebook content.
   */
  interface INotebookContent extends JSONObject {
    metadata: INotebookMetadata
    nbformat_minor: number
    nbformat: number
    cells: ICell[]
  }
  /**
   * A multiline string.
   */
  type MultilineString = string | string[]
  /**
   * A mime-type keyed dictionary of data.
   */
  interface IMimeBundle extends JSONObject {
    [key: string]: MultilineString | JSONObject
  }
  /**
   * Media attachments (e.g. inline images).
   */
  interface IAttachments {
    [key: string]: IMimeBundle
  }
  /**
   * The code cell's prompt number. Will be null if the cell has not been run.
   */
  type ExecutionCount = number | null
  /**
   * Cell output metadata.
   */
  type OutputMetadata = JSONObject
  /**
   * Validate a mime type/value pair.
   *
   * @param type - The mimetype name.
   *
   * @param value - The value associated with the type.
   *
   * @returns Whether the type/value pair are valid.
   */
  function validateMimeValue(
    type: string,
    value: MultilineString | JSONObject
  ): boolean
  /**
   * A type which describes the type of cell.
   */
  type CellType = 'code' | 'markdown' | 'raw'
  /**
   * The Jupyter metadata namespace.
   */
  interface IBaseCellJupyterMetadata extends JSONObject {
    /**
     * Whether the source is hidden.
     */
    source_hidden: boolean
  }
  /**
   * Cell-level metadata.
   */
  interface IBaseCellMetadata extends JSONObject {
    /**
     * Whether the cell is trusted.
     *
     * #### Notes
     * This is not strictly part of the nbformat spec, but it is added by
     * the contents manager.
     *
     * See https://jupyter-notebook.readthedocs.io/en/latest/security.html.
     */
    trusted: boolean
    /**
     * The cell's name. If present, must be a non-empty string.
     */
    name: string
    /**
     * The Jupyter metadata namespace
     */
    jupyter: Partial<IBaseCellJupyterMetadata>
    /**
     * The cell's tags. Tags must be unique, and must not contain commas.
     */
    tags: string[]
  }
  /**
   * The base cell interface.
   */
  interface IBaseCell extends JSONObject {
    /**
     * String identifying the type of cell.
     */
    cell_type: string
    /**
     * Contents of the cell, represented as an array of lines.
     */
    source: MultilineString
    /**
     * Cell-level metadata.
     */
    metadata: Partial<ICellMetadata>
  }
  /**
   * Metadata for the raw cell.
   */
  interface IRawCellMetadata extends IBaseCellMetadata {
    /**
     * Raw cell metadata format for nbconvert.
     */
    format: string
  }
  /**
   * A raw cell.
   */
  interface IRawCell extends IBaseCell {
    /**
     * String identifying the type of cell.
     */
    cell_type: 'raw'
    /**
     * Cell-level metadata.
     */
    metadata: Partial<IRawCellMetadata>
    /**
     * Cell attachments.
     */
    attachments?: IAttachments
  }
  /**
   * A markdown cell.
   */
  interface IMarkdownCell extends IBaseCell {
    /**
     * String identifying the type of cell.
     */
    cell_type: 'markdown'
    /**
     * Cell attachments.
     */
    attachments?: IAttachments
  }
  /**
   * The Jupyter metadata namespace for code cells.
   */
  interface ICodeCellJupyterMetadata extends IBaseCellJupyterMetadata {
    /**
     * Whether the outputs are hidden. See https://github.com/jupyter/nbformat/issues/137.
     */
    outputs_hidden: boolean
  }
  /**
   * Metadata for a code cell.
   */
  interface ICodeCellMetadata extends IBaseCellMetadata {
    /**
     * Whether the cell is collapsed/expanded.
     */
    collapsed: boolean
    /**
     * The Jupyter metadata namespace
     */
    jupyter: Partial<ICodeCellJupyterMetadata>
    /**
     * Whether the cell's output is scrolled, unscrolled, or autoscrolled.
     */
    scrolled: boolean | 'auto'
  }
  /**
   * A code cell.
   */
  interface ICodeCell extends IBaseCell {
    /**
     * String identifying the type of cell.
     */
    cell_type: 'code'
    /**
     * Cell-level metadata.
     */
    metadata: Partial<ICodeCellMetadata>
    /**
     * Execution, display, or stream outputs.
     */
    outputs: IOutput[]
    /**
     * The code cell's prompt number. Will be null if the cell has not been run.
     */
    execution_count: ExecutionCount
  }
  /**
   * An unrecognized cell.
   */
  interface IUnrecognizedCell extends IBaseCell {}
  /**
   * A cell union type.
   */
  type ICell = IRawCell | IMarkdownCell | ICodeCell | IUnrecognizedCell
  /**
   * Test whether a cell is a raw cell.
   */
  function isRaw(cell: ICell): cell is IRawCell
  /**
   * Test whether a cell is a markdown cell.
   */
  function isMarkdown(cell: ICell): cell is IMarkdownCell
  /**
   * Test whether a cell is a code cell.
   */
  function isCode(cell: ICell): cell is ICodeCell
  /**
   * A union metadata type.
   */
  type ICellMetadata = IBaseCellMetadata | IRawCellMetadata | ICodeCellMetadata
  /**
   * The valid output types.
   */
  type OutputType =
    | 'execute_result'
    | 'display_data'
    | 'stream'
    | 'error'
    | 'update_display_data'
  /**
   * The base output type.
   */
  interface IBaseOutput extends JSONObject {
    /**
     * Type of cell output.
     */
    output_type: string
  }
  /**
   * Result of executing a code cell.
   */
  interface IExecuteResult extends IBaseOutput {
    /**
     * Type of cell output.
     */
    output_type: 'execute_result'
    /**
     * A result's prompt number.
     */
    execution_count: ExecutionCount
    /**
     * A mime-type keyed dictionary of data.
     */
    data: IMimeBundle
    /**
     * Cell output metadata.
     */
    metadata: OutputMetadata
  }
  /**
   * Data displayed as a result of code cell execution.
   */
  interface IDisplayData extends IBaseOutput {
    /**
     * Type of cell output.
     */
    output_type: 'display_data'
    /**
     * A mime-type keyed dictionary of data.
     */
    data: IMimeBundle
    /**
     * Cell output metadata.
     */
    metadata: OutputMetadata
  }
  /**
   * Data displayed as an update to existing display data.
   */
  interface IDisplayUpdate extends IBaseOutput {
    /**
     * Type of cell output.
     */
    output_type: 'update_display_data'
    /**
     * A mime-type keyed dictionary of data.
     */
    data: IMimeBundle
    /**
     * Cell output metadata.
     */
    metadata: OutputMetadata
  }
  /**
   * Stream output from a code cell.
   */
  interface IStream extends IBaseOutput {
    /**
     * Type of cell output.
     */
    output_type: 'stream'
    /**
     * The name of the stream.
     */
    name: StreamType
    /**
     * The stream's text output.
     */
    text: MultilineString
  }
  /**
   * An alias for a stream type.
   */
  type StreamType = 'stdout' | 'stderr'
  /**
   * Output of an error that occurred during code cell execution.
   */
  interface IError extends IBaseOutput {
    /**
     * Type of cell output.
     */
    output_type: 'error'
    /**
     * The name of the error.
     */
    ename: string
    /**
     * The value, or message, of the error.
     */
    evalue: string
    /**
     * The error's traceback.
     */
    traceback: string[]
  }
  /**
   * Unrecognized output.
   */
  interface IUnrecognizedOutput extends IBaseOutput {}
  /**
   * Test whether an output is an execute result.
   */
  function isExecuteResult(output: IOutput): output is IExecuteResult
  /**
   * Test whether an output is from display data.
   */
  function isDisplayData(output: IOutput): output is IDisplayData
  /**
   * Test whether an output is from updated display data.
   */
  function isDisplayUpdate(output: IOutput): output is IDisplayUpdate
  /**
   * Test whether an output is from a stream.
   */
  function isStream(output: IOutput): output is IStream
  /**
   * Test whether an output is from a stream.
   */
  function isError(output: IOutput): output is IError
  /**
   * An output union type.
   */
  type IOutput =
    | IUnrecognizedOutput
    | IExecuteResult
    | IDisplayData
    | IStream
    | IError
}
