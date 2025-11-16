# Documentation Directory

This `docs/` directory contains all documentation files (`.md` files) for the project, except for the main documentation files which are kept at the root.

## Main Documentation Files (Root Directory)

These files are kept at the root for easy access:
- `README.md` - Main project README
- `BUILD.md` - Build documentation
- `PRD.md` - Product requirements document

## All Other Documentation Files

All other `.md` files should be created and saved in this `docs/` directory, including:
- Deployment documentation
- Architecture documentation
- Migration guides
- Technical specifications
- API documentation
- Troubleshooting guides
- Implementation guides
- Connector documentation
- Any other project documentation

## Convention

**When creating new `.md` files:**
- ✅ Create them in `docs/` directory
- ❌ Do NOT create them in the root directory (except README.md, BUILD.md, PRD.md)
- ❌ Do NOT create them in `backend/`, `frontend/`, or `shared/` directories
- ❌ Do NOT create them in `.mdfiles/` (this directory has been consolidated into `docs/`)

This keeps the project root clean and organized while maintaining easy access to the main documentation files and consolidating all documentation in one place.

## Directory Structure

```
SOS/
├── README.md              ✅ Main project README (root)
├── BUILD.md               ✅ Build documentation (root)
├── PRD.md                 ✅ Product requirements (root)
└── docs/                  ✅ All other documentation
    ├── README.md          ✅ This file
    ├── *.md               ✅ All project documentation
    └── ...
```
