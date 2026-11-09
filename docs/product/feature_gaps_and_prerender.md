# AuraFit: competitor features to add + overnight pre-render deep dive
Prepared 9 Nov 2026 (IST) for Goutham, InnoXR Labs. Research only: nothing was bought, deployed or contacted.
Tags: [V] = seen on a live page; [Claim] = company's own claim; [Doc] = only in the CEO strategy chat; [Est] = my estimate.

## Part 1: 15 competitor features not yet in AuraFit's plan

### Worth adding (11)
| # | Feature | Who has it | Verdict | Why |
|---|---|---|---|---|
| 1 | Overnight bulk try-on of the whole catalogue | StyleUAI [V]; Breuninger level 1 [V] | Add now | Instant first screen; fixes most of the wait |
| 2 | Send the six looks to the shopper's phone (QR / WhatsApp) | Flickd [V]; Roopastra [Claim] | Add now | Shopper leaves with the looks; store gets a lead |
| 3 | Pay at the kiosk / by QR | Fynd GlamAR [V] | Later | Start with "send to counter", then add UPI QR |
| 4 | Order a missing size from the screen (endless aisle) | Fynd StoreOS [V] | Add | Saves sales lost to out-of-stock |
| 5 | Fabric details + stock count on screen | Dharpan [V, founder-reported] | Add | Cheap; answers the first two questions shoppers ask |
| 6 | Tried-but-not-bought report | Flickd [V] | Add now | Make it the main retailer report |
| 7 | Skin-tone colour ranking with a plain reason | Vitron [V] | Add | Fits straight into the preference step |
| 8 | Voice help, Tamil + English | Flickd voice beta [V] | Add | No competitor does Tamil |
| 9 | Staff app with alerts that actually arrive | H&M fitting room [V] | Add | H&M failed exactly here |
| 10 | Ads / curated content on the idle screen | Try My Style [V]; Imersive [Doc] | Add | Extra revenue and pulls people in |
| 11 | New-arrival try-on alerts on WhatsApp | Dharpan [V] | Add | Brings repeat visits |

### Not yet (4)
| # | Feature | Who has it | Verdict | Why |
|---|---|---|---|---|
| 12 | 10-second body scan, 30+ measurements | Imersive.io [V] | Not now | Unorganised stores lack reliable size charts; revisit later |
| 13 | Reusable cross-brand shopper avatar | Flickd [V] | Not now | Heavy DPDP privacy load; keep the photo for the session only |
| 14 | Foot-traffic heatmaps | Roopastra [Claim] | Later | Needs extra sensors |
| 15 | Run on the store's existing TV | StyleUAI [V] | Maybe later | Cheap tier idea, but our camera + gesture needs our hardware |

Sources: styleuai.com; cloud.google.com/blog/topics/retail/how-breuninger-boosted-sales-with-its-be-your-own-model-ai; flickd.in/products/smart-mirror; roopastra.com; glamar.io/solutions/magic-mirror; fynd.com/blog/fynd-in-2026; yourstory.com/2025/05/dharpanais-smart-mirrors-are-changing-how-india-shops; vitron.in; eidit.it/projects/smart-fitting-room; trymystyle.com; apps.shopify.com/smart-ai-tryon; linkedin.com/posts/styleuai_styleuai-aimirror-virtualtryon-activity-7503419425791057920-bOZX

## Part 2: Overnight pre-render, deep dive

### The idea in one line
Render every outfit on a small set of "stock model" bodies at night, so the kiosk shows six looks instantly; then make the shopper's own try-on only for the 1-2 looks they actually like.

### Who already does it (checked 9 Nov 2026)
- StyleUAI: "Upload the whole catalogue. Try-on for every SKU, overnight." plus "Try-on with AI models ... trained AI models, or upload your own once." [V] styleuai.com
- Breuninger + Google: three levels. Level 1 catalogue enrichment = offline batch on standard models; Level 2 body-type selection = pick a predefined model like you; Level 3 = selfie "be your own model". Users said they wanted to see themselves, which is why Level 3 came last. [V] Google Cloud blog, 6 May 2026
- Google Vertex AI Virtual Try-On: $0.06/image, no batch mode, GCP only; deprecated 14 Sep 2026, retiring 15 Mar 2027 (one Google page says 20 Jan 2027). Not for us. [V] docs.cloud.google.com
- FASHN: $0.075/credit, try-on v1.6 = 1 credit. Not Azure; benchmark only. [V] help.fashn.ai

### How it works
1. Store photos in: staff shoot each item on a hanger/flat with a phone; we cut out the background and tag it (category, colour, fabric, price, rack).
2. Stock model set: about 18 AI-generated adult models (women and men × 3 body types × 3 skin tones) plus about 4 kids' models. Synthetic people, so no model-rights issues. [Est]
3. Night job: for every item × every matching model, ask GPT Image 2 (Azure) to dress the model. Kids' items go to klein 4B on an Azure GPU.
4. Look images: the styling engine picks curated outfit combos (top + bottom + dupatta etc.) and renders those on each model too.
5. Quality check: a cheap vision model compares each render with the garment photo (colour, print, length, extra limbs). Bad ones are retried or dropped; staff spot-check 10%.
6. Store: images saved to Azure Blob (Central India) and synced to the kiosk's SSD every morning, so the screen never waits on the internet.
7. At the kiosk: preferences + the one camera photo → pick the nearest stock model (body shape from pose landmarks, skin tone from the face area; or let the shopper tap one of 3 silhouettes) → six looks appear instantly, labelled "shown on a model like you".
8. Personal swap-in: when the shopper taps a look, GPT Image 2 makes their own try-on of that look in the background (about 20 s) while they read fabric, price and rack location.

### What to build
- Catalogue intake app (phone, offline-friendly), background removal, tagging.
- Stock model set + prompt templates per category (saree, kurta, shirt-trouser, kidswear).
- Render queue on Azure (Container Apps job or Functions + Storage queue) that paces requests within the GPT Image 2 quota and retries 429s.
- QA checker + review screen.
- Nightly "what changed" job: new items, sold-out items hidden, prices updated (ties into problem 4, inventory).
- Kiosk cache sync and the matching logic.
- Personal swap-in path with consent and session-only photo deletion.

### How it fixes the waiting
| Moment | Today (live only) | With pre-render |
|---|---|---|
| First six looks on screen | about 20 s per image; six in parallel at best about 20-30 s, longer if quota throttles | under 1 s from local cache [Est] |
| Shopper's own photo in a look | same 20-30 s | about 20 s, but only for the look they chose, while they browse |
| CEO-doc target: full first recommendation | 30 s or less | met with room to spare |

### Cost math (example store, all assumptions labelled)
Formula: images = (SKUs × matching models) + (curated looks × models). Cost = images × price per image.
Assumptions [Est]: 500 SKUs; 9 models per gender (each item renders only on its gender); 100 curated looks; 1 image per pair; ₹88 = $1.
- Item renders: 500 × 9 = 4,500. Look renders: 100 × 9 = 900. Total 5,400 images.
- GPT Image 2 medium on Azure: ~$0.05 per edit incl. input images [Est, from token rates $30/M out, $8/M image in] → about $270 (₹23,800) one-off per store. Plus ~20% for QA retries → about $325.
- GPT Image 2 high: ~$0.21 → about $1,130 (₹1 lakh). Not needed for kiosk screens.
- klein 4B on Azure Container Apps serverless A100 (₹254/hr, ~6 s/image) → about ₹2,300 GPU time for the same 5,400 [Est; lower quality than GPT Image 2].
- Monthly top-up: say 50 new SKUs + 30 new looks → 720 images → about $36 a month per store [Est].
- Storage: 5,400 × ~0.4 MB ≈ 2.1 GB; Azure Blob Hot LRS Central India is $0.02/GB/month → about 4 cents a month. Negligible.
- Personal swap-in: 1-2 GPT Image 2 renders per engaged shopper ≈ ₹4-9, instead of ₹26-42 for six live looks.
- With $5K Azure credit: enough to onboard about 15 stores on GPT Image 2 medium (image cost only) [Est].

### Speed and quota limits (Azure)
- Azure Global Batch (the 50%-off route) does not list any gpt-image model; it covers text/chat models only (Microsoft Learn, checked 9 Nov 2026). So the night job runs on normal Global Standard pricing.
- OpenAI's own Batch API does support gpt-image-2 at 50% off ($15/M output tokens), but that is outside Azure, so it breaks the Azure-only rule. Only if you approve.
- Default gpt-image-2 quota on Azure Global Standard is 6 requests a minute (Learn quota table; another line on the same page says 9). At 6/min that is 360 images an hour, so a 5,400-image store takes about 15 hours: roughly 1.5 nights. Ask Microsoft for a quota raise before the first store; increases need approval.
- GPT Image 2 Global Standard regions: East US 2, Poland Central, Sweden Central, UAE North, West US 3 (no India). Fine for a night job; keep the shopper's personal photo flow as is.

### Downsides and risks
- Less wow: the first screen is a model like you, not you. Breuninger's users asked for themselves. Fix: the personal swap-in on the chosen look.
- Honesty: label clearly "shown on a model like you"; never pass it off as the shopper.
- Combo explosion: every top × bottom × dupatta × model grows fast. Fix: render only curated looks (about 100), not every combination.
- Content blocks: swimwear (medium risk) and lingerie (high risk) may be refused; leave those categories out at launch.
- Kids: GPT Image 2 blocks photoreal minors, so kids' items go to klein 4B; quality must be tested first.
- Stock churn: unorganised stores add and sell items daily without records. Pre-renders go stale; needs the nightly sales file / sold-out marking from problem 4.
- Quality drift: AI may change prints, borders or lengths (critical for sarees). QA check + staff spot-check; model updates can shift results, so pin the model version (gpt-image-2-2026-04-21).
- Model lifecycle: gpt-image-2 retires on Azure 21 Oct 2027 (third-party tracker); plan a re-render when moving to a newer model.
- Quota: default quota is small; throttling can stretch a store's first render over 2 nights.
- Matching errors: a wrong body type or skin tone feels worse than none. Let the shopper change it with one gesture.

### Effort (rough, [Est])
- MVP, one pilot store, about 6-8 weeks with 2 engineers (12-16 team-weeks): intake + tagging 2 wks; model set + prompts 1 wk; render queue + pacing 2 wks; QA checker 1-2 wks; kiosk cache + matching 1 wk; in-store test 1 wk.
- Full version, another 8-10 weeks: curated-look engine, kids via klein fine-tune, nightly delta tied to inventory, multi-store dashboard, personal swap-in polish, re-render on model change.

### Recommendation
1. Build it: pre-render the catalogue on about 18 stock models overnight on Azure GPT Image 2 medium; first screen appears instantly.
2. Make the shopper's own try-on only for the look they tap, about 20 s, while they read fabric and rack location.
3. Start with one 500-item store (about $325 one-off, about $36 a month), ask Microsoft to raise the quota now, and leave swimwear, lingerie and kids (klein) for phase two.

### Sources (Part 2)
- https://www.styleuai.com/
- https://cloud.google.com/blog/topics/retail/how-breuninger-boosted-sales-with-its-be-your-own-model-ai
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/vto/virtual-try-on-001
- https://help.fashn.ai/plans-and-pricing/api-pricing
- https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch
- https://learn.microsoft.com/en-us/azure/foundry/openai/quotas-limits
- https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/dall-e
- https://developers.openai.com/api/docs/models/gpt-image-2
- https://developers.openai.com/api/docs/pricing
- https://foundrymap.fyi/models/gpt-image-2
- https://prices.azure.com/api/retail/prices (Blob Hot LRS, Central India)
- Earlier research: /workspace/flux_gpu_cost.md, /workspace/klein_vs_gptimage2.md, /workspace/commercial_image_apis.md, /workspace/gptimage2_azure_content_policy.md
