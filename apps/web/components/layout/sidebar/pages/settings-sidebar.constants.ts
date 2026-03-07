import { SidebarRoute } from "@/store/sidebar/sidebar-state.types";
import {
  AtSign,
  Bell,
  Database,
  FolderOpen,
  Gift,
  Info,
  Languages,
  Lock,
  Phone,
  Settings,
  SmilePlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IoLanguageSharp } from "react-icons/io5";

export const SETTINGS_HEADER_TRANSFORM_RANGE: number[] = [0, 260];
export const SETTINGS_COLLAPSED_AVATAR_SIZE = 86;

export const SETTINGS_PROFILE_ROWS = [
  { key: "phone", icon: Phone },
  { key: "username", icon: AtSign },
  { key: "bio", icon: Info },
  { key: "birthDate", icon: Gift },
] as const;

type SectionItem = {
  key:
    | "notificationsAndSound"
    | "dataAndStorage"
    | "privacyAndSecurity"
    | "generalSettings"
    | "chatFolders"
    | "stickersAndEmoji"
    | "language";
  icon: LucideIcon;
  route: SidebarRoute;
};

export const SETTINGS_SECTION_ITEMS: SectionItem[] = [
  {
    key: "notificationsAndSound",
    icon: Bell,
    route: { screen: "notifications" },
  },
  {
    key: "dataAndStorage",
    icon: Database,
    route: { screen: "data-and-storage" },
  },
  {
    key: "privacyAndSecurity",
    icon: Lock,
    route: { screen: "privacy-and-security" },
  },
  {
    key: "generalSettings",
    icon: Settings,
    route: { screen: "general-settings" },
  },
  {
    key: "chatFolders",
    icon: FolderOpen,
    route: { screen: "chat-folders" },
  },
  {
    key: "stickersAndEmoji",
    icon: SmilePlus,
    route: { screen: "stickers-and-emoji" },
  },
  {
    key: "language",
    icon: Languages,
    route: { screen: "language" },
  },
];
