export type ChatRole = 'user' | 'assistant' | 'thought'

export type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  seq: number
}

export type ToolCard = {
  id: string
  title: string
  status: 'running' | 'done' | 'error'
  input: string
  output: string
  seq?: number
}

export type SubagentCard = {
  id: string
  title: string
  status: string
  summary: string
  taskId: string
}

export type BackgroundTask = {
  id: string
  title: string
  status: string
  output: string
}

export type PermissionMode = 'ask' | 'auto' | 'always-approve' | 'plan'

export type ConfigOption = {
  id: string
  name: string
  currentValue: string
  options: Array<{ value: string; name: string }>
}

export type SlashCommand = {
  name: string
  description: string
  source: 'agent' | 'client'
  hint?: string
}

export type QuestionCard = {
  id: string
  requestId: number
  question: string
  options: Array<{ label: string; description: string }>
  multiSelect: boolean
}

export type PermissionCard = {
  id: string
  requestId: number
  method: string
  title: string
  detail: string
}

export type PlanDecision = 'approve' | 'request-changes' | 'comment' | 'copy' | 'quit'

export type PlanReview = {
  markdown: string
  empty: boolean
  pending: boolean
  comments: string[]
  requestId?: number
}

export type AcpEvent =
  | { type: 'status'; text: string }
  | { type: 'message'; role: ChatRole; text: string; append: boolean }
  | { type: 'tool'; tool: ToolCard }
  | { type: 'plan'; markdown: string; pending: boolean; requestId?: number }
  | { type: 'subagent'; agent: SubagentCard }
  | { type: 'background'; task: BackgroundTask }
  | { type: 'question'; question: QuestionCard }
  | { type: 'permission'; permission: PermissionCard }
  | { type: 'commands'; commands: SlashCommand[] }
  | { type: 'config'; options: ConfigOption[] }
  | { type: 'mode'; mode: PermissionMode }
  | { type: 'usage'; totalTokens: number; turns: number }
  | { type: 'turn-done'; stopReason: string }
  | { type: 'error'; text: string }

export type RpcCall = {
  method: string
  params: Record<string, unknown>
}

export type CommandResult = {
  calls: RpcCall[]
  local?:
    | { type: 'mode'; mode: PermissionMode }
    | { type: 'plan-preview' }
    | { type: 'copy'; which: number }
    | { type: 'export' }
    | { type: 'rewind-picker' }
    | { type: 'rename'; title: string }
    | { type: 'history' }
    | { type: 'btw'; text: string }
    | { type: 'usage' }
    | { type: 'feedback'; text: string }
    | { type: 'new' }
    | { type: 'clear' }
    | { type: 'unsupported'; name: string }
  sendPrompt?: string
  note?: string
}

type Update = {
  sessionUpdate?: string
  content?: { type?: string; text?: string } | Array<{ type?: string; content?: { text?: string } }>
  toolCallId?: string
  title?: string
  rawInput?: Record<string, unknown>
  status?: string
  kind?: string
  reason?: string
  percentage?: number
  tokens_before?: number
  tokens_after?: number
  entries?: Array<{ content?: string; status?: string; priority?: string }>
  availableCommands?: Array<{ name?: string; description?: string; input?: { hint?: string } | null }>
  _meta?: {
    'x.ai/tool'?: { name?: string }
    subagentBackground?: boolean
  }
}

export const CLIENT_COMMANDS: SlashCommand[] = [
  { name: 'model', description: 'Switch the session model', source: 'client', hint: '<model id>' },
  { name: 'effort', description: 'Set reasoning effort', source: 'client', hint: 'low|medium|high|xhigh' },
  { name: 'always-approve', description: 'Always approve tool calls', source: 'client', hint: 'on|off' },
  { name: 'auto', description: 'Auto permission mode', source: 'client' },
  { name: 'plan', description: 'Enter plan mode, optionally with a description', source: 'client', hint: '[description]' },
  { name: 'view-plan', description: 'Reopen the saved plan', source: 'client' },
  { name: 'compact', description: 'Compress conversation history', source: 'client', hint: '[what to keep]' },
  { name: 'rewind', description: 'Rewind conversation without restoring files', source: 'client' },
  { name: 'copy', description: 'Copy a response', source: 'client', hint: '[n]' },
  { name: 'export', description: 'Export the conversation', source: 'client' },
  { name: 'rename', description: 'Rename the session', source: 'client', hint: '<title>' },
  { name: 'context', description: 'Show context usage', source: 'client' },
  { name: 'session-info', description: 'Show session details', source: 'client' },
  { name: 'fork', description: 'Fork this session', source: 'client' },
  { name: 'history', description: 'Recall prior prompts', source: 'client' },
  { name: 'btw', description: 'Side note that does not start a turn', source: 'client', hint: '<text>' },
  { name: 'usage', description: 'Show token usage', source: 'client' },
  { name: 'feedback', description: 'Send feedback', source: 'client', hint: '<text>' },
  { name: 'new', description: 'Start a fresh conversation', source: 'client' },
  { name: 'clear', description: 'Clear the conversation', source: 'client' }
]

const MODE_IDS: Record<PermissionMode, string> = {
  ask: 'default',
  auto: 'auto',
  'always-approve': 'always_approve',
  plan: 'plan'
}

export function modeId(mode: PermissionMode): string {
  return MODE_IDS[mode]
}

export function textOf(update: Update): string {
  if (Array.isArray(update.content)) {
    return update.content.map((part) => part.content?.text || '').join('')
  }
  return update.content?.text ?? ''
}

export function toolInput(raw: Record<string, unknown> | undefined): string {
  if (!raw) return ''
  const command = raw.command
  const description = raw.description
  if (typeof command === 'string') return command
  if (typeof description === 'string') return description
  return JSON.stringify(raw).slice(0, 500)
}

function toolName(update: Update): string {
  return String(update._meta?.['x.ai/tool']?.name || update.rawInput?.name || update.title || 'tool')
}

export function reduceUpdate(update: Update): AcpEvent[] {
  const kind = update.sessionUpdate
  if (kind === 'user_message_chunk') {
    return [{ type: 'message', role: 'user', text: textOf(update), append: true }]
  }
  if (kind === 'agent_message_chunk') {
    return [{ type: 'message', role: 'assistant', text: textOf(update), append: true }]
  }
  if (kind === 'agent_thought_chunk') {
    return [{ type: 'message', role: 'thought', text: textOf(update), append: true }]
  }
  if (kind === 'available_commands_update') {
    const commands = (update.availableCommands ?? [])
      .filter((command) => command.name)
      .map((command) => ({
        name: String(command.name),
        description: command.description || '',
        source: 'agent' as const,
        hint: command.input?.hint
      }))
    return [{ type: 'commands', commands }]
  }
  if (kind === 'tool_call' || kind === 'tool_call_update') {
    const name = toolName(update)
    const title = update.title || name
    const status = update.status === 'failed' ? 'error' : kind === 'tool_call_update' ? 'done' : 'running'
    const events: AcpEvent[] = [
      {
        type: 'tool',
        tool: {
          id: update.toolCallId || title,
          title,
          status,
          input: toolInput(update.rawInput),
          output: textOf(update)
        }
      }
    ]
    if (name === 'spawn_subagent' || title === 'spawn_subagent') {
      const description = String(update.rawInput?.description || update.rawInput?.prompt || title)
      events.push({
        type: 'subagent',
        agent: {
          id: update.toolCallId || description,
          title: description.slice(0, 80),
          status: status === 'running' ? 'running' : status,
          summary: textOf(update),
          taskId: update.toolCallId || description
        }
      })
    }
    if (name === 'exit_plan_mode' || title === 'exit_plan_mode' || name === 'enter_plan_mode') {
      events.push({ type: 'plan', markdown: '', pending: true })
    }
    return events
  }
  if (kind === 'plan') {
    const markdown = (update.entries ?? [])
      .map((entry) => `- [${entry.status || 'pending'}] ${entry.content || ''}`)
      .join('\n')
    return [{ type: 'plan', markdown, pending: true }]
  }
  if (kind === 'auto_compact_started') {
    const percent = update.percentage != null ? ` (${update.percentage}%)` : ''
    return [{ type: 'status', text: `compacting${percent}` }, { type: 'message', role: 'thought', text: `Compacting conversation${update.reason ? `: ${update.reason}` : ''}.`, append: false }]
  }
  if (kind === 'compaction_checkpoint') {
    return [{ type: 'status', text: 'compacting' }]
  }
  if (kind === 'auto_compact_completed') {
    const after = update.tokens_after != null ? ` · ${update.tokens_after} tokens` : ''
    return [{ type: 'status', text: `compacted${after}` }, { type: 'message', role: 'thought', text: `Compacted${update.tokens_before != null ? ` from ${update.tokens_before}` : ''}${after}.`, append: false }]
  }
  return []
}

export function reduceNotification(method: string, params: Record<string, unknown>): AcpEvent[] {
  if (method === '_x.ai/session_notification') {
    const update = (params.update || {}) as Record<string, unknown>
    const kind = String(update.sessionUpdate || '')
    if (kind === 'subagent_spawned') {
      const id = String(update.subagent_id || update.child_session_id || '')
      return [
        {
          type: 'subagent',
          agent: {
            id,
            title: String(update.description || 'subagent'),
            status: 'running',
            summary: '',
            taskId: id
          }
        }
      ]
    }
    if (kind === 'subagent_finished') {
      const id = String(update.subagent_id || update.child_session_id || '')
      return [
        {
          type: 'subagent',
          agent: {
            id,
            title: String(update.description || 'subagent'),
            status: String(update.status || 'done'),
            summary: String(update.output || ''),
            taskId: id
          }
        }
      ]
    }
    if (kind === 'tool_progress' || kind === 'background_task') {
      const id = String(update.task_id || update.tool_call_id || update.id || '')
      if (!id) return []
      return [
        {
          type: 'background',
          task: {
            id,
            title: String(update.title || update.command || 'background task'),
            status: String(update.status || 'running'),
            output: String(update.output || '')
          }
        }
      ]
    }
    if (kind === 'turn_completed' || kind === 'response_completed') {
      const usage = (update.usage || {}) as { totalTokens?: number; numTurns?: number }
      if (usage.totalTokens != null) {
        return [{ type: 'usage', totalTokens: usage.totalTokens, turns: usage.numTurns || 0 }]
      }
    }
  }
  return []
}

export type TranscriptBlock =
  | { kind: 'message'; id: string; role: 'user' | 'assistant'; text: string }
  | { kind: 'reasoning'; id: string; text: string }
  | { kind: 'tool'; id: string; title: string; status: ToolCard['status']; input: string; output: string }

export type ChatState = {
  messages: ChatMessage[]
  tools: ToolCard[]
  queue: string[]
  busy: boolean
  mode: PermissionMode
  plan: PlanReview | null
  question: QuestionCard | null
  permission: PermissionCard | null
  subagents: SubagentCard[]
  tasks: BackgroundTask[]
  commands: SlashCommand[]
  config: ConfigOption[]
  prompts: string[]
  usage: { totalTokens: number; turns: number }
  restoredFiles: boolean
  nextSeq: number
}

export function emptyState(): ChatState {
  return {
    messages: [],
    tools: [],
    queue: [],
    busy: false,
    mode: 'ask',
    plan: null,
    question: null,
    permission: null,
    subagents: [],
    tasks: [],
    commands: CLIENT_COMMANDS,
    config: [],
    prompts: [],
    usage: { totalTokens: 0, turns: 0 },
    restoredFiles: false,
    nextSeq: 1
  }
}

export function applyEvent(state: ChatState, event: AcpEvent): ChatState {
  if (event.type === 'message') {
    const last = state.messages[state.messages.length - 1]
    const messages =
      event.append && last?.role === event.role
        ? [...state.messages.slice(0, -1), { ...last, text: last.text + event.text }]
        : [...state.messages, { id: `${state.messages.length + 1}`, role: event.role, text: event.text, seq: state.nextSeq }]
    return { ...state, messages, nextSeq: event.append && last?.role === event.role ? state.nextSeq : state.nextSeq + 1 }
  }
  if (event.type === 'tool') {
    const index = state.tools.findIndex((tool) => tool.id === event.tool.id)
    if (index === -1) {
      return { ...state, tools: [...state.tools, { ...event.tool, seq: state.nextSeq }], nextSeq: state.nextSeq + 1 }
    }
    const tools = state.tools.map((tool, i) => (i === index ? { ...tool, ...event.tool, seq: tool.seq, output: event.tool.output || tool.output } : tool))
    return { ...state, tools }
  }
  if (event.type === 'turn-done') return { ...state, busy: false }
  if (event.type === 'plan') {
    const markdown = event.markdown || state.plan?.markdown || ''
    return {
      ...state,
      plan: {
        markdown,
        empty: markdown.trim().length === 0,
        pending: event.pending,
        comments: state.plan?.comments ?? [],
        requestId: event.requestId ?? state.plan?.requestId
      }
    }
  }
  if (event.type === 'question') return { ...state, question: event.question }
  if (event.type === 'permission') return { ...state, permission: event.permission }
  if (event.type === 'mode') return { ...state, mode: event.mode }
  if (event.type === 'commands') {
    const agentNames = new Set(event.commands.map((command) => command.name))
    const client = CLIENT_COMMANDS.filter((command) => !agentNames.has(command.name))
    return { ...state, commands: [...event.commands, ...client] }
  }
  if (event.type === 'config') return { ...state, config: event.options }
  if (event.type === 'usage') return { ...state, usage: { totalTokens: event.totalTokens, turns: event.turns } }
  if (event.type === 'subagent') {
    const index = state.subagents.findIndex((agent) => agent.id === event.agent.id)
    const subagents = index === -1 ? [...state.subagents, event.agent] : state.subagents.map((agent, i) => (i === index ? { ...agent, ...event.agent } : agent))
    return { ...state, subagents }
  }
  if (event.type === 'background') {
    const index = state.tasks.findIndex((task) => task.id === event.task.id)
    const tasks = index === -1 ? [...state.tasks, event.task] : state.tasks.map((task, i) => (i === index ? { ...task, ...event.task } : task))
    return { ...state, tasks }
  }
  return state
}

export function visibleTranscript(state: ChatState): TranscriptBlock[] {
  const blocks: Array<TranscriptBlock & { seq: number }> = []
  for (const message of state.messages) {
    if (!message.text.trim()) continue
    if (message.role === 'thought') {
      blocks.push({ kind: 'reasoning', id: message.id, text: message.text, seq: message.seq })
      continue
    }
    blocks.push({ kind: 'message', id: message.id, role: message.role, text: message.text, seq: message.seq })
  }
  for (const tool of state.tools) {
    blocks.push({ kind: 'tool', id: tool.id, title: tool.title, status: tool.status, input: tool.input, output: tool.output, seq: tool.seq })
  }
  return blocks.sort((left, right) => left.seq - right.seq).map(({ seq: _seq, ...block }) => block)
}

export function modeCommand(mode: string): string {
  if (mode === 'always-approve') return '/always-approve'
  if (mode === 'plan') return '/plan'
  if (mode === 'auto') return '/auto'
  return '/always-approve off'
}

export function composerControlClass(): string {
  return 'shrink-0 max-w-full'
}

export function composerControls(): Array<{ id: 'mode' | 'model' | 'effort' | 'usage' | 'stop'; className: string }> {
  const className = composerControlClass()
  return [
    { id: 'mode', className },
    { id: 'model', className },
    { id: 'effort', className },
    { id: 'usage', className },
    { id: 'stop', className }
  ]
}

export function sessionChips(state: ChatState): Array<{ id: string; label: string; value: string }> {
  const model = state.config.find((option) => option.id === 'model')
  const effort = state.config.find((option) => option.id === 'reasoning_effort')
  return [
    { id: 'model', label: 'model', value: model?.currentValue || 'unset' },
    { id: 'effort', label: 'effort', value: effort?.currentValue || 'unset' },
    { id: 'mode', label: 'mode', value: state.mode },
    { id: 'usage', label: 'usage', value: `${state.usage.totalTokens} tok` }
  ]
}

export function composerKeyAction(
  key: string,
  shiftKey: boolean,
  draft: string,
  matches: SlashCommand[],
  menu: number
): { type: 'newline' } | { type: 'fill'; draft: string } | { type: 'run'; line: string } | { type: 'submit' } | { type: 'ignore' } {
  if (key !== 'Enter') return { type: 'ignore' }
  if (shiftKey) return { type: 'newline' }
  const chosen = matches[menu]
  if (draft.startsWith('/') && chosen && !draft.includes(' ')) {
    if (chosen.hint) return { type: 'fill', draft: `/${chosen.name} ` }
    return { type: 'run', line: `/${chosen.name}` }
  }
  return { type: 'submit' }
}

export function blockScrolls(block: TranscriptBlock): boolean {
  if (block.kind === 'tool' || block.kind === 'reasoning') return true
  return block.text.length > 280
}

export const PLAN_ACTIONS: Array<{ decision: PlanDecision; label: string }> = [
  { decision: 'approve', label: 'Approve' },
  { decision: 'request-changes', label: 'Request changes' },
  { decision: 'comment', label: 'Comment' },
  { decision: 'copy', label: 'Copy' },
  { decision: 'quit', label: 'Quit' }
]

export function planActions(plan: PlanReview | null): Array<{ decision: PlanDecision; label: string }> {
  if (!plan || plan.empty || !plan.pending) return []
  return PLAN_ACTIONS
}

export function planActionsVisible(plan: PlanReview | null): boolean {
  return planActions(plan).length > 0
}

export function queueVisible(state: ChatState): boolean {
  return state.queue.length > 0
}

export function enqueuePrompt(state: ChatState, text: string): { state: ChatState; sendNow: string | null } {
  const trimmed = text.trim()
  if (!trimmed) return { state, sendNow: null }
  const prompts = [...state.prompts, trimmed]
  const messages = [...state.messages, { id: `u${state.messages.length + 1}`, role: 'user' as const, text: trimmed, seq: state.nextSeq }]
  const next = { ...state, prompts, messages, nextSeq: state.nextSeq + 1 }
  if (state.busy) {
    return { state: { ...next, queue: [...state.queue, trimmed] }, sendNow: null }
  }
  return { state: { ...next, busy: true }, sendNow: trimmed }
}

export function finishTurn(state: ChatState): { state: ChatState; sendNext: string | null } {
  const [next, ...rest] = state.queue
  if (!next) return { state: { ...state, busy: false, queue: [] }, sendNext: null }
  return { state: { ...state, busy: true, queue: rest }, sendNext: next }
}

export function cancelRequest(sessionId: string): RpcCall {
  return { method: 'session/cancel', params: { sessionId } }
}

export function applyCancel(state: ChatState): ChatState {
  return { ...state, busy: false }
}

export function rewindToUserTurn(state: ChatState, userTurnIndex: number): { state: ChatState; call: RpcCall } {
  const userIndexes = state.messages
    .map((message, index) => (message.role === 'user' ? index : -1))
    .filter((index) => index >= 0)
  const cut = userIndexes[userTurnIndex] ?? state.messages.length
  return {
    state: {
      ...state,
      messages: state.messages.slice(0, cut),
      queue: [],
      restoredFiles: false
    },
    call: {
      method: '_x.ai/rewind/execute',
      params: { targetPromptIndex: userTurnIndex, mode: 'conversation_only' }
    }
  }
}

export function planDecisionResult(decision: PlanDecision, notes = ''): Record<string, unknown> {
  if (decision === 'copy') return {}
  if (decision === 'approve') return { outcome: 'approved', notes }
  if (decision === 'quit') return { outcome: 'abandoned', notes }
  if (decision === 'request-changes') return { outcome: 'rejected', notes }
  return { outcome: 'comment', notes }
}

export function planDecisionCall(decision: PlanDecision, notes = ''): RpcCall {
  return {
    method: '_x.ai/exit_plan_mode',
    params: planDecisionResult(decision, notes)
  }
}

export function applyPlanDecision(state: ChatState, decision: PlanDecision, notes = ''): ChatState {
  if (!state.plan || decision === 'copy') return state
  if (decision === 'comment') {
    return { ...state, plan: { ...state.plan, comments: [...state.plan.comments, notes] } }
  }
  if (decision === 'quit') {
    return { ...state, mode: 'ask', plan: { ...state.plan, pending: false } }
  }
  if (decision === 'request-changes') {
    return { ...state, plan: { ...state.plan, pending: true, comments: notes ? [...state.plan.comments, notes] : state.plan.comments } }
  }
  return { ...state, mode: state.mode === 'plan' ? 'ask' : state.mode, plan: { ...state.plan, pending: false } }
}

export function questionReply(question: string, labels: string[]): Record<string, unknown> {
  return { outcome: 'accepted', answers: { [question]: labels } }
}

export function permissionReply(accept: boolean): { result?: unknown; error?: { message: string } } {
  if (accept) return { result: { outcome: { outcome: 'selected', optionId: 'allow_once' } } }
  return { error: { message: 'permission declined' } }
}

export function answerQuestion(state: ChatState, labels: string[]): { state: ChatState; reply: { id: number; result: unknown } | null } {
  if (!state.question) return { state, reply: null }
  const reply = {
    id: state.question.requestId,
    result: questionReply(state.question.question, labels)
  }
  return { state: { ...state, question: null }, reply }
}

export function answerPermission(
  state: ChatState,
  accept: boolean
): { state: ChatState; reply: { id: number; result?: unknown; error?: { message: string } } | null } {
  if (!state.permission) return { state, reply: null }
  const body = permissionReply(accept)
  const reply = { id: state.permission.requestId, ...body }
  return { state: { ...state, permission: null }, reply }
}

export function stopTaskCall(kind: 'subagent' | 'background', taskId: string, sessionId: string): RpcCall {
  if (kind === 'subagent') return { method: '_x.ai/subagent/cancel', params: { sessionId, subagentId: taskId } }
  return { method: '_x.ai/task/kill', params: { sessionId, taskId } }
}

export function markStopped(state: ChatState, taskId: string): ChatState {
  return {
    ...state,
    subagents: state.subagents.map((agent) => (agent.taskId === taskId || agent.id === taskId ? { ...agent, status: 'stopped' } : agent)),
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, status: 'stopped' } : task))
  }
}

export function setConfigCall(sessionId: string, configId: string, value: string): RpcCall {
  return { method: 'session/set_config_option', params: { sessionId, configId, value } }
}

export function setModeCall(sessionId: string, mode: PermissionMode): RpcCall {
  return { method: 'session/set_mode', params: { sessionId, modeId: modeId(mode) } }
}

export function mergeCommands(agent: SlashCommand[]): SlashCommand[] {
  const names = new Set(agent.map((command) => command.name))
  return [...agent, ...CLIENT_COMMANDS.filter((command) => !names.has(command.name))]
}

export function filterCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return commands
  return commands
    .map((command) => ({ command, score: score(command, needle) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.command)
}

function score(command: SlashCommand, needle: string): number {
  const name = command.name.toLowerCase()
  if (name === needle) return 100
  if (name.startsWith(needle)) return 80
  if (name.includes(needle)) return 50
  if (command.description.toLowerCase().includes(needle)) return 20
  return 0
}

export function mapCommand(sessionId: string, cwd: string, line: string, agentNames: string[]): CommandResult {
  const body = line.trim().replace(/^\//, '')
  const [name, ...rest] = body.split(/\s+/)
  const arg = rest.join(' ').trim()
  const advertised = new Set(agentNames)
  if (!name) return { calls: [] }
  if (name === 'model') {
    return { calls: [setConfigCall(sessionId, 'model', arg)] }
  }
  if (name === 'effort') {
    return { calls: [setConfigCall(sessionId, 'reasoning_effort', arg || 'high')] }
  }
  if (name === 'always-approve') {
    const off = arg === 'off' || arg === 'false'
    return { calls: [setModeCall(sessionId, off ? 'ask' : 'always-approve')], local: { type: 'mode', mode: off ? 'ask' : 'always-approve' } }
  }
  if (name === 'auto') {
    return { calls: [setModeCall(sessionId, 'auto')], local: { type: 'mode', mode: 'auto' } }
  }
  if (name === 'plan') {
    return {
      calls: [setModeCall(sessionId, 'plan')],
      local: { type: 'mode', mode: 'plan' },
      sendPrompt: arg || undefined
    }
  }
  if (name === 'view-plan' || name === 'show-plan' || name === 'plan-view') {
    return { calls: [], local: { type: 'plan-preview' } }
  }
  if (name === 'compact') {
    return { calls: [{ method: '_x.ai/compact_conversation', params: { sessionId, instructions: arg } }] }
  }
  if (name === 'rewind' || name === 'undo') {
    return { calls: [{ method: '_x.ai/rewind/points', params: { sessionId } }], local: { type: 'rewind-picker' } }
  }
  if (name === 'copy') {
    return { calls: [], local: { type: 'copy', which: Number(arg || '1') || 1 } }
  }
  if (name === 'export') {
    return { calls: [], local: { type: 'export' } }
  }
  if (name === 'rename' || name === 'title') {
    return { calls: [], local: { type: 'rename', title: arg } }
  }
  if (name === 'context' || name === 'session-info' || name === 'status' || name === 'info') {
    return advertised.has(name) || advertised.has('context') || advertised.has('session-info')
      ? { calls: [], sendPrompt: `/${name}${arg ? ` ${arg}` : ''}` }
      : { calls: [{ method: '_x.ai/session/usage', params: { sessionId } }], local: { type: 'usage' } }
  }
  if (name === 'fork') {
    return { calls: [{ method: '_x.ai/session/fork', params: { sourceSessionId: sessionId, sourceCwd: cwd, newCwd: cwd } }] }
  }
  if (name === 'history') {
    return { calls: [{ method: '_x.ai/prompt_history', params: { sessionId, cwd } }], local: { type: 'history' } }
  }
  if (name === 'btw') {
    return { calls: [], local: { type: 'btw', text: arg } }
  }
  if (name === 'usage') {
    return { calls: [{ method: '_x.ai/session/usage', params: { sessionId } }], local: { type: 'usage' } }
  }
  if (name === 'feedback') {
    return { calls: advertised.has('feedback') ? [] : [{ method: '_x.ai/feedback', params: { sessionId, text: arg } }], local: { type: 'feedback', text: arg }, sendPrompt: advertised.has('feedback') ? `/feedback ${arg}` : undefined }
  }
  if (name === 'new' || name === 'clear') {
    return { calls: [], local: { type: name } }
  }
  if (advertised.has(name)) {
    return { calls: [], sendPrompt: `/${body}` }
  }
  return { calls: [], local: { type: 'unsupported', name }, note: `/${name} is not advertised by this agent` }
}

export function permissionFromRequest(id: number, method: string, params: Record<string, unknown>): PermissionCard {
  if (method === 'terminal/create') {
    return {
      id: `perm-${id}`,
      requestId: id,
      method,
      title: 'Run command',
      detail: String(params.command || '')
    }
  }
  if (method === 'fs/write_text_file' || method === 'fs/read_text_file') {
    return {
      id: `perm-${id}`,
      requestId: id,
      method,
      title: method === 'fs/write_text_file' ? 'Write file' : 'Read file',
      detail: String(params.path || '')
    }
  }
  return {
    id: `perm-${id}`,
    requestId: id,
    method,
    title: 'Allow tool',
    detail: JSON.stringify(params).slice(0, 400)
  }
}

export function questionFromRequest(id: number, params: Record<string, unknown>): QuestionCard {
  const questions = Array.isArray(params.questions) ? params.questions : []
  const first = (questions[0] || {}) as { question?: string; options?: Array<{ label?: string; description?: string }>; multiSelect?: boolean | null }
  return {
    id: String(params.toolCallId || id),
    requestId: id,
    question: first.question || 'Question',
    options: (first.options || []).map((option) => ({
      label: String(option.label || ''),
      description: String(option.description || '')
    })),
    multiSelect: Boolean(first.multiSelect)
  }
}

export function configFromResult(options: Array<Record<string, unknown>> | undefined): ConfigOption[] {
  return (options || []).map((option) => ({
    id: String(option.id || ''),
    name: String(option.name || option.id || ''),
    currentValue: String(option.currentValue || ''),
    options: Array.isArray(option.options)
      ? option.options.map((item) => {
          const row = item as { value?: string; name?: string }
          return { value: String(row.value || ''), name: String(row.name || row.value || '') }
        })
      : []
  }))
}

export function eventsFromLogLine(line: string): AcpEvent[] {
  if (!line.trim()) return []
  let row: { method?: string; params?: { update?: Update } }
  try {
    row = JSON.parse(line) as { method?: string; params?: { update?: Update } }
  } catch {
    return []
  }
  if (row.method === 'session/update' && row.params?.update) return reduceUpdate(row.params.update)
  return []
}

export function eventsFromSessionLog(text: string): AcpEvent[] {
  const events: AcpEvent[] = []
  for (const line of text.split('\n')) events.push(...eventsFromLogLine(line))
  return events
}

export function promptsFromHistory(result: unknown): string[] {
  const prompts = (result as { prompts?: unknown } | null)?.prompts
  if (!Array.isArray(prompts)) return []
  return prompts.map((prompt) => String(prompt)).filter(Boolean)
}

export function applyCommandResult(
  state: ChatState,
  method: string,
  result: unknown
): { state: ChatState; forkedSessionId: string | null } {
  if (method === '_x.ai/prompt_history') {
    const prompts = promptsFromHistory(result)
    if (prompts.length === 0) return { state, forkedSessionId: null }
    return { state: { ...state, prompts }, forkedSessionId: null }
  }
  if (method === '_x.ai/session/fork') {
    const forkedSessionId = String((result as { newSessionId?: unknown } | null)?.newSessionId || '')
    return { state, forkedSessionId: forkedSessionId || null }
  }
  if (method === '_x.ai/rewind/points') {
    const points = (result as { rewind_points?: Array<{ prompt_preview?: unknown }> } | null)?.rewind_points
    if (!Array.isArray(points) || points.length === 0) return { state, forkedSessionId: null }
    const prompts = points.map((point) => String(point.prompt_preview || '')).filter(Boolean)
    return { state: { ...state, prompts: prompts.length ? prompts : state.prompts }, forkedSessionId: null }
  }
  return { state, forkedSessionId: null }
}

export function assistantExport(messages: ChatMessage[], which = 1): string {
  const replies = messages.filter((message) => message.role === 'assistant')
  return replies[replies.length - which]?.text || replies[replies.length - 1]?.text || ''
}

export function fileMentions(text: string): string[] {
  return [...text.matchAll(/(?:^|\s)@([^\s]+)/g)].map((match) => match[1])
}
