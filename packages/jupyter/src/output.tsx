import type { GenericNode } from 'myst-common';
import { KnownCellOutputMimeTypes } from 'nbtx';
import type { MinifiedMimeOutput, MinifiedOutput } from 'nbtx';
import classNames from 'classnames';
import { SafeOutputs } from './safe.js';
import { JupyterOutputs } from './jupyter.js';
import { useMemo, createContext, useContext } from 'react';
import { useCellExecution } from './execute/index.js';
import type { IdOrKey } from './execute/types.js';
import { usePlaceholder } from './decoration.js';
import { Details, MyST } from 'myst-to-react';
import { selectAll } from 'unist-util-select';

export const DIRECT_OUTPUT_TYPES = new Set(['stream', 'error']);

export const DIRECT_MIME_TYPES = new Set([
  KnownCellOutputMimeTypes.TextPlain,
  KnownCellOutputMimeTypes.ImagePng,
  KnownCellOutputMimeTypes.ImageGif,
  KnownCellOutputMimeTypes.ImageJpeg,
  KnownCellOutputMimeTypes.ImageBmp,
]) as Set<string>;

export function allOutputsAreSafe(
  outputs: MinifiedOutput[],
  directOutputTypes: Set<string>,
  directMimeTypes: Set<string>,
) {
  if (!outputs || outputs.length === 0) return true;
  return outputs.reduce((flag, output) => {
    if (directOutputTypes.has(output.output_type)) return flag && true;
    const data = (output as MinifiedMimeOutput).data;
    const mimetypes = data ? Object.keys(data) : [];
    const safe =
      'data' in output &&
      Boolean(output.data) &&
      mimetypes.every((mimetype) => directMimeTypes.has(mimetype));
    return flag && safe;
  }, true);
}

type OutputsContextType = {
  allSafe: boolean;
  outputsId: IdOrKey;
};
const OutputsContext = createContext<OutputsContextType | null>(null);

export function Output({ node }: { node: GenericNode }) {
  const context = useContext(OutputsContext);
  if (!context) {
    return <> </>;
  }
  const { outputsId, allSafe } = context;
  const { ready } = useCellExecution(outputsId);
  const outputs = [node.jupyter_data];
  return allSafe && !ready ? (
    <SafeOutputs keyStub={outputsId} outputs={outputs} />
  ) : (
    <JupyterOutputs id={outputsId} outputs={outputs} />
  );
}

export function Outputs({ node }: { node: GenericNode }) {
  const className = classNames({ hidden: node.visibility === 'remove' });
  const { children, identifier, align } = node;
  const outputsId = node.id ?? node.key;
  const cellExecutionContext = useCellExecution(outputsId);
  const { ready } = cellExecutionContext;

  const outputs: MinifiedOutput[] = useMemo(
    () => selectAll('output', node).map((child) => (child as any).jupyter_data),
    [children],
  );
  const allSafe = useMemo(
    () => allOutputsAreSafe(outputs, DIRECT_OUTPUT_TYPES, DIRECT_MIME_TYPES),
    [outputs],
  );
  const placeholder = usePlaceholder();

  if (allSafe && !ready && placeholder && (!outputs || outputs.length === 0)) {
    return <MyST ast={placeholder} />;
  }

  const output = (
    <div
      id={identifier || undefined}
      data-mdast-node-id={outputsId}
      className={classNames(
        'max-w-full overflow-y-visible overflow-x-auto m-0 group not-prose relative',
        {
          'text-left': !align || align === 'left',
          'text-center': align === 'center',
          'text-right': align === 'right',
          'mb-5': outputs && outputs.length > 0,
        },
        className,
      )}
    >
      <OutputsContext.Provider value={{ outputsId, allSafe }}>
        <MyST ast={children} />
      </OutputsContext.Provider>
    </div>
  );

  if (node.visibility === 'hide') {
    return <Details title="Output">{output}</Details>;
  }
  return output;
}
