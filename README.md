# Obsidian Connector

Plugin per [Super Productivity](https://github.com/super-productivity/super-productivity) che permette di **agganciare un progetto a un file del vault Obsidian**.

Non sincronizza i task: crea un collegamento stabile progetto → nota, poi apre quella nota in Obsidian tramite URI (`obsidian://open`). Per il sync delle checkbox resta valido il plugin `sync.md`.

## Cosa puoi fare

- Impostare il **nome del vault** Obsidian
- Collegare ogni progetto Super Productivity a un file Markdown relativo al vault, ad esempio `Projects/Sito web.md`
- Aprire la nota da un pulsante nell'header del progetto, da un collegamento rapido o dal pannello laterale
- Creare la nota nel vault se ancora non esiste (`obsidian://new`)
- Copiare l'URI Obsidian o il wikilink `[[Projects/Sito web]]`

## Installazione

1. Scarica `dist/obsidian-connector.zip` (oppure esegui `npm run zip` in questo repo)
2. In Super Productivity apri **Impostazioni → Plugin → Scegli file plugin**
3. Seleziona lo ZIP e abilita il plugin

Lo ZIP deve avere `manifest.json` alla radice: è già fatto così dallo script di build.

Requisito: Super Productivity **14.0.0** o successiva. Funziona sul desktop e sulla web app; serve Obsidian installato sulla stessa macchina per aprire le note.

## Uso

1. Apri il pannello **Obsidian Connector** (menu plugin / pannello laterale)
2. Inserisci il **nome del vault** come appare in Obsidian (di solito il nome della cartella)
3. Scegli un progetto Super Productivity
4. Indica il percorso della nota relativo al vault, oppure premi **Suggerisci percorso**
5. Premi **Collega**

Quando sei dentro un progetto collegato, il pulsante **Obsidian** nell'header apre la nota. **Crea nota** usa `obsidian://new` e scrive un frontmatter con l'id del progetto Super Productivity; se la nota esiste già, Obsidian la apre senza sovrascriverla.

Puoi lasciare vuoto il nome del vault: in quel caso Obsidian apre l'ultimo vault usato.

## Sviluppo

```bash
npm test
npm run zip
npm run harness   # UI di prova su http://127.0.0.1:4173/
```

- `src/` — sorgente (logica condivisa, host `plugin.js`, UI iframe)
- `plugin/` — file del plugin pronti da impacchettare
- `test/` — test Node della logica di binding e degli URI Obsidian

Il plugin usa solo le API documentate in [Develop a Plugin](https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin) e in [`docs/plugin-development.md`](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md): progetti, persistenza sincronizzata, snack/dialog, pannello laterale, pulsante sull'header del progetto, URI `obsidian://`.

Non richiede `nodeExecution`: non legge il disco. Il percorso della nota è relativo al vault e viene aperto da Obsidian.

## Licenza

MIT
