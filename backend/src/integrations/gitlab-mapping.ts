export interface GitLabIssueLinkInput {
  itemId: string;
  gitlabProjectId: string;
  issueIid: number;
}

export function validateGitLabIssueLink(input: GitLabIssueLinkInput): GitLabIssueLinkInput {
  if (!input.itemId || !input.gitlabProjectId || !Number.isInteger(input.issueIid) || input.issueIid < 1) {
    throw new Error('GitLab issue links require item, project and positive issue IID');
  }
  return input;
}