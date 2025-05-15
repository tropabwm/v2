// components/flow/nodes/index.ts

// Re-exporta todos os componentes de nó individuais
export * from './TextMessageNode';
export * from './ButtonMessageNode';
export * from './ImageNode';
export * from './AudioMessageNode';
export * from './FileMessageNode';
export * from './LocationMessageNode';
export * from './ListMessageNode';
export * from './DelayNode';
export * from './WaitInputNode';
export * from './SetVariableNode';
export * from './ConditionNode';
export * from './TimeConditionNode';
export * from './LoopNode';
export * from './ApiCallNode';
export * from './WebhookCallNode';
export * from './GPTQueryNode';
export * from './AIAgentNode'; // <-- Exportando AIAgentNode
export * from './TagContactNode';
export * from './GoToFlowNode';
export * from './AssignAgentNode';
export * from './EndFlowNode';

// Certifique-se de que você criou um arquivo .tsx para cada um desses nomes
// na pasta components/flow/nodes/
