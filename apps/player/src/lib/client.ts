// Instances de l'app : stockage, API, URL du serveur.
import { createApi } from './api';
import { createSessionStore } from './session';

export const API_URL: string = import.meta.env.VITE_API_URL ?? '';
export const session = createSessionStore(localStorage);
export const api = createApi({ baseUrl: API_URL, getToken: () => session.get()?.token ?? null });
