module.exports = () => ({
  autoDetect: ['node:test'],

  // Default override esm hooks settings if not specified
  esmHooks: ['@swc-node/register/esm-register', 'ts-node/esm', 'tsx/esm'],

  // Default preload modules settings if not specified
  preloadModules: [
    '@swc-node/register',
    'ts-node/register',
    'tsx/cjs',
    'esbuild-register',
  ],
});
