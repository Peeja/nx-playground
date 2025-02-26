import path from 'node:path';
import fs from 'node:fs';
import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release';
import { createProjectGraphAsync } from '@nx/devkit';
import { parseChangelogMarkdown } from 'nx/src/command-line/release/utils/markdown.js';
import { simpleGit } from 'simple-git';
import { Octokit } from 'octokit';
import npmFetch from 'npm-registry-fetch';
import { createOrUpdateRelease, createOrUpdateReleasePR } from './gh.js';

const envVar = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
  return value;
};

const REPO_OWNER = envVar('GITHUB_REPOSITORY_OWNER');
const REPO_NAME = envVar('GITHUB_REPOSITORY_NAME');
const MAIN_BRANCH = envVar('MAIN_BRANCH_NAME');
const RELEASE_BRANCH = envVar('RELEASE_BRANCH_NAME');
const octokit = new Octokit({ auth: envVar('GITHUB_TOKEN') });
const git = simpleGit();

const versionResult = await releaseVersion({});
console.log(versionResult);

const pendingVersions = Object.values(versionResult.projectsVersionData).some(
  (versionData) => versionData.newVersion
);

if (pendingVersions) {
  console.log("There are pending versions. Let's create a release PR.");

  await git.addConfig('user.email', 'rachabot@storacha.network');
  await git.addConfig('user.name', 'Rachabot');
  await git.checkoutLocalBranch(RELEASE_BRANCH);
  const changelogResult = await releaseChangelog({
    versionData: versionResult.projectsVersionData,
    deleteVersionPlans: true,
    createRelease: false,
    gitPush: false,
  });
  console.log(await git.status());
  console.log(changelogResult);
  await git.push('origin', RELEASE_BRANCH, { '--force': null });
  const changelogs = Object.entries(
    changelogResult.projectChangelogs ?? {}
  ).map(([project, changelog]) =>
    changelog.contents.replace(/^##? /, `## ${project}@`)
  );
  console.log(changelogs.join('\n\n'));

  const versions = Object.entries(versionResult.projectsVersionData)
    .filter(([, versionData]) => versionData.newVersion)
    .map(([project, versionData]) => `${project}@${versionData.newVersion}`)
    .join(', ');

  await createOrUpdateReleasePR({
    octokit,
    owner: REPO_OWNER,
    repo: REPO_NAME,
    releaseBranchName: RELEASE_BRANCH,
    mainBranchName: MAIN_BRANCH,
    title: `Release ${versions}`,
    body: changelogs.join('\n\n'),
  });
} else {
  console.log("There are no pending versions. Let's publish the release.");

  const graph = await createProjectGraphAsync();
  console.log(graph.nodes);

  for (const [project, { currentVersion }] of Object.entries(
    versionResult.projectsVersionData
  )) {
    const needToPublish = await npmFetch(`/${project}/${currentVersion}`)
      // If the request is successful, the version has already been published.
      .then(() => false)
      .catch((e: unknown) => {
        if (isNpmNotFoundError(e)) {
          // If the request fails with a 404, the version has not been published yet.
          return true;
        } else {
          // If the request fails with another error, rethrow it.
          throw e;
        }
      });

    const tagName = `${project}@${currentVersion}`;

    if (!needToPublish) {
      console.log(`${tagName} already published.`);
    } else {
      console.log(`Going to publish ${tagName}`);
      const changelogPath = path.join(
        graph.nodes[project].data.sourceRoot ?? '.',
        'CHANGELOG.md'
      );
      const changelogContents = fs.readFileSync(changelogPath).toString();
      const changelog = parseChangelogMarkdown(changelogContents);
      const changelogEntry =
        changelog.releases.find((release) => release.version === currentVersion)
          ?.body ?? '';

      // Create tag
      git.addAnnotatedTag(tagName, changelogEntry);

      createOrUpdateRelease({
        octokit,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        tagName,
        body: changelogEntry,
        prerelease: currentVersion.includes('-'),
      });
    }
  }

  // Push the tags
  git.pushTags('origin');

  // Publish to npm
  const publishResult = await releasePublish({});
  console.log(publishResult);
}

process.exit(0);

function isNpmNotFoundError(e: unknown) {
  return (
    e &&
    typeof e === 'object' &&
    'name' in e &&
    e.name === 'HttpErrorGeneral' &&
    'statusCode' in e &&
    e.statusCode === 404
  );
}
