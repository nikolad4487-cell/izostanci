import { GraduationCap, LockKeyhole } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ greska?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="loading">
      <div
        className="panel"
        style={{ width: "min(420px,calc(100vw - 32px))", padding: 32 }}
      >
        <div
          className="brand"
          style={{ justifyContent: "center", marginBottom: 28 }}
        >
          <span className="brand-mark">
            <GraduationCap />
          </span>
          dolaznost.
        </div>
        <h1 style={{ fontSize: 24, textAlign: "center" }}>
          Tvoj studentski prostor
        </h1>
        <p
          className="muted"
          style={{ textAlign: "center", margin: "10px 0 24px" }}
        >
          Prijavi se za pristup svojoj evidenciji.
        </p>
        <form action="/api/auth/login" method="post">
          <label htmlFor="password">
            <span>Lozinka aplikacije</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            maxLength={1024}
          />
          {params.greska && (
            <p role="alert" className="alert danger">
              Lozinka nije ispravna. Pokušaj ponovno.
            </p>
          )}
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 20 }}
            type="submit"
          >
            <LockKeyhole size={15} />
            Prijavi se
          </button>
        </form>
        <p
          className="muted"
          style={{ textAlign: "center", fontSize: 11, marginTop: 22 }}
        >
          Privatna evidencija · Europe/Zagreb
        </p>
      </div>
    </main>
  );
}
