import * as core from '@actions/core'
import * as github from '@actions/github'

async function main() {
    const token = core.getInput('token')
    const client = github.getOctokit(token)

    const baseBranch = github.context.payload.ref
    const pullsResponse = await client.rest.pulls.list({
        ...github.context.repo,
        base: baseBranch,
        state: 'open',
    })
    const prs = pullsResponse.data

    const results = await Promise.allSettled(
        prs.map((pr) => {
            client.rest.pulls.updateBranch({
                ...github.context.repo,
                pull_number: pr.number,
            })
        }),
    )

    results.forEach((r) => {
        if (r.status === 'rejected') core.warning(r.reason)
    })
}

main()
