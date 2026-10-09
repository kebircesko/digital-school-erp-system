# Përdorimi i Shkollës Digjitale ERP

## Kyçja dhe serveri

Hapni aplikacionin dhe kyçuni me llogarinë tuaj. Administratori fillestar krijohet nga `ADMIN_EMAIL` dhe `ADMIN_PASSWORD` gjatë instalimit. Më vonë fjalëkalimet ndryshohen te **Përdoruesit**.

Te **Konfigurimi i serverit** në login vendosni adresën që ju jep administratori, për shembull `https://erp.shkolla.com/api`. Të gjithë kompjuterët e shkollës duhet të përdorin të njëjtën adresë. Adresa lokale `http://127.0.0.1:3000/api` funksionon vetëm kur serveri është aktiv në të njëjtin kompjuter.

## Përgatitja e shkollës

1. Te **Përdoruesit**, krijoni llogaritë për instruktorë dhe financat. Përdorni fjalëkalime të veçanta, së paku 12 karaktere.
2. Te **Kurset**, krijoni kursin, çmimin mujor dhe kohëzgjatjen.
3. Te **Grupet**, zgjidhni kursin dhe instruktorin, caktoni ditët, orën dhe kapacitetin.
4. Te **Nxënësit**, regjistroni të dhënat e nxënësit dhe kontaktin e prindit.
5. Te **Regjistrimet**, zgjidhni nxënësin dhe grupin. Vendosni datat, çmimin individual dhe zbritjen mujore fikse. Kontrolloni çmimin para ruajtjes; është i pavarur nga ndryshimet e mëvonshme të çmimit të kursit.

Në fushat monetare përdorni pikën dhjetore: `80.50`. Shuma e faturës është çmimi individual minus zbritja. Çdo muaj i prekur nga regjistrimi faturohet plotësisht; nuk ka ndarje sipas ditëve.

## Faturat dhe pagesat

Te **Faturat**, mund të gjeneroni faturat për muajin e zgjedhur. Serveri i gjeneron edhe automatikisht. Përsëritja e gjenerimit nuk krijon fatura të dyfishta. Afati standard është data 15 e muajit.

Te **Pagesat**, shtypni **Regjistro pagesë**, zgjidhni nxënësin dhe caktoni shumën për secilën faturë. Mund të paguani një pjesë ose gjithë mbetjen, për një ose disa fatura. Zgjidhni para të gatshme/bankë dhe datën e pagesës. Totali llogaritet nga ndarjet. Përdoruesi që regjistron pagesën ruhet automatikisht.

Butoni **PDF / Printo** hap dokumentin në shikuesin PDF të desktop-it. Përdorni komandat e shikuesit për ruajtje ose printim.

Për gabim në një pagesë, administratori e anulon me arsye dhe regjistron pagesën e saktë. Pagesa e vjetër mbetet në historik dhe detyrimi rikthehet. Faturat me pagesa nuk anulohen pa korrigjuar fillimisht pagesat.

## Ndërrimi ose përfundimi i grupit

Te **Regjistrimet**, përdorni **Ndërro grupin** për një grup tjetër të të njëjtit kurs. Ndërrimi fillon më datën 1 të një muaji pas fillimit të regjistrimit. Regjistrimi i vjetër ruhet në historik.

Përdorni **Përfundo** për të caktuar fundin e regjistrimit. Nuk lejohet përfundimi para muajit tashmë të faturuar. Për ndryshim çmimi individual/zbritjeje, përfundoni regjistrimin në fund të muajit dhe krijoni të ri nga muaji pasues.

## Borxhet, raportet dhe historiku

**Borxhet** tregon mbetjen për secilin nxënës dhe faturat përkatëse, me filtra sipas muajit, kursit dhe grupit. **Raportet** tregon arkëtimet e vlefshme, me interval ditor/mujor/vjetor dhe filtra kurs/grup/metodë pagese. Excel dhe PDF përdorin të njëjtët filtra.

Te **Nxënësit → Historiku**, shihni regjistrimet, faturat dhe pagesat. Instruktorët shohin vetëm pjesën mësimore. **Historiku** në sidebar është audit log për administratorin.

Kur një nxënës/kurs/grup ka histori, çaktivizojeni në vend të fshirjes. Për çaktivizim të instruktorit, caktoni paraprakisht instruktor tjetër për grupet aktive.

## Kopjet rezervë

Administratori krijon dhe shkarkon kopje te **Backup**. Serveri krijon kopje automatike çdo ditë në 02:00 kur është aktiv. Operatorit i duhet çelësi `BACKUP_KEY` për rikthim; ruajeni veçmas dhe sigurohuni që backup-et kopjohen jashtë serverit. Rikthimi kryhet në mirëmbajtje sipas [README](../README.md), pasi ndalet API-ja.
