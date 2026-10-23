console.error(
  'Production deployment requires explicit maintainer authorization. After review, the maintainer can run npx wrangler deploy.',
);
process.exitCode = 1;
