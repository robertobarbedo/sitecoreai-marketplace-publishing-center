import { GoogleAnalytics } from "@/src/components/google-analytics";
import "./globals.css";

export const metadata = {
  title: 'Publishing Center',
  description: 'Publish pages and check their live status from SitecoreAI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  )
}
