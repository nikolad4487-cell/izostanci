# Dolaznost

Osobna web-aplikacija na hrvatskom za praćenje dolaznosti studenata. Next.js, React, TypeScript, Tailwind CSS, shadcn/ui Button, Lucide, Prisma, SQLite, Recharts, date-fns, React Hook Form i Zod.

## Lokalno pokretanje

Potreban je Node.js 24.x (provjereno na 24.19) i npm. Baza je lokalna datoteka na **poslužitelju**, ne stanje preglednika.

```bash
npm ci
cp .env.example .env
npm run db:push
npm run dev
```

Otvorite aplikaciju na portu 3000. Za produkcijski način:

```bash
npm run build
npm start
```

Ako `.env` već postoji, sačuvajte ga. `DATABASE_URL="file:./prisma/dev.db"` određuje put u odnosu na korijen projekta. Prilagođenu putanju postavite i pri pokretanju aplikacije i pri pripremi baze. Ne brišite bazu prilikom ažuriranja. Prije promjene sheme izvezite JSON sigurnosnu kopiju. `db:push` služi ovoj početnoj lokalnoj instalaciji; za budući razvoj produkcijske sheme koristite pregledane migracije.

Prisma 6.19 koristi `engineType = "client"`, JavaScript schema engine i `@prisma/adapter-libsql`. Lokalno radi s SQLite datotekom; na Vercelu koristi trajnu Turso bazu. Nema kompilacije `better-sqlite3` ni preuzimanja Rust enginea. Lokalni `db:push` čita isključivo `DATABASE_URL`; produkcijski `db:deploy` primjenjuje verzionirane SQL migracije na `TURSO_DATABASE_URL`.

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

Uvoz provjerava strukturu Zodom, relacije, identifikatore i duple dnevne jedinice. Traži izričitu potvrdu zamjene te radi atomarno: pogreška ne smije ostaviti djelomično uvezenu bazu. Granica datoteke u sučelju je 4 MB, ispod ograničenja Vercel funkcija. Uvoz zamjenjuje sve podatke; ne spaja dvije arhive. Redovito spremite JSON i izvan stroja koji pokreće aplikaciju. Datoteka `prisma/dev.db` također je lokalna baza; za kopiranje izravne datoteke prvo zaustavite poslužitelj.

## Provjere

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Vitest pokriva tražene matematičke scenarije, rubne postotke, opravdane/djelomične izostanke, buduće termine, nepotpune rasporede, nadoknade, odvojene semestre, promjene pravila i SQLite/API integraciju. Integracijski testovi koriste odvojenu privremenu bazu i provjeravaju očuvanje evidencije pri promjeni rasporeda, promjenu načina brojanja i atomarni JSON uvoz.

Playwright pokreće zaseban produkcijski poslužitelj na portu 3100 s privremenom bazom. Najprije napravite `npm run build`. Koristi `/usr/bin/chromium` kada je dostupan; drugdje instalirajte `npx playwright install chromium` ili postavite `CHROMIUM_PATH`. Test unosi stvarne podatke kroz obrasce, provjerava izostanak za četiri sata nastave, izvoz PDF/CSV/JSON, trajnost nakon ponovnog učitavanja, kalendar, statistiku, tamnu temu i mobilni prikaz. Testovi ne koriste vašu bazu.

## Struktura i ograničenja

- `prisma/schema.prisma`: akademske godine, semestri, praznici, kolegiji, skupine, pravila, tjedna ponavljanja, termini, dnevne jedinice, evidencije i postavke.
- `src/lib/attendance.ts`: čista zajednička matematička logika.
- `src/lib/store.ts`: relacije, generiranje i premještanje termina, sigurnosne kopije.
- `src/lib/validation.ts`: validacija obrazaca/API podataka i sigurnosnih kopija.
- `src/app/api/data/route.ts`: transakcijske operacije nad Prisma bazom; provjera izvora web-mutacija.
- `src/components/portal.tsx`: responzivni studentski portal, kalendar, raspored, postavke i izvještaji.

Aplikacija je **osobni prostor za jednog korisnika**. Na Vercelu je obavezna prijava lozinkom `APP_PASSWORD` (najmanje 16 znakova). Lokalno je prijava neobavezna; uključuje se postavljanjem iste varijable. Sesija traje sedam dana i koristi potpisani HttpOnly cookie. Promjena lozinke poništava stare sesije. API zasebno provjerava sesiju uz zaštitu kroz Next.js Proxy. Razdvajanje više korisničkih računa nije implementirano. Nisu implementirane e-mail/push obavijesti, sinkronizacija s fakultetskim sustavima ni automatska potvrda službenih pravila. Upozorenja su unutar aplikacije.

Za kasniji PostgreSQL prijelaz normalizirane relacije ostaju iste; treba promijeniti Prisma datasource, zamijeniti SQLite adapter PostgreSQL adapterom, izraditi migracije i prenijeti podatke. PostgreSQL put nije implementiran niti testiran u ovoj verziji.

Font DejaVu Sans i licenca nalaze se u `public/fonts/`. Ne dijelite `.env` i datoteke baze kroz Git.

## GitHub i Vercel

Repozitorij: https://github.com/nikolad4487-cell/izostanci

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnikolad4487-cell%2Fizostanci&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,APP_PASSWORD&envDescription=Trajna%20Turso%20SQLite%20baza%20i%20lozinka%20za%20privatnu%20evidenciju&envLink=https%3A%2F%2Fgithub.com%2Fnikolad4487-cell%2Fizostanci%23github-i-vercel&project-name=izostanci&repository-name=izostanci)

1. Na [Turso](https://turso.tech/) otvorite novu praznu bazu. U nadzornoj ploči kopirajte njen Database URL i napravite token s pravom čitanja i pisanja.
2. U [Vercel New Project](https://vercel.com/new) uvezite `nikolad4487-cell/izostanci`. Odaberite Next.js i korijenski direktorij repozitorija. Ako je repozitorij privatan, dopustite Vercel GitHub integraciji pristup.
3. Postavite Node.js 24.x i ove **Environment Variables** (vrijednosti unosite isključivo u Vercel, ne u Git i ne u razgovor):

   | Naziv                | Vrijednost                                               |
   | -------------------- | -------------------------------------------------------- |
   | `TURSO_DATABASE_URL` | URL nove baze, npr. `libsql://ime-organizacija.turso.io` |
   | `TURSO_AUTH_TOKEN`   | Turso token za tu bazu, s pravom pisanja                 |
   | `APP_PASSWORD`       | Vlastita duga nasumična lozinka, najmanje 16 znakova     |

4. Kliknite **Deploy**. `vercel.json` automatski bira `npm ci` i `npm run build:vercel`. Izgradnja provjerava postavke, generira Prisma klijent, primjenjuje verzionirane migracije i gradi Next.js aplikaciju. Ako nedostaje obavezna postavka, izgradnja se prekida uz naziv nedostajuće varijable; nema prelaska na privremenu lokalnu bazu.
5. Otvorite dodijeljenu Vercel adresu i prijavite se postavljenom lozinkom. Odjava je u gornjem izborniku. Ako postoje raniji lokalni podaci, najprije izvezite JSON, a zatim ga uvezite u objavljenu aplikaciju.

`DATABASE_URL=file:...` **ne postavljajte na Vercel**. Turso je trajna SQLite baza izvan serverless funkcije. Postojeća SQLite datoteka iz lokalnog okruženja nije dio Gita i ne prenosi se sama na Vercel.

Za Preview okruženja koristite zasebnu Turso bazu i token ili onemogućite preview deploymentove dok ih ne konfigurirate. Produkcijska baza ne bi se trebala koristiti za testne promjene i uvoz/brisanje testnih podataka. Nove SQL promjene dodajte kao novu migracijsku mapu; već primijenjene migracije ne mijenjajte. `db:deploy` bilježi kontrolne zbrojeve i čuva postojeću evidenciju pri ponovnom izvršavanju. Nemojte koristiti `db:push` ili reset nad produkcijskom bazom.

GitHub Actions provjerava izračune, bazu, prijavu, migracije, lint, TypeScript, build i korisnički tijek u pregledniku pri promjenama glavne grane. Običan `npm run build` služi lokalnom radu i CI-u; Vercel koristi `build:vercel` koji zahtijeva stvarnu udaljenu bazu.

Priprema i lokalne provjere ne znače da je projekt objavljen: prvi stvarni deployment zahtijeva vaš Vercel/Turso račun i gore navedene postavke. Vanjska Turso veza i Vercel objava moraju se provjeriti nakon njihovog unosa.
