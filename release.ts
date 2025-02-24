import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release';
import { simpleGit } from 'simple-git';
// import { Octokit } from 'octokit';

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

// const octokit = new Octokit();

const versionResult = await releaseVersion({});
console.log(versionResult);

const pendingVersions = Object.values(versionResult.projectsVersionData).some(
  (versionData) => versionData.newVersion
);

if (pendingVersions) {
  console.log("There are pending versions. Let's create a release PR.");
  simpleGit().addConfig('user.email', 'rachabot@storacha.network');
  simpleGit().addConfig('user.name', 'Rachabot');
  simpleGit().checkoutLocalBranch(RELEASE_BRANCH);
  const changelogResult = await releaseChangelog({
    versionData: versionResult.projectsVersionData,
    deleteVersionPlans: true,
    createRelease: false,
    gitPush: false,
  });
  console.log(changelogResult);
  simpleGit().push('origin', RELEASE_BRANCH, { '--force': null });
  const changelogs = Object.entries(
    changelogResult.projectChangelogs ?? {}
  ).map(([project, changelog]) =>
    changelog.contents.replace(/^## /, `## ${project}@`)
  );
  console.log(changelogs.join('\n\n'));

  // Push to `release` branch & open/update PR
} else {
  console.log("There are no pending versions. Let's publish the release.");
  const publishResult = await releasePublish({ dryRun: true });
  console.log(publishResult);
}

process.exit(0);
