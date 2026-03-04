import "./globals.css";

export const metadata = {
  title: "Ultra 2026 Heatmap",
  description: "Pick your must-see sets and see what your crew wants to see at Ultra Music Festival 2026",
  openGraph: {
    title: "Ultra 2026 Heatmap",
    description: "Vote on which sets to see at Ultra 2026!",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
