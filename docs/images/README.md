# Documentation screenshots

These are unmodified browser captures of the production preview, taken October 27, 2026, using the source-inferred route export from checkpoint `52d8b9d` and the updated interface labels. They are tracked documentation assets; temporary visual checks belong in the ignored `.impeccable/review/` directory.

| Image | View and purpose |
| --- | --- |
| `berteau-route-explorer.png` | `?route=berteau-1&direction=both&run=berteau-1-run-3&map=14.393,41.958641,-87.711416` — compares directions and follows the designated dogleg. |
| `wood-direction-evidence.png` | `?route=wood-2&direction=both&event=wood-2-way-1444797397-43-forward&map=17.300,41.899950,-87.672217` — shows a source-backed one-way decision and its limits; sidebar scrolled to the selected interruption. |

To refresh: run `npm run build` and `npm run preview`, open the printed local URL with the query above, and wait for the route and basemap to render. Inspect the labels, evidence and attribution before capturing. Update the README caption when the source data or result changes. Keep CARTO/OpenStreetMap attribution visible. Run and event IDs can change after rebuilding routes, so confirm them against the current export.
