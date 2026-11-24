"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Could not send message.");
      form.reset();
      setStatus("sent");
      setMessage("Thanks — your message was received.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Could not send message.",
      );
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
        />
      </div>
      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          required
          minLength={2}
          maxLength={150}
        />
      </div>
      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
        />
      </div>
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send message"}
      </Button>
      {message && (
        <p
          role="status"
          className={
            status === "error" ? "text-danger text-sm" : "text-primary text-sm"
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}
