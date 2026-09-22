import { describe, expect, it } from 'vitest'
import {
  answerPermission,
  answerQuestion,
  applyCancel,
  applyEvent,
  blockScrolls,
  composerControlClass,
  composerControls,
  composerKeyAction,
  modeCommand,
  sessionChips,
  applyPlanDecision,
  cancelRequest,
  emptyState,
  enqueuePrompt,
  finishTurn,
  mapCommand,
  markStopped,
  planDecisionCall,
  reduceNotification,
  reduceUpdate,
  applyCommandResult,
  eventsFromLogLine,
  eventsFromSessionLog,
  reduceUpdate,
  planActions,
  planActionsVisible,
  promptsFromHistory,
  queueVisible,
  visibleTranscript,
  rewindToUserTurn,
  setConfigCall,
  stopTaskCall
} from './acp'

describe('chat presentation', () => {
  it('turns a tool update into a card with title, status, and output', () => {
    let state = emptyState()
    state = applyEvent(state, {
      type: 'tool',
      tool: { id: 't1', title: 'read_file', status: 'running', input: 'acp.ts', output: '' }
    })
    state = applyEvent(state, {
      type: 'tool',
      tool: { id: 't1', title: 'read_file', status: 'done', input: 'acp.ts', output: 'export type ChatState' }
    })
    const card = visibleTranscript(state).find((block) => block.kind === 'tool')
    expect(card).toMatchObject({ title: 'read_file', status: 'done', output: 'export type ChatState' })
    expect(card && 'title' in card && card.title.length).toBe('read_file'.length)
    const ordered = visibleTranscript(
      applyEvent(
        applyEvent(emptyState(), { type: 'message', role: 'user', text: 'read it', append: false }),
        { type: 'tool', tool: { id: 't2', title: 'read_file', status: 'done', input: 'a.ts', output: 'ok', seq: 0 } }
      )
    )
    expect(ordered.map((block) => block.kind)).toEqual(['message', 'tool'])
    expect(card && blockScrolls(card)).toBe(true)
  })

  it('renders reasoning as its own scrolling block, separate from the assistant reply', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'message', role: 'thought', text: 'checking callers', append: false })
    state = applyEvent(state, { type: 'message', role: 'assistant', text: 'done', append: false })
    const blocks = visibleTranscript(state)
    const reasoning = blocks.find((block) => block.kind === 'reasoning')
    expect(reasoning).toMatchObject({ text: 'checking callers' })
    expect(reasoning && blockScrolls(reasoning)).toBe(true)
    expect(blocks.map((block) => block.kind)).toEqual(['reasoning', 'message'])
  })

  it('maps a mode option value to the command that changes that mode', () => {
    expect(modeCommand('auto')).toBe('/auto')
    expect(modeCommand('plan')).toBe('/plan')
    expect(modeCommand('always-approve')).toBe('/always-approve')
    expect(modeCommand('ask')).toBe('/always-approve off')
    expect(modeCommand('Auto')).toBe('/always-approve off')
  })

  it('keeps composer controls at content width so a narrow column wraps them', () => {
    const layout = composerControlClass()
    expect(layout).toContain('shrink-0')
    expect(layout).not.toContain('min-w-0')
    expect(layout).not.toContain('flex-1')
    const controls = composerControls()
    expect(controls.map((control) => control.id)).toEqual(['mode', 'model', 'effort', 'usage', 'stop'])
    expect(controls.every((control) => control.className === layout && control.className.includes('shrink-0'))).toBe(true)
  })

  it('keeps model, effort, mode, and usage readable even before config arrives', () => {
    const chips = sessionChips(emptyState())
    expect(chips.map((chip) => chip.id)).toEqual(['model', 'effort', 'mode', 'usage'])
    expect(chips.map((chip) => chip.value)).toEqual(['unset', 'unset', 'ask', '0 tok'])
  })

  it('sends on Enter, keeps Shift+Enter as a newline, and runs a no-argument slash command', () => {
    const commands = [
      { name: 'history', description: 'Recall prompts', source: 'client' as const },
      { name: 'model', description: 'Switch model', source: 'client' as const, hint: '<model id>' }
    ]
    expect(composerKeyAction('Enter', true, 'hello', [], 0).type).toBe('newline')
    expect(composerKeyAction('Enter', false, 'hello', [], 0).type).toBe('submit')
    expect(composerKeyAction('Enter', false, '/history', commands, 0)).toEqual({ type: 'run', line: '/history' })
    expect(composerKeyAction('Enter', false, '/model', [commands[1]], 0)).toEqual({ type: 'fill', draft: '/model ' })
  })

  it('keeps an empty plan distinct from a pending plan that exposes actions', () => {
    expect(planActionsVisible(null)).toBe(false)
    expect(planActionsVisible({ markdown: '', empty: true, pending: true, comments: [] })).toBe(false)
    expect(planActions({ markdown: 'Ship the cache', empty: false, pending: true, comments: [] }).map((action) => action.label)).toEqual(['Approve', 'Request changes', 'Comment', 'Copy', 'Quit'])
    expect(planActionsVisible({ markdown: 'Ship the cache', empty: false, pending: true, comments: [] })).toBe(true)
    expect(planActionsVisible({ markdown: 'Ship the cache', empty: false, pending: false, comments: [] })).toBe(false)
  })

  it('keeps a queued follow-up visible until the turn ends', () => {
    let state = applyEvent(emptyState(), { type: 'message', role: 'assistant', text: 'working', append: false })
    state = { ...state, busy: true }
    const queued = enqueuePrompt(state, 'follow up later')
    expect(queueVisible(queued.state)).toBe(true)
    expect(queued.state.queue).toEqual(['follow up later'])
    const finished = finishTurn(queued.state)
    expect(queueVisible(finished.state)).toBe(false)
    expect(finished.sendNext).toBe('follow up later')
  })
})

describe('live session updates', () => {
  it('turns a thought chunk and a compact start into events the pane can show while the turn is running', () => {
    const thought = reduceUpdate({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'checking callers' } })
    expect(thought).toEqual([{ type: 'message', role: 'thought', text: 'checking callers', append: true }])
    const compacting = eventsFromLogLine(JSON.stringify({
      method: 'session/update',
      params: { update: { sessionUpdate: 'auto_compact_started', percentage: 85, reason: 'Context window 85% full' } }
    }))
    expect(compacting[0]).toEqual({ type: 'status', text: 'compacting (85%)' })
    const done = reduceUpdate({ sessionUpdate: 'auto_compact_completed', tokens_before: 200000, tokens_after: 19000 })
    expect(done[0]).toMatchObject({ type: 'status', text: 'compacted · 19000 tokens' })
  })
})

describe('reduceUpdate', () => {
  it('appends assistant chunks', () => {
    const events = reduceUpdate({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'pong' }
    })
    expect(events[0]).toMatchObject({ type: 'message', role: 'assistant', text: 'pong' })
  })

  it('turns spawn_subagent into a subagent card', () => {
    const events = reduceUpdate({
      sessionUpdate: 'tool_call',
      toolCallId: 'c1',
      title: 'spawn_subagent',
      rawInput: { description: 'Find callers' }
    })
    expect(events.some((event) => event.type === 'subagent' && event.agent.taskId === 'c1')).toBe(true)
  })

  it('marks exit_plan_mode as a pending plan', () => {
    const events = reduceUpdate({
      sessionUpdate: 'tool_call',
      toolCallId: 'c2',
      title: 'exit_plan_mode',
      rawInput: {}
    })
    expect(events.some((event) => event.type === 'plan' && event.pending)).toBe(true)
  })

  it('keeps an ask_user_question pending until the chosen answer is returned', () => {
    let state = emptyState()
    state = applyEvent(state, {
      type: 'question',
      question: {
        id: 'q1',
        requestId: 7,
        question: 'Pick a color',
        options: [
          { label: 'red', description: 'Red' },
          { label: 'blue', description: 'Blue' }
        ],
        multiSelect: false
      }
    })
    expect(state.question?.question).toBe('Pick a color')
    const answered = answerQuestion(state, ['blue'])
    expect(answered.state.question).toBeNull()
    expect(answered.reply).toEqual({
      id: 7,
      result: { outcome: 'accepted', answers: { 'Pick a color': ['blue'] } }
    })
  })

  it('keeps a permission request pending until accept or decline', () => {
    let state = applyEvent(emptyState(), {
      type: 'permission',
      permission: { id: 'perm-1', requestId: 4, method: 'terminal/create', title: 'Run command', detail: 'echo hi' }
    })
    expect(state.permission?.detail).toBe('echo hi')
    const declined = answerPermission(state, false)
    expect(declined.state.permission).toBeNull()
    expect(declined.reply?.error?.message).toBe('permission declined')
    state = applyEvent(emptyState(), {
      type: 'permission',
      permission: { id: 'perm-2', requestId: 5, method: 'terminal/create', title: 'Run command', detail: 'echo hi' }
    })
    expect(answerPermission(state, true).reply?.result).toMatchObject({ outcome: { optionId: 'allow_once' } })
  })
})

describe('session commands', () => {
  it('holds a follow-up until the turn ends and then sends it', () => {
    let state = emptyState()
    const first = enqueuePrompt(state, 'first')
    expect(first.sendNow).toBe('first')
    state = first.state
    const second = enqueuePrompt(state, 'follow up')
    expect(second.sendNow).toBeNull()
    expect(second.state.queue).toEqual(['follow up'])
    const done = finishTurn(second.state)
    expect(done.sendNext).toBe('follow up')
    expect(done.state.queue).toEqual([])
    expect(done.state.busy).toBe(true)
  })

  it('cancel emits session/cancel and clears the busy turn', () => {
    const state = { ...emptyState(), busy: true }
    expect(cancelRequest('sess-1')).toEqual({ method: 'session/cancel', params: { sessionId: 'sess-1' } })
    expect(applyCancel(state).busy).toBe(false)
  })

  it('rewind truncates history to the chosen user turn and does not restore files', () => {
    let state = emptyState()
    state = enqueuePrompt(state, 'one').state
    state = applyEvent(state, { type: 'message', role: 'assistant', text: 'a', append: false })
    state = enqueuePrompt({ ...state, busy: false }, 'two').state
    state = applyEvent(state, { type: 'message', role: 'assistant', text: 'b', append: false })
    const rewound = rewindToUserTurn(state, 1)
    expect(rewound.state.messages.map((message) => message.text)).toEqual(['one', 'a'])
    expect(rewound.state.restoredFiles).toBe(false)
    expect(rewound.call.method).toBe('_x.ai/rewind/execute')
    expect(rewound.call.params).not.toHaveProperty('restoreFiles', true)
  })

  it('maps plan decisions to the protocol decision rather than a free-text Approved prompt', () => {
    const approve = planDecisionCall('approve')
    const changes = planDecisionCall('request-changes', 'narrow the scope')
    const comment = planDecisionCall('comment', 'line 3')
    const quit = planDecisionCall('quit')
    for (const call of [approve, changes, comment, quit]) {
      expect(call.method).toBe('_x.ai/exit_plan_mode')
      expect(JSON.stringify(call.params)).not.toContain('Approved')
    }
    expect(approve.params.outcome).toBe('approved')
    expect(quit.params.outcome).toBe('abandoned')
    let state = applyEvent(emptyState(), { type: 'plan', markdown: '', pending: true })
    state = { ...state, mode: 'plan' }
    expect(applyPlanDecision(state, 'quit').mode).toBe('ask')
    expect(applyPlanDecision(state, 'approve').plan?.pending).toBe(false)
    expect(applyPlanDecision(state, 'request-changes', 'narrow').plan?.pending).toBe(true)
  })

  it('stops a subagent or background task by that task id', () => {
    expect(stopTaskCall('subagent', 'child-9', 'sess')).toEqual({
      method: '_x.ai/subagent/cancel',
      params: { sessionId: 'sess', subagentId: 'child-9' }
    })
    expect(stopTaskCall('background', 'task-3', 'sess').params.taskId).toBe('task-3')
    const spawned = reduceNotification('_x.ai/session_notification', {
      update: { sessionUpdate: 'subagent_spawned', subagent_id: 'child-9', description: 'echo hi' }
    })
    let state = applyEvent(emptyState(), spawned[0])
    state = markStopped(state, 'child-9')
    expect(state.subagents[0].status).toBe('stopped')
  })

  it('replays a persisted session log into the conversation the user sees', () => {
    const log = [
      JSON.stringify({
        method: 'session/update',
        params: { update: { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'hello' } } }
      }),
      JSON.stringify({
        method: 'session/update',
        params: { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'pong' } } }
      })
    ].join('\n')
    const events = eventsFromSessionLog(log)
    let state = emptyState()
    for (const event of events) state = applyEvent(state, event)
    expect(state.messages.map((message) => `${message.role}:${message.text}`)).toEqual(['user:hello', 'assistant:pong'])
  })

  it('recalls prior prompts from the agent history result and compacts through the advertised method', () => {
    const recalled = promptsFromHistory({ prompts: ['first prompt', 'second prompt'] })
    expect(recalled).toEqual(['first prompt', 'second prompt'])
    const applied = applyCommandResult(emptyState(), '_x.ai/prompt_history', { prompts: recalled })
    expect(applied.state.prompts).toEqual(recalled)
    const compact = mapCommand('sess', '/repo', '/compact keep the plan', ['compact'])
    expect(compact.calls[0]).toEqual({
      method: '_x.ai/compact_conversation',
      params: { sessionId: 'sess', instructions: 'keep the plan' }
    })
    expect(compact.sendPrompt).toBeUndefined()
  })

  it('forks the same persisted session with source session and cwd', () => {
    const fork = mapCommand('sess', '/repo', '/fork', [])
    expect(fork.calls[0]).toEqual({
      method: '_x.ai/session/fork',
      params: { sourceSessionId: 'sess', sourceCwd: '/repo', newCwd: '/repo' }
    })
    const applied = applyCommandResult(emptyState(), '_x.ai/session/fork', { newSessionId: 'child-1' })
    expect(applied.forkedSessionId).toBe('child-1')
  })

  it('changes the session option the agent exposes for model, effort, plan, and always-approve', () => {
    expect(mapCommand('sess', '/repo', '/model grok-4.6', []).calls).toEqual([
      setConfigCall('sess', 'model', 'grok-4.6')
    ])
    expect(mapCommand('sess', '/repo', '/effort medium', []).calls[0]).toEqual(
      setConfigCall('sess', 'reasoning_effort', 'medium')
    )
    const plan = mapCommand('sess', '/repo', '/plan describe the cache', [])
    expect(plan.calls[0]).toMatchObject({ method: 'session/set_mode', params: { modeId: 'plan' } })
    expect(plan.sendPrompt).toBe('describe the cache')
    expect(plan.local).toEqual({ type: 'mode', mode: 'plan' })
    const yolo = mapCommand('sess', '/repo', '/always-approve', ['always-approve'])
    expect(yolo.calls[0].params).toMatchObject({ modeId: 'always_approve' })
    expect(yolo.sendPrompt).toBeUndefined()
  })
})
