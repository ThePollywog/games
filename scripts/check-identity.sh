#!/bin/sh
# Fails if any commit reachable from the given revision (default HEAD) has an author or committer
# other than the Pollywog identity. Merge commits that GitHub's web UI made may carry the committer
# GitHub <noreply@github.com>. Used by the identity and Pages workflows.
#   scripts/check-identity.sh [rev]
set -eu
NAME=thepollywog
EMAIL=thepollywog@proton.me
rev=${1:-HEAD}
sep=$(printf '\037') # not whitespace, so an empty field (a root commit's parents) survives read
bad=0
git log --format='%H%x1f%P%x1f%an%x1f%ae%x1f%cn%x1f%ce' "$rev" > "${TMPDIR:-/tmp}/identity.$$"
while IFS="$sep" read -r sha parents an ae cn ce; do
  if [ "$an" != "$NAME" ] || [ "$ae" != "$EMAIL" ]; then
    echo "$sha: author is $an <$ae>"
    bad=1
  fi
  if [ "$cn" != "$NAME" ] || [ "$ce" != "$EMAIL" ]; then
    case $parents in
      *' '*) [ "$cn" = GitHub ] && [ "$ce" = noreply@github.com ] && continue ;;
    esac
    echo "$sha: committer is $cn <$ce>"
    bad=1
  fi
done < "${TMPDIR:-/tmp}/identity.$$"
rm -f "${TMPDIR:-/tmp}/identity.$$"
if [ $bad -ne 0 ]; then
  echo "Every commit must be authored and committed as $NAME <$EMAIL>."
  exit 1
fi
echo "All $(git rev-list --count "$rev") commits are $NAME <$EMAIL>."
