export type UnknownObject = Record<string, unknown>;

export interface NinoxDatabaseSchema extends UnknownObject {
  id?: string;
  name?: string;
  tables?: unknown[];
}

export interface NinoxTableSchema extends UnknownObject {
  id?: string;
  name?: string;
  fields?: unknown[];
}

export interface NinoxRecord extends UnknownObject {
  id?: string | number;
  fields?: UnknownObject;
}

export interface ConnectionResult {
  connected: boolean;
  status: number | null;
  databaseId: string;
  databaseName?: string;
  error?: string;
}
