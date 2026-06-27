interface Connection {
  ID: number;
  Name: string;
  DBMS: string;
  Host: string;
  Username: string;
  Password: string;
  Database: string;
  sqlalchemy_query?: Object;
}

export default Connection;