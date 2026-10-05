import sqlparse

DESTRUCTIVE_STATEMENTS = {
    "ALTER",
    "CALL",
    "CREATE",
    "DELETE",
    "DROP",
    "EXEC",
    "EXECUTE",
    "GRANT",
    "INSERT",
    "MERGE",
    "RENAME",
    "REPLACE",
    "REVOKE",
    "TRUNCATE",
    "UPDATE",
}
STATEMENT_KEYWORDS = DESTRUCTIVE_STATEMENTS | {"SELECT", "WITH"}

def is_destructive_query(query: str) -> bool:
    parsed = sqlparse.parse(query)
    if not parsed:
        raise ValueError("Invalid SQL query.")
    for statement in parsed:
        for token in statement.tokens:
            if token.ttype is sqlparse.tokens.DDL or token.ttype is sqlparse.tokens.DML:
                keyword = token.value.upper()
                if keyword in DESTRUCTIVE_STATEMENTS:
                    return True
    return False