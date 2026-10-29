# Dolaznost

Osobna web-aplikacija na hrvatskom za praćenje dolaznosti studenata. Next.js, React, TypeScript, Tailwind CSS, shadcn/ui Button, Lucide, Prisma, Supabase/PostgreSQL, Recharts, date-fns, React Hook Form i Zod.

## Lokalno pokretanje

Potrebni su Node.js 24.x (provjereno na 24.19), npm i PostgreSQL. Za lokalnu bazu koristite Docker Compose iz ovog projekta. Podaci se trajno spremaju na poslužitelju, ne u pregledniku.

```bash
npm ci
cp .env.example .env
docker compose up -d --wait db
npm run db:deploy
npm run dev
```

Otvorite aplikaciju na portu 3000. Za produkcijski način:

```bash
npm run build
npm start
```

Ako `.env` već postoji, sačuvajte ga i provjerite `DATABASE_URL`. Lokalni PostgreSQL iz `compose.yml` dostupan je samo na `127.0.0.1:54329`; podaci se čuvaju u Docker volumenu. `docker compose down` zaustavlja bazu bez brisanja volumena. Nemojte koristiti `down -v` ako želite zadržati podatke. Lozinka iz `.env.example` vrijedi isključivo za lokalni razvoj, ne za Supabase.

Prisma 6.19 koristi `engineType = "client"`, JavaScript schema engine i `@prisma/adapter-pg`. Lokalno i na Vercelu koristi se PostgreSQL, s tablicama u vlastitoj shemi `dolaznost`. Nema lokalne SQLite datoteke u novom runtimeu. Za pripremu baze koristite verzionirane migracije (`npm run db:deploy`), ne resetiranje sheme. `DIRECT_URL`, ako je postavljen, koristi se samo za migracije; aplikacija koristi `DATABASE_URL`.

## Prvi unos

1. U **Postavkama** dodajte akademsku godinu, semestar i datume nastave. Dodajte praznike prije generiranja rasporeda.
2. U **Mojim kolegijima** dodajte kolegij, satnicu i pravila. Početni primjeri dodaju samo nazive i vaše zadane postavke; nisu službeni podaci fakulteta.
3. Zadana skupina zajednički prati nastavu. Za posebna pravila uredite je u P, V ili S i dodajte ostale skupine. Svaka skupina računa zasebne evidencijske jedinice; svi uvjeti svih skupina moraju biti zadovoljeni.
4. U **Tjednom rasporedu** dodajte jedno ili više ponavljanja. Svako ima dan, vrijeme, broj nastavnih sati, prostoriju i raspon datuma. Broj termina tjedno određuje se brojem unesenih ponavljanja. Spremanje generira kalendar unutar semestra, bez praznika.
5. U **Kalendaru** ili na kolegiju evidentirajte prisutnost, djelomičnu prisutnost ili izostanak. Dolaznost se može označiti nakon završetka svih aktivnih termina iste evidencijske jedinice.

Planirane jedinice možete unijeti izravno (npr. 15); vrijednost 0 koristi stvarno uneseni raspored. Ukupna satnica služi planiranju i upozorenju na nepotpun raspored. Aplikacija ne izmišlja datume ili broj dana iz same satnice: popunite raspored ili izričito unesite broj planiranih jedinica. Ako je raspored nepotpun, procjena se označava. Kolegij bez plana nema lažno zelen status.

## Kako izračun radi

Jedini izvor formula je `src/lib/attendance.ts`; API, nadzorna ploča, detalji, statistika i PDF koriste istu logiku.

- U načinu **po danu** svi termini **iste skupine istog kolegija istog datuma** dijele jednu evidencijsku jedinicu i status. Četiri sata su jedan izostanak, ali četiri propuštena sata. Više termina u danu ne udvostručuje izostanak.
- Odvojene skupine (npr. predavanja i vježbe) imaju svoje jedinice, pravila i evidenciju. Način **po terminu** prati svako održavanje zasebno.
- Potrebni dolasci = `ceil(planirane jedinice × minimalni postotak / 100)`. Postotak je ograničen na dvije decimale i pretvara se u cijele stotinke prije izračuna.
- Standardno dopušteno = plan − potrebni dolasci. Za pravilo I vrijedi stroži limit, a za ILI blaži. Ručni limit i maksimalni broj rade zasebno; „samo evidencija” nema ograničenja.
- Dodatno odobreni izostanci dodaju se osnovnom limitu, do broja planiranih jedinica. Ne mijenjaju propisani minimalni postotak. Prikazuje se ostvarena dolaznost i odstupanje od osnovnog minimuma.
- Djelomična prisutnost može vrijediti kao puni dolazak, puni izostanak ili zadani udio dolaska (0–1, četiri decimale). Izostanak je preostali udio. Propušteni sati koriste isti udio.
- Opravdani izostanak može trošiti izostanke ili biti izuzet iz nazivnika plana i ostvarene dolaznosti.
- Otkazana ili neodržana **cijela jedinica** ne ulazi u plan ni u izostanke. Ako je otkazan samo jedan od više dnevnih termina, drugi aktivni termini i dalje čine jednu jedinicu.
- Buduća nastava ne ulazi u održanu ili ostvarenu dolaznost. Nepoznati statusi nisu dolasci. Trenutna dolaznost koristi samo održane, evidentirane jedinice.
- Projekcija je jasno označen **najbolji scenarij**: dolazak na sve preostale i neevidentirane jedinice. Nije ostvarena dolaznost. Nepotpuna evidencija i raspored prikazuju upozorenje.
- Preostali izostanci mogu biti negativni. Posljedice prekoračenja prikazuju se samo ako ih sami unesete.

Datumi se pohranjuju kao `YYYY-MM-DD`, vremena kao `HH:mm`, bez pretvaranja kalendarskih datuma kroz UTC. Današnji datum i vrijeme računaju se u `Europe/Zagreb`. Prikaz datuma je hrvatski.

## Izmjene i zaštita evidencije

Uređivanje kolegija ili pravila ne briše evidenciju. Nova pravila odmah vrijede za cijeli postojeći semestar; verzioniranje pravila s različitim datumima stupanja na snagu nije uključeno.

Izmjena tjednog ponavljanja ažurira samo buduće, neevidentirane, ručno neizmijenjene termine. Prošlost i evidentirani termini ostaju. Generiranje je ponovljivo, bez duplikata. Brisanje ponavljanja zadržava već generirane termine. Nakon izmjene praznika kliknite ikonu **Osvježi termine** na ponavljanju; ranije evidencije se čuvaju. Za trajno uklanjanje pojedinačnog održavanja iz rasporeda koristite status „Nastava otkazana” ili „Nastava nije održana”; izbrisani redovni termin može se ponovno stvoriti pri izričitom generiranju ponavljanja.

Premještanje termina čuva njegov status i napomenu. Premještanje dijela dnevne nastave na drugi datum može stvoriti novu dnevnu jedinicu s prenesenim statusom. Ako na odredištu postoji proturječan status, izmjena se odbija. Promjena brojanja po danu/terminu razdvaja ili objedinjuje postojeće jedinice u jednoj transakciji. Prvo uskladite proturječne statuse za objedinjavanje i provjerite planirani broj jedinica.

Brisanje kolegija, skupine, semestra ili godine traži potvrdu i briše povezane podatke. Za arhivu jednostavno zadržite prethodni semestar/godinu i promijenite filtar.

## Izvoz i sigurnosne kopije

- **CSV**: svi pojedinačni termini s ID-em evidencijske jedinice, statusom, satima i napomenom. Isti ID više redaka označava **jedan** dnevni dolazak/izostanak; CSV retke nemojte zbrajati kao izostanke. Ćelije koje bi mogle postati formule su zaštićene.
- **PDF**: sažetak po skupinama i detaljna evidencija, s ugrađenim fontom koji podržava hrvatske znakove.
- **JSON verzija 1**: sva relacijska evidencija i postavke, za potpunu sigurnosnu kopiju i vraćanje.

Uvoz provjerava strukturu Zodom, relacije, identifikatore i duple dnevne jedinice. Traži izričitu potvrdu zamjene te radi atomarno: pogreška ne smije ostaviti djelomično uvezenu bazu. Granica datoteke u sučelju je 4 MB, ispod ograničenja Vercel funkcija. Uvoz zamjenjuje sve podatke; ne spaja dvije arhive. Redovito spremite JSON i izvan stroja koji pokreće aplikaciju. Za sigurnosnu kopiju cijele PostgreSQL baze koristite `pg_dump` ili dostupne opcije sigurnosnih kopija u Supabaseu.

## Provjere

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Vitest pokriva tražene matematičke scenarije, rubne postotke, opravdane/djelomične izostanke, buduće termine, nepotpune rasporede, nadoknade, odvojene semestre, promjene pravila i PostgreSQL/API integraciju. Integracijski testovi stvaraju odvojene privremene PostgreSQL baze i provjeravaju očuvanje evidencije pri promjeni rasporeda, promjenu načina brojanja i atomarni JSON uvoz.

Playwright pokreće zaseban produkcijski poslužitelj na portu 3100 s privremenom bazom. Najprije napravite `npm run build`. Koristi `/usr/bin/chromium` kada je dostupan; drugdje instalirajte `npx playwright install chromium` ili postavite `CHROMIUM_PATH`. Test unosi stvarne podatke kroz obrasce, provjerava izostanak za četiri sata nastave, izvoz PDF/CSV/JSON, trajnost nakon ponovnog učitavanja, kalendar, statistiku, tamnu temu i mobilni prikaz. Testovi ne koriste `DATABASE_URL` ni vašu Supabase bazu. Čitaju samo `TEST_DATABASE_URL` ili zadanu lokalnu vezu iz `compose.yml`; račun mora smjeti stvarati i brisati testne baze. Prije testiranja pokrenite lokalni PostgreSQL.

## Struktura i ograničenja

- `prisma/schema.prisma`: akademske godine, semestri, praznici, kolegiji, skupine, pravila, tjedna ponavljanja, termini, dnevne jedinice, evidencije i postavke.
- `src/lib/attendance.ts`: čista zajednička matematička logika.
- `src/lib/store.ts`: relacije, generiranje i premještanje termina, sigurnosne kopije.
- `src/lib/validation.ts`: validacija obrazaca/API podataka i sigurnosnih kopija.
- `src/app/api/data/route.ts`: transakcijske operacije nad Prisma bazom; provjera izvora web-mutacija.
- `src/components/portal.tsx`: responzivni studentski portal, kalendar, raspored, postavke i izvještaji.

Aplikacija je **osobni prostor za jednog korisnika**. Na Vercelu je obavezna prijava lozinkom `APP_PASSWORD` (najmanje 16 znakova). Lokalno je prijava neobavezna; uključuje se postavljanjem iste varijable. Sesija traje sedam dana i koristi potpisani HttpOnly cookie. Promjena lozinke poništava stare sesije. API zasebno provjerava sesiju uz zaštitu kroz Next.js Proxy. Razdvajanje više korisničkih računa nije implementirano. Nisu implementirane e-mail/push obavijesti, sinkronizacija s fakultetskim sustavima ni automatska potvrda službenih pravila. Upozorenja su unutar aplikacije.

Supabase se koristi kao PostgreSQL baza, dok postojeća prijava lozinkom ostaje zaštita osobnog prostora. Supabase Auth i višekorisnički računi nisu uvedeni. Tablice su u shemi `dolaznost`, RLS je uključen i `anon`/`authenticated` uloge nemaju pristup. Nemojte dodavati tu shemu u Supabase **Exposed schemas**. Server se spaja kao vlasnik tablica preko privatnog PostgreSQL connection stringa; javni Supabase Project URL i anon/publishable ključ nisu zamjena za njega.

Ako imate podatke iz ranije SQLite/Turso verzije, izvezite JSON iz stare aplikacije i uvezite ga u novu nakon objave. Format evidencije ostao je isti. Lokalna SQLite datoteka nije izbrisana, ali je novi runtime ne koristi. Stara SQL shema sačuvana je samo kao referenca u `prisma/legacy-sqlite/`; ne primjenjuje se na PostgreSQL.

Font DejaVu Sans i licenca nalaze se u `public/fonts/`. Ne dijelite `.env` i datoteke baze kroz Git.

## GitHub i Vercel

Repozitorij: https://github.com/nikolad4487-cell/izostanci

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnikolad4487-cell%2Fizostanci&env=DATABASE_URL,APP_PASSWORD&envDescription=Supabase%20PostgreSQL%20connection%20string%20i%20lozinka%20aplikacije&envLink=https%3A%2F%2Fgithub.com%2Fnikolad4487-cell%2Fizostanci%23github-i-vercel&project-name=izostanci&repository-name=izostanci)

1. U svom [Supabase](https://supabase.com/dashboard) projektu kliknite **Connect**. Pripremite lozinku baze (Database password); ako je ne znate, postavite novu kroz postavke baze.
2. Kopirajte **Session pooler** PostgreSQL connection string s portom **5432**. Session pooler podržava IPv4 i može poslužiti i aplikaciji i migracijama. Zamijenite `[YOUR-PASSWORD]` stvarnom lozinkom baze. Posebne znakove lozinke URL-enkodirajte, a TLS provjeru zadržite (`sslmode=verify-full`). Ne isključujte provjeru certifikata.
3. U Vercelu otvorite projekt → **Settings → Environment Variables**. Postavite:

   | Naziv          | Vrijednost                                                                                 | Obavezno |
   | -------------- | ------------------------------------------------------------------------------------------ | -------- |
   | `DATABASE_URL` | PostgreSQL connection string iz Supabase **Connect → Session pooler** (5432)               | Da       |
   | `APP_PASSWORD` | Vlastita duga nasumična lozinka za ulazak u aplikaciju, najmanje 16 znakova                | Da       |
   | `DIRECT_URL`   | Session pooler (5432) ili Direct connection za migracije, ako se razlikuje od runtime veze | Ne       |

   Za serverless runtime možete umjesto Session poolera koristiti **Transaction pooler** (6543) u `DATABASE_URL`, a Session pooler u `DIRECT_URL`. Koristite točne hostove i korisnička imena iz vlastitog Supabase Connect prozora. Direct connection može zahtijevati IPv6; ako ne radi s build stroja, za migracije koristite Session pooler. Ne unosite stvarne lozinke u Git ili razgovor i nemojte dodavati prefiks `NEXT_PUBLIC_` ovim varijablama.

4. Varijable uključite za **Production**, zatim otvorite **Deployments → Redeploy** najnovijeg commita. Vercel koristi Node.js 24.x, `npm ci` i `npm run build:vercel`. Skripta provjerava postavke, generira Prisma klijent, primjenjuje PostgreSQL migracije i gradi aplikaciju. Ako nedostaje obavezna varijabla, build se prekida s nazivom varijable.
5. Otvorite dodijeljenu adresu i prijavite se vrijednošću `APP_PASSWORD`. Izvoz/uvoz JSON-a i svi izračuni rade kao prije. Tablice ćete u Supabase Table Editoru pronaći u shemi **dolaznost**, a ne u `public`.

Stare varijable `TURSO_DATABASE_URL` i `TURSO_AUTH_TOKEN` više se ne koriste i možete ih ukloniti iz Vercela. Supabase Project URL (`https://...supabase.co`), anon/publishable ključ i service-role ključ **nisu** traženi PostgreSQL connection string. Za ovaj način rada nisu potrebni.

Migracije mijenjaju samo shemu `dolaznost` i svoju migracijsku evidenciju, bez diranja Supabaseovih `auth`, `storage` ili vaših drugih tablica. Evidentiraju kontrolne zbrojeve, koriste transakciju i PostgreSQL advisory lock radi zaštite od istodobnih buildova. Već primijenjene migracije nemojte mijenjati; dodajte novu mapu. Prije važnih izmjena preuzmite JSON sigurnosnu kopiju.

Za Preview koristite zaseban Supabase projekt/bazu ili onemogućite Preview dok ne postavite odvojene varijable. Testni uvoz i brisanje ne smiju koristiti produkcijsku bazu. GitHub Actions provjerava aplikaciju na PostgreSQL 17 servisu, uključujući migracije, RLS, izračune, prijavu, lint, TypeScript, build i preglednik.

Lokalno je migracija provjerena na PostgreSQL-u. Stvarna Supabase veza i Vercel objava zahtijevaju vaše postavke i zasebnu provjeru nakon Redeploya; spremanje koda nije potvrda uspješnog povezivanja s vašim projektom.
