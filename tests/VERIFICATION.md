# Verifikimi i ERP-së së plotë — 8 tetor 2026

Mjedisi: Linux x64, Node.js 22.23.3, npm 10.9.9, PostgreSQL 18 i përkohshëm për
testet, Electron 44.7.0. Testet përdorën të dhëna sintetike dhe databaza të
veçanta nga databaza lokale e shkollës.

| Kontrolli                                             | Rezultati                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| TypeScript / NestJS / React / Vite                    | Kaloi                                                                                  |
| Testet e fjalëkalimeve dhe aritmetikës Decimal/datave | Kaluan                                                                                 |
| `npm run test:erp`                                    | 111 kontrolle integrimi kaluan me PostgreSQL real                                      |
| `npm run test:desktop`                                | 28 kontrolle, përfshirë dy rrjedha reale Electron → REST → PostgreSQL, kaluan          |
| Paketimi Linux AppImage                               | Kaloi, rreth 123 MB                                                                    |
| Paketimi Windows NSIS x64 përmes Wine                 | Kaloi, rreth 109 MB                                                                    |
| Aplikacioni i paketuar Linux                          | Kyçja dhe hapja e moduleve kaluan kundrejt API-së lokale                               |
| `npm audit`                                           | 0 cenueshmëri të raportuara                                                            |
| Migrimet në databazën lokale                          | U aplikuan pas backup-it; përdoruesi dhe nxënësi ekzistues u ruajtën                   |
| API-ja lokale pas migrimit                            | Login, dashboard dhe të 12 endpoint-et e moduleve kaluan; backup i enkriptuar u krijua |
| Nisja e përsëritur `dev:local`                        | Kaloi me kodin 0, duke përdorur shërbimet ekzistuese                                   |

Integrimi kontrollon CRUD, validimin, UUID-të, faqet, konfliktet e versioneve,
role/sesione, mbivendosjen e regjistrimeve, kapacitetin sipas intervaleve dhe
uljen e kapacitetit, transferimin e grupit, faturimin
manual/automatik/idempotent, pagesat e pjesshme dhe të disa faturave,
konkurrencën për të njëjtën faturë, tejkalimin e mbetjes, anulimet, kufizimet
SQL, historikun e nxënësit dhe raportet.

Backup/rikthimi u kontrollua në një databazë tjetër: dekriptim me çelësin e
saktë, refuzim i çelësit të gabuar dhe përmbajtjes së ndryshuar, ruajtje e
shumave, revokim sesionesh dhe rollback kur një kufizim SQL refuzon të dhënat.

Electron kontrollon krijimin e përdoruesit/instruktorit, kursit, grupit,
nxënësit dhe regjistrimit; faturën dhe shikuesin PDF; pagesën e pjesshme dhe
borxhin; raportet dhe ruajtjen Excel përmes dialogut native; backup, audit log,
dashboard dhe logout. Konfigurimi i serverit ruan adresën lokale dhe refuzon
HTTP për server në internet.

Kontrolli vizual përfshiu `screenshots/erp-dashboard.png`,
`screenshots/erp-debts.png`, ekranin e nxënësve dark, PDF-të
faturë/dëshmi/raport/borxhe dhe një raport sintetik me gjashtë faqe. Shkronjat
ë/ç, fundfaqet, numrat e faqeve dhe mbështjellja e tekstit funksionuan.

Rezultatet e fundit ruhen veçmas në `last-erp-integration.txt` dhe
`last-desktop-integration.txt`.

## Kufijtë e verifikimit

Instaluesi Windows është ndërtuar, por nuk është ekzekutuar në Windows real.
Paketat nuk janë të nënshkruara me certifikatë të shkollës. Printimi është
kontrolluar deri te shikuesi PDF; printer fizik nuk është përdorur.

Server prodhimi në internet nuk është publikuar, sepse nuk është dhënë
VPS/domain. Konfigurimi Docker/Caddy/HTTPS është përgatitur, por nuk është
ekzekutuar këtu pasi Docker nuk është i instaluar. Aplikacioni lejon zgjedhjen e
adresës së serverit në login. HTTPS kërkohet për internet; HTTP lejohet vetëm në
localhost/127.0.0.1. Backend-i dhe PostgreSQL duhen mbajtur aktivë në server për
qasje nga disa kompjuterë dhe punët automatike.

## Kalimi në JavaScript — 20 tetor 2026

Kodi burimor u kalua në `.js` dhe `.jsx`; konfigurimet dhe varësitë direkte të
TypeScript u hoqën. Metadatat e dekoratorëve NestJS ruhen si thirrje JavaScript
për validimin dhe injektimin e shërbimeve.

- `npm test`: ndërtimi i API-së dhe React/Vite dhe testet e
  financave/fjalëkalimeve kaluan.
- `ERP_TEST=1 npm run test:integration`: 111 kontrolle kaluan me PostgreSQL të
  përkohshëm, duke përfshirë validimin, rolet, faturat/pagesat, PDF/Excel dhe
  backup/rikthimin.
- Skriptet JavaScript të inicializimit, krijimit të përdoruesit dhe rikthimit
  kaluan kontrollin e sintaksës.

Paketimi dhe rrjedhat Electron të përshkruara më sipër i përkasin verifikimit të
8 tetorit; nuk u përsëritën gjatë këtij kalimi.

## Aprovimi mujor dhe mungesat — 21 tetor 2026

- Shtohet lista **Për aprovim** me muaj kalendarik dhe shumën përfundimtare nga
  administratori. Faturimi në sfond ndalet; faturat ekzistuese ruhen.
- Pagesa e plotë e një muaji shfaq muajin pasues për regjistrimet që vazhdojnë.
  Anulimi i pagesës heq kandidatin ende të paaprovuar. Pagesa e pjesshme nuk
  krijon kandidat të muajit të ardhshëm.
- Importi `.xlsx` përdor model me ID, parashikim dhe konfirmim. Kontrollohen
  dublikatat, numrat e mungesave, formulat, regjistrimet përkatëse dhe
  ndryshimet mes parashikimit dhe ruajtjes. Importi nuk ndryshon shumat e
  faturave.
- Aprovimi ruan arsyen dhe mungesat e shqyrtuara. Dy aprovime konkurruese nuk
  krijojnë fatura të dyfishta. Vetëm admini mund të aprovojë ose importojë.
- Testet e parserit Excel, kalendarit Europe/Tirane, financave dhe fjalëkalimeve
  kaluan. Ndërtimi JavaScript/React/Vite dhe skema Prisma kaluan.
- `npm run test:erp`: 132 kontrolle me PostgreSQL të përkohshëm kaluan,
  përfshirë Excel, aprovimin, pagesat, revokimin e kandidatit dhe
  backup/rikthimin.
- `npm run test:desktop`: 28 kontrolle kaluan, me dy rrjedha reale Electron.
  Rrjedha ERP përfshin shkarkimin e modelit, ngarkimin dhe konfirmimin e
  mungesave, aprovimin, PDF, pagesën e pjesshme/të plotë, lajmërimin e muajit
  pasues dhe aprovimin e tij me shumë të ndryshuar nga admini.
- U inspektua pamja `tests/artifacts/billing-review.png` me të dhëna sintetike.
  Paketat AppImage/Windows nuk u rindërtuan gjatë këtij ndryshimi.
- Databaza lokale mori migrimin shtues pas një backup-i të enkriptuar. Login-i,
  lista për aprovim, lajmërimet dhe ndërfaqja lokale u kontrolluan.

## Thjeshtimi sipas fotove të shkollës — 21 tetor 2026

- Menuja e përditshme ka Përmbledhjen, Nxënësit, Faturat dhe Raportet.
  Organizimi dhe Administrimi janë të palosshme. Faturat e muajit dhe historiku
  i pagesave janë brenda të njëjtës hapësirë të faturave.
- Lista ka Hap/Paguaj/Printo. Regjistrimi i faturës hap menjëherë dritaren e
  saj, ku regjistrohet pagesa pa zgjedhur sërish nxënësin ose faturën. Shuma
  fillestare është mbetja, data është sot dhe metoda është Cash.
- PDF-ja përdor strukturën e fotos: logo e gjelbër e rindërtuar si vektor, të
  dhënat e shkollës, blerësi, datat, tabela e shërbimit, totalet dhe pagesat.
  Numrat fiskal/biznesi u vendosën pas konfirmimit të përdoruesit.
- `npm run test:erp`: 132 kontrolle kaluan. `npm run test:desktop`: 28 kontrolle
  kaluan; rrjedha ERP teston krijimin e faturës, mungesat, pagesën 30/80 EUR,
  printimin nga dritarja e faturës, plotësimin e mbetjes dhe faturën pasuese.
- Testet e PDF-së kontrollojnë faturën me një faqe dhe rastin me emra/adresa të
  gjata e 32 pagesa, pa faqe bosh nga numërimi. Të gjitha testet unitare kaluan.
- U inspektuan faturat e renderuara dhe pamjet `invoice-create.png`,
  `invoice-with-payment.png` dhe `invoices-simple.png` në `tests/artifacts/`.
  Pamja lokale u kontrollua edhe në 1440/1280/1100 px pa ndryshuar pagesa.
- Ndryshimi nuk kërkoi migrim të ri. Paketat Windows/AppImage nuk u rindërtuan.

## Rikthimi para katër shtesave — 29 tetor 2026

Me kërkesë të përdoruesit u hoqën rrjedha e regjistrimit të plotë, Puna për sot,
memoria e filtrave/pozitës dhe propozimet automatike të grupit. U ruajtën
kërkimi i shpejtë, lidhjet direkte dhe veprimet e versionit të mëparshëm.

Build-i i desktop-it përputhet me atë para katër shtesave: `index-N4G_e2PE.js`
dhe `index-CTk5-No-.css`. Kaluan build-i i plotë, 8 skedarët e testeve
automatike dhe kontrollet e shfletuesit për ADMIN, FINANCE e INSTRUCTOR. U
verifikuan mungesa e shtesave dhe ruajtja e çmimit manual pas zgjedhjes së
grupit. Nuk u ndryshuan skema apo të dhënat e shkollës.

## Afati sipas regjistrimit, muajt e papaguar dhe PDF — 29 tetor 2026

- Faturat e reja marrin ditën e regjistrimit në kurs si afat; muajt e shkurtër
  përdorin ditën e fundit. Faturat ekzistuese ndryshohen vetëm me veprimin
  eksplicit të administratorit, me audit dhe pa ndryshuar shumat/pagesat.
- Pagesat kontrollohen në server: çdo muaj më i vjetër i nxënësit duhet të jetë
  i mbyllur ose të mbulohet plotësisht në të njëjtën pagesë. U provuan pagesat e
  pjesshme, ndarja në disa fatura, konkurrenca, përsëritja me të njëjtin çelës
  dhe rihapja e borxhit pas anulimit të pagesës.
- Kaluan 173 kontrolle integrimi me PostgreSQL të përkohshëm, përfshirë 25
  kontrolle të reja për afatet, rolet, muajt dhe pamjen PDF në Chrome/Electron.
- Kaluan 9 skedarët e testeve automatike dhe build-et e API-së/desktop-it.
- Pamja PDF u hap në Electron me CSP aktive dhe pa shkarkim automatik. U
  kontrolluan pamja për printim, thirrja e printimit dhe ruajtja e bajteve
  origjinale PDF. Printer fizik nuk u përdor.

Përsëritja: `npm run build`, pastaj
`BILLING_ELECTRON_TEST=1 node scripts/test-billing.mjs` në një mjedis me Chrome
dhe ekran për Electron. Pamjet ruhen te `output/billing-preview/`. Databaza e
shkollës nuk preket.

## Sugjerime direkte për nxënësit — 29 tetor 2026

Fushat e nxënësit në faturë, pagesë dhe regjistrim përdorin një kërkim të vetëm
me sugjerime poshtë, emër dhe kontakt prindi. U verifikuan zgjedhja me një klik,
shigjetat/Enter, Escape, pastrimi, emrat e ngjashëm, gabimet e API-së dhe
anulimi i rezultateve të vonuara. Shkrimi i një emri pa zgjedhur sugjerimin nuk
kalon validimin e formularit. Kërkimi pranon edhe emër dhe mbiemër së bashku.

Kaluan `scripts/student-autocomplete-smoke.mjs`, build-et e API-së/desktop-it
dhe 173 kontrollet me API reale/PostgreSQL, përfshirë rrjedhën e pagesës dhe
PDF-në në Electron. Pamjet janë te `output/student-autocomplete/`.
