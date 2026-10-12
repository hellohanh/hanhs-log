#!/usr/bin/env bash
# Keeps our two publishers (Deploy site, Pull request preview) from tripping
# over GitHub's own "pages build and deployment" job.
#
# Both push to the gh-pages branch, and every push starts GitHub's Pages job.
# When two pushes land seconds apart (a merge publishes the live site AND
# removes that PR's preview), GitHub's job can fail with 'Multiple artifacts
# named "github-pages"' (session 8, run #159). A re-run of that job can never
# pass (each re-run adds another copy).
#
#   scripts/pages-guard.sh idle   before publishing: wait until no Pages job is running
#   scripts/pages-guard.sh after  after publishing: wait for the Pages job of the
#                                 gh-pages head; if it failed, ask GitHub for a fresh
#                                 Pages build, delete the failed run, and check again
#
# Needs GH_TOKEN (the workflow's github.token) with actions: write, pages: write.
set -uo pipefail

repo="${GITHUB_REPOSITORY:?}"
mode="${1:-}"
deadline=$(( $(date +%s) + 600 ))   # never hold a publish more than 10 minutes

busy() {
  local n=0 s c
  for s in queued in_progress waiting pending requested; do
    c=$(gh api "repos/$repo/actions/runs?event=dynamic&status=$s&per_page=1" --jq '.total_count' 2>/dev/null || echo 0)
    n=$(( n + c ))
  done
  echo "$n"
}

# Latest Pages run for a commit: "<id> <status> <conclusion>" (empty if none yet).
pages_run() {
  gh api "repos/$repo/actions/runs?event=dynamic&head_sha=$1&per_page=1" \
    --jq '.workflow_runs[0] | select(.) | "\(.id) \(.status) \(.conclusion)"' 2>/dev/null
}

# Wait for the newest Pages run for $1 created after run id $2 to finish; print "<id> <conclusion>".
wait_for() {
  local sha="$1" after="${2:-0}" id status conclusion
  while [ "$(date +%s)" -lt "$deadline" ]; do
    read -r id status conclusion <<< "$(pages_run "$sha")"
    if [ -n "${id:-}" ] && [ "$id" -gt "$after" ] && [ "$status" = "completed" ]; then
      echo "$id $conclusion"; return 0
    fi
    sleep 10
  done
  return 1
}

case "$mode" in
  idle)
    while [ "$(date +%s)" -lt "$deadline" ]; do
      [ "$(busy)" = "0" ] && { echo "No Pages job running; publishing."; exit 0; }
      echo "A GitHub Pages job is still running; waiting so the two don't overlap…"
      sleep 10
    done
    echo "::warning title=Pages::Waited 10 minutes for a running Pages job; publishing anyway."
    ;;
  after)
    sha=$(git ls-remote "https://x-access-token:${GH_TOKEN}@github.com/$repo.git" refs/heads/gh-pages | cut -f1)
    sleep 5
    if ! res=$(wait_for "$sha" 0); then
      echo "::warning title=Pages::GitHub's Pages job for ${sha:0:7} didn't finish within 10 minutes; check Actions → pages build and deployment."
      exit 0
    fi
    read -r id conclusion <<< "$res"
    if [ "$conclusion" = "success" ]; then
      echo "::notice title=Pages::Published: GitHub's Pages job for ${sha:0:7} succeeded."
      exit 0
    fi
    echo "GitHub's Pages job $id for ${sha:0:7} ended '$conclusion'; asking for a fresh build."
    gh api -X POST "repos/$repo/pages/builds" >/dev/null || true
    if res=$(wait_for "$sha" "$id"); then
      read -r id2 conclusion2 <<< "$res"
      if [ "$conclusion2" = "success" ]; then
        gh api -X DELETE "repos/$repo/actions/runs/$id" >/dev/null 2>&1 || true
        echo "::notice title=Pages::GitHub's Pages job hiccupped (run $id); a fresh build published ${sha:0:7} and the failed run was removed."
        exit 0
      fi
    fi
    echo "::error title=Pages::GitHub's Pages job for ${sha:0:7} failed twice. The site may not have updated; re-run this workflow."
    exit 1
    ;;
  *)
    echo "usage: $0 idle|after" >&2; exit 2 ;;
esac
