---
name: Room Files
overview: Add a room detail page where a host can upload session notes/files, and only joined students can view/download them. Includes Supabase Storage + a DB table for file metadata with RLS permissions.
todos:
  - id: routing-room
    content: Add `#room:<groupId>` routing and a `page-room` UI shell.
    status: pending
  - id: room-card-link
    content: Add a Details/View button from each group card to navigate to room page.
    status: pending
  - id: room-files-module
    content: Implement client functions to load room files, upload files, and delete files (host-only).
    status: pending
  - id: supabase-storage-flow
    content: Integrate Supabase Storage uploads + signed URLs for member viewing/downloading.
    status: pending
  - id: db-schema-rls
    content: Design `group_files` table and Storage bucket, then add RLS policies (members can read; host can upload/delete).
    status: pending
  - id: ui-file-tab
    content: "Build the Files tab UI: upload control (host), file list (members), validations (<=10MB)."
    status: pending
isProject: false
---

## Target feature

Hosts can share session content as uploaded files ("notes" as documents/images). Joined students can access the files on a per-room detail page.

## Implementation approach

- Add a new `room` route/page that loads a room by `groupId`.
- Create a "Files" section with:
  - A file upload UI (host-only) that uploads to Supabase Storage and records metadata in a DB table.
  - A file list (members-only) that fetches metadata from the DB table and uses signed URLs for viewing/downloading.
- Add Supabase Storage + DB schema + RLS rules so security is enforced even if someone tries to access via URL.

```mermaid
flowchart LR
  User[User (host or student)] --> UI[Room Detail: Files tab]
  UI -->|load room + membership| DB[(Supabase DB)]
  UI -->|list file metadata| DB
  UI -->|createSignedUrl for files| Storage[(Supabase Storage objects)]
  Host -->|upload file| Storage
  Host -->|insert metadata| DB
```



## Concrete changes

1. **Routing + page shell**
  - Update `d:\StudySync\js\router.js` to support a dynamic route like `#room:<groupId>` (or `#room/<groupId>`).
  - Update `d:\StudySync\index.html` to include a new page container `page-room` with at least:
    - Room header (subject/date/time/location)
    - A Files tab/section
    - Upload form (hidden unless host)
    - File list container
2. **Navigation from existing cards**
  - Update group card rendering in `d:\StudySync\js\ui.js` so there is a "View"/"Details" action that navigates to the room page.
  - If you prefer strict UX gating, show the Files section as locked when user is not a member; RLS will still protect file access.
3. **Client data layer for files**
  - Add new module or extend `d:\StudySync\js\groups.js` (recommended: `d:\StudySync\js\roomFiles.js`) with functions:
    - `loadRoom(groupId)` (room row)
    - `loadRoomFiles(groupId)` (select from `group_files`)
    - `uploadRoomFiles(groupId, files, meta)` (upload to Storage + insert metadata)
    - `deleteRoomFile(fileId)` (host-only)
  - Use `memberships` to determine whether the current user is a joined student; use `groups.host_id` to determine host role.
4. **Supabase Storage integration**
  - Add a storage bucket (private) e.g. `group-files`.
  - Upload path convention: `group_id/<fileId>/<originalName>` (or `group_id/<timestamp>_<name>`).
  - For viewing/downloading, use `supabase.storage.from(bucket).createSignedUrl(storage_path, expires)` and open the URL.
5. **DB schema + RLS** (Supabase dashboard)
  - Create a table like `group_files`:
    - `id` (uuid pk)
    - `group_id` (FK -> `groups.id`)
    - `uploader_id` (FK -> auth.users)
    - `file_name`, `file_type`, `file_size`
    - `storage_path` (text)
    - `title` (optional short text; host-entered)
    - `created_at`
  - Add RLS policies:
    - `SELECT`: allow only users who are members of the room (`memberships` join by `group_id`).
    - `INSERT`: allow only host of that room.
    - `DELETE`: allow only host (or only uploader, depending on your preference).
6. **User experience details**
  - Enforce your chosen constraints in UI:
    - Allowed types: "any" file type (but still validate basic MIME and block executables if you want later).
    - Max size: `10 MB` per file (block before upload).
    - Support multiple uploads.
  - Add delete confirmation and error toasts.

## Files to change/add

- Update: `d:\StudySync\index.html`
- Update: `d:\StudySync\js\router.js`
- Update: `d:\StudySync\js\ui.js` (card navigation + room file list rendering)
- Add (recommended): `d:\StudySync\js\roomFiles.js`
- Update/Use: `d:\StudySync\js\supabase.js` (optionally add bucket constant)

## Manual Supabase setup steps (required)

- Create Storage bucket `group-files` (private).
- Create DB table `group_files` + enable RLS.
- Add RLS policies and indexes.

