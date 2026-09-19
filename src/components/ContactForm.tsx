"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { waLink } from "@/lib/site";

type Errors = Partial<Record<"name" | "phone" | "message", string>>;

export function ContactForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  function validate(): Errors {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Enter your name.";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) next.phone = "Enter a valid phone number.";
    if (message.trim().length < 8) next.message = "Tell us a little more.";
    return next;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hp) return;
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const text = [`Contact from the menu`, `Name: ${name.trim()}`, `Phone: ${phone.trim()}`, "", message.trim()].join(
      "\n",
    );
    window.open(waLink(text), "_blank", "noopener,noreferrer");
    router.push("/thank-you");
  }

  return (
    <form className="contact-form" onSubmit={onSubmit} noValidate>
      <div className="hp" aria-hidden="true">
        <label>
          Company
          <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </label>
      </div>
      <label className={errors.name ? "field field-err" : "field"}>
        Name
        <input
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? <span className="field-msg">{errors.name}</span> : null}
      </label>
      <label className={errors.phone ? "field field-err" : "field"}>
        Phone
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-invalid={Boolean(errors.phone)}
        />
        {errors.phone ? <span className="field-msg">{errors.phone}</span> : null}
      </label>
      <label className={errors.message ? "field field-err" : "field"}>
        Message
        <textarea
          name="message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={Boolean(errors.message)}
        />
        {errors.message ? <span className="field-msg">{errors.message}</span> : null}
      </label>
      <button type="submit" className="doc-cta" disabled={busy}>
        {busy ? "Opening WhatsApp…" : "Send on WhatsApp"}
      </button>
    </form>
  );
}
