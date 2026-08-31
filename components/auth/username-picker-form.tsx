"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { usernameFieldSchema } from "@/lib/validations/auth";

const formSchema = z.object({ username: usernameFieldSchema });
type FormInput = z.infer<typeof formSchema>;

export function UsernamePickerForm({ suggestedUsername }: { suggestedUsername: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: suggestedUsername },
  });

  async function onSubmit(data: FormInput) {
    setServerError(null);
    setStatus("submitting");

    const res = await fetch("/api/profile/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: data.username }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus("idle");
      setServerError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStatus("success");
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField
        label="Username"
        autoComplete="username"
        registration={register("username")}
        error={errors.username?.message}
        variant="lightAuth"
      />
      {serverError && (
        <p role="alert" className="text-sm text-[#b42318]">
          {serverError}
        </p>
      )}
      <Button
        type="submit"
        disabled={status !== "idle"}
        className="h-[52px] rounded-xl bg-[#050505] text-base text-white shadow-[0_14px_30px_rgba(5,5,5,0.18)] hover:bg-[#1b1b1b] sm:h-12 sm:rounded-lg sm:text-sm"
      >
        {status === "submitting" && "Saving..."}
        {status === "success" && "Success! Redirecting..."}
        {status === "idle" && "Continue"}
      </Button>
    </form>
  );
}
