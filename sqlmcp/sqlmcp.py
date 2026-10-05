from objects import ExecuteSqlResult
from helpers import utils
from fastmcp import FastMCP
from sqlalchemy import URL, create_engine, text
from sqlalchemy.engine import Engine
from starlette.requests import Request
from starlette.responses import JSONResponse

mcp = FastMCP("sqlmcp")
http_subserver = FastMCP("http_subserver")
mcp.mount(http_subserver, namespace="http")
DB_CONNECTIONS = {}
SUPPORTED_DBMS = ['mssql']

def main():
    mcp.run(transport="stdio")

def create_db_engine(dbms: str, username: str, password: str, database: str, host: str, conn_query: dict | None = None) -> Engine:
    if dbms not in SUPPORTED_DBMS:
        raise ValueError(f"Unsupported DBMS '{dbms}'. Supported DBMS: {SUPPORTED_DBMS}")
    url = URL.create(
        drivername=dbms,
        username=username,
        password=password,
        host=host,
        database=database,
        query=conn_query,
    )
    engine = create_engine(url)
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return engine

@http_subserver.custom_route("/connect_db", methods=["POST"])
async def connect_db(request: Request):
    data = await request.json()
    required_fields = ["dbms", "username", "password", "database", "host"]
    if not all(field in data for field in required_fields):
        return JSONResponse(
            {"error": f"Missing required fields. Required: {required_fields}"},
            status_code=400,
        )
    try:
        engine = create_db_engine(
            dbms=data["dbms"],
            username=data["username"],
            password=data["password"],
            database=data["database"],
            host=data["host"],
            conn_query=data.get("conn_query"),
        )
        connection_id = f"{data['dbms']}://{data['username']}@{data['host']}/{data['database']}"
        DB_CONNECTIONS[connection_id] = engine
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    return JSONResponse({"connection_id": connection_id})

@http_subserver.custom_route("/connections", methods=["GET"])
async def list_connections(request: Request):
    return JSONResponse({"connections": list(DB_CONNECTIONS.keys())})

@http_subserver.custom_route("/close_db", methods=["DELETE"])
async def close_db(request: Request):
    data = await request.json()
    required_fields = ["connection_id"]
    if not all(field in data for field in required_fields):
        return JSONResponse(
            {"error": f"Missing required fields. Required: {required_fields}"},
            status_code=400,
        )
    connection_id = data["connection_id"]
    if connection_id not in DB_CONNECTIONS:
        return JSONResponse({"error": "Connection ID not found"}, status_code=404)
    del DB_CONNECTIONS[connection_id]
    return JSONResponse({"message": "Database connection closed successfully"})


def _get_engine(conn_id: str) -> Engine:
    try:
        return DB_CONNECTIONS[conn_id]
    except KeyError as exc:
        raise ValueError("Connection ID not found") from exc

@mcp.tool("execute_sql", description="Run a SQL query against a Database.")
async def execute_sql(
    conn_id: str,
    query: str,
    allowDestructive: bool = False,
    limit: int = 200,
) -> ExecuteSqlResult:
    """
    Run a SQL query against a database and return structured JSON-safe results.

    Args:
        conn_id: The connection identifier for a previously registered database engine.
        query: The SQL query to run. The query must be written with a dialect that fits the DBMS of the connection.
        allowDestructive: Is execution of destructive SQL statements (e.g. DROP, DELETE) allowed? Defaults to False for safety. Specified by user or system prompt.
        limit: Limit the number of rows returned for SELECT queries to prevent overwhelming the output.

    Returns:
        A JSON-compatible object containing result columns, rows, and count.
    """
    engine = _get_engine(conn_id)
    if not query.strip():
        raise ValueError("Query must not be empty")
    if limit < 1:
        raise ValueError("limit must be greater than 0")
    if utils.is_destructive_query(query) and not allowDestructive:
        raise PermissionError("Destructive SQL statements require allowDestructive=True")

    with engine.begin() as connection:
        result = connection.execute(text(query))
        if not result.returns_rows:
            return {"columns": [], "rows": [], "count": 0}
        columns = list(result.keys())
        fetched_rows = result.fetchmany(limit)
        rows = [[value for value in row] for row in fetched_rows]
        return {"columns": columns, "rows": rows, "count": len(rows)}

if __name__ == "__main__":
    mcp.run(transport="http", host="127.0.0.1", port=8000)