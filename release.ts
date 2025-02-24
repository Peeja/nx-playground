import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release';
import { simpleGit } from 'simple-git';
import { Octokit } from 'octokit';
import { createOrUpdateReleasePR } from './gh.js';

const envVar = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
  return value;
};

export const REPO_OWNER = envVar('GITHUB_REPOSITORY_OWNER');
export const REPO_NAME = envVar('GITHUB_REPOSITORY_NAME');
export const MAIN_BRANCH = envVar('MAIN_BRANCH_NAME');
export const RELEASE_BRANCH = envVar('RELEASE_BRANCH_NAME');

const versionResult = await releaseVersion({});
console.log(versionResult);

const pendingVersions = Object.values(versionResult.projectsVersionData).some(
  (versionData) => versionData.newVersion
);

if (pendingVersions) {
  console.log("There are pending versions. Let's create a release PR.");
  const octokit = new Octokit();
  await simpleGit().addConfig('user.email', 'rachabot@storacha.network');
  await simpleGit().addConfig('user.name', 'Rachabot');
  await simpleGit().checkoutLocalBranch(RELEASE_BRANCH);
  const changelogResult = await releaseChangelog({
    versionData: versionResult.projectsVersionData,
    deleteVersionPlans: true,
    createRelease: false,
    gitPush: false,
  });
  console.log(await simpleGit().status());
  console.log(changelogResult);
  await simpleGit().push('origin', RELEASE_BRANCH, { '--force': null });
  const changelogs = Object.entries(
    changelogResult.projectChangelogs ?? {}
  ).map(([project, changelog]) =>
    changelog.contents.replace(/^## /, `## ${project}@`)
  );
  console.log(changelogs.join('\n\n'));

  const versions = Object.entries(versionResult.projectsVersionData)
    .map(([project, versionData]) => `${project}@${versionData.newVersion}`)
    .join(', ');

  createOrUpdateReleasePR({
    octokit,
    owner: REPO_OWNER,
    name: REPO_NAME,
    releaseBranchName: RELEASE_BRANCH,
    mainBranchName: MAIN_BRANCH,
    title: `Release ${versions}`,
    body: changelogs.join('\n\n'),
  });
} else {
  console.log("There are no pending versions. Let's publish the release.");
  const publishResult = await releasePublish({ dryRun: true });
  console.log(publishResult);
}

process.exit(0);
