import {
  Briefcase,
  CalendarDays,
  Compass,
  Home,
  LineChart,
  MessageCircle,
  PlusCircle,
  Settings,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  providerOnly?: boolean;
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
  { href: "/services", label: "Services", icon: Briefcase },
  { href: "/communities", label: "Communities", icon: Users },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/creator-dashboard", label: "Creator Studio", icon: LineChart, providerOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];
