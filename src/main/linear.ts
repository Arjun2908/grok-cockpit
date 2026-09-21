import { parseTicketId } from '../shared/ticket'
import type { LinearIssue } from '../shared/types'

const LINEAR_URL = 'https://api.linear.app/graphql'

const ISSUE_FIELDS = `
  identifier
  title
  url
  gitBranchName
  state { name }
  team { key }
  description
`

type LinearNode = {
  identifier: string
  title: string
  url: string
  gitBranchName?: string | null
  state?: { name?: string }
  team?: { key?: string }
  description?: string | null
}

function mapIssue(node: LinearNode): LinearIssue {
  const description = (node.description ?? '').slice(0, 1000)
  return {
    identifier: node.identifier,
    title: node.title,
    url: node.url,
    gitBranchName: node.gitBranchName ?? null,
    state: node.state?.name ?? '',
    teamKey: node.team?.key ?? '',
    description
  }
}

async function linearQuery<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await fetch(LINEAR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey
    },
    body: JSON.stringify({ query, variables })
  })
  const body = (await response.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (!response.ok || body.errors?.length) {
    throw new Error(body.errors?.[0]?.message || `Linear HTTP ${response.status}`)
  }
  if (!body.data) throw new Error('Linear returned no data')
  return body.data
}

export async function listMyIssues(apiKey: string): Promise<LinearIssue[]> {
  const data = await linearQuery<{
    issues: { nodes: LinearNode[] }
  }>(
    apiKey,
    `query MyIssues {
      issues(
        first: 50
        filter: {
          assignee: { isMe: { eq: true } }
          state: { type: { nin: ["completed", "canceled"] } }
        }
      ) { nodes { ${ISSUE_FIELDS} } }
    }`,
    {}
  )
  return data.issues.nodes.map(mapIssue)
}

export async function findIssue(apiKey: string, raw: string): Promise<LinearIssue | null> {
  const parsed = parseTicketId(raw)
  if (parsed) {
    const data = await linearQuery<{ issues: { nodes: LinearNode[] } }>(
      apiKey,
      `query ById($team: String!, $number: Int!) {
        issues(first: 1, filter: { team: { key: { eq: $team } }, number: { eq: $number } }) {
          nodes { ${ISSUE_FIELDS} }
        }
      }`,
      { team: parsed.team, number: parsed.number }
    )
    const node = data.issues.nodes[0]
    return node ? mapIssue(node) : null
  }

  const data = await linearQuery<{ searchIssues: { nodes: LinearNode[] } }>(
    apiKey,
    `query Search($term: String!) {
      searchIssues(term: $term, first: 10) { nodes { ${ISSUE_FIELDS} } }
    }`,
    { term: raw }
  )
  const node = data.searchIssues.nodes[0]
  return node ? mapIssue(node) : null
}
