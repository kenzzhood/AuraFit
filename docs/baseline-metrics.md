# Discovery baseline

Measured on the committed fixture catalogue. This run does not call SerpAPI, Google, or the crawler.

Production dead-click rate, host diversity, and store impression share are not in this file. Those numbers start once `DiscoveryLog` rows exist.

| Metric | Value |
| --- | --- |
| Queries | 102 |
| Fixture products | 12 |
| Empty results | 31 |
| Median distinct hosts in a result | 1 |
| Wrong-gender results | 0 |
| Largest store share of fixture impressions | bananaclub.co.in 52.9% |

v1 matching treats a missing gender as male and keeps only the query category under the budget cap.
