import type { Octokit } from 'octokit';

type ExistingPullRequestQueryData = {
  repository: {
    id: string;
    pullRequests: {
      nodes: {
        id: string;
      }[];
    };
  };
};

export const createOrUpdateReleasePR = async ({
  octokit,
  owner,
  name,
  releaseBranchName,
  mainBranchName,
  title,
  body,
}: {
  octokit: Octokit;
  owner: string;
  name: string;
  releaseBranchName: string;
  mainBranchName: string;
  title: string;
  body: string;
}) => {
  console.log('Checking for an existing pull request');
  const queryResponse = await octokit.graphql<ExistingPullRequestQueryData>(
    /* graphql */ `
    query ExistingPullRequestQuery(
      $owner: String!
      $name: String!
      $headRefName: String!
      $baseRefName: String!
    ) {
      repository(owner: $owner, name: $name) {
        id
        pullRequests(
          baseRefName: $baseRefName
          headRefName: $headRefName
          states: OPEN
          first: 1
        ) {
          nodes {
            id
          }
        }
      }
    }
  `,
    {
      owner,
      name,
      headRefName: releaseBranchName,
      baseRefName: mainBranchName,
    }
  );

  if (queryResponse.repository.pullRequests.nodes.length == 0) {
    console.log('Creating a new pull request');
    await octokit.graphql(
      /* graphql */ `
      mutation CreatePullRequestMutation(
        $repositoryId: ID!
        $baseRefName: String!
        $headRefName: String!
        $title: String!
      ) {
        createPullRequest(
          input: {
            repositoryId: $repositoryId
            baseRefName: $baseRefName
            headRefName: $headRefName
            title: $title
            body: $body
          }
        ) {
          __typename
        }
      }
    `,
      {
        repositoryId: queryResponse.repository.id,
        baseRefName: mainBranchName,
        headRefName: releaseBranchName,
        title,
        body,
      }
    );
  } else {
    console.log('Updating the existing pull request');
    await octokit.graphql(
      /* graphql */ `
      mutation UpdatePullRequestMutation(
        $pullRequestId: ID!
        $title: String!
      ) {
        updatePullRequest(
          input: {
            pullRequestId: $pullRequestId
            title: $title,
            body: $body
          }
        ) {
          __typename
        }
      }
    `,
      {
        pullRequestId: queryResponse.repository.pullRequests.nodes[0].id,
        title,
        body,
      }
    );
  }
};
