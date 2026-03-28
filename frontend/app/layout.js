import "./globals.css";

export const metadata = {
  title: "ET News Intelligence",
  description: "Multimodal GenAI news assistant prototype for Economic Times"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

