uv run nuitka --standalone --onefile \
  --include-module=uvicorn.protocols.websockets.websockets_sansio_impl \
  --include-module=pymysql \
  --include-module=mariadb \
  --include-package=sqlalchemy.dialects.postgresql \
  --include-package=psycopg \
  --include-package=psycopg_binary \
  --include-data-dir=.venv/lib/python3.12/site-packages/psycopg_binary.libs=psycopg_binary.libs \
  --include-module=ibm_db \
  --include-module=ibm_db_dbi \
  --include-package=ibm_db_sa \
  --include-distribution-metadata=ibm_db_sa \
  --include-data-dir=.venv/lib/python3.12/site-packages/clidriver=clidriver \
  --include-data-dir=.venv/lib/python3.12/site-packages/ibm_db.libs=ibm_db.libs \
  sqlmcp.py