# Apollo recipient enrichment

Verified against official Apollo documentation on 2026-10-17 using gstack `/browse`. No authenticated requests, keys, or credit-consuming lookups were used.

## Recommended sequence

Use **People API Search → Bulk People Enrichment**. Search supplies candidate IDs; enrichment supplies names and work emails. Never generate email addresses or infer them from an email pattern.

1. Normalize the saved company website to a bare domain (no `www.`, path, or scheme). Search separately for management and relevant employees, so a large management result set cannot crowd out the employee slot.
2. Search `POST https://api.apollo.io/api/v1/mixed_people/api_search` with that domain, `contact_email_status: ["verified"]`, and a small page size (e.g. 10). Select/rank candidates locally, retaining their Apollo `id` and slot.
3. Enrich the selected two management candidates and one relevant employee using `POST https://api.apollo.io/api/v1/people/bulk_match`. Send at most 10 entries in `details`; each may simply contain the Apollo `id`. Keep personal emails, phone reveal, and both waterfall options explicitly false.
4. Accept only an actual returned work `email` with `email_status === "verified"`, suitable match confidence, and evidence that the person currently works at the target company. Deduplicate by Apollo ID and normalized email. Return a partial result if fewer than three suitable people can be found; do not fill missing slots with irrelevant people.

**Company matching caveat:** `q_organization_domains_list` explicitly matches either current **or previous** employers. Validate the enriched `organization` / `organization_id` and `employment_history` entries marked `current: true` before saving a recipient. Search response organization names are current employers, but its limited organization object does not establish domain identity. If strict domain validation cannot establish the current employer, reject or flag that candidate. `organization_ids` is also supported; resolving company IDs through Organization Search costs credits (1/page), and Organization Enrichment costs 1/company.

Sources: [People API Search](https://docs.apollo.io/reference/people-api-search), [search tutorial](https://docs.apollo.io/docs/find-people-using-filters), [Bulk People Enrichment](https://docs.apollo.io/reference/bulk-people-enrichment), [API pricing](https://docs.apollo.io/docs/api-pricing).

## Request shape

All requests need `x-api-key`, `Content-Type: application/json`, and preferably `accept: application/json`. Keep the key exclusively in the Convex server environment. Endpoint-scoped API keys suffice: `api/v1/mixed_people/api_search` and `api/v1/people/bulk_match`; a master key is unnecessary. Each endpoint currently supports eligible free accounts registered with a work email, subject to additional eligibility rules. Paid accounts are not subject to that free-account qualification. Do not assume a paid upgrade is always required or that every free account is eligible.

Search fields are documented as query parameters. Arrays use repeated `name[]` entries when URL encoded. Apollo's tutorial also explicitly permits a raw JSON body instead of form-data, using these ordinary array keys:

```json
{
  "q_organization_domains_list": ["example.com"],
  "contact_email_status": ["verified"],
  "person_seniorities": ["owner", "founder", "c_suite", "partner", "vp", "head", "director"],
  "page": 1,
  "per_page": 10
}
```

For the employee search, replace seniorities with `["senior", "entry"]` and add `person_titles`, for example `["research scientist", "materials scientist", "process engineer", "operations specialist", "logistics specialist", "quality specialist"]`, plus `include_similar_titles: true`. These titles and the management grouping are proposed application policy, not Apollo-defined sector categories. Choose a narrower title set from the saved company's factual business description and the sender's target sector. R&D, materials/process engineering, operations, logistics, and quality/process documentation are distinct possible functions; do not require every function to match. Searching the literal acronym `SOP` alone is unlikely to be a dependable title strategy.

Supported seniorities are `owner`, `founder`, `c_suite`, `partner`, `vp`, `head`, `director`, `manager`, `senior`, `entry`, `intern`. `person_titles` and `person_seniorities` combine to restrict function and level; titles within the array are ORed. Similar titles default true; false requests strict title matching. `manager` can be an explicit fallback if the product considers it upper management; it should not silently become the definition.

Bulk enrichment URL:

```text
https://api.apollo.io/api/v1/people/bulk_match?reveal_personal_emails=false&reveal_phone_number=false&run_waterfall_email=false&run_waterfall_phone=false
```

Body:

```json
{
  "details": [
    {"id": "selected-management-person-id-1"},
    {"id": "selected-management-person-id-2"},
    {"id": "selected-relevant-employee-person-id"}
  ]
}
```

For a single candidate, `POST /api/v1/people/match` accepts `id` as a query parameter with the same reveal/waterfall flags. Other matching inputs include name, domain, organization name, email, hashed email, and LinkedIn URL. Prefer the search ID rather than the obfuscated last name. Search documentation returns `people[].id`; one enrichment parameter description says `person_id`, but the actual search schema and tutorial confirm the field is `id`.

Sources: [Authentication](https://docs.apollo.io/reference/authentication), [People API Search](https://docs.apollo.io/reference/people-api-search), [search tutorial](https://docs.apollo.io/docs/find-people-using-filters), [People Enrichment](https://docs.apollo.io/reference/people-enrichment), [Bulk People Enrichment](https://docs.apollo.io/reference/bulk-people-enrichment).

## Response and spending rules

- Search costs **0 credits**, returns `total_entries` and `people`, and provides `id`, first name, obfuscated last name, current title, refresh timestamp, `has_email`, and limited organization availability data. It returns **no emails or phone numbers**. `has_email` is documented as verified email availability; still validate enrichment output.
- Standard bulk enrichment returns `matches` (including null entries for unmatched people), `total_requested_enrichments`, `missing_records`, `unique_enriched_records`, and `credits_consumed`. A 200 `status: "success"` does not mean all requested people were matched or have emails.
- Matched person fields include `id`, `name`, `first_name`, `last_name`, `title`, `email`, `email_status`, `organization_id`, `organization`, `employment_history`, `seniority`, `departments`, `subdepartments`, `functions`, and `match_confidence` (`high`, `medium`, `low`, `none`). Select by ID; do not rely on undocumented array ordering. Require high confidence for automatic saves, or handle medium confidence explicitly as an application policy.
- Current standard pricing is **1 credit per person for demographic data or email**, plus 8 if a mobile number is returned. Thus enrichment can cost a credit even when it finds demographic data without a usable email. Three successful standard enrichments normally cost 3 credits; replacement candidates can increase the total. `credits_consumed` may be fractional depending on plan; `unique_enriched_records` is a billing count, not the number of matches.
- No charge when no credit-consuming data is found; low-confidence demographic matches are charged only when new data is returned. Legacy plans may differ. Do not present a guaranteed fixed per-company price.
- Waterfall enrichment changes cost and response semantics: asynchronous email delivery, variable vendor charges, and possible charges for unsuccessful lookups. It is unnecessary for the initial implementation. Disabling phones and waterfall avoids webhook/poll infrastructure. Personal email reveal defaults false and should remain explicitly false.
- Cache already accepted results and track attempted IDs per run to avoid repeating paid lookups. Bound replacement attempts and report shortfalls. These are application recommendations; the documentation does not promise retries or repeat lookups are free.

Sources: [People API Search](https://docs.apollo.io/reference/people-api-search), [Bulk People Enrichment](https://docs.apollo.io/reference/bulk-people-enrichment), [API pricing and credits](https://docs.apollo.io/docs/api-pricing).

## Limits and failures

Search supports up to 100 results/page, 500 pages/50,000 displayed records. Domain arrays support up to 1,000 domains, but per-company searches make the required allocation easier to enforce. Bulk enrichment permits at most 10 people/request.

Rate limits are shared by the whole team, per endpoint, across minute/hour/day windows. Current free search limits are 50/minute, 200/hour, 600/day; free bulk enrichment is 20/minute, 100/hour, 600/day. Paid search is 200/minute, 6,000/hour, 50,000/day; paid enrichment is 1,000/minute without hourly/daily limits, subject to credits. Legacy/account-specific limits can differ; use response headers and the account's usage endpoint as the source of truth.

Handle 401 as missing/invalid credentials; 403 as missing access/eligibility; 400/422 as invalid input; 429 by honoring `retry-after` seconds and remaining-capacity headers. On 500, use bounded retry. Do not retry permanent credential/validation errors. Parse `error_details.code` and `error_details.message` where present, with legacy error fields as compatibility fallback. Apollo is migrating errors to `error_details`; not all endpoints/statuses are documented. Sanitize errors before displaying them and never log the key. An empty 200 search or null enrichment match is a normal no-result outcome.

Sources: [Rate Limits](https://docs.apollo.io/reference/rate-limits), [Status Codes and Errors](https://docs.apollo.io/reference/status-codes), [Bulk People Enrichment](https://docs.apollo.io/reference/bulk-people-enrichment).
