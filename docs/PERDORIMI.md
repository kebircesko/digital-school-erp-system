# Përdorimi i Shkollës Digjitale ERP

## Kyçja dhe serveri

Hapni aplikacionin dhe kyçuni me llogarinë tuaj. Administratori fillestar
krijohet nga `ADMIN_EMAIL` dhe `ADMIN_PASSWORD` gjatë instalimit. Më vonë
fjalëkalimet ndryshohen te **Përdoruesit**.

Te **Konfigurimi i serverit** në login vendosni adresën që ju jep
administratori, për shembull `https://erp.shkolla.com/api`. Të gjithë
kompjuterët e shkollës duhet të përdorin të njëjtën adresë. Adresa lokale
`http://127.0.0.1:3000/api` funksionon vetëm kur serveri është aktiv në të
njëjtin kompjuter.

## Puna e shpejtë nga çdo faqe

- Kërkimi sipër faqes gjen nxënës sipas emrit, prindit ose telefonit. Klikoni
  rezultatin për të hapur profilin dhe pagesat pa e lënë faqen. `Ctrl+K`
  (`Cmd+K` në Mac) e aktivizon kërkimin; **Shiko listën e plotë** hap listën me
  kërkimin të plotësuar.
- **Veprim i ri** hap menjëherë regjistrimin e nxënësit, faturës ose pagesës.
  Pas krijimit të nxënësit hapet profili; **Regjistro në kurs / grup** e ka
  nxënësin të zgjedhur paraprakisht. Kontrolloni grupin dhe çmimin para
  ruajtjes.
- Numrat te **Përmbledhja** hapin listat përkatëse. Nxënësit aktivë/joaktivë
  hapen të filtruar; arkëtimet hapin raportin për sot, këtë muaj ose këtë vit.
- Klikimi mbi emrin e kursit ose grupit hap regjistrimet përkatëse. **Shiko të
  gjitha** heq këtë kufizim.
- Te **Borxhet**, klikoni numrin e faturës për ta parë, regjistruar pagesën ose
  printuar direkt në të njëjtën faqe.
- **Kthehu** hap faqen paraprake brenda aplikacionit. **Mbyll** në një profil
  ose formular ju kthen te faqja ku po punonit.

Veprimet e shkrimit janë të disponueshme për administratorin dhe financat;
instruktori ruan qasjen e tij për lexim.

## Përgatitja e shkollës

1. Te **Përdoruesit**, krijoni llogaritë për instruktorë dhe financat. Përdorni
   fjalëkalime të veçanta, së paku 12 karaktere.
2. Te **Kurset**, krijoni kursin, çmimin mujor dhe kohëzgjatjen.
3. Te **Grupet**, zgjidhni kursin dhe instruktorin, caktoni ditët, orën dhe
   kapacitetin.
4. Te **Nxënësit**, regjistroni të dhënat e nxënësit dhe kontaktin e prindit.
5. Te **Regjistrimet**, zgjidhni nxënësin dhe grupin. Vendosni datat, çmimin
   individual dhe zbritjen mujore fikse. Kontrolloni çmimin para ruajtjes; është
   i pavarur nga ndryshimet e mëvonshme të çmimit të kursit.

Në fushat monetare përdorni pikën dhjetore: `80.50`. Shuma e faturës është çmimi
individual minus zbritja, përpara vendimit përfundimtar të adminit. Çdo muaj i
prekur nga regjistrimi mund të aprovohet plotësisht; nuk ka ndarje sipas ditëve.

## Zgjedhja e nxënësit në formularë

Te regjistrimi i faturës, pagesës ose regjistrimit në grup, shkruani në fushën
**Nxënësi**. Sugjerimet shfaqen menjëherë poshtë saj, me emrin, prindin dhe
telefonin. Klikoni nxënësin ose përdorni shigjetat dhe Enter. Mund të kërkoni
edhe emër dhe mbiemër së bashku.

Pas zgjedhjes, emri mbetet në të njëjtën fushë. Për ta ndryshuar, shkruani emrin
tjetër ose përdorni butonin **×**. Duhet të zgjidhet një sugjerim që formulari
të lidhet me nxënësin e saktë; vetëm shkrimi i emrit nuk krijon zgjedhje. Nuk ka
më listë të dytë “Zgjidhni…” për nxënësin.

## Afati, muajt e papaguar dhe pamja PDF

Afati i faturave të reja ndjek ditën e fillimit të regjistrimit në kurs:
regjistrimi më 29 cakton afatin më 29 të muajit të faturës. Në muajt më të
shkurtër përdoret dita e fundit. Afati shfaqet për kontroll para ruajtjes. Për
faturat ekzistuese me afat tjetër, administratori mund të përdorë **Vendos
afatin sipas regjistrimit** brenda faturës. Ky veprim ruhet në historik dhe
ndryshon vetëm afatin.

Në profil dhe te pagesa shfaqen **Muajt e papaguar**, nga më i vjetri. Shtatori
duhet të mbyllet para Tetorit; një pagesë e pjesshme nuk e mbyll muajin. Mund të
përfshini disa muaj në një pagesë nëse mbulohen plotësisht faturat e muajve më
të vjetër, edhe kur nxënësi ka disa kurse. Kontrolli zbatohet edhe në server,
përfshirë pagesat e njëkohshme.

**Shiko PDF** hap dokumentin brenda aplikacionit pa e shkarkuar. Aty mund të
zgjidhni **Printo** ose **Ruaj PDF**. Pamja e printimit përmban vetëm faqet e
dokumentit; ruajtja shkarkon PDF-në origjinale. Mbyllja ju kthen te fatura.

## Faturat dhe pagesat

Puna e përditshme bëhet te **Faturat**. Në menu shfaqen vetëm Përmbledhja,
Nxënësit, Faturat dhe Raportet. Kurset, grupet, regjistrimet dhe borxhet janë te
**Organizimi**; përdoruesit, historiku dhe backup-i te **Administrimi**.

1. Hapni **Faturat → Lista e faturave**. Kërkoni nxënësin ose numrin; sipas
   nevojës filtroni muajin dhe statusin. Lista tregon shumën, pagesën dhe
   mbetjen. Kolona **Afati i pagesës** tregon datën dhe ditët e mbetura: “Mbeten
   X ditë”, “Afati sot” ose “Vonesë X ditë”. Faturat e paguara dhe të anuluara
   nuk kanë numërim ditësh.
2. Për faturë të re, administratori shtyp **Regjistro faturën**, zgjedh nxënësin
   dhe muajin. Kursi/grupi, data, valuta dhe shuma plotësohen nga regjistrimi.
   Mund të ndryshoni shumën; për ndryshim nga propozimi kërkohet arsye.
3. Shtypni **Ruaj faturën**. Hapet e njëjta faturë me mundësinë për të
   regjistruar pagesën menjëherë, ose për ta mbyllur dhe paguar më vonë.
4. Për faturë ekzistuese, përdorni **Hap**, dyklik në rresht ose **Paguaj**. Te
   **Regjistro pagesën**, shuma është automatikisht mbetja, data është sot dhe
   metoda është Cash. Për pagesë të pjesshme ndryshoni vetëm shumën.
5. Shtypni **Ruaj pagesën**, pastaj **Printo faturën**. Dokumenti përfshin
   kursin, çmimin, zbritjen, totalin dhe pagesat përkatëse poshtë, sipas
   modelit. Në Electron hapet shikuesi PDF; në browser shkarkohet dokumenti.

Te **Faturat → Faturat e muajit** shfaqen nxënësit që ende nuk kanë faturë për
muajin e zgjedhur. Kur tetori paguhet plotësisht, regjistrimi që vazhdon shfaqet
për nëntor. Pagesa e pjesshme mbetet për tetor. Administratori hap **Regjistro
faturën**, kontrollon shumën dhe e ruan. Faturat nuk krijohen pa këtë veprim.
Mungesat shihen brenda formularit te **Mungesat për kontroll**. “Pa të dhëna”
nuk do të thotë zero mungesa.

Te **Përmbledhja → Njoftimet e pagesave**, administratori dhe financat shohin
faturat me afat sot ose brenda 7 ditëve dhe, në filtrin **Me vonesë**, afatet e
kaluara. Çdo listë shfaq deri në 20 fatura me afatet më të hershme dhe numrin e
plotë të faturave. Numrat janë fatura; një nxënës mund të ketë disa kurse.
Klikoni numrin e faturës për ta hapur dhe regjistruar pagesën. Butoni
**Pagesat** në shiritin e sipërm hap Përmbledhjen prej çdo faqeje. Njoftimet
rifreskohen çdo minutë dhe pas regjistrimit të pagesës. Afati merret nga fatura;
për faturat mujore aktualisht është data 15 e muajit. Ditët llogariten sipas
kalendarit Europe/Tirane.

Emri i nxënësit është i klikueshëm në listën e nxënësve, regjistrimet e fundit,
faturat, listën mujore, regjistrimet në kurse dhe raportet. Hapet profili me
kontaktet, kurset, historikun dhe faturat. Administratori dhe financat mund të
ndryshojnë të dhënat ose të shtypin **Paguaj** pranë faturës së papaguar.
Instruktorët shohin profilin dhe kurset e lejuara pa veprime financiare ose
ndryshim të dhënash. Te **Njoftimet e pagesave**, klikimi mbi emrin ose butonin
**Paguaj** hap drejtpërdrejt formularin e pagesës për atë faturë; **Profili**
hap historikun. Hapja e formularit nuk regjistron pagesë pa shtypur **Ruaj
pagesën**.

**Ngarko orët dhe mungesat e muajit** është panel i palosshëm sipër listës së
muajit. Shkarkoni modelin, plotësoni orët dhe mungesat, ngarkojeni dhe
kontrolloni parashikimin para **Konfirmo importin**. ID-të e nxënësve dhe
kurseve nuk ndryshohen. Një gabim bllokon të gjithë importin; importi nuk
ndryshon shumat e faturave ekzistuese.

Te **Vijueshmëria nga PDF i DSOS**, zgjidhni grupin në ERP dhe ngarkoni raportin
mujor PDF deri në 2 MB. Muaji/viti lexohen nga **Period**; emri i klasës lexohet
nga titulli. Kontrolloni klasën, grupin dhe nxënësit në parashikim. Emrat lidhen
automatikisht vetëm kur përputhen me një nxënës të vetëm të grupit. Në rast
emrash të ndryshëm ose të përsëritur, zgjidhni nxënësin për çdo rresht dhe
shtypni **Kontrollo lidhjet**, pastaj **Konfirmo vijueshmërinë**. Nxënësit pa
regjistrim në grup duhen regjistruar para importit. Nuk krijohen nxënës ose
fatura automatikisht. Rishkarkimi i të njëjtit muaj zëvendëson numrat pas
parashikimit; nuk i shton dy herë.

Lista mujore dhe formulari i faturës tregojnë **Prezent (P)** dhe **Mungesa
(A)** si numra. Te PDF-ja, P-të numërohen direkt: **U** (e papërcaktuar), **T**
(vonesë) dhe orët pa shënim ruhen veçmas dhe nuk llogariten si prezenca. Ditët
pa mësim nuk numërohen si mungesa. Nëse raporti ditor nuk dallon secilën orë
(p.sh. disa orë në të njëjtën ditë), kërkohet eksport më i detajuar. Për modelin
Excel me numra përdoret **Orë gjithsej − Mungesa**; mungesat me arsye janë pjesë
e mungesave. Kur mungon importi shfaqet **Pa të dhëna për këtë muaj**.
Administratori vendos shumën përfundimtare te **Regjistro faturën** pas
kontrollit të vijueshmërisë.

**Faturat → Pagesat** ruan historikun e përgjithshëm dhe regjistrimin e një
pagese në disa fatura. Për punën e zakonshme mjafton butoni **Paguaj** te
fatura. Pagesat e gabuara anulohen nga administratori me arsye; ruhen në
historik dhe mbetja rikthehet.

Kur hapni **Paguaj**, pjesa **Vijueshmëria** shfaqet mbi shumën e pagesës.
Zgjidhni **Muaji i vijueshmërisë** për të parë P, A, U dhe T e nxënësit për
kursin e faturës. Fillimisht zgjidhet muaji i faturës. Numrat merren nga importi
më i fundit i atij muaji; me **Rifresko vijueshmërinë** mund t'i kërkoni sërish.
Në formularin e pagesës për disa fatura shfaqen kurset veçmas pas zgjedhjes së
nxënësit. Kur nuk ka import, shfaqet mesazh për mungesën e të dhënave. Për
modelin Excel pa U/T shfaqet **—** në këto dy fusha. Zgjedhja e muajit të
vijueshmërisë shërben për kontroll; shuma dhe data e pagesës plotësohen në
fushat e tyre dhe pagesa ruhet vetëm me **Ruaj pagesën**.

Të dhënat e shkollës në PDF konfigurohen me `SCHOOL_NAME`,
`SCHOOL_FISCAL_NUMBER`, `SCHOOL_BUSINESS_NUMBER`, `SCHOOL_VAT_NUMBER` dhe
`SCHOOL_CITY` në `.env` të API-së.

## Ndërrimi ose përfundimi i grupit

Te **Regjistrimet**, përdorni **Ndërro grupin** për një grup tjetër të të
njëjtit kurs. Ndërrimi fillon më datën 1 të një muaji pas fillimit të
regjistrimit. Regjistrimi i vjetër ruhet në historik.

Përdorni **Përfundo** për të caktuar fundin e regjistrimit. Nuk lejohet
përfundimi para muajit tashmë të faturuar. Për ndryshim çmimi
individual/zbritjeje, përfundoni regjistrimin në fund të muajit dhe krijoni të
ri nga muaji pasues.

## Borxhet, raportet dhe historiku

**Borxhet** tregon mbetjen për secilin nxënës dhe faturat përkatëse, me filtra
sipas muajit, kursit dhe grupit. **Raportet** tregon arkëtimet e vlefshme, me
interval ditor/mujor/vjetor dhe filtra kurs/grup/metodë pagese. Excel dhe PDF
përdorin të njëjtët filtra.

Te **Nxënësit → Historiku**, shihni regjistrimet, faturat dhe pagesat.
Instruktorët shohin vetëm pjesën mësimore. **Historiku** në sidebar është audit
log për administratorin.

Kur një nxënës/kurs/grup ka histori, çaktivizojeni në vend të fshirjes. Për
çaktivizim të instruktorit, caktoni paraprakisht instruktor tjetër për grupet
aktive.

## Kopjet rezervë

Administratori krijon dhe shkarkon kopje te **Backup**. Serveri krijon kopje
automatike çdo ditë në 02:00 kur është aktiv. Operatorit i duhet çelësi
`BACKUP_KEY` për rikthim; ruajeni veçmas dhe sigurohuni që backup-et kopjohen
jashtë serverit. Rikthimi kryhet në mirëmbajtje sipas [README](../README.md),
pasi ndalet API-ja.
