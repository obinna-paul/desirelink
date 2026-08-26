"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Profile } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { AccountTypeSelector } from "@/components/account-type-selector";
import { PremiumUpsell } from "@/components/premium/premium-upsell";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/profile";
import { GENDER_OPTIONS, ORIENTATION_OPTIONS } from "@/lib/profile-options";
import { SERVICE_CATEGORY_OPTIONS } from "@/lib/account-types";

type BooleanFieldName =
  | "isVerified"
  | "openToChat"
  | "openToMeet"
  | "showInSearch"
  | "showExactLocation"
  | "isIncognito";

function FieldWrapper({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  control,
  name,
}: {
  label: string;
  description: string;
  control: Control<UpdateProfileInput>;
  name: BooleanFieldName;
}) {
  return (
    <label
      htmlFor={name}
      className="flex min-h-[56px] cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card px-3.5 py-3 shadow-sm md:rounded-lg md:px-4 md:shadow-none"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch id={name} checked={field.value} onCheckedChange={field.onChange} />
        )}
      />
    </label>
  );
}

export function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [premiumUpsell, setPremiumUpsell] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      gender: profile.gender,
      orientation: profile.orientation,
      city: profile.city,
      country: profile.country,
      profileType: profile.profileType,
      serviceCategories: profile.serviceCategories,
      isVerified: profile.isVerified,
      openToChat: profile.openToChat,
      openToMeet: profile.openToMeet,
      showInSearch: profile.showInSearch,
      showExactLocation: profile.showExactLocation,
      isIncognito: profile.isIncognito,
    },
  });

  const avatarUrl = watch("avatarUrl");
  const profileType = watch("profileType");
  const serviceCategories = watch("serviceCategories");

  function toggleServiceCategory(category: string) {
    const next = serviceCategories.includes(category)
      ? serviceCategories.filter((value) => value !== category)
      : [...serviceCategories, category];
    setValue("serviceCategories", next, { shouldDirty: true });
  }

  async function onSubmit(data: UpdateProfileInput) {
    setServerError(null);
    setPremiumUpsell(null);
    setStatus("saving");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus("idle");
      if (body?.code === "PREMIUM_REQUIRED") {
        setPremiumUpsell(body.error);
      } else {
        setServerError(body?.error ?? "Something went wrong. Please try again.");
      }
      return;
    }

    setStatus("success");
    router.push("/profile");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 md:gap-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Photo
        </h2>
        <AvatarUploader
          defaultUrl={avatarUrl}
          fallback={profile.displayName.slice(0, 2).toUpperCase()}
          onUploaded={(url) => setValue("avatarUrl", url, { shouldDirty: true })}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          About you
        </h2>
        <FieldWrapper label="Display name" htmlFor="displayName" error={errors.displayName?.message}>
          <Input id="displayName" {...register("displayName")} />
        </FieldWrapper>
        <FieldWrapper label="Bio" htmlFor="bio" error={errors.bio?.message}>
          <Textarea id="bio" rows={4} {...register("bio")} className="resize-none rounded-2xl text-base md:rounded-md md:text-sm" />
        </FieldWrapper>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Gender" htmlFor="gender" error={errors.gender?.message}>
            <Select id="gender" {...register("gender")}>
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Orientation" htmlFor="orientation" error={errors.orientation?.message}>
            <Select id="orientation" {...register("orientation")}>
              {ORIENTATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FieldWrapper>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="City" htmlFor="city" error={errors.city?.message}>
            <Input id="city" {...register("city")} />
          </FieldWrapper>
          <FieldWrapper label="Country" htmlFor="country" error={errors.country?.message}>
            <Input id="country" {...register("country")} />
          </FieldWrapper>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Account type
        </h2>
        <Controller
          control={control}
          name="profileType"
          render={({ field }) => (
            <AccountTypeSelector
              value={field.value}
              onChange={field.onChange}
              className="sm:grid-cols-2"
            />
          )}
        />

        {profileType === "SERVICE_PROVIDER" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Services you offer</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SERVICE_CATEGORY_OPTIONS.map((category) => (
                <label
                  key={category}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 text-sm md:rounded-lg"
                >
                  <input
                    type="checkbox"
                    checked={serviceCategories.includes(category)}
                    onChange={() => toggleServiceCategory(category)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  {category}
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Verification
        </h2>
        <ToggleRow
          label="Verified"
          description="Attest that this is your real identity. Boosts your reputation and shows a Verified badge."
          control={control}
          name="isVerified"
        />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Availability
        </h2>
        <ToggleRow
          label="Open to chat"
          description="Show up in the Chat and Flirt tabs and let people message you."
          control={control}
          name="openToChat"
        />
        <ToggleRow
          label="Open to meet"
          description="Show up in the Meet tab for people nearby."
          control={control}
          name="openToMeet"
        />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Privacy
        </h2>
        <ToggleRow
          label="Show in search results"
          description="Let others find your profile through search."
          control={control}
          name="showInSearch"
        />
        <ToggleRow
          label="Show exact location"
          description="Display your precise city instead of an approximate area."
          control={control}
          name="showExactLocation"
        />
        <ToggleRow
          label="Incognito mode"
          description="Hide your profile from viewer lists and discovery feeds."
          control={control}
          name="isIncognito"
        />
        {premiumUpsell && (
          <PremiumUpsell
            compact
            title="Incognito is premium"
            description={premiumUpsell}
          />
        )}
      </section>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lift backdrop-blur sm:static sm:flex-row sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <Button type="submit" disabled={status !== "idle"} className="h-12">
          {status === "saving" && "Saving..."}
          {status === "success" && "Saved!"}
          {status === "idle" && "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/profile")} className="h-12">
          Cancel
        </Button>
      </div>
    </form>
  );
}
