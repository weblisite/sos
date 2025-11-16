# Analysis: 5 Unused Backend Endpoints

## Summary

**2 endpoints are intentionally unused** (Clerk handles profile management)  
**3 endpoints could benefit from frontend integration** (nice-to-have features)

---

## Endpoint Analysis

### 1. `GET /api/v1/api-keys/:id` ❓ **Optional**

**Current Status:**
- ✅ Backend fully implemented
- ❌ Frontend doesn't call it
- ✅ All API key info is shown in the list view

**Use Case:**
- Could be used for a dedicated detail view/modal
- Currently, all information is displayed inline in the list

**Recommendation:** ⚠️ **Low Priority**
- Not critical - current list view shows all necessary info
- Could add a "View Details" modal for better UX
- Would be useful if we add more fields to API keys in the future

---

### 2. `PUT /api/v1/api-keys/:id` ⭐ **Recommended**

**Current Status:**
- ✅ Backend fully implemented
- ❌ Frontend doesn't call it
- ❌ No edit functionality in UI

**Use Case:**
- Allow users to update API key name without rotating
- Update expiration date without creating a new key
- Update permissions (if needed)

**Current Workaround:**
- Users must delete and recreate to change name
- Users must rotate to change expiration

**Recommendation:** ✅ **Medium Priority**
- Would improve UX significantly
- Common feature in API key management
- Easy to implement (add edit button/modal)

**Implementation Effort:** ~30 minutes
- Add "Edit" button to API key list
- Create edit modal with name and expiration fields
- Call `PUT /api/v1/api-keys/:id` endpoint

---

### 3. `GET /api/v1/audit-logs/:id` ❓ **Optional**

**Current Status:**
- ✅ Backend fully implemented
- ❌ Frontend doesn't call it
- ✅ Details shown inline with `<details>` element

**Use Case:**
- Dedicated detail view/modal for audit log entries
- Better formatting for complex details
- Could show related logs or context

**Current Implementation:**
- Details are expandable inline in the table
- Shows full JSON in a `<pre>` tag

**Recommendation:** ⚠️ **Low Priority**
- Current inline view is functional
- Would be nice-to-have for better UX
- Not critical for functionality

---

### 4. `PUT /api/v1/users/me` ✅ **Intentionally Unused**

**Current Status:**
- ✅ Backend fully implemented
- ❌ Frontend doesn't call it
- ✅ Clerk's `UserButton` handles profile management

**Use Case:**
- Update user name and avatar
- Would be used if we had custom profile page

**Current Implementation:**
- Using Clerk's built-in profile management
- `UserButton` component handles all profile updates
- No custom profile page needed

**Recommendation:** ✅ **Keep as-is**
- Clerk handles this better
- No frontend integration needed
- Endpoint available for API-only usage

---

### 5. `POST /api/v1/users/me/avatar` ✅ **Intentionally Unused**

**Current Status:**
- ✅ Backend fully implemented
- ❌ Frontend doesn't call it
- ✅ Clerk's `UserButton` handles avatar uploads

**Use Case:**
- Upload user avatar image
- Would be used if we had custom profile page

**Current Implementation:**
- Using Clerk's built-in avatar management
- `UserButton` component handles avatar uploads
- No custom avatar upload needed

**Recommendation:** ✅ **Keep as-is**
- Clerk handles this better
- No frontend integration needed
- Endpoint available for API-only usage

---

## Recommendations Summary

| Endpoint | Priority | Action | Effort |
|----------|----------|--------|--------|
| `GET /api/v1/api-keys/:id` | Low | Optional detail view | ~20 min |
| `PUT /api/v1/api-keys/:id` | **Medium** | **Add edit functionality** | **~30 min** |
| `GET /api/v1/audit-logs/:id` | Low | Optional detail view | ~20 min |
| `PUT /api/v1/users/me` | N/A | Keep unused (Clerk) | - |
| `POST /api/v1/users/me/avatar` | N/A | Keep unused (Clerk) | - |

---

## Conclusion

**Only 1 endpoint needs frontend integration:**
- ✅ `PUT /api/v1/api-keys/:id` - Add edit functionality for API keys

**2 endpoints are intentionally unused:**
- ✅ User profile endpoints (Clerk handles it)

**2 endpoints are optional:**
- ⚠️ Detail views for API keys and audit logs (nice-to-have)

---

## Recommended Action Plan

### Priority 1: API Key Edit Feature ⭐
1. Add "Edit" button to each API key in the list
2. Create edit modal with:
   - Name input field
   - Expiration date picker
3. Call `PUT /api/v1/api-keys/:id` on save
4. Invalidate React Query cache to refresh list

**Estimated Time:** 30 minutes  
**Impact:** High - Improves UX significantly

### Priority 2: Optional Enhancements (Future)
- Add detail modals for API keys and audit logs
- These are nice-to-have but not critical

---

**Answer: Only 1 endpoint (`PUT /api/v1/api-keys/:id`) needs frontend integration. The other 4 are either intentionally unused (Clerk) or optional enhancements.**

