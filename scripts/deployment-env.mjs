function urlError(name, value) {
  if (
    value !== value.trim() ||
    /^["']|["']$/.test(value) ||
    value.startsWith(`${name}=`)
  )
    return `${name}: u Value unesite samo PostgreSQL connection string, bez navodnika, prefiksa ${name}= i dodatnih razmaka.`;
  try {
    const url = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    )
      return `${name}: neispravan format. Kopirajte PostgreSQL connection string iz Supabase Connect → Session pooler (5432), ne Project URL ili API ključ.`;
  } catch {
    return `${name}: neispravan connection string. Provjerite adresu, port i URL-enkodiranje posebnih znakova u lozinci baze.`;
  }
  return null;
}
/** @param {Record<string, string | undefined>} [env] */
export function deploymentEnvErrors(env = process.env) {
  const errors = [];
  if (!env.DATABASE_URL)
    errors.push(
      "DATABASE_URL: varijabla nije postavljena. Dodajte PostgreSQL connection string iz Supabase Connect → Session pooler (5432).",
    );
  else {
    const error = urlError("DATABASE_URL", env.DATABASE_URL);
    if (error) errors.push(error);
  }
  if (env.DIRECT_URL) {
    const error = urlError("DIRECT_URL", env.DIRECT_URL);
    if (error) errors.push(error);
  }
  if (!env.APP_PASSWORD)
    errors.push(
      "APP_PASSWORD: varijabla nije postavljena. Odaberite zasebnu lozinku aplikacije s najmanje 16 znakova.",
    );
  else if (env.APP_PASSWORD.length < 16)
    errors.push(
      "APP_PASSWORD: lozinka aplikacije ima manje od 16 znakova. Postavite dulju lozinku. To nije lozinka Supabase baze.",
    );
  return errors;
}
