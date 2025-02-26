import { type Metadata, type Viewport } from "next"
import { textMeOne, happyMonkey, nunitoSans } from "@/app/styles/fonts"
import "@/styles/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Header } from "@/components/header"
import { Toaster } from "@/components/ui/use-toast"

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "hsl(215 50% 95%)" },
    { media: "(prefers-color-scheme: dark)", color: "hsl(240 25% 12%)" }
  ],
  width: "width=device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "Toro - Task Management",
  description: "Plan your day by dumping your tasks and letting AI organize them into focused work sessions.",
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/assets/logo/toro_logo.png",
        type: "image/png",
        sizes: "32x32",
      },
    ],
    apple: {
      url: "/assets/logo/toro_logo.png",
      type: "image/png",
    },
  },
  manifest: "/manifest.json",
  applicationName: "Toro",
  keywords: ["task management", "pomodoro", "productivity", "AI", "planning"],
  authors: [{ name: "Toro Team" }],
  viewport: "width=device-width, initial-scale=1.0",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${textMeOne.variable} ${happyMonkey.variable} ${nunitoSans.variable}`} suppressHydrationWarning>
      <body className={`min-h-screen bg-background font-body antialiased theme-transition`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen flex flex-col">
            <Header />
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
