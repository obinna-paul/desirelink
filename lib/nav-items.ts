import {
  CalendarDays,
  Compass,
  Home,
  MessageCircle,
  PlusCircle,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const primaryNavItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/create", label: "Create", icon: PlusCircle },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
];

export const secondaryNavItems: NavItem[] = [
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/communities", label: "Communities", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];
