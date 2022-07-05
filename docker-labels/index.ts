import * as core from '@actions/core'
import * as github from '@actions/github'

type Octokit = ReturnType<typeof github.getOctokit>

async function run() {
  const token = core.getInput('github-token')
  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo

  const commitMessage = extractShortCommitMessage()
  const commitHash = github.context.payload?.head_commit.id
  const commitUrl = `https://github.com/${owner}/${repo}/commit/${github.context.payload?.head_commit.id}`
  const pullRequestNumbers = await extractPullRequestNumbers(octokit)
  const pullRequestUrls = pullRequestNumbers.map(number => `https://github.com/${owner}/${repo}/pull/${number}`)
  const authorNames = extractAuthorNames()

  const labels = {
    commitMessage,
    commitHash,
    commitUrl,
    pullRequestNumbers,
    pullRequestUrls,
    authorNames,
  }

  core.setOutput('docker-labels', labels)
  console.log(`Labels: ${JSON.stringify(labels, undefined, 2)}`);
}
run().catch(err => core.setFailed(err.message))

function extractAuthorNames(): string[] {
  const commits = github.context.payload?.commits || []
  const authorNames: string[] = commits.map(commit => commit.author.name || '')
  return Array.from(new Set(authorNames.filter(authorName => !!authorName)))
}

function extractShortCommitMessage(): string {
  const message: string = github.context.payload?.head_commit.message || ''
  return message.split('\n')[0]
    .replace(/\(#\d+\)|#\d+/g, '')
    .replace(/"/g, '')
    .trim()
}

async function extractPullRequestNumbers(octokit: Octokit): Promise<number[]> {
  const message: string = github.context.payload?.head_commit.message || ''
  const match = message.match(/(#\d+)/mg)
  if (match) {
    const issueOrPullNumbers = Array.from(new Set(match.map(str => parseInt(str.substring(1), 10)))).sort((a, b) => a - b)
    const pullRequestNumbers = await Promise.all(issueOrPullNumbers.map(async pullNumber => {
      try {
        await octokit.rest.pulls.get({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          pull_number: pullNumber,
        })
        return pullNumber
      } catch (err) {
        return 0
      }
    }))
    return pullRequestNumbers.filter(number => number > 0)
  }
  return []
}
