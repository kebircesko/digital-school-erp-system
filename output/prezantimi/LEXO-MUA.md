# Prezantimi i Shkollës Digjitale ERP

- **Shkolla-Digjitale-ERP-Prezantimi.mp4** — video 1080p me titra shqip të integruar në figurë dhe kapituj navigimi. Nuk përmban narracion audio.
- **titra-shqip.srt** — titrat veçmas, për redaktim ose ripërdorim. Në videon MP4 titrat duken automatikisht.
- **SKENARI.md** — renditja e kapitujve dhe teksti i prezantimit.
- **raw/** — regjistrimi burimor, pa titrat e përpunuar.

Videoja tregon ndërtimin e projektit dhe përdorimin: kyçjen, përmbledhjen,
kërkimin, profilin e nxënësit, regjistrimin në grup, faturimin, pagesën,
borxhet, raportet dhe historikun.

Demonstrimi përdor ndërfaqen dhe API-në reale, me një databazë PostgreSQL të
përkohshme dhe të dhëna sintetike. Databaza e projektit nuk ndryshohet.

Për ta rigjeneruar nga rrënja e projektit, me varësitë e instaluara,
Google Chrome dhe FFmpeg:

```bash
npm run build
node scripts/create-presentation-video.mjs
python3 scripts/render-presentation-video.py
```
