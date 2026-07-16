// Represents database connections.

interface Connection {
  id: number
  name: string
  dbms: string
  host: string
  username: string
  password: string
  database: string
  sqlalchemy_query?: Record<string, string>
}

export default Connection
