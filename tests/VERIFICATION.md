# Verifikimi i ERP-së së plotë — 8 tetor 2026

Mjedisi: Linux x64, Node.js 22.23.3, npm 10.9.9, PostgreSQL 18 i përkohshëm për testet, Electron 44.7.0. Testet përdorën të dhëna sintetike dhe databaza të veçanta nga databaza lokale e shkollës.

| Kontrolli | Rezultati |
| --- | --- |
| TypeScript / NestJS / React / Vite | Kaloi |
| Testet e fjalëkalimeve dhe aritmetikës Decimal/datave | Kaluan |
| `npm run test:erp` | 111 kontrolle integrimi kaluan me PostgreSQL real |
| `npm run test:desktop` | 28 kontrolle, përfshirë dy rrjedha reale Electron → REST → PostgreSQL, kaluan |
| Paketimi Linux AppImage | Kaloi, rreth 123 MB |
| Paketimi Windows NSIS x64 përmes Wine | Kaloi, rreth 109 MB |
| Aplikacioni i paketuar Linux | Kyçja dhe hapja e moduleve kaluan kundrejt API-së lokale |
| `npm audit` | 0 cenueshmëri të raportuara |
| Migrimet në databazën lokale | U aplikuan pas backup-it; përdoruesi dhe nxënësi ekzistues u ruajtën |
| API-ja lokale pas migrimit | Login, dashboard dhe të 12 endpoint-et e moduleve kaluan; backup i enkriptuar u krijua |
| Nisja e përsëritur `dev:local` | Kaloi me kodin 0, duke përdorur shërbimet ekzistuese |

Integrimi kontrollon CRUD, validimin, UUID-të, faqet, konfliktet e versioneve, role/sesione, mbivendosjen e regjistrimeve, kapacitetin sipas intervaleve dhe uljen e kapacitetit, transferimin e grupit, faturimin manual/automatik/idempotent, pagesat e pjesshme dhe të disa faturave, konkurrencën për të njëjtën faturë, tejkalimin e mbetjes, anulimet, kufizimet SQL, historikun e nxënësit dhe raportet.

Backup/rikthimi u kontrollua në një databazë tjetër: dekriptim me çelësin e saktë, refuzim i çelësit të gabuar dhe përmbajtjes së ndryshuar, ruajtje e shumave, revokim sesionesh dhe rollback kur një kufizim SQL refuzon të dhënat.

Electron kontrollon krijimin e përdoruesit/instruktorit, kursit, grupit, nxënësit dhe regjistrimit; faturën dhe shikuesin PDF; pagesën e pjesshme dhe borxhin; raportet dhe ruajtjen Excel përmes dialogut native; backup, audit log, dashboard dhe logout. Konfigurimi i serverit ruan adresën lokale dhe refuzon HTTP për server në internet.

Kontrolli vizual përfshiu `screenshots/erp-dashboard.png`, `screenshots/erp-debts.png`, ekranin e nxënësve dark, PDF-të faturë/dëshmi/raport/borxhe dhe një raport sintetik me gjashtë faqe. Shkronjat ë/ç, fundfaqet, numrat e faqeve dhe mbështjellja e tekstit funksionuan.

Rezultatet e fundit ruhen veçmas në `last-erp-integration.txt` dhe `last-desktop-integration.txt`.

## Kufijtë e verifikimit

Instaluesi Windows është ndërtuar, por nuk është ekzekutuar në Windows real. Paketat nuk janë të nënshkruara me certifikatë të shkollës. Printimi është kontrolluar deri te shikuesi PDF; printer fizik nuk është përdorur.

Server prodhimi në internet nuk është publikuar, sepse nuk është dhënë VPS/domain. Konfigurimi Docker/Caddy/HTTPS është përgatitur, por nuk është ekzekutuar këtu pasi Docker nuk është i instaluar. Aplikacioni lejon zgjedhjen e adresës së serverit në login. HTTPS kërkohet për internet; HTTP lejohet vetëm në localhost/127.0.0.1. Backend-i dhe PostgreSQL duhen mbajtur aktivë në server për qasje nga disa kompjuterë dhe punët automatike.
