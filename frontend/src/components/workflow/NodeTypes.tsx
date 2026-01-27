import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Hammer, MoreHorizontal } from 'lucide-react';

const AgentNode = memo(({ data }: { data: any }) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-card border-2 border-primary w-[200px]">
      <div className="flex items-center">
        <div className="rounded-full w-8 h-8 flex justify-center items-center bg-primary/10 text-primary">
            <Bot size={16} />
        </div>
        <div className="ml-2">
          <div className="text-sm font-bold">{data.label}</div>
          <div className="text-xs text-muted-foreground">{data.model || 'Agent'}</div>
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary" />
    </div>
  );
});

const ToolNode = memo(({ data }: { data: any }) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-card border border-border w-[180px]">
      <div className="flex items-center">
        <div className="rounded-full w-8 h-8 flex justify-center items-center bg-muted text-foreground">
            <Hammer size={16} />
        </div>
        <div className="ml-2">
          <div className="text-sm font-bold">{data.label}</div>
           <div className="text-xs text-muted-foreground">Tool</div>
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />
    </div>
  );
});

const StartNode = memo(({ data }: { data: any }) => {
    return (
      <div className="px-4 py-2 shadow-md rounded-full bg-green-500 text-white w-[100px] flex justify-center items-center">
        <div className="text-sm font-bold">START</div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-green-700" />
      </div>
    );
  });
  
const EndNode = memo(({ data }: { data: any }) => {
return (
    <div className="px-4 py-2 shadow-md rounded-full bg-red-500 text-white w-[100px] flex justify-center items-center">
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-red-700" />
    <div className="text-sm font-bold">END</div>
    </div>
);
});

export const nodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  start: StartNode,
  end: EndNode,
};
