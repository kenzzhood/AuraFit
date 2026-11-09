# AuraFit image stack decisions

Last updated: 9 Nov 2026, 12:29 AM IST. This is a living record; update it as decisions change. Plan: solve problems one by one.

## 1. Main model: GPT Image 2 on Azure OpenAI (adult try-on)
- Used for consenting adults, everyday clothes and traditional Indian wear.
- Swimwear: medium block risk. Lingerie: high block risk (sexually suggestive content prohibited).
- Photorealistic minors: blocked outright.

## 2. Fallback: FLUX.2 klein 4B
- Apache-2.0 licence, commercial use OK.
- To be fine-tuned on real store photos, including kids' outfits, since GPT Image 2 blocks minors.

## 3. Hosting / region
- No managed try-on API runs inside India.
- GPT Image 2 on Azure is the best managed option; it runs in global regions only (not Central India).

## 4. Cost
- GPT Image 2: about ₹34–42 per six-look session at medium quality.
- FLUX.2 klein 4B: about ₹1 per image.

## 5. Open items
- Confirm Microsoft's data retention policy before promising any retention limit.

## Supporting research (on donna2's computer, /workspace)
- klein_vs_gptimage2.md
- commercial_image_apis.md
- cloud_image_models.md
- gptimage2_azure_content_policy.md

## AuraFit — do not forget (updated 9 Nov 2026, 12:49 AM IST)
The five AuraFit problems from the first call (8 Nov evening), in order. Solutions were discussed for each on that call, but only image generation was chosen to tackle first.

1. **Image generation**: solved. GPT Image 2 on Azure OpenAI is the main model for adult try-on; FLUX.2 klein 4B, fine-tuned, is the fallback for kids' outfits (GPT Image 2 blocks photorealistic minors).
2. **Gesture control**: can't have multiple people interacting at the same time; crowded stores are a problem; all gesture-control issues. Constraint: single RGB camera only. Research done 9 Nov (aurafit_gesture_research.md), recommendation pending Goutham's decisions: one active user at a time (raise hand ~1 s to claim; must be on floor footprints, centred and close; resets after ~15 s), others join via phone QR; same camera takes the try-on photo; MediaPipe Pose picks the active user then hands; Logitech Brio + Core i5 mini PC + 55-inch portrait screen + front light + UPS, ~₹1.3–1.8 lakh per kiosk (budget ~₹70–90k; most prices unverified). Open: screen size, mounting, touch frame, pilot budget tier, camera model.
3. **Image generation timing**: generation takes time and people won't wait for it.
4. **Inventory**: how to handle inventory for any store in Chennai; most are unorganized with no inventory management, so the solution must work for them too. (Research done 8 Nov: pilot = InnoXR photographs/barcodes the catalogue + nightly POS sales file, unseen items show "available on request"; RFID in phase two.)
5. **Integration itself.**

Whenever AuraFit problems come up: start from this record and ask which problem to tackle next.

## Reference: Goutham's "CEO" strategy chat (PDF sent 9 Nov 2026)
Text copy at /workspace/aurafit/ceo_strategy_chat_9nov.txt (174 pages). Covers competitors (Dharpan, Fynd/Reliance Trends, Breuninger, H&M, Alaaya, Flickd, StyleUAI and others), Chennai inventory (don't build own inventory system; API, CSV or manual catalogue), feasibility and risks. Timing note: target about 30 s or less for the full first recommendation; preprocess images, generate asynchronously, show useful content while waiting. Use for problems 3, 4 and 5.

## Competitor analysis (9 Nov 2026)
Page: https://cursor.com/canvas/store-bf6ec20a-b003-49c6-8afc-ffd055fc5d30/8019ada8-ff04-4e06-8926-eed3dedc7487 ; full copy /workspace/aurafit/competitor_analysis.md.
Biggest threat Imersive.io (Chennai, live at NEWME Bengaluru), then Alaaya (complete looks, Salem) and Glance AI (Android TV looks, Oct 2026). Top ideas to steal: pre-generate looks overnight for instant first screen; send six looks to phone via QR/WhatsApp; report tried-but-not-bought to retailer. Our gap/advantage: rack location, works without POS, touch-free single-camera crowd handling.

## Feature gaps + overnight pre-render (9 Nov 2026)
Page: https://cursor.com/canvas/store-bf6ec20a-b003-49c6-8afc-ffd055fc5d30/4bc5ea56-6399-44d2-b537-187add0df3bb ; copy /workspace/aurafit/feature_gaps_and_prerender.md.
15 competitor features (11 add, 4 not yet). Pre-render proposal: each SKU on ~18 stock models + 100 curated looks overnight; first screen <1 s, shopper's own GPT Image 2 try-on only for tapped look (~20 s). 500-SKU store ~$325 once + ~$36/mo (estimate). MVP 6-8 weeks, 2 engineers (estimate). Azure Batch does not support GPT Image 2; default quota ~6 RPM, quota increase worth requesting (not submitted). Google Vertex try-on retiring by Mar 2027.
DECISION (9 Nov 2026, Goutham on call): adopt overnight bulk pre-render approach for problem 3 (timing).

## APPROVED PLAN ADDITIONS (9 Nov 2026, Goutham on call, reading the competitor analysis)
1. Overnight bulk try-on with model matching (fixes problem 3, timing).
   - Every night, pre-render try-on images of every outfit on a set of stock models covering different body types and skin tones.
   - Pre-pair style combos from the real catalogue ("this dress, this pant, this top looks good for this kind of person"), matched to body type and skin tone.
   - At the kiosk, match the shopper to the closest stock model and instantly show that model wearing the pre-made combos, instead of generating new ones.
   - Generate the shopper's personal try-on in the background only for the one or two looks they like.
2. Send six looks to phone via QR code (planned AuraFit APP FEATURE to build, not just a note): when a shopper finishes at the kiosk, their six pre-made style combos from the real catalogue are sent to their phone by QR code or WhatsApp, so they leave with them and the store gets a lead.

3. Out-of-stock / missing-size online order via QR (planned AuraFit APP FEATURE; Goutham's revised version of Fynd's endless aisle): when an item is a missing size OR not available in the showroom at all, the kiosk tells the shopper it isn't in stock right now, still shows the dress on screen, and shows a QR code that opens the store's online page for exactly that product. The shopper scans, enters their details and orders online for home delivery.

4. Fabric details on screen (from Dharpan): APPROVED. Show each item's fabric details on the kiosk.
5. Tried-but-not-bought report (from Flickd): APPROVED, and it is the store's MAIN report.
6. Skin-tone colour ranking (from Vitron): APPROVED as an INTERNAL, BACKGROUND-ONLY data-collection and matching system. It runs behind the scenes to build data on what kind of dresses suit which kind of people. It is never put in front of customers: no customer-facing display at all.
7. Staff app with alerts that actually arrive (from H&M): APPROVED to build. Reliability of alerts is the key requirement (H&M's fitting rooms failed exactly because alerts didn't arrive).
8. Ads or curated content on the idle screen (from Try My Style, Imersive): APPROVED to build.
9. Foot-traffic heatmap (from Roopastra): APPROVED to build, even though it needs extra sensors beyond the kiosk camera (the single-RGB-camera rule applies to gesture/try-on).
10. Run on the store's existing TV (from StyleUAI): APPROVED. This is what AuraFit will do (Goutham, 9 Nov 2026), reversing the earlier 'maybe later'. Goutham overrode the concern that our camera + gesture setup needs our own hardware (implies adding our camera and mini PC to the store's TV).
11. WhatsApp integration flow: APPROVED to build (9 Nov 2026). Kiosk shows a QR that opens WhatsApp (wa.me) with a code pre-typed; shopper presses send, giving AuraFit their number and consent (opens 24h window); AuraFit replies with the six looks. New-arrival try-on alerts only to people who reply YES (marketing templates). References: Flickd (one QR scan at mirror saves looks to WhatsApp, evening follow-up), LocalShoppie (rack QR opens WhatsApp AI stylist). Meta India list price ~Rs 0.86/marketing msg, ~Rs 0.12/utility (order/update) msg, before GST and BSP fee. Research: /workspace/aurafit/whatsapp_competitor_research.md.

## REJECTED FOR NOW (9 Nov 2026, Goutham on call)
- Pay at the kiosk or by QR code (Fynd): Goutham decided NOT to add it.
- Stock count on screen (Dharpan): skipped, not needed for now.
- Reusable cross-brand avatar (Flickd): REJECTED, not needed. Photos stay session-only.

## DEFERRED / LATER (not rejected)
- Voice help in Tamil and English (from Flickd's beta): do later.

- 10-second body scan with 30+ measurements (from Imersive.io): NOT NOW, revisit later. Unorganised stores lack reliable size charts (Goutham reverted to this on 9 Nov 2026 after briefly reconsidering).

## Edge compute (9 Nov 2026, call)
- Goutham: a Jetson will be installed anyway, sitting with the Atoms node right next to the display. It should take the store's CCTV feeds (depends on each store's recorder: needs RTSP access + password) for anonymous heatmaps + rack checks. Research: /workspace/aurafit/edge_vision_compute_cost.md (Jetson Orin Nano Super ~Rs 37.7k, ~Rs 1.2k/month all-in), /workspace/aurafit/heatmap_stock_legal_research.md, /workspace/aurafit/ruview_wifi_tracking_research.md (RuView Wi-Fi: not suitable), /workspace/aurafit/whatsapp_competitor_research.md.
- Open idea from Goutham: a ceiling-mounted 360 camera as the heatmap source instead of / in addition to store CCTV.

## Rack stock by ceiling fisheye + heatmap legality (9 Nov 2026, research)
- A ceiling fisheye alone can't monitor rack stock. It works for heatmaps and centre rails (full, partly empty or empty), only roughly for wall racks, and is often blocked for low wall shelves and folded stacks. Suggested: one 5MP fisheye at ceiling centre, plus the store's existing CCTV or 2-4 angled 4MP domes on the walls, snapshots every 5 min, all on the same Jetson. About ₹25-45k per store (estimate). Details in fisheye_rack_visibility.md. Pilot one store first.
- Live/online: process locally on the Jetson over the store LAN and upload only counts. Cloud streaming needs 4-8 Mbps upload per camera, about ₹40k a month for a cloud GPU, and sends video off-site.
- Legal (harvy, 9 Nov): NOT a clean yes under DPDP. Even RAM-only processing of identifiable video is personal data processing, and footfall fits no s.7 legitimate use. Get an Indian advocate's opinion (the iTNT-introduced lawyer) before live deployment. Lower-risk alternative: non-camera sensors (radar/ToF/door). If cameras are used, pilot with a counsel-drafted notice and consent. TN 2012 rules require CCTV at entry/exit of commercial buildings.
- India practice (9 Nov research, india_retail_camera_analytics_legal.md): camera footfall/heatmaps are common in organised fashion retail and some malls (vendor claims: Decathlon India via RetailGaze; Staqu clients Raymond, Manyavar, Metro Brands, Lenskart, Crocs; V-Count for Nike, Birkenstock; DLF Promenade, Select Citywalk, Sylcon). Grocery is mostly security CCTV. Privacy policies rarely mention analytics. No DPB enforcement found; controversies are about face recognition only. Still get a lawyer's sign-off before the Chennai pilot.
