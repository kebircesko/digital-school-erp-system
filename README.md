# Shkolla Digjitale Prizren — Desktop ERP

Aplikacion Electron për Windows/Linux, React + TypeScript + Vite + Tailwind, REST API NestJS dhe PostgreSQL/Prisma. Të gjitha modulet punojnë me databazën; nuk ka statistika ose të dhëna demonstrative në aplikacion. Ndërfaqja është në shqip, me light/dark mode.

Udhëzues për administratorët dhe financat: [Përdorimi i aplikacionit](docs/PERDORIMI.md).

## Nisja lokale

Kërkon Node.js 22.12+ dhe npm 10+. Për Linux duhet një sesion grafik për Electron.

```bash
npm ci
npm run dev:local
```

`dev:local` krijon një PostgreSQL privat në `127.0.0.1:55432`, skedarët `.env`, migrimet dhe administratorin fillestar. Databaza ruhet në `.local/postgres/`; nuk humbet kur mbyllet aplikacioni. Nëse shërbimet janë të hapura, komanda i përdor dhe nuk nis instanca të dyfishta. Migrimet e reja aplikohen para nisjes. Konfigurimi për një databazë tjetër nuk mbishkruhet.

Në një terminal tjetër:

```bash
ELECTRON_DEV=1 npm run desktop
```

Në Windows PowerShell:

```powershell
$env:ELECTRON_DEV="1"
npm run desktop
```

Ndërfaqja mund të hapet edhe në `http://localhost:5173`. API-ja është në `http://127.0.0.1:3000/api`. Login: `ADMIN_EMAIL` dhe `ADMIN_PASSWORD` në `apps/api/.env`. **Kredencialet në `.env` përdoren gjatë krijimit fillestar; ndryshimi i tyre më vonë nuk ndryshon fjalëkalimin në databazë.** Për ta ndryshuar, përdorni faqen Përdoruesit.

Ruajeni terminalin e `dev:local` të hapur kur ai nis shërbimet. `Ctrl+C` ndal proceset që nisi kjo komandë. Instancat që ishin tashmë aktive nuk ndalen. PostgreSQL lokal i paketuar është vetëm për zhvillim; për prodhim përdorni server PostgreSQL të administruar.

## PostgreSQL i jashtëm / Docker për zhvillim

```bash
cp apps/api/.env.example apps/api/.env
cp apps/desktop/.env.example apps/desktop/.env
```

Vendosni `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ karaktere) dhe `BACKUP_KEY` (64 karaktere hex të rastësishme). Nëse përdorni Docker, vendosni `POSTGRES_PASSWORD` në ambient dhe ekzekutoni `docker compose up -d`. Porta 5432 lidhet vetëm me loopback.

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm run dev
```

`db:seed` krijon vetëm administratorin në një databazë pa përdorues. Nuk krijon nxënës sintetikë dhe nuk ndryshon përdoruesit ekzistues.

## Modulet

| Moduli | Funksionaliteti |
| --- | --- |
| Dashboard | Nxënës aktivë/joaktivë, kurse, grupe, arkëtime ditore/mujore/vjetore, fatura, borxhe dhe grafik mujor |
| Nxënësit | CRUD, kërkim, filtrim, renditje, faqe dhe historik i kurseve/faturave/pagesave |
| Kurset | Përshkrim, çmim mujor, kohëzgjatje dhe status |
| Grupet | Kurs, instruktor, ditë/orë mësimi, kohëzgjatje, kapacitet dhe numër regjistrimesh |
| Regjistrimet | Data, çmim individual, zbritje/ofertë, përfundim dhe ndërrim grupi me historik |
| Faturat | Gjenerim manual/automatik, numër unik, periudhë, afat, status dhe PDF/printim |
| Pagesat | Cash/bankë, pagesa të pjesshme/të plota, ndarje në disa fatura dhe dëshmi PDF |
| Borxhet | Nxënësit me detyrime, faturat e papaguara dhe filtra muaj/kurs/grup |
| Raportet | Ditore/mujore/vjetore, kurs/grup/metodë, eksport Excel/PDF |
| Përdoruesit | Krijim/ndryshim, role, aktivizim/çaktivizim dhe fjalëkalime |
| Historiku | Audit log i veprimeve dhe punëve automatike |
| Backup | Kopje manuale/automatike të enkriptuara, shkarkim dhe komandë rikthimi |

## Rolet dhe siguria

- **Administrator:** të gjitha modulet, përdoruesit, audit log, backup dhe anulimi i pagesave.
- **Financat:** nxënës, kurse, grupe, regjistrime, fatura, pagesa, borxhe dhe raporte; pa administrim përdoruesish/backup.
- **Instruktor:** lexim i nxënësve/kurseve dhe grupeve/regjistrimeve të veta; pa çmime, zbritje ose të dhëna financiare.

Fjalëkalimet ruhen me scrypt dhe salt të rastësishëm. Sesionet janë 8-orëshe, me hash të tokenit në PostgreSQL dhe token vetëm në memorie të desktop-it. Logout dhe ndryshimi i fjalëkalimit/rolit/statusit revokojnë sesionet. Administratori i fundit aktiv nuk mund të çaktivizohet ose të humbasë rolin. Një instruktor me grupe aktive duhet zëvendësuar para çaktivizimit.

API-ja përdor validim strikt, Helmet, rate limiting dhe CORS të kufizuar. Electron përdor sandbox, context isolation dhe nuk ekspozon Node.js në renderer. IPC për PDF/ruajtje pranon vetëm kërkesa nga aplikacioni dhe rrugët zgjidhen nga dialogu i përdoruesit. Databaza nuk aksesohet nga desktop-i.

## Rregullat financiare

- Monedha: EUR. Vlerat dërgohen si vargje dhjetore dhe ruhen në `Decimal(12,2)`. Llogaritjet financiare nuk përdorin floating point.
- Faturë mujore = çmimi individual minus zbritja mujore fikse. Regjistrimi që prek një muaj faturohet për gjithë muajin; nuk ka faturim proporcional sipas ditëve. Afati është data 15 e muajit përkatës.
- Një faturë për nxënës + kurs + muaj, edhe pas ndërrimit të grupit. Numrat `FAT-YYYY-NNNNNN` dhe `PAG-YYYY-NNNNNN` caktohen në transaksion. Çmimet/emrat e faturës ruhen si snapshot.
- Faturimi automatik kontrollon muajt nga fillimi i regjistrimeve deri te muaji aktual, në nisje dhe çdo orë në minutën 10, Europe/Tirane. Faturat ekzistuese nuk dyfishohen. `AUTO_INVOICES=false` e çaktivizon. Nxënësit joaktivë nuk marrin fatura të reja.
- Ndryshimi i çmimit të kursit nuk ndryshon çmimin individual të regjistrimeve ekzistuese. Për ndryshim çmimi/zbritjeje, përfundoni regjistrimin në fund të muajit dhe krijoni të ri nga muaji pasues.
- Ndërrimi i grupit fillon më datën 1 të një muaji pas fillimit dhe vetëm brenda të njëjtit kurs. Ruhet regjistrimi i vjetër dhe lidhja me të riun.
- Pagesa ndahet saktësisht në faturat e një nxënësi. Nuk pranohen shuma negative, më shumë se dy shifra dhjetore ose tejkalim i mbetjes. `idempotencyKey` parandalon regjistrimin e dyfishtë të një kërkese.
- Anulimi i pagesës nga administratori rikthen detyrimin dhe ruan pagesën/arsyen në historik. Raportet paraqesin pagesat e vlefshme sipas datës së pagesës. Faturat e paguara nuk anulohen pa anuluar pagesat; numri/periudha e faturës së anuluar nuk ripërdoret.
- Veprimet financiare përdorin transaksione Serializable me retry të konflikteve; databaza ka kufizime shtesë për shumat dhe statuset. Nxënësi/kursi/grupi me historik çaktivizohet në vend të fshirjes.

## PDF, Excel dhe printimi

Në Electron, `PDF / Printo` hap dokumentin në një dritare me shikuesin PDF, ku mund të printohet ose ruhet. Excel dhe backup-et ruhen përmes dialogut native. Në browser, dokumentet shkarkohen. PDF-të përfshijnë font Unicode të paketuar dhe licence të fontit; shkronjat shqipe funksionojnë edhe në Windows.

Excel ruan vlerat financiare si tekst decimal të saktë, për të mos humbur precizionin gjatë eksportit. Filtrat e raportit zbatohen edhe në eksport.

## Backup dhe rikthimi

`BACKUP_KEY` është një çelës AES-256-GCM hex me 64 karaktere. Nisja lokale e gjeneron automatikisht. Ruajeni veçmas nga backup-et. Kopjet përmbajnë të gjitha tabelat e të dhënave të ERP-së dhe audit log; sesionet përjashtohen dhe revokohen pas rikthimit. Nuk janë dump i konfigurimit të cluster-it PostgreSQL.

Backup automatik: çdo ditë në 02:00 Europe/Tirane dhe në nisje kur mungon kopja e asaj dite. Kërkon server aktiv dhe `BACKUP_KEY`. `AUTO_BACKUP=false` e çaktivizon. Skedarët ruhen në `BACKUP_DIR`; në prodhim vendosni volum persistent dhe kopjoni kopjet në një vend tjetër. Ruajtja është pa fshirje automatike; operatori administron retention-in.

Për rikthim, ndaleni API-në dhe punoni në mirëmbajtje. Me të njëjtën skemë/migrime dhe të njëjtin çelës:

```bash
RESTORE_CONFIRM=RESTORE_DIGITAL_SCHOOL npm run backup:restore -w @erp/api -- /rruga/backup.erpbackup
```

Komanda krijon një backup të gjendjes aktuale para rikthimit dhe e rikthen të gjithë snapshot-in brenda një transaksioni. Nëse kontrolli i autenticitetit ose një kufizim i databazës dështon, rikthimi nuk aplikohet. Mos ekzekutoni rikthim ndërsa API-ja ose klientë të tjerë shkruajnë në databazë.

## Testet

```bash
npm test
npm run test:erp
npm run test:desktop
```

`test:erp`: PostgreSQL i vërtetë i përkohshëm në 55439, NestJS në 3109, të dhëna sintetike. Teston CRUD, rolet, mbivendosjen/kapacitetin, transfertat, faturimin idempotent/automatik, pagesat konkurruese, shumat Decimal, anulimet, PDF/Excel, backup dhe rikthim në databazë tjetër. Nuk prek databazën lokale të shkollës.

`test:desktop` kërkon sesion grafik dhe kontrollon rrjedhën reale Electron → REST → PostgreSQL, ruajtjen Excel dhe shikuesin PDF. Rikthen build-in standard pas testimit. Pamjet ruhen në `tests/screenshots/`; rezultatet në [tests/VERIFICATION.md](tests/VERIFICATION.md).

## Serveri qendror dhe HTTPS

Konfigurimi Docker/Caddy është në [deploy/compose.yaml](deploy/compose.yaml). Vendosni `ERP_DOMAIN`, `POSTGRES_PASSWORD` dhe `BACKUP_KEY` në ambientin e serverit; për fjalëkalimin PostgreSQL përdorni vlerë hex që është e sigurt në URL. Domain-i duhet të drejtohet te VPS-ja dhe portat 80/443 të jenë të hapura.

```bash
docker compose -f deploy/compose.yaml build
docker compose -f deploy/compose.yaml up -d db
docker compose -f deploy/compose.yaml run --rm api npm run db:migrate
docker compose -f deploy/compose.yaml run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD api npm run db:seed
docker compose -f deploy/compose.yaml up -d
```

Caddy siguron TLS për domain-in. PostgreSQL dhe API-ja nuk publikojnë porta në internet; vetëm proxy publikohen në 80/443. `TRUST_PROXY_HOPS=1` përdoret vetëm në këtë konfigurim me një proxy, për rate limiting sipas IP-së së klientit. CORS për aplikacionin e paketuar: `app://erp`.

Për server pa Docker përdorni `apps/api/.env.production.example`, shërbim systemd/process manager, PostgreSQL privat dhe reverse proxy HTTPS. Backup-et dhe çelësi ruhen në server, jo në desktop.

## Paketimi Windows/Linux

Vendosni adresën reale të serverit para ndërtimit në `apps/desktop/.env.production`:

```env
VITE_API_URL=https://DOMAIN/api
```

```bash
npm run build
npm run package:linux
npm run package:win
```

Artefaktet dalin në `apps/desktop/release/`. Paketa Linux hapet me double-click në AppImage. Nëse sistemi nuk ka FUSE, niseni me `./"Shkolla Digjitale ERP-0.1.0.AppImage" --appimage-extract-and-run`. Instaluesi Windows është skedari `Shkolla Digjitale ERP Setup 0.1.0.exe`. Këto paketa përmbajnë klientin desktop; shërbimet API/PostgreSQL nisen veçmas. Windows NSIS mund të ndërtohet në Windows ose Linux me Wine. Në login → Konfigurimi i serverit mund të ndryshohet adresa pa rindërtim. Adresa ruhet lokalisht pa kredenciale. HTTPS kërkohet për server në internet; HTTP lejohet vetëm për loopback në të njëjtin kompjuter. Artefaktet e ndërtuara këtu përdorin API lokale si adresë fillestare. Për disa kompjuterë vendosni të njëjtën adresë HTTPS në secilin klient. Nënshkrimi i instaluesve kërkon certifikatat tuaja.

Përditësimi i serverit: backup, aplikimi i migrimeve, rinisja e API-së. Desktop-i shpërndahet veçmas; nuk përmban kredenciale PostgreSQL. Mos vendosni `.env`, `.local/` apo çelësa në versionim.

Arkitektura financiare ndjek [transaksionet Prisma](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions), PDF-të përdorin [PDFKit](https://pdfkit.org/docs/text.html), dhe punët automatike përdorin [NestJS Schedule](https://docs.nestjs.com/techniques/task-scheduling).


Për me hap aplikacionin desktop, hape terminalin në projekt dhe shkruaj:
cd ~/Desktop/digital-school-erp
npm run dev:local
Lëre atë terminal hapur. Në një terminal tjetër, shkruaj:
cd ~/Desktop/digital-school-erp
ELECTRON_DEV=1 npm run desktop