# AuthProfileService: granted screens only

Changed source: `backend/HRM.API/Modules/Auth/Services/AuthProfileService.cs`.

The active User is resolved by string UserId. Role metadata is loaded through user_roles -> roles. Screen permission rows are retrieved using a database query joining user_roles -> role_details -> screens, constrained by the current user's stored UserId and active screens. There is no standalone query loading all screens.

Actual entity flags are Y/N strings, not bools. All grants for each ScreenId are grouped and the six action flags are combined with OR. Only after aggregating all roles is CanView == Y applied. This preserves, for example, CanView from one role and CanUpdate from another role whose own CanView is N. Screens without a grant, without an aggregated Y view flag, inactive screens and grants belonging only to other users are omitted. ADMIN has no special bypass.

The existing DTO definitions and Login /me JSON structure were left byte-identical. Existing backend ScreenPermissionHandler still checks current permissions and the requested action; tests exercise grant/revoke for New, View, Update, Delete, Approve and Export. Because the handler uses the profile, a screen must be viewable as well as have the requested action grant.

Tests added in `backend/HRM.API.Tests/AuthProfileServiceTests.cs` cover no roles, no grants including ADMIN, inactive/missing users, unrelated users/roles/screens, all six OR flags, no duplicates, metadata fields and SQL shape. The intercepted screen query must include user_roles, INNER JOIN role_details, INNER JOIN screens and a user filter. Existing API tests were updated to expect an empty permissions array after CanView revocation or removal of all roles.

## Validation and existing build blocker

`dotnet build HRM.API.csproj` was run in the actual backend directory. It fails with CS1061 at `Migrations/20261019074710_InitialHRMDatabase.cs:158`: the migration refers to x.parent_id although the screens anonymous column definition no longer contains parent_id. The file was already modified before this task. This task did not modify it, because the user explicitly requested no migration changes.

To verify the requested Auth behavior independently, the current API/test sources were copied to `/private/tmp/hrm-profile-permissions/verification`. Only the temporary copy's project file excludes Migration C# files from compilation; original source/migrations are unchanged. The tests selected AuthProfileServiceTests and AuthenticationApiTests and used disposable SQLite/TestServer, with no Railway connection.

Result: 18 passed, 0 failed, 0 skipped. This is isolated Auth verification, NOT a successful full build of the original project. The existing migration compilation error must be resolved before the full project can build. No migration was generated, changed or applied, and no database was changed.

Entities/configurations, DTOs and all migration files are byte-identical to `/private/tmp/hrm-profile-permissions/before.tar.gz`, captured at the start of this task. Source changes are limited to AuthProfileService, two test files and this report.
