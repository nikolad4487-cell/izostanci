import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/prijava$/);
  await page
    .getByLabel("Lozinka aplikacije")
    .fill("e2e-local-test-password-2026");
  await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pregled dolaznosti" }),
  ).toBeVisible();
});
test("Cijeli studentski tijek: postavke, kolegij, četiri sata = jedan izostanak, izvoz i trajnost", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Pregled dolaznosti" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Postavke" })
    .click();
  await page.getByRole("button", { name: "Dodaj", exact: true }).nth(0).click();
  await page
    .getByLabel("Akademska godina *", { exact: true })
    .fill("2026./2027.");
  await page.getByRole("button", { name: "Spremi", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Dodaj", exact: true }).nth(1).click();
  await page.getByLabel("Naziv semestra *").fill("Zimski semestar");
  await page.getByLabel("Početak nastave *").fill("2026-01-01");
  await page.getByLabel("Završetak nastave *").fill("2026-12-31");
  await page.getByRole("button", { name: "Spremi", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Moji kolegiji" })
    .click();
  await page.getByRole("button", { name: "Novi kolegij" }).click();
  await page.getByLabel("Naziv kolegija *").fill("Osnove ekonomije");
  await expect(page.getByLabel("Boja kolegija")).toHaveValue("#2563eb");
  await page.getByLabel("Ukupna satnica predavanja (P)").fill("60");
  await page.getByLabel("Planirani broj dana / termina").fill("15");
  await page.getByRole("button", { name: "Spremi", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Detalji kolegija" }).click();
  await expect(
    page.getByRole("heading", { name: "Osnove ekonomije", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Dodaj termin", exact: true })
    .first()
    .click();
  await page.getByLabel("Datum *", { exact: true }).fill("2026-01-05");
  await page.getByLabel("Broj nastavnih sati").fill("4");
  await page.getByRole("button", { name: "Spremi", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("Dolaznost 2026-01-05 09:00").selectOption("ABSENT");
  await expect(
    page
      .locator("dt")
      .filter({ hasText: "Propušteni nastavni sati" })
      .locator("..")
      .locator("dd"),
  ).toHaveText("4");
  await expect(
    page
      .locator("dt")
      .filter({ hasText: /^Izostanci$/ })
      .locator("..")
      .locator("dd"),
  ).toHaveText("1");
  await expect(
    page
      .locator("dt")
      .filter({ hasText: /^Preostali izostanci$/ })
      .locator("..")
      .locator("dd"),
  ).toHaveText("2");
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  expect((await csv).suggestedFilename()).toBe("evidencija.csv");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Moji kolegiji" })
    .click();
  await expect(
    page.getByRole("button", { name: "Osnove ekonomije" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Detalji kolegija" }).click();
  await expect(page.getByLabel("Dolaznost 2026-01-05 09:00")).toHaveValue(
    "ABSENT",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kalendar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kalendar nastave" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dan", exact: true }).click();
  await expect(page.getByLabel("Odaberi datum")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Statistika", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dolaznost po kolegijima", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Promijeni temu" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({
    path: "/tmp/dolaznost-statistika.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Otvori navigaciju" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Nadzorna ploča" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pregled dolaznosti" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/dolaznost-mobitel.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Otvori navigaciju" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Postavke" })
    .click();
  const backup = page.waitForEvent("download");
  await page.getByRole("button", { name: "Sigurnosna kopija (JSON)" }).click();
  expect((await backup).suggestedFilename()).toContain(".json");
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Odjavi se" }).click();
  await expect(page).toHaveURL(/\/prijava$/);
  expect((await page.request.get("/api/data")).status()).toBe(401);
});

test("Posebna pravila, tjedno generiranje i otkazivanje nastave kroz sučelje", async ({
  page,
}) => {
  // Odvojeni unos kroz API služi samo pripremi; sve radnje pravila i rasporeda provjeravaju se kroz obrasce.
  const { fixture } = await import("../tests/fixtures");
  const data = fixture();
  data.sessions = [];
  data.units = [];
  const restored = await page.request.post("/api/data", {
    data: { action: "restore", backup: { version: 1, data }, confirm: true },
  });
  expect(restored.ok()).toBe(true);
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Moji kolegiji" })
    .click();
  await page.getByRole("button", { name: "Detalji kolegija" }).click();
  await page.getByRole("button", { name: "Nova skupina / pravilo" }).click();
  await page.getByLabel("Naziv skupine *").fill("Vježbe");
  await page.getByLabel("Vrsta nastave", { exact: true }).selectOption("V");
  await page.getByLabel("Planirani broj evidencijskih jedinica").fill("4");
  await page.getByLabel("Pravilo dolaznosti").selectOption("MAX");
  await page.getByLabel("Maksimalno / ručno dopuštenih izostanaka").fill("1");
  await page
    .getByLabel("Posljedica prekoračenja (neobavezno)")
    .fill("ponovno upisivanje kolegija");
  await page.getByRole("button", { name: "Spremi", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Tjedno ponavljanje" }).click();
  const groupOptions = await page
    .getByLabel("Kolegij i skupina *")
    .locator("option")
    .allTextContents();
  expect(groupOptions.some((o) => o.includes("Vježbe"))).toBe(true);
  await page
    .getByLabel("Kolegij i skupina *")
    .selectOption({ label: groupOptions.find((o) => o.includes("Vježbe"))! });
  await page.getByLabel("Dan u tjednu").selectOption("1");
  await page.getByLabel("Ponavljanje od *").fill("2026-01-01");
  await page.getByLabel("Ponavljanje do *").fill("2026-01-31");
  await page.getByRole("button", { name: "Spremi", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const first = page.locator("tr").filter({ hasText: "05.01.2026." });
  await first.getByRole("combobox").selectOption("ABSENT");
  const second = page.locator("tr").filter({ hasText: "12.01.2026." });
  await second.getByRole("combobox").selectOption("ABSENT");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Prekoračili ste dopušteni broj izostanaka" }),
  ).toContainText("ponovno upisivanje kolegija");
  const rulePanel = page
    .locator(".panel")
    .filter({ has: page.getByRole("heading", { name: /Vježbe/ }) })
    .first();
  await expect(
    rulePanel
      .locator("dt")
      .filter({ hasText: /^Izostanci$/ })
      .locator("..")
      .locator("dd"),
  ).toHaveText("2");
  await second
    .getByRole("button", { name: "Uredi termin", exact: true })
    .click();
  await page.getByLabel("Održavanje").selectOption("CANCELLED");
  await page.getByRole("button", { name: "Spremi", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    rulePanel
      .locator("dt")
      .filter({ hasText: /^Izostanci$/ })
      .locator("..")
      .locator("dd"),
  ).toHaveText("1");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Prekoračili ste dopušteni broj izostanaka" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tjedni raspored" })
    .click();
  await expect(page.locator(".slot-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Osvježi termine", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Moji kolegiji" })
    .click();
  await page.getByRole("button", { name: "Detalji kolegija" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Promijeni temu" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Promijeni temu" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Nadzorna ploča" })
    .click();
  await page.screenshot({
    path: "/tmp/dolaznost-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});
