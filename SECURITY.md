# Security policy

Security fixes are developed on the default branch. The project is an early preview; older snapshots are not separately maintained.

For a sensitive vulnerability, use **Security → Report a vulnerability** in this GitHub repository when private reporting is enabled. If that option is unavailable, open an issue asking the maintainer for a private reporting channel without including exploit details, credentials, or personal data.

For a private report, provide the affected revision, reproduction with synthetic inputs, impact, and any suggested fix. Do not test against third-party systems or send real customer data to a demo instance.

Public mocks are immutable and synthetic. They do not provide authentication, persist writes, provision services, or deliver webhooks. The Node preview binds to localhost. Production deployments require the maintainer to review hosting limits and configuration.
