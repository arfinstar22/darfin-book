# DARFIN BOOK
## Product Requirements & Technical Specification for Antigravity

**Document type:** Product + Engineering Specification  
**Product:** DARFIN BOOK  
**Platforms:** Web application + Android APK + Telegram Bot + Telegram Mini App  
**Reader modes:** Native in-app PDF/EPUB reader + authorized online reader/preview/borrow integration  
**Primary language:** Bahasa Indonesia (`id-ID`) across UI, bot, help, and reader chrome; katalog default hanya menampilkan edisi yang terverifikasi berbahasa Indonesia (`id`).  
**Status:** Implementation brief — build in phases; do not attempt the entire system in one pass.

---

## 0. Instructions to Antigravity

Treat this document as the product source of truth. Before coding:

1. Inspect the existing repository, runtime, deployment setup, database, Telegram bot, and any existing DARFIN design system. Do not overwrite working systems or replace existing architecture without a reason.
2. Produce an implementation plan and repository audit first. Identify existing reusable components and report assumptions.
3. Implement incrementally by the phases and acceptance criteria below. Keep the app runnable after every phase.
4. Do not fabricate book availability, reading rights, download links, page counts, or full-text access. Availability must come from provider data and be labelled accurately.
5. Do not bypass DRM, paywalls, borrowing queues, publisher restrictions, geographic restrictions, or access controls. Never scrape book page HTML as a substitute for a supported API or reader integration.
6. Never download/store or serve copyrighted book files unless the provider explicitly permits it and the applicable license/terms allow the intended use. Metadata and cover display must also respect provider attribution and usage terms.
7. Do not expose API keys, Telegram bot token, database credentials, signed URLs, or provider access tokens to frontend code or logs.
8. No fake buttons. Every visible action must work or be clearly marked “Segera hadir” and excluded from the MVP.
9. Keep the Telegram bot, website, Android app, and Mini App on one shared backend and one canonical book/catalog model.
10. Write tests for provider adapters, access classification, Telegram authentication, reader routing, and user data isolation.

**Expected first response from Antigravity:** repository audit, proposed architecture, list of risks/unknowns, phased task plan, and files to be created/modified. Wait for approval before destructive migrations or major stack changes.

---

# 1. Product Overview

## 1.1 Product vision

DARFIN BOOK is a digital book discovery and reading platform. Users can search books by ISBN, title, author, or subject; inspect bibliographic information; and read the portions that the source provider legally makes available directly inside DARFIN's web app, Android app, or Telegram Mini App.

The Telegram bot is the discovery and notification entry point. The web application is the full library and reading workspace. The Android APK provides an app-like mobile experience. The Telegram Mini App opens the same web experience inside Telegram. All four clients use the public product name **DARFIN BOOK** and default to Bahasa Indonesia (`id-ID`).

**Core promise:** “Cari buku, lihat status aksesnya, lalu baca langsung di DARFIN jika akses resmi tersedia.”

## 1.2 Product principles

- **Legal access first:** a catalog record does not imply a right to read or download the book.
- **One catalog, multiple clients:** web, Android, Telegram bot, and Mini App share the same backend.
- **Transparent access labels:** Full access, Preview, Borrow, External access, Metadata only.
- **Reader inside DARFIN when permitted:** PDF/EPUB can be rendered internally only when the file is legally available to the user and the integration is allowed. Provider-hosted reading experiences may be embedded only when explicitly supported and permitted.
- **No misleading “read full book” promise:** display the actual access status returned by the provider.
- **Privacy by default:** reading history, bookmarks, and searches are private to the account unless user explicitly shares them.
- **Mobile-first and accessible:** comfortable reading on Android, with keyboard and screen-reader support on web.

## 1.3 Target users

- Students and lecturers looking for academic and general books.
- Readers searching by ISBN, title, or author.
- Users who want to organize a personal reading list.
- Telegram users who prefer searching books without leaving chat.

## 1.4 Non-goals for MVP

- Hosting an unauthorized shadow library.
- Removing DRM or converting protected files.
- Circumventing publisher purchases, lending windows, or waitlists.
- User-to-user uploads of arbitrary copyrighted books.
- Selling books or processing publisher payments.
- OCR/scanning entire copyrighted books without rights.
- AI-generated summaries of full books that the user is not authorized to access.
- Social network, public reviews, or public book uploads.

---


## 1.5 Indonesian-language-first policy (mandatory product requirement)

DARFIN BOOK is an Indonesian-language digital library. This is a product constraint, not merely a translation preference.

### Language policy

- Default application locale: `id-ID` (Bahasa Indonesia).
- Default book language: `id` (ISO 639-1). Provider-specific codes must be normalized to this canonical value.
- All product-owned UI copy must be Bahasa Indonesia: navigation, search hints, filters, access labels, reader controls, empty/error states, onboarding, privacy/terms summaries, bot commands' descriptions, Mini App labels, and notifications.
- Search and discovery feeds must show only editions whose language is verified as Indonesian. Do not show unknown-language records in default Indonesian results.
- For a multi-language Work, show only its Indonesian Edition in default discovery. A foreign-language original may be linked as related metadata, but it is not a substitute for the Indonesian edition.
- ISBN lookup may return a precise record in another language. In that case, show a clear “Buku ini bukan berbahasa Indonesia” notice and do not add it to default Indonesian discovery. Do not silently translate it or label it Indonesian.
- Preserve the published title of the Indonesian edition. Do not machine-translate titles, descriptions, or book contents and present them as official publisher text.
- If source metadata does not reliably identify the edition language, set `language_verification=UNKNOWN` and exclude it from the default catalog until verified. Admin-curated correction may be allowed with an audit trail and source evidence.
- Provide an in-product report action: “Laporkan bahasa atau data buku yang keliru”. Reports enter moderation; user reports do not automatically change canonical metadata.
- Never promise that every book in the world is available in Indonesian. The claim is that DARFIN BOOK's default catalog and reading experience prioritize verified Indonesian-language books, with coverage growing as eligible sources are integrated.

### Language normalization and filtering

Use a canonical language model:

- `language_code`: ISO 639-1 code, e.g. `id`.
- `language_tag`: BCP 47 locale when needed, e.g. `id-ID`.
- `provider_language_code`: original code returned by provider, retained for traceability (e.g. a three-letter code such as `ind`).
- `language_verification`: `VERIFIED`, `PROVIDER_DECLARED`, `UNKNOWN`, `DISPUTED`.
- `language_evidence`: provider edition field, authoritative catalog record, or moderated admin evidence.

Provider-specific behavior:

1. Google Books: send `langRestrict=id` for default search. Keep access filtering separate; language filter must not accidentally remove valid Indonesian preview/borrow/metadata records. `filter=full` or `free-ebooks` is an optional user filter, not the default language filter. Google Embedded Viewer `language: "id"` localizes viewer controls only; it does not translate the underlying book.
2. Open Library: its `lang=id` parameter is a preference/ranking signal and does not exclude non-Indonesian results. Use the provider's language filter (for example, `language:ind` where supported by returned edition language identifiers), inspect edition-level language data, and enforce a server-side post-filter. Do not rely on `lang=id` alone.
3. Wikisource Indonesia: use `https://id.wikisource.org/w/api.php` as a discovery/content API candidate for texts hosted on the Indonesian Wikisource. Verify each page's work status, author/source metadata, and applicable license/public-domain status before rendering or reusing content. Preserve attribution and license information. Treat it as a source for eligible Indonesian texts, not a blanket license for all material on the internet.
4. Internet Archive/Open Library lending: include an item only when edition language is verified as Indonesian; access status still comes from its official borrowing/read flow.
5. Any additional provider: must pass a language-filter capability test and a legal/technical integration review before being enabled in production.

### Indonesian content strategy

Build category landing pages that help Indonesian readers find relevant material, such as:

- Pendidikan dan pembelajaran
- Bahasa dan sastra Indonesia
- Sejarah dan budaya Nusantara
- Ilmu pengetahuan dan teknologi
- Bisnis dan ekonomi
- Pengembangan diri
- Referensi akademik
- Cerita anak dan bacaan keluarga
- Novel, cerpen, puisi, dan karya sastra
- Dokumen publik dan karya klasik yang legal dibaca

Do not imply institutional endorsement by Perpusnas, Wikisource, or any publisher. Clearly label the source of each book.

### Translation policy

- Prefer an officially published Indonesian edition when a foreign-language Work has one.
- Do not translate a complete copyrighted book with machine translation or AI and publish it as a reading copy.
- User interface localization is allowed and separate from translating book content.
- User-submitted translation or transcription requires documented rights/permission and editorial review before publication.

## 1.5.1 Public access and community reach

DARFIN BOOK is intended for the public, not a private reading tool. Make the catalog discoverable and make legally open content easy to access:

- Guest users may search, view public book metadata, and read public-domain/open-licensed texts that DARFIN is authorized to render, without mandatory account registration.
- Login is required only for personal features such as private shelves, reading progress synchronization, bookmarks, and account-linked history.
- Every public catalog record has a shareable canonical book-detail URL. Do not include private progress, account tokens, or loan credentials in shared links.
- A book requiring a provider account, loan, subscription, or country eligibility must clearly explain that requirement and continue through the provider's official flow.
- Public access does not mean public-domain status. Only make the content itself readable when provider rights and license checks permit it.
- Do not allow arbitrary user uploads to become public books in the MVP. A future community submission system requires rights declaration, moderation, provenance, and takedown handling.

## 1.6 Product naming and brand system

- Product/brand name: **DARFIN BOOK**.
- Android launcher label: **Darfin Book** (short, readable; do not use “DARFIN BOOK READER” as the launcher name).
- Telegram bot display name: **DARFIN BOOK**. Bot username is configurable and must not be hard-coded into application logic.
- Telegram Mini App title: **DARFIN BOOK**.
- Internal feature/module name: **Pembaca Buku** or `Book Reader`; this is not the public product name.
- Suggested Indonesian tagline: **“Perpustakaan Digital untuk Semua.”**

### Logo direction (minimal, modern)

Create a compact symbol that remains recognizable at 48×48 px:

- Primary mark: a custom geometric capital letter **D** with a subtle open-book/page fold incorporated into its negative space or inner counter.
- Keep the silhouette simple; no book illustration with many lines, no tiny text, no ISBN/barcode, no gradients that reduce legibility, and no extra market/candlestick motifs from DARFIN MARKET.
- Palette: deep navy/ink base, warm white or silver mark, and one restrained accent (teal or muted gold). Ensure monochrome and light-background variants also work.
- Wordmark: `DARFIN BOOK` in a clean modern sans-serif; use the symbol alone for Android adaptive icon, Telegram avatar, favicon, and small app surfaces.
- Android icon deliverables: 512×512 px Play/store asset, adaptive foreground/background layers, safe-zone checked at small sizes, plus monochrome themed icon if supported by the Android target.
- Build a tiny-size test sheet before approval. The D/book silhouette must remain clear without the wordmark.

# 2. Platforms and User Experience

## 2.1 Supported clients

### A. Web application

Primary full-featured experience at a configurable production domain. It includes discovery, book detail, reader, account, bookmarks, reading history, and settings.

### B. Android APK

Android app should use the existing web app as the shared UI where appropriate (PWA/TWA or Capacitor/WebView only after evaluating the current project). It must support deep links, back navigation, status/navigation bar styling, offline shell caching, and file opening for permitted local files. Do not build a second independent catalog or duplicate business logic in Android.

The APK must not be described as native offline book access unless the implementation actually downloads an authorized file and stores it under the relevant license terms.

### C. Telegram Bot

A conversational entry point for search, ISBN lookup, book details, saved books, and deep links into the reader. Bot must be useful even without opening the Mini App.

### D. Telegram Mini App

The same responsive web app launched from Telegram. It must validate Telegram `initData` on the backend before trusting the Telegram user identity. `initDataUnsafe` must never be trusted as authentication input.

## 2.2 Primary user journeys

1. User searches “978...”, title, or author.
2. Backend queries providers and normalizes results.
3. User opens a result and sees title, author, cover, edition, publisher, publication date, language, identifiers, description, source attribution, and access status.
4. User selects an available action:
   - **Baca sekarang:** internal reader for a permitted file or supported embedded reader.
   - **Lihat pratinjau:** provider preview or permitted preview pages.
   - **Pinjam buku:** official lending flow; authentication/checkout occurs with provider where required.
   - **Buka sumber:** external provider page when embedding is not supported.
   - **Simpan:** add to personal shelf.
5. Reading position/bookmark is saved when allowed and technically possible.
6. User can resume reading from any supported client.

## 2.3 Access status vocabulary

Use these normalized values throughout the product:

| Internal status | Indonesian label | Meaning | Allowed primary action |
|---|---|---|---|
| `FULL_ACCESS` | Akses penuh | Provider confirms full public/authorized reading access | Read inside DARFIN if provider permits internal rendering; otherwise provider reader |
| `PREVIEW` | Pratinjau tersedia | Only a portion/sample can be viewed | Read preview; never imply full book |
| `BORROW_AVAILABLE` | Bisa dipinjam | Provider reports a lending option; user may need provider account and checkout | Borrow through official provider flow |
| `BORROW_WAITLIST` | Masuk daftar tunggu | No immediate loan; waitlist available | Open official waitlist/borrow flow |
| `BORROWED_BY_USER` | Sedang dipinjam | Provider confirms current user's loan | Open authorized reader; expiry shown if provided |
| `CHECKED_OUT` | Sedang dipinjam pengguna lain | Provider reports unavailable due to another loan | Notify/try later or official waitlist |
| `RESTRICTED` | Akses terbatas | Provider or rights restriction | Explain restriction; official source link only |
| `EXTERNAL_READER` | Baca di sumber resmi | Provider allows reading but requires its own reader page | Open supported provider page or approved embed |
| `METADATA_ONLY` | Informasi buku saja | Metadata exists but no reading access was found | Save/view metadata; no read button |
| `UNKNOWN` | Status belum diketahui | Provider did not return reliable status | Never guess; show source link and retry |

Do not map a missing status to `FULL_ACCESS`.

---

# 3. Data Providers and API Integration

Provider adapters must be isolated behind a common interface. Do not let UI components call third-party APIs directly.

## 3.1 Primary provider: Open Library

**Official documentation:**
- APIs overview: https://openlibrary.org/developers/api
- Search API: https://openlibrary.org/dev/docs/api/search
- Books API: https://openlibrary.org/dev/docs/api/books
- Read API: https://openlibrary.org/dev/docs/api/read
- Developer usage guidance: https://openlibrary.org/developers

**Purpose:** book discovery, bibliographic metadata, author/work/edition identifiers, ISBN lookup, cover images, and read/borrow availability links.

**Endpoints to evaluate/use:**
- Search: `GET https://openlibrary.org/search.json?q={query}&fields=key,title,author_name,first_publish_year,cover_i,isbn,edition_count,language,subject,edition_key&limit={limit}&page={page}`
- ISBN edition lookup: `GET https://openlibrary.org/isbn/{ISBN}.json`
- Edition: `GET https://openlibrary.org/books/{OLID}.json`
- Work: `GET https://openlibrary.org/works/{OLID}.json`
- Read API: `GET https://openlibrary.org/api/volumes/brief/isbn/{ISBN}.json`
- Cover image: `https://covers.openlibrary.org/b/id/{cover_i}-L.jpg` (only if cover identifier exists; handle missing covers)

**Important semantics:** Open Library distinguishes a Work from an Edition. A Work groups related editions/translations; an Edition contains edition-specific details such as ISBN, publisher, and cover. Preserve both IDs in normalized records.

**Read API statuses:** provider may return `full access`, `lendable`, `checked out`, or `restricted`; match type may be `exact` or `similar`. Preserve the provider response and map it to normalized statuses carefully. A similar-edition scan must not be presented as the exact ISBN edition.

**Usage constraints:** Open Library states that its APIs are for low-volume, human-centered lookup and are not intended as a high-traffic third-party data backend. Cache responses. Include an identifying `User-Agent` with app name and contact email. Documented limits are 1 request/second for unidentified requests and 3 requests/second for identified requests. Register the application/use case where appropriate. Do not scrape HTML or fan out hundreds of single-book requests; use Search API and cache results.

## 3.2 Secondary provider: Google Books API

**Official documentation:**
- API overview: https://developers.google.com/books
- Volumes reference: https://developers.google.com/books/docs/v1/reference/volumes
- Embedded Viewer: https://developers.google.com/books/docs/viewer

**Purpose:** enrich book metadata and discover provider-defined viewability/preview/embed capabilities.

**Endpoint:**
- `GET https://www.googleapis.com/books/v1/volumes?q={query}&maxResults={n}&startIndex={offset}`
- ISBN search: `q=isbn:{ISBN}`
- Title search: `q=intitle:{title}`
- Author search: `q=inauthor:{author}`

**Relevant fields to normalize:** `id`, `volumeInfo.title`, `subtitle`, `authors`, `publisher`, `publishedDate`, `description`, `industryIdentifiers`, `pageCount`, `categories`, `imageLinks`, `language`, `previewLink`, `infoLink`, `accessInfo.country`, `accessInfo.viewability`, `accessInfo.embeddable`, `accessInfo.epub`, `accessInfo.pdf`, `accessInfo.accessViewStatus`.

**Critical access rules:**
- `viewability=ALL_PAGES` means public full viewability for the country in the response; still respect provider integration rules.
- `viewability=PARTIAL` means only a portion can be viewed.
- `viewability=NO_PAGES` means no book pages are available for viewing.
- `accessViewStatus` may be `FULL_PUBLIC_DOMAIN`, `FULL_PURCHASED`, `SAMPLE`, or `NONE`.
- `embeddable=true` is required before attempting the Google Embedded Viewer integration.
- Do not infer that a download link exists from an empty `epub` or `pdf` object. Use official download/ACS links only when returned and the user is entitled to access them.
- Availability may vary by country. Store/check country context; default to `ID` for Indonesian UI unless product settings indicate otherwise.

**API key:** implement optional server-side `GOOGLE_BOOKS_API_KEY` if quota or project configuration requires it. Public volume search may work without user authentication; do not expose a server key in the browser. Respect current Google Books terms and quota policies. The API is metadata/access discovery, not a guarantee of free full-text content.

## 3.3 Tertiary provider: Internet Archive / Open Library lending

**Official documentation:**
- Internet Archive Developers: https://archive.org/developers/
- Open Library Read API: https://openlibrary.org/dev/docs/api/read
- Open Library lending/account APIs: https://openlibrary.org/docs (inspect current endpoint schema before implementation)

**Purpose:** locate readable or borrowable scans and link users into the official lending/reader flow where the item is eligible.

**Implementation rule:** treat Internet Archive/Open Library lending as an official provider-controlled transaction. Do not create a shadow lending system or cache/serve scanned book files outside permitted mechanisms. For borrow, return, waitlist, and account-specific loan state, inspect current API documentation and supported authentication flow before coding. If a stable supported integration is not available, implement “Buka halaman pinjam resmi” instead of reverse-engineering private endpoints.

**Read API example:** `GET https://openlibrary.org/api/volumes/brief/isbn/{ISBN}.json` may return an `itemURL`, cover, status, and matching edition/work data. Use the returned item URL as a provider destination when appropriate. The read API may match another edition; preserve `match=exact|similar`.

## 3.4 Indonesian open-text source candidate: Wikisource Indonesia

**Endpoint:** `https://id.wikisource.org/w/api.php`

**Official API documentation:**
- MediaWiki Action API: https://www.mediawiki.org/wiki/API:Action_API
- Query module: https://www.mediawiki.org/wiki/API:Query
- Revisions/content access: https://www.mediawiki.org/wiki/API:Revisions
- Wikisource Indonesian scope/rights guide: https://id.wikisource.org/wiki/Buku_Panduan_Wikisource_Bahasa_Indonesia_(2026)

**Purpose:** provide eligible Indonesian-language source texts that can be read inside DARFIN BOOK via an API-derived text rendition, when the page's license and attribution requirements permit it.

**Implementation approach:**
- Use the MediaWiki Action API for search, page metadata, revision metadata, and content retrieval. Start with read-only API actions.
- Confirm the page belongs to the Indonesian Wikisource and that the language is Indonesian; do not assume the host domain alone proves every page's language.
- Store page title, canonical source URL, page/revision ID, author, publication/source notes, license/public-domain statement, and attribution requirements.
- Render content as sanitized text/HTML in a sandboxed reader. Never execute page scripts or arbitrary embedded content.
- Display “Sumber: Wikisumber bahasa Indonesia” plus a clickable source link, author attribution, and license notice. For CC BY-SA works, provide the relevant license and comply with share-alike/attribution requirements when adapting or redistributing.
- Re-check revision/license data and rights status before caching or redistributing content. Do not treat a Wikisource page as blanket permission to copy all external content.
- Distinguish “Baca dari teks Wikisumber” from a scanned facsimile/PDF. Only offer an internal PDF route if an authorized file is explicitly available and allowed.

**Rights gate:** Wikisource hosts public-domain and freely licensed texts, but the exact work's status must be checked. Some works can carry license conditions, and public-domain status may differ by jurisdiction. Do not ingest any work whose rights status is unclear.

## 3.5 Indonesian institutional sources: Perpusnas / iPusnas

**Official entry points:**
- Perpusnas services: https://www.perpusnas.go.id/layanan
- iPusnas usage guide: https://landing-ipusnas.perpusnas.go.id/howto.html
- iPusnas Android app: https://play.google.com/store/apps/details?id=mam.reader.ipusnas
- Publisher SAKEDAP API documentation: https://api-penerbitsakedap.perpusnas.go.id/

Perpusnas and iPusnas are important Indonesian discovery/reading destinations. However, do not assume a public consumer API exists merely because the service has a website or mobile app. For MVP:
- You may show official Perpusnas/iPusnas catalog or service links when a verified record is found through an authorized route.
- Do not reverse-engineer private mobile endpoints, automate logins, bypass lending, scrape reader pages, or proxy protected content.
- SAKEDAP is a publisher-oriented API with authenticated submission/management workflows; it is not a general public book-search or reader API. Do not use it as a consumer catalog source without formal authorization and a documented use case.
- Treat direct integration as a future partnership/API-access task. If no supported public API/feed/permission is available, use a source link only.

## 3.6 Provider priority and fallback

For an ISBN lookup:
1. Validate ISBN-10/ISBN-13 checksum locally.
2. Query Open Library ISBN endpoint and Read API (rate-limited, cache-first).
3. Query Google Books by ISBN with Indonesian language preference/restriction; verify actual edition language.
4. Check Wikisource Indonesia only for matching works/eligible texts; many Wikisource texts do not have ISBNs.
5. Merge metadata by identifiers and title/author similarity, but keep provider-specific IDs and source provenance.
6. Display edition-specific matches separately where ISBNs differ.
7. If the edition is not verified as Indonesian, do not include it in the default catalog.
8. Classify access from explicit provider signals only.

For title/author search:
1. Search Open Library using Indonesian language filtering and edition-level language verification.
2. Search Google Books with `langRestrict=id`.
3. Search Wikisource Indonesia for legally eligible Indonesian texts.
4. Merge near-duplicates using conservative matching without merging different translations/editions incorrectly.
5. Apply a strict server-side `language_code=id` + acceptable `language_verification` filter for the default catalog.
6. Allow user to filter by publication year, format, provider, subject, and access status; do not expose other-language results in the default discovery path.

**Do not treat metadata provider as reader provider.** A book can have metadata in one source and readable content in another. Keep `metadata_sources[]` and `access_sources[]` separate. For the default product experience, all displayed books must be verified as Indonesian-language editions/texts.

## 3.7 Future providers (not MVP)

- Crossref/OpenAlex for scholarly publication metadata, not book full-text rights.
- Project Gutenberg catalog for public-domain works where its terms and distribution requirements are met.
- National libraries and institutional repositories only after checking API and reuse licenses.
- User's own legally owned DRM-free files, imported locally by the user; never upload publicly by default.

Do not add providers merely because they appear in a public API list. Confirm API stability, licensing, rate limits, geographic availability, attribution, and allowed display/embedding first.

---

# 4. Reading Engine: PDF + EPUB + Provider Reader

## 4.1 Reader routing strategy

Create a `ReaderResolver` service that chooses one of these modes:

1. `INTERNAL_PDF`: permitted PDF URL/file; render with PDF.js.
2. `INTERNAL_EPUB`: permitted EPUB URL/file; render with epub.js.
3. `GOOGLE_EMBEDDED`: Google Books Embedded Viewer only when `embeddable=true` and provider rules allow it.
4. `PROVIDER_READER`: official provider reader URL (e.g. Internet Archive/Open Library item URL), preferably opened in a safe in-app browser/WebView only if terms and technical restrictions permit. Otherwise open external browser.
5. `PREVIEW_ONLY`: provider preview; clearly label preview-only and never imply full book.
6. `UNAVAILABLE`: metadata-only state with no reading action.

## 4.2 PDF reader

Recommended library: Mozilla PDF.js — https://mozilla.github.io/pdf.js/ .

Requirements:
- Render pages in-app with zoom, fit width, fit page, page navigation, search text when supported, and loading/error states.
- Lazy-load pages; do not download entire large files unnecessarily.
- Support page rotation only if stable and accessible.
- Preserve page position for authenticated users.
- Handle CORS failure honestly; do not proxy arbitrary third-party URLs to bypass CORS or access controls.
- For permitted files hosted by DARFIN, use short-lived signed URLs and private storage.
- Disable download/print only when required by license/provider and technically enforceable; never claim DRM-grade protection.

## 4.3 EPUB reader

Recommended library: epub.js — https://github.com/futurepress/epub.js .

Requirements:
- Render chapters, table of contents, previous/next chapter, font size, theme, line spacing, and reading position.
- Store bookmarks by EPUB CFI or another stable location identifier.
- Support reflowable EPUB; test fixed-layout EPUB separately and show a fallback if unsupported.
- Sanitize/contain book content. Treat EPUB HTML, scripts, links, and remote resources as untrusted. Do not execute arbitrary scripts from a book.
- Do not remove DRM or ingest protected EPUBs.

## 4.4 Provider-hosted reader

- Only use official URLs and supported embedding APIs.
- Respect `X-Frame-Options`, CSP, provider authentication, and terms. Do not use proxy tricks to defeat frame restrictions.
- If embedding is blocked, show a clear message and an “Buka di sumber resmi” action.
- Do not inject scripts into provider reader pages.
- Never scrape page images or network endpoints from the reader.

## 4.5 Offline reading

MVP: offline app shell and cached metadata only. Offline book files are a later feature restricted to legally downloadable content and provider terms. If enabled:
- Download only when provider explicitly offers an authorized download.
- Record source, license/access terms, retrieval timestamp, and user ownership/entitlement metadata.
- Encrypt local cached files where practical; provide remove-download action.
- Respect expiry, loan end time, and revocation. Do not promise offline access for borrowed books unless the official lending app/provider explicitly supports it.

---

# 5. Feature Scope

## 5.1 MVP — must have

### Discovery
- Search by ISBN-10, ISBN-13, title, author, and subject.
- Search suggestions and recent searches.
- Pagination/infinite scroll.
- Filters: language, year, provider, access status.
- Duplicate grouping with edition selection.

### Book details
- Cover (with placeholder on missing cover).
- Title/subtitle, authors, description, publisher, publication date, language, page count, subjects/categories, ISBN-10/13, edition, provider identifiers.
- Provider/source attribution and official source links.
- Access badge and plain-language explanation.
- Primary action based on access status.

### Reading
- PDF.js internal reader for permitted PDF files.
- epub.js internal reader for permitted EPUB files.
- Google Embedded Viewer when explicitly embeddable.
- Provider reader/external source fallback.
- Preview-only labeling.
- Resume position for supported internal readers.

### User library
- Saved books / “Rak Buku Saya”.
- Favorites.
- Reading history.
- Bookmarks and reading position for internal readers.
- Delete history and remove saved books.

### Telegram bot
- `/start`
- `/help`
- `/search <judul/penulis>`
- `/isbn <ISBN>`
- `/book <id>`
- `/saved`
- `/history`
- `/settings`
- Inline keyboard: Detail, Baca/Preview, Simpan, Cari lagi, Buka Website.
- Search result pagination.
- Deep links to web/Mini App book detail and reader.

### Web + Mini App
- Responsive mobile-first UI.
- Telegram Mini App launch button.
- Backend verification of `initData`.
- Shareable book detail links (not private reading position links).

## 5.2 Phase 2

- Android APK packaging and release pipeline.
- Push notifications through Telegram for waitlist/loan reminders only if provider supports and user opts in.
- Reading goals and streaks (optional; avoid manipulative engagement patterns).
- Advanced library sorting and collections.
- Authorized offline download support for public-domain/explicitly downloadable books.
- Import personal DRM-free EPUB/PDF from device, private by default.

## 5.3 Phase 3

- Additional national/institutional catalog integrations.
- Citation export (APA/MLA/Chicago) using metadata.
- Reading notes and highlights, only on content and formats where technically and legally appropriate.
- Accessibility improvements (TTS for user-provided or public-domain content where rights allow).
- Admin analytics and provider health monitoring.

---

# 6. UI / UX Requirements

## 6.1 Visual identity

Use the DARFIN BOOK identity defined in Section 1.6. Do not reuse DARFIN MARKET candlestick motifs.
- Premium, minimal, modern, calm digital-library aesthetic.
- Deep navy/ink for the dark theme; warm off-white/paper tone for the light reading surface; restrained teal or muted-gold accent.
- Typography should feel editorial and comfortable, not like a financial dashboard. Recommended pairing: a highly legible sans-serif for controls and a readable serif option for long-form book text. Use system fallbacks and self-hosted fonts where possible.
- Avoid excessive gradients, glow, clutter, oversized cards, dense badges, and distracting animation.
- Book covers may add color, but surrounding UI should remain quiet and consistent.
- Reader view is distraction-free; book text must be more prominent than app chrome.
- Use responsive layouts, safe areas, adequate contrast, and Android accessibility sizing.

## 6.1.1 Reader comfort and visual engagement

The interface must feel inviting for long reading sessions and avoid visual fatigue. “Tidak cepat bosan” must be achieved through comfort, curation, and a pleasant reading rhythm—not noisy motion or manipulative engagement patterns.

Reader comfort requirements:
- Default reading typography: start around 18 px on a typical phone viewport; allow user adjustment from small to large. Tune after usability testing rather than hard-coding one size.
- Body line-height target: approximately 1.6–1.85; provide adjustable line spacing and paragraph spacing.
- Limit long-form text measure to roughly 55–75 characters per line on larger screens; use responsive margins on phones.
- Provide Light/Paper, Sepia, and Dark/Night themes. Keep text/background contrast accessible in every theme.
- Provide font family (Sans/Serif where supported), font size, line height, page margin, text alignment, and screen orientation controls where applicable.
- Remember reader preferences per user/device and allow “Pulihkan pengaturan awal”.
- Keep controls unobtrusive: tap to show/hide reader toolbar; preserve a visible exit/back control and page/progress information.
- Provide an optional reading progress indicator and “Lanjutkan membaca”; do not force streaks, countdowns, repeated reminders, or gamified pressure.
- Use subtle transitions only for navigation and reader controls. Respect reduced-motion settings.
- Do not add autoplay audio, auto page-turning by default, bright flashing highlights, or intrusive pop-ups.

Discovery experience requirements:
- Use editorial shelves such as “Pilihan untukmu”, “Sastra Indonesia”, “Belajar dan Referensi”, “Sejarah Nusantara”, “Buku yang bisa dibaca gratis secara legal”, and “Lanjutkan membaca”.
- Distinguish curated/editorial recommendations from algorithmic ranking and sponsored placement. No sponsored content in MVP.
- Use attractive but restrained cover cards, clear title/author typography, short Indonesian descriptions, and accurate access labels.
- Provide accessible empty states with useful suggestions; do not fill the home screen with random books when provider data is unavailable.
- Avoid a never-ending feed as the only discovery method; provide categories, filters, search, and finite curated shelves.

## 6.2 Main navigation

Recommended tabs:
1. **Beranda** — search, featured/open-access books, recent activity.
2. **Jelajahi** — search results, subjects/categories, filters.
3. **Rak Saya** — saved books, currently reading, history.
4. **Akun** — pengaturan, profil, privasi, dan bantuan.

On small screens, use a compact bottom navigation. Reader view hides main navigation.

## 6.3 Home screen

- Search input: “Cari buku berbahasa Indonesia, judul, ISBN, atau penulis...”
- Quick ISBN scanner input (camera barcode scanning is optional Phase 2).
- Continue reading section.
- Saved books section.
- Discover books with explicit availability labels.
- Provider attribution in detail view, not cluttering each small card.

## 6.4 Search results

Each result should show:
- Cover, title, author(s), year.
- Optional format/language chip.
- Access status chip.
- Provider/source indicator.
- Clear distinction between exact ISBN and similar edition.

No fake “Baca” button if no read entitlement exists.

## 6.5 Reader controls

PDF:
- Back, title, page X/Y, previous/next, zoom, fit mode, search (if available), bookmark.

EPUB:
- Back, title, table of contents, chapter progress, font size, theme, line spacing, bookmark.

Reader settings should persist per user/device. Provide a clear “Akses dari penyedia” label where appropriate.

## 6.6 Empty/error states

Provide useful Indonesian messages for:
- No search results.
- Invalid ISBN.
- Provider unavailable/rate-limited.
- No reading access.
- Preview only.
- Loan required/checked out.
- CORS/unsupported format.
- Reader failed to load.
- Offline/network error.

Do not expose raw provider error payloads to users.

---

# 7. Telegram Bot Specification

## 7.1 Bot behavior

Bot is a fast discovery interface. It should not attempt to send copyrighted book files. It sends metadata, covers where allowed, access status, and links to the approved reader route.

## 7.2 `/start` message

Suggested copy:

“Selamat datang di DARFIN BOOK 📚\nCari buku berdasarkan judul, ISBN, atau penulis, lalu lihat apakah buku tersedia untuk dibaca, dipreview, atau dipinjam secara resmi.\n\nGunakan tombol Cari Buku untuk mulai.”

Buttons:
- `🔎 Cari Buku`
- `📚 Rak Saya`
- `🌐 Buka DARFIN BOOK`
- `❔ Bantuan`

## 7.3 Search flow

User sends a text or command. Backend classifies input:
- ISBN-10/13 candidate → validate checksum, perform ISBN lookup.
- Otherwise → title/author free-text search.

Bot response should be concise and paginate results. Each result card:
- Title
- Author
- Year (if known)
- Access badge
- Buttons: `Detail`, `Baca/Preview` only when eligible, `Simpan`.

If results exceed Telegram message limits, split safely or send a short summary with pagination.

## 7.4 Deep links

Use Telegram bot deep links with opaque, non-sensitive identifiers, e.g. `https://t.me/<bot_username>?start=book_<public_id>`.
Do not put raw user tokens, private storage paths, signed URLs, or personal reading data in deep-link payloads. Keep payload length within Telegram's documented constraints.

## 7.5 Bot reliability

- Use webhook in production with HTTPS; long polling may be used for local development.
- Verify webhook secret token.
- Handle duplicate updates idempotently using Telegram `update_id`.
- Apply per-user rate limits to search.
- Avoid sending repeated messages on retry.
- Provide graceful fallback if API providers are down.

---

# 8. Authentication and Identity

## 8.1 Supported identity modes

- Web: email/password or magic link if an auth provider already exists; do not force login for public search.
- Telegram: validated Telegram Mini App `initData`; bot messages use Telegram user ID from trusted update payload.
- Android: use the same web account session/auth mechanism; support Telegram login/linking if implemented.

## 8.2 Telegram Mini App validation

Official documentation: https://core.telegram.org/bots/webapps

- Frontend sends the raw `Telegram.WebApp.initData` string to backend.
- Backend verifies HMAC-SHA-256 using the official Telegram algorithm and bot token.
- Validate `auth_date` freshness and reject stale/replayed payloads according to configured policy.
- Never trust `initDataUnsafe` for authentication or authorization.
- Never accept a user ID sent separately by the client as proof of identity.
- Rate-limit invalid authentication attempts.

## 8.3 Account linking

Allow user to link web account and Telegram account using a one-time, short-lived, single-use token. Store only hashed token, expiry, and consumed timestamp. Do not link accounts based solely on matching display names/usernames.

---

# 9. Recommended Technical Architecture

First inspect existing repository. The following is a target architecture, not permission to rewrite an existing working stack.

## 9.1 Suggested stack

| Layer | Preferred technology | Notes |
|---|---|---|
| Backend | Node.js + TypeScript | Reuse current runtime if already established |
| API | Fastify or existing framework | REST endpoints; OpenAPI spec |
| Telegram | grammY | Webhook and inline keyboards |
| Web UI | Existing framework; otherwise React + Vite/Next.js | Mobile-first, reusable reader components |
| Android | PWA/TWA or Capacitor after evaluation | Avoid duplicate product logic |
| Database | PostgreSQL / Supabase | Catalog cache + user library + reading progress |
| Cache | Redis if available; otherwise DB cache | Provider TTL and rate limiting |
| Jobs | BullMQ/worker if required | Cover refresh, cache maintenance, provider health |
| PDF | PDF.js | Internal rendering for authorized files |
| EPUB | epub.js | Internal rendering for authorized files |
| Storage | S3-compatible private object storage only for permitted files | Never mirror restricted provider books |
| Deployment | Existing VPS/Docker/Render setup | Health checks and persistent database required |

## 9.2 Logical architecture

```text
Web App ───────────────┐
Android App ────────────┤
Telegram Mini App ──────┼──> DARFIN API Backend
Telegram Bot ──────────┘          │
                                  ├── Auth & Identity
                                  ├── Search Orchestrator
                                  ├── Provider Adapters
                                  │     ├── Open Library
                                  │     ├── Google Books
                                  │     └── Internet Archive / Lending
                                  ├── Metadata Normalizer & Deduplicator
                                  ├── Access Classifier
                                  ├── Reader Resolver
                                  ├── User Library / Progress
                                  ├── Rate Limiter & Cache
                                  └── PostgreSQL
```

## 9.3 Provider adapter contract

Define a common interface similar to:

```ts
interface BookProvider {
  name: string;
  search(query: BookSearchQuery): Promise<ProviderBook[]>;
  getByIsbn(isbn: string): Promise<ProviderBook | null>;
  getById(providerId: string): Promise<ProviderBook | null>;
  getAccess?(book: ProviderBook, countryCode: string): Promise<ProviderAccess>;
}
```

Do not require all providers to implement all methods. Use capability interfaces and explicit unsupported results.

## 9.4 Reader resolver contract

```ts
type ReaderMode =
  | 'INTERNAL_PDF'
  | 'INTERNAL_EPUB'
  | 'GOOGLE_EMBEDDED'
  | 'PROVIDER_READER'
  | 'PREVIEW_ONLY'
  | 'UNAVAILABLE';

interface ReaderResolution {
  mode: ReaderMode;
  accessStatus: AccessStatus;
  sourceProvider: string;
  launchUrl?: string;       // server-issued, validated URL only
  mimeType?: string;
  expiresAt?: string;
  explanation: string;
  canBookmark: boolean;
  canDownload: boolean;
}
```

The resolver must not create a launch URL by guessing a provider endpoint. URLs must come from verified provider responses or from a known, documented official URL pattern.

---

# 10. Database Design

Use migrations. All timestamps UTC. Store provider raw payload only when necessary, with retention and privacy limits. Do not store provider access tokens in catalog records.

## 10.1 `books`

Canonical work-level record:
- `id` UUID primary key
- `canonical_title` text not null
- `subtitle` text nullable
- `description` text nullable
- `first_publish_year` integer nullable
- `primary_language` text nullable (canonical ISO 639-1, default eligible value `id`)
- `language_tag` text nullable (e.g. `id-ID`)
- `language_verification` enum (`VERIFIED`, `PROVIDER_DECLARED`, `UNKNOWN`, `DISPUTED`)
- `language_evidence` JSONB nullable (provider/edition field and evidence; no free-form unsupported assertion)
- `cover_url` text nullable (validated provider URL)
- `created_at`, `updated_at`

## 10.2 `book_editions`

Edition-specific record:
- `id` UUID primary key
- `book_id` UUID FK books
- `title` text
- `publisher` text nullable
- `publish_date` text nullable
- `publish_year` integer nullable
- `language` text nullable (provider-native value retained)
- `language_code` char(2) nullable (normalized ISO 639-1, eligible default value `id`)
- `language_tag` text nullable
- `language_verification` enum (`VERIFIED`, `PROVIDER_DECLARED`, `UNKNOWN`, `DISPUTED`)
- `language_evidence` JSONB nullable
- `page_count` integer nullable
- `format` text nullable
- `isbn10` text nullable
- `isbn13` text nullable
- `edition_name` text nullable
- `cover_url` text nullable
- `created_at`, `updated_at`

Unique constraints should be carefully designed for non-null provider IDs/ISBNs; do not assume every edition has an ISBN.

## 10.3 `provider_records`

- `id` UUID primary key
- `edition_id` UUID nullable FK
- `book_id` UUID nullable FK
- `provider` enum/text
- `provider_work_id` text nullable
- `provider_edition_id` text nullable
- `provider_volume_id` text nullable
- `provider_item_id` text nullable
- `source_url` text nullable
- `raw_metadata` JSONB nullable (bounded and sanitized)
- `fetched_at` timestamptz
- `expires_at` timestamptz nullable
- Unique index on provider + provider-specific identifier.

## 10.4 `book_access`

- `id` UUID primary key
- `edition_id` UUID FK
- `provider_record_id` UUID FK
- `country_code` char(2)
- `status` normalized enum
- `match_quality` enum (`EXACT`, `SIMILAR`, `UNKNOWN`)
- `reader_mode` enum
- `official_item_url` text nullable
- `preview_url` text nullable
- `download_url` text nullable only if officially permitted
- `embeddable` boolean nullable
- `checked_at` timestamptz
- `expires_at` timestamptz nullable
- `access_notes` text nullable

Never store long-lived signed download links. Prefer re-resolving access when the user opens the reader.

## 10.5 `users`

- `id` UUID primary key
- `email` text nullable unique
- `display_name` text nullable
- `created_at`, `updated_at`

## 10.6 `user_identities`

- `id` UUID primary key
- `user_id` UUID FK
- `provider` (`telegram`, `email`, etc.)
- `provider_user_id` text
- `created_at`
- Unique(provider, provider_user_id)

## 10.7 `user_books`

- `id` UUID primary key
- `user_id` UUID FK
- `book_id` UUID FK
- `edition_id` UUID nullable FK
- `shelf_status` (`SAVED`, `WANT_TO_READ`, `READING`, `COMPLETED`, `ABANDONED`)
- `added_at`, `updated_at`
- Unique(user_id, edition_id) where edition_id exists; handle work-level save separately.

## 10.8 `reading_progress`

- `id` UUID primary key
- `user_id` UUID FK
- `edition_id` UUID FK
- `reader_mode` text
- `location_type` (`PDF_PAGE`, `EPUB_CFI`, `PROVIDER_POSITION`)
- `location_value` text
- `progress_percent` numeric nullable
- `last_read_at` timestamptz
- Unique(user_id, edition_id, reader_mode)

Only store provider reading positions when permitted and stable. Do not store provider credentials.

## 10.9 `bookmarks`

- `id` UUID primary key
- `user_id` UUID FK
- `edition_id` UUID FK
- `location_type` text
- `location_value` text
- `label` text nullable
- `created_at`

## 10.10 `search_history`

- `id` UUID primary key
- `user_id` UUID nullable
- `query_hash` text nullable
- `query_display` text nullable (optional, user deletable)
- `searched_at` timestamptz
- Retention policy; allow clearing history.


## 10.11 `book_rights_provenance`

Required for any content that DARFIN renders or caches, especially Wikisource texts and files stored by DARFIN:
- `id` UUID primary key
- `edition_id` UUID nullable FK
- `provider_record_id` UUID nullable FK
- `content_source_url` text not null
- `content_revision_id` text nullable
- `rights_status` enum (`PUBLIC_DOMAIN_VERIFIED`, `OPEN_LICENSE_VERIFIED`, `PROVIDER_PREVIEW_ONLY`, `PROVIDER_BORROW_ONLY`, `UNKNOWN`, `RESTRICTED`)
- `license_identifier` text nullable (e.g. SPDX identifier or canonical license URL when known)
- `attribution_text` text nullable
- `license_url` text nullable
- `jurisdiction_review` text nullable
- `reviewed_at` timestamptz nullable
- `redistribution_allowed` boolean nullable
- `internal_render_allowed` boolean nullable
- `notes` text nullable

No file may be copied to DARFIN-controlled storage unless `redistribution_allowed=true` is supported by documented rights evidence and the intended use is permitted. Unknown rights status must block mirroring and default to the official source reader/link.

---

# 11. Backend API Contract

Version all endpoints under `/api/v1`.

## Public/catalog endpoints

- `GET /api/v1/search?q=&type=&page=&limit=&language=id&year=&access=&subject=` (default `language=id`; strict verified edition filter)
- `GET /api/v1/books/:bookId`
- `GET /api/v1/editions/:editionId`
- `GET /api/v1/editions/:editionId/access?country=ID`
- `POST /api/v1/isbn/lookup` body `{ "isbn": "..." }`
- `POST /api/v1/reader/resolve` body `{ "editionId": "...", "preferredMode": "AUTO" }`

## Authenticated user endpoints

- `GET /api/v1/me`
- `GET /api/v1/me/books`
- `POST /api/v1/me/books` body `{ "bookId": "...", "editionId": "...", "shelfStatus": "SAVED" }`
- `PATCH /api/v1/me/books/:id`
- `DELETE /api/v1/me/books/:id`
- `GET /api/v1/me/history`
- `DELETE /api/v1/me/history`
- `PUT /api/v1/me/progress/:editionId`
- `GET /api/v1/me/progress/:editionId`
- `POST /api/v1/me/bookmarks`
- `DELETE /api/v1/me/bookmarks/:bookmarkId`

## Telegram endpoints

- `POST /api/v1/auth/telegram/mini-app` body `{ "initData": "..." }`
- `POST /api/v1/telegram/webhook` (or configured webhook route)
- `POST /api/v1/auth/link-telegram` for one-time account linking

All user endpoints require authenticated identity and ownership checks. Public search must be rate-limited and provider quotas protected. Default public search must apply strict Indonesian-language edition filtering; do not rely on frontend-only filtering.

---

# 12. Caching, Rate Limits, and Provider Resilience

## 12.1 Cache policy (initial defaults; tune after measuring)

| Data | Suggested TTL |
|---|---:|
| Search results | 6–24 hours |
| Book/work metadata | 7 days |
| Edition metadata | 7 days |
| Cover URL/metadata | 7 days |
| Access/availability | 5–15 minutes, re-check on open |
| Provider errors | 30–90 seconds (negative cache) |

Do not cache user-specific loan/entitlement status as global book status. Cache keys must include country and provider where relevant.

## 12.2 Rate limiting

- Per IP for unauthenticated web search.
- Per user for authenticated search.
- Per Telegram user ID for bot search.
- Per provider adapter to respect provider limits.
- Open Library: respect documented request rates and use identifying User-Agent/contact.
- Add exponential backoff with jitter for transient 429/5xx responses; do not retry permanent 4xx indefinitely.

## 12.3 Circuit breaker and fallback

If one provider is unavailable:
- Continue with other providers.
- Show source-specific partial results where possible.
- Do not label provider data as current if stale; show “Terakhir diperbarui”.
- Do not return fabricated zero results when provider timed out; show a partial-results warning.

## 12.4 Observability

Log provider name, route, latency, status code class, cache hit/miss, and request correlation ID. Do not log full user search queries by default, book contents, tokens, cookies, signed URLs, or Telegram initData.

---

# 13. Security, Privacy, and Compliance

## 13.1 Security requirements

- Secrets in environment variables/secret manager only.
- HTTPS everywhere.
- Validate and normalize ISBN, search inputs, URLs, and provider response schemas.
- SSRF protection: never fetch arbitrary URLs supplied by a user from the backend. For provider URLs, allowlist hosts and validate redirects at every hop.
- Prevent open redirects; reader launch URLs must be provider allowlisted.
- Content Security Policy for web app and reader.
- Sanitize descriptions and any provider-supplied HTML; render as plain text or sanitized safe markup.
- EPUB content is untrusted. Isolate iframe/sandbox, disable scripts, restrict external requests.
- Enforce database row-level security if using Supabase.
- Verify Telegram webhook secret and Mini App HMAC.
- Apply CSRF protection where cookie-based sessions are used.
- Keep dependencies patched and scan build artifacts.

## 13.2 Privacy requirements

- Search without login where possible.
- Reading history and shelves are private by default.
- User can clear history and delete account/data.
- Store minimal Telegram identity fields.
- Do not expose reading history in public deep links.
- Avoid analytics that record book text or precise reading content.
- Publish a concise privacy policy and terms page before public launch.

## 13.3 Copyright and licensing controls

- Metadata and book content have separate rights. A metadata API response is not a license to reproduce a book.
- Do not store or distribute full-text files unless the license/provider explicitly permits it.
- Public-domain status varies by jurisdiction; do not assume a book is public domain globally.
- Preserve attribution and source links required by each provider.
- Respect loan duration, concurrency, waitlists, and account requirements.
- Do not bypass DRM, ACS, publisher restrictions, or provider reader protections.
- When access is unclear, default to metadata-only or official external link.

---

# 14. Environment Variables

Create `.env.example` with placeholders only:

```env
NODE_ENV=development
APP_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:4000
APP_NAME=DARFIN BOOK
APP_LOCALE=id-ID
DEFAULT_BOOK_LANGUAGE=id
STRICT_INDONESIAN_CATALOG=true

DATABASE_URL=
REDIS_URL=

TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_MINI_APP_URL=
TELEGRAM_INITDATA_MAX_AGE_SECONDS=86400

GOOGLE_BOOKS_API_KEY=
OPEN_LIBRARY_USER_AGENT=DarfinBook/1.0 (contact: your-contact@example.com)
OPEN_LIBRARY_CONTACT_EMAIL=
WIKISOURCE_API_BASE_URL=https://id.wikisource.org/w/api.php

SESSION_SECRET=
JWT_SECRET=

# Optional private object storage for files DARFIN is legally allowed to store
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=

LOG_LEVEL=info
```

Never commit real secrets. If an existing repository already uses another environment naming convention, document and reuse it.

---

# 15. Deployment and Operations

- Dockerize services only if compatible with current deployment.
- Ensure database is persistent; do not rely on ephemeral filesystem for user shelves/progress.
- Add `/health` and `/ready` endpoints.
- Configure Telegram webhook after HTTPS deployment.
- Set CORS allowlist for production web domain and Telegram Mini App origin requirements.
- Use database migrations with backup/rollback strategy.
- Add uptime checks and provider health status.
- Use a staging environment before production.
- Android APK signing key must be stored securely and never committed.
- Document how to build, sign, version, and distribute APK.
- If hosting platform sleeps on free tier, account for cold starts and webhook reliability; a sleeping web process is unsuitable for dependable webhook processing without an always-on worker/alternative architecture.

---

# 16. Testing Strategy

## 16.1 Unit tests

- ISBN-10 and ISBN-13 checksum validation.
- Language-code normalization and Indonesian edition verification.
- Google Books `langRestrict=id` request behavior.
- Open Library `lang=id` preference does not replace strict edition-level language filtering.
- Unknown/non-Indonesian editions are excluded from default search and home shelves.
- Wikisource license/attribution metadata is required before internal text rendering.
- Provider response normalization.
- Work/edition deduplication.
- Exact vs similar edition matching.
- Access status mapping.
- Reader mode resolution.
- URL allowlist and redirect validation.
- Cache key generation with country/provider.

## 16.2 Integration tests

- Open Library search and ISBN lookup using mocked fixtures.
- Google Books response with `ALL_PAGES`, `PARTIAL`, `NO_PAGES`, `embeddable` true/false.
- Open Library Read API with full access, lendable, checked out, restricted, and no match.
- Provider timeout, 429, 5xx, malformed JSON.
- Telegram webhook duplicate update idempotency.
- Telegram Mini App valid/invalid/stale initData.
- User A cannot read User B's shelf, history, progress, or bookmarks.

## 16.3 End-to-end tests

1. Search by title from web.
2. Search by ISBN from Telegram bot.
3. Open details and verify attribution/access status.
4. Open an authorized PDF in internal PDF reader.
5. Open an authorized EPUB in internal EPUB reader.
6. Open Google Embedded Viewer only for embeddable result.
7. Preview-only book cannot be labelled full access.
8. Metadata-only book has no misleading read action.
9. Save book in Telegram and see it in web/Android account after linking.
10. Resume reading from another client for internal reader position.
11. Android back button exits reader correctly.

## 16.4 Performance targets (initial)

- Cached search API p95 < 800 ms (excluding third-party cold latency).
- Uncached provider results should stream/return partial results when practical.
- First reader page should render progressively; do not wait for full PDF download.
- No layout shift that makes reader controls jump while loading.
- Handle 1,000 search requests/hour in staging load test before public promotion; tune to provider quotas.

---

# 17. Phased Implementation Plan and Acceptance Criteria

## TASK 0 — Repository audit and architecture decision

Deliver:
- Existing stack/repo structure report.
- Existing auth/database/bot/deployment inventory.
- Proposed architecture and migration plan.
- Dependency/license review.
- Risk register (API limits, access rights, provider embedding, Android packaging).

Acceptance:
- No existing working feature is broken.
- No destructive changes.
- Architecture and phases approved before implementation.

## TASK 1 — Backend foundation and catalog model

Build:
- API server structure.
- Database migrations for books, editions, provider records, access, users, shelves, progress, bookmarks.
- Provider adapter interface.
- ISBN validator.
- Health endpoints and structured logging.

Acceptance:
- Migrations run on clean database.
- Unit tests pass.
- No secrets in source control.

## TASK 2 — Open Library integration

Build:
- Search, ISBN, edition/work metadata, cover URL, Read API adapter.
- User-Agent/contact header.
- Cache and rate limiter.
- Exact/similar match handling.

Acceptance:
- Mock tests for every access status.
- Rate limit respected.
- Metadata and access provenance preserved.

## TASK 3 — Google Books integration

Build:
- Search adapter and metadata normalization.
- Default `langRestrict=id` and server-side verification of the returned edition language.
- `id-ID` localization for Google Embedded Viewer controls when supported (this localizes controls, not the book's language).
- Country-aware access status mapping.
- Embedded Viewer capability check.
- Optional server-side API key.

Acceptance:
- `ALL_PAGES`, `PARTIAL`, `NO_PAGES`, `UNKNOWN` mapped correctly.
- `embeddable=false` never opens embedded reader.
- No download link invented.

## TASK 4 — Indonesian catalog, Wikisource, search orchestration, and book detail UI

Build:
- Indonesian Wikisource read-only adapter for eligible public-domain/open-licensed texts, with revision/license/attribution provenance.
- Strict Indonesian edition/text filter across provider search and curated shelves.
- Multi-provider search, deduplication, pagination, filters.
- Book detail page and source attribution.
- Access badges and action resolver.

Acceptance:
- Search works by ISBN/title/author.
- Default result feed contains only language-verified Indonesian editions/texts.
- A non-Indonesian or unknown-language ISBN match is clearly identified and excluded from default discovery.
- Different translations/editions are not incorrectly merged.
- Access status is visible and truthful.

## TASK 5 — Reader engines

Build:
- PDF.js reader for permitted files.
- epub.js reader for permitted files.
- Google Embedded Viewer where allowed.
- Provider reader/external fallback.
- Reader progress/bookmarks.

Acceptance:
- PDF/EPUB fixtures load in-app.
- Wikisource text reader includes source attribution and license notice.
- Reader themes (Paper/Sepia/Dark), font size, line height, and resume position work and persist.
- Restricted/preview-only items are not promoted to full access.
- Reader rejects untrusted arbitrary URLs and unsupported content.

## TASK 6 — User library and authentication

Build:
- Auth flow or reuse existing auth.
- Save/remove books, shelves, history, progress, bookmarks.
- Account linking between web and Telegram.

Acceptance:
- Data isolation tests pass.
- User can delete history and saved books.

## TASK 7 — Telegram bot

Build:
- grammY bot, commands, inline keyboards, pagination, deep links.
- Webhook security and idempotency.

Acceptance:
- Search and ISBN lookup work from chat.
- Book detail and read/preview links open the correct book.
- Bot never sends unauthorized full-text files.

## TASK 8 — Telegram Mini App

Build:
- Telegram launch configuration.
- `initData` backend verification.
- Responsive shared web UI.

Acceptance:
- Valid Telegram user authenticates.
- Tampered/stale initData is rejected.
- No reliance on initDataUnsafe for identity.

## TASK 9 — Android APK

Build:
- PWA/TWA/Capacitor decision based on repository audit.
- App icon/splash, deep links, safe-area, back navigation.
- Build/signing documentation.

Acceptance:
- APK installs on supported Android version range.
- Android launcher label is `Darfin Book`.
- Minimal D/book icon is legible at small sizes and passes adaptive icon safe-zone checks.
- Login, search, book details, reader, shelves function.
- No duplicate backend or local-only catalog logic.

## TASK 10 — Hardening and release

Build:
- Security review, privacy policy, terms, monitoring, backups, provider status dashboard, error reporting.
- Staging and production release checklist.

Acceptance:
- All critical tests pass.
- Access rights and provider attribution reviewed.
- Rollback and backup procedures documented.
- Public marketing claims match shipped features.

---

# 18. Definition of Done

A feature is complete only when:
- It works on its target client(s).
- Loading, empty, error, and retry states exist.
- API/provider errors are handled without fabricated results.
- Access rights and source attribution are respected.
- Tests are added and passing.
- Logs contain no secrets or sensitive reading data.
- Documentation and environment examples are updated.
- Existing product behavior remains intact.

---

# 19. Release Checklist

- [ ] Product name and visual identity: DARFIN BOOK; Android label: Darfin Book; minimal D/book lettermark.
- [ ] All product-owned interface copy is Bahasa Indonesia (`id-ID`).
- [ ] Default catalog excludes non-Indonesian and unknown-language editions.
- [ ] Reader comfort options (Paper/Sepia/Dark, font size, line spacing) are tested.
- [ ] Wikisource attribution/license compliance is verified for each rendered text.
- [ ] Production domain and Telegram bot username configured.
- [ ] Open Library use case registered where appropriate.
- [ ] Open Library User-Agent/contact configured.
- [ ] Google Books quota/key configured if required.
- [ ] Provider attribution and terms reviewed.
- [ ] Reader mode/access labels verified with test fixtures.
- [ ] No unauthorized book file mirroring.
- [ ] Telegram Mini App HMAC validation enabled.
- [ ] Telegram webhook secret enabled.
- [ ] Privacy policy and terms published.
- [ ] Database backups enabled.
- [ ] Android APK signing key secured.
- [ ] Error monitoring and uptime checks enabled.
- [ ] Marketing claims only mention features actually released.

---

# 20. Official References

1. Open Library APIs overview — https://openlibrary.org/developers/api
2. Open Library Search API — https://openlibrary.org/dev/docs/api/search
3. Open Library Books API — https://openlibrary.org/dev/docs/api/books
4. Open Library Read API — https://openlibrary.org/dev/docs/api/read
5. Open Library usage guidance — https://openlibrary.org/developers
6. Google Books API — https://developers.google.com/books
7. Google Books Volumes reference — https://developers.google.com/books/docs/v1/reference/volumes
8. Google Books Embedded Viewer — https://developers.google.com/books/docs/viewer
9. Internet Archive Developers — https://archive.org/developers/
10. Telegram Mini Apps — https://core.telegram.org/bots/webapps
11. PDF.js — https://mozilla.github.io/pdf.js/
12. epub.js — https://github.com/futurepress/epub.js
13. Wikisource Indonesia — https://id.wikisource.org/
14. MediaWiki Action API — https://www.mediawiki.org/wiki/API:Action_API
15. Perpusnas services — https://www.perpusnas.go.id/layanan
16. iPusnas usage guide — https://landing-ipusnas.perpusnas.go.id/howto.html
17. Google Books volume list (language restriction) — https://developers.google.com/books/docs/v1/reference/volumes/list?hl=id
18. Google Books Embedded Viewer (Indonesian UI localization) — https://developers.google.com/books/docs/viewer/developers_guide?hl=id

**Product language and UX note:** Bahasa Indonesia is the default and only language for product-owned UI in the initial release. The book catalog itself is restricted to verified Indonesian-language editions/texts; this does not mean every title has a legal full-text copy. Use a calm, editorial, modern reader with adjustable comfort settings and a minimal D/book lettermark.

**Research notes:** Provider endpoints, quotas, API terms, and embedding capabilities can change. Antigravity must re-check official documentation during implementation and record the date/version of each integration decision. This document is a product/engineering plan, not a legal opinion or a guarantee that any specific title is readable.

---

## Final instruction

Start with **TASK 0 only**. Inspect the existing project and return the audit plus a concrete implementation plan. The product name is **DARFIN BOOK** (Android label: **Darfin Book**). Bahasa Indonesia is mandatory for every product-owned interface. The default catalog must show only verified Indonesian-language book editions/texts. Treat the minimal D/book mark as the visual identity direction. Then implement tasks sequentially, preserving the working system. The most important quality criterion is truthful, lawful access handling: DARFIN must never claim that a book can be read fully unless the provider explicitly confirms that access for the relevant user/country and the chosen reader integration is permitted.
