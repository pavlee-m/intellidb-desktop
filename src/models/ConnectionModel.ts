export default interface ConnectionModel {
  id: number;
  name: string;
  dbms: string;
  host: string;
  username: string;
  password: string;
  database: string;
  sqlalchemyQuery: string | null;
}
