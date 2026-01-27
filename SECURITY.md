# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in DilemmaWise, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly or use GitHub's private vulnerability reporting feature
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution Timeline**: Depends on severity (critical issues prioritized)

### Scope

In scope:

- Authentication/authorization bypasses
- API key exposure
- Cross-site scripting (XSS)
- Data exposure
- Server-side vulnerabilities

Out of scope:

- Issues in dependencies (report to the dependency maintainer)
- Social engineering
- Physical security
- Denial of service attacks

## Security Best Practices

When deploying DilemmaWise:

1. **API Keys**: Never commit API keys to version control
2. **Environment Variables**: Use `.env.local` for local development
3. **Production**: Use your hosting provider's secrets management
4. **HTTPS**: Always use HTTPS in production
5. **Updates**: Keep dependencies updated

## Security Features

DilemmaWise implements these security measures:

- All API keys are server-side only (never sent to browser)
- User input is sanitized by React's built-in XSS protection
- No database storage (minimizes attack surface)
- Environment variables validated at runtime

---

Thank you for helping keep DilemmaWise secure!
