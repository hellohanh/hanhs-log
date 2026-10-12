#!/usr/bin/env bash
# Posts (or updates) the one "preview" comment on a pull request, replacing
# rossjrw/pr-preview-action's sticky comment (L42). It keeps that action's
# hidden marker, so an older preview comment is updated rather than duplicated.
#
#   scripts/preview-comment.sh deploy <pr-number> <preview-url>
#   scripts/preview-comment.sh remove <pr-number>
#
# Needs GH_TOKEN (github.token with pull-requests: write) and GITHUB_REPOSITORY.
set -euo pipefail

repo="${GITHUB_REPOSITORY:?}"
action="${1:?deploy|remove}"
pr="${2:?pr number}"
url="${3:-}"
marker='<!-- Sticky Pull Request Commentpr-preview -->'
now=$(date -u '+%Y-%m-%d %H:%M UTC')

if [ "$action" = "deploy" ]; then
  qr="https://qr.rossjrw.com/?color.dark=0d1117&url=${url}"
  body=$(cat <<EOF
**Preview**
:---:
| <p><img src="${qr}" height="100" align="right" alt="QR code for preview link"></p> :rocket: View preview at <br> ${url} <br><br>
| <h6>Built to branch [\`gh-pages\`](https://github.com/${repo}/tree/gh-pages) at ${now}; GitHub Pages has published it. <br><br> </h6>

${marker}
EOF
)
else
  body=$(cat <<EOF
**Preview**
:---:
Preview removed because the pull request was closed.
${now}

${marker}
EOF
)
fi

id=$(gh api "repos/$repo/issues/$pr/comments?per_page=100" --paginate \
  --jq ".[] | select(.body | contains(\"$marker\")) | .id" | tail -1)
if [ -n "$id" ]; then
  gh api -X PATCH "repos/$repo/issues/comments/$id" -f body="$body" >/dev/null
  echo "Updated the preview comment on PR #$pr."
else
  gh api -X POST "repos/$repo/issues/$pr/comments" -f body="$body" >/dev/null
  echo "Posted the preview comment on PR #$pr."
fi
