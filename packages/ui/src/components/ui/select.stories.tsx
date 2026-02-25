import type { Meta, StoryObj } from "@storybook/react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select"

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = {
  render: () => (
    <div className="w-[280px]">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Выберите язык" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ru">Русский</SelectItem>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="de">Deutsch</SelectItem>
          <SelectItem value="fr">Français</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div className="w-[280px]">
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Недоступно" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ru">Русский</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}

export const WithGroups: Story = {
  render: () => (
    <div className="w-[320px]">
      <Select defaultValue="general">
        <SelectTrigger>
          <SelectValue placeholder="Выберите раздел" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Основное</SelectLabel>
            <SelectItem value="general">Общие настройки</SelectItem>
            <SelectItem value="notifications">Уведомления</SelectItem>
            <SelectItem value="privacy">Приватность</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Аккаунт</SelectLabel>
            <SelectItem value="profile">Профиль</SelectItem>
            <SelectItem value="security">Безопасность</SelectItem>
            <SelectItem value="devices">Устройства</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
}

export const LongList: Story = {
  render: () => (
    <div className="w-[280px]">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Выберите страну" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ru">Россия</SelectItem>
          <SelectItem value="kz">Казахстан</SelectItem>
          <SelectItem value="by">Беларусь</SelectItem>
          <SelectItem value="am">Армения</SelectItem>
          <SelectItem value="az">Азербайджан</SelectItem>
          <SelectItem value="kg">Кыргызстан</SelectItem>
          <SelectItem value="uz">Узбекистан</SelectItem>
          <SelectItem value="tj">Таджикистан</SelectItem>
          <SelectItem value="ge">Грузия</SelectItem>
          <SelectItem value="md">Молдова</SelectItem>
          <SelectItem value="ua">Украина</SelectItem>
          <SelectItem value="tr">Турция</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}
