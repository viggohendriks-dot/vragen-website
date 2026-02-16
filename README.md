# QuizGen – automatische oefentoetsen voor studenten

Deze website maakt automatisch een oefentoets op basis van:
- geüploade bestanden, en/of
- tekst die je zelf plakt.

Je kunt kiezen tussen **open vragen**, **multiple choice**, of **beide**.

## Waar vind ik de *nieuwe code* die ik moet plakken?
De nieuwe code staat in dit bestand:

- `app/page.tsx`

Als je op je eigen computer nog de standaard Next.js pagina ziet, dan kun je:

1. `app/page.tsx` openen in je editor (bijv. VS Code).
2. De oude inhoud volledig verwijderen.
3. De nieuwe inhoud uit dit project (`app/page.tsx`) erin plakken.
4. Opslaan.
5. De server opnieuw starten met `npm run dev`.

Snelle controle of je de goede versie hebt:
- de eerste regel in `app/page.tsx` is: `"use client";`
- er staat een type in zoals: `type QuizMode = "open" | "mc" | "both";`

## Starten (beginners)

1. Open een terminal in de projectmap.
2. Installeer dependencies:

```bash
npm install
```

3. Start de website:

```bash
npm run dev
```

4. Open in je browser:

- http://localhost:3000

## Als je niet kunt typen in PowerShell
Dat betekent meestal dat `npm run dev` nog draait (dit is normaal).

- Stoppen: `Ctrl + C`
- Of open een tweede terminal-tab om extra commando's te typen.

## Handige checks
Controleer of je in de juiste map zit:

```bash
git status
git log --oneline -n 3
```

Controleer of de juiste pagina-code aanwezig is:

```bash
# Linux/macOS
sed -n '1,40p' app/page.tsx

# Windows PowerShell
type app\page.tsx
```

## Speciaal voor jouw situatie: je ziet wel de branch na `git fetch --all`
Als `git branch -a` iets toont zoals:

- `remotes/origin/codex/create-file-upload-quiz-website`

dan staat de nieuwe code op die remote branch en moet je die eerst lokaal uitchecken.

Gebruik in PowerShell exact:

```powershell
git checkout -b codex/create-file-upload-quiz-website origin/codex/create-file-upload-quiz-website
npm install
npm run dev
```

Open daarna:

- http://localhost:3000

Controleer tenslotte:

```powershell
type app\page.tsx
```

Als het goed is, begint regel 1 met `"use client";`.
