import type es from './messages/es.json';

type Messages = typeof es;

declare global {
  // Tipado estricto de claves de traducción para next-intl.
  interface IntlMessages extends Messages {}
}

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
