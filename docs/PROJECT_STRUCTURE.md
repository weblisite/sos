# Project Structure - Single Root Configuration

## ✅ Correct Structure

### Root Level (Single Source of Truth)
```
SOS/
├── package.json              ✅ ALL dependencies here
├── package-lock.json         ✅ Single lock file
├── .npmrc                    ✅ npm configuration
├── .eslintrc.json            ✅ Root ESLint config (extended by subdirs)
├── render.yaml               ✅ Deployment config (ONLY at root)
├── .gitignore                ✅ Git ignore rules
└── README.md                 ✅ Project documentation
```

### Frontend Directory (Source Code Only)
```
frontend/
├── src/                      ✅ Source code
├── index.html                ✅ Entry point (frontend-specific)
├── vite.config.ts            ✅ Vite config (frontend-specific)
├── tailwind.config.js        ✅ Tailwind config (frontend-specific)
├── postcss.config.js         ✅ PostCSS config (frontend-specific)
├── tsconfig.json             ✅ TypeScript config (extends root patterns)
├── tsconfig.node.json        ✅ Vite-specific TS config
└── .eslintrc.cjs             ✅ Extends root .eslintrc.json
```

### Backend Directory (Source Code Only)
```
backend/
├── src/                      ✅ Source code
├── drizzle.config.ts         ✅ Drizzle ORM config (backend-specific)
├── jest.config.js            ✅ Jest test config (backend-specific)
├── tsconfig.json             ✅ TypeScript config (extends root patterns)
└── .eslintrc.json            ✅ Extends root .eslintrc.json
```

## ❌ Files That Should NOT Be in Subdirectories

- ❌ `render.yaml` - Should ONLY be at root
- ❌ `package.json` - Should ONLY be at root
- ❌ `package-lock.json` - Should ONLY be at root

## ✅ Files That SHOULD Be in Subdirectories

These are tool-specific and need to be in their directories:

### Frontend-Specific (Must stay in `frontend/`)
- `vite.config.ts` - Vite build tool config
- `tailwind.config.js` - Tailwind CSS framework
- `postcss.config.js` - PostCSS processing
- `index.html` - Frontend entry point
- `tsconfig.node.json` - Vite-specific TypeScript config

### Backend-Specific (Must stay in `backend/`)
- `drizzle.config.ts` - Drizzle ORM configuration
- `jest.config.js` - Jest testing framework config

### TypeScript Configs (Different for each)
- `frontend/tsconfig.json` - React, ESNext, DOM libs
- `backend/tsconfig.json` - CommonJS, Node, different libs
- `shared/tsconfig.json` - Shared library config

## Configuration Hierarchy

### ESLint
- **Root**: `.eslintrc.json` - Base config with common rules
- **Frontend**: `.eslintrc.cjs` - Extends root, adds React rules
- **Backend**: `.eslintrc.json` - Extends root, adds Node rules

### TypeScript
- Each directory has its own `tsconfig.json` because:
  - Frontend: ESNext modules, React JSX, DOM APIs
  - Backend: CommonJS modules, Node APIs
  - Shared: Library configuration

### Build Tools
- **Vite** (`vite.config.ts`) - Frontend only
- **Drizzle** (`drizzle.config.ts`) - Backend only
- **Jest** (`jest.config.js`) - Backend only

## Why This Structure?

1. **Single package.json**: All dependencies managed in one place
2. **Single package-lock.json**: One lock file for consistency
3. **Single render.yaml**: One deployment configuration
4. **Root ESLint**: Shared linting rules, extended by subdirs
5. **Separate TypeScript configs**: Different module systems and environments
6. **Tool-specific configs**: Stay with their tools (Vite, Drizzle, Jest)

## Verification

Run this to verify structure:
```bash
# Should show only root package.json
find . -name "package.json" -not -path "*/node_modules/*" | grep -v node_modules

# Should show only root package-lock.json
find . -name "package-lock.json" -not -path "*/node_modules/*"

# Should show only root render.yaml
find . -name "render.yaml" -not -path "*/node_modules/*"
```

