# Server Refactoring Plan

## Current State (February 2026)
The `server.py` file has grown to ~4700 lines and contains all API routes. While functional, this makes maintenance difficult.

## Completed Refactoring

### Extracted Modules
1. **`database.py`** - Database connection, logger, configuration constants
2. **`models.py`** - All Pydantic models (~400 lines)
3. **`dependencies.py`** - Auth middleware (`require_auth`, `require_admin`, `require_coach`, etc.)
4. **`utils.py`** - Utility functions (password hashing, email helpers)
5. **`routes/auth.py`** - Authentication routes (ready but not yet integrated)

## Remaining Work

### Route Groups to Extract
Each should be moved to `routes/<name>.py`:

| Route Group | Prefix | Lines | Priority | Notes |
|-------------|--------|-------|----------|-------|
| coaches | /api/coaches | ~400 | P1 | Coach CRUD operations |
| users | /api/users, /api/invites | ~500 | P1 | User management |
| observations | /api/observations | ~350 | P1 | Session observations |
| organization | /api/organization | ~150 | P2 | Org settings |
| coach_portal | /api/coach | ~500 | P2 | Coach-specific endpoints |
| admin | /api/admin | ~600 | P2 | Admin dashboard |
| payments | /api/payments | ~200 | P3 | Stripe integration |
| templates | /api/reflection-templates | ~250 | P3 | Reflection templates |
| ai | /api/generate-* | ~200 | P3 | AI summaries |
| files | /api/upload, /api/files | ~100 | P3 | File handling |

### Migration Steps (for each route group)

1. Create `routes/<name>.py`
2. Copy routes to new file
3. Update imports to use shared modules
4. Add router to main app:
   ```python
   from routes.<name> import router as <name>_router
   api_router.include_router(<name>_router)
   ```
5. Remove routes from `server.py`
6. Test thoroughly

### Integration Pattern
```python
# In server.py
from routes.auth import router as auth_router
from routes.coaches import router as coaches_router
# ... etc

api_router.include_router(auth_router)
api_router.include_router(coaches_router)
# ... etc
```

## Testing Checklist
After each migration:
- [ ] Backend starts without errors
- [ ] All routes accessible via curl
- [ ] Frontend can login
- [ ] Critical flows work (create session, view coaches, etc.)

## Notes
- Keep `server.py` as single source of truth until fully migrated
- Test each route group independently before removing from server.py
- Maintain backward compatibility throughout migration
