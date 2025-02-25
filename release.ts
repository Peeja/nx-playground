import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release';
import { simpleGit } from 'simple-git';
import { Octokit } from 'octokit';
import npmFetch from 'npm-registry-fetch';
import { createOrUpdateReleasePR } from './gh.js';

const envVar = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
  return value;
};

const versionResult = await releaseVersion({});
console.log(versionResult);

const pendingVersions = Object.values(versionResult.projectsVersionData).some(
  (versionData) => versionData.newVersion
);

const git = simpleGit();

if (pendingVersions) {
  console.log("There are pending versions. Let's create a release PR.");

  const REPO_OWNER = envVar('GITHUB_REPOSITORY_OWNER');
  const REPO_NAME = envVar('GITHUB_REPOSITORY_NAME');
  const MAIN_BRANCH = envVar('MAIN_BRANCH_NAME');
  const RELEASE_BRANCH = envVar('RELEASE_BRANCH_NAME');
  const octokit = new Octokit({ auth: envVar('GITHUB_TOKEN') });

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
    changelog.contents.replace(/^## /, `## ${project}@`)
  );
  console.log(changelogs.join('\n\n'));

  const versions = Object.entries(versionResult.projectsVersionData)
    .map(([project, versionData]) => `${project}@${versionData.newVersion}`)
    .join(', ');

  await createOrUpdateReleasePR({
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

  const newProjectsVersionData = Object.fromEntries(
    await Promise.all(
      Object.entries(versionResult.projectsVersionData).map(
        async (entry): Promise<typeof entry> => {
          const [project, versionData] = entry;
          const latestPublishedVersion = await npmFetch
            .json(`/${project}/latest`)
            .then((pkg) => pkg.version as string)
            .catch((e: unknown) => {
              if (isNotFoundError(e)) {
                // If no version has been published, use '' as the latest version.
                return '';
              } else {
                throw e;
              }
            });
          if (latestPublishedVersion === versionData.currentVersion) {
            console.log(
              `Version ${versionData.currentVersion} already published.`
            );
            return [project, versionData];
          } else {
            console.log(
              `Going to publish ${project}@${versionData.currentVersion}`
            );
            return [
              project,
              {
                ...versionData,
                currentVersion: latestPublishedVersion,
                newVersion: versionData.currentVersion,
              },
            ];
          }
        }
      )
    )
  );

  console.log('newProjectsVersionData:', newProjectsVersionData);

  // Rerun the changelog to create the GitHub releases and the git tags
  await releaseChangelog({
    // versionData: versionResultToPublish.projectsVersionData,
    versionData: newProjectsVersionData,
    deleteVersionPlans: true,
    createRelease: 'github',
    gitPush: false,
  });

  // Push the tags
  git.pushTags('origin');

  // Publish to npm
  const publishResult = await releasePublish({});
  console.log(publishResult);
}

process.exit(0);

function isNotFoundError(e: unknown) {
  return (
    e &&
    typeof e === 'object' &&
    'name' in e &&
    e.name === 'HttpErrorGeneral' &&
    'statusCode' in e &&
    e.statusCode === 404
  );
}
