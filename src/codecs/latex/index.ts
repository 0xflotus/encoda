/**
 * @module latex
 */

import stencila from '@stencila/schema'
import * as vfile from '../../util/vfile'
import * as P from '../pandoc'
import { Codec, defaultEncodeOptions } from '../types'

const pandoc = new P.PandocCodec()

export class LatexCodec extends Codec implements Codec {
  public readonly mediaTypes = ['application/x-latex']

  public readonly extNames = ['latex', 'tex']

  public readonly decode = async (
    file: vfile.VFile
  ): Promise<stencila.Node> => {
    return pandoc.decode(file, { from: P.InputFormat.latex })
  }

  public readonly encode = async (
    node: stencila.Node,
    options = defaultEncodeOptions
  ): Promise<vfile.VFile> => {
    return pandoc.encode(node, {
      ...options,
      format: P.OutputFormat.latex
    })
  }
}
