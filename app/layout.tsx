import type { Metadata } from "next";
import "./globals.css";
import "./profile.css";
export const metadata: Metadata = {
  title: "学域 XUEYU · 中国高校与专业观测平台",
  description: "看见中国高校的学科实力。以真实省界地图探索双一流高校、公开学科评估与高校官网动态，为择校、考研和人才研究提供可追溯依据。",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="zh-CN"><body>{children}</body></html>;
}
