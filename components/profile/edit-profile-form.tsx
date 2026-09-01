"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Profile } from "@prisma/client";
import {
  Bell,
  ArrowLeft,
  Camera,
  ChevronRight,
  LocateFixed,
  Lock,
  MapPin,
  ShieldCheck,
  type LucideIcon,
  UserRound,
} from "lucide-react";

import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/profile";
import { GENDER_OPTIONS, ORIENTATION_OPTIONS } from "@/lib/profile-options";
import { isProviderProfileType } from "@/lib/provider-types";

type BooleanFieldName =
  | "isVerified"
  | "openToChat"
  | "openToMeet"
  | "showInSearch"
  | "showExactLocation"
  | "showActivityStatus"
  | "isIncognito";

type EditableSectionId =
  | "basics"
  | "photos"
  | "location"
  | "privacy"
  | "availability";

type EditSectionId = EditableSectionId | "verification";

const EDIT_SECTIONS: {
  id: EditSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  providerOnly?: boolean;
  href?: string;
}[] = [
  { id: "basics", label: "Basics", description: "Name, bio, identity", icon: UserRound },
  { id: "photos", label: "Photos", description: "Profile image", icon: Camera },
  { id: "location", label: "Location", description: "City and nearby matching", icon: MapPin },
  { id: "privacy", label: "Privacy", description: "Visibility and activity", icon: Lock },
  { id: "availability", label: "Availability", description: "Chat and meet status", icon: Bell },
  { id: "verification", label: "Verification", description: "Identity and trust", icon: ShieldCheck, href: "/verification" },
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
  const className = cn(
    "flex min-h-[64px] w-full items-center gap-3 border-b border-border px-1 py-2 text-left transition-colors last:border-b-0 md:rounded-xl md:border md:px-3.5",
    isActive
      ? "md:border-foreground md:bg-foreground md:text-background"
      : "text-foreground hover:bg-muted md:border-border md:bg-card"
  );

  const content = (
    <>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground md:rounded-xl md:border",
          isActive ? "md:border-background/20 md:bg-background/10 md:text-background" : "md:border-border md:text-primary"
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{section.label}</span>
        <span className={cn("mt-0.5 block truncate text-xs", isActive ? "md:text-background/70" : "text-muted-foreground")}>
          {section.description}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground md:text-current" aria-hidden="true" />
    </>
  );

  if (section.href) {
    return (
      <Link href={section.href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={className}
    >
      {content}
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
    <section className="bg-transparent md:rounded-2xl md:border md:border-border md:bg-card md:p-6 md:shadow-sm">
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
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeSection, setActiveSection] = useState<EditableSectionId>("basics");
  const [mobileSection, setMobileSection] = useState<EditableSectionId | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
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
      showActivityStatus: profile.showActivityStatus,
      isIncognito: profile.isIncognito,
    },
  });

  const avatarUrl = watch("avatarUrl");
  const locationLat = watch("locationLat");
  const locationLng = watch("locationLng");
  const isProvider = isProviderProfileType(profile.profileType);
  const visibleSections = EDIT_SECTIONS.filter((section) => !section.providerOnly || isProvider);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  async function onSubmit(data: UpdateProfileInput) {
    setServerError(null);
    setStatus("saving");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus("idle");
      setServerError(body?.error ?? "Something went wrong. Please try again.");
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

  function renderSection(sectionId: EditableSectionId) {
    if (sectionId === "photos") {
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

    if (sectionId === "location") {
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

    if (sectionId === "privacy") {
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
              label="Show activity status"
              description="Let people you chat with see when you are online or were last active."
              control={control}
              name="showActivityStatus"
            />
            <ToggleRow
              label="Incognito mode"
              description="Hide your profile from viewer lists and discovery feeds."
              control={control}
              name="isIncognito"
            />
          </div>
        </SectionShell>
      );
    }

    if (sectionId === "availability") {
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

  function saveControls(mobile = false) {
    return (
      <div
        className={cn(
          "flex items-center justify-end gap-2",
          mobile && "sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-10 mt-6 rounded-xl border border-border bg-background/95 p-2 shadow-lift backdrop-blur"
        )}
      >
        <Button type="button" variant="ghost" onClick={() => router.push("/profile")} className="h-11">
          Cancel
        </Button>
        <Button type="submit" disabled={status !== "idle"} className="h-11 min-w-32">
          {status === "saving" && "Saving..."}
          {status === "success" && "Saved"}
          {status === "idle" && "Save changes"}
        </Button>
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="min-w-0 px-1 pb-6">
        {mobileSection === null ? (
          <>
            <div className="mb-4">
              <h1 className="font-heading text-2xl font-semibold text-foreground">Edit profile</h1>
              <p className="mt-1 text-sm text-muted-foreground">Choose one thing to update.</p>
            </div>
            <nav aria-label="Profile settings" className="border-y border-border">
              {visibleSections.map((section) => (
                <SectionButton
                  key={section.id}
                  section={section}
                  isActive={false}
                  onClick={() => setMobileSection(section.id as EditableSectionId)}
                />
              ))}
            </nav>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMobileSection(null)}
              className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Edit profile
            </button>
            {renderSection(mobileSection)}
            {serverError && <p role="alert" className="mt-4 text-sm text-destructive">{serverError}</p>}
            {saveControls(true)}
          </>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <div className="sticky top-24 space-y-2">
          <div className="mb-4 px-1">
            <h1 className="font-heading text-2xl font-semibold text-foreground">Edit profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage how you appear and connect.</p>
          </div>
          {visibleSections.map((section) => (
            <SectionButton
              key={section.id}
              section={section}
              isActive={!section.href && activeSection === section.id}
              onClick={() => setActiveSection(section.id as EditableSectionId)}
            />
          ))}
        </div>
      </aside>

      <div className="min-w-0">
        {renderSection(activeSection)}
        {serverError && <p role="alert" className="mt-4 text-sm text-destructive">{serverError}</p>}
        <div className="mt-4">{saveControls()}</div>
      </div>
    </form>
  );
}
