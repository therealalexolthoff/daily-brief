# The Daily Brief

A headline site that publishes a new edition every day at 5:00 PM, from news wires and publisher RSS feeds. No dependencies; needs Node 20 or later.

    npm start            # http://localhost:5170
    npm run refresh      # rebuild today's edition now
    npm test

**How the 5 PM update works.** The server checks every 5 seconds whether the latest 5 PM has an edition. If not, it reads every feed, groups matching stories, ranks them and saves the result to `data/`. Open pages pick it up without a reload. If the computer was asleep or off at 5 PM, it catches up as soon as it can and labels that edition "Off-schedule". If the feeds can't be reached, the previous edition stays up and it retries after 10 seconds, backing off to every 2 minutes. **A sleeping computer cannot publish at 5:00**; for a guaranteed time, run this on an always-on host.

**Time zone.** The computer's, unless `NEWS_TZ` is set (for example `NEWS_TZ=America/New_York`). Set it explicitly on a hosted server.

**Ranking.** A story's rank comes from how many outlets carry it (wires count more), how recent it is and how prominently outlets placed it. Headlines are shown as written by the outlet, linked to the original; no article text is copied. Section names are partly inferred and will sometimes be wrong.

**Sources** are in `lib/sources.js`. AP and Reuters have no public RSS feed, so their headlines come through Google News RSS, which Google offers for personal, non-commercial use. Check each source's terms before making the site public.

**Keep it running on a Mac:** `node scripts/install-mac.js` starts it at login (`--dry-run` to preview, `--remove` to undo).

**Hosting.** `.github/workflows/edition.yml` builds each edition on GitHub Actions and publishes the static site (`npm run build`) to GitHub Pages. GitHub starts scheduled jobs late, so a job starts early and waits for 5:00 PM Eastern; later jobs only act if the edition is missing. Pages takes a minute or so to go live. Editions are committed to `data/`.
