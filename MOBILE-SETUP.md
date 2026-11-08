# Course Helper: phone editing and live bookmarklet

## What this setup does

Edit `course-helper.js` in GitHub from your phone, commit the change, then run the same bookmarklet on the course page on your computer. The bookmarklet downloads the current JavaScript from the repository each time it runs. You do not need to rebuild or replace the bookmarklet for normal code edits.

## One-time bookmarklet setup

1. Open `course-helper-bookmarklet.txt` and copy the entire line beginning with `javascript:`.
2. On the computer/browser where you use the course, create a bookmark.
3. Edit that bookmark. Give it the name `Course Helper (Live)`.
4. Replace its URL/address with the copied `javascript:...` line and save it.
5. Refresh the course page, then click the bookmark.

If the browser removes the `javascript:` prefix when saving, type that prefix back at the beginning of the bookmark URL.

## Updating from your phone

1. Open https://github.com/IITOKSII/course-helper
2. Open `course-helper.js`.
3. Tap the pencil/Edit button.
4. Make the code change.
5. Choose **Commit changes** and commit directly to `main`.
6. On the computer, refresh the course page and click `Course Helper (Live)` again.

The bookmarklet fetches the latest file on every run using a cache-busting query parameter. Refresh the course page before re-running so the previous helper instance is cleared.

## Important

- The repository is currently **public**. Anyone with the repository URL can read its files. Do not put passwords, tokens, student records, or private course data in it.
- The live loader requires an internet connection and the public raw GitHub file to remain accessible.
- Changes committed to `course-helper.js` are picked up on the next bookmarklet run. You do not need to edit the bookmarklet again.
- If a new helper version changes the installation process, update the bookmarklet only if the loader URL or file path changes.
