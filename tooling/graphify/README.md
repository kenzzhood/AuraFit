# Graphify

Graphify (`graphifyy` on PyPI) was run as a library. `graphify install` and `graphify claude install` were not run, because both register a Claude skill.

`detect-summary.json` is the full-repo file count. Four sensitive files were skipped; their names are not recorded. AST extraction covers the store modules, the store routes, and the provider gates (65 files). Semantic nodes for the product spec were written by Grok into the graphify schema (`EXTRACTED` edges). Claude subagents were not used.

Outputs: `GRAPH_REPORT.md` and `graph.json`.

Re-run from the repo root:

```bash
python3 -c "import graphify; print(graphify.__file__)"
```

Then repeat the extract, cluster, and report steps in `docs/architecture.md`'s module list. Do not point the Claude installer at this tree.
