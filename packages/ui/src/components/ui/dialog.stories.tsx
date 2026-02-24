import { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";

const meta: Meta<typeof Dialog> = {
  title: "Components/Dialog",
  component: Dialog,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактирование профиля</DialogTitle>
          <DialogDescription>
            Измените свой профиль здесь. Сохраните, когда закончите.
          </DialogDescription>
        </DialogHeader>
        <Input placeholder="Имя пользователя" />
        <DialogFooter>
          <Button variant="outline">Отменить</Button>
          <Button>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
