import { Meta, StoryObj } from "@storybook/react";
import {
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
} from "./dropdown-menu";
import { Button } from "./button";
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

const meta: Meta<typeof DropdownMenu> = {
  title: "Components/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={"icon"}>
            <Menu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-fit" align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Plus />
              Добавить аккаунт
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Bookmark />
              Избранное
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CircleFadingArrowUp />
              Мои истории
            </DropdownMenuItem>
            <DropdownMenuItem>
              <User />
              Контакты
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Wallet />
              Кошелёк
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Settings />
              Настройки
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MoreVertical />
                Ещё
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>
                    <SunMoon />
                    Сменить тему
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Info />
                    Возможности Orisign
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Bug />
                    Сообщить об ошибке
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <PlusCircle />
                    Установить приложение
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};
