"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Profile } from "@prisma/client";
import {
  Bell,
  Camera,
  ChevronRight,
  LocateFixed,
  Lock,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  type LucideIcon,
  UserRound,
  WalletCards,
} from "lucide-react";

import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { PremiumUpsell } from "@/components/premium/premium-upsell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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

type EditSectionId =
  | "basics"
  | "photos"
  | "location"
  | "privacy"
  | "availability"
  | "desires"
  | "services"
  | "verification"
  | "monetization";

const EDIT_SECTIONS: {
  id: EditSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  { id: "basics", label: "Basics", description: "Name, bio, identity", icon: UserRound },
  { id: "photos", label: "Photos", description: "Profile image", icon: Camera },
  { id: "location", label: "Location", description: "City and nearby matching", icon: MapPin },
  { id: "privacy", label: "Privacy", description: "Search, location, incognito", icon: Lock },
  { id: "availability", label: "Availability", description: "Chat and meet status", icon: Bell },
  { id: "desires", label: "Desire Map", description: "Recommendation signals", icon: Sparkles },
  { id: "services", label: "Services", description: "What you offer", icon: Store },
  { id: "verification", label: "Verification", description: "Trust signals", icon: ShieldCheck },
  { id: "monetization", label: "Monetization", description: "Premium and payouts", icon: WalletCards },
];

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
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
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
      className="flex min-h-[64px] cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/55 px-4 py-3 transition-colors hover:bg-secondary/70"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
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

function SectionButton({
  section,
  isActive,
  onClick,
}: {
  section: (typeof EDIT_SECTIONS)[number];
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = section.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-[60px] min-w-[178px] items-center gap-3 rounded-2xl border px-3.5 text-left transition-colors md:min-w-0 md:rounded-xl",
        isActive
          ? "border-foreground bg-foreground text-background"
          : "border-border/70 bg-card text-foreground hover:bg-secondary"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          isActive ? "border-background/20 bg-background/10" : "border-border/70 bg-secondary text-primary"
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{section.label}</span>
        <span className={cn("hidden truncate text-xs md:block", isActive ? "text-background/70" : "text-muted-foreground")}>
          {section.description}
        </span>
      </span>
      <ChevronRight className="hidden h-4 w-4 shrink-0 md:block" aria-hidden="true" />
    </button>
  );
}

function SectionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-border/70 bg-card p-4 shadow-sm sm:p-6 md:rounded-2xl">
      <div className="mb-5">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<EditSectionId>("basics");
  const [status, setStatus] = useState<"idle" | "saving" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [premiumUpsell, setPremiumUpsell] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "success" | "error">("idle");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

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
      locationLat: profile.locationLat,
      locationLng: profile.locationLng,
      city: profile.city,
      country: profile.country,
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
  const serviceCategories = watch("serviceCategories") ?? [];
  const locationLat = watch("locationLat");
  const locationLng = watch("locationLng");
  const activeMeta = EDIT_SECTIONS.find((section) => section.id === activeSection) ?? EDIT_SECTIONS[0];

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
        setActiveSection("privacy");
      } else {
        setServerError(body?.error ?? "Something went wrong. Please try again.");
      }
      return;
    }

    setStatus("success");
    router.push("/profile");
    router.refresh();
  }

  function useCurrentLocation() {
    setLocationMessage(null);

    if (!("geolocation" in navigator)) {
      setLocationStatus("error");
      setLocationMessage("Your browser does not support location detection.");
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue("locationLat", Number(position.coords.latitude.toFixed(6)), { shouldDirty: true });
        setValue("locationLng", Number(position.coords.longitude.toFixed(6)), { shouldDirty: true });
        setLocationStatus("success");
        setLocationMessage("Location captured. Save changes to update nearby matching.");
      },
      () => {
        setLocationStatus("error");
        setLocationMessage("We could not access your location. Check browser permission and try again.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  function renderActiveSection() {
    if (activeSection === "photos") {
      return (
        <SectionShell title="Photos" description="Use a clear profile image so people recognize you quickly.">
          <input type="hidden" {...register("avatarUrl")} />
          <AvatarUploader
            defaultUrl={avatarUrl}
            fallback={profile.displayName.slice(0, 2).toUpperCase()}
            onUploaded={(url) => setValue("avatarUrl", url, { shouldDirty: true })}
          />
        </SectionShell>
      );
    }

    if (activeSection === "location") {
      return (
        <SectionShell title="Location" description="Use city-level details publicly and private coordinates for nearby matching.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldWrapper label="City" htmlFor="city" error={errors.city?.message}>
              <Input id="city" {...register("city")} />
            </FieldWrapper>
            <FieldWrapper label="Country" htmlFor="country" error={errors.country?.message}>
              <Input id="country" {...register("country")} />
            </FieldWrapper>
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-background/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Nearby matching</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  Coordinates improve distance sorting. Exact location display stays controlled by privacy settings.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2 sm:w-auto"
                disabled={locationStatus === "locating"}
                onClick={useCurrentLocation}
              >
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                {locationStatus === "locating" ? "Locating..." : "Use current location"}
              </Button>
            </div>
            {(locationLat !== 0 || locationLng !== 0) && (
              <p className="mt-3 text-xs text-muted-foreground">
                Coordinates saved: {Number(locationLat).toFixed(3)}, {Number(locationLng).toFixed(3)}
              </p>
            )}
            {locationMessage && (
              <p
                role={locationStatus === "error" ? "alert" : undefined}
                className={locationStatus === "error" ? "mt-3 text-xs text-destructive" : "mt-3 text-xs text-muted-foreground"}
              >
                {locationMessage}
              </p>
            )}
          </div>
        </SectionShell>
      );
    }

    if (activeSection === "privacy") {
      return (
        <SectionShell title="Privacy" description="Control discoverability, location visibility, and premium privacy features.">
          <div className="flex flex-col gap-3">
            <ToggleRow
              label="Show in search results"
              description="Let others find your profile through search and discovery."
              control={control}
              name="showInSearch"
            />
            <ToggleRow
              label="Show exact location"
              description="Display your city and country when your profile is visible."
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
              <PremiumUpsell compact title="Incognito is premium" description={premiumUpsell} />
            )}
          </div>
        </SectionShell>
      );
    }

    if (activeSection === "availability") {
      return (
        <SectionShell title="Availability" description="Set the signals people see before they contact you.">
          <div className="flex flex-col gap-3">
            <ToggleRow
              label="Open to chat"
              description="Show that you are available for messages."
              control={control}
              name="openToChat"
            />
            <ToggleRow
              label="Open to meet"
              description="Show that you are available for nearby plans."
              control={control}
              name="openToMeet"
            />
          </div>
        </SectionShell>
      );
    }

    if (activeSection === "desires") {
      return (
        <SectionShell title="Desire Map" description="Your Desire Map now lives below this form as a focused editor.">
          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Save any profile changes, then use the Desire Map editor below to update what you are looking for,
              what you enjoy, and what should influence recommendations.
            </p>
            <Button asChild type="button" variant="outline" className="mt-4 h-11">
              <a href="#desire-map">
                Open Desire Map <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </SectionShell>
      );
    }

    if (activeSection === "services") {
      return (
        <SectionShell title="Services" description="Choose service categories you want your profile to be associated with.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SERVICE_CATEGORY_OPTIONS.map((category) => (
              <label
                key={category}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-3 text-sm font-medium transition-colors",
                  serviceCategories.includes(category)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/70 bg-background/60 text-foreground hover:bg-secondary"
                )}
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
        </SectionShell>
      );
    }

    if (activeSection === "verification") {
      return (
        <SectionShell title="Verification" description="Keep trust signals separate from public labels and account types.">
          <ToggleRow
            label="Verified"
            description="Attest that this is your real identity. This shows a Verified badge."
            control={control}
            name="isVerified"
          />
        </SectionShell>
      );
    }

    if (activeSection === "monetization") {
      return (
        <SectionShell title="Monetization" description="Premium subscriptions, provider revenue, and payouts are managed from dedicated dashboards.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-12 justify-between">
              <a href="/creator-dashboard">
                Creator Studio <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline" className="h-12 justify-between">
              <a href="/provider-dashboard/earnings">
                Earnings <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </SectionShell>
      );
    }

    return (
      <SectionShell title="Basics" description="The public identity people see before they interact with you.">
        <div className="grid grid-cols-1 gap-4">
          <FieldWrapper label="Display name" htmlFor="displayName" error={errors.displayName?.message}>
            <Input id="displayName" {...register("displayName")} />
          </FieldWrapper>
          <FieldWrapper label="Bio" htmlFor="bio" error={errors.bio?.message}>
            <Textarea id="bio" rows={5} {...register("bio")} className="resize-none rounded-2xl text-base md:text-sm" />
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
        </div>
      </SectionShell>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 lg:mx-0 lg:block lg:space-y-2 lg:overflow-visible lg:px-0 lg:pb-0">
          {EDIT_SECTIONS.map((section) => (
            <SectionButton
              key={section.id}
              section={section}
              isActive={activeSection === section.id}
              onClick={() => setActiveSection(section.id)}
            />
          ))}
        </div>
      </aside>

      <div className="min-w-0">
        {renderActiveSection()}

        {serverError && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <div className="mt-4 flex flex-col-reverse gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => router.push("/profile")} className="h-11">
            Cancel
          </Button>
          <Button type="submit" disabled={status !== "idle"} className="h-11">
            {status === "saving" && "Saving..."}
            {status === "success" && "Saved!"}
            {status === "idle" && "Save changes"}
          </Button>
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-card p-4 text-sm leading-6 text-muted-foreground shadow-sm lg:hidden">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Editing {activeMeta.label}
          </div>
          <p className="mt-1">{activeMeta.description}</p>
        </div>
      </div>
    </form>
  );
}
