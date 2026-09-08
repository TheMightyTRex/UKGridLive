# Changelog

All notable changes to this project are documented here. Dates are when the change was made, not necessarily when it was deployed. Where useful, entries reference the deployment zip version they came from (e.g. v57, v59).

## 2026-09-08 (site-wide table/chart audit)

### Fixed

- **Homepage interconnector figure contradicted itself.** `index.html`'s "Generation mix right now" table and its "Interconnectors" type-card both showed -0.59GW (a net export), while the same page's category donut chart (`CATEGORY_VALUES`) and its live "Transfers" stat both worked from +0.20GW (a net import) - and only the +0.20GW figure actually reconciles with the page's own demand (28.9GW) and generation (28.7GW) numbers (28.7 + 0.20 ≈ 28.9). Corrected the table row and type-card to 0.20GW / 0.7%, and updated `pages/interconnectors.html` to match: its "Current output"/"Share of demand" stats now read 0.20GW/0.7% instead of -0.59GW/-2.0%, and its per-cable breakdown table (Belgium, Denmark, France, Ireland, Netherlands, Norway) has the Norway (North Sea Link) row adjusted from 0.52GW to 1.31GW so the six cables still sum exactly to the corrected total, well within that cable's 1.4GW capacity.
- **Spain, Italy, Sweden and Portugal's donut charts showed the wrong total in the middle.** Following last entry's fix to their generation-mix tables, their donut charts' `centerLabel` still read France's old "58.6GW" figure. Now show each country's correct total (Spain 34.0GW, Italy 34.0GW, Sweden 16.0GW, Portugal 9.0GW), matching the table and legend below them.
- **`pages/price-history.html` silently showed fake data.** The page's caption claims its charts are "sourced from the Elexon Insights Solution," but the page never loaded `assets/data.js` and its chart-drawing code called `GridPreview.buildSeries(...)` - the same seeded random-walk placeholder generator used before any live source exists - unconditionally, with no attempt to fetch real history and no error state if none exists. Every chart (and its Average/Lowest/Highest stats) was random fake data that changed on every reload. Now fetches `window.GridData.fetchSeries("price", range)` and falls back to "Live data unavailable for this range" when there's no live history yet, matching `pages/history.html`'s own price chart.
- **`pages/eu.html` said "5 tracked countries" in four places while actually tracking ten.** A leftover from before Germany, Spain, Italy, Sweden and Portugal were added to the page's ENTSO-E country list. Text now says "10 tracked countries" throughout, matching `EU_COUNTRIES`'s actual ten entries.
- **`pages/interconnectors.html`'s top stat was mislabelled "Share of generation."** Interconnector flow is an import/export figure, not generation - the page's own History section two hundred lines down correctly calls the same kind of figure "Share of demand." Relabelled for consistency.
- **Leftover copy-paste artifacts, no functional effect but cleaned up while auditing:** `pages/nl.html`, `pages/norway.html`, `pages/denmark.html` and `pages/belgium.html` each used the id `fr-status-banner` (left over from being cloned from `pages/france.html`) for their own illustrative-data banner; renamed to `nl-`/`no-`/`dk-`/`be-status-banner` respectively. `pages/denmark.html`'s data-sources section used `de-sources` (Germany's code); renamed to `dk-sources`. `pages/nl.html` had a malformed hidden table caption reading "Illustrative the Netherlands generation by source"; fixed to "Illustrative Netherlands generation by source". `pages/south-america.html` and `pages/americas-interconnects.html` both still carried the homepage's "Great Britain's electricity grid, live and over time" tagline; each now has its own.

### Checked

- Audited every remaining table and chart on the site (all EU/Nordic pages, `index.html`'s own generation-mix section, the Americas pages, `comparisons.html`, `pages/history.html`, `pages/electricity-prices.html`, and the GB category pages' non-Records tables/charts) for the same class of copy-paste, mismatched-array or broken-canvas-id issues found in the previous entry. `pages/electricity-prices.html`'s bill-breakdown bar chart (£162/£63/£18/£65, summing to £308 against a stated £324 total) was flagged for a mismatch but checked against Carbon Brief's own May 2025 source analysis - the £16 gap exists in Carbon Brief's own figures too, and the page's caption already says so; no change needed. A small (~2 percentage point) rounding overshoot when comparing "share of generation" headline percentages *across* the five separate GB category pages (renewables/fossil/nuclear-biomass/storage) was also noted - each page's own breakdown table is internally consistent with its own header figure, so this looks like accumulated rounding in hand-typed illustrative snapshot numbers rather than a copy-paste error, and was left as-is.

## 2026-09-08 (EU generation mix)

### Fixed

- **Six EU country pages had a broken, copy-pasted "Generation mix right now" table.** `pages/germany.html` was showing large nuclear generation despite Germany completing its nuclear phase-out in April 2023 - closer inspection found the same illustrative mix table (originally built for France, whose 56.3% nuclear share it still carried) had been copy-pasted onto `pages/italy.html`, `pages/spain.html`, `pages/sweden.html`, `pages/portugal.html` and `pages/belgium.html` as well, each keeping France's nuclear percentage or a rough guess unrelated to that country's real mix, and four of them (Italy, Spain, Sweden, Portugal) also still carried France's `stat-demand`/`stat-generation` figures (54.2GW/58.6GW) even though none of those grids run anywhere near that scale. Rebuilt each table, its `SOURCE_LABELS`/`SOURCE_VALUES` chart arrays, and (for Italy, Spain, Sweden, Portugal) the demand/generation stats from current per-country generation-mix data: Germany now shows no nuclear at all (phased out); Italy and Portugal show no nuclear (Italy since a 1987 referendum, Portugal never had commercial nuclear); Spain, Sweden and Belgium keep their real, smaller nuclear shares (17.9%, 25.6% and 20.0% respectively) instead of France's. `pages/france.html` itself was already correct and is unchanged in substance - only re-verified. Every corrected page keeps the site's convention that the mix table's total equals its own `stat-generation` figure (checked with a script, not by hand).

## 2026-09-04 (repository)

### Checked

- **GB Records panels re-verified.** Checked `index.html`'s four Records tabs (wind, solar, emissions, demand) and the Records panels on `pages/storage.html`, `pages/renewables.html`, `pages/nuclear-biomass.html`, `pages/fossil-fuels.html` and `pages/interconnectors.html` against NESO, Elexon BMRS, the Carbon Intensity API, and press coverage (RenewableUK, Edie, Solar Power Portal, pv magazine). No figures changed - every headline record (23,880MW wind, 25 Mar 2026; 15,427MW solar, 12 Jul 2026; the 39g/kWh carbon-intensity floor; the now-settled winter 2025/26 demand peak) is still current. All "Last checked" dates bumped to 4 September 2026. Note: the narrower "this year" BMRS superlatives (highest Dinorwig discharge, highest/lowest nuclear/biomass/gas, highest interconnector flows) had no specific press coverage to confirm against either way and were left unchanged rather than guessed - see the commit message for the full reasoning.

### Added

- **NESO TEC Register cited as a source.** `pages/renewables-plans.html`'s grid connection queue section now links directly to NESO's [Transmission Entry Capacity Register](https://www.neso.energy/data-portal/transmission-entry-capacity-tec-register/tec_register) - the public, project-by-project dataset behind the queue figures discussed there (2,201 entries as of this check). Also added as its own source-card on `pages/data-sources.html`'s Great Britain grid, marked clearly as a reference link rather than a live-polled source - NESO's own register warns that summing the raw file double-counts staged/multi-technology projects, so the existing 770GW headline figure still cites NESO/Ofgem's own reported number rather than a total derived here.
- **GitHub repo linked from the About page.** `pages/about.html` has a new "Source code" section pointing at this repository. Confirmed no separate open-source licence is needed - the only redistribution terms that apply are the data APIs' own (Elexon's BMRS attribution, already in every footer); `README.md`'s License section now says so directly instead of suggesting a `LICENSE` file might be added.

## 2026-08-23 (v59)

### Changed

- **Brazil, Argentina, Chile and Colombia consolidated into a single `pages/south-america.html`.** None of the four had live data wired up (all four were illustrative/context-only, per `pages/data-sources.html`), so rather than maintain four near-identical standalone pages they're now one page with an in-page section per country (`#brazil`, `#argentina`, `#chile`, `#colombia`). Every page's Americas nav dropdown was updated to match, and `data-sources.html`'s per-country source links now point at the matching section anchor instead of a standalone page.

### Fixed

- **Broken Americas nav links on the homepage.** `index.html`'s Americas dropdown (USA, Canada, South America, Interconnections) had lost its `pages/` path prefix in the same update that introduced the South America consolidation above - every other nav entry on `index.html` correctly keeps the prefix since `index.html` sits at the site root, so as shipped this would have 404'd all four of those links from the homepage. Caught and fixed before this reached the repository.

## 2026-08-23 (v57)

### Fixed

- **IESO (Canada) never refreshed without cron.** `cron/fetch_ieso.php` and `ukgrid_ingest_ieso()` already existed, but `IESO` was missing from `refresh.intervals_minutes` and `refresh.timeouts_seconds` in both `includes/config.php.example` and `includes/refresh.php`. On-demand refresh (the default, no-cron mode described in `README-DEPLOY.md`) silently never considered IESO overdue, so an install without cron access would have permanently stale Canada data with no error anywhere to point at it. Both files now include `'IESO' => 30` (minutes) and `'IESO' => 7` (seconds), and `includes/refresh.php`'s on-demand switch gained the missing `case 'IESO':` to actually call `ukgrid_ingest_ieso()`.
- **Inconsistent ENTSO-E country count in comments/log messages.** `includes/config.php.example`'s prose and the log line in `includes/ingest.php` (`ukgrid_ingest_entsoe()`) still described only five ENTSO-E-sourced country pages (France, Netherlands, Belgium, Norway, Denmark) even though `entsoe_countries` has included five more comparison-only countries (Germany, Spain, Italy, Sweden, Portugal) for a while. Both now correctly describe all ten.

### Added

- **Config-check panel on `tools/full-refresh.php`.** Before running anything, the manual refresh tool now checks the live `includes/config.php` for the two gaps above (and their general form) and displays what it finds:
  - `entsoe_api_token` left unset (`CHANGE-ME` or blank)
  - `eia_api_key` left unset
  - any of the ten expected ENTSO-E countries missing from `entsoe_countries`
  - any on-demand-refreshable source missing from `intervals_minutes` and/or `timeouts_seconds`
  - `refresh.on_demand` left off with no indication cron is configured instead

  A green "config check passed" line shows when nothing is wrong. This is meant to catch the next version of the IESO-style gap at a glance, on a page the operator already visits, rather than as silent missing data with no error to find.
- **Tighter, documented IESO timeout in the manual tool.** `tools/full-refresh.php`'s per-source timeout for IESO dropped from 15s to 8s, with a comment explaining why: `ukgrid_ingest_ieso()` makes two sequential HTTP calls (worst case ~16s already), IESO's servers are further from a UK host than this project's other sources, and a hang risks tripping a host-level proxy timeout that PHP can't catch or report on - so the tighter figure leaves more headroom under that unknown ceiling.

### Repository

- First public push of the project to GitHub, with `includes/config.php` and `tools/.htpasswd` excluded (see `.gitignore`) since both carry deployment-specific secrets.
