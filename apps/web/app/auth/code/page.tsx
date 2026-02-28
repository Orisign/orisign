import { getCountryByCode } from "@/lib/phone-countries";

type CodePageProps = {
  searchParams: Promise<{
    country?: string;
    phone?: string;
  }>;
};

export default async function AuthCodePage({ searchParams }: CodePageProps) {
  const { country, phone } = await searchParams;
  const selectedCountry = country ? getCountryByCode(country) : undefined;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1f2024] px-4 py-10 text-white">
      <div
        aria-hidden="true"
        className="auth-drift pointer-events-none absolute -left-14 top-8 h-52 w-52 rounded-full bg-[#7c67e8]/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="auth-drift pointer-events-none absolute -bottom-16 -right-14 h-64 w-64 rounded-full bg-[#00b4d8]/15 blur-3xl"
      />

      <section className="auth-fade-up w-full max-w-sm space-y-6 rounded-2xl border border-[#343741] bg-[#24262d]/92 p-6 backdrop-blur-sm">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Подтверждение кода</h1>
          <p className="text-sm text-[#9da3af]">
            Введите код, который мы отправили на номер телефона.
          </p>
        </header>

        <div className="space-y-1 rounded-xl bg-[#1f2024] p-4 text-sm text-[#cfd3de]">
          <p>
            <span className="text-[#8b909d]">Страна: </span>
            {selectedCountry ? `${selectedCountry.name} (+${selectedCountry.dialCode})` : "Не выбрана"}
          </p>
          <p>
            <span className="text-[#8b909d]">Номер: </span>
            {phone ?? "Не указан"}
          </p>
        </div>

        <form className="space-y-4">
          <label className="block" htmlFor="otp">
            <span className="mb-2 block text-xs text-[#8b909d]">Код из SMS</span>
            <div className="auth-code-shell">
              <input
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="_ _ _ _ _ _"
                required
                className="relative z-10 h-14 w-full rounded-xl border border-transparent bg-[#1f2024] px-4 text-center text-base tracking-[0.4em] text-[#eff1f8] outline-none transition placeholder:text-[#717786] focus:ring-2 focus:ring-[#7c67e8]/25"
              />
            </div>
          </label>

          <button
            type="submit"
            className="h-14 w-full rounded-xl bg-[#7c67e8] text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-[#8a76ef]"
          >
            Подтвердить
          </button>
        </form>
      </section>
    </main>
  );
}
