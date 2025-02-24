import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release';
// import { Octokit } from 'octokit';

export const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER;
export const REPO_NAME = process.env.GITHUB_REPOSITORY_NAME;
export const MAIN_BRANCH = process.env.GITHUB_BASE_REF;
export const RELEASE_BRANCH = process.env.RELEASE_BRANCH_NAME;

// const octokit = new Octokit();

const versionResult = await releaseVersion({ dryRun: true });
console.log(versionResult);

const pendingVersions = Object.values(versionResult.projectsVersionData).some(
  (versionData) => versionData.newVersion
);

if (pendingVersions) {
  console.log("There are pending versions. Let's create a release PR.");
  const changelogResult = await releaseChangelog({
    dryRun: true,
    versionData: versionResult.projectsVersionData,
    deleteVersionPlans: true,
    createRelease: false,
    gitPush: false,
  });
  console.log(changelogResult);
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
