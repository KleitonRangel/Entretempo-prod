$g = "C:\Program Files\Git\cmd\git.exe"
Set-Location C:\Users\kleyt\Downloads\Entretempo

# Get all commit hashes oldest first
$commits = & $g rev-list --reverse main 2>&1 | Where-Object { $_ -match '^[a-f0-9]{40}$' }
Write-Host "Total commits to rewrite: $($commits.Count)"

# Create orphan branch (keeps .git intact)
& $g checkout --orphan fixed-auths 2>&1 | Out-Null

# Reset the index and remove all tracked files, but keep .git
$trackedFiles = (& $g ls-files 2>&1) -join "`n"
if ($trackedFiles -and $trackedFiles -notmatch 'fatal') {
    & $g rm -r --cached -f . 2>&1 | Out-Null
    if (Test-Path .git) {
        Write-Host "Orphan branch created, proceeding with cherry-pick..."
    } else {
        Write-Host "ERROR: .git directory missing!"
        exit 1
    }
}

$authorName = "Kleiton Rangel"
$authorEmail = "KleitonRangel@users.noreply.github.com"
$count = 0

foreach ($commit in $commits) {
    $count++
    Write-Host "[$count/$($commits.Count)] $($commit.Substring(0,8))..."
    
    # Set author env vars for this process
    $env:GIT_AUTHOR_NAME = $authorName
    $env:GIT_AUTHOR_EMAIL = $authorEmail  
    $env:GIT_COMMITTER_NAME = $authorName
    $env:GIT_COMMITTER_EMAIL = $authorEmail
    
    # Get commit message
    $msg = & $g log --format=%s -1 $commit 2>&1
    
    # Cherry-pick without committing (just apply changes)
    try {
        & $g cherry-pick --no-commit --no-gpg-sign $commit 2>&1 | Out-Null
        
        # Stage all changes and commit with correct author
        & $g add -A 2>&1 | Out-Null
        & $g commit -m $msg --author="$authorName <$authorEmail>" --no-gpg-sign 2>&1 | Out-Null
    } catch {
        Write-Host "ERROR on commit $($commit.Substring(0,8)): $_"
    }
}

# Delete old main and rename fixed branch
& $g branch -D main 2>&1 | Out-Null
& $g branch -m main 2>&1 | Out-Null

Write-Host "`n=== Results ==="
& $g log --format='%H %an <%ae>' -5 2>&1
