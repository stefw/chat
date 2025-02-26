import { Inter } from "next/font/google";
import "./globals.css";
import Warnings from "./components/warnings";
import { assistantId } from "./assistant-config";
import styles from "./components/chat.module.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Assistants API Quickstart",
  description: "A quickstart template using the Assistants API with OpenAI",
  icons: {
    icon: "/openai.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {assistantId ? children : <Warnings />}
        {/* <img className="logo" src="/openai.svg" alt="OpenAI Logo" /> */}
        <div className={styles.heavenCard}>
          <span role="img" aria-label="star" style={{ marginRight: '8px', fontSize: '16px' }}>✨</span>
          heaven.paris<br/> research 2025
        </div>
      </body>
    </html>
  );
}
