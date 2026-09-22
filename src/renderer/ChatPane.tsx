import { useEffect, useMemo, useRef, useState } from 'react'
import {
  applyCancel,
  applyCommandResult,
  applyEvent,
  applyPlanDecision,
  assistantExport,
  composerKeyAction,
  cancelRequest,
  blockScrolls,
  emptyState,
  enqueuePrompt,
  fileMentions,
  filterCommands,
  finishTurn,
  planActions,
  planActionsVisible,
  queueVisible,
  visibleTranscript,
  composerControlClass,
  composerControls,
  mapCommand,
  modeCommand,
  markStopped,
  permissionReply,
  planDecisionCall,
  questionReply,
  sessionChips,
  rewindToUserTurn,
  stopTaskCall,
  type AcpEvent,
  type ChatState,
  type PermissionMode,
  type PlanDecision
} from '@shared/acp'

type Props = {
  tabId: string
  cwd: string
  resumeId?: string
  firstPrompt?: string
  active: boolean
  onFork?: (sessionId: string) => void
}

export default function ChatPane({ tabId, cwd, resumeId, firstPrompt, active, onFork }: Props) {
  const [state, setState] = useState<ChatState>(emptyState)
  const [draft, setDraft] = useState(firstPrompt ?? '')
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState(0)
  const [planNotes, setPlanNotes] = useState('')
  const [comment, setComment] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [rewindOpen, setRewindOpen] = useState(false)
  const [attachments, setAttachments] = useState<string[]>([])
  const [attachDraft, setAttachDraft] = useState('')
  const [attachOpen, setAttachOpen] = useState(false)
  const sentFirst = useRef(false)
  const sessionId = useRef<string>('')
  const stateRef = useRef(state)
  const scroller = useRef<HTMLDivElement>(null)
  stateRef.current = state

  useEffect(() => {
    let cancelled = false
    const unsub = window.api.onAcpEvent((id, event) => {
      if (id !== tabId) return
      applyIncoming(event)
    })
    void window.api.startAcp(tabId, cwd, resumeId, 'ask').then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setError(result.error)
        setStatus('failed')
        return
      }
      sessionId.current = result.sessionId
      setStatus('ready')
      if (firstPrompt && !sentFirst.current) {
        sentFirst.current = true
        setDraft('')
        submit(firstPrompt)
      }
    })
    return () => {
      cancelled = true
      unsub()
      void window.api.stopAcp(tabId)
    }
  }, [tabId, cwd, resumeId])

  function applyIncoming(event: AcpEvent): void {
    if (event.type === 'status') setStatus(event.text)
    if (event.type === 'error') setError(event.text)
    if (event.type === 'turn-done') {
      setState((current) => {
        const done = finishTurn({ ...current, busy: false })
        if (done.sendNext) void window.api.promptAcp(tabId, done.sendNext)
        return done.sendNext ? { ...done.state, busy: true } : done.state
      })
      return
    }
    setState((current) => applyEvent(current, event))
  }

  function submit(raw: string): void {
    const attached = attachments.map((path) => `@${path}`).join(' ')
    const text = [raw.trim(), attached].filter(Boolean).join('\n')
    if (!text) return
    if (text.startsWith('/')) {
      runCommand(text)
      setDraft('')
      setAttachments([])
      return
    }
    const queued = enqueuePrompt(stateRef.current, text)
    setState(queued.state)
    setDraft('')
    setAttachments([])
    setError(null)
    if (queued.sendNow) void window.api.promptAcp(tabId, queued.sendNow)
  }

  function runCommand(line: string): void {
    const agentNames = stateRef.current.commands.filter((command) => command.source === 'agent').map((command) => command.name)
    const mapped = mapCommand(sessionId.current, cwd, line, agentNames)
    if (mapped.note) setError(mapped.note)
    if (mapped.local?.type === 'mode') setState((current) => ({ ...current, mode: mapped.local && mapped.local.type === 'mode' ? mapped.local.mode : current.mode }))
    if (mapped.local?.type === 'plan-preview') {
      void window.api.readPlan(sessionId.current, cwd).then((markdown) => {
        setState((current) => applyEvent(current, { type: 'plan', markdown, pending: true }))
      })
    }
    if (mapped.local?.type === 'copy') void window.api.writeClipboard(assistantExport(stateRef.current.messages, mapped.local.which))
    if (mapped.local?.type === 'export') void window.api.writeClipboard(stateRef.current.messages.map((message) => `${message.role}: ${message.text}`).join('\n\n'))
    if (mapped.local?.type === 'history') setHistoryOpen(true)
    if (mapped.local?.type === 'rewind-picker') setRewindOpen(true)
    if (mapped.local?.type === 'rename') void window.api.renameSession(sessionId.current, cwd, mapped.local.title)
    if (mapped.local?.type === 'btw') setState((current) => applyEvent(current, { type: 'message', role: 'thought', text: mapped.local && mapped.local.type === 'btw' ? mapped.local.text : '', append: false }))
    if (mapped.local?.type === 'new' || mapped.local?.type === 'clear') setState(emptyState())
    for (const call of mapped.calls) {
      void window.api.callAcp(tabId, call).then((result) => {
        if (!result?.ok) return
        const applied = applyCommandResult(stateRef.current, call.method, result.result)
        setState(applied.state)
        if (applied.forkedSessionId) onFork?.(applied.forkedSessionId)
      })
    }
    if (mapped.sendPrompt && !mapped.sendPrompt.startsWith('/')) submit(mapped.sendPrompt)
    if (mapped.sendPrompt?.startsWith('/')) {
      void window.api.promptAcp(tabId, mapped.sendPrompt)
    }
  }

  function cancel(): void {
    setState((current) => applyCancel(current))
    void window.api.callAcp(tabId, cancelRequest(sessionId.current))
    void window.api.cancelAcp(tabId)
  }

  function decide(decision: PlanDecision): void {
    if (decision === 'copy') {
      void window.api.writeClipboard(stateRef.current.plan?.markdown || '')
      return
    }
    const notes = decision === 'comment' ? comment : planNotes
    const call = planDecisionCall(decision, notes)
    const pending = stateRef.current.plan?.requestId
    setState((current) => applyPlanDecision(current, decision, notes))
    if (pending != null) {
      void window.api.replyAcp(tabId, pending, call.params)
    } else {
      void window.api.callAcp(tabId, call)
    }
    if (decision === 'comment') setComment('')
    if (decision === 'request-changes') setPlanNotes('')
  }

  const slash = draft.startsWith('/')
  const at = /(?:^|\s)@([^\s]*)$/.exec(draft)
  const matches = useMemo(() => (slash ? filterCommands(state.commands, draft.slice(1).split(/\s/)[0] || '') : []), [slash, draft, state.commands])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [state.messages, state.tools, state.queue, state.question, state.permission, state.plan, error, matches.length, historyOpen, rewindOpen])
  const model = state.config.find((option) => option.id === 'model')
  const effort = state.config.find((option) => option.id === 'reasoning_effort')
  const userTurns = state.messages.filter((message) => message.role === 'user')
  const blocks = visibleTranscript(state)
  const planButtons = planActions(state.plan)
  const showPlanActions = planActionsVisible(state.plan)
  const chips = sessionChips(state)
  const controls = composerControls()
  const controlClass = (id: 'mode' | 'model' | 'effort' | 'usage' | 'stop') => {
    for (const control of controls) {
      if (control.id === id) return control.className
    }
    return composerControlClass()
  }
  const showQueue = queueVisible(state)
  return (
    <div className="relative flex h-full min-h-0 min-w-0" style={{ display: active ? 'flex' : 'none' }} data-testid="chat-pane">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-800 px-4 py-2 text-[12px] text-zinc-400">
          {chips.map((chip) => (
            <span key={chip.id} className="max-w-full break-words" data-testid={`chip-${chip.id}`}>{chip.label} {chip.value}</span>
          ))}
          <span className="max-w-full break-words">{status}</span>
        </div>
        <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" data-testid="transcript">
          {blocks.map((block) => (
            block.kind === 'reasoning' ? (
              <div key={block.id} className={`max-w-3xl whitespace-pre-wrap break-words px-1 text-[13px] leading-6 text-zinc-500 ${blockScrolls(block) ? 'max-h-48 overflow-y-auto' : ''}`} data-testid="reasoning-block">
                {block.text}
              </div>
            ) : block.kind === 'message' ? (
              <div key={block.id} className="max-w-3xl">
                <div className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[14px] leading-6 ${blockScrolls(block) ? 'max-h-80 overflow-y-auto' : ''} ${block.role === 'user' ? 'ml-auto w-fit max-w-full bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-zinc-100'}`}>
                  {block.text}
                </div>
                {block.role === 'assistant' && (
                  <button className="mt-1 text-[11px] text-zinc-500" onClick={() => void window.api.writeClipboard(block.text)}>Copy</button>
                )}
              </div>
            ) : (
              <div key={block.id} className="max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" data-testid="tool-card">
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="min-w-0 break-words text-zinc-200" data-testid="tool-title">{block.title}</span>
                  <span className="text-zinc-500">{block.status}</span>
                </div>
                {(block.input || block.output) && (
                  <pre data-testid="tool-output" className={`mt-1 whitespace-pre-wrap break-words text-[12px] text-zinc-400 ${blockScrolls(block) ? 'max-h-40 overflow-auto' : ''}`}>{block.output || block.input}</pre>
                )}
              </div>
            )
          ))}
          {showQueue && (
            <div className="text-[12px] text-zinc-500" data-testid="follow-up-queue">
              {state.queue.map((item) => (
                <div key={item} className="break-words">Queued: {item}</div>
              ))}
            </div>
          )}
          {error && <div className="break-words text-[13px] text-red-300" data-testid="chat-error">{error}</div>}
          {showPlanActions && (
            <div className="max-w-3xl rounded-xl border border-amber-900 bg-zinc-950 px-4 py-3" data-testid="plan-bar">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Plan</div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-[12px] leading-5 text-zinc-300">{state.plan?.markdown}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                {planButtons.map((action) => (
                  <button key={action.decision} className={`rounded-lg px-3 py-1.5 text-[12px] ${action.decision === 'approve' ? 'bg-zinc-100 text-zinc-900' : action.decision === 'quit' ? 'text-zinc-500' : 'border border-zinc-700'}`} onClick={() => decide(action.decision)}>{action.label}</button>
                ))}
              </div>
              <textarea className="mt-3 h-16 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[12px]" placeholder="Revision notes" value={planNotes} onChange={(event) => setPlanNotes(event.target.value)} />
              <input className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[12px]" placeholder="Line comment" value={comment} onChange={(event) => setComment(event.target.value)} />
            </div>
          )}
          {state.question && (
            <div className="max-w-3xl rounded-xl border border-amber-900 bg-zinc-950 px-4 py-3" data-testid="question-card">
              <div className="text-[13px] text-zinc-100">{state.question.question}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {state.question.options.map((option) => (
                  <button
                    key={option.label}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[12px]"
                    onClick={() => {
                      void window.api.replyAcp(tabId, state.question!.requestId, questionReply(state.question!.question, [option.label]))
                      setState((current) => ({ ...current, question: null }))
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {state.permission && (
            <div className="max-w-3xl rounded-xl border border-amber-900 bg-zinc-950 px-4 py-3" data-testid="permission-card">
              <div className="text-[13px] text-zinc-100">{state.permission.title}</div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[12px] text-zinc-400">{state.permission.detail}</pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[12px] text-zinc-900" onClick={() => { void window.api.replyAcp(tabId, state.permission!.requestId); setState((current) => ({ ...current, permission: null })) }}>Accept</button>
                <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[12px]" onClick={() => { const body = permissionReply(false); void window.api.replyAcp(tabId, state.permission!.requestId, undefined, body.error?.message); setState((current) => ({ ...current, permission: null })) }}>Decline</button>
              </div>
            </div>
          )}
          {(state.subagents.length > 0 || state.tasks.length > 0) && (
            <div className="max-w-3xl space-y-2" data-testid="subagent-panel">
              {state.subagents.map((agent) => (
                <div key={agent.id} className="rounded-lg border border-zinc-800 px-3 py-2">
                  <div className="text-[12px] text-zinc-200">{agent.title}</div>
                  <div className="text-[11px] text-zinc-500">{agent.status}</div>
                  {agent.summary && <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px] text-zinc-400">{agent.summary}</pre>}
                  <button className="mt-1 text-[11px] text-red-300" onClick={() => { void window.api.callAcp(tabId, stopTaskCall('subagent', agent.taskId, sessionId.current)); setState((current) => markStopped(current, agent.taskId)) }}>Stop</button>
                </div>
              ))}
              {state.tasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-zinc-800 px-3 py-2">
                  <div className="text-[12px]">{task.title}</div>
                  <div className="text-[11px] text-zinc-500">{task.status}</div>
                  {task.output && <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px] text-zinc-400">{task.output}</pre>}
                  <button className="text-[11px] text-red-300" onClick={() => { void window.api.callAcp(tabId, stopTaskCall('background', task.id, sessionId.current)); setState((current) => markStopped(current, task.id)) }}>Stop</button>
                </div>
              ))}
            </div>
          )}
          {slash && matches.length > 0 && (
            <div className="max-w-3xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950" data-testid="command-menu">
              {matches.slice(0, 12).map((command, index) => (
                <button
                  key={`${command.source}-${command.name}`}
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-[12px] ${index === menu ? 'bg-zinc-800' : ''}`}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    setDraft('')
                    setMenu(0)
                    runCommand(command.hint ? `/${command.name} ` : `/${command.name}`)
                    if (command.hint) setDraft(`/${command.name} `)
                  }}
                >
                  <span className="text-zinc-100">/{command.name}</span>
                  <span className="mt-0.5 block break-words text-zinc-500">{command.description}</span>
                </button>
              ))}
            </div>
          )}
          {historyOpen && (
            <div className="max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950 p-4" data-testid="history-overlay">
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span>Prior prompts</span>
                <button type="button" className="text-[12px] text-zinc-500" onClick={() => setHistoryOpen(false)}>Close</button>
              </div>
              {state.prompts.length === 0 && <p className="text-[12px] text-zinc-500">No prompts recalled yet.</p>}
              {state.prompts.map((prompt) => (
                <button key={prompt} className="block w-full break-words py-1 text-left text-[12px] text-zinc-300" onClick={() => { setDraft(prompt); setHistoryOpen(false) }}>{prompt}</button>
              ))}
            </div>
          )}
          {rewindOpen && (
            <div className="max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950 p-4" data-testid="rewind-overlay">
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span>Rewind conversation. Files stay as they are.</span>
                <button type="button" className="shrink-0 text-[12px] text-zinc-500" onClick={() => setRewindOpen(false)}>Close</button>
              </div>
              {userTurns.map((turn, index) => (
                <button key={turn.id} className="block w-full break-words py-1 text-left text-[12px]" onClick={() => {
                  const rewound = rewindToUserTurn(stateRef.current, index)
                  setState(rewound.state)
                  void window.api.callAcp(tabId, rewound.call)
                  setRewindOpen(false)
                }}>{turn.text}</button>
              ))}
            </div>
          )}
        </div>
        <form
          className="relative border-t border-zinc-800 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit(draft)
          }}
        >
          {at && <div className="mb-2 break-words text-[12px] text-zinc-500">Attach path: finish typing and it is sent as @{at[1] || '…'}</div>}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((path) => (
                <button key={path} type="button" className="rounded-full border border-zinc-700 px-2 py-1 text-[11px]" onClick={() => setAttachments((current) => current.filter((item) => item !== path))}>@{path}</button>
              ))}
            </div>
          )}
          <textarea
            className="h-24 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-[14px] outline-none"
            placeholder={status === 'ready' ? 'Message Grok. / commands, @path, Shift+Enter for a newline.' : status}
            value={draft}
            data-testid="composer"
            onChange={(event) => setDraft(event.target.value)}
            onPaste={(event) => {
              const text = event.clipboardData.getData('text')
              const paths = fileMentions(text)
              if (paths.length) setAttachments((current) => [...current, ...paths])
            }}
            onKeyDown={(event) => {
              if (slash && event.key === 'ArrowDown') {
                event.preventDefault()
                setMenu((current) => Math.min(current + 1, matches.length - 1))
              } else if (slash && event.key === 'ArrowUp') {
                event.preventDefault()
                setMenu((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Enter') {
                const action = composerKeyAction(event.key, event.shiftKey, draft, matches, menu)
                if (action.type === 'newline') return
                event.preventDefault()
                if (action.type === 'fill') {
                  setDraft(action.draft)
                  return
                }
                if (action.type === 'run') {
                  setDraft('')
                  setMenu(0)
                  runCommand(action.line)
                  return
                }
                submit(draft)
              }
            }}
          />
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[12px]" data-testid="composer-row">
            <button type="button" className="rounded-lg border border-zinc-800 px-2 py-1" data-testid="attach-file" onClick={() => setAttachOpen(true)}>@ file</button>
            {attachOpen && (
              <span className={`flex w-full items-center gap-1 ${composerControlClass()}`}>
                <input
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1"
                  placeholder="Path to attach"
                  value={attachDraft}
                  data-testid="attach-path"
                  onChange={(event) => setAttachDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      if (attachDraft.trim()) setAttachments((current) => [...current, attachDraft.trim()])
                      setAttachDraft('')
                      setAttachOpen(false)
                    }
                  }}
                />
                <button type="button" className="rounded-lg border border-zinc-800 px-2 py-1" onClick={() => { if (attachDraft.trim()) setAttachments((current) => [...current, attachDraft.trim()]); setAttachDraft(''); setAttachOpen(false) }}>Add</button>
              </span>
            )}
            <select aria-label="mode" className={`${controlClass('mode')} rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1`} value={state.mode} onChange={(event) => runCommand(modeCommand(event.target.value))}>
              {(['ask', 'auto', 'always-approve', 'plan'] as PermissionMode[]).map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
            <select aria-label="model" className={`${controlClass('model')} rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1`} value={model?.currentValue || ''} onChange={(event) => runCommand(`/model ${event.target.value}`)}>
              {!model && <option value="">model</option>}
              {(model?.options || []).map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}
            </select>
            <select aria-label="effort" className={`${controlClass('effort')} rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1`} value={effort?.currentValue || ''} onChange={(event) => runCommand(`/effort ${event.target.value}`)}>
              {!effort && <option value="">effort</option>}
              {(effort?.options || []).map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}
            </select>
            <span className={`${controlClass('usage')} break-words`} data-testid="composer-usage">{chips.find((chip) => chip.id === 'usage')?.value}</span>
            {state.busy && <button type="button" className={`${controlClass('stop')} rounded-lg border border-red-900 px-2 py-1 text-red-300`} onClick={cancel}>Stop</button>}
          </div>
        </form>
      </div>
    </div>
  )
}
