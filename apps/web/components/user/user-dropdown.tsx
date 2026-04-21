import { sidebarStore } from "@/store/sidebar/sidebar.store";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Bookmark,
  Bug,
  CircleFadingArrowUp,
  Info,
  Menu,
  MoreVertical,
  Plus,
  PlusCircle,
  Settings,
  SunMoon,
  User,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

interface UserDropdownProps {
  triggerIcon?: ReactNode;
  triggerDisabled?: boolean;
  triggerClassName?: string;
  preventOpen?: boolean;
  onTriggerAction?: () => void;
  triggerAriaLabel?: string;
}

export const UserDropdown = ({
  triggerIcon,
  triggerDisabled = false,
  triggerClassName,
  preventOpen = false,
  onTriggerAction,
  triggerAriaLabel,
}: UserDropdownProps = {}) => {
  const { push } = sidebarStore();
  const t = useTranslations("userDropdown");
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu
      open={preventOpen ? false : open}
      onOpenChange={(nextOpen) => {
        if (preventOpen) {
          if (nextOpen) {
            onTriggerAction?.();
          }
          setOpen(false);
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <DropdownMenuTrigger asChild className="ring-0 focus:ring-0">
        <Button
          variant="ghost"
          size={"icon"}
          className={triggerClassName}
          disabled={triggerDisabled}
          aria-label={triggerAriaLabel}
          onPointerDown={(event) => {
            if (!preventOpen) return;
            event.preventDefault();
            onTriggerAction?.();
          }}
          onClick={(event) => {
            if (!preventOpen) return;
            event.preventDefault();
            onTriggerAction?.();
          }}
        >
          {triggerIcon ?? <Menu />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-fit" align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled>
            <Plus />
            {t("addAccount")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Bookmark />
            {t("favorites")}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CircleFadingArrowUp />
            {t("myStories")}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <User />
            {t("contacts")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Wallet />
            {t("wallet")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => push({ screen: "settings" })}>
            <Settings />
            {t("settings")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <MoreVertical />
              {t("more")}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <SunMoon />
                  {t("toggleTheme")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Info />
                  {t("orisignFeatures")}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bug />
                  {t("reportBug")}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <PlusCircle />
                  {t("installApp")}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
