"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { Button } from "./ui/button";
export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "textarea" | "color" | "select";
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  options?: { value: string; label: string }[];
  help?: string;
};
export type FormConfig = {
  title: string;
  description?: string;
  fields: Field[];
  initial: Record<string, unknown>;
  submit: (v: Record<string, unknown>) => Promise<void>;
};
export function FormDialog({
  config,
  onClose,
}: {
  config: FormConfig;
  onClose: () => void;
}) {
  const formId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shape: Record<string, z.ZodString> = {};
  config.fields.forEach((f) => {
    let s = z.string();
    if (f.required) s = s.refine((v) => v.trim().length > 0, "Obavezno polje.");
    if (f.type === "number")
      s = s.refine(
        (v) =>
          v !== "" &&
          Number.isFinite(Number(v)) &&
          (f.min === undefined || Number(v) >= f.min) &&
          (f.max === undefined || Number(v) <= f.max),
        "Unesite broj u dopuštenom rasponu.",
      );
    shape[f.name] = s;
  });
  const schema = z.object(shape);
  const defaults = Object.fromEntries(
    config.fields.map((f) => [f.name, String(config.initial[f.name] ?? "")]),
  );
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="form-dialog"
    >
      <div className="dialog-heading">
        <div>
          <h2>{config.title}</h2>
          {config.description && <p className="muted">{config.description}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Zatvori"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </Button>
      </div>
      <form
        onSubmit={handleSubmit(async (values) => {
          setBusy(true);
          setError("");
          try {
            const parsed: Record<string, unknown> = { ...values };
            config.fields.forEach((f) => {
              if (f.type === "number") parsed[f.name] = Number(values[f.name]);
              if (
                f.type === "select" &&
                f.options?.some((o) => o.value === "true") &&
                f.options?.some((o) => o.value === "false")
              ) {
                if (values[f.name] === "true") parsed[f.name] = true;
                if (values[f.name] === "false") parsed[f.name] = false;
              }
            });
            await config.submit(parsed);
            onClose();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Spremanje nije uspjelo.",
            );
          } finally {
            setBusy(false);
          }
        })}
      >
        <div className="form-grid">
          {config.fields.map((f) => (
            <div className={f.type === "textarea" ? "span-2" : ""} key={f.name}>
              <label htmlFor={`${formId}-${f.name}`}>
                <span>
                  {f.label}
                  {f.required ? " *" : ""}
                </span>
              </label>
              {f.type === "color" ? (
                <Controller
                  control={control}
                  name={f.name}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="color"
                      id={`${formId}-${f.name}`}
                      aria-invalid={!!errors[f.name]}
                    />
                  )}
                />
              ) : f.type === "select" ? (
                <select
                  id={`${formId}-${f.name}`}
                  {...register(f.name)}
                  aria-invalid={!!errors[f.name]}
                  aria-describedby={
                    f.help ? `${formId}-${f.name}-help` : undefined
                  }
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  id={`${formId}-${f.name}`}
                  {...register(f.name)}
                  rows={3}
                />
              ) : (
                <input
                  id={`${formId}-${f.name}`}
                  aria-describedby={
                    f.help ? `${formId}-${f.name}-help` : undefined
                  }
                  {...register(f.name)}
                  type={f.type ?? "text"}
                  min={f.min}
                  max={f.max}
                  step={f.step ?? (f.type === "number" ? "1" : undefined)}
                  aria-invalid={!!errors[f.name]}
                />
              )}{" "}
              {f.help && (
                <small id={`${formId}-${f.name}-help`} className="muted">
                  {f.help}
                </small>
              )}
              {errors[f.name] && (
                <small className="text-danger">
                  {String(errors[f.name]?.message)}
                </small>
              )}
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="alert danger">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Odustani
          </Button>
          <Button disabled={busy} type="submit">
            {busy ? "Spremanje…" : "Spremi"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
