# GitHub Workflows & Quality Assurance

This directory contains GitHub Actions workflows that automatically verify and maintain the quality of this repository.

## 🔄 Workflows Overview

### 1. CI/CD Pipeline (`ci.yml`)
**Triggers**: Push to `master`/`main`/`develop`, PRs to these branches

**Jobs**:
- **Quality Checks**: ESLint, TypeScript type checking
- **Testing**: Unit tests on Node.js 18 & 20, coverage reporting
- **Build**: Application build verification
- **Security**: Dependency audit, vulnerability scanning
- **Bundle Analysis**: Bundle size analysis (main branch only)
- **Deploy Preview**: GitHub Pages deployment (main branch only)
- **Notifications**: Results summary

### 2. PR Quality Check (`pr-check.yml`)
**Triggers**: Pull requests to `master`/`main`/`develop`

**Purpose**: Fast feedback loop for contributors
- Type checking
- Linting
- Basic tests (no coverage)
- Build verification
- Automated PR comments with results

## 🤖 Dependabot (`dependabot.yml`)

Automated dependency management:
- **NPM Dependencies**: Weekly updates, grouped by category
- **GitHub Actions**: Weekly updates
- **Smart Grouping**: Related packages updated together
- **Major Version Protection**: Prevents breaking changes

## 📋 Templates

### Issue Templates
- **Bug Report**: Structured bug reporting with environment details
- **Feature Request**: Feature proposals with acceptance criteria

### Pull Request Template
- Comprehensive checklist for contributors
- Type classification
- Testing requirements
- Review guidelines

## 👥 Code Ownership (`CODEOWNERS`)

Automatic reviewer assignment:
- Global ownership
- Specific ownership for components, services, tests
- Configuration file ownership
- Documentation ownership

## 🏃‍♂️ Quick Start for Contributors

1. **Fork & Clone**: Standard GitHub workflow
2. **Install**: `npm install`
3. **Develop**: Make your changes
4. **Quality Check**: Run `npm run lint && npm run type-check && npm test`
5. **Build**: Run `npm run build` to verify
6. **Submit PR**: Use the PR template

## 🔧 Local Development Commands

```bash
# Quality checks (matches CI)
npm run lint                 # ESLint
npm run type-check          # TypeScript
npm test                    # Jest tests
npm run test:coverage       # With coverage
npm run build              # Production build

# Development
npm run dev                # Development server
npm run test:watch         # Watch mode tests
```

## 🎯 Quality Standards

- ✅ All tests must pass
- ✅ TypeScript strict mode compliance
- ✅ ESLint rules compliance
- ✅ Build must succeed
- ✅ No high-severity security vulnerabilities
- ✅ Code coverage targets met

## 🚀 Deployment

- **Preview Deployments**: Automatic on main branch
- **GitHub Pages**: Live demo at `https://yourusername.github.io/FastGraphBff`
- **Artifacts**: Build artifacts stored for 7 days

## 🔒 Security

- Dependency vulnerability scanning
- Automated security updates via Dependabot
- Branch protection rules
- Required status checks 