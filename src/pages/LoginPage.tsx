import { useState } from "react"
import type { CSSProperties, SubmitEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  BankIcon,
  ChartLineUpIcon,
  CircleNotchIcon,
  EyeIcon,
  EyeSlashIcon,
  ReceiptIcon,
} from "@phosphor-icons/react"
import logo from "../assets/twz-logo-light.png"

type FieldErrors = { identifier?: string; password?: string }

const SCOPE_ROWS = [
  { label: "Daily sales from Loyverse POS", icon: ChartLineUpIcon },
  { label: "Bank deposit matching", icon: BankIcon },
  { label: "Expenses & receipts", icon: ReceiptIcon },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    const id = identifier.trim()
    if (!id) next.identifier = "Enter your username or Gmail."
    else if (id.includes("@") && !/^[^\s@]+@gmail\.com$/i.test(id))
      next.identifier = "That doesn't look like a valid Gmail address."
    if (!password) next.password = "Enter your password."
    else if (password.length < 6) next.password = "Password must be at least 6 characters."
    return next
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    // TODO: wire to the real auth API once the backend exists
    await new Promise((r) => setTimeout(r, 900))
    setSubmitting(false)
    navigate("/")
  }

  /* 16px on touch widths: WebKit zooms into focused inputs below 16px */
  const inputBase =
    "mt-2 w-full rounded-lg border bg-surface px-3.5 py-2.5 text-[16px] lg:text-[15px] text-ink placeholder:text-mute outline-none transition-[border-color,box-shadow] duration-200 ease-quiet"
  const inputOk =
    "border-line-strong hover:border-mute focus:border-brand-deep focus:shadow-[0_0_0_2px_rgba(30,125,27,0.8)]"
  const inputBad =
    "border-claret/60 focus:border-claret focus:shadow-[0_0_0_2px_rgba(179,57,47,0.8)]"

  return (
    <main className="relative min-h-[100dvh] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Left — brand panel (compact logo header on mobile) */}
      <section className="relative overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-14">
        {/* Quiet paper depth: fine dot grid + a soft warm light, desktop only */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden opacity-[0.25] lg:block"
          style={{
            backgroundImage: "radial-gradient(rgba(21,22,19,0.08) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{
            background:
              "radial-gradient(38rem 24rem at 10% -4%, rgba(52,101,56,0.05), transparent 60%)",
          }}
        />

        <header
          className="anim-rise relative flex justify-center pt-10 lg:justify-start lg:pt-0"
          style={{ "--index": 0 } as CSSProperties}
        >
          <img
            src={logo}
            alt="Two Wheels Zone"
            className="h-12 w-auto select-none sm:h-14"
            draggable={false}
          />
        </header>

        <div className="relative hidden max-w-lg lg:block">
          <p
            className="anim-rise font-mono text-[11px] uppercase tracking-[0.18em] text-mute"
            style={{ "--index": 1 } as CSSProperties}
          >
            Manager console
          </p>
          <p
            className="anim-rise mt-4 pb-1 font-serif text-[2.75rem] font-normal leading-[1.15] tracking-[-0.02em] text-ink"
            style={{ "--index": 2 } as CSSProperties}
          >
            Run every branch from <em className="italic">one place.</em>
          </p>
          <p
            className="anim-rise mt-4 text-[15px] leading-relaxed text-mute"
            style={{ "--index": 3 } as CSSProperties}
          >
            Daily sales, bank deposits, and expenses for every Two Wheels Zone branch.
          </p>

          <ul
            className="anim-rise mt-10 max-w-sm space-y-2.5"
            style={{ "--index": 4 } as CSSProperties}
          >
            {SCOPE_ROWS.map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage text-sage-ink">
                  <Icon size={15} weight="bold" aria-hidden="true" />
                </span>
                <span className="text-[14px] text-ink-soft">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <footer
          className="anim-rise relative hidden lg:block"
          style={{ "--index": 5 } as CSSProperties}
        >
          <span className="text-[13px] text-mute">© 2026 Two Wheels Zone</span>
        </footer>
      </section>

      {/* Right — sign-in panel */}
      <section className="flex items-start justify-center px-4 pb-12 pt-8 lg:min-h-[100dvh] lg:items-center lg:border-l lg:border-line lg:bg-surface lg:px-14 lg:py-0">
        <div className="w-full max-w-[24.5rem]">
          {/* Card chrome on mobile only; the form sits bare on the white desktop panel */}
          <div
            className="anim-rise rounded-xl border border-line bg-surface px-6 py-7 sm:px-8 lg:border-0 lg:bg-transparent lg:p-0"
            style={{ "--index": 1 } as CSSProperties}
          >
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Sign in</h1>
            <p className="mt-1 text-[14px] text-mute">Use the staff account issued to you.</p>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <div>
                <label htmlFor="identifier" className="text-[13px] font-medium text-ink-soft">
                  Username or Gmail
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="email"
                  enterKeyHint="next"
                  spellCheck={false}
                  placeholder="name@gmail.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  aria-invalid={Boolean(errors.identifier)}
                  aria-describedby={errors.identifier ? "identifier-error" : undefined}
                  className={`${inputBase} ${errors.identifier ? inputBad : inputOk}`}
                />
                {errors.identifier && (
                  <p id="identifier-error" role="alert" className="mt-1.5 text-[13px] text-claret">
                    {errors.identifier}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="text-[13px] font-medium text-ink-soft">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    className={`${inputBase} pr-11 ${errors.password ? inputBad : inputOk}`}
                  />
                  {/* h-11/w-11 fills the input's reserved pr-11 strip: 44px tap target, same visual */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-0 top-1/2 mt-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-mute transition-colors duration-200 ease-quiet hover:text-ink"
                  >
                    {showPassword ? (
                      <EyeSlashIcon size={17} weight="bold" aria-hidden="true" />
                    ) : (
                      <EyeIcon size={17} weight="bold" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" role="alert" className="mt-1.5 text-[13px] text-claret">
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <label className="-my-2 flex cursor-pointer items-center gap-2 py-2 text-[13.5px] text-ink-soft">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded accent-brand-deep"
                  />
                  Keep me signed in
                </label>
                <button
                  type="button"
                  onClick={() => {
                    // TODO: password reset flow once the backend exists
                  }}
                  className="-my-2 py-2 text-[13.5px] font-medium text-brand-deep underline-offset-4 transition-opacity duration-200 ease-quiet hover:underline hover:opacity-80"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60"
              >
                {submitting && (
                  <CircleNotchIcon size={16} weight="bold" className="animate-spin" aria-hidden="true" />
                )}
                <span>{submitting ? "Signing in" : "Sign in"}</span>
              </button>
            </form>

            <div className="mt-7 border-t border-line pt-4">
              <p className="text-[12.5px] text-mute">
                Access is limited to Two Wheels Zone staff. Contact the owner if you need an
                account.
              </p>
            </div>
          </div>

          {/* Mobile-only footer (desktop shows it in the left panel) */}
          <p
            className="anim-rise mt-6 text-center text-[12.5px] text-mute lg:hidden"
            style={{ "--index": 2 } as CSSProperties}
          >
            © 2026 Two Wheels Zone
          </p>
        </div>
      </section>
    </main>
  )
}
