
export enum AppView {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  DASHBOARD = 'DASHBOARD',
  PUBLIC_CHAT = 'PUBLIC_CHAT'
}

export enum DashboardTab {
  OVERVIEW = 'OVERVIEW',
  MESSAGES = 'MESSAGES',
  CATALOG = 'CATALOG',
  CUSTOMIZE = 'CUSTOMIZE',
  SETTINGS = 'SETTINGS'
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
}

export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  whatsapp?: string;
  facebook?: string;
}

export interface BusinessProfile {
  id: string;
  slug: string; // الرابط المخصص
  name: string;
  ownerName: string;
  description?: string;
  metaDescription?: string; // وصف الميتا المولد بالذكاء الاصطناعي
  phone: string;
  countryCode: string;
  logo: string;
  socialLinks: SocialLinks;
  products: Product[];
  currency: string;
  returnPolicy: string;
  deliveryPolicy: string;
}

export interface Message {
  id: string;
  sender: 'customer' | 'owner';
  text: string;
  timestamp: Date;
}

export interface User {
  id: string;
  phone: string;
  businessProfile: BusinessProfile;
}
