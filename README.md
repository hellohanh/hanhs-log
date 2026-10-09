# Hanh's Log

One app for trip planning (**Wanderlog**) and eateries (**Savorlog**), sharing one
login and one database. Live at https://hellohanh.github.io/hanhs-log/

## How changes ship

1. Claude commits each change to a branch and opens a pull request.
2. The PR gets a preview link (a comment from the preview bot) at
   `https://hellohanh.github.io/hanhs-log/pr-preview/pr-<number>/`.
   Check it on your phone and laptop.
3. Click **Merge**. The live site updates in about two minutes.

No files are copied by hand and no zips are needed: git history is the record.

## Database

The database is shared with Wanderlog, so it has its own rules, nightly
encrypted backups and an approval step before any change runs. See
[docs/database.md](docs/database.md).

## Running it on your own computer (optional)

```
npm install
npm run dev
```

Keep the folder on a local drive, in a path with no apostrophes or other quote
characters (see Wanderlog lesson L37).
