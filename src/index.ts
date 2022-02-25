import * as core from '@actions/core'
import * as github from '@actions/github'
import { Context } from "@actions/github/lib/context";

type ClientType = ReturnType<typeof github.getOctokit>

const cleanRefs = str => str.replace('refs/heads/', '') as string

export async function createBranch(client: ClientType, context: Context, branch: string) {
    branch = cleanRefs(branch);
    try {
        await client.rest.repos.getBranch({...context.repo, branch})
    } catch(error: any ) {
        if(error.name === 'HttpError' && error.status === 404) {
            await client.rest.git.createRef({
                ref: `refs/heads/${branch}`,
                sha: context.sha,
                ...context.repo
            })
        } else {
            throw Error(error)
        }
    }

}

async function main() {
    const token = core.getInput('token')
    const client = github.getOctokit(token)
    const baseBranch = github.context.payload.ref
    const tmpBranch = `${baseBranch}_${Date.now()}`

    if (!baseBranch || !tmpBranch || !cleanRefs(tmpBranch)) throw new Error('No base branch found!?');

    await createBranch(client, github.context, tmpBranch)
    core.info(`Updating to tmp branch ${tmpBranch}`)

    const pullsResponse = await client.rest.pulls.list({
        ...github.context.repo,
        base: baseBranch,
        state: 'open',
    })

    const prs = pullsResponse.data
    const results = await Promise.allSettled(
        prs.map(async (pr) => {
            await client.rest.pulls.update({
                ...github.context.repo,
                pull_number: pr.number,
                base: cleanRefs(tmpBranch)
            })
            await client.rest.pulls.update({
                ...github.context.repo,
                pull_number: pr.number,
                base: cleanRefs(baseBranch)
            })
        }),
    )

    results.forEach(r => {
        if (r.status === 'rejected') core.warning(r.reason)
    })

    core.info(`Deleting tmp branch ${tmpBranch}`)
    await client.rest.git.deleteRef({
        ...github.context.repo,
        ref: `heads/${cleanRefs(tmpBranch)}`,
    })
}




main().catch(e => core.setFailed(e.message))
