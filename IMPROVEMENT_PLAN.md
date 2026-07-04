# План за подобрения — Open Magazine Studio

> Изготвен след пълен анализ на кода (юли 2026). Цел: **стабилност, сигурност и лесна поддръжка** — без излишни неща. Всяка фаза е самостоятелна, с конкретни стъпки и готов промпт за Claude Code.

---

## 1. Какво е проектът (резюме от анализа)

Уеб приложение (React 18 + Vite + TypeScript + Tailwind), което превръща поставена статия или `.docx` в последователен списанийен дизайн („БГ Наука") и изнася A4 PDF през браузърния печат. Странициране: **Paged.js**. Бекенд: **Supabase** (Postgres `mag_pdf_*` таблици + Storage за снимки) + 3 Deno edge функции за AI помощника. ~7 300 реда код, 62 unit теста (всички минават), lint/typecheck/build — чисти.

**Силни страни:** един-единствен render път (прегледът в редактора е буквално `/render` в iframe — няма разминаване preview↔PDF); номерата на страници и съдържанието са чист CSS (`target-counter`) — стабилни по конструкция; чистите функции в `src/lib/` са добре тествани; типовете са чисти (нула `any`).

**Основни проблеми (по тежест):** изтичане на AI API ключа, риск от загуба на съдържание при запис, XSS в референциите, много мъртъв код (втори неизползван layout engine), Paged.js в основния bundle, липса на CI и CLAUDE.md.

---

## 2. Фаза 0 — Основа за лесна работа с Claude Code

*Малка, прави всичко след нея по-бързо и по-безопасно. Направи я първа.*

| # | Какво | Как |
|---|---|---|
| 0.1 | **`CLAUDE.md`** в корена | Команди (`dev/build/lint/typecheck/test`), карта на архитектурата (paste → blocks → Paged.js → print), конвенции: UI текстовете са на **български**, таблиците с префикс `mag_pdf_`, никога `service_role` ключ във фронтенда, прегледът = `/render` в iframe (да не се създава втори renderer). |
| 0.2 | **GitHub Actions CI** | Един workflow: `npm ci && npm run lint && npm run typecheck && npm test && npm run build` при push/PR. Така всяка сесия с Claude Code има автоматична проверка. |
| 0.3 | **Зависимости — сигурност** | `@supabase/supabase-js` 2.57 → 2.110 (маха high-severity `ws` уязвимостта). Само minor/patch ъпдейти (`npm update`) — **без** major миграции (React 19, Tailwind 4, Vite 8 — вж. „Какво НЕ правим"). |

**Промпт за Claude Code:** `/init за CLAUDE.md; после: "Добави GitHub Actions CI workflow (lint, typecheck, test, build) и обнови @supabase/supabase-js до последна 2.x; провери че всичко минава."`

---

## 3. Фаза 1 — Сигурност (критично)

### 1.1 AI API ключът е четим от всеки посетител — **най-сериозният проблем**
Ключът се записва в чист вид в `mag_pdf_app_settings` (`AISettingsPage.tsx:66-70`), а RLS политиките дават на `anon` пълен достъп до всички таблици. Anon ключът е в bundle-а → **всеки може да прочете OpenAI/Anthropic ключа ти** с една заявка.

**Решение:** ключът се мести в **secret на edge функциите** (`Deno.env`, задава се със `supabase secrets set`). В базата остават само endpoint + модел. `rewrite-block` вече има `Deno.env` fallback (`rewrite-block/index.ts:37`) — същото се добавя в `ai-chat`, а записът/четенето на `api_key` от UI-а се маха. Миграция: изтриване на ключа от съществуващи редове.

### 1.2 XSS в `linkify` (потвърдено)
`ArticleBody.tsx:112-115` escape-ва `&<>`, но **не и кавички**, и слага суровия match в `href="$1"`. Поставен „URL" като `https://x/"onmouseover="alert(1)` избягва от атрибута → съхранен XSS в блока с референции. **Решение:** escape и на `"` в URL-а (или изграждане през DOM API вместо низ) + unit тест с payload-а.

### 1.3 Edge функциите са отворено AI реле
`Access-Control-Allow-Origin: *` + никаква проверка кой вика (`ai-chat/index.ts:5` и др.) → всеки сайт може да ти харчи AI кредитите. **Решение:** CORS само за твоя origin (от env) + `verify_jwt`/споделен secret header. Освен това `String(error)` връща сурови provider грешки на клиента — да се замени с общо съобщение + сървърен лог.

### 1.4 RLS и Storage (преди публично/многопотребителско ползване)
Сегашният blanket `anon` достъп е документиран избор за един потребител — приемливо за момента, но планът е: Supabase Auth (email login) + политики `authenticated`-only; Storage bucket-ът да получи ограничение за размер/тип на файла и политика за изтриване (сега обекти изобщо не могат да се трият — вж. 2.5). Отделен, по-голям PR — прави се, когато решиш да пуснеш приложението публично.

**Промпт:** `"Премести AI API ключа от mag_pdf_app_settings в edge function secrets (Deno.env), махни го от AISettingsPage, добави fallback в ai-chat като в rewrite-block. Поправи linkify в ArticleBody.tsx да escape-ва кавички + тест. Ограничи CORS на трите функции до origin от env и не връщай сурови грешки."`

---

## 4. Фаза 2 — Стабилност на данните (риск от загуба на съдържание)

### 2.1 Записът на блокове може да изтрие статия
`replaceArticleBlocks` (`save-blocks.ts:11-29`) прави **delete на всички блокове, после insert — без транзакция**. Ако insert-ът се провали (мрежа, лимит), статията остава с **0 блока**. **Решение:** Postgres функция `mag_pdf_replace_article_blocks(article_id, blocks jsonb)` (delete+insert в една транзакция), викана през `supabase.rpc()`. Нова миграция + тест.

### 2.2 Бъг: нова статия презаписва предишната (потвърдено)
В `App.tsx` `savedId` се задава при първия запис (`:126`), но „нова статия" само връща `view: 'paste'` — не го нулира. Следващата поставена статия прави `UPDATE` върху **старата** (`:86-97`). **Решение:** нулиране на `savedId` (и целия editor state) при връщане към paste; или по-чисто — след първия запис redirect към `/edit/:id`.

### 2.3 Защита от загуба на нередактирани промени
Никъде няма предупреждение при напускане с незаписани промени, а изтриването на блок (`BlockEditor.tsx:42-44`) е без потвърждение. **Решение:** `beforeunload` + блокиране на route-навигация при dirty state в двата редактора; `confirm` на кошчето на блок (както вече е в `IssuePage`).

### 2.4 Погълнати грешки → тихо празни екрани
Системен проблем: много заявки четат само `{ data }` и игнорират `error` (`issues.ts:19-24, 52-56`, `load-issue-doc.ts:42-54`), `IssuePage` при грешка показва вечно празна страница (`:121`), настройките гълтат грешки при запис (`AISettingsPage.tsx:75-78`, `BrandingSettingsPage`), а `HomePage`/`ArchivePage` не различават „няма данни" от „грешка". **Решение:** проверка на `error` навсякъде + видимо съобщение; унифициране на обратната връзка — навсякъде съществуващият `Toast` вместо `alert()` (`HomePage:14`, `IssuePage:44,87`, `BlockEditor:361`).

### 2.5 Атомарен reorder + osirotели снимки (по-нисък приоритет)
`reorderIssueItems` (`inserts.ts:72-83`) прави N отделни update-а без транзакция → частичен провал разбърква реда (RPC функция, както 2.1). Storage снимките никога не се трият при смяна/изтриване → расте безкрайно; минимално решение: изтриване на обекта при замяна на изображение + периодичен cleanup скрипт.

**Промпт:** `"1) Направи Postgres RPC mag_pdf_replace_article_blocks (транзакционен delete+insert) + миграция, ползвай я в save-blocks.ts, добави тестове. 2) Поправи stale savedId бъга в App.tsx (нова статия ъпдейтва старата). 3) Добави beforeunload/route guard при незаписани промени и confirm при триене на блок. 4) Мини през всички supabase заявки и обработи error с видим Toast; замени всички alert() с Toast."`

---

## 5. Фаза 3 — Стабилност на render/PDF пътя

### 3.1 Странициране преди зареждане на шрифтове и снимки
`usePaged.ts` пуска Paged.js **без** да изчака `document.fonts.ready` — колоните се изчисляват с fallback шрифт, после реалният се сменя → преливане/изрязване. Същото за снимки с неизвестен размер. `fonts.ready` се чака чак при печат (`RenderPage.tsx:67`) — твърде късно. **Решение:** в `usePaged` — `await document.fonts.ready` + изчакване на `img.decode()`/load на изображенията в източника, чак тогава `previewer.preview(...)`.

### 3.2 Печатът не изчаква пагинацията
Бутонът „Свали PDF" чака само шрифтовете, не и `data-paged-ready` — при голям брой клик по-рано дава празен/частичен PDF (само Playwright скриптът чака флага). **Решение:** деактивиран бутон до `data-paged-ready="true"` (и в `MagazinePreviewFrame.print()`).

### 3.3 Handoff на чернова — фиксиран 1.8 s бюджет
`RenderPage` polling-ва IndexedDB 12×150 ms и при изтичане тихо пада към демо fixture. **Решение:** по-дълъг/адаптивен timeout + явно съобщение вместо тих fallback.

### 3.4 Колонтитулът ползва акцента само на първата статия
`RenderPage.tsx:50-52` слага `--accent` на `:root` от първата статия — в брой с различни акценти горният колонтитул е грешен цвят за останалите. Известно ограничение на `@page` margin boxes; решение през named pages per-article е възможно, но по-сложно — **прави се отделно, само ако визуално ти пречи**.

**Промпт:** `"В usePaged.ts изчакай document.fonts.ready и зареждането на изображенията преди previewer.preview; гейтни бутоните за печат (RenderPage, MagazinePreviewFrame) на data-paged-ready; направи draft handoff-а в RenderPage устойчив (по-дълъг timeout + явно съобщение вместо тих fallback към fixture). Провери с npm run export:pdf че PDF-ът излиза коректно."`

---

## 6. Фаза 4 — Чистене и производителност

### 4.1 Изтриване на мъртъв код (потвърдено неизползван)
- `src/components/MagazinePreview.tsx` (328 реда — **втори, паралелен layout engine**, никъде не се рендира), `BlockList.tsx`, `LayoutSettings.tsx`, `BrandingPanel.tsx` — нула import-и.
- `src/lib/layout-engine.ts` — `generateLayout` не се вика никъде; от файла се ползва само типът `BrandingConfig` (местене или триене с консуматора).
- `supabase/functions/suggest-layout` — не се вика от никъде във фронтенда.
- **`@react-pdf/renderer`** — нула import-и в целия код; маха се от `package.json`.
- `issueRowsToDocs` (`load-issue-doc.ts:32-39`) — пазен само за тест на заместена логика.

### 4.2 Решение за Branding настройките (❓ твое решение)
`BrandingSettingsPage` (437 реда) записва header/footer/лого/палитра в базата, но **нищо в живия render не ги чете** — `magazine.css` е с хардкоднати „БЪЛГАРСКА НАУКА"/„WWW.NAUKA.BG". Настройката реално не прави нищо. Две опции: **(а)** свързване — `usePaged`/`magazine.css` да четат `branding_config` (header/footer текст, лого) — реална функционалност за ребрандиране, каквато README обещава; **(б)** триене на страницата до момента, в който потрябва. Препоръка: (а), защото README рекламира ребрандирането.

### 4.3 Code splitting — Paged.js вън от основния bundle
Всичко е един chunk от 945 KB; `main.tsx` статично import-ва всички route-ове, а `RenderPage → pagedjs` вкарва Paged.js на всяка страница. **Решение:** `React.lazy` за `RenderPage` (+ Suspense) — Paged.js се зарежда само на `/render`. Махане и на трите Google Fonts `@import` в `index.css:1` (Playfair/Merriweather/Lora — остатък, не се ползват от дизайна).

**Промпт:** `"Изтрий мъртвия код: MagazinePreview, BlockList, LayoutSettings, BrandingPanel, generateLayout от layout-engine.ts (запази/премести BrandingConfig ако е нужен), suggest-layout функцията и @react-pdf/renderer от package.json. После lazy-load-ни RenderPage с React.lazy, махни Google Fonts @import от index.css и провери размера на chunk-овете с npm run build."`

---

## 7. Фаза 5 — Рефакторинг за лесна поддръжка

*След чистенето (Фаза 4), за да не рефакторираш мъртъв код.*

| # | Проблем | Решение |
|---|---|---|
| 5.1 | `App.tsx` (`/new`) и `EditArticlePage` (`/edit/:id`) са почти идентични: копнат `handleAIRewrite` (`App.tsx:144-175` ≡ `EditArticlePage.tsx:145-170`), дублиран save, един и същ 3-панелен layout | Общ **`EditorShell`** компонент + споделени hooks (`useArticleEditor`); двете страници стават тънки обвивки. Най-големият единичен рефакторинг — прави се сам, с работещи тестове преди/след |
| 5.2 | Data достъпът е разпръснат: категории се четат на 3 места, `layout_config` се parse-ва/serialize-ва на ръка в двата редактора, `Category` типът е деклариран 3 пъти с различни полета | Единен модул `src/lib/articles.ts` (или разширяване на `issues.ts`): типове на едно място, `parseLayoutConfig`/`serializeLayoutConfig`, `loadCategories` |
| 5.3 | `ArticleSidebar` — 16 пропа | Групиране в `layout` обект + `onLayoutChange` |
| 5.4 | `BlockEditor.tsx` — 587 реда, 4 компонента в един файл | Разделяне на `TextBlockEditor`, `ImageBlockEditor`, `AddBlockMenu` в отделни файлове (механично) |
| 5.5 | `#007daa` хардкоднат на 8+ места | Tailwind токен `brand` в `tailwind.config.js` |
| 5.6 | Дублиран Loader2 спинър на 4 страници | Малък `<PageLoader />` |

**Промпт (5.1 — отделна сесия):** `"Извлечи общ EditorShell от App.tsx и EditArticlePage.tsx — двата редактора имат идентичен header/sidebar/preview/blockeditor layout и копнат handleAIRewrite. Без промяна в поведението; lint+typecheck+test след всяка стъпка."`

---

## 8. Фаза 6 — Тестове там, където болеше

*Не гоним покритие — покриваме местата с реални бъгове/рискове от този анализ.*

1. **`save-blocks`** (след RPC от 2.1) — най-рисковият код, нула тестове.
2. **`linkify`** — XSS payload тест (след 1.2).
3. **`image-upload.ts`** — компресия и data:→URL замяната.
4. **React Testing Library setup** + тестове само за: rewrite-parsing в `AIChatPanel` (`[BLOCK n REWRITE]` по индекс — чуплив), reorder в `BlockEditor`, save потока в редактора (stale-id регресия от 2.2).
5. **Playwright smoke тест** (вече е devDep): зареди `/render` с fixture → изчакай `data-paged-ready` → провери брой страници > 0 и генерирай PDF. Пази render пътя — единственото нещо, което CSS промените могат тихо да счупят. Влиза в CI.

**Промпт:** `"Добави React Testing Library към vitest; тестове за AIChatPanel rewrite parsing, BlockEditor reorder и save потока. Отделно: Playwright smoke тест който рендира fixture на /render, чака data-paged-ready и проверява че страниците > 0; вкарай го в CI."`

---

## 9. Какво НЕ правим (умишлено)

- **Без state-management библиотека / React Query** — приложението е малко; споделени hooks + чист data слой (5.2) стигат.
- **Без i18n framework** — един език (BG) по конвенция; само се поправят 3-те английски низа (`AISettingsPage:199,216`, `PasteZone:161`).
- **Без major ъпгрейди** (React 19, Tailwind 4, Vite 8, ESLint 10) — работят стабилно, миграцията е риск без полза сега.
- **Без втори render път / server-side PDF** — браузърният печат + Paged.js е силната страна на проекта.
- **Без drag&drop, pdf-lib merge, duplicate detection** засега — от README roadmap са, но са нови функции, не стабилност; след Фаза 6.

---

## 10. Ред на изпълнение и работа с Claude Code

**Ред:** 0 → 1 → 2 → 3 → 4 → 5 → 6. Фази 0–2 са критични (сигурност + данни); 3–4 са средни; 5–6 са поддръжка. Ако времето е малко: 0.3, 1.1, 1.2, 2.1, 2.2 са петте неща с най-голямо съотношение полза/усилие.

**Практика с Claude Code:**
- **Една фаза = една сесия = един PR.** Промптовете по фазите са по-горе, готови за copy-paste. Малките PR-и се преглеждат и връщат лесно.
- Всяка сесия завършва с `npm run lint && npm run typecheck && npm test && npm run build` (след Фаза 0 това го пази и CI).
- Преди merge: `/code-review` върху диффа; за render промени — и `npm run export:pdf` с реален брой за визуална проверка.
- `CLAUDE.md` (0.1) прави всяка следваща сесия по-точна — Claude вижда конвенциите, без да ги преоткрива.
- За рисковите фази (2.1 RPC миграцията, 5.1 рефакторинга) — първо plan mode, после изпълнение.

| Фаза | Обем | Риск |
|---|---|---|
| 0 Основа | малък | нисък |
| 1 Сигурност | среден | нисък |
| 2 Данни | среден | среден (миграция) |
| 3 Render | малък–среден | среден (визуален) |
| 4 Чистене | среден (много триене) | нисък |
| 5 Рефакторинг | голям | среден |
| 6 Тестове | среден | нисък |
