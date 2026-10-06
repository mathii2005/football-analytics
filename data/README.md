# data/

Real match data stays on this machine: the GitHub repo is public, so
`matches/` and `archive/` are git-ignored.

| Folder | What goes in it |
|---|---|
| `matches/` | **One final export per match** from the v1 tagger (live tags + review answers). The API and the dashboard read only this folder. Name: `laureats_<date>_<opponent>_v1.json`. |
| `archive/ahuntsic_working/` | Intermediate Ahuntsic exports (10 min, 45 min, partial reviews) and the first staff page. |
| `archive/old_tagger/` | Matches tagged with the old tagger. Not comparable with v1: they must be retagged to enter the season. |
| `raw/` | Sample fixtures from the old format (versioned, used by tests). |
| `statsbomb/` | Public StatsBomb open data downloaded by `tools/build_xg_table.py` (git-ignored). |

After each match: export from the tagger once the review is done, save it in
`matches/` (replace the previous file of that match), then reload the dashboard.
