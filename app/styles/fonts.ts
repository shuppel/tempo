import { Text_Me_One, Happy_Monkey, Nunito_Sans } from "next/font/google";

export const textMeOne = Text_Me_One({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-text-me-one",
  display: "swap",
});

export const happyMonkey = Happy_Monkey({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-happy-monkey",
  display: "swap",
});

export const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-nunito-sans",
  display: "swap",
});
