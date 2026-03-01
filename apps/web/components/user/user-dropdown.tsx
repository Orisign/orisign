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

export const UserDropdown = () => {
  const t = useTranslations("userDropdown");
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="ring-0 focus:ring-0">
        <Button variant="ghost" size={"icon"}>
          <Menu />
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
          <DropdownMenuItem>
            <Settings />
            {t("settings")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <MoreVertical />
              {t("more")}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent >
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
